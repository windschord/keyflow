/**
 * UI文言中の`{name}`プレースホルダをparamsの値で置換する純関数（TASK-096）。
 * paramsに存在しないプレースホルダは置換せずそのまま残す。paramsが省略された
 * 場合はtemplateをそのまま返す。
 */
export function formatMessage(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (matched, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, key)) return matched;
    return String(params[key]);
  });
}
