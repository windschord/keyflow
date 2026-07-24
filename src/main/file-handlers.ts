import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron';
import type { PathAllowlist } from './path-allowlist';
import type { SettingsService } from './settings';

/**
 * ipcMain.handle に渡す dialog 依存の最小インターフェース。
 * テストでは electron 全体をモックせず showOpenDialog のみ差し替えられるようにする。
 */
export interface DialogLike {
  showOpenDialog(
    options: OpenDialogOptions
  ): Promise<Pick<OpenDialogReturnValue, 'canceled' | 'filePaths'>>;
}

const OPEN_MUSICXML_DIALOG_OPTIONS: OpenDialogOptions = {
  properties: ['openFile'],
  filters: [{ name: 'MusicXML', extensions: ['xml', 'mxl', 'musicxml'] }],
};

/**
 * `file:show-open-dialog` IPCハンドラのファクトリ。
 *
 * ファイル選択が成功した場合、選択パスを PathAllowlist に許可登録するとともに
 * SettingsService.addRecentFile を呼び出し「最近開いたファイル」履歴へ追加する（REQ-001-006）。
 * キャンセル時やファイル未選択時は履歴・許可リストのいずれも変更しない。
 */
export function createShowOpenDialogHandler(
  dialogModule: DialogLike,
  pathAllowlist: PathAllowlist,
  settingsService: SettingsService
): () => Promise<string | null> {
  return async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialogModule.showOpenDialog(OPEN_MUSICXML_DIALOG_OPTIONS);
    if (canceled || filePaths.length === 0) {
      return null;
    }

    const selectedPath = filePaths[0];
    pathAllowlist.allowMusicXml(selectedPath);
    settingsService.addRecentFile(selectedPath);
    return selectedPath;
  };
}

const ACCEPTED_DROPPED_FILE_EXTENSIONS = ['.xml', '.musicxml', '.mxl'];

function hasAcceptedMusicXmlExtension(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return ACCEPTED_DROPPED_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * `file:register-dropped-file` IPCハンドラのファクトリ（TASK-053）。
 *
 * ドラッグ＆ドロップで開かれたファイルを PathAllowlist に登録し、
 * ダイアログ経由（`createShowOpenDialogHandler`）と同様に SettingsService.addRecentFile を
 * 呼び出す。Renderer から任意パスを allowlist に登録できてしまわないよう、
 * 拡張子が `.xml` / `.musicxml` / `.mxl`（大文字小文字を区別しない）のいずれかである
 * 場合のみ登録する。それ以外の拡張子は登録を拒否し false を返す
 * （allowlist・履歴のいずれにも変更を加えない）。
 */
export function createRegisterDroppedFileHandler(
  pathAllowlist: PathAllowlist,
  settingsService: SettingsService
): (event: unknown, filePath: string) => Promise<boolean> {
  return async (_event: unknown, filePath: string): Promise<boolean> => {
    if (!hasAcceptedMusicXmlExtension(filePath)) {
      return false;
    }

    pathAllowlist.allowMusicXml(filePath);
    settingsService.addRecentFile(filePath);
    return true;
  };
}

/**
 * セキュリティレビュー対応（L-2）: シンボリックリンク検査に用いる lstat の最小インターフェース。
 */
export interface SymlinkChecker {
  lstat(path: string): Promise<{ isSymbolicLink(): boolean }>;
}

/**
 * ipcMain.handle に渡す fs.promises 依存の最小インターフェース。
 * テストでは実ファイルシステムに触れず readFile / lstat のみ差し替えられるようにする。
 */
export interface TextFileReader extends SymlinkChecker {
  readFile(path: string, encoding: 'utf-8'): Promise<string>;
}

export interface BinaryFileReader extends SymlinkChecker {
  readFile(path: string): Promise<Buffer>;
}

const ANNOTATION_SUFFIX = '.annotation.json';

/**
 * セキュリティレビュー対応（L-2）: アノテーションサイドカー（`*.annotation.json`）は
 * このアプリ自身が atomic write で生成する派生ファイルであり、シンボリックリンクである
 * べきではない。読み取り前に lstat でシンボリックリンクを検出したら拒否し、
 * サイドカーパスに置かれたシンボリックリンク経由で別ファイルの内容を読み出す経路を塞ぐ
 * （書き込み側 file:write のシンボリックリンク拒否と対称）。
 *
 * ユーザーがダイアログ/D&Dで明示的に選択した本体ファイル（.xml/.musicxml/.mxl）は
 * ユーザー自身の選択であり、シンボリックリンクでも尊重するため検査対象外とする。
 */
async function assertAnnotationSidecarNotSymlink(
  fsModule: SymlinkChecker,
  resolvedPath: string
): Promise<void> {
  if (!resolvedPath.endsWith(ANNOTATION_SUFFIX)) return;
  try {
    const stats = await fsModule.lstat(resolvedPath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Refused to read through symlink: ${resolvedPath}`);
    }
  } catch (err) {
    // まだ存在しない（初回オープン）のは正常。それ以外のエラーは伝播する。
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }
}

/**
 * `file:read` IPCハンドラのファクトリ（TASK-086）。
 *
 * PathAllowlist.assertAllowedReadPath で「ユーザーが開いたMusicXML本体、または
 * その注釈サイドカー」のみに読み取り対象を制限してから fs.promises.readFile を呼ぶ。
 * 許可されないパスは読み取り前に例外を投げ、fs モジュールには触れない。
 */
export function createReadFileHandler(
  pathAllowlist: PathAllowlist,
  fsModule: TextFileReader
): (event: unknown, path: string) => Promise<string> {
  return async (_event: unknown, path: string): Promise<string> => {
    const allowedPath = pathAllowlist.assertAllowedReadPath(path);
    await assertAnnotationSidecarNotSymlink(fsModule, allowedPath);
    return fsModule.readFile(allowedPath, 'utf-8');
  };
}

/**
 * `file:read-if-exists` IPCハンドラのファクトリ（TASK-086）。
 *
 * 注釈サイドカーファイルのように「存在しないのが正常」な読み取り対象向け。
 * assertAllowedReadPath の許可判定は createReadFileHandler と同一で、
 * ENOENT のみ null を返し他のエラーはそのまま呼び出し元へ伝播する。
 */
export function createReadFileIfExistsHandler(
  pathAllowlist: PathAllowlist,
  fsModule: TextFileReader
): (event: unknown, path: string) => Promise<string | null> {
  return async (_event: unknown, path: string): Promise<string | null> => {
    const allowedPath = pathAllowlist.assertAllowedReadPath(path);
    await assertAnnotationSidecarNotSymlink(fsModule, allowedPath);
    try {
      return await fsModule.readFile(allowedPath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  };
}

/**
 * `file:read-binary` IPCハンドラのファクトリ（TASK-086）。
 *
 * .mxl（圧縮MusicXML）読み取り用。assertAllowedReadPath の許可判定は
 * createReadFileHandler と同一で、IPC経由でArrayBufferとして送るために
 * Buffer を ArrayBuffer へ変換して返す。
 */
export function createReadBinaryFileHandler(
  pathAllowlist: PathAllowlist,
  fsModule: BinaryFileReader
): (event: unknown, path: string) => Promise<ArrayBuffer> {
  return async (_event: unknown, path: string): Promise<ArrayBuffer> => {
    const allowedPath = pathAllowlist.assertAllowedReadPath(path);
    await assertAnnotationSidecarNotSymlink(fsModule, allowedPath);
    const content = await fsModule.readFile(allowedPath);
    // Buffer.buffer は SharedArrayBuffer の可能性を含む ArrayBufferLike 型のため、
    // 新規 ArrayBuffer へコピーして型を確定させる（IPC経由で送るには元々コピーが必要）。
    const arrayBuffer = new ArrayBuffer(content.byteLength);
    new Uint8Array(arrayBuffer).set(content);
    return arrayBuffer;
  };
}
