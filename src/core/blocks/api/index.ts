import { Block } from '../base';
import { BlockDefinition } from '../../types';

// Header management blocks
export { ApiSetHeaderBlock } from './ApiSetHeaderBlock';
export { ApiSetHeadersBlock } from './ApiSetHeadersBlock';
export { ApiClearHeadersBlock } from './ApiClearHeadersBlock';

// HTTP method blocks
export { ApiGetBlock } from './ApiGetBlock';
export { ApiPostBlock } from './ApiPostBlock';
export { ApiPutBlock } from './ApiPutBlock';
export { ApiPatchBlock } from './ApiPatchBlock';
export { ApiDeleteBlock } from './ApiDeleteBlock';

// Assertion blocks
export { ApiAssertStatusBlock } from './ApiAssertStatusBlock';
export { ApiAssertBodyContainsBlock } from './ApiAssertBodyContainsBlock';

// Extraction blocks
export { ApiExtractJsonPathBlock } from './ApiExtractJsonPathBlock';
export { ApiExtractXPathBlock } from './ApiExtractXPathBlock';
export { ApiExtractBlock } from './ApiExtractBlock';

// Value blocks
export { ApiHeadersBlock } from './ApiHeadersBlock';
export { ApiJsonBodyBlock } from './ApiJsonBodyBlock';

// Import all block classes
import { ApiSetHeaderBlock } from './ApiSetHeaderBlock';
import { ApiSetHeadersBlock } from './ApiSetHeadersBlock';
import { ApiClearHeadersBlock } from './ApiClearHeadersBlock';
import { ApiGetBlock } from './ApiGetBlock';
import { ApiPostBlock } from './ApiPostBlock';
import { ApiPutBlock } from './ApiPutBlock';
import { ApiPatchBlock } from './ApiPatchBlock';
import { ApiDeleteBlock } from './ApiDeleteBlock';
import { ApiAssertStatusBlock } from './ApiAssertStatusBlock';
import { ApiAssertBodyContainsBlock } from './ApiAssertBodyContainsBlock';
import { ApiExtractJsonPathBlock } from './ApiExtractJsonPathBlock';
import { ApiExtractXPathBlock } from './ApiExtractXPathBlock';
import { ApiExtractBlock } from './ApiExtractBlock';
import { ApiHeadersBlock } from './ApiHeadersBlock';
import { ApiJsonBodyBlock } from './ApiJsonBodyBlock';

/**
 * All API block class instances.
 */
export const apiBlockClasses: Block[] = [
  // Header management
  new ApiSetHeaderBlock(),
  new ApiSetHeadersBlock(),
  new ApiClearHeadersBlock(),
  // HTTP methods
  new ApiGetBlock(),
  new ApiPostBlock(),
  new ApiPutBlock(),
  new ApiPatchBlock(),
  new ApiDeleteBlock(),
  // Assertions
  new ApiAssertStatusBlock(),
  new ApiAssertBodyContainsBlock(),
  // Extraction
  new ApiExtractJsonPathBlock(),
  new ApiExtractXPathBlock(),
  new ApiExtractBlock(),
  // Value blocks
  new ApiHeadersBlock(),
  new ApiJsonBodyBlock(),
];

/**
 * API blocks as BlockDefinition array for backward compatibility.
 */
export const apiBlocks: BlockDefinition[] = apiBlockClasses.map(block => block.toDefinition());
