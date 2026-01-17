import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, resolveSelector, getTimeout } from '../utils';

/**
 * Upload a file to a file input element (auto-waits).
 */
export class WebUploadFileBlock extends StatementBlock {
  readonly type = 'web_upload_file';
  readonly category = 'Web';
  readonly color = '#E91E63';
  readonly tooltip = 'Upload a file to a file input element (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'FILE_PATH', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const filePath = resolveVariables(params.FILE_PATH as string, context);
    const timeout = getTimeout(context);

    context.logger.info(`Uploading file "${filePath}" to ${selector}`);
    await page.locator(selector).setInputFiles(filePath, { timeout });

    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    return {
      _summary: `${params.SELECTOR} <- "${fileName}"`,
      selector,
      filePath,
      fileName,
    };
  }
}
