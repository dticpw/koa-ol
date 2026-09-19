import * as engine from '../_lib/fiction-lab-engine.js';
import { createFictionHandler } from '../_lib/fiction-service.js';
import { resolveLabTurn } from '../_lib/fiction-lab-host.js';
export const onRequest = createFictionHandler(engine, {gameKind:'lab',cookieName:'koa_fiction_lab',cookiePath:'/api/fiction-lab',resolveTurn:resolveLabTurn});
