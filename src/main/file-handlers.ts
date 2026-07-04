import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron';
import type { PathAllowlist } from './path-allowlist';
import type { SettingsService } from './settings';

/**
 * ipcMain.handle に渡す dialog 依存の最小インターフェース。
 * テストでは electron 全体をモックせず showOpenDialog のみ差し替えられるようにする。
 */
export interface DialogLike {
  showOpenDialog(options: OpenDialogOptions): Promise<Pick<OpenDialogReturnValue, 'canceled' | 'filePaths'>>;
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
    const { canceled, filePaths } = await dialogModule.showOpenDialog(
      OPEN_MUSICXML_DIALOG_OPTIONS
    );
    if (canceled || filePaths.length === 0) {
      return null;
    }

    const selectedPath = filePaths[0];
    pathAllowlist.allowMusicXml(selectedPath);
    settingsService.addRecentFile(selectedPath);
    return selectedPath;
  };
}
