export const IPC_CHANNELS = {
  PING: 'ping',
  FILE_SHOW_OPEN_DIALOG: 'file:show-open-dialog',
  FILE_READ: 'file:read',
  FILE_READ_BINARY: 'file:read-binary',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  MIDI_GET_DEVICES: 'midi:get-devices',
  MIDI_SELECT_DEVICE: 'midi:select-device',
  MIDI_DEVICES_CHANGED: 'midi:devices-changed',
} as const;
