#!/usr/bin/env node
// TASK-068: アプリのブランディング（アイコン生成・ウィンドウタイトル）
//
// resources/icon.svg（マスターSVG）から以下を生成する:
//   - resources/icon.png (1024px, Linux実行時アイコン)
//   - build/icon.icns (macOSパッケージ用)
//   - build/icon.ico (Windowsパッケージ用。electron-builder.ymlの参照欠落解消)
//   - build/appx/*.png (Microsoft Store配布向けMSIX/AppXのタイル画像)
//
// 生成物はリポジトリにコミットする方針（ビルド環境に生成ツールを要求しないため）。
// 実行: npm run generate:icons

import { Resvg } from '@resvg/resvg-js';
import png2icons from 'png2icons';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SVG_PATH = resolve(ROOT, 'resources/icon.svg');
const PNG_PATH = resolve(ROOT, 'resources/icon.png');
const ICNS_PATH = resolve(ROOT, 'build/icon.icns');
const ICO_PATH = resolve(ROOT, 'build/icon.ico');
const APPX_ASSETS_DIR = resolve(ROOT, 'build/appx');

const MASTER_PNG_SIZE = 1024;

// electron-builderのAppXターゲットが参照するタイル画像。build/appx/へ同名で置くと
// electron-builder同梱のサンプル画像ではなく本アイコンが使われる
// （app-builder-lib: AppxTarget.ts の vendorAssetsForDefaultAssets）。
const APPX_ASSETS = [
  { name: 'StoreLogo.png', width: 50, height: 50 },
  { name: 'Square44x44Logo.png', width: 44, height: 44 },
  { name: 'Square150x150Logo.png', width: 150, height: 150 },
  { name: 'Wide310x150Logo.png', width: 310, height: 150 },
];

/**
 * SVGを指定した一辺のサイズで正方形PNGへレンダリングする
 * @param {string} svg - レンダリング対象のSVG文字列
 * @param {number} size - 出力PNGの一辺のピクセル数
 * @returns {Buffer} PNGバイナリ
 */
function renderPng(svg, size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  });
  return resvg.render().asPng();
}

/**
 * マスターSVGの図案を維持したまま任意のアスペクト比のPNGへレンダリングする
 *
 * 正方形でないタイル（Wide310x150）でも図案を歪ませないよう、短辺に合わせて
 * 等倍縮小し中央へ配置したラッパーSVGを組み立ててからレンダリングする。
 * @param {string} svg - レンダリング対象のSVG文字列（viewBox属性が必須）
 * @param {number} width - 出力PNGの幅（ピクセル）
 * @param {number} height - 出力PNGの高さ（ピクセル）
 * @returns {Buffer} PNGバイナリ
 */
function renderPngWithAspect(svg, width, height) {
  if (width === height) {
    return renderPng(svg, width);
  }

  const viewBox = /viewBox="\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*"/.exec(svg);
  if (!viewBox) {
    throw new Error('resources/icon.svg にviewBox属性が見つからない');
  }
  const [sourceWidth, sourceHeight] = [Number(viewBox[3]), Number(viewBox[4])];

  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const offsetX = (width - sourceWidth * scale) / 2;
  const offsetY = (height - sourceHeight * scale) / 2;

  const wrapped =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<g transform="translate(${offsetX} ${offsetY}) scale(${scale})">${inner}</g>` +
    `</svg>`;

  return renderPng(wrapped, width);
}

/**
 * マスターSVGから全アイコン生成物を書き出す
 * @returns {void}
 */
function main() {
  const svg = readFileSync(SVG_PATH, 'utf-8');

  const png1024 = renderPng(svg, MASTER_PNG_SIZE);
  mkdirSync(dirname(PNG_PATH), { recursive: true });
  writeFileSync(PNG_PATH, png1024);
  console.log(`Generated ${PNG_PATH}`);

  mkdirSync(dirname(ICNS_PATH), { recursive: true });

  const icns = png2icons.createICNS(png1024, png2icons.BICUBIC, 0);
  if (!icns) {
    throw new Error('Failed to generate build/icon.icns from resources/icon.png');
  }
  writeFileSync(ICNS_PATH, icns);
  console.log(`Generated ${ICNS_PATH}`);

  // forWinExe=trueでBMP/PNG混在生成し、古いWindowsでも表示崩れが起きにくい形式にする
  const ico = png2icons.createICO(png1024, png2icons.BICUBIC, 0, false, true);
  if (!ico) {
    throw new Error('Failed to generate build/icon.ico from resources/icon.png');
  }
  writeFileSync(ICO_PATH, ico);
  console.log(`Generated ${ICO_PATH}`);

  mkdirSync(APPX_ASSETS_DIR, { recursive: true });
  for (const asset of APPX_ASSETS) {
    const png = renderPngWithAspect(svg, asset.width, asset.height);
    const path = resolve(APPX_ASSETS_DIR, asset.name);
    writeFileSync(path, png);
    console.log(`Generated ${path}`);
  }
}

main();
