// TASK-076 / DEC-008: Aboutページの静的クレジットデータ
//
// generate-licenses.mjsで自動収集できない情報（アプリ本体のライセンス・
// 同梱音源のクレジット）をここに静的定義する。

export const APP_NAME = 'MusicXML Piano Practice';

export const APP_LICENSE_NAME = 'Apache License 2.0';
export const APP_LICENSE_URL = 'https://www.apache.org/licenses/LICENSE-2.0';

// Salamander Grand Piano V3のクレジット表記義務（REQ-013-008 / REQ-015-003、DEC-006参照）
export const SALAMANDER_CREDIT = {
  name: 'Salamander Grand Piano V3',
  author: 'Alexander Holm',
  license: 'CC-BY 3.0',
  text: 'Salamander Grand Piano V3 by Alexander Holm (CC-BY 3.0)',
};
