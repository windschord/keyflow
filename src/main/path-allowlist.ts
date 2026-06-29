import { resolve } from 'path';

const ANNOTATION_SUFFIX = '.annotation.json';

/**
 * Main プロセス側でファイル書き込み先を制限するための許可リスト。
 *
 * renderer から任意パスへの書き込みを防ぐため、以前に main 側で開いた
 * MusicXML パスから派生した `{MusicXMLPath}.annotation.json` だけを許可する。
 */
export class PathAllowlist {
  private allowed = new Set<string>();

  /** main 側で開くことを許可した MusicXML パスを登録する。 */
  allowMusicXml(musicXmlPath: string): void {
    this.allowed.add(resolve(musicXmlPath));
  }

  /** 指定パスが許可済み MusicXML 由来の annotation ファイルかどうかを判定する。 */
  isAllowedAnnotationPath(requestedPath: string): boolean {
    const resolved = resolve(requestedPath);
    if (!resolved.endsWith(ANNOTATION_SUFFIX)) {
      return false;
    }
    const base = resolved.slice(0, resolved.length - ANNOTATION_SUFFIX.length);
    return this.allowed.has(base);
  }

  /**
   * 許可されていれば正規化済みパスを返し、そうでなければ例外を送出する。
   */
  assertAllowedAnnotationPath(requestedPath: string): string {
    if (!this.isAllowedAnnotationPath(requestedPath)) {
      throw new Error(`Refused to write to disallowed path: ${requestedPath}`);
    }
    return resolve(requestedPath);
  }
}
