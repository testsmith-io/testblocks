import { Block } from '../../base';
import { BlockDefinition } from '../../../types';

// Visibility & State
export { WebAssertVisibleBlock } from './WebAssertVisibleBlock';
export { WebAssertNotVisibleBlock } from './WebAssertNotVisibleBlock';
export { WebAssertAttachedBlock } from './WebAssertAttachedBlock';
export { WebAssertEnabledBlock } from './WebAssertEnabledBlock';
export { WebAssertDisabledBlock } from './WebAssertDisabledBlock';
export { WebAssertEditableBlock } from './WebAssertEditableBlock';
export { WebAssertEmptyBlock } from './WebAssertEmptyBlock';
export { WebAssertFocusedBlock } from './WebAssertFocusedBlock';
export { WebAssertInViewportBlock } from './WebAssertInViewportBlock';
export { WebAssertCheckedBlock } from './WebAssertCheckedBlock';

// Text & Content
export { WebAssertTextContainsBlock } from './WebAssertTextContainsBlock';
export { WebAssertTextEqualsBlock } from './WebAssertTextEqualsBlock';
export { WebAssertValueBlock } from './WebAssertValueBlock';
export { WebAssertValueContainsBlock } from './WebAssertValueContainsBlock';

// Attributes & Properties
export { WebAssertAttributeBlock } from './WebAssertAttributeBlock';
export { WebAssertClassBlock } from './WebAssertClassBlock';
export { WebAssertCssBlock } from './WebAssertCssBlock';
export { WebAssertIdBlock } from './WebAssertIdBlock';
export { WebAssertCountBlock } from './WebAssertCountBlock';

// Accessibility
export { WebAssertAccessibleNameBlock } from './WebAssertAccessibleNameBlock';
export { WebAssertAccessibleDescriptionBlock } from './WebAssertAccessibleDescriptionBlock';
export { WebAssertRoleBlock } from './WebAssertRoleBlock';

// Page-level
export { WebAssertUrlContainsBlock } from './WebAssertUrlContainsBlock';
export { WebAssertUrlEqualsBlock } from './WebAssertUrlEqualsBlock';
export { WebAssertTitleContainsBlock } from './WebAssertTitleContainsBlock';
export { WebAssertTitleEqualsBlock } from './WebAssertTitleEqualsBlock';

// Imports for array
import { WebAssertVisibleBlock } from './WebAssertVisibleBlock';
import { WebAssertNotVisibleBlock } from './WebAssertNotVisibleBlock';
import { WebAssertAttachedBlock } from './WebAssertAttachedBlock';
import { WebAssertEnabledBlock } from './WebAssertEnabledBlock';
import { WebAssertDisabledBlock } from './WebAssertDisabledBlock';
import { WebAssertEditableBlock } from './WebAssertEditableBlock';
import { WebAssertEmptyBlock } from './WebAssertEmptyBlock';
import { WebAssertFocusedBlock } from './WebAssertFocusedBlock';
import { WebAssertInViewportBlock } from './WebAssertInViewportBlock';
import { WebAssertCheckedBlock } from './WebAssertCheckedBlock';
import { WebAssertTextContainsBlock } from './WebAssertTextContainsBlock';
import { WebAssertTextEqualsBlock } from './WebAssertTextEqualsBlock';
import { WebAssertValueBlock } from './WebAssertValueBlock';
import { WebAssertValueContainsBlock } from './WebAssertValueContainsBlock';
import { WebAssertAttributeBlock } from './WebAssertAttributeBlock';
import { WebAssertClassBlock } from './WebAssertClassBlock';
import { WebAssertCssBlock } from './WebAssertCssBlock';
import { WebAssertIdBlock } from './WebAssertIdBlock';
import { WebAssertCountBlock } from './WebAssertCountBlock';
import { WebAssertAccessibleNameBlock } from './WebAssertAccessibleNameBlock';
import { WebAssertAccessibleDescriptionBlock } from './WebAssertAccessibleDescriptionBlock';
import { WebAssertRoleBlock } from './WebAssertRoleBlock';
import { WebAssertUrlContainsBlock } from './WebAssertUrlContainsBlock';
import { WebAssertUrlEqualsBlock } from './WebAssertUrlEqualsBlock';
import { WebAssertTitleContainsBlock } from './WebAssertTitleContainsBlock';
import { WebAssertTitleEqualsBlock } from './WebAssertTitleEqualsBlock';

/**
 * All assertion block class instances.
 */
export const assertionBlockClasses: Block[] = [
  // Visibility & State
  new WebAssertVisibleBlock(),
  new WebAssertNotVisibleBlock(),
  new WebAssertAttachedBlock(),
  new WebAssertEnabledBlock(),
  new WebAssertDisabledBlock(),
  new WebAssertEditableBlock(),
  new WebAssertEmptyBlock(),
  new WebAssertFocusedBlock(),
  new WebAssertInViewportBlock(),
  new WebAssertCheckedBlock(),
  // Text & Content
  new WebAssertTextContainsBlock(),
  new WebAssertTextEqualsBlock(),
  new WebAssertValueBlock(),
  new WebAssertValueContainsBlock(),
  // Attributes & Properties
  new WebAssertAttributeBlock(),
  new WebAssertClassBlock(),
  new WebAssertCssBlock(),
  new WebAssertIdBlock(),
  new WebAssertCountBlock(),
  // Accessibility
  new WebAssertAccessibleNameBlock(),
  new WebAssertAccessibleDescriptionBlock(),
  new WebAssertRoleBlock(),
  // Page-level
  new WebAssertUrlContainsBlock(),
  new WebAssertUrlEqualsBlock(),
  new WebAssertTitleContainsBlock(),
  new WebAssertTitleEqualsBlock(),
];

/**
 * Assertion blocks as BlockDefinition array for backward compatibility.
 */
export const assertionBlocks: BlockDefinition[] = assertionBlockClasses.map(block => block.toDefinition());
