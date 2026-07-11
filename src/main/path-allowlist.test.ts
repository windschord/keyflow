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

describe('PathAllowlist.assertAllowedReadPath', () => {
  it('allows reading the registered MusicXML path itself', () => {
    const allowlist = new PathAllowlist();
    allowlist.allowMusicXml('/scores/example.musicxml');

    expect(allowlist.assertAllowedReadPath('/scores/example.musicxml')).toBe(
      resolve('/scores/example.musicxml')
    );
  });

  it('allows reading the annotation sidecar derived from the registered MusicXML path', () => {
    const allowlist = new PathAllowlist();
    allowlist.allowMusicXml('/scores/example.musicxml');

    expect(allowlist.assertAllowedReadPath('/scores/example.musicxml.annotation.json')).toBe(
      resolve('/scores/example.musicxml.annotation.json')
    );
  });

  it('rejects an arbitrary unregistered path', () => {
    const allowlist = new PathAllowlist();
    allowlist.allowMusicXml('/scores/example.musicxml');

    expect(() => allowlist.assertAllowedReadPath('/etc/hosts')).toThrow(
      /Refused to read from disallowed path/
    );
  });

  it('rejects an unregistered MusicXML path even if another path is registered', () => {
    const allowlist = new PathAllowlist();
    allowlist.allowMusicXml('/scores/example.musicxml');

    expect(() => allowlist.assertAllowedReadPath('/scores/other.musicxml')).toThrow(
      /Refused to read from disallowed path/
    );
    expect(() =>
      allowlist.assertAllowedReadPath('/scores/other.musicxml.annotation.json')
    ).toThrow(/Refused to read from disallowed path/);
  });

  it('judges the path after resolving traversal segments (../)', () => {
    const allowlist = new PathAllowlist();
    allowlist.allowMusicXml('/scores/sub/example.musicxml');

    // '/scores/sub/../sub/example.musicxml' resolves to the registered path
    expect(
      allowlist.assertAllowedReadPath('/scores/sub/../sub/example.musicxml')
    ).toBe(resolve('/scores/sub/example.musicxml'));

    // '/scores/sub/../secret.musicxml' resolves outside the registered path
    expect(() => allowlist.assertAllowedReadPath('/scores/sub/../secret.musicxml')).toThrow(
      /Refused to read from disallowed path/
    );
  });

  it('rejects every path before any MusicXML has been registered', () => {
    const allowlist = new PathAllowlist();

    expect(() => allowlist.assertAllowedReadPath('/scores/example.musicxml')).toThrow(
      /Refused to read from disallowed path/
    );
    expect(() =>
      allowlist.assertAllowedReadPath('/scores/example.musicxml.annotation.json')
    ).toThrow(/Refused to read from disallowed path/);
  });
});
