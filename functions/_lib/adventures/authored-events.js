// Optional authored story events. Ordinary physics stays in natural-language facts.
// Event effects come from the script, never from model-supplied arbitrary patches.
export function eligible(rule, state) {
  return (rule.requires || []).every(id => state.flags.includes(id)) &&
    !(rule.excludes || []).some(id => state.flags.includes(id));
}

export function applyAuthoredEffects(story, state, milestone) {
  const changes = [];
  for (const effect of milestone.effects || []) {
    if (!eligible(effect, state)) continue;
    const entity = state.entities.find(e => e.id === effect.id);
    if (!entity || (effect.from && !effect.from.includes(entity.place))) continue;
    // Consumed objects are never reconstructed by a later scheduled scene.
    if (entity.integrity === 'consumed') continue;
    const before = structuredClone(entity);
    Object.assign(entity, effect.set, {updatedAtRevision: state.revision + 1});
    changes.push({id: entity.id, before, after: structuredClone(entity)});
    // Remote scripts do not update what the player last saw. Visible observations
    // are narrated/reviewed with before/after; direct encounter updates the record.
    if (effect.visible && (entity.place === state.location || entity.place === 'carried')) {
      state.knownEntities[entity.id] = structuredClone(entity);
    }
  }
  return changes;
}

export function followCompanions(story, state, from, to) {
  const moved = [];
  for (const companion of story.companions || []) {
    const e = state.entities.find(x => x.id === companion.id);
    if (!e || e.place !== from || !eligible(companion, state)) continue;
    e.place = to;
    e.updatedAtRevision = state.revision + 1;
    state.knownEntities[e.id] = structuredClone(e);
    moved.push({id: e.id, from, to});
  }
  return moved;
}
