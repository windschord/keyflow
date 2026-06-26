export const IpcChannels = {
  FILE_SHOW_OPEN_DIALOG: 'file:show-open-dialog',
  FILE_READ: 'file:read',
  FILE_READ_BINARY: 'file:read-binary',
  MIDI_GET_DEVICES: 'midi:get-devices',
  MIDI_SELECT_DEVICE: 'midi:select-device',
  MIDI_NOTE_ON: 'midi:note-on',
  MIDI_NOTE_OFF: 'midi:note-off',
  MIDI_DEVICES_CHANGED: 'midi:devices-changed',
  PING: 'ping',
} as const;
