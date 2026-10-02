// CtrlZAPI — shared client helpers (no dependencies).

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

// Render a schema tree as indented monospace text with type coloring.
function renderSchemaTree(schema) {
  function node(s, depth) {
    const pad = '  '.repeat(depth);
    if (!s) return pad + '<span class="t-null">unknown</span>';
    if (s.type === 'object') {
      const keys = Object.keys(s.fields || {});
      if (!keys.length) return pad + '<span class="t-object">object {}</span>';
      let out = pad + '<span class="t-object">object</span> {\n';
      for (const k of keys.sort()) {
        out += pad + '  ' + esc(k) + ': ' + node(s.fields[k], depth + 1).trimStart() + '\n';
      }
      return out + pad + '}';
    }
    if (s.type === 'array') {
      return pad + '<span class="t-array">array</span>&lt;' + node(s.items, depth + 1).trimStart() + '&gt;';
    }
    const cls = 't-' + String(s.type).split('|')[0];
    return pad + `<span class="${esc(cls)}">${esc(s.type)}</span>`;
  }
  return node(schema, 0);
}

// One schema-change row for the timeline.
function changeRow(c, endpoint) {
  return `<div class="change ${esc(c.op)}">
    <span class="endpoint">${esc(endpoint)}</span>
    <span class="op">${esc(c.op.replace('_', ' '))}</span>
    <span class="path">${esc(c.path)}</span>
    <span class="detail">${esc(c.detail)}</span>
  </div>`;
}

window.ATM = { fetchJSON, esc, fmtDate, getParam, renderSchemaTree, changeRow };
