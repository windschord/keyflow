import * as Tone from 'tone';

/**
 * メトロノーム音色ID（US-013 / TASK-072）。
 *
 * - `click`（既定）: `Tone.Synth`（短いエンベロープ）。アクセントはC6/C5の音高差＋音量差で表現（現行踏襲）
 * - `woodblock`: `Tone.MembraneSynth`（短decay）。音高差＋音量差
 * - `beep`: `Tone.Synth`（矩形波）。音高差＋音量差
 * - `cowbell`: `Tone.MetalSynth`（短decay）。音量差＋ピッチ差
 */
export type MetronomeVoiceId = 'click' | 'woodblock' | 'beep' | 'cowbell';

export interface MetronomeVoiceDefinition {
  id: MetronomeVoiceId;
  label: string;
}

export const METRONOME_VOICES: Record<MetronomeVoiceId, MetronomeVoiceDefinition> = {
  click: { id: 'click', label: 'クリック' },
  woodblock: { id: 'woodblock', label: 'ウッドブロック' },
  beep: { id: 'beep', label: 'ビープ' },
  cowbell: { id: 'cowbell', label: 'カウベル' },
};

/**
 * メトロノーム音色の発音インターフェース（`Metronome`クラスから見た音色）。
 * `Metronome`は小節頭tick照合・拍カウンターでアクセント有無（`accent`）と
 * 音量（`velocity`）を決定し、音高の解決は本インターフェースの実装（音色ごと）に委譲する
 * （instrument-voices.md「メトロノーム音色」節）。
 */
export interface MetronomeVoiceInstance {
  /** アクセント有無に応じた音高を解決し、指定時刻・音量で発音する。 */
  trigger(time: number, accent: boolean, velocity: number): void;
  dispose(): void;
}

function createClickVoice(): MetronomeVoiceInstance {
  // TASK-072: 現行のTone.Synth既定エンベロープではリリースが伸びメトロノームの
  // 拍間隔（最速時）で音が重なり得るため、短いエンベロープを明示する。
  const synth = new Tone.Synth({
    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
  }).toDestination();

  return {
    trigger(time, accent, velocity) {
      synth.triggerAttackRelease(accent ? 'C6' : 'C5', '32n', time, velocity);
    },
    dispose() {
      synth.dispose();
    },
  };
}

function createWoodblockVoice(): MetronomeVoiceInstance {
  const synth = new Tone.MembraneSynth({
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
  }).toDestination();

  return {
    trigger(time, accent, velocity) {
      synth.triggerAttackRelease(accent ? 'C5' : 'G4', '32n', time, velocity);
    },
    dispose() {
      synth.dispose();
    },
  };
}

function createBeepVoice(): MetronomeVoiceInstance {
  const synth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
  }).toDestination();

  return {
    trigger(time, accent, velocity) {
      synth.triggerAttackRelease(accent ? 'A5' : 'A4', '32n', time, velocity);
    },
    dispose() {
      synth.dispose();
    },
  };
}

function createCowbellVoice(): MetronomeVoiceInstance {
  const synth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.1, release: 0.05 },
  }).toDestination();

  return {
    trigger(time, accent, velocity) {
      synth.triggerAttackRelease(accent ? 'A4' : 'F3', '32n', time, velocity);
    },
    dispose() {
      synth.dispose();
    },
  };
}

/** メトロノーム音色IDに対応する`MetronomeVoiceInstance`を生成する。 */
export function createMetronomeVoice(id: MetronomeVoiceId): MetronomeVoiceInstance {
  switch (id) {
    case 'click':
      return createClickVoice();
    case 'woodblock':
      return createWoodblockVoice();
    case 'beep':
      return createBeepVoice();
    case 'cowbell':
      return createCowbellVoice();
    default: {
      // 網羅性チェック: MetronomeVoiceIdに新しいIDが追加された場合にコンパイルエラーで検出する。
      const exhaustiveCheck: never = id;
      throw new Error(`Unknown metronome voice id: ${String(exhaustiveCheck)}`);
    }
  }
}
