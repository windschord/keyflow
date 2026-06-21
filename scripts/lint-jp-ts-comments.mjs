/**
 * TypeScriptファイルから日本語コメントを抽出してtextlintで検査する
 *
 * - 単行コメント (//) 内の日本語テキストを抽出
 * - ブロックコメント (/* ... *\/) 内の日本語テキストを抽出
 * - 日本語が含まれない場合はスキップ
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readdirSync, statSync } from 'node:fs';

const JAPANESE_PATTERN = /[　-鿿＀-￯゠-ヿ぀-ゟ]/;

/**
 * ディレクトリを再帰的に走査して指定した拡張子のファイル一覧を返す
 * @param {string} dir - 走査するディレクトリのパス
 * @param {string[]} exts - 対象ファイル拡張子の配列（例: ['.ts', '.tsx']）
 * @param {string[]} results - 結果を蓄積する配列（再帰呼び出し用）
 * @returns {string[]} 見つかったファイルの絶対パス一覧
 */
function walkDir(dir, exts, results = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, exts, results);
    } else if (exts.some((ext) => fullPath.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const tsFiles = walkDir('src', ['.ts', '.tsx']);
const commentLines = [];

for (const file of tsFiles) {
  const content = readFileSync(file, 'utf-8');

  // 単行コメント
  for (const match of content.matchAll(/\/\/(.+)$/gm)) {
    const text = match[1].trim();
    if (JAPANESE_PATTERN.test(text)) {
      commentLines.push(text);
    }
  }

  // ブロックコメント
  for (const match of content.matchAll(/\/\*([\s\S]*?)\*\//g)) {
    const block = match[1]
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, '').trim())
      .filter(Boolean)
      .join('\n');
    if (JAPANESE_PATTERN.test(block)) {
      commentLines.push(block);
    }
  }
}

if (commentLines.length === 0) {
  console.log('TypeScriptファイルに日本語コメントが見つかりませんでした。スキップします。');
  process.exit(0);
}

const tmpDir = mkdtempSync(join(tmpdir(), 'textlint-ts-'));
const tmpFile = join(tmpDir, 'comments.txt');

let hasError = false;
try {
  writeFileSync(tmpFile, commentLines.join('\n'));
  execSync(`npx textlint --config .textlintrc.json "${tmpFile}"`, { stdio: 'inherit' });
  console.log('日本語コメントのlintが完了しました。');
} catch {
  hasError = true;
} finally {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // cleanup failure is non-fatal
  }
}

if (hasError) {
  process.exit(1);
}
