import { describe, expect, it } from 'vitest';
import { isAllowedPermission } from './permission-policy';

describe('isAllowedPermission', () => {
  it('MIDI入力に必要な midi のみ許可する', () => {
    expect(isAllowedPermission('midi')).toBe(true);
  });

  it('SysEx送信を伴う midiSysex は拒否する（Web MIDIは sysex:false で要求するため不要）', () => {
    expect(isAllowedPermission('midiSysex')).toBe(false);
  });

  it('その他の権限はすべて拒否する', () => {
    for (const permission of [
      'geolocation',
      'notifications',
      'media',
      'mediaKeySystem',
      'clipboard-read',
      'clipboard-sanitized-write',
      'openExternal',
      'fullscreen',
      'pointerLock',
      'display-capture',
      'unknown-future-permission',
    ]) {
      expect(isAllowedPermission(permission)).toBe(false);
    }
  });
});
