import { ContainerBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * A test case containing steps to execute.
 */
export class TestCaseBlock extends ContainerBlock {
  readonly type = 'test_case';
  readonly category = 'Tests';
  readonly color = '#1E88E5';
  readonly tooltip = 'A test case containing steps to execute';

  getInputs(): BlockInput[] {
    return [
      { name: 'NAME', type: 'field', fieldType: 'multiline', default: 'Test Case' },
      { name: 'SOFT_ASSERTIONS', type: 'field', fieldType: 'checkbox', default: false },
      { name: 'STEPS', type: 'statement' },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    // Marker block - steps are executed by the executor
    return { testCase: true, name: params.NAME, softAssertions: params.SOFT_ASSERTIONS, statement: 'STEPS' };
  }

  /**
   * Custom Blockly JSON for test_case with multi-message layout.
   */
  toBlocklyJson(): Record<string, unknown> {
    return {
      type: this.type,
      colour: this.color,
      tooltip: this.tooltip || '',
      helpUrl: this.helpUrl || '',
      message0: 'Test %1 %2',
      args0: [
        {
          type: 'field_multiline_autocomplete',
          name: 'NAME',
          text: 'Test Case',
          spellcheck: false,
        },
        {
          type: 'field_checkbox',
          name: 'SOFT_ASSERTIONS',
          checked: false,
        },
      ],
      message1: '%1',
      args1: [
        {
          type: 'input_statement',
          name: 'STEPS',
        },
      ],
    };
  }

  /**
   * Custom init extension to add tooltip to soft assertions checkbox.
   */
  getBlocklyInitExtension(): (() => void) | undefined {
    return function(this: unknown) {
      const block = this as { getField: (name: string) => { setTooltip: (tooltip: string) => void } | null };
      const softAssertionsField = block.getField('SOFT_ASSERTIONS');
      if (softAssertionsField) {
        softAssertionsField.setTooltip('Soft Assertions - continue test on assertion failure');
      }
    };
  }
}
