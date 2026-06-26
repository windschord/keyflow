export interface HandSettings {
  color: string;
}

export interface AppSettings {
  midiInputId?: string;
  theme: 'light' | 'dark' | 'system';
  rightHand: HandSettings;
  leftHand: HandSettings;
}
