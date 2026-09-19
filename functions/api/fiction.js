import * as engine from '../_lib/fiction-engine.js';
import { createFictionHandler } from '../_lib/fiction-service.js';

export const onRequest = createFictionHandler(engine);
