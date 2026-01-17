import { ContainerBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * A data-driven test case that runs for each row of data (CSV format).
 */
export class TestCaseDataDrivenBlock extends ContainerBlock {
  readonly type = 'test_case_data_driven';
  readonly category = 'Tests';
  readonly color = '#1565C0';
  readonly tooltip = 'A data-driven test case that runs for each row of data (CSV format: header row, then data rows)';

  getInputs(): BlockInput[] {
    return [
      { name: 'NAME', type: 'field', fieldType: 'text', default: 'Data-Driven Test' },
      { name: 'SOFT_ASSERTIONS', type: 'field', fieldType: 'checkbox', default: false },
      { name: 'DATA', type: 'field', fieldType: 'multiline', default: 'username,password,expected\nuser1,pass1,true\nuser2,pass2,false' },
      { name: 'STEPS', type: 'statement' },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    // Marker block - actual data parsing and execution handled by executor
    const csvData = params.DATA as string;
    const rows = csvData.trim().split('\n').map(row => row.split(',').map(cell => cell.trim()));

    if (rows.length < 2) {
      return { testCase: true, name: params.NAME, softAssertions: params.SOFT_ASSERTIONS, dataDriven: true, data: [], statement: 'STEPS' };
    }

    const headers = rows[0];
    const data = rows.slice(1).map((row, index) => {
      const values: Record<string, unknown> = {};
      headers.forEach((header, i) => {
        let value: unknown = row[i] || '';
        // Try to parse as boolean or number
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(Number(value)) && value !== '') value = Number(value);
        values[header] = value;
      });
      return { name: `Row ${index + 1}`, values };
    });

    return { testCase: true, name: params.NAME, softAssertions: params.SOFT_ASSERTIONS, dataDriven: true, data, statement: 'STEPS' };
  }

  /**
   * Custom Blockly JSON for test_case_data_driven with multi-message layout.
   */
  toBlocklyJson(): Record<string, unknown> {
    return {
      type: this.type,
      colour: this.color,
      tooltip: this.tooltip || '',
      helpUrl: this.helpUrl || '',
      message0: 'Data-Driven Test %1 %2',
      args0: [
        {
          type: 'field_input_autocomplete',
          name: 'NAME',
          text: 'Data-Driven Test',
        },
        {
          type: 'field_checkbox',
          name: 'SOFT_ASSERTIONS',
          checked: false,
        },
      ],
      message1: 'Data %1',
      args1: [
        {
          type: 'field_multiline_autocomplete',
          name: 'DATA',
          text: 'username,password,expected\nuser1,pass1,true\nuser2,pass2,false',
          spellcheck: false,
        },
      ],
      message2: '%1',
      args2: [
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
