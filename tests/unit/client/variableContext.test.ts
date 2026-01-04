import { describe, it, expect, beforeEach } from 'vitest';
import {
  setGlobalVariables,
  setFileVariables,
  setEditingMode,
  setProcedureParams,
  setDataColumns,
  getAvailableVariables,
  getVariableSuggestions,
  getContext,
  VariableInfo,
} from '../../../src/client/blockly/variableContext';

describe('Variable Context', () => {
  // Reset context before each test
  beforeEach(() => {
    setGlobalVariables({});
    setFileVariables({});
    setEditingMode('file');
    setProcedureParams([]);
    setDataColumns([]);
  });

  describe('setGlobalVariables', () => {
    it('should set global variables', () => {
      setGlobalVariables({ baseUrl: 'https://api.example.com' });
      const ctx = getContext();
      expect(ctx.globalVariables).toEqual({ baseUrl: 'https://api.example.com' });
    });

    it('should handle null by setting empty object', () => {
      setGlobalVariables({ foo: 'bar' });
      setGlobalVariables(null);
      const ctx = getContext();
      expect(ctx.globalVariables).toEqual({});
    });
  });

  describe('setFileVariables', () => {
    it('should set file variables', () => {
      setFileVariables({ username: 'testuser' });
      const ctx = getContext();
      expect(ctx.fileVariables).toEqual({ username: 'testuser' });
    });

    it('should handle null by setting empty object', () => {
      setFileVariables({ foo: 'bar' });
      setFileVariables(null);
      const ctx = getContext();
      expect(ctx.fileVariables).toEqual({});
    });
  });

  describe('setEditingMode', () => {
    it('should set editing mode to file', () => {
      setEditingMode('file');
      const ctx = getContext();
      expect(ctx.editingMode).toBe('file');
    });

    it('should set editing mode to folder', () => {
      setEditingMode('folder');
      const ctx = getContext();
      expect(ctx.editingMode).toBe('folder');
    });
  });

  describe('setProcedureParams', () => {
    it('should set procedure parameters', () => {
      setProcedureParams(['username', 'password']);
      const ctx = getContext();
      expect(ctx.procedureParams).toEqual(['username', 'password']);
    });
  });

  describe('setDataColumns', () => {
    it('should set data columns', () => {
      setDataColumns(['email', 'firstName', 'lastName']);
      const ctx = getContext();
      expect(ctx.dataColumns).toEqual(['email', 'firstName', 'lastName']);
    });
  });

  describe('getAvailableVariables', () => {
    it('should return global variables with correct scope', () => {
      setGlobalVariables({ apiKey: 'secret123' });
      const vars = getAvailableVariables();

      const apiKeyVar = vars.find(v => v.name === 'apiKey');
      expect(apiKeyVar).toBeDefined();
      expect(apiKeyVar?.scope).toBe('global');
      expect(apiKeyVar?.value).toBe('secret123');
    });

    it('should return file variables when in file mode', () => {
      setEditingMode('file');
      setFileVariables({ localVar: 'localValue' });
      const vars = getAvailableVariables();

      const localVar = vars.find(v => v.name === 'localVar');
      expect(localVar).toBeDefined();
      expect(localVar?.scope).toBe('file');
    });

    it('should NOT return file variables when in folder mode', () => {
      setEditingMode('folder');
      setFileVariables({ localVar: 'localValue' });
      const vars = getAvailableVariables();

      const localVar = vars.find(v => v.name === 'localVar');
      expect(localVar).toBeUndefined();
    });

    it('should return procedure parameters', () => {
      setProcedureParams(['param1', 'param2']);
      const vars = getAvailableVariables();

      const param1 = vars.find(v => v.name === 'param1');
      expect(param1).toBeDefined();
      expect(param1?.scope).toBe('procedure');
    });

    it('should return data columns', () => {
      setDataColumns(['email', 'name']);
      const vars = getAvailableVariables();

      const emailCol = vars.find(v => v.name === 'email');
      expect(emailCol).toBeDefined();
      expect(emailCol?.scope).toBe('test');
    });

    it('should flatten nested global variables', () => {
      setGlobalVariables({
        user: {
          email: 'test@example.com',
          profile: {
            name: 'Test User',
          },
        },
      });
      const vars = getAvailableVariables();

      const emailVar = vars.find(v => v.name === 'user.email');
      expect(emailVar).toBeDefined();
      expect(emailVar?.value).toBe('test@example.com');

      const nameVar = vars.find(v => v.name === 'user.profile.name');
      expect(nameVar).toBeDefined();
      expect(nameVar?.value).toBe('Test User');
    });

    it('should not flatten arrays', () => {
      setGlobalVariables({
        items: ['a', 'b', 'c'],
      });
      const vars = getAvailableVariables();

      const itemsVar = vars.find(v => v.name === 'items');
      expect(itemsVar).toBeDefined();
      expect(itemsVar?.value).toEqual(['a', 'b', 'c']);

      // Should not have items.0, items.1, etc.
      const item0 = vars.find(v => v.name === 'items.0');
      expect(item0).toBeUndefined();
    });

    it('should combine all variable sources', () => {
      setGlobalVariables({ globalVar: 'global' });
      setFileVariables({ fileVar: 'file' });
      setProcedureParams(['procParam']);
      setDataColumns(['dataCol']);
      setEditingMode('file');

      const vars = getAvailableVariables();

      expect(vars.find(v => v.name === 'globalVar')).toBeDefined();
      expect(vars.find(v => v.name === 'fileVar')).toBeDefined();
      expect(vars.find(v => v.name === 'procParam')).toBeDefined();
      expect(vars.find(v => v.name === 'dataCol')).toBeDefined();
    });
  });

  describe('getVariableSuggestions', () => {
    beforeEach(() => {
      setGlobalVariables({
        baseUrl: 'https://api.example.com',
        apiKey: 'secret',
        user: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });
      setFileVariables({
        localEmail: 'local@example.com',
      });
    });

    it('should return all variables when search is empty', () => {
      const suggestions = getVariableSuggestions('');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should filter by partial name match', () => {
      const suggestions = getVariableSuggestions('email');

      expect(suggestions.length).toBe(2); // user.email and localEmail
      expect(suggestions.every(s => s.name.toLowerCase().includes('email'))).toBe(true);
    });

    it('should be case-insensitive', () => {
      const lowerSuggestions = getVariableSuggestions('email');
      const upperSuggestions = getVariableSuggestions('EMAIL');
      const mixedSuggestions = getVariableSuggestions('EmAiL');

      expect(lowerSuggestions.length).toBe(upperSuggestions.length);
      expect(lowerSuggestions.length).toBe(mixedSuggestions.length);
    });

    it('should filter nested variable names', () => {
      const suggestions = getVariableSuggestions('user.');

      expect(suggestions.length).toBe(2); // user.email and user.name
      expect(suggestions.every(s => s.name.startsWith('user.'))).toBe(true);
    });

    it('should return empty array when no matches', () => {
      const suggestions = getVariableSuggestions('nonexistent');
      expect(suggestions).toEqual([]);
    });

    it('should match anywhere in the name', () => {
      const suggestions = getVariableSuggestions('Url');

      const baseUrlVar = suggestions.find(s => s.name === 'baseUrl');
      expect(baseUrlVar).toBeDefined();
    });
  });

  describe('variable descriptions', () => {
    it('should format string values with quotes', () => {
      setGlobalVariables({ name: 'John' });
      const vars = getAvailableVariables();
      const nameVar = vars.find(v => v.name === 'name');
      expect(nameVar?.description).toContain('"John"');
    });

    it('should truncate long string values', () => {
      const longString = 'a'.repeat(50);
      setGlobalVariables({ longValue: longString });
      const vars = getAvailableVariables();
      const longVar = vars.find(v => v.name === 'longValue');
      expect(longVar?.description).toContain('...');
      expect(longVar?.description?.length).toBeLessThan(longString.length + 20);
    });

    it('should format numbers without quotes', () => {
      setGlobalVariables({ count: 42 });
      const vars = getAvailableVariables();
      const countVar = vars.find(v => v.name === 'count');
      expect(countVar?.description).toContain('42');
      expect(countVar?.description).not.toContain('"42"');
    });

    it('should format booleans without quotes', () => {
      setGlobalVariables({ enabled: true });
      const vars = getAvailableVariables();
      const enabledVar = vars.find(v => v.name === 'enabled');
      expect(enabledVar?.description).toContain('true');
    });

    it('should format arrays with item count', () => {
      setGlobalVariables({ items: [1, 2, 3] });
      const vars = getAvailableVariables();
      const itemsVar = vars.find(v => v.name === 'items');
      expect(itemsVar?.description).toContain('[3 items]');
    });

    it('should format null values', () => {
      setGlobalVariables({ nothing: null });
      const vars = getAvailableVariables();
      const nothingVar = vars.find(v => v.name === 'nothing');
      expect(nothingVar?.description).toContain('null');
    });
  });
});
