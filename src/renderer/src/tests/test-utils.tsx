import React, { StrictMode } from 'react';
import {
  render,
  renderHook,
  type RenderOptions,
  type RenderHookOptions,
} from '@testing-library/react';

/**
 * StrictModeでラップしてコンポーネントをレンダリングするヘルパー。
 *
 * 背景（docs/sdd/troubleshooting/2026-07-05-test-escape/analysis.md 再発防止策3）:
 * 通常の `render()` は React.StrictMode を経由しないため、エフェクトの
 * マウント→アンマウント→再マウントという開発モード特有の二重実行が
 * テストで再現されない。その結果、副作用の後始末（dispose/cleanup漏れ）に
 * 起因する不具合がテストをすり抜けてきた。
 *
 * 本ヘルパーを標準として使用し、以後の新規コンポーネントテストでも
 * `render()` の代わりに `renderWithStrictMode()` を使うこと。
 */
export function renderWithStrictMode(
  ui: React.ReactElement,
  options?: RenderOptions
): ReturnType<typeof render> {
  return render(ui, {
    ...options,
    wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
  });
}

/**
 * StrictModeでラップしてフックをレンダリングするヘルパー（renderHook版）。
 * 上記 renderWithStrictMode と同様の理由で、フックのeffectについても
 * 二重マウントを再現できるようにする。
 */
export function renderHookWithStrictMode<Result, Props>(
  callback: (props: Props) => Result,
  options?: RenderHookOptions<Props>
): ReturnType<typeof renderHook<Result, Props>> {
  return renderHook(callback, {
    ...options,
    wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
  });
}
