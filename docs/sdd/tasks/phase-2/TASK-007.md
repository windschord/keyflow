# TASK-007: App Settings実装（electron-store + ファイル履歴）

**ステータス**: DONE
**推定工数**: 20分
**依存**: TASK-004

---

## 説明

アプリ設定（UI設定・MIDIデバイス選択・手の大きさ設定・最近のファイル履歴）を
`electron-store` を使ってMain Processで永続化する。

## 対象ファイル

- `src/main/settings.ts` — SettingsService（Main Process）
- `src/preload/index.ts` に設定API追加（TASK-009と統合）

## 依存ライブラリ

```bash
npm install electron-store
```

## 参照設計

- [design/database/schema.md「アプリ設定」セクション](../../design/database/schema.md)

## 実装すべきインターフェース

```typescript
// src/main/settings.ts
import Store from 'electron-store';

interface AppSettings {
  recentFiles: Array<{ path: string; openedAt: string }>;
  midi: { selectedDeviceId: string | null; selectedDeviceIndex: number };
  handSettings: { maxSpanSemitones: number; leftHandScaleFactor: number };
  ui: { theme: 'light' | 'dark'; zoom: number; pianoHeight: number; language: string };
  practice: { defaultErrorMode: 'wait' | 'pass'; metronomeEnabled: boolean };
}

const DEFAULT_SETTINGS: AppSettings = {
  recentFiles: [],
  midi: { selectedDeviceId: null, selectedDeviceIndex: 0 },
  handSettings: { maxSpanSemitones: 14, leftHandScaleFactor: 1.0 },
  ui: { theme: 'light', zoom: 1.0, pianoHeight: 120, language: 'ja' },
  practice: { defaultErrorMode: 'wait', metronomeEnabled: false },
};

export class SettingsService {
  private store: Store<AppSettings>;
  get<K extends keyof AppSettings>(key: K): AppSettings[K];
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void;
  addRecentFile(path: string): void;  // 最大10件、古いものを削除
  getRecentFiles(): AppSettings['recentFiles'];
}
```

## 受入基準

- [ ] `SettingsService` が正しいデフォルト値で初期化される
- [ ] `get`/`set` が正常動作する
- [ ] `addRecentFile` が10件を超えたら最古のものを削除する
- [ ] アプリ再起動後も設定が保持される（electron-storeがファイルに保存）

**依存関係**: TASK-004
