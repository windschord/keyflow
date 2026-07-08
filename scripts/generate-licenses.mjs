#!/usr/bin/env node
// TASK-076 / DEC-008: サードパーティライブラリのライセンス一覧を自動生成する
//
// package.jsonの `dependencies`（本番依存のみ。devDependenciesは対象外）を起点に
// node_modules/<pkg>/package.json と LICENSE* ファイルを走査し、
// src/renderer/src/generated/licenses.json を出力する（自前実装、外部ライブラリ不使用。
// 依存規模が少数のため十分。DEC-008参照）。
//
// 実行: npm run generate:licenses（predev/prebuild/prelint/pretest/pretest:coverageの
// 各フックから自動実行される）
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_PATH = resolve(ROOT, 'src/renderer/src/generated/licenses.json');

// LICENSEファイル名の候補（大文字小文字・拡張子の揺れに対応）
const LICENSE_FILE_CANDIDATES = [
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'License',
  'License.md',
  'license',
  'license.md',
  'LICENCE',
  'LICENCE.md',
];

/**
 * package.jsonのlicenseフィールドをSPDX文字列へ正規化する。
 * 新形式（文字列）・旧形式（{type: string}）・より古い形式（licenses配列）に対応する。
 * @param {Record<string, unknown>} depPkg - 依存先のpackage.json内容
 * @returns {string} SPDX表記の文字列。取得できない場合は'UNKNOWN'
 */
export function normalizeLicense(depPkg) {
  if (typeof depPkg.license === 'string') return depPkg.license;
  if (
    depPkg.license &&
    typeof depPkg.license === 'object' &&
    typeof depPkg.license.type === 'string'
  ) {
    return depPkg.license.type;
  }
  if (Array.isArray(depPkg.licenses) && typeof depPkg.licenses[0]?.type === 'string') {
    return depPkg.licenses[0].type;
  }
  return 'UNKNOWN';
}

/**
 * パッケージディレクトリ直下からLICENSEファイルを探す。
 * @param {string} pkgDir - node_modules/<pkg> のパス
 * @returns {string | null} 見つかったLICENSEファイルの絶対パス、なければnull
 */
export function findLicenseFile(pkgDir) {
  if (!existsSync(pkgDir)) return null;
  let entries;
  try {
    entries = readdirSync(pkgDir);
  } catch {
    return null;
  }
  for (const candidate of LICENSE_FILE_CANDIDATES) {
    if (entries.includes(candidate)) {
      return join(pkgDir, candidate);
    }
  }
  return null;
}

/**
 * 指定した依存パッケージ群についてライセンス情報を収集する。
 * @param {{ dependencies: Record<string, string>, nodeModulesDir: string }} params
 * @returns {Array<{ name: string, version: string, license: string, licenseText: string }>}
 */
export function collectLicenses({ dependencies, nodeModulesDir }) {
  const results = [];

  for (const name of Object.keys(dependencies)) {
    const pkgDir = join(nodeModulesDir, name);
    const pkgJsonPath = join(pkgDir, 'package.json');

    let version = 'unknown';
    let license = 'UNKNOWN';

    if (existsSync(pkgJsonPath)) {
      let depPkg;
      try {
        depPkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      } catch (error) {
        // 1パッケージのpackage.json破損でスクリプト全体（predev/prebuild/prelint/
        // pretest各フック）を停止させないため、当該パッケージのみスキップして継続する
        // （CodeRabbit PR#28指摘#3）。
        console.warn(
          `[generate-licenses] ${pkgJsonPath} の読み込みに失敗したため、${name} をスキップします:`,
          error
        );
        continue;
      }
      version = typeof depPkg.version === 'string' ? depPkg.version : 'unknown';
      license = normalizeLicense(depPkg);
    }

    const licenseFilePath = findLicenseFile(pkgDir);
    const licenseText = licenseFilePath ? readFileSync(licenseFilePath, 'utf-8') : license;

    results.push({ name, version, license, licenseText });
  }

  return results;
}

/**
 * 指定したパッケージルート（package.jsonとnode_modulesが存在するディレクトリ）から
 * dependenciesのライセンス一覧を生成する。
 * @param {string} rootDir - パッケージルートのパス
 * @returns {Array<{ name: string, version: string, license: string, licenseText: string }>}
 */
export function generateLicensesFromPackageRoot(rootDir) {
  const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf-8'));
  const dependencies = pkg.dependencies ?? {};
  return collectLicenses({ dependencies, nodeModulesDir: resolve(rootDir, 'node_modules') });
}

function main() {
  const licenses = generateLicensesFromPackageRoot(ROOT);
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(licenses, null, 2) + '\n');
  console.log(`Generated ${OUT_PATH} (${licenses.length} packages)`);
}

// スクリプトとして直接実行された場合のみ生成する（テストからのimport時は実行しない）。
// import.meta.urlはfile://形式でパスがパーセントエンコードされうる（本リポジトリの
// ディレクトリ名には日本語・空白が含まれるため）ため、両者をfileURLToPath/resolveで
// OSパス形式に揃えてから比較する（単純な文字列比較は不一致になり得る）。
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
