/// <reference types="vite/client" />

// electron.vite.config.tsのrenderer defineでpackage.jsonのversionを注入する
// ビルド時定数（TASK-076、DEC-008）。バージョン表示とpackage.jsonの一致を保証する。
declare const __APP_VERSION__: string;
