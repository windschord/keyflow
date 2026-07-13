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

// 日本語判定: U+3000〜U+9FFF（CJK記号・かな・漢字ブロック一帯）と
// U+FF00〜U+FFEF（全角英数・半角カナ等）を対象とする
const JAPANESE_PATTERN = /[　-鿿＀-￯]/;

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

/**
 * コメント内で折り返された文（80桁制限などで途中改行された1つの文）を1行に結合する。
 * 従来は行単位のままtextlintへ渡していたため、「（」と「）」が別行に分かれるたびに
 * 「Cannot find a pairing character」の誤検知が大量発生していた（2026-07-05是正）。
 *
 * 結合ルール: 直前行が文末記号（。．.！？:：）で終わらず、かつ現在行が箇条書き・
 * JSDocタグ・表・コード等の新しい項目の開始でない場合のみ、直前行へ連結する。
 * @param {string[]} rawLines - コメントブロック内の行（プレフィックス除去済み）
 * @returns {string} 結合後のテキスト（空行は段落区切りとして扱い除去）
 */
function joinWrappedCommentLines(rawLines) {
  /** @type {string[]} */
  const out = [];
  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) {
      out.push('');
      continue;
    }
    const prev = out.length > 0 ? out[out.length - 1] : null;
    const startsNewItem = /^([-*@|>#`]|\d+[.．)]|```)/.test(line);
    if (prev && !/[。．.！？:：]$/.test(prev) && !startsNewItem) {
      out[out.length - 1] = prev + line;
    } else {
      out.push(line);
    }
  }
  return out.filter(Boolean).join('\n');
}

const tsFiles = walkDir('src', ['.ts', '.tsx']);
/** ソースファイルパス → 日本語コメントブロック一覧。エラー箇所を元ファイルへ辿れるようにする */
const blocksByFile = new Map();

// ブロックコメントの開始は「/* の直後が * または空白・改行」の場合のみとする。
// 文字列リテラル内のglobパターン（例: '.../salamander/*.mp3'）の「/*」を
// コメント開始と誤認し、後続コードをコメントとして検査する誤検知を防ぐ（2026-07-07是正）。
const BLOCK_COMMENT_PATTERN = /\/\*(?=\*|\s)([\s\S]*?)\*\//g;

for (const file of tsFiles) {
  const commentBlocks = [];
  const content = readFileSync(file, 'utf-8');
  const withoutBlocks = content.replace(BLOCK_COMMENT_PATTERN, '');

  // 単行コメント: 連続する行は1つのコメントブロックとして折返しを結合する
  let currentRun = [];
  const flushRun = () => {
    if (currentRun.length === 0) return;
    const text = joinWrappedCommentLines(currentRun);
    if (JAPANESE_PATTERN.test(text)) commentBlocks.push(text);
    currentRun = [];
  };
  for (const line of withoutBlocks.split('\n')) {
    const match = line.match(/\/\/(.*)$/);
    if (match) {
      currentRun.push(match[1]);
    } else {
      flushRun();
    }
  }
  flushRun();

  // ブロックコメント: プレフィックス（*）を除去したうえで折返しを結合する
  for (const match of content.matchAll(BLOCK_COMMENT_PATTERN)) {
    const blockLines = match[1].split('\n').map((line) => line.replace(/^\s*\*\s?/, ''));
    const block = joinWrappedCommentLines(blockLines);
    if (JAPANESE_PATTERN.test(block)) {
      commentBlocks.push(block);
    }
  }

  if (commentBlocks.length > 0) {
    blocksByFile.set(file, commentBlocks);
  }
}

if (blocksByFile.size === 0) {
  console.log('TypeScriptファイルに日本語コメントが見つかりませんでした。スキップします。');
  process.exit(0);
}

const tmpDir = mkdtempSync(join(tmpdir(), 'textlint-ts-'));

let hasError = false;
try {
  // ソースファイルごとに1つの検査ファイルを作り、textlintの出力パスから
  // 元ファイルを特定できるようにする（例: src__renderer__src__App.tsx.txt）。
  // コメントブロック同士は空行で区切り、別コメントの文が連結されないようにする
  for (const [file, blocks] of blocksByFile) {
    const safeName = `${file.replaceAll('/', '__')}.txt`;
    writeFileSync(join(tmpDir, safeName), blocks.join('\n\n'));
  }
  execSync(`npx textlint --config .textlintrc.json "${tmpDir}/*.txt"`, { stdio: 'inherit' });
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
