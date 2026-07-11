import { resolve } from 'path';

const ANNOTATION_SUFFIX = '.annotation.json';

/**
 * renderer からの任意ファイル上書きを防ぐため、
 * main プロセスでユーザーが選択した MusicXML から派生する annotation のみ許可する。
 */
export class PathAllowlist {
  private allowedMusicXmlPaths = new Set<string>();

  allowMusicXml(musicXmlPath: string): void {
    this.allowedMusicXmlPaths.add(resolve(musicXmlPath));
  }

  assertAllowedAnnotationPath(requestedPath: string): string {
    const resolvedPath = resolve(requestedPath);

    if (!resolvedPath.endsWith(ANNOTATION_SUFFIX)) {
      throw new Error(`Refused to write to disallowed path: ${requestedPath}`);
    }

    const musicXmlPath = resolvedPath.slice(0, -ANNOTATION_SUFFIX.length);
    if (!this.allowedMusicXmlPaths.has(musicXmlPath)) {
      throw new Error(`Refused to write to disallowed path: ${requestedPath}`);
    }

    return resolvedPath;
  }

  /**
   * file:read系IPCが読み取れるパスを、ユーザーが選択したMusicXML本体と
   * その注釈サイドカー（*.annotation.json）のみに制限する（TASK-086）。
   */
  assertAllowedReadPath(requestedPath: string): string {
    const resolvedPath = resolve(requestedPath);

    if (this.allowedMusicXmlPaths.has(resolvedPath)) {
      return resolvedPath;
    }

    if (resolvedPath.endsWith(ANNOTATION_SUFFIX)) {
      const musicXmlPath = resolvedPath.slice(0, -ANNOTATION_SUFFIX.length);
      if (this.allowedMusicXmlPaths.has(musicXmlPath)) {
        return resolvedPath;
      }
    }

    throw new Error(`Refused to read from disallowed path: ${requestedPath}`);
  }
}
