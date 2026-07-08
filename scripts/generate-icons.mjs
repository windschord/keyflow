#!/usr/bin/env node
// TASK-068: アプリのブランディング（アイコン生成・ウィンドウタイトル）
//
// resources/icon.svg（マスターSVG）から以下を生成する:
//   - resources/icon.png (1024px, Linux実行時アイコン)
//   - build/icon.icns (macOSパッケージ用)
//   - build/icon.ico (Windowsパッケージ用。electron-builder.ymlの参照欠落解消)
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

const MASTER_PNG_SIZE = 1024;

function renderPng(svg, size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  });
  return resvg.render().asPng();
}

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
}

main();
