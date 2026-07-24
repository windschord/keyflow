/**
 * セキュリティレビュー対応（L-3）: webContentsのpermission requestに対する許可判定。
 *
 * Electron APIに依存しない純粋関数として実装し、Electron実行環境なしで
 * ユニットテストできるようにする（navigation-policy.ts と同じパターン）。
 *
 * このアプリが必要とする権限はWeb MIDI入力だけであり、Rendererはsysexなし
 * （sysex:false）でMIDIアクセスを要求する。SysEx送信を伴うmidiSysexは要求しておらず
 * 不要なため、midiのみを許可しmidiSysexを含む他の権限はすべて拒否する。
 */
export function isAllowedPermission(permission: string): boolean {
  return permission === 'midi';
}
