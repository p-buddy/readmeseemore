import { describe, it, expect, beforeEach } from 'vitest';
import { getID, getProtocol, tryAppendBlock } from './utils';
import type { Parsed } from '.';

describe(getID.name, () => {
  describe('code nodes', () => {
    it('should return null when meta is undefined', () => {
      const node = { type: 'code' as const, value: '', lang: null };
      expect(getID(node)).toBeNull();
    });

    it('should return null when meta does not contain a hashtag ID', () => {
      const node = { type: 'code' as const, value: '', lang: null, meta: 'no hashtag here' };
      expect(getID(node)).toBeNull();
    });

    it('should extract hashtag ID from meta', () => {
      const node = { type: 'code' as const, value: '', lang: null, meta: 'some text #test-id more text' };
      expect(getID(node)).toBe('test-id');
    });

    it('should handle hashtag ID at start of meta', () => {
      const node = { type: 'code' as const, value: '', lang: null, meta: '#start-id text' };
      expect(getID(node)).toBe('start-id');
    });

    it('should handle hashtag ID at end of meta', () => {
      const node = { type: 'code' as const, value: '', lang: null, meta: 'text #end-id' };
      expect(getID(node)).toBe('end-id');
    });
  });

  describe('heading nodes', () => {
    it('should return null when children array is empty', () => {
      const node = { type: 'heading' as const, children: [], depth: 1 as const };
      expect(getID(node)).toBeNull();
    });

    it('should return null when no text child is found', () => {
      const node = {
        type: 'heading' as const,
        children: [{ type: 'emphasis' as const, children: [] }],
        depth: 1 as const
      };
      expect(getID(node)).toBeNull();
    });

    it('should convert heading text to kebab case', () => {
      const node = {
        type: 'heading' as const,
        children: [{ type: 'text' as const, value: 'Hello World!' }],
        depth: 1 as const
      };
      expect(getID(node)).toBe('hello-world');
    });

    it('should handle special characters and multiple spaces', () => {
      const node = {
        type: 'heading' as const,
        children: [{ type: 'text' as const, value: 'Hello   World@#$%^&*()!' }],
        depth: 1 as const
      };
      expect(getID(node)).toBe('hello-world');
    });

    it('should handle multiple hyphens and trim leading/trailing hyphens', () => {
      const node = {
        type: 'heading' as const,
        children: [{ type: 'text' as const, value: '---Hello---World---' }],
        depth: 1 as const
      };
      expect(getID(node)).toBe('hello-world');
    });
  });
});

describe(getProtocol.name, () => {
  it('should return null when meta is undefined', () => {
    const node = { type: 'code' as const, value: '', lang: null };
    expect(getProtocol(node)).toBeNull();
  });

  it('should return null when meta does not contain a valid protocol', () => {
    const node = { type: 'code' as const, value: '', lang: null, meta: 'invalid://test' };
    expect(getProtocol(node)).toBeNull();
  });

  it('should extract file protocol', () => {
    const node = { type: 'code' as const, value: '', lang: null, meta: 'file://path/to/file' };
    expect(getProtocol(node)).toEqual({ type: 'file', value: 'path/to/file' });
  });

  it('should extract rmsm startup protocol', () => {
    const node = { type: 'code' as const, value: '', lang: null, meta: 'rmsm://startup' };
    expect(getProtocol(node)).toEqual({ type: 'rmsm', value: 'startup' });
  });

  it('should return error for invalid rmsm value', () => {
    const node = { type: 'code' as const, value: '', lang: null, meta: 'rmsm://some/path' };
    expect(getProtocol(node)).toBe('Invalid rmsm protocol value: some/path');
  });

  it('should handle protocol in middle of meta string', () => {
    const node = { type: 'code' as const, value: '', lang: null, meta: 'before file://path/to/file after' };
    expect(getProtocol(node)).toEqual({ type: 'file', value: 'path/to/file' });
  });
});

describe(tryAppendBlock.name, () => {
  let parsed: Parsed;

  beforeEach(() => {
    parsed = { filesystem: {} };
  });

  describe('startup blocks', () => {
    it('should add startup block when none exists', () => {
      const block = {
        type: 'code' as const,
        value: 'npm install',
        lang: 'bash',
        meta: 'rmsm://startup'
      };

      const result = tryAppendBlock(parsed, block);
      expect(result).toBe(true);
      expect(parsed.startup).toBe('npm install');
    });

    it('should return error when multiple startup blocks are provided', () => {
      const block1 = {
        type: 'code' as const,
        value: 'npm install',
        lang: 'bash',
        meta: 'rmsm://startup'
      };
      const block2 = {
        type: 'code' as const,
        value: 'yarn install',
        lang: 'bash',
        meta: 'rmsm://startup'
      };

      tryAppendBlock(parsed, block1);
      const result = tryAppendBlock(parsed, block2);
      expect(result).toBe('Multiple startup blocks provided, using the first one');
      expect(parsed.startup).toBe('npm install');
    });

    it('should return error when startup block is not a bash script', () => {
      const block = {
        type: 'code' as const,
        value: 'console.log("Hello")',
        lang: 'javascript',
        meta: 'rmsm://startup'
      };

      const result = tryAppendBlock(parsed, block);
      expect(result).toBe('Startup blocks must be bash scripts');
      expect(parsed.startup).toBeUndefined();
    });
  });

  describe('file system operations', () => {
    it('should create file in root directory', () => {
      const block = {
        type: 'code' as const,
        value: 'console.log("Hello")',
        lang: 'js',
        meta: 'file://index.js'
      };

      const result = tryAppendBlock(parsed, block);
      expect(result).toBe(true);
      expect(parsed.filesystem).toEqual({
        'index.js': { file: { contents: 'console.log("Hello")' } }
      });
    });

    it('should create file in nested directory', () => {
      const block = {
        type: 'code' as const,
        value: 'body { color: red; }',
        lang: 'css',
        meta: 'file://styles/main.css'
      };

      const result = tryAppendBlock(parsed, block);
      expect(result).toBe(true);
      expect(parsed.filesystem).toEqual({
        'styles': {
          directory: {
            'main.css': { file: { contents: 'body { color: red; }' } }
          }
        }
      });
    });

    it('should handle paths with leading dots and slashes', () => {
      const block = {
        type: 'code' as const,
        value: 'test content',
        lang: 'txt',
        meta: 'file://./././test.txt'
      };

      const result = tryAppendBlock(parsed, block);
      expect(result).toBe(true);
      expect(parsed.filesystem).toEqual({
        'test.txt': { file: { contents: 'test content' } }
      });
    });

    it('should return error when trying to create file in path that exists as file', () => {
      const block1 = {
        type: 'code' as const,
        value: 'file content',
        lang: 'txt',
        meta: 'file://path/to/file.txt'
      };
      const block2 = {
        type: 'code' as const,
        value: 'nested content',
        lang: 'txt',
        meta: 'file://path/to/file.txt/nested.txt'
      };

      tryAppendBlock(parsed, block1);
      const result = tryAppendBlock(parsed, block2);
      expect(result).toBe('path/to/file.txt has already been defined as a file');
    });
  });

  describe('protocol validation', () => {
    it('should return true when no protocol is present', () => {
      const block = {
        type: 'code' as const,
        value: 'some code',
        lang: 'js',
        meta: 'no protocol here'
      };

      const result = tryAppendBlock(parsed, block);
      expect(result).toBe(true);
      expect(parsed.filesystem).toEqual({});
    });

    it('should return error for invalid rmsm protocol value', () => {
      const block = {
        type: 'code' as const,
        value: 'some code',
        lang: 'js',
        meta: 'rmsm://invalid'
      };

      const result = tryAppendBlock(parsed, block);
      expect(result).toBe('Invalid rmsm protocol value: invalid');
    });

    it('should return error for empty file path', () => {
      const block = {
        type: 'code' as const,
        value: 'some code',
        lang: 'js',
        meta: 'file://././.'
      };

      const result = tryAppendBlock(parsed, block);
      expect(result).toBe('Invalid file path');
    });
  });
});
