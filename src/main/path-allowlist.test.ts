import { describe, expect, it } from 'vitest';
import { resolve } from 'path';
import { PathAllowlist } from './path-allowlist';

describe('PathAllowlist', () => {
  it('allows annotation JSON derived from a user-selected MusicXML path', () => {
    const allowlist = new PathAllowlist();
    allowlist.allowMusicXml('/scores/example.musicxml');

    expect(allowlist.assertAllowedAnnotationPath('/scores/example.musicxml.annotation.json')).toBe(
      resolve('/scores/example.musicxml.annotation.json')
    );
  });

  it('rejects arbitrary paths and annotations for unselected MusicXML paths', () => {
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
