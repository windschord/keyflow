import Store from 'electron-store';

export interface AppSettings {
  recentFiles: Array<{ path: string; openedAt: string }>;
  midi: { selectedDeviceId: string | null; selectedDeviceIndex: number };
  handSettings: { maxSpanSemitones: number; leftHandScaleFactor: number };
  ui: { theme: 'light' | 'dark'; zoom: number; pianoHeight: number; language: string };
  practice: { defaultErrorMode: 'wait' | 'pass'; metronomeEnabled: boolean };
}

export const DEFAULT_SETTINGS: AppSettings = {
  recentFiles: [],
  midi: { selectedDeviceId: null, selectedDeviceIndex: 0 },
  handSettings: { maxSpanSemitones: 14, leftHandScaleFactor: 1.0 },
  ui: { theme: 'light', zoom: 1.0, pianoHeight: 120, language: 'ja' },
  practice: { defaultErrorMode: 'wait', metronomeEnabled: false },
};

const SETTINGS_SCHEMA: Store.Schema<AppSettings> = {
  recentFiles: {
    type: 'array',
    default: DEFAULT_SETTINGS.recentFiles,
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['path', 'openedAt'],
      properties: {
        path: { type: 'string' },
        openedAt: { type: 'string' },
      },
    },
  },
  midi: {
    type: 'object',
    default: DEFAULT_SETTINGS.midi,
    additionalProperties: false,
    required: ['selectedDeviceId', 'selectedDeviceIndex'],
    properties: {
      selectedDeviceId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      selectedDeviceIndex: { type: 'integer', minimum: 0 },
    },
  },
  handSettings: {
    type: 'object',
    default: DEFAULT_SETTINGS.handSettings,
    additionalProperties: false,
    required: ['maxSpanSemitones', 'leftHandScaleFactor'],
    properties: {
      maxSpanSemitones: { type: 'number', minimum: 1 },
      leftHandScaleFactor: { type: 'number', minimum: 0 },
    },
  },
  ui: {
    type: 'object',
    default: DEFAULT_SETTINGS.ui,
    additionalProperties: false,
    required: ['theme', 'zoom', 'pianoHeight', 'language'],
    properties: {
      theme: { enum: ['light', 'dark'] },
      zoom: { type: 'number', minimum: 0.1 },
      pianoHeight: { type: 'number', minimum: 1 },
      language: { type: 'string' },
    },
  },
  practice: {
    type: 'object',
    default: DEFAULT_SETTINGS.practice,
    additionalProperties: false,
    required: ['defaultErrorMode', 'metronomeEnabled'],
    properties: {
      defaultErrorMode: { enum: ['wait', 'pass'] },
      metronomeEnabled: { type: 'boolean' },
    },
  },
};

export function isSettingsKey(key: unknown): key is keyof AppSettings {
  return (
    key === 'recentFiles' ||
    key === 'midi' ||
    key === 'handSettings' ||
    key === 'ui' ||
    key === 'practice'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeRecentFiles(value: unknown): AppSettings['recentFiles'] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.recentFiles;

  return value
    .filter((file): file is AppSettings['recentFiles'][number] => {
      return (
        isRecord(file) &&
        typeof file.path === 'string' &&
        typeof file.openedAt === 'string' &&
        !Number.isNaN(Date.parse(file.openedAt))
      );
    })
    .slice(0, 10);
}

function normalizeMidi(value: unknown): AppSettings['midi'] {
  if (!isRecord(value)) return DEFAULT_SETTINGS.midi;
  const { selectedDeviceId, selectedDeviceIndex } = value;
  if (
    (typeof selectedDeviceId === 'string' || selectedDeviceId === null) &&
    typeof selectedDeviceIndex === 'number' &&
    Number.isInteger(selectedDeviceIndex) &&
    selectedDeviceIndex >= 0
  ) {
    return { selectedDeviceId, selectedDeviceIndex };
  }
  return DEFAULT_SETTINGS.midi;
}

function normalizeHandSettings(value: unknown): AppSettings['handSettings'] {
  if (!isRecord(value)) return DEFAULT_SETTINGS.handSettings;
  const { maxSpanSemitones, leftHandScaleFactor } = value;
  if (
    isFiniteNumber(maxSpanSemitones) &&
    maxSpanSemitones > 0 &&
    isFiniteNumber(leftHandScaleFactor) &&
    leftHandScaleFactor >= 0
  ) {
    return { maxSpanSemitones, leftHandScaleFactor };
  }
  return DEFAULT_SETTINGS.handSettings;
}

function normalizeUi(value: unknown): AppSettings['ui'] {
  if (!isRecord(value)) return DEFAULT_SETTINGS.ui;
  const { theme, zoom, pianoHeight, language } = value;
  if (
    (theme === 'light' || theme === 'dark') &&
    isFiniteNumber(zoom) &&
    zoom > 0 &&
    isFiniteNumber(pianoHeight) &&
    pianoHeight > 0 &&
    typeof language === 'string'
  ) {
    return { theme, zoom, pianoHeight, language };
  }
  return DEFAULT_SETTINGS.ui;
}

function normalizePractice(value: unknown): AppSettings['practice'] {
  if (!isRecord(value)) return DEFAULT_SETTINGS.practice;
  const { defaultErrorMode, metronomeEnabled } = value;
  if (
    (defaultErrorMode === 'wait' || defaultErrorMode === 'pass') &&
    typeof metronomeEnabled === 'boolean'
  ) {
    return { defaultErrorMode, metronomeEnabled };
  }
  return DEFAULT_SETTINGS.practice;
}

export function normalizeSettings(value: unknown): AppSettings {
  const source = isRecord(value) ? value : {};
  return {
    recentFiles: normalizeRecentFiles(source.recentFiles),
    midi: normalizeMidi(source.midi),
    handSettings: normalizeHandSettings(source.handSettings),
    ui: normalizeUi(source.ui),
    practice: normalizePractice(source.practice),
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj).sort();
    const bKeys = Object.keys(bObj).sort();

    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i++) {
      if (aKeys[i] !== bKeys[i]) return false;
      if (!deepEqual(aObj[aKeys[i]], bObj[bKeys[i]])) return false;
    }
    return true;
  }

  return false;
}

export function validateSettingsValue<K extends keyof AppSettings>(
  key: K,
  value: unknown
): AppSettings[K] {
  const normalized = normalizeSettings({ ...DEFAULT_SETTINGS, [key]: value })[key];
  if (!deepEqual(normalized, value)) {
    throw new Error(`Invalid settings value for ${key}`);
  }
  return normalized;
}

export class SettingsService {
  private store: Store<AppSettings>;

  constructor() {
    this.store = new Store<AppSettings>({
      defaults: DEFAULT_SETTINGS,
      schema: SETTINGS_SCHEMA,
      clearInvalidConfig: true,
    });
    this.normalizePersistedSettings();
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.store.get(key);
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.set(key, value);
  }

  addRecentFile(path: string): void {
    const recentFiles = [...normalizeRecentFiles(this.get('recentFiles'))];
    const existingIndex = recentFiles.findIndex((f) => f.path === path);

    // Remove if it already exists to move it to the top
    if (existingIndex !== -1) {
      recentFiles.splice(existingIndex, 1);
    }

    // Add to the top
    recentFiles.unshift({ path, openedAt: new Date().toISOString() });

    // Keep only the 10 most recent
    if (recentFiles.length > 10) {
      recentFiles.pop();
    }

    this.set('recentFiles', recentFiles);
  }

  getRecentFiles(): AppSettings['recentFiles'] {
    return normalizeRecentFiles(this.get('recentFiles'));
  }

  private normalizePersistedSettings(): void {
    const normalized = normalizeSettings({
      recentFiles: this.store.get('recentFiles'),
      midi: this.store.get('midi'),
      handSettings: this.store.get('handSettings'),
      ui: this.store.get('ui'),
      practice: this.store.get('practice'),
    });

    for (const key of Object.keys(normalized) as Array<keyof AppSettings>) {
      this.store.set(key, normalized[key]);
    }
  }
}
