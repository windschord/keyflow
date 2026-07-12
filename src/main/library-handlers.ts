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
 */
export function createLibraryUpsertHandler(
  libraryService: LibraryService
): (event: unknown, input: { path: string; title: string; composer: string }) => Promise<void> {
  return async (
    _event: unknown,
    input: { path: string; title: string; composer: string }
  ): Promise<void> => {
    libraryService.upsert(input);
  };
}

/**
 * `library:remove` IPCハンドラのファクトリ（TASK-101）。
 */
export function createLibraryRemoveHandler(
  libraryService: LibraryService
): (event: unknown, path: string) => Promise<void> {
  return async (_event: unknown, path: string): Promise<void> => {
    libraryService.remove(path);
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
  | { ok: true }
  | { ok: false; reason: 'not-found' | 'invalid-extension' };

/**
 * `library:open` IPCハンドラのファクトリ（TASK-101）。
 *
 * `file:register-dropped-file` と同様の拡張子検証（.xml/.musicxml/.mxl、
 * 大文字小文字を区別しない）に加え、ファイル存在確認を行う。両方を満たした場合のみ
 * PathAllowlist.allowMusicXml へ登録し SettingsService.addRecentFile を呼び出す
 * （REQ-017-007/008）。呼び出し元では例外を投げず構造化された失敗理由を返す。
 * ENOENT以外のfsエラー（権限不足等）も同様にnot-foundとして扱う（開けない事実は同じであり、
 * 呼び出し元にとって扱いを分ける必要がないため）。
 */
export function createLibraryOpenHandler(
  pathAllowlist: PathAllowlist,
  settingsService: SettingsService,
  fsModule: FileAccessChecker
): (event: unknown, path: string) => Promise<LibraryOpenResult> {
  return async (_event: unknown, path: string): Promise<LibraryOpenResult> => {
    if (!hasAcceptedLibraryExtension(path)) {
      return { ok: false, reason: 'invalid-extension' };
    }

    try {
      await fsModule.access(path);
    } catch {
      return { ok: false, reason: 'not-found' };
    }

    pathAllowlist.allowMusicXml(path);
    settingsService.addRecentFile(path);
    return { ok: true };
  };
}
