import { XMLParser } from 'fast-xml-parser';
import { unzipSync } from 'fflate';
import { Score, Part, Measure, Note, TempoEvent, Hand } from '../../types';
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

export function parse(xmlContent: string): Score {
  if (!xmlContent || xmlContent.trim().length === 0) {
    throw new MusicXMLParseError('Empty XML content');
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
          const scale = TICKS_PER_QUARTER / divisions;
          if (!isChordNote) {
            cursor += duration * scale;
            if (cursor > maxCursor) maxCursor = cursor;
          }
        } else if (child.tagName === 'backup') {
          const duration = parseNumberOrDefault(getDirectChildText(child, 'duration'), 0);
          const scale = TICKS_PER_QUARTER / divisions;
          cursor -= duration * scale;
        } else if (child.tagName === 'forward') {
          const duration = parseNumberOrDefault(getDirectChildText(child, 'duration'), 0);
          const scale = TICKS_PER_QUARTER / divisions;
          cursor += duration * scale;
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
        } else if (tag === 'note') {
          const isRest = getDirectChildByTag(child, 'rest') !== null;
          const isChord = getDirectChildByTag(child, 'chord') !== null;
          const duration = parseNumberOrDefault(getDirectChildText(child, 'duration'), 0);
          const voice = parseNumberOrDefault(getDirectChildText(child, 'voice'), 1);
          const scale = TICKS_PER_QUARTER / divisions;
          const durationTicks = duration * scale;

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
          const scale = TICKS_PER_QUARTER / divisions;
          cursor -= duration * scale;
        } else if (tag === 'forward') {
          const duration = parseNumberOrDefault(getDirectChildText(child, 'duration'), 0);
          const scale = TICKS_PER_QUARTER / divisions;
          cursor += duration * scale;
        }
      }
    }
  }

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
  };
}

export function extractXmlFromMxl(buffer: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(buffer));

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
