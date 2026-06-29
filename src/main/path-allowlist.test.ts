import { describe, expect, it } from 'vitest';
import { resolve } from 'path';
import { PathAllowlist } from './path-allowlist';

describe('PathAllowlist', () => {
  it('allows only annotation files derived from registered MusicXML paths', () => {
    const allowlist = new PathAllowlist();
    allowlist.allowMusicXml('/scores/example.musicxml');

    expect(allowlist.assertAllowedAnnotationPath('/scores/example.musicxml.annotation.json')).toBe(
      resolve('/scores/example.musicxml.annotation.json')
    );
  });

  it('rejects arbitrary files and annotations for unregistered MusicXML paths', () => {
    const allowlist = new PathAllowlist();
    allowlist.allowMusicXml('/scores/example.musicxml');

    expect(() => allowlist.assertAllowedAnnotationPath('/scores/example.musicxml')).toThrow(
      /Refused to write/
    );
    expect(() =>
      allowlist.assertAllowedAnnotationPath('/scores/other.musicxml.annotation.json')
    ).toThrow(/Refused to write/);
  });
});
