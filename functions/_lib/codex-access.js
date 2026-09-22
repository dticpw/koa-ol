// New client policies use SHA-256 digests; never put bearer keys in source.
export const MODEL_EFFORTS = Object.freeze({
  'gpt-5.5': ['low', 'medium', 'high', 'xhigh'],
  'gpt-5.6-sol': ['low', 'medium', 'high', 'xhigh', 'max'],
  'gpt-5.6-terra': ['low', 'medium', 'high', 'xhigh', 'max'],
  'gpt-5.6-luna': ['low', 'medium', 'high', 'xhigh', 'max'],
  'gpt-6-astra': ['low', 'medium', 'high', 'xhigh', 'max'],
});

export async function authorizeClient(request, env) {
  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') || '')?.[1]?.trim();
  const legacy = String(env.CLIENT_API_KEYS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!token) return { error: 'Unauthorized', status: 401 };
  // Keep legacy keys and their original single-model behavior intact.
  if (legacy.includes(token)) return { models: ['gpt-5.6-sol'], legacy: true };
  let policies;
  try {
    policies = JSON.parse(env.CODEX_CLIENT_POLICIES || '{}');
    if (!policies || typeof policies !== 'object' || Array.isArray(policies)) throw new Error();
  } catch {
    return { error: 'Invalid CODEX_CLIENT_POLICIES configuration', status: 500 };
  }
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const digest = Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
  const policy = Object.hasOwn(policies, digest) ? policies[digest] : undefined;
  if (!policy || policy.disabled === true) return { error: 'Unauthorized', status: 401 };
  if (!Array.isArray(policy.models) || !policy.models.length ||
      policy.models.some(m => !Object.hasOwn(MODEL_EFFORTS, m))) {
    return { error: 'Invalid client model policy', status: 500 };
  }
  return { models: [...new Set(policy.models)], legacy: false };
}

export function validateRequest(body, access) {
  const model = body.model === undefined ? access.models[0] : body.model;
  if (!access.models.includes(model)) return 'Model is not available for this API key';
  if (!access.legacy) {
    if (body.reasoning !== undefined &&
        (!body.reasoning || typeof body.reasoning !== 'object' || Array.isArray(body.reasoning))) {
      return 'reasoning must be an object';
    }
    const effort = body.reasoning?.effort;
    if (effort !== undefined && !MODEL_EFFORTS[model].includes(effort)) {
      return `Supported reasoning efforts for ${model}: ${MODEL_EFFORTS[model].join(', ')}`;
    }
    if (body.service_tier !== undefined && !['auto', 'default'].includes(body.service_tier)) {
      return 'Only default/auto service tier is verified on this upstream; accelerated tiers are unavailable';
    }
  }
  body.model = model;
  return null;
}
