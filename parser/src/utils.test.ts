import { describe, test, expect } from 'vitest';
import { type CodeBlock, type Heading, getID, getProtocol } from './utils';

export const code = ({ value, lang, meta }: Pick<CodeBlock, "value" | "lang" | "meta">): CodeBlock =>
  ({ type: "code", value, lang, meta });

export const heading = ({ depth, text }: { depth?: Heading["depth"], text?: string }, includeNonTextChildren = false): Heading =>
({
  type: "heading",
  depth: depth ?? 1,
  children: text
    ? [{ type: "text", value: text }]
    : includeNonTextChildren
      ? [{ type: 'emphasis' as const, children: [] }]
      : []
})

describe(getID.name, () => {
  describe('code nodes', () => {
    test('should return null when meta is undefined', () => {
      expect(getID(code({ value: '' }))).toBeNull();
    });

    test('should return null when meta does not contain a hashtag ID', () => {
      expect(getID(code({ value: '', meta: 'no hashtag here' }))).toBeNull();
    });

    test('should extract hashtag ID from meta', () => {
      expect(getID(code({ value: '', meta: 'some text #test-id more text' }))).toBe('test-id');
    });

    test('should handle hashtag ID at start of meta', () => {
      expect(getID(code({ value: '', meta: '#start-id text' }))).toBe('start-id');
    });

    test('should handle hashtag ID at end of meta', () => {
      expect(getID(code({ value: '', meta: 'text #end-id' }))).toBe('end-id');
    });
  });

  describe('heading nodes', () => {
    test('should return null when children array is empty', () => {
      expect(getID(heading({}))).toBeNull();
    });

    test('should return null when no text child is found', () => {
      expect(getID(heading({}, true))).toBeNull();
    });

    test('should convert heading text to kebab case', () => {
      expect(getID(heading({ text: 'Hello World!' }))).toBe('hello-world');
    });

    test('should handle special characters and multiple spaces', () => {
      expect(getID(heading({ text: 'Hello   World@#$%^&*()!' }))).toBe('hello-world');
    });

    test('should handle multiple hyphens and trim leading/trailing hyphens', () => {
      expect(getID(heading({ text: '---Hello---World---' }))).toBe('hello-world');
    });

    test('dummy', () => {
      console.log(getID(heading({ text: 'package.json' })));
    })
  });
});

describe(getProtocol.name, () => {
  test('should return null when meta is undefined', () => {
    expect(getProtocol(code({ value: '', lang: null }))).toBeNull();
  });

  test('should return null when meta does not contain a valid protocol', () => {
    expect(getProtocol(code({ value: '', lang: null, meta: 'invalid://test' }))).toBeNull();
  });

  test('should extract file protocol', () => {
    expect(getProtocol(code({ value: '', lang: null, meta: 'file://path/to/file' }))).toEqual({ type: 'file', value: 'path/to/file' });
  });

  test('should extract rmsm startup protocol', () => {
    expect(getProtocol(code({ value: '', lang: null, meta: 'rmsm://startup' }))).toEqual({ type: 'rmsm', value: 'startup' });
  });

  test('should return error for invalid rmsm value', () => {
    expect(getProtocol(code({ value: '', lang: null, meta: 'rmsm://some/path' }))).toEqual({ error: 'Invalid rmsm protocol value: some/path' });
  });

  test('should handle protocol in middle of meta string', () => {
    expect(getProtocol(code({ value: '', lang: null, meta: 'before file://path/to/file after' }))).toEqual({ type: 'file', value: 'path/to/file' });
  });
});
