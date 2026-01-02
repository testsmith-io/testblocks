import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerPlugin,
  getPlugin,
  getAllPlugins,
  getAllPluginBlocks,
  unregisterPlugin,
  createPlugin,
  createBlock,
  createActionBlock,
  createValueBlock,
  createAssertionBlock,
  Plugin,
  BlockDefinition,
} from '../../../src/core/plugins';

// Mock the blocks module to avoid side effects
vi.mock('../../../src/core/blocks', () => ({
  registerBlocks: vi.fn(),
}));

describe('Plugin System', () => {
  beforeEach(() => {
    // Clear all plugins before each test
    for (const plugin of getAllPlugins()) {
      unregisterPlugin(plugin.name);
    }
  });

  describe('createPlugin', () => {
    it('should create a plugin with required fields', () => {
      const plugin = createPlugin({
        name: 'test-plugin',
        version: '1.0.0',
      });

      expect(plugin.name).toBe('test-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.blocks).toEqual([]);
    });

    it('should create a plugin with optional fields', () => {
      const mockBlock: BlockDefinition = {
        type: 'test_block',
        category: 'Test',
        inputs: [],
        execute: async () => {},
      };

      const plugin = createPlugin({
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        blocks: [mockBlock],
      });

      expect(plugin.description).toBe('A test plugin');
      expect(plugin.blocks).toHaveLength(1);
      expect(plugin.blocks[0].type).toBe('test_block');
    });
  });

  describe('registerPlugin', () => {
    it('should register a plugin successfully', () => {
      const plugin = createPlugin({
        name: 'my-plugin',
        version: '1.0.0',
      });

      registerPlugin(plugin);

      expect(getPlugin('my-plugin')).toBe(plugin);
    });

    it('should overwrite existing plugin with same name', () => {
      const plugin1 = createPlugin({
        name: 'duplicate-plugin',
        version: '1.0.0',
      });
      const plugin2 = createPlugin({
        name: 'duplicate-plugin',
        version: '2.0.0',
      });

      registerPlugin(plugin1);
      registerPlugin(plugin2);

      const retrieved = getPlugin('duplicate-plugin');
      expect(retrieved?.version).toBe('2.0.0');
    });
  });

  describe('getPlugin', () => {
    it('should return undefined for non-existent plugin', () => {
      expect(getPlugin('non-existent')).toBeUndefined();
    });

    it('should return registered plugin', () => {
      const plugin = createPlugin({
        name: 'get-test',
        version: '1.0.0',
      });

      registerPlugin(plugin);
      expect(getPlugin('get-test')).toBe(plugin);
    });
  });

  describe('getAllPlugins', () => {
    it('should return empty array when no plugins registered', () => {
      expect(getAllPlugins()).toEqual([]);
    });

    it('should return all registered plugins', () => {
      const plugin1 = createPlugin({ name: 'plugin1', version: '1.0.0' });
      const plugin2 = createPlugin({ name: 'plugin2', version: '1.0.0' });

      registerPlugin(plugin1);
      registerPlugin(plugin2);

      const plugins = getAllPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins).toContain(plugin1);
      expect(plugins).toContain(plugin2);
    });
  });

  describe('getAllPluginBlocks', () => {
    it('should return empty array when no plugins have blocks', () => {
      const plugin = createPlugin({ name: 'no-blocks', version: '1.0.0' });
      registerPlugin(plugin);

      expect(getAllPluginBlocks()).toEqual([]);
    });

    it('should return all blocks from all plugins', () => {
      const block1: BlockDefinition = {
        type: 'block1',
        category: 'Test',
        inputs: [],
        execute: async () => {},
      };
      const block2: BlockDefinition = {
        type: 'block2',
        category: 'Test',
        inputs: [],
        execute: async () => {},
      };

      const plugin1 = createPlugin({
        name: 'plugin1',
        version: '1.0.0',
        blocks: [block1],
      });
      const plugin2 = createPlugin({
        name: 'plugin2',
        version: '1.0.0',
        blocks: [block2],
      });

      registerPlugin(plugin1);
      registerPlugin(plugin2);

      const blocks = getAllPluginBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks.map(b => b.type)).toContain('block1');
      expect(blocks.map(b => b.type)).toContain('block2');
    });
  });

  describe('unregisterPlugin', () => {
    it('should return false for non-existent plugin', () => {
      expect(unregisterPlugin('non-existent')).toBe(false);
    });

    it('should remove and return true for existing plugin', () => {
      const plugin = createPlugin({ name: 'to-remove', version: '1.0.0' });
      registerPlugin(plugin);

      expect(unregisterPlugin('to-remove')).toBe(true);
      expect(getPlugin('to-remove')).toBeUndefined();
    });
  });

  describe('createBlock', () => {
    it('should create a block with required fields', () => {
      const block = createBlock({
        type: 'custom_block',
        category: 'Custom',
        inputs: [{ name: 'VALUE', type: 'string' }],
        execute: async () => 'result',
      });

      expect(block.type).toBe('custom_block');
      expect(block.category).toBe('Custom');
      expect(block.inputs).toHaveLength(1);
      expect(block.color).toBe('#607D8B'); // default color
    });

    it('should create a block with custom color and tooltip', () => {
      const block = createBlock({
        type: 'colored_block',
        category: 'Custom',
        color: '#FF0000',
        tooltip: 'A custom tooltip',
        inputs: [],
        execute: async () => {},
      });

      expect(block.color).toBe('#FF0000');
      expect(block.tooltip).toBe('A custom tooltip');
    });

    it('should set previousStatement and nextStatement', () => {
      const block = createBlock({
        type: 'chainable',
        category: 'Custom',
        inputs: [],
        previousStatement: true,
        nextStatement: true,
        execute: async () => {},
      });

      expect(block.previousStatement).toBe(true);
      expect(block.nextStatement).toBe(true);
    });
  });

  describe('createActionBlock', () => {
    it('should create an action block with statement connections', () => {
      const block = createActionBlock({
        type: 'action_block',
        category: 'Actions',
        inputs: [],
        execute: async () => {},
      });

      expect(block.type).toBe('action_block');
      expect(block.previousStatement).toBe(true);
      expect(block.nextStatement).toBe(true);
    });
  });

  describe('createValueBlock', () => {
    it('should create a value block with output', () => {
      const block = createValueBlock({
        type: 'value_block',
        category: 'Values',
        inputs: [],
        outputType: 'String',
        execute: async () => 'value',
      });

      expect(block.type).toBe('value_block');
      expect(block.output).toEqual({ type: 'String' });
      expect(block.previousStatement).toBe(false);
      expect(block.nextStatement).toBe(false);
    });

    it('should support array output types', () => {
      const block = createValueBlock({
        type: 'multi_type',
        category: 'Values',
        inputs: [],
        outputType: ['String', 'Number'],
        execute: async () => 'value',
      });

      expect(block.output).toEqual({ type: ['String', 'Number'] });
    });
  });

  describe('createAssertionBlock', () => {
    it('should create an assertion block with statement connections', () => {
      const block = createAssertionBlock({
        type: 'assert_block',
        inputs: [],
        assert: async () => ({ pass: true }),
      });

      expect(block.type).toBe('assert_block');
      expect(block.category).toBe('Assertions');
      expect(block.color).toBe('#E91E63');
      expect(block.previousStatement).toBe(true);
      expect(block.nextStatement).toBe(true);
    });

    it('should throw error when assertion fails', async () => {
      const block = createAssertionBlock({
        type: 'failing_assert',
        inputs: [],
        assert: async () => ({ pass: false, message: 'Expected value to be true' }),
      });

      const mockContext = {
        logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
        variables: {},
        testCase: { id: 'test', name: 'test', steps: [] },
        testFile: { name: 'test', testCases: [] },
      };

      await expect(block.execute!({}, mockContext as any)).rejects.toThrow('Expected value to be true');
    });

    it('should log success when assertion passes', async () => {
      const block = createAssertionBlock({
        type: 'passing_assert',
        tooltip: 'Check value',
        inputs: [],
        assert: async () => ({ pass: true }),
      });

      const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
      const mockContext = {
        logger: mockLogger,
        variables: {},
        testCase: { id: 'test', name: 'test', steps: [] },
        testFile: { name: 'test', testCases: [] },
      };

      await block.execute!({}, mockContext as any);

      expect(mockLogger.info).toHaveBeenCalledWith('✓ Check value');
    });
  });
});
