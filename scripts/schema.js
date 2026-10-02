// CtrlZAPI — schema extraction, canonicalization, and diffing.
// Zero dependencies. Shared by scripts/snapshot.js (Node) via require.

function primitiveType(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'string') return 'string';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  if (t === 'object') return 'object';
  return 'unknown';
}

// Merge two schemas of the same "kind" (used to combine array elements /
// repeated object shapes into one representative schema).
function mergeSchemas(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.type !== b.type) {
    // Keep both types so a null->string flip is visible, not swallowed.
    const types = Array.from(new Set([a.type, b.type])).sort();
    return { type: types.join('|') };
  }
  if (a.type === 'object') {
    const fields = { ...a.fields };
    for (const [k, v] of Object.entries(b.fields || {})) {
      fields[k] = mergeSchemas(fields[k], v);
    }
    return { type: 'object', fields };
  }
  if (a.type === 'array') {
    return { type: 'array', items: mergeSchemas(a.items, b.items) };
  }
  return { type: a.type };
}

// Recursively convert any JSON value into a canonical schema tree.
function extractSchema(value) {
  const t = primitiveType(value);
  if (t === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = extractSchema(v);
    }
    return { type: 'object', fields };
  }
  if (t === 'array') {
    let items = null;
    for (const el of value) {
      items = mergeSchemas(items, extractSchema(el));
    }
    return { type: 'array', items: items || { type: 'unknown' } };
  }
  return { type: t };
}

// Stable string form for hashing / equality comparison.
// Object fields are sorted so key order never affects the hash.
function canonicalize(schema) {
  if (!schema || typeof schema !== 'object') return 'unknown';
  if (schema.type === 'object') {
    const keys = Object.keys(schema.fields || {}).sort();
    return 'object{' + keys.map(k => k + ':' + canonicalize(schema.fields[k])).join(',') + '}';
  }
  if (schema.type === 'array') {
    return 'array<' + canonicalize(schema.items) + '>';
  }
  return String(schema.type);
}

// Diff two schema trees. Returns [{op, path, detail}] with dot-paths;
// array items are addressed as "<path>[]" e.g. "tags[]".
function diffSchemas(oldS, newS) {
  const changes = [];

  function walk(o, n, path) {
    const label = path || '(root)';
    if (!o && n) {
      changes.push({ op: 'added', path: label, detail: `new ${describe(n)}` });
      return;
    }
    if (o && !n) {
      changes.push({ op: 'removed', path: label, detail: `was ${describe(o)}` });
      return;
    }
    if (!o && !n) return;
    if (o.type !== n.type) {
      changes.push({ op: 'type_changed', path: label, detail: `${o.type} -> ${n.type}` });
      return;
    }
    if (o.type === 'object') {
      const keys = new Set([...Object.keys(o.fields || {}), ...Object.keys(n.fields || {})]);
      for (const k of [...keys].sort()) {
        walk(o.fields && o.fields[k], n.fields && n.fields[k], path ? path + '.' + k : k);
      }
      return;
    }
    if (o.type === 'array') {
      walk(o.items, n.items, path + '[]');
      return;
    }
  }

  walk(oldS, newS, '');
  return changes;
}

function describe(s) {
  if (!s) return 'nothing';
  if (s.type === 'object') return `object (${Object.keys(s.fields || {}).length} fields)`;
  if (s.type === 'array') return `array of ${describe(s.items)}`;
  return s.type;
}

module.exports = { extractSchema, canonicalize, diffSchemas, mergeSchemas };
