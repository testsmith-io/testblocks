import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getTimeout } from '../utils';

/**
 * Drag an element and drop it onto another element (auto-waits).
 */
export class WebDragAndDropBlock extends StatementBlock {
  readonly type = 'web_drag_and_drop';
  readonly category = 'Web';
  readonly color = '#E91E63';
  readonly tooltip = 'Drag an element and drop it onto another element (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'TARGET', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const sourceSelector = resolveSelector(params, context);
    const targetSelector = resolveSelector({ SELECTOR: params.TARGET }, context);
    const timeout = getTimeout(context);

    context.logger.info(`Dragging ${sourceSelector} to ${targetSelector}`);
    await page.locator(sourceSelector).dragTo(page.locator(targetSelector), { timeout });

    return {
      _summary: `${params.SELECTOR} → ${params.TARGET}`,
      sourceSelector,
      targetSelector,
    };
  }
}
