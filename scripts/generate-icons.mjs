#!/usr/bin/env node
// TASK-068: アプリのブランディング（アイコン生成・ウィンドウタイトル）
//
// resources/icon.svg（マスターSVG）から以下を生成する:
//   - resources/icon.png (1024px, Linux実行時アイコン)
//   - build/icon.icns (macOSパッケージ用)
//   - build/icon.ico (Windowsパッケージ用。electron-builder.ymlの参照欠落解消)
//   - build/appx/*.png (Microsoft Store配布向けMSIX/AppXのタイル画像)
//   - resources/store/*.png (Microsoft Store掲載情報のロゴ画像)
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
const STORE_ART_DIR = resolve(ROOT, 'resources/store');

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

// Partner Centerの「Store 登録情報」で使うロゴ画像。パッケージ内のタイル画像
// （build/appx/）とは別物で、ストアページ上の表示にのみ使われる。
// 透過部分があるとStore側の背景次第で角の欠けが目立つため、
// アイコン背景と同じ色を全面に敷いたうえで図案を中央へ配置する。
const STORE_ART_BACKGROUND = '#122036';
const STORE_ART = [
  // 9:16 ポスターアート。縦長のため図案を縮小して中央へ置く
  { name: 'poster-art-720x1080.png', width: 720, height: 1080, scale: 0.83 },
  // 1:1 ボックスアート
  { name: 'box-art-1080x1080.png', width: 1080, height: 1080, scale: 1 },
  // 1:1 アプリタイルアイコン
  { name: 'app-tile-icon-300x300.png', width: 300, height: 300, scale: 1 },
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
  return renderPng(buildWrappedSvg(svg, width, height, 1, null), width);
}

/**
 * マスターSVGの図案を、任意のキャンバスサイズへ等倍縮小して中央配置したSVGを組み立てる
 * @param {string} svg - 元のSVG文字列（viewBox属性が必須）
 * @param {number} width - キャンバス幅（ピクセル）
 * @param {number} height - キャンバス高さ（ピクセル）
 * @param {number} scale - 短辺に対する図案の占有率（1で短辺いっぱい）
 * @param {string|null} background - 全面に敷く背景色。nullなら透過のまま
 * @returns {string} 組み立てたSVG文字列
 */
function buildWrappedSvg(svg, width, height, scale, background) {
  const viewBox = /viewBox="\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*"/.exec(svg);
  if (!viewBox) {
    throw new Error('resources/icon.svg にviewBox属性が見つからない');
  }
  const [sourceWidth, sourceHeight] = [Number(viewBox[3]), Number(viewBox[4])];

  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const artScale = (Math.min(width, height) * scale) / Math.max(sourceWidth, sourceHeight);
  const offsetX = (width - sourceWidth * artScale) / 2;
  const offsetY = (height - sourceHeight * artScale) / 2;

  const backgroundRect = background
    ? `<rect width="${width}" height="${height}" fill="${background}"/>`
    : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    backgroundRect +
    `<g transform="translate(${offsetX} ${offsetY}) scale(${artScale})">${inner}</g>` +
    `</svg>`
  );
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

  mkdirSync(STORE_ART_DIR, { recursive: true });
  for (const art of STORE_ART) {
    const wrapped = buildWrappedSvg(svg, art.width, art.height, art.scale, STORE_ART_BACKGROUND);
    const path = resolve(STORE_ART_DIR, art.name);
    writeFileSync(path, renderPng(wrapped, art.width));
    console.log(`Generated ${path}`);
  }
}

main();
