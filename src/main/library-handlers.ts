import type { LibraryEntry, LibraryService } from './library';
import type { PathAllowlist } from './path-allowlist';
import type { SettingsService } from './settings';

/**
 * `library:get-all` IPCハンドラのファクトリ（TASK-101）。
 */
export function createLibraryGetAllHandler(
  libraryService: LibraryService
): () => Promise<LibraryEntry[]> {
  return async (): Promise<LibraryEntry[]> => libraryService.getAll();
}

/**
 * `library:upsert` IPCハンドラのファクトリ（TASK-101）。
 * タイトル・作曲者の抽出はRenderer側のパース結果を利用し、Mainでは再パースしない（DEC-010）。
 *
 * パフォーマンス最適化: libraryService.upsert は electron-store の同期ファイル書込み
 * (fs.writeFileSync) を内部で呼び出し、主プロセスのイベントループをブロックする。
 * 大量エントリや遅いディスク (OneDrive/アンチウイルススキャン等) では 7〜8 秒程度
 * ブロックし、その間にキューイングされた他の IPC リクエスト (file:read-if-exists 等)
 * も遅延する。これを防ぐため、upsert 本体を setImmediate で次の tick へ遅延させ、
 * IPCハンドラは即座に return する。書込み失敗はログ出力のみで握りつぶす
 * (ライブラリ登録は補助機能であり、楽譜オープン自体に影響させないため)。
 */
export function createLibraryUpsertHandler(
  libraryService: LibraryService
): (event: unknown, input: { path: string; title: string; composer: string }) => Promise<void> {
  return async (
    _event: unknown,
    input: { path: string; title: string; composer: string }
  ): Promise<void> => {
    // セキュリティレビュー対応（M-2）: IPCは任意JSONを送れるため、静的型では防げず
    // 実行時の検証が必要になる。path/title/composerが文字列でなく、pathが非空でない
    // 入力は永続化ストア汚染を避けるため無視する（読み込み側 normalizeEntry と同方針）。
    if (
      typeof input !== 'object' ||
      input === null ||
      typeof input.path !== 'string' ||
      input.path.length === 0 ||
      typeof input.title !== 'string' ||
      typeof input.composer !== 'string'
    ) {
      return;
    }
    // パフォーマンス最適化: electron-store の同期ファイル書込みを setImmediate で遅延させ、
    // 遅いディスクでも IPC ハンドラが即座に return するようにする。
    setImmediate(() => {
      try {
        libraryService.upsert({ path: input.path, title: input.title, composer: input.composer });
      } catch (err) {
        console.error('[main] library.upsert (deferred) failed:', err);
      }
    });
  };
}

/**
 * `library:remove` IPCハンドラのファクトリ（TASK-101）。
 *
 * ライブラリエントリの削除に加え、楽譜ファイルから派生する sidecar
 * （.annotation.json / .scoremap.cache.json）も削除する。
 * 削除済み・存在しない sidecar の unlink エラーは無視する。
 */
export interface SidecarDeleter {
  unlink(path: string): Promise<void>;
}

const SIDECAR_SUFFIXES_FOR_REMOVE = ['.annotation.json', '.scoremap.cache.json'];

export function createLibraryRemoveHandler(
  libraryService: LibraryService,
  fsModule: SidecarDeleter
): (event: unknown, path: string) => Promise<void> {
  return async (_event: unknown, path: string): Promise<void> => {
    // M-2: pathが非空文字列でない場合は何もしない（不正入力による予期しない削除を防ぐ）。
    if (typeof path !== 'string' || path.length === 0) {
      return;
    }
    libraryService.remove(path);
    for (const suffix of SIDECAR_SUFFIXES_FOR_REMOVE) {
      try {
        await fsModule.unlink(path + suffix);
      } catch {
        // ファイルが存在しない場合は正常（初回インポート未完了等）なので無視
      }
    }
  };
}

const ACCEPTED_LIBRARY_EXTENSIONS = ['.xml', '.musicxml', '.mxl'];

function hasAcceptedLibraryExtension(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return ACCEPTED_LIBRARY_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * ipcMain.handle に渡す fs.promises 依存の最小インターフェース。
 * テストでは実ファイルシステムに触れず access のみ差し替えられるようにする。
 */
export interface FileAccessChecker {
  access(path: string): Promise<void>;
}

export type LibraryOpenResult =
  { ok: true } | { ok: false; reason: 'not-found' | 'invalid-extension' };

/**
 * `library:open` IPCハンドラのファクトリ（TASK-101）。
 *
 * `file:register-dropped-file` と同様の拡張子検証（.xml/.musicxml/.mxl、
 * 大文字小文字を区別しない）に加え、ファイル存在確認を行う。両方を満たした場合のみ
 * PathAllowlist.allowMusicXml へ登録し SettingsService.addRecentFile を呼び出す
 * （REQ-017-007/008）。呼び出し元では例外を投げず構造化された失敗理由を返す。
 * ENOENT以外のfsエラー（権限不足等）も同様にnot-foundとして扱う（開けない事実は同じであり、
 * 呼び出し元にとって扱いを分ける必要がないため）。
 *
 * セキュリティレビュー対応（M-1）: `library:open` は「ライブラリに登録済みの楽譜を開く」
 * 経路である。App.tsxはライブラリ一覧に表示中のエントリのみに対してこれを呼ぶ。
 * 渡された path がライブラリに登録済みでない場合は allowlist へ載せずに not-found を返す。
 * これにより、拡張子一致と存在確認だけで任意パスを read allowlist へ広げられる状態を防ぐ
 * （TASK-086が意図した「ユーザーがダイアログ/D&Dで開いた本体のみ」の緩和を避ける）。
 *
 * パフォーマンス最適化: SettingsService.addRecentFile は electron-store の同期ファイル
 * 書込み (fs.writeFileSync) を内部で呼び出し、主プロセスのイベントループをブロックする。
 * これを防ぐため、addRecentFile 本体を setImmediate で次の tick へ遅延させ、
 * IPCハンドラは検証とパス許可登録だけ済ませて即座に return する。
 */
export function createLibraryOpenHandler(
  pathAllowlist: PathAllowlist,
  settingsService: SettingsService,
  fsModule: FileAccessChecker,
  libraryService: Pick<LibraryService, 'getAll'>
): (event: unknown, path: string) => Promise<LibraryOpenResult> {
  return async (_event: unknown, path: string): Promise<LibraryOpenResult> => {
    if (!hasAcceptedLibraryExtension(path)) {
      return { ok: false, reason: 'invalid-extension' };
    }

    // M-1: ライブラリに登録済みのエントリのみ開けるようにする。未登録のパスは
    // （ディスク上に存在しても）read allowlist へ載せない。
    const isRegistered = libraryService.getAll().some((entry) => entry.path === path);
    if (!isRegistered) {
      return { ok: false, reason: 'not-found' };
    }

    try {
      await fsModule.access(path);
    } catch {
      return { ok: false, reason: 'not-found' };
    }

    pathAllowlist.allowMusicXml(path);
    // recentFiles の永続化は遅延実行し、IPCハンドラは即座に return する。
    setImmediate(() => {
      try {
        settingsService.addRecentFile(path);
      } catch (err) {
        console.error('[main] settingsService.addRecentFile (deferred) failed:', err);
      }
    });
    return { ok: true };
  };
}
