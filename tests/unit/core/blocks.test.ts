import { describe, it, expect, beforeEach } from 'vitest';
import {
  blockRegistry,
  registerBlock,
  registerBlocks,
  getBlock,
  getAllBlocks,
  getBlocksByCategory,
  getCategories,
  builtInBlocks,
} from '../../../src/core/blocks';

describe('Block Registry', () => {
  // Note: We can't easily reset the blockRegistry between tests since it's initialized
  // with built-in blocks on module load. Tests should account for built-in blocks.

  describe('builtInBlocks', () => {
    it('should have built-in blocks loaded', () => {
      expect(builtInBlocks.length).toBeGreaterThan(0);
    });

    it('should include API blocks', () => {
      const apiBlock = builtInBlocks.find(b => b.type === 'api_get');
      expect(apiBlock).toBeDefined();
      expect(apiBlock?.category).toBe('API');
    });

    it('should include Playwright blocks', () => {
      const webBlock = builtInBlocks.find(b => b.type === 'web_navigate');
      expect(webBlock).toBeDefined();
    });

    it('should include Logic blocks', () => {
      const logicBlock = builtInBlocks.find(b => b.type === 'logic_set_variable');
      expect(logicBlock).toBeDefined();
      expect(logicBlock?.category).toBe('Logic');
    });
  });

  describe('blockRegistry', () => {
    it('should be initialized with built-in blocks', () => {
      expect(blockRegistry.size).toBeGreaterThan(0);
    });

    it('should contain all built-in block types', () => {
      for (const block of builtInBlocks) {
        expect(blockRegistry.has(block.type)).toBe(true);
      }
    });
  });

  describe('registerBlock', () => {
    it('should register a custom block', () => {
      const customBlock = {
        type: 'test_custom_block_1',
        category: 'Test',
        inputs: [],
        execute: async () => {},
      };

      registerBlock(customBlock);

      expect(getBlock('test_custom_block_1')).toBe(customBlock);
    });

    it('should overwrite existing block with same type', () => {
      const block1 = {
        type: 'test_overwrite_block',
        category: 'Test1',
        inputs: [],
        execute: async () => {},
      };
      const block2 = {
        type: 'test_overwrite_block',
        category: 'Test2',
        inputs: [],
        execute: async () => {},
      };

      registerBlock(block1);
      registerBlock(block2);

      expect(getBlock('test_overwrite_block')?.category).toBe('Test2');
    });
  });

  describe('registerBlocks', () => {
    it('should register multiple blocks at once', () => {
      const blocks = [
        { type: 'test_multi_1', category: 'Multi', inputs: [], execute: async () => {} },
        { type: 'test_multi_2', category: 'Multi', inputs: [], execute: async () => {} },
        { type: 'test_multi_3', category: 'Multi', inputs: [], execute: async () => {} },
      ];

      registerBlocks(blocks);

      expect(getBlock('test_multi_1')).toBeDefined();
      expect(getBlock('test_multi_2')).toBeDefined();
      expect(getBlock('test_multi_3')).toBeDefined();
    });
  });

  describe('getBlock', () => {
    it('should return undefined for non-existent block', () => {
      expect(getBlock('definitely_not_a_block_type')).toBeUndefined();
    });

    it('should return built-in block by type', () => {
      const block = getBlock('api_get');
      expect(block).toBeDefined();
      expect(block?.type).toBe('api_get');
    });
  });

  describe('getAllBlocks', () => {
    it('should return all registered blocks', () => {
      const allBlocks = getAllBlocks();
      expect(allBlocks.length).toBeGreaterThanOrEqual(builtInBlocks.length);
    });

    it('should return blocks as an array', () => {
      const allBlocks = getAllBlocks();
      expect(Array.isArray(allBlocks)).toBe(true);
    });
  });

  describe('getBlocksByCategory', () => {
    it('should return blocks filtered by category', () => {
      const apiBlocks = getBlocksByCategory('API');
      expect(apiBlocks.length).toBeGreaterThan(0);
      expect(apiBlocks.every(b => b.category === 'API')).toBe(true);
    });

    it('should return empty array for non-existent category', () => {
      const blocks = getBlocksByCategory('NonExistentCategory12345');
      expect(blocks).toEqual([]);
    });

    it('should return Logic blocks', () => {
      const logicBlocks = getBlocksByCategory('Logic');
      expect(logicBlocks.length).toBeGreaterThan(0);
    });
  });

  describe('getCategories', () => {
    it('should return unique categories', () => {
      const categories = getCategories();
      const uniqueCategories = [...new Set(categories)];
      expect(categories.length).toBe(uniqueCategories.length);
    });

    it('should include expected categories', () => {
      const categories = getCategories();
      expect(categories).toContain('API');
      expect(categories).toContain('Logic');
    });

    it('should return categories as an array', () => {
      const categories = getCategories();
      expect(Array.isArray(categories)).toBe(true);
    });
  });
});
