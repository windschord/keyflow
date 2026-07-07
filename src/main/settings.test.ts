import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SettingsService } from './settings';

// TASK-073: 音色設定（audio.playbackVoice / audio.metronomeVoice）の永続化。
// electron-storeは新規のトップレベルキー（今回のaudio）については、既存設定
// ファイルにキー自体が存在しない場合は`defaults`をそのまま返す。
// 内部実装はObject.assignによるトップレベルの浅いマージである。
// metronomeAccentEnabled（practice配下への追加キー）で起きた
// 「ネストオブジェクトは深くマージされない」問題とは別のケースにあたる。
// トップレベルキーの追加であれば追加の移行コードなしに後方互換を保てることを
// 確認する（本テストはその前提を明示的に固定する）。
describe('SettingsService audio settings (TASK-073)', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('returns the default audio settings (grand-piano / click) for a brand-new settings store', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-test-'));
    const service = new SettingsService({ cwd: tempDir });

    expect(service.get('audio')).toEqual({
      playbackVoice: 'grand-piano',
      metronomeVoice: 'click',
    });
  });

  it('merges in the default audio settings when an existing config file predates the audio key (backward compatibility, REQ-013-006)', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-test-'));
    // audioキー導入前に永続化された既存ユーザーの設定ファイルを模す。
    fs.writeFileSync(
      path.join(tempDir, 'config.json'),
      JSON.stringify({ recentFiles: [{ path: '/scores/example.musicxml', openedAt: 'x' }] })
    );

    const service = new SettingsService({ cwd: tempDir });

    expect(service.get('audio')).toEqual({
      playbackVoice: 'grand-piano',
      metronomeVoice: 'click',
    });
    // 既存キー（audioと無関係）が損なわれていないことも確認する。
    expect(service.get('recentFiles')).toEqual([
      { path: '/scores/example.musicxml', openedAt: 'x' },
    ]);
  });

  it('persists a changed audio setting and reads it back (settings:set/get経路)', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-test-'));
    const service = new SettingsService({ cwd: tempDir });

    service.set('audio', { playbackVoice: 'organ', metronomeVoice: 'cowbell' });

    expect(service.get('audio')).toEqual({ playbackVoice: 'organ', metronomeVoice: 'cowbell' });
  });
});
