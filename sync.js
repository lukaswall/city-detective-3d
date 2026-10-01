/* City Detective - local progress and optional shared notebook links.
   Two-screen roles exchange information by conversation, not by network.
   Progress links are optional and need a separate sharing channel. */
(function () {
  'use strict';

  /* ---------- pure state ops (shared by engine + tests) ---------- */

  function emptyState() {
    return { v: 2, visited: {}, found: {}, flavor: {}, answered: {}, clues: [], pinned: {}, solved: false };
  }

  function normalizeState(s) {
    var e = emptyState();
    if (!s || typeof s !== 'object') return e;
    ['visited', 'found', 'flavor', 'answered', 'pinned'].forEach(function (k) {
      if (s[k] && typeof s[k] === 'object') for (var key in s[k]) if (s[k][key]) e[k][key] = true;
    });
    if (Array.isArray(s.clues)) s.clues.forEach(function (c) { if (typeof c === 'string' && e.clues.indexOf(c) < 0) e.clues.push(c); });
    e.solved = !!s.solved;
    return e;
  }

  // Union merge: anything either detective did counts. Never destructive.
  function mergeState(a, b) {
    a = normalizeState(a); b = normalizeState(b);
    var out = normalizeState(a);
    ['visited', 'found', 'flavor', 'answered', 'pinned'].forEach(function (k) {
      for (var key in b[k]) out[k][key] = true;
    });
    b.clues.forEach(function (c) { if (out.clues.indexOf(c) < 0) out.clues.push(c); });
    out.solved = a.solved || b.solved;
    return out;
  }

  // One game action, applied to a state. Returns true if it changed anything.
  // Actions are the wire format for live co-op - small, idempotent, order-safe.
  function applyAction(state, a) {
    if (!a || !a.k) return false;
    switch (a.k) {
      case 'visit':
        if (state.visited[a.id]) return false;
        state.visited[a.id] = true; return true;
      case 'find':
        if (state.found[a.id]) return false;
        state.found[a.id] = true;
        if (state.clues.indexOf(a.id) < 0) state.clues.push(a.id);
        return true;
      case 'flavor':
        if (state.flavor[a.id]) return false;
        state.flavor[a.id] = true; return true;
      case 'answer':
        if (state.answered[a.id]) return false;
        state.answered[a.id] = true;
        if (a.clueId && !state.found[a.clueId]) {
          state.found[a.clueId] = true;
          if (state.clues.indexOf(a.clueId) < 0) state.clues.push(a.clueId);
        }
        return true;
      case 'pin':
        if (!!state.pinned[a.id] === !!a.on) return false;
        if (a.on) state.pinned[a.id] = true; else delete state.pinned[a.id];
        return true;
      case 'solve':
        if (state.solved) return false;
        state.solved = true; return true;
      case 'reset':
        var e = emptyState();
        for (var k in state) delete state[k];
        for (var k2 in e) state[k2] = e[k2];
        return true;
      default:
        return false;
    }
  }

  /* ---------- progress links ---------- */

  function encodeState(state) {
    var json = JSON.stringify(normalizeState(state));
    var b64 = (typeof btoa !== 'undefined')
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, 'utf8').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeState(code) {
    try {
      var b64 = String(code).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var json = (typeof atob !== 'undefined')
        ? decodeURIComponent(escape(atob(b64)))
        : Buffer.from(b64, 'base64').toString('utf8');
      return normalizeState(JSON.parse(json));
    } catch (e) { return null; }
  }

  var api = {
    emptyState: emptyState,
    normalizeState: normalizeState,
    mergeState: mergeState,
    applyAction: applyAction,
    encodeState: encodeState,
    decodeState: decodeState
  };

  if (typeof window !== 'undefined') window.CaseSync = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
