import { XMLParser } from 'fast-xml-parser';
import { unzipSync } from 'fflate';
import { Score, Part, Measure, Note } from '../../types';
import { toMidiNumber } from './midi-utils';
import { detectHand } from './hand-detector';

export class MusicXMLParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MusicXMLParseError';
  }
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
      if (['score-partwise.part-list.score-part', 'score-partwise.part', 'measure', 'note'].includes(jpathStr)) {
        return true;
      }
      return false;
    },
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xmlContent) as Record<string, unknown>;
  } catch (err: unknown) {
    throw new MusicXMLParseError('Invalid XML format: ' + (err instanceof Error ? err.message : String(err)));
  }

  if (!parsed || !parsed['score-partwise']) {
    throw new MusicXMLParseError('Invalid MusicXML: Missing <score-partwise> root element');
  }

  const scorePartwise = parsed['score-partwise'] as Record<string, unknown> | undefined;

  const title = (scorePartwise?.['work'] as Record<string, unknown>)?.['work-title'] as string | undefined || (scorePartwise?.['movement-title'] as string | undefined) || 'Untitled';

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
    const partName = sp['part-name'] as string | undefined;

    // Find the corresponding part data to look for a clef
    const partData = (rawParts as Record<string, unknown>[]).find((p: Record<string, unknown>) => p['@_id'] === partId);
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
          const clef = Array.isArray(attributes['clef']) ? attributes['clef'][0] : attributes['clef'];
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

  const measuresMap = new Map<number, Measure>();

  let tempo = 120;
  let beats = 4;
  let beatType = 4;
  let keySignature = 0;

  (rawParts as Record<string, unknown>[]).forEach((part: Record<string, unknown>) => {
    const partId = part['@_id'] as string;
    let partMeasures = part['measure'] || [];
    if (!Array.isArray(partMeasures)) partMeasures = [partMeasures];

    (partMeasures as unknown[]).forEach((measure: unknown) => {
      const m = measure as Record<string, unknown>;
      const measureNumber = parseInt((m['@_number'] as string | undefined) || '0', 10);

      if (!measuresMap.has(measureNumber)) {
        measuresMap.set(measureNumber, {
          number: measureNumber,
          notes: [],
        });
      }

      const currentMeasure = measuresMap.get(measureNumber)!;

      // Parse attributes for tempo, time, key
      if (m['attributes']) {
        const attrs = m['attributes'] as Record<string, unknown>;
        if (attrs['time']) {
          const time = attrs['time'] as Record<string, unknown>;
          beats = parseInt((time['beats'] as string | undefined) || '4', 10);
          beatType = parseInt((time['beat-type'] as string | undefined) || '4', 10);
        }
        if (attrs['key'] && (attrs['key'] as Record<string, unknown>)['fifths']) {
          keySignature = parseInt((attrs['key'] as Record<string, unknown>)['fifths'] as string, 10);
        }
      }

      if (m['direction']) {
        const dirs = Array.isArray(m['direction']) ? m['direction'] : [m['direction']];
        for (const dir of dirs) {
          const d = dir as Record<string, unknown>;
          if (d['sound'] && (d['sound'] as Record<string, unknown>)['@_tempo']) {
            tempo = parseInt((d['sound'] as Record<string, unknown>)['@_tempo'] as string, 10);
          }
        }
      }

      let notes = m['note'] || [];
      if (!Array.isArray(notes)) notes = [notes];
      (notes as unknown[]).forEach((note: unknown, _noteIndex: number) => {
        const n = note as Record<string, unknown>;
        const isRest = 'rest' in n;
        const isChord = 'chord' in n;
        const duration = n['duration'] ? parseInt(n['duration'] as string, 10) : 0;

        let pitchObj = { step: 'C', octave: 4, alter: 0 };
        let midiNumber = 0;

        if (!isRest && n['pitch']) {
          const pitch = n['pitch'] as Record<string, unknown>;
          pitchObj = {
            step: (pitch['step'] as string | undefined) || 'C',
            octave: parseInt((pitch['octave'] as string | undefined) || '4', 10),
            alter: pitch['alter'] ? parseInt(pitch['alter'] as string, 10) : 0,
          };
          midiNumber = toMidiNumber(pitchObj.step, pitchObj.octave, pitchObj.alter);
        }

        const noteId = `${partId}-M${measureNumber}-N${currentMeasure.notes.length}`;

        currentMeasure.notes.push({
          id: noteId,
          partId,
          measureNumber,
          noteIndex: currentMeasure.notes.length,
          pitch: pitchObj,
          midiNumber,
          duration,
          isChord,
          isRest,
        });
      });
    });
  });

  const measures = Array.from(measuresMap.values()).sort((a, b) => a.number - b.number);

  return {
    title,
    parts,
    measures,
    tempo,
    timeSignature: { beats, beatType },
    keySignature,
  };
}

export function parseMxl(buffer: ArrayBuffer): Score {
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

  const xmlText = new TextDecoder().decode(files[rootFilePath]);
  return parse(xmlText);
}
