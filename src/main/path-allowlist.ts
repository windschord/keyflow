import { resolve } from 'path';

const ANNOTATION_SUFFIX = '.annotation.json';
const SCOREMAP_CACHE_SUFFIX = '.scoremap.cache.json';
const SIDECAR_SUFFIXES = [ANNOTATION_SUFFIX, SCOREMAP_CACHE_SUFFIX] as const;

/**
 * renderer からの任意ファイル上書きを防ぐため、
 * main プロセスでユーザーが選択した MusicXML から派生する sidecar のみ許可する。
 */
export class PathAllowlist {
  private allowedMusicXmlPaths = new Set<string>();

  allowMusicXml(musicXmlPath: string): void {
    this.allowedMusicXmlPaths.add(resolve(musicXmlPath));
  }

  private assertAllowedSidecarSuffix(
    requestedPath: string,
    allowedSuffixes: readonly string[]
  ): { resolvedPath: string; musicXmlPath: string; suffix: string } {
    const resolvedPath = resolve(requestedPath);

    for (const suffix of allowedSuffixes) {
      if (resolvedPath.endsWith(suffix)) {
        const musicXmlPath = resolvedPath.slice(0, -suffix.length);
        if (this.allowedMusicXmlPaths.has(musicXmlPath)) {
          return { resolvedPath, musicXmlPath, suffix };
        }
      }
    }

    throw new Error(`Refused to write to disallowed path: ${requestedPath}`);
  }

  assertAllowedAnnotationPath(requestedPath: string): string {
    return this.assertAllowedSidecarSuffix(requestedPath, [ANNOTATION_SUFFIX]).resolvedPath;
  }

  /**
   * file:write で書き込めるパスを、ユーザーが選択した MusicXML から派生する
   * 注釈サイドカー（*.annotation.json）と noteId マップキャッシュ
   * （*.scoremap.cache.json）に制限する。
   */
  assertAllowedSidecarWritePath(requestedPath: string): string {
    return this.assertAllowedSidecarSuffix(requestedPath, SIDECAR_SUFFIXES).resolvedPath;
  }

  /**
   * file:read系IPCが読み取れるパスを、ユーザーが選択したMusicXML本体と
   * その派生サイドカー（*.annotation.json / *.scoremap.cache.json）のみに
   * 制限する（TASK-086 + キャッシュ読み取り）。
   */
  assertAllowedReadPath(requestedPath: string): string {
    const resolvedPath = resolve(requestedPath);

    if (this.allowedMusicXmlPaths.has(resolvedPath)) {
      return resolvedPath;
    }

    for (const suffix of SIDECAR_SUFFIXES) {
      if (resolvedPath.endsWith(suffix)) {
        const musicXmlPath = resolvedPath.slice(0, -suffix.length);
        if (this.allowedMusicXmlPaths.has(musicXmlPath)) {
          return resolvedPath;
        }
      }
    }

    throw new Error(`Refused to read from disallowed path: ${requestedPath}`);
  }
}
