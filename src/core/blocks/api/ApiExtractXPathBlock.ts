import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { getLastResponse, getNodeValue } from '../utils';
import xpath from 'xpath';
import { DOMParser } from 'xmldom';

/**
 * Extract a value from XML/HTML response using XPath expression.
 */
export class ApiExtractXPathBlock extends StatementBlock {
  readonly type = 'api_extract_xpath';
  readonly category = 'API';
  readonly color = '#2196F3';
  readonly tooltip = 'Extract a value from XML/HTML response using XPath expression';

  getInputs(): BlockInput[] {
    return [
      { name: 'XPATH', type: 'field', fieldType: 'text', required: true, default: '//title/text()' },
      { name: 'VARIABLE', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const response = getLastResponse(context);
    const xpathExpr = params.XPATH as string;
    const varName = params.VARIABLE as string;

    try {
      // Ensure body is a string for XML parsing
      const xmlString = typeof response.body === 'string'
        ? response.body
        : JSON.stringify(response.body);

      const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
      const nodes = xpath.select(xpathExpr, doc);

      // Convert nodes to values
      let value: unknown;
      if (Array.isArray(nodes)) {
        if (nodes.length === 0) {
          value = null;
        } else if (nodes.length === 1) {
          value = getNodeValue(nodes[0]);
        } else {
          value = nodes.map(getNodeValue);
        }
      } else {
        value = nodes;
      }

      context.variables.set(varName, value);
      const valueStr = JSON.stringify(value);
      context.logger.info(`Extracted (XPath) ${xpathExpr} → ${varName} = ${valueStr}`);
      return {
        _summary: `${varName} = ${valueStr.substring(0, 50)}${valueStr.length > 50 ? '...' : ''}`,
        variable: varName,
        xpath: xpathExpr,
        value,
      };
    } catch (e) {
      throw new Error(`XPath extraction failed: ${xpathExpr}. Error: ${(e as Error).message}`);
    }
  }
}
