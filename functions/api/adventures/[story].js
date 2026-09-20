import {adventures,notFound} from '../../_lib/adventures/routes.js';
export const onRequest=context=>adventures[context.params.story]?.handler(context)||notFound();
