# Score Library（楽譜ライブラリ） コンポーネント設計

## 概要

取り込んだ楽譜の一覧管理画面（US-017、REQ-017-001〜011）。
永続化方式は [DEC-010](../decisions/DEC-010.md)（Main側の独立electron-store）に従う。

## 構成

```
src/main/
├── library.ts             # LibraryService（electron-store名 'library'、フェイルソフト検証）
└── library-handlers.ts    # library:* IPCハンドラのファクトリ（file-handlers.tsと同パターン）

src/preload/index.ts        # electronAPI.library.{getAll,upsert,remove,open} を追加公開

src/renderer/src/
├── components/LibraryView/
│   ├── index.tsx           # ライブラリ画面（一覧・検索・並べ替え・削除・空状態）
│   └── LibraryView.test.tsx
├── store/slices/ui-slice.ts # activeView: 'score' | 'library' と setActiveView を追加
└── lib/i18n/ja.ts, en.ts   # library名前空間の文言追加
```

## データモデル

```typescript
// main側（renderer側types/にも独立して同型を持つ既存パターン）
interface LibraryEntry {
  path: string;         // 一意キー（絶対パス）
  title: string;        // MusicXML由来。欠落時はファイル名
  composer: string;     // MusicXML由来。欠落時は空文字
  addedAt: string;      // ISO 8601
  lastOpenedAt: string; // ISO 8601
}
```

- ストア構造: `{ entries: LibraryEntry[] }`
- 読み込み時検証（フェイルソフト、TASK-092と同方針）: `path`非空文字列必須、
  `title`/`composer`は文字列でなければ空文字へ正規化、日時は文字列でなければ
  現在時刻へ正規化。`entries`非配列は空扱い

## IPCチャンネル

| チャンネル | 方向 | 用途 |
|-----------|------|------|
| `library:get-all` | Renderer→Main | 全エントリの取得 |
| `library:upsert` | Renderer→Main | `{path, title, composer}` の登録。既存pathは`title`/`composer`/`lastOpenedAt`を更新、新規は`addedAt`も記録（REQ-017-001/002） |
| `library:remove` | Renderer→Main | pathで削除。ファイル本体・アノテーションは触らない（REQ-017-006） |
| `library:open` | Renderer→Main | ライブラリから開く前処理。拡張子検証・ファイル存在確認・`PathAllowlist.allowMusicXml`登録・recentFiles追加を行い、存在しなければ`{ok: false, reason: 'not-found'}`を返す（REQ-017-007/008） |

- `library:open` の検証は `file:register-dropped-file` と同等（拡張子 .xml/.musicxml/.mxl）。
  成功後のファイル読み込みは既存の `file:read` / `file:read-binary` を再利用する

## データフロー

### 自動登録（REQ-017-001/002）

```
App.tsx openFile成功（パース完了、Score取得）
  → electronAPI.library.upsert({ path, title: score.title || ファイル名, composer })
  → LibraryService.upsert（既存pathなら更新、新規なら追加）
```

- ダイアログ・D&D・ライブラリ経由のすべてが同じopenFile成功点を通るため、結線は1箇所

### ライブラリから開く（REQ-017-007/008）

```
LibraryView 行クリック
  → electronAPI.library.open(path)
      ok: true  → 既存のファイル読み込みフロー（file:read等→パース→表示）→ activeView='score'
      ok: false → エラートースト表示+「ライブラリから削除しますか」の確認→removeまたは維持
```

### 画面切り替え（REQ-017-010）

- `ui-slice.activeView: 'score' | 'library'`（初期値 `'library'`）
- App.tsx: `activeView === 'library'` でLibraryViewを表示。楽譜を開くと `'score'` へ遷移
- Headerに「ライブラリ」ボタンを追加していつでも戻れる（楽譜未読み込みでもクラッシュしない）
- 楽譜表示への復帰導線（REQ-017-012）: 楽譜を開いた状態では次の2つの導線を提供する
  - Headerのライブラリボタンをトグルとして機能させる。ライブラリ表示中はラベル・
    aria-labelを「楽譜へ戻る」系へ切り替える
  - LibraryView上部に「楽譜へ戻る」ボタンを表示する。propsは
    `onReturnToScore?: () => void`（オプショナル）とし、未指定なら非表示
  - いずれも `setActiveView('score')` を呼ぶだけで、楽譜の再読み込みは発生しない

## UI仕様

- 一覧: タイトル・作曲者・最終利用日時（ロケール表示）。行クリックで開く
- 検索欄: タイトル・作曲者の部分一致（小文字化して比較、REQ-017-004）
- 並べ替え: タイトル/登録日時/最終利用日時 × 昇降順（REQ-017-005）。既定は最終利用日時の降順
- 削除: 行の削除ボタン→確認（`window.confirm`ではなくアプリ内確認UI。既存の確認パターンに
  合わせる）→ `library:remove`
- 欠損表示: `library:open`失敗時に該当行へ欠損マークを付与する。また一覧取得時に
  存在確認はしない（同期I/Oの大量発生を避ける。欠損は開く操作時に検出する）
- 空状態: 案内文と「ファイルを開く」ボタン（既存のopenダイアログ導線を再利用）
- 文言はすべて `library` 名前空間でi18n対応（REQ-017-011）

## テスト戦略

- LibraryService: upsert（新規/更新）・remove・フェイルソフト検証のユニットテスト
  （`cwd`オプションで一時ディレクトリへ書き込むSettingsServiceと同パターン）
- library-handlers: ファクトリ関数の単体テスト（allowlist登録・recent追加・
  存在しないファイルで`not-found`が返る結線）
- LibraryView: 一覧表示・検索絞り込み・並べ替え・削除確認・空状態のコンポーネントテスト
  （IPCはモックし、結線はE2Eで担保）
- E2E: 楽譜を開く→ライブラリ画面に登録されている→ライブラリから開ける、の
  ユーザー観測可能な一連操作。削除の確認フローも1本

## セキュリティ考慮

- ライブラリのエントリはユーザー操作で登録されたパスのみである。ただしストアファイルは
  外部改変される可能性があるため、開く操作は必ず`library:open`（Main側の拡張子検証+
  allowlist登録）を経由する。Rendererから`file:read`を直接呼んでも、allowlist未登録の
  パスはTASK-086の検証で拒否される（多層防御の維持）

## 関連

- 要件: [US-017](../../requirements/stories/US-017.md)
- 決定: [DEC-010](../decisions/DEC-010.md)
