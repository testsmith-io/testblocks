/**
 * Custom Blockly text input field with variable autocomplete.
 * Shows suggestions when user types `${` and allows selecting variables.
 */

import * as Blockly from 'blockly';
import { getVariableSuggestions, resolveVariableReferences, VariableInfo } from './variableContext';

// Scope colors for visual distinction
const scopeColors: Record<string, string> = {
  global: '#4CAF50',    // Green
  file: '#2196F3',      // Blue
  folder: '#9C27B0',    // Purple
  test: '#FF9800',      // Orange
  procedure: '#607D8B', // Gray
};

// Shared tooltip element for all fields
let tooltipDiv: HTMLDivElement | null = null;
let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;

function getTooltipElement(): HTMLDivElement {
  if (!tooltipDiv) {
    tooltipDiv = document.createElement('div');
    tooltipDiv.className = 'blockly-variable-tooltip';
    tooltipDiv.style.cssText = `
      position: fixed;
      background: #1e1e2e;
      color: #cdd6f4;
      border: 1px solid #45475a;
      border-radius: 6px;
      padding: 6px 10px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10001;
      pointer-events: none;
      display: none;
      max-width: 400px;
      white-space: pre-wrap;
      word-break: break-all;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(tooltipDiv);
  }
  return tooltipDiv;
}

const tooltipScopeColors: Record<string, string> = {
  global: '#a6e3a1',
  file: '#89b4fa',
  procedure: '#cba6f7',
  test: '#fab387',
};

function showVariableTooltip(text: string, x: number, y: number): void {
  const refs = resolveVariableReferences(text);
  if (refs.length === 0) return;

  const tip = getTooltipElement();
  tip.innerHTML = refs.map(r => {
    const scopeLabel = r.scope ? `<span style="color:${tooltipScopeColors[r.scope] || '#9399b2'};font-size:10px">[${r.scope}]</span> ` : '';
    return `${scopeLabel}<span style="color:#89b4fa">\${${r.name}}</span> = <span style="color:#a6e3a1">${r.value}</span>`;
  }).join('\n');
  tip.style.left = `${x}px`;
  tip.style.top = `${y + 8}px`;
  tip.style.display = 'block';
}

function hideVariableTooltip(): void {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
  const tip = getTooltipElement();
  tip.style.display = 'none';
}

export class FieldTextInputWithAutocomplete extends Blockly.FieldTextInput {
  private autocompleteDiv: HTMLDivElement | null = null;
  private selectedIndex = -1;
  private suggestions: VariableInfo[] = [];
  private isAutocompleteVisible = false;
  private boundMouseEnter: ((e: MouseEvent) => void) | null = null;
  private boundMouseLeave: (() => void) | null = null;

  constructor(value?: string, validator?: Blockly.FieldTextInputValidator) {
    super(value, validator);
  }

  /**
   * Attach hover tooltip for variable references on the SVG field element.
   */
  initView(): void {
    super.initView();

    const fieldGroup = this.fieldGroup_;
    if (!fieldGroup) return;

    this.boundMouseEnter = (e: MouseEvent) => {
      const text = this.getValue();
      if (text && /\$\{[\w.]+\}/.test(text)) {
        tooltipTimeout = setTimeout(() => {
          showVariableTooltip(text, e.clientX, e.clientY);
        }, 400);
      }
    };
    this.boundMouseLeave = () => {
      hideVariableTooltip();
    };

    fieldGroup.addEventListener('mouseenter', this.boundMouseEnter);
    fieldGroup.addEventListener('mouseleave', this.boundMouseLeave);
  }

  /**
   * Create the field's editor widget.
   */
  protected showEditor_(e?: Event, quietInput?: boolean): void {
    hideVariableTooltip();
    super.showEditor_(e, quietInput);

    // Get the HTML input element
    const htmlInput = this.htmlInput_ as HTMLInputElement;
    if (!htmlInput) return;

    // Add event listeners for autocomplete
    htmlInput.addEventListener('input', this.handleInput.bind(this));
    htmlInput.addEventListener('keydown', this.handleKeyDown.bind(this));
    htmlInput.addEventListener('blur', this.handleBlur.bind(this));

    // Create autocomplete dropdown container
    this.createAutocompleteDropdown();
  }

  /**
   * Create the autocomplete dropdown element
   */
  private createAutocompleteDropdown(): void {
    if (this.autocompleteDiv) return;

    this.autocompleteDiv = document.createElement('div');
    this.autocompleteDiv.className = 'blockly-autocomplete-dropdown';
    this.autocompleteDiv.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      max-height: 200px;
      overflow-y: auto;
      z-index: 10000;
      display: none;
      min-width: 200px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
    `;

    document.body.appendChild(this.autocompleteDiv);
  }

  /**
   * Handle input changes to detect `${` pattern
   */
  private handleInput(): void {
    const htmlInput = this.htmlInput_ as HTMLInputElement;
    if (!htmlInput) return;

    const value = htmlInput.value;
    const cursorPos = htmlInput.selectionStart || 0;

    // Find the last `${` before cursor
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastDollarBrace = textBeforeCursor.lastIndexOf('${');

    if (lastDollarBrace !== -1) {
      // Check if there's a closing `}` between `${` and cursor
      const textAfterDollar = textBeforeCursor.substring(lastDollarBrace);
      if (!textAfterDollar.includes('}')) {
        // Extract the partial variable name typed after `${`
        const partialVar = textAfterDollar.substring(2); // Remove `${`
        this.showAutocomplete(partialVar);
        return;
      }
    }

    this.hideAutocomplete();
  }

  /**
   * Show the autocomplete dropdown with filtered suggestions
   */
  private showAutocomplete(searchText: string): void {
    if (!this.autocompleteDiv || !this.htmlInput_) return;

    this.suggestions = getVariableSuggestions(searchText);

    if (this.suggestions.length === 0) {
      this.hideAutocomplete();
      return;
    }

    // Build dropdown content
    this.autocompleteDiv.innerHTML = '';
    this.selectedIndex = -1;

    this.suggestions.forEach((variable, index) => {
      const item = document.createElement('div');
      item.className = 'blockly-autocomplete-item';
      item.style.cssText = `
        padding: 6px 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom: 1px solid #eee;
      `;

      // Scope badge
      const scopeBadge = document.createElement('span');
      scopeBadge.style.cssText = `
        background: ${scopeColors[variable.scope] || '#999'};
        color: white;
        padding: 1px 6px;
        border-radius: 3px;
        font-size: 10px;
        text-transform: uppercase;
        flex-shrink: 0;
      `;
      scopeBadge.textContent = variable.scope.charAt(0).toUpperCase();
      item.appendChild(scopeBadge);

      // Variable name
      const nameSpan = document.createElement('span');
      nameSpan.style.cssText = 'font-weight: 500; flex: 1;';
      nameSpan.textContent = variable.name;
      item.appendChild(nameSpan);

      // Description/value preview
      if (variable.description) {
        const descSpan = document.createElement('span');
        descSpan.style.cssText = 'color: #888; font-size: 11px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        descSpan.textContent = variable.description.replace(/^(Global|File|Folder|Test|Procedure): /, '');
        item.appendChild(descSpan);
      }

      // Hover effect
      item.addEventListener('mouseenter', () => {
        this.setSelectedIndex(index);
      });

      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent blur before selection
        this.selectSuggestion(index);
      });

      this.autocompleteDiv.appendChild(item);
    });

    // Position the dropdown below the input
    const inputRect = (this.htmlInput_ as HTMLElement).getBoundingClientRect();
    this.autocompleteDiv.style.left = `${inputRect.left}px`;
    this.autocompleteDiv.style.top = `${inputRect.bottom + 2}px`;
    this.autocompleteDiv.style.minWidth = `${Math.max(inputRect.width, 200)}px`;
    this.autocompleteDiv.style.display = 'block';

    this.isAutocompleteVisible = true;
  }

  /**
   * Hide the autocomplete dropdown
   */
  private hideAutocomplete(): void {
    if (this.autocompleteDiv) {
      this.autocompleteDiv.style.display = 'none';
    }
    this.isAutocompleteVisible = false;
    this.selectedIndex = -1;
    this.suggestions = [];
  }

  /**
   * Set the selected index and update visual highlight
   */
  private setSelectedIndex(index: number): void {
    if (!this.autocompleteDiv) return;

    // Remove previous highlight
    const items = this.autocompleteDiv.querySelectorAll('.blockly-autocomplete-item');
    items.forEach((item, i) => {
      (item as HTMLElement).style.background = i === index ? '#e3f2fd' : 'white';
    });

    this.selectedIndex = index;
  }

  /**
   * Handle keyboard navigation in autocomplete
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isAutocompleteVisible) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.setSelectedIndex(
          this.selectedIndex < this.suggestions.length - 1
            ? this.selectedIndex + 1
            : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.setSelectedIndex(
          this.selectedIndex > 0
            ? this.selectedIndex - 1
            : this.suggestions.length - 1
        );
        break;

      case 'Enter':
      case 'Tab':
        if (this.selectedIndex >= 0) {
          e.preventDefault();
          this.selectSuggestion(this.selectedIndex);
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.hideAutocomplete();
        break;
    }
  }

  /**
   * Select a suggestion and insert it into the input
   */
  private selectSuggestion(index: number): void {
    const htmlInput = this.htmlInput_ as HTMLInputElement;
    if (!htmlInput || index < 0 || index >= this.suggestions.length) return;

    const variable = this.suggestions[index];
    const value = htmlInput.value;
    const cursorPos = htmlInput.selectionStart || 0;

    // Find the `${` that triggered autocomplete
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastDollarBrace = textBeforeCursor.lastIndexOf('${');

    if (lastDollarBrace !== -1) {
      // Replace from `${` to cursor with the complete variable reference
      const newValue =
        value.substring(0, lastDollarBrace) +
        '${' + variable.name + '}' +
        value.substring(cursorPos);

      htmlInput.value = newValue;

      // Position cursor after the inserted variable
      const newCursorPos = lastDollarBrace + variable.name.length + 3; // `${` + name + `}`
      htmlInput.setSelectionRange(newCursorPos, newCursorPos);

      // Trigger input event to update Blockly
      htmlInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    this.hideAutocomplete();
  }

  /**
   * Handle blur to hide autocomplete
   */
  private handleBlur(): void {
    // Small delay to allow click events on dropdown items
    setTimeout(() => {
      this.hideAutocomplete();
    }, 150);
  }

  /**
   * Dispose of the field and clean up
   */
  dispose(): void {
    const fieldGroup = this.fieldGroup_;
    if (fieldGroup) {
      if (this.boundMouseEnter) fieldGroup.removeEventListener('mouseenter', this.boundMouseEnter);
      if (this.boundMouseLeave) fieldGroup.removeEventListener('mouseleave', this.boundMouseLeave);
    }
    hideVariableTooltip();
    if (this.autocompleteDiv) {
      this.autocompleteDiv.remove();
      this.autocompleteDiv = null;
    }
    super.dispose();
  }

  /**
   * Construct a FieldTextInputWithAutocomplete from a JSON arg object.
   */
  static fromJson(options: Record<string, unknown>): FieldTextInputWithAutocomplete {
    const text = options['text'] as string | undefined;
    return new FieldTextInputWithAutocomplete(text ?? '');
  }
}

// Register the field type
Blockly.fieldRegistry.register('field_input_autocomplete', FieldTextInputWithAutocomplete);
