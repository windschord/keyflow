import * as Tone from 'tone';

/**
 * 再生音色ID（US-013 / TASK-071）。
 *
 * - `grand-piano`（既定）: Salamander Grand Piano V3サンプル（`Tone.Sampler`、要ロード）
 * - `electric-piano` / `organ` / `synth`: `Tone.PolySynth`プリセット（即時利用可）
 */
export type PlaybackVoiceId = 'grand-piano' | 'electric-piano' | 'organ' | 'synth';

export interface PlaybackVoiceDefinition {
  id: PlaybackVoiceId;
  label: string;
  /** `grand-piano`のみサンプルダウンロードの完了を待つ必要がある。 */
  requiresLoading: boolean;
}

export const PLAYBACK_VOICES: Record<PlaybackVoiceId, PlaybackVoiceDefinition> = {
  'grand-piano': {
    id: 'grand-piano',
    label: 'グランドピアノ',
    requiresLoading: true,
  },
  'electric-piano': {
    id: 'electric-piano',
    label: 'エレクトリックピアノ',
    requiresLoading: false,
  },
  organ: {
    id: 'organ',
    label: 'オルガン',
    requiresLoading: false,
  },
  synth: {
    id: 'synth',
    label: 'シンセ',
    requiresLoading: false,
  },
};

export interface CreatePlaybackInstrumentOptions {
  /** Samplerのロード完了時に呼ばれる（grand-piano以外では無視される）。 */
  onload?: () => void;
  /** Samplerのロード失敗時に呼ばれる（grand-piano以外では無視される）。 */
  onerror?: (error: Error) => void;
}

/**
 * `Tone.Sampler` / `Tone.PolySynth` の共用型（`AudioEngineService` から見た再生音色）。
 * 両者は `triggerAttackRelease(notes, duration, time, velocity)` / `dispose()` /
 * `toDestination()` について互換のシグネチャを持つため（instrument-voices.md参照）、
 * `loadScore` / `playNote` の発音コードは音色に関わらず変更不要。
 */
export type PlaybackInstrument = Tone.Sampler | Tone.PolySynth;

// Salamanderサンプル（短3度間隔、A0〜C8、単一ベロシティレイヤー）のURLをビルド時に解決する。
// TASK-071: Internet Archiveの生アーカイブではなく、Tone.js公式が配布する変換済みmp3
// （https://tonejs.github.io/audio/salamander/）を開発時に取得し同梱している
// （取得元・クレジットはREADME参照）。
const salamanderSampleModules = import.meta.glob<string>('../../assets/samples/salamander/*.mp3', {
  query: '?url',
  import: 'default',
  eager: true,
});

/**
 * サンプルファイル名（`Ds1` / `Fs1` 等のTone.js配布ファイル名表記）を
 * `Tone.Frequency` が解釈できるシャープ表記（`D#1` / `F#1`）へ正規化する。
 * `A0` / `C1` のようにシャープを含まない名前はそのまま返す。
 */
function normalizeNoteName(rawName: string): string {
  return rawName.replace(/^([A-G])s(\d+)$/, '$1#$2');
}

function resolveSalamanderUrls(): Record<string, string> {
  const urls: Record<string, string> = {};

  Object.entries(salamanderSampleModules).forEach(([path, url]) => {
    const fileName = path.split('/').pop();
    if (!fileName) return;

    const rawName = fileName.replace(/\.mp3$/i, '');
    urls[normalizeNoteName(rawName)] = url;
  });

  return urls;
}

function createGrandPiano(options: CreatePlaybackInstrumentOptions): PlaybackInstrument {
  return new Tone.Sampler({
    urls: resolveSalamanderUrls(),
    onload: options.onload,
    onerror: options.onerror,
  });
}

function createElectricPiano(): PlaybackInstrument {
  // Tone.PolySynth<FMSynth>はtriggerAttackRelease/dispose/toDestinationの
  // シグネチャがPlaybackInstrumentのPolySynth側と構造的に一致する。
  // 変数へ代入する形にすればキャストなしで型チェックを通過するため、
  // 従来の`as unknown as PlaybackInstrument`という二重キャストは不要だった
  // （CodeRabbit PR#28指摘#7、プロジェクト規約の二重キャスト禁止に対応）。
  const instrument: PlaybackInstrument = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01,
    modulationIndex: 14,
    envelope: { attack: 0.001, decay: 2, sustain: 0.1, release: 0.5 },
    modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 },
  });
  return instrument;
}

function createOrgan(): PlaybackInstrument {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.02, decay: 0.1, sustain: 1, release: 0.4 },
  });
}

function createSynth(): PlaybackInstrument {
  // 現行相当（後方互換、TASK-071以前のハードコード実装と同一設定）。
  return new Tone.PolySynth(Tone.Synth);
}

/**
 * 再生音色IDに対応するTone.js楽器インスタンスを生成する。
 *
 * `grand-piano`は`Tone.Sampler`（Salamanderサンプル、要ロード）、それ以外は
 * `Tone.PolySynth`（即時利用可）を返す。`options.onload` / `options.onerror` は
 * `grand-piano`のロード状態追跡にのみ使用され、他の音色では無視される
 * （即時利用可のためロード待ちが不要）。
 */
export function createPlaybackInstrument(
  id: PlaybackVoiceId,
  options: CreatePlaybackInstrumentOptions = {}
): PlaybackInstrument {
  switch (id) {
    case 'grand-piano':
      return createGrandPiano(options);
    case 'electric-piano':
      return createElectricPiano();
    case 'organ':
      return createOrgan();
    case 'synth':
      return createSynth();
    default: {
      // 網羅性チェック: PlaybackVoiceIdに新しいIDが追加された場合にコンパイルエラーで検出する。
      const exhaustiveCheck: never = id;
      throw new Error(`Unknown playback voice id: ${String(exhaustiveCheck)}`);
    }
  }
}
