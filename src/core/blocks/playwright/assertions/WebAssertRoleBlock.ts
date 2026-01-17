import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element has a specific ARIA role (auto-waits).
 */
export class WebAssertRoleBlock extends StatementBlock {
  readonly type = 'web_assert_role';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element has a specific ARIA role (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'ROLE', type: 'field', fieldType: 'dropdown', required: true, options: [
        ['Button', 'button'],
        ['Checkbox', 'checkbox'],
        ['Combobox', 'combobox'],
        ['Dialog', 'dialog'],
        ['Grid', 'grid'],
        ['Heading', 'heading'],
        ['Link', 'link'],
        ['List', 'list'],
        ['Listbox', 'listbox'],
        ['Listitem', 'listitem'],
        ['Menu', 'menu'],
        ['Menuitem', 'menuitem'],
        ['Navigation', 'navigation'],
        ['Option', 'option'],
        ['Radio', 'radio'],
        ['Region', 'region'],
        ['Row', 'row'],
        ['Searchbox', 'searchbox'],
        ['Slider', 'slider'],
        ['Spinbutton', 'spinbutton'],
        ['Switch', 'switch'],
        ['Tab', 'tab'],
        ['Tablist', 'tablist'],
        ['Tabpanel', 'tabpanel'],
        ['Textbox', 'textbox'],
        ['Tree', 'tree'],
        ['Treeitem', 'treeitem'],
      ] },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const displaySelector = getDisplaySelector(params, context);
    const expectedRole = params.ROLE as string;
    const timeout = getTimeout(context);

    const expect = await getExpect();
    const locator = page.locator(selector);

    context.logger.info(`Asserting ${displaySelector} has role "${expectedRole}"`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toHaveRole(expectedRole, { timeout }); },
      `Expected element ${displaySelector} to have role "${expectedRole}"`,
      { stepType: 'web_assert_role', expected: expectedRole }
    );
    context.logger.info(`✓ Element ${displaySelector} has role "${expectedRole}"`);
    return {
      _summary: `role="${expectedRole}"`,
      selector,
      expectedRole,
    };
  }
}
