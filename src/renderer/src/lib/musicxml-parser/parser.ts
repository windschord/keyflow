import { XMLParser } from 'fast-xml-parser';
import { unzipSync } from 'fflate';
import { Score, Part, Measure, Note, TempoEvent, Hand, PedalSpan } from '../../types';
import { toMidiNumber } from './midi-utils';
import { detectHand } from './hand-detector';

export class MusicXMLParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MusicXMLParseError';
  }
}

/** 正規化PPQ（Pulses Per Quarter note）。DEC-005で定数480に決定。 */
const TICKS_PER_QUARTER = 480;
const DEFAULT_TEMPO = 120;

/**
 * パース対象XMLの最大文字数（3千万文字）。悪意ある巨大ファイルによるメモリ枯渇DoSを
 * 防ぐ上限（TASK-091）。実在の譜面は数KB〜数百KB規模であり、十分な余裕を持たせている。
 */
const MAX_XML_LENGTH = 30_000_000;

/**
 * .mxl展開後の全エントリ合計サイズの上限（50MB）。高圧縮率のzip爆弾による
 * メモリ枯渇を抑えるため、unzipSync後に合計サイズを検査する（TASK-091）。
 */
const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024;

/** .mxl内のエントリ数上限。zip爆弾のエントリ数増幅対策（TASK-091）。 */
const MAX_ZIP_ENTRIES = 1000;

/**
 * XMLのDOCTYPE宣言を検出する。内部エンティティ展開（billion laughs）や
 * 外部DTD参照を予防的に遮断するため、パース前に検査する（TASK-091）。
 * MusicXMLは実務上DOCTYPEを必要としない。
 */
function containsDoctype(xmlContent: string): boolean {
  return /<!DOCTYPE/i.test(xmlContent);
}

interface MeasureBuilder {
  number: number;
  startTick: number;
  notes: Note[];
}

/**
 * tick位置に対応する秒数を tempoMap（区間ごとのbpm）に基づいて積分計算する。
 * tempoMap は tick 昇順でソート済みかつ先頭要素の tick が 0 であることを前提とする。
 */
function tickToSeconds(tick: number, tempoMap: TempoEvent[]): number {
  let seconds = 0;
  for (let i = 0; i < tempoMap.length; i++) {
    const segStart = tempoMap[i].tick;
    if (tick <= segStart) break;
    const segEnd = i + 1 < tempoMap.length ? tempoMap[i + 1].tick : Infinity;
    const segTickSpan = Math.min(tick, segEnd) - segStart;
    seconds += (segTickSpan / TICKS_PER_QUARTER) * (60 / tempoMap[i].bpm);
    if (tick <= segEnd) break;
  }
  return seconds;
}

function getDirectChildByTag(el: Element, tag: string): Element | null {
  for (const child of Array.from(el.children)) {
    if (child.tagName === tag) return child;
  }
  return null;
}

function getDirectChildText(el: Element, tag: string): string | undefined {
  const child = getDirectChildByTag(el, tag);
  return child?.textContent ?? undefined;
}

function parseNumberOrDefault(text: string | undefined, fallback: number): number {
  if (text === undefined) return fallback;
  const value = parseFloat(text);
  return Number.isNaN(value) ? fallback : value;
}

/**
 * MusicXMLの`duration`（`divisions`単位）を正規化tick（PPQ=480）へ変換する。
 *
 * `divisions`が480の約数でない譜面（例: divisions=7）では`duration * (480/divisions)`が
 * 浮動小数になる。丸めずに`cursor`へ加減算し続けると、backup/forwardを挟んだ別ボイス・
 * 別パートが同一の音楽的時刻に到達しても、加算順序の違いによる浮動小数点誤差で
 * `startTick`が完全一致しなくなり、「同一startTick=同時発音」という同時判定が崩れる
 * （CodeRabbit指摘）。各ステップ（note/backup/forward）でこの関数を通じて必ず整数へ
 * 丸めてから`cursor`を加減算することで、常に整数tick上で計算が閉じるようにする。
 */
function toTicks(duration: number, divisions: number): number {
  return Math.round((duration * TICKS_PER_QUARTER) / divisions);
}

/**
 * 複数パートから収集したペダル区間をtick昇順にソートし、重複（真に重なり合う）区間を
 * 結合する（設計書の「複数パートのペダルをマージし重複区間を結合する」方針に従う）。
 * `change`による分割で生じる境界が接するだけの区間（例: [0,960]と[960,1920]）は
 * 別区間として維持する（次のstartTickが前のendTick未満の場合のみ結合対象とする）。
 */
function mergePedalSpans(spans: PedalSpan[]): PedalSpan[] {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a.startTick - b.startTick || a.endTick - b.endTick);
  const merged: PedalSpan[] = [];
  let current = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.startTick < current.endTick) {
      current.endTick = Math.max(current.endTick, next.endTick);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
}

export function parse(xmlContent: string): Score {
  if (!xmlContent || xmlContent.trim().length === 0) {
    throw new MusicXMLParseError('Empty XML content');
  }

  // 入力堅牢化（TASK-091）: 巨大ファイルによるメモリ枯渇DoSを防ぐ上限チェック。
  if (xmlContent.length > MAX_XML_LENGTH) {
    throw new MusicXMLParseError(
      `XML content exceeds the maximum allowed length (${MAX_XML_LENGTH} characters)`
    );
  }

  // 入力堅牢化（TASK-091）: DOCTYPEを拒否し、内部エンティティ展開（billion laughs）と
  // 外部DTD参照を予防的に遮断する。この遮断により実体展開DoSは成立しないため、
  // `processEntities` は既定（true）のまま維持する。false にすると `&amp;` 等の
  // 予約実体参照まで復号されず、曲名・歌詞の表示を壊す副作用があるため採用しない。
  if (containsDoctype(xmlContent)) {
    throw new MusicXMLParseError('DOCTYPE declarations are not allowed in MusicXML input');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (_name, jpath, _isLeafNode, _isAttribute) => {
      const jpathStr = String(jpath);
      if (
        ['score-partwise.part-list.score-part', 'score-partwise.part', 'measure', 'note'].includes(
          jpathStr
        )
      ) {
        return true;
      }
      return false;
    },
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xmlContent) as Record<string, unknown>;
  } catch (err: unknown) {
    throw new MusicXMLParseError(
      'Invalid XML format: ' + (err instanceof Error ? err.message : String(err))
    );
  }

  if (!parsed || !parsed['score-partwise']) {
    throw new MusicXMLParseError('Invalid MusicXML: Missing <score-partwise> root element');
  }

  const scorePartwise = parsed['score-partwise'] as Record<string, unknown> | undefined;

  const title =
    ((scorePartwise?.['work'] as Record<string, unknown>)?.['work-title'] as string | undefined) ||
    (scorePartwise?.['movement-title'] as string | undefined) ||
    'Untitled';

  const partsList = (scorePartwise?.['part-list'] as Record<string, unknown>)?.['score-part'] || [];
  const parts: Part[] = [];

  let rawParts = scorePartwise?.['part'] || [];
  if (!Array.isArray(rawParts)) rawParts = [rawParts];

  let partsListArr = partsList;
  if (!Array.isArray(partsListArr)) partsListArr = [partsListArr];

  // Extract part metadata
  (partsListArr as unknown[]).forEach((scorePart: unknown, index: number) => {
    const sp = scorePart as Record<string, unknown>;
    const partId = sp['@_id'] as string;
    // part-nameはprint-object属性がある場合にオブジェクトとして返ることがある
    const rawPartName = sp['part-name'];
    const partName =
      typeof rawPartName === 'object' && rawPartName !== null
        ? ((rawPartName as Record<string, unknown>)['#text'] as string | undefined)
        : (rawPartName as string | undefined);

    // Find the corresponding part data to look for a clef
    const partData = (rawParts as Record<string, unknown>[]).find(
      (p: Record<string, unknown>) => p['@_id'] === partId
    );
    let clefSign: string | undefined;
    let clefType: 'treble' | 'bass' = 'treble';

    if (partData && partData['measure']) {
      let firstMeasure = partData['measure'];
      if (Array.isArray(firstMeasure)) {
        firstMeasure = firstMeasure[0];
      }

      const fm = firstMeasure as Record<string, unknown>;
      if (fm && fm['attributes']) {
        const attributes = fm['attributes'] as Record<string, unknown>;
        if (attributes && attributes['clef']) {
          const clef = Array.isArray(attributes['clef'])
            ? attributes['clef'][0]
            : attributes['clef'];
          clefSign = (clef as Record<string, unknown>)['sign'] as string | undefined;
          if (clefSign === 'F') {
            clefType = 'bass';
          }
        }
      }
    }

    const hand = detectHand(partName, clefSign, index);

    parts.push({
      id: partId,
      name: partName || `Part ${index + 1}`,
      hand,
      clef: clefType,
    });
  });

  // --- v2: 時刻付与・noteId統一（TASK-031 / data-model-v2.md） ---
  // <backup>/<forward>/<chord>/<divisions> はXML上の兄弟要素間の出現順序が重要なため、
  // 順序を保持できるDOMParserで別途トラバースする。fast-xml-parserは同名要素を
  // タグ名ごとの配列にまとめてしまい、異なるタグ間の相対順序が失われるためである。
  const xmlDoc = new DOMParser().parseFromString(xmlContent, 'application/xml');
  const partElements = Array.from(xmlDoc.getElementsByTagName('part'));

  let beats = 4;
  let beatType = 4;
  let keySignature = 0;

  // Pass 1: Measure.startTick はパート1の小節長累積で決定する（設計書の規則）。
  const measureStartTicks = new Map<number, number>();
  if (partElements.length > 0) {
    let divisions = 1;
    let runningTick = 0;
    const firstPartMeasures = Array.from(partElements[0].children).filter(
      (c) => c.tagName === 'measure'
    );

    for (const measureEl of firstPartMeasures) {
      const measureNumber = parseInt(measureEl.getAttribute('number') || '0', 10);
      measureStartTicks.set(measureNumber, runningTick);

      let cursor = 0;
      let maxCursor = 0;
      for (const child of Array.from(measureEl.children)) {
        if (child.tagName === 'attributes') {
          const divisionsText = getDirectChildText(child, 'divisions');
          if (divisionsText !== undefined) {
            divisions = parseNumberOrDefault(divisionsText, divisions);
          }
        } else if (child.tagName === 'note') {
          const isChordNote = getDirectChildByTag(child, 'chord') !== null;
          const duration = parseNumberOrDefault(getDirectChildText(child, 'duration'), 0);
          if (!isChordNote) {
            cursor += toTicks(duration, divisions);
            if (cursor > maxCursor) maxCursor = cursor;
          }
        } else if (child.tagName === 'backup') {
          const duration = parseNumberOrDefault(getDirectChildText(child, 'duration'), 0);
          cursor -= toTicks(duration, divisions);
        } else if (child.tagName === 'forward') {
          const duration = parseNumberOrDefault(getDirectChildText(child, 'duration'), 0);
          cursor += toTicks(duration, divisions);
          if (cursor > maxCursor) maxCursor = cursor;
        }
      }
      runningTick += maxCursor;
    }
  }

  // Pass 2: 全パートを走査し、tick/voice/noteId/staff/handを付与する。
  const measuresMap = new Map<number, MeasureBuilder>();
  const tempoEventsMap = new Map<number, number>();
  // TASK-048: staff/hand決定にPart.handを参照するためのルックアップ。
  const partsById = new Map<string, Part>(parts.map((p) => [p.id, p]));
  // TASK-069: ペダル記号（<direction-type><pedal>）の解析。
  // パートごとに開区間の開始tickを追跡し、確定した区間はrawPedalSpansへ積む。
  // stopが現れないまま曲末尾に達した開区間はfinalTick（全ノートの
  // startTick+durationTicksの最大値）で閉じるため、パート走査完了時点では
  // 未クローズのまま openPedalStartsAtEnd に退避する。
  const rawPedalSpans: PedalSpan[] = [];
  const openPedalStartsAtEnd: number[] = [];

  const ensureMeasure = (measureNumber: number): MeasureBuilder => {
    if (!measuresMap.has(measureNumber)) {
      measuresMap.set(measureNumber, {
        number: measureNumber,
        startTick: measureStartTicks.get(measureNumber) ?? 0,
        notes: [],
      });
    }
    return measuresMap.get(measureNumber)!;
  };

  for (const partEl of partElements) {
    const partId = partEl.getAttribute('id') || '';
    let divisions = 1;
    // TASK-048: <attributes><staves> を追跡する。2以上なら1パート2段譜として
    // staff番号から直接hand（1='right'、2以降='left'）を決定し、未指定/1段の
    // パートは従来通りPart.handを継承する。
    let staves = 1;
    const measureElements = Array.from(partEl.children).filter((c) => c.tagName === 'measure');
    // TASK-069: このパート内で現在開いているペダル区間の開始tick（未開始はnull）。
    let openPedalStart: number | null = null;

    for (const measureEl of measureElements) {
      const measureNumber = parseInt(measureEl.getAttribute('number') || '0', 10);
      const measure = ensureMeasure(measureNumber);
      const measureStartTick = measure.startTick;

      let cursor = 0;
      let lastStartTick = 0;
      let noteIndexCounter = 0;

      for (const child of Array.from(measureEl.children)) {
        const tag = child.tagName;

        if (tag === 'attributes') {
          const divisionsText = getDirectChildText(child, 'divisions');
          if (divisionsText !== undefined) {
            divisions = parseNumberOrDefault(divisionsText, divisions);
          }
          const stavesText = getDirectChildText(child, 'staves');
          if (stavesText !== undefined) {
            staves = parseNumberOrDefault(stavesText, staves);
          }
          const timeEl = getDirectChildByTag(child, 'time');
          if (timeEl) {
            beats = parseNumberOrDefault(getDirectChildText(timeEl, 'beats'), beats);
            beatType = parseNumberOrDefault(getDirectChildText(timeEl, 'beat-type'), beatType);
          }
          const keyEl = getDirectChildByTag(child, 'key');
          if (keyEl) {
            const fifthsText = getDirectChildText(keyEl, 'fifths');
            if (fifthsText !== undefined) {
              keySignature = parseNumberOrDefault(fifthsText, keySignature);
            }
          }
        } else if (tag === 'direction') {
          const soundEl = getDirectChildByTag(child, 'sound');
          const tempoAttr = soundEl?.getAttribute('tempo');
          if (tempoAttr) {
            const absoluteTick = measureStartTick + cursor;
            tempoEventsMap.set(absoluteTick, parseNumberOrDefault(tempoAttr, DEFAULT_TEMPO));
          }

          // TASK-069: <direction-type><pedal type="start|stop|change"/>を解析する。
          // continueほかは無視する（US-014備考）。
          const directionTypeEl = getDirectChildByTag(child, 'direction-type');
          const pedalEl = directionTypeEl ? getDirectChildByTag(directionTypeEl, 'pedal') : null;
          if (pedalEl) {
            const pedalType = pedalEl.getAttribute('type');
            const absoluteTick = measureStartTick + cursor;
            if (pedalType === 'start') {
              if (openPedalStart === null) {
                openPedalStart = absoluteTick;
              }
            } else if (pedalType === 'stop') {
              if (openPedalStart !== null) {
                rawPedalSpans.push({ startTick: openPedalStart, endTick: absoluteTick });
                openPedalStart = null;
              }
            } else if (pedalType === 'change') {
              if (openPedalStart !== null) {
                rawPedalSpans.push({ startTick: openPedalStart, endTick: absoluteTick });
              }
              openPedalStart = absoluteTick;
            }
          }
        } else if (tag === 'note') {
          const isRest = getDirectChildByTag(child, 'rest') !== null;
          const isChord = getDirectChildByTag(child, 'chord') !== null;
          const duration = parseNumberOrDefault(getDirectChildText(child, 'duration'), 0);
          const voice = parseNumberOrDefault(getDirectChildText(child, 'voice'), 1);
          const durationTicks = toTicks(duration, divisions);

          let pitchObj = { step: 'C', octave: 4, alter: 0 };
          let midiNumber = 0;

          if (!isRest) {
            const pitchEl = getDirectChildByTag(child, 'pitch');
            if (pitchEl) {
              const step = getDirectChildText(pitchEl, 'step') || 'C';
              const octave = parseNumberOrDefault(getDirectChildText(pitchEl, 'octave'), 4);
              const alter = parseNumberOrDefault(getDirectChildText(pitchEl, 'alter'), 0);
              pitchObj = { step, octave, alter };
              midiNumber = toMidiNumber(step, octave, alter);
            }
          }

          let startTick: number;
          if (isChord) {
            startTick = lastStartTick;
          } else {
            startTick = measureStartTick + cursor;
            cursor += durationTicks;
            lastStartTick = startTick;
          }

          const noteIndex = noteIndexCounter;
          noteIndexCounter++;
          const noteId = `${partId}-M${measureNumber}-N${noteIndex}`;

          // TASK-048: staff/handの決定。
          const staffNumber = parseNumberOrDefault(getDirectChildText(child, 'staff'), 1);
          const hand: Hand =
            staves >= 2
              ? staffNumber === 1
                ? 'right'
                : 'left'
              : (partsById.get(partId)?.hand ?? 'right');

          measure.notes.push({
            id: noteId,
            partId,
            measureNumber,
            noteIndex,
            pitch: pitchObj,
            midiNumber,
            duration: durationTicks / TICKS_PER_QUARTER,
            startTick,
            durationTicks,
            startSeconds: 0, // 後段でtempoMap確定後に埋める
            durationSeconds: 0,
            voice,
            isChord,
            isRest,
            staff: staffNumber,
            hand,
          });
        } else if (tag === 'backup') {
          const duration = parseNumberOrDefault(getDirectChildText(child, 'duration'), 0);
          cursor -= toTicks(duration, divisions);
        } else if (tag === 'forward') {
          const duration = parseNumberOrDefault(getDirectChildText(child, 'duration'), 0);
          cursor += toTicks(duration, divisions);
        }
      }
    }

    // TASK-069: このパートでstopが現れないまま曲末尾に達した開区間は、
    // 全パート走査完了後にfinalTickで閉じるため一旦退避する。
    if (openPedalStart !== null) {
      openPedalStartsAtEnd.push(openPedalStart);
    }
  }

  // TASK-069: stopなしで曲末尾に達した開区間を、全ノートの
  // startTick+durationTicksの最大値（finalTick）で閉じてから、
  // 複数パート分のペダル区間をマージする。
  if (openPedalStartsAtEnd.length > 0) {
    let finalTick = 0;
    for (const measure of measuresMap.values()) {
      for (const note of measure.notes) {
        finalTick = Math.max(finalTick, note.startTick + note.durationTicks);
      }
    }
    for (const start of openPedalStartsAtEnd) {
      rawPedalSpans.push({ startTick: start, endTick: finalTick });
    }
  }
  const pedalSpans = mergePedalSpans(rawPedalSpans);

  // tempoMapを確定する（曲頭tick=0の要素を最低1つ保証する）。
  const tempoMap: TempoEvent[] = Array.from(tempoEventsMap.entries())
    .map(([tick, bpm]) => ({ tick, bpm }))
    .sort((a, b) => a.tick - b.tick);

  if (tempoMap.length === 0 || tempoMap[0].tick !== 0) {
    tempoMap.unshift({ tick: 0, bpm: DEFAULT_TEMPO });
  }

  const tempo = tempoMap[0].bpm;

  // Measure.notes を startTick 昇順（同tickは partId → noteIndex 順）でソートし、
  // tempoMap確定後にstartSeconds/durationSecondsを付与する。
  for (const measure of measuresMap.values()) {
    measure.notes.sort((a, b) => {
      if (a.startTick !== b.startTick) return a.startTick - b.startTick;
      if (a.partId !== b.partId) return a.partId < b.partId ? -1 : 1;
      return a.noteIndex - b.noteIndex;
    });

    for (const note of measure.notes) {
      note.startSeconds = tickToSeconds(note.startTick, tempoMap);
      note.durationSeconds =
        tickToSeconds(note.startTick + note.durationTicks, tempoMap) - note.startSeconds;
    }
  }

  const measures: Measure[] = Array.from(measuresMap.values())
    .sort((a, b) => a.number - b.number)
    .map((m) => ({ number: m.number, startTick: m.startTick, notes: m.notes }));

  return {
    title,
    parts,
    measures,
    tempo,
    ticksPerQuarter: TICKS_PER_QUARTER,
    tempoMap,
    timeSignature: { beats, beatType },
    keySignature,
    pedalSpans,
  };
}

export function extractXmlFromMxl(buffer: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(buffer));

  // 入力堅牢化（TASK-091）: zip爆弾対策。展開後のエントリ数と合計サイズを検査し、
  // 高圧縮率の細工.mxlによる後続処理（TextDecode・XMLパース）のメモリ枯渇を防ぐ。
  const entryNames = Object.keys(files);
  if (entryNames.length > MAX_ZIP_ENTRIES) {
    throw new MusicXMLParseError(
      `MXL archive contains too many entries (limit: ${MAX_ZIP_ENTRIES})`
    );
  }
  let totalBytes = 0;
  for (const name of entryNames) {
    totalBytes += files[name].byteLength;
    if (totalBytes > MAX_UNZIPPED_BYTES) {
      throw new MusicXMLParseError(
        `MXL archive uncompressed size exceeds the limit (${MAX_UNZIPPED_BYTES} bytes)`
      );
    }
  }

  // Find the root file from META-INF/container.xml
  let rootFilePath = '';
  const containerXml = files['META-INF/container.xml'];
  if (containerXml) {
    const containerText = new TextDecoder().decode(containerXml);
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsedContainer = parser.parse(containerText);
    const rootfiles = parsedContainer['container']?.['rootfiles']?.['rootfile'];

    if (rootfiles) {
      const rootfileArray = Array.isArray(rootfiles) ? rootfiles : [rootfiles];
      for (const rootfile of rootfileArray) {
        if (rootfile['@_media-type'] === 'application/vnd.recordare.musicxml+xml') {
          rootFilePath = rootfile['@_full-path'];
          break;
        }
      }
    }
  }

  // Fallback: Just try to find a .xml file
  if (!rootFilePath) {
    for (const path in files) {
      if (path.endsWith('.xml') && !path.startsWith('META-INF/')) {
        rootFilePath = path;
        break;
      }
    }
  }

  if (!rootFilePath || !files[rootFilePath]) {
    throw new MusicXMLParseError('Invalid MXL format: Could not find root MusicXML file');
  }

  return new TextDecoder().decode(files[rootFilePath]);
}

export function parseMxl(buffer: ArrayBuffer): Score {
  const xmlText = extractXmlFromMxl(buffer);
  return parse(xmlText);
}
