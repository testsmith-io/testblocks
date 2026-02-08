/**
 * Dev server entry point.
 * Used by `npm run dev:server` (tsx watch).
 * Reuses the same startServer() as production `testblocks serve`,
 * with dev-appropriate defaults (port 3001, examples directory).
 */

import path from 'path';
import { startServer } from './startServer';

const PORT = parseInt(process.env.PORT || '3001', 10);
const pluginsDir = process.env.PLUGINS_DIR || path.join(process.cwd(), 'examples', 'plugins');
const globalsDir = process.env.GLOBALS_DIR || path.join(process.cwd(), 'examples');

startServer({
  port: PORT,
  pluginsDir,
  globalsDir,
});
