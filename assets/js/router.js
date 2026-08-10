// Minimal hash router: `#/venues/ven_x` -> { pattern: '/venues/:id', params: { id: 'ven_x' } }

const routes = [];
let onChange = () => {};

export function define(pattern, handler, meta = {}) {
  routes.push({ pattern, handler, meta, parts: pattern.split('/').filter(Boolean) });
}

export function path() {
  const raw = location.hash.replace(/^#/, '') || '/';
  return raw.split('?')[0] || '/';
}

export function query() {
  const raw = location.hash.replace(/^#/, '');
  const qIndex = raw.indexOf('?');
  return new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex + 1) : '');
}

export function navigate(to, { replace = false } = {}) {
  const target = to.startsWith('#') ? to : `#${to}`;
  if (location.hash === target) { onChange(); return; }
  if (replace) location.replace(target);
  else location.hash = target;
}

function match(route, parts) {
  if (route.parts.length !== parts.length) return null;
  const params = {};
  for (let i = 0; i < parts.length; i += 1) {
    const seg = route.parts[i];
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i]);
    else if (seg !== parts[i]) return null;
  }
  return params;
}

export function resolve(p = path()) {
  const parts = p.split('/').filter(Boolean);
  for (const route of routes) {
    const params = match(route, parts);
    if (params) return { route, params };
  }
  return null;
}

export function start(render) {
  onChange = render;
  window.addEventListener('hashchange', render);
  render();
}
