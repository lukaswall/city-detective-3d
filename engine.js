/* City Detective - case engine v2.
   Renders any case object with the shape used by case-thailand.js.
   Screens: hero / city map / location (hotspots) / suspects / case board / accusation.
   Solo progress in localStorage; two-screen roles need no connection. */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var registry = window.CASE_REGISTRY || [];
  var CASE_KEY = 'city-detective:case';
  function pickEntry() {
    var want = localStorage.getItem(CASE_KEY);
    for (var i = 0; i < registry.length; i++) if (registry[i].id === want) return registry[i];
    return registry[0];
  }
  var CASE = registry.length ? pickEntry().loader() : null;
  if (!CASE) {
    app.innerHTML = '<div class="sheet"><h2>No cases installed</h2><p>Add a case file and register it in cases.js.</p></div>';
    return;
  }

  var SYNC = window.CaseSync;
  var SAVE_KEY = 'city-detective:v2:' + CASE.id;

  var state = load();
  var currentScreen = 'start';
  var currentLoc = null;
  var accuseStage = 'lineup';
  var restoringRoute = false;
  var routeDepth = 0;
  var routeKey = '';
  var overlayOpen = false;
  var partnerRole = localStorage.getItem('city-detective:role') || '';
  function roleName() { return partnerRole === 'field' ? 'Field detective' : 'Desk detective'; }
  function roleAllowed(loc, i) {
    return !partnerRole || (partnerRole === 'field' ? i % 2 === 0 : i % 2 === 1);
  }
  function renderPartnerChoice() {
    var m = el('<div class="overlay" role="dialog" aria-modal="true"><div class="ev-card"><p class="ev-stamp">Two-screen case</p><h3 class="ev-title">Choose separate desks</h3><p class="ev-text">Open this case on two phones. One chooses Field, the other Desk. Each sees a different half of the evidence. Talk to each other to put the story together. No pairing or internet is needed after the game is saved for offline use. The phones do not exchange progress automatically.</p><div class="ev-actions"><button class="btn-primary" id="fieldRole">Field detective</button><button class="btn-quiet" id="deskRole">Desk detective</button><button class="btn-quiet" id="soloRole">Play solo</button></div></div></div>');
    openOverlay(m);
    ['field', 'desk', 'solo'].forEach(function (role) {
      m.querySelector('#' + role + 'Role').onclick = function () {
        partnerRole = role === 'solo' ? '' : role;
        if (partnerRole) localStorage.setItem('city-detective:role', partnerRole);
        else localStorage.removeItem('city-detective:role');
        closeOverlay();
        rerender();
      };
    });
  }
  function renderPhone() {
    currentScreen = 'phone';
    var node = el('<div class="wrap narrow"><div class="page-head"><p class="kicker">Case communications</p><h2 class="page-title">The phone</h2><p class="page-sub">Ask a contact. Their replies go into your notebook when they disclose evidence.</p></div><div class="phone-list" id="phoneList"></div></div>');
    mount('phone', node);
    CASE.locations.filter(function (loc) { return !!loc.person; }).forEach(function (loc) {
      var suspect = suspectById(loc.person.suspectId);
      var section = el('<section class="phone-thread"><h3>' + esc(suspect.name) + '</h3><p class="phone-role">' + esc(suspect.role) + '</p><div class="phone-messages"></div><div class="phone-questions"></div></section>');
      var messages = section.querySelector('.phone-messages');
      var questions = section.querySelector('.phone-questions');
      if (!state.visited[loc.id]) {
        messages.appendChild(el('<p class="phone-message">Visit ' + esc(loc.name) + ' first to get in touch.</p>'));
      } else {
        loc.person.questions.forEach(function (q, qi) {
          if (!roleAllowed(loc, qi)) return;
          var key = loc.id + ':' + qi;
          if (state.answered[key]) {
            messages.appendChild(el('<p class="phone-message mine">' + esc(q.q) + '</p>'));
            messages.appendChild(el('<p class="phone-message">' + esc(q.a) + '</p>'));
          } else {
            var b = el('<button class="ask">' + esc(q.q) + '</button>');
            b.onclick = function () { act({ k:'answer', id:key, clueId:q.clueId || null }, true); renderPhone(); };
            questions.appendChild(b);
          }
        });
      }
      document.getElementById('phoneList').appendChild(section);
    });
  }

  function route() {
    return { screen: currentScreen, loc: currentLoc, stage: accuseStage, question: dedIndex, depth: routeDepth };
  }
  function routeId(r) {
    return r.screen + ':' + (r.screen === 'location' ? r.loc : r.screen === 'accuse' ? r.stage + ':' + r.question : '');
  }
  function syncRoute() {
    var r = route(), id = routeId(r);
    if (restoringRoute || id === routeKey) return;
    if (!routeKey) history.replaceState({ cityDetective: r }, '', location.href);
    else { r.depth = ++routeDepth; history.pushState({ cityDetective: r }, '', location.pathname); }
    routeKey = id;
  }
  function restoreRoute(r) {
    restoringRoute = true;
    routeDepth = r.depth || 0;
    routeKey = routeId(r);
    currentLoc = r.loc || null;
    accuseStage = r.stage || 'lineup';
    dedIndex = r.question || 0;
    if (r.screen === 'map') renderMap();
    else if (r.screen === 'location') renderLocation(r.loc);
    else if (r.screen === 'suspects') renderSuspects();
    else if (r.screen === 'board') renderBoard();
    else if (r.screen === 'phone') renderPhone();
    else if (r.screen === 'walk') renderWalk();
    else if (r.screen === 'accuse') {
      if (accuseStage === 'evidence') renderEvidence();
      else if (accuseStage === 'deduction') renderDeduction();
      else renderAccuse();
    } else if (r.screen === 'ending') renderEnding(!!state.solved);
    else renderStart();
    restoringRoute = false;
  }
  window.addEventListener('popstate', function (e) {
    document.querySelectorAll('.overlay').forEach(function (x) { x.remove(); });
    overlayOpen = false;
    if (e.state && e.state.cityDetective && !e.state.overlay) {
      if (routeKey !== routeId(e.state.cityDetective)) restoreRoute(e.state.cityDetective);
      else routeDepth = e.state.cityDetective.depth || 0;
    }
  });
  function goBack() {
    if (document.querySelector('.overlay')) { closeOverlay(); return; }
    if (routeDepth > 0) history.back();
    else if (currentScreen === 'location') renderMap();
    else renderStart();
  }
  function leaveOverlay(next) {
    closeOverlay();
    setTimeout(next, 0);
  }
  function openOverlay(sheet) {
    document.body.appendChild(sheet);
    overlayOpen = true;
    history.pushState({ cityDetective: route(), overlay: true }, '', location.pathname);
    requestAnimationFrame(function () { sheet.classList.add('on'); });
  }
  function closeOverlay() {
    document.querySelectorAll('.overlay').forEach(function (x) { x.remove(); });
    if (overlayOpen) { overlayOpen = false; history.back(); }
  }


  /* ---------- persistence ---------- */

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw) return SYNC.normalizeState(JSON.parse(raw));
    } catch (e) {}
    // migrate a v1 save if one exists
    try {
      var old = localStorage.getItem('city-detective:' + CASE.id);
      if (old) {
        var o = JSON.parse(old);
        var s = SYNC.emptyState();
        if (o.visited) for (var k in o.visited) s.visited[k] = true;
        if (o.found) for (var k2 in o.found) if (o.found[k2]) { s.found[k2] = true; if (s.clues.indexOf(k2) < 0) s.clues.push(k2); }
        if (o.answered) for (var k3 in o.answered) s.answered[k3] = true;
        if (o.solved) s.solved = true;
        return s;
      }
    } catch (e) {}
    return SYNC.emptyState();
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- actions: everything goes through here ---------- */

  function act(a, silent) {
    var changed = SYNC.applyAction(state, a);
    if (changed) {
      save();
      if (!silent) rerender();
    }
    return changed;
  }

  /* ---------- case lookups ---------- */

  function suspectById(id) {
    for (var i = 0; i < CASE.suspects.length; i++) if (CASE.suspects[i].id === id) return CASE.suspects[i];
    return null;
  }
  function locationById(id) {
    for (var i = 0; i < CASE.locations.length; i++) if (CASE.locations[i].id === id) return CASE.locations[i];
    return null;
  }
  // Every piece of evidence: scene searches + testimony, in case order.
  function allEvidence() {
    var out = [];
    CASE.locations.forEach(function (loc) {
      loc.searches.forEach(function (s) {
        out.push({ id: s.id, title: s.title, text: s.text, where: loc.name, kind: 'Scene' });
      });
      if (loc.person) {
        var s2 = suspectById(loc.person.suspectId);
        loc.person.questions.forEach(function (q) {
          if (q.clueId) out.push({ id: q.clueId, title: 'Testimony - ' + (s2 ? s2.name : ''), text: q.a, where: loc.name, kind: 'Testimony' });
        });
      }
    });
    return out;
  }
  var EVIDENCE = allEvidence();
  function setCase(id) {
    var ent = null;
    for (var i = 0; i < registry.length; i++) if (registry[i].id === id) ent = registry[i];
    if (!ent) return;
    try { localStorage.setItem(CASE_KEY, id); } catch (e) {}
    CASE = ent.loader(); SAVE_KEY = 'city-detective:v2:' + CASE.id;
    state = load(); EVIDENCE = allEvidence();
  }
  function clueInfo(id) {
    for (var i = 0; i < EVIDENCE.length; i++) if (EVIDENCE[i].id === id) return EVIDENCE[i];
    return null;
  }
  function totalClues() { return EVIDENCE.length; }
  function allVisited() {
    return CASE.locations.every(function (l) { return state.visited[l.id]; });
  }
  function started() {
    return Object.keys(state.visited).length > 0 || state.clues.length > 0 || state.solved;
  }

  /* ---------- dom helpers ---------- */

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d.firstElementChild;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function rerender() {
    if (currentScreen === 'map') renderMap();
    else if (currentScreen === 'location') renderLocation(currentLoc);
    else if (currentScreen === 'suspects') renderSuspects();
    else if (currentScreen === 'board') renderBoard();
    else if (currentScreen === 'start') renderStart();
    else if (currentScreen === 'phone') renderPhone();
    else if (currentScreen === 'accuse' && accuseStage === 'evidence') renderEvidence();
    // deduction stays put so a remote clue does not wipe the answer
    updatePresence();
  }

  /* ---------- toasts ---------- */

  var toastWrap = null;
  function toast(text) {
    if (!toastWrap) {
      toastWrap = el('<div class="toasts" aria-live="polite"></div>');
      document.body.appendChild(toastWrap);
    }
    var t = el('<div class="toast"><span class="toast-dot"></span>' + esc(text) + '</div>');
    toastWrap.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 500);
    }, 4200);
  }

  /* ---------- shell ---------- */

  function updatePresence() {
    var p = document.getElementById('presence');
    if (!p) return;
    p.textContent = partnerRole ? roleName() : 'Play together';
    p.classList.remove('live');
  }

  function shell(active) {
    var bar = el(
      '<header class="shell">' +
        (active !== 'start' ? '<button class="shell-back" id="shellBack" aria-label="Go back">&larr; <span>Back</span></button>' : '') +
        '<button class="wordmark" data-nav="start">City <em>Detective</em></button>' +
        '<nav class="shell-nav">' +
          '<button data-nav="map"' + (active === 'map' ? ' class="on"' : '') + '>The city</button>' +
          '<button data-nav="suspects"' + (active === 'suspects' ? ' class="on"' : '') + '>Suspects</button>' +
          '<button data-nav="phone"' + (active === 'phone' ? ' class="on"' : '') + '>Phone</button>' +
          '<button data-nav="board"' + (active === 'board' ? ' class="on"' : '') + '>Case board <span class="nav-count">' + state.clues.length + '</span></button>' +
        '</nav>' +
        '<div class="shell-right">' +
          '<button class="presence" id="presence" data-nav="sync">Solo case</button>' +
          '<button class="btn-accuse" data-nav="accuse"' + (allVisited() && !state.solved ? '' : ' disabled') + '>Accuse</button>' +
        '</div>' +
      '</header>'
    );
    var backButton = bar.querySelector('#shellBack');
    if (backButton) backButton.onclick = goBack;
    bar.querySelectorAll('[data-nav]').forEach(function (b) {
      b.onclick = function () {
        var t = b.getAttribute('data-nav');
        if (t === 'start') renderStart();
        else if (t === 'map') renderMap();
        else if (t === 'suspects') renderSuspects();
        else if (t === 'board') renderBoard();
        else if (t === 'phone') renderPhone();
        else if (t === 'sync') renderPartnerChoice();
        else if (t === 'accuse' && allVisited() && !state.solved) renderAccuse();
      };
    });
    return bar;
  }

  function mount(active, node) {
    app.innerHTML = '';
    app.appendChild(shell(active));
    var main = el('<main class="page"></main>');
    main.appendChild(node);
    app.appendChild(main);
    updatePresence();
    syncRoute();
    window.scrollTo(0, 0);
  }

  /* ---------- hero / start ---------- */

  function renderStart() {
    currentScreen = 'start';
    var hasProgress = started() && !state.solved;
    var node = el(
      '<div>' +
        '<section class="hero">' +
          '<div class="hero-art"><img src="' + CASE.cover + '" alt="Bangkok at night, a detective overlooking the river"></div>' +
          '<div class="hero-scrim"></div>' +
          '<div class="hero-inner">' +
            '<div class="hero-stamp">' + esc(CASE.caseNo) + ' &middot; one night, one thief</div>' +
            '<h1 class="hero-title"><span>The</span><span class="t-big">Emerald</span><span class="t-big t-indent">Deva</span></h1>' +
            '<p class="hero-sub">A City Detective case &middot; ' + esc(CASE.city) + '</p>' +
            '<div class="hero-cta">' +
              '<button class="btn-primary" id="startBtn">' + (state.solved ? 'Reopen the case' : hasProgress ? 'Continue the investigation' : 'Begin the investigation') + '</button>' +
              (hasProgress ? '<button class="btn-quiet" id="resetBtn">Start over</button>' : '') +
              '<button class="btn-quiet" id="roleBtn">' + (partnerRole ? esc(roleName()) + ' / change' : 'Play on two phones') + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="hero-scroll" aria-hidden="true"><span></span></div>' +
        '</section>' +
        '<section class="brief wrap">' +
          '<div class="brief-grid">' +
            '<div class="brief-copy">' +
              '<h2 class="sec-title">The brief</h2>' +
              '<p class="lede">' + esc(CASE.intro) + '</p>' +
              '<div class="brief-facts">' +
                fact('Stolen', 'The Emerald Deva, gold and jade') +
                fact('Window', '21:40 - 21:55, exhibition night') +
                fact('Insured', '40 million baht') +
                fact('Suspects', String(CASE.suspects.length) + ' with motive and means') +
              '</div>' +
            '</div>' +
            '<figure class="amulet-fig">' +
              '<div class="amulet-stage" id="amuletStage">' +
                '<img id="amuletImg" src="amulet.png" alt="The Emerald Deva - a gold pendant set with a green stone">' +
              '</div>' +
              '<figcaption>The missing piece. Handled by two people in the days before it vanished.</figcaption>' +
            '</figure>' +
          '</div>' +
        '</section>' +
        '<section class="how wrap">' +
          '<h2 class="sec-title">How a detective works</h2>' +
          '<div class="how-steps">' +
            step('Work the scenes', 'Evidence sits inside the photographs themselves. Sweep each scene, open every gold marker.') +
            step('Question everyone', 'People lie, deflect and confess. The right question at the right counter can be worth more than a fingerprint.') +
            step('Build the board', 'Everything lands on your case board. Related evidence ties itself together - read the strings.') +
            step('Prove it', 'One accusation. Name the thief, answer for the method, and present the two pieces of evidence that convict.') +
          '</div>' +
        '</section>' +
        '<section class="together wrap">' +
          '<div class="together-card">' +
            '<div>' +
              '<h2 class="sec-title">Two detectives, one case</h2>' +
              '<p>One chooses Field, the other Desk. Each phone has half the evidence; talk to solve the case together. No pairing needed. Your progress stays on your own phone - the phones do not sync automatically.</p>' +
            '</div>' +
            '<div class="together-actions">' +
              '<button class="btn-primary" id="syncBtn">Two-screen case</button>' +
              '<button class="btn-quiet" id="shareBtn">Copy progress link</button>' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<footer class="foot wrap">' +
          '<p>City Detective &middot; ' + esc(CASE.country) + ' &middot; all artwork and characters original and fictional</p>' +
        '</footer>' +
      '</div>'
    );
    mount('start', node);

    document.getElementById('startBtn').onclick = function () {
      if (state.solved) { act({ k: 'reset' }); }
      renderMap();
    };
    var rb = document.getElementById('resetBtn');
    if (rb) rb.onclick = function () { act({ k: 'reset' }); renderStart(); };
    document.getElementById('syncBtn').onclick = renderPartnerChoice;
    document.getElementById('roleBtn').onclick = renderPartnerChoice;
    document.getElementById('shareBtn').onclick = copyProgressLink;

    initAmulet();
  }

  function fact(k, v) {
    return '<div class="fact"><span class="fact-k">' + esc(k) + '</span><span class="fact-v">' + esc(v) + '</span></div>';
  }
  function step(t, d) {
    return '<div class="how-step"><h3>' + esc(t) + '</h3><p>' + esc(d) + '</p></div>';
  }

  /* ---------- amulet: 3D when possible, image with tilt otherwise ---------- */

  function initAmulet() {
    var stage = document.getElementById('amuletStage');
    if (!stage) return;
    var ok = window.Amulet3D && window.Amulet3D.mount(stage);
    if (!ok) {
      // pointer-tilt fallback on the still image
      var img = document.getElementById('amuletImg');
      if (!img) return;
      stage.classList.add('tiltable');
      stage.addEventListener('pointermove', function (e) {
        var r = stage.getBoundingClientRect();
        var dx = (e.clientX - r.left) / r.width - 0.5;
        var dy = (e.clientY - r.top) / r.height - 0.5;
        img.style.transform = 'rotateY(' + (dx * 16) + 'deg) rotateX(' + (-dy * 12) + 'deg) scale(1.03)';
      });
      stage.addEventListener('pointerleave', function () {
        img.style.transform = 'rotateY(0deg) rotateX(0deg) scale(1)';
      });
    }
  }

  /* ---------- city map ---------- */

  function renderMap() {
    currentScreen = 'map';
    var foundTotal = state.clues.length;
    var node = el(
      '<div class="wrap map-page">' +
        '<div class="page-head">' +
          '<p class="kicker">' + esc(CASE.city) + ' &middot; the night of the theft</p>' +
          '<h2 class="page-title">The city</h2>' +
          '<p class="page-sub">' +
            (allVisited()
              ? 'Every corner covered. When the board tells one story, make the accusation.'
              : 'Six places hold the truth of one night. Visit them all before you accuse.') +
          '</p>' +
          '<div class="progress"><div class="progress-fill" style="width:' + Math.round(100 * foundTotal / totalClues()) + '%"></div></div>' +
          '<p class="progress-label">Evidence filed: ' + foundTotal + ' of ' + totalClues() + '</p>' +
        '</div>' +
        '<div class="terminal-station">' +
          '<div class="terminal-copy"><span class="terminal-index">CITY DETECTIVE / TERMINAL 01</span><h3>Every street has a witness.</h3><p>Choose a district. Search the scene. Follow what each person leaves behind.</p><span class="terminal-rule"></span><small>' + (partnerRole ? esc(roleName()) + ' / separate notebook' : 'Solo case / all leads visible') + '</small></div>' +
          '<div class="terminal-machine"><div class="terminal-bezel"><div class="terminal-screen"><div class="terminal-header"><span>CD/01 : CITY GRID</span><span class="terminal-live">● ACTIVE</span></div><div class="map-frame" id="mapFrame"></div></div><div class="terminal-controls"><span></span><span></span><span></span><span>CASE 01 / BKK</span></div></div></div>' +
        '</div>' +
      '</div>'
    );
    mount('map', node);
    buildMap(document.getElementById('mapFrame'));
  }

  function buildMap(frame) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '16 14 74 60');
    svg.setAttribute('class', 'citymap');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Map of Bangkok riverside with case locations');

    // water: the Chao Phraya, one slow curve across the frame
    var river = document.createElementNS(NS, 'path');
    river.setAttribute('d', 'M -2 40 C 18 34, 30 46, 46 42 C 62 38, 66 26, 84 30 C 94 32, 99 36, 102 36 L 102 52 C 88 50, 76 44, 62 50 C 48 56, 34 50, 20 54 C 8 57, 0 56, -2 55 Z');
    river.setAttribute('class', 'map-river');
    svg.appendChild(river);

    // faint street grid to give the land mass structure
    for (var gx = 20; gx <= 88; gx += 8) {
      var gl = document.createElementNS(NS, 'line');
      gl.setAttribute('x1', gx); gl.setAttribute('y1', 16);
      gl.setAttribute('x2', gx - 6); gl.setAttribute('y2', 74);
      gl.setAttribute('class', 'map-grid');
      svg.appendChild(gl);
    }
    for (var gy = 20; gy <= 72; gy += 9) {
      var gh = document.createElementNS(NS, 'line');
      gh.setAttribute('x1', 17); gh.setAttribute('y1', gy);
      gh.setAttribute('x2', 89); gh.setAttribute('y2', gy - 2);
      gh.setAttribute('class', 'map-grid');
      svg.appendChild(gh);
    }
    // river name along the water
    var riverName = document.createElementNS(NS, 'text');
    riverName.setAttribute('x', 30); riverName.setAttribute('y', 48);
    riverName.setAttribute('class', 'map-rivername');
    riverName.setAttribute('transform', 'rotate(-4 30 48)');
    riverName.textContent = 'C H A O   P H R A Y A';
    svg.appendChild(riverName);
    // district watermark
    var wm = document.createElementNS(NS, 'text');
    wm.setAttribute('x', 19); wm.setAttribute('y', 21);
    wm.setAttribute('class', 'map-watermark');
    wm.textContent = 'OLD TOWN - RIVERSIDE DISTRICT';
    svg.appendChild(wm);
    // minimal compass
    var comp = document.createElementNS(NS, 'g');
    comp.setAttribute('class', 'map-compass');
    var cc = document.createElementNS(NS, 'circle');
    cc.setAttribute('cx', 85); cc.setAttribute('cy', 20); cc.setAttribute('r', 2.6);
    comp.appendChild(cc);
    var cn = document.createElementNS(NS, 'text');
    cn.setAttribute('x', 85); cn.setAttribute('y', 19.4);
    cn.setAttribute('class', 'map-compass-n');
    cn.textContent = 'N';
    comp.appendChild(cn);
    var carrow = document.createElementNS(NS, 'line');
    carrow.setAttribute('x1', 85); carrow.setAttribute('y1', 21.4);
    carrow.setAttribute('x2', 85); carrow.setAttribute('y2', 20.2);
    carrow.setAttribute('class', 'map-compass-line');
    comp.appendChild(carrow);
    svg.appendChild(comp);

    // route between locations in story order
    var pts = CASE.locations.map(function (l) { return l.map; });
    for (var i = 0; i < pts.length - 1; i++) {
      var seg = document.createElementNS(NS, 'line');
      seg.setAttribute('x1', pts[i].x); seg.setAttribute('y1', pts[i].y);
      seg.setAttribute('x2', pts[i + 1].x); seg.setAttribute('y2', pts[i + 1].y);
      seg.setAttribute('class', 'map-route');
      svg.appendChild(seg);
    }

    CASE.locations.forEach(function (loc, idx) {
      var foundHere = loc.searches.filter(function (s, i) { return roleAllowed(loc, i) && state.found[s.id]; }).length;
      var allHere = loc.searches.filter(function (s, i) { return roleAllowed(loc, i); }).length;
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'map-pin' + (state.visited[loc.id] ? ' seen' : '') + (foundHere === allHere ? ' cleared' : ''));
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', loc.name);

      var halo = document.createElementNS(NS, 'circle');
      halo.setAttribute('cx', loc.map.x); halo.setAttribute('cy', loc.map.y); halo.setAttribute('r', 2.1);
      halo.setAttribute('class', 'pin-halo');
      g.appendChild(halo);

      var dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', loc.map.x); dot.setAttribute('cy', loc.map.y); dot.setAttribute('r', 0.85);
      dot.setAttribute('class', 'pin-dot');
      g.appendChild(dot);

      var label = document.createElementNS(NS, 'text');
      label.setAttribute('x', loc.map.x); label.setAttribute('y', loc.map.y - 2.6);
      label.setAttribute('class', 'pin-label');
      label.textContent = loc.time + '  ' + loc.name;
      g.appendChild(label);

      var sub = document.createElementNS(NS, 'text');
      sub.setAttribute('x', loc.map.x); sub.setAttribute('y', loc.map.y + 3.1);
      sub.setAttribute('class', 'pin-sub');
      sub.textContent = state.visited[loc.id]
        ? (foundHere === allHere ? 'searched clean' : foundHere + '/' + allHere + ' evidence')
        : 'unvisited';
      g.appendChild(sub);

      function go() { renderLocation(loc.id); }
      g.addEventListener('click', go);
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      svg.appendChild(g);
    });

    frame.appendChild(svg);
    var list = el('<div class="map-locations" aria-label="Case locations"></div>');
    CASE.locations.forEach(function (loc, index) {
      var found = loc.searches.filter(function (item, i) { return roleAllowed(loc, i) && state.found[item.id]; }).length;
      var btn = el('<button class="map-location"><span class="map-location-index">0' + (index + 1) + '</span><span><strong>' + esc(loc.name) + '</strong><small>' + esc(loc.time) + ' / ' + (state.visited[loc.id] ? found + ' of ' + loc.searches.filter(function (item, i) { return roleAllowed(loc, i); }).length + ' clues' : 'Unvisited') + '</small></span><span aria-hidden="true">&rarr;</span></button>');
      btn.onclick = function () { renderLocation(loc.id); };
      list.appendChild(btn);
    });
    frame.appendChild(list);
  }

  /* ---------- location: scene + hotspots + questioning ---------- */

  function renderLocation(id) {
    var loc = locationById(id);
    if (!loc) return renderMap();
    currentScreen = 'location';
    currentLoc = id;
    act({ k: 'visit', id: id }, true); // silent; we render below anyway

    var left = loc.searches.filter(function (s, i) { return roleAllowed(loc, i) && !state.found[s.id]; }).length;
    var flavorLeft = (loc.flavor || []).filter(function (f) { return !state.flavor[f.id]; }).length;

    var node = el(
      '<div class="' + (partnerRole ? 'mode-' + partnerRole : 'mode-solo') + '">' +
        '<div class="loc-head wrap">' +
          '<button class="crumb" id="backMap">&larr; The city</button>' +
          '<p class="kicker">' + esc(loc.time) + ' &middot; ' + esc(CASE.city) + '</p>' +
          '<h2 class="page-title">' + esc(loc.name) + '</h2>' +
          (partnerRole ? '<p class="role-stamp">' + esc(roleName()) + ' / private view</p>' : '') +
          '<p class="page-sub">' + esc(loc.description) + '</p>' +
        '</div>' +
        '<div class="scene-wrap">' +
          '<div class="scene" id="scene">' +
            (partnerRole === 'desk' ? '<div class="desk-archive"><div class="desk-top"><span>ARCHIVE / BKK / ' + esc(loc.time) + '</span><span>READ ONLY ●</span></div><div class="desk-grid"><div><small>FILED LOCATION</small><strong>' + esc(loc.name) + '</strong><p>' + esc(loc.blurb) + '</p></div><div class="desk-reticle">◇</div></div><div class="desk-foot">EVIDENCE INDEX · SELECT A RECORD BELOW</div></div>' : '<img src="' + loc.image + '" alt="' + esc(loc.name) + ' - search the scene for evidence" id="sceneImg">') +
            '<div class="scene-vignette"></div>' +
          '</div>' +
          '<p class="scene-hint">' +
            (left + flavorLeft > 0
              ? (partnerRole === 'desk' ? 'Archive records: ' : 'Sweep the scene - gold markers hold evidence, dim ones hold detail. ') + left + ' evidence left here.'
              : 'This scene is clean on your desk. In two-screen mode, ask your partner what they found.') +
          '</p>' +
        '</div>' +
        '<div class="wrap"><div class="scene-actions" id="sceneActions"></div></div>' +
        '<div class="wrap" id="locBelow"></div>' +
      '</div>'
    );
    mount('map', node);

    var scene = document.getElementById('scene');

    // evidence hotspots
    loc.searches.forEach(function (s, i) {
      if (!roleAllowed(loc, i)) return;
      var found = !!state.found[s.id];
      var m = el(
        '<button class="hotspot' + (found ? ' found' : '') + '" style="left:' + s.x + '%;top:' + s.y + '%" aria-label="' + (found ? 'Evidence filed: ' : 'Search: ') + esc(s.title) + '">' +
          '<span class="hs-ring"></span><span class="hs-core"></span>' +
          '<span class="hs-tag">' + (found ? 'Filed' : 'Evidence') + '</span>' +
        '</button>'
      );
      m.onclick = function () {
        if (state.found[s.id]) { showEvidence(s, loc, false); return; }
        flash();
        act({ k: 'find', id: s.id }, true);
        showEvidence(s, loc, true);
      };
      if (partnerRole !== 'desk') scene.appendChild(m);
      var action = el('<button class="scene-action"><span class="scene-action-mark">' + (found ? '✓' : '◆') + '</span><span>' + esc(s.title) + '</span><span class="scene-action-status">' + (found ? 'Filed' : 'Inspect') + '</span></button>');
      action.onclick = function () { m.click(); };
      document.getElementById('sceneActions').appendChild(action);
    });

    // flavor markers
    (partnerRole === 'desk' ? [] : loc.flavor || []).forEach(function (f) {
      var seen = !!state.flavor[f.id];
      var m = el(
        '<button class="hotspot minor' + (seen ? ' found' : '') + '" style="left:' + f.x + '%;top:' + f.y + '%" aria-label="Detail: ' + esc(f.title) + '">' +
          '<span class="hs-core"></span>' +
        '</button>'
      );
      m.onclick = function () {
        act({ k: 'flavor', id: f.id }, true);
        showFlavor(f, loc);
      };
      scene.appendChild(m);
    });

    // pointer parallax on the scene
    var img = document.getElementById('sceneImg');
    if (img) scene.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = scene.getBoundingClientRect();
      var dx = (e.clientX - r.left) / r.width - 0.5;
      var dy = (e.clientY - r.top) / r.height - 0.5;
      img.style.transform = 'scale(1.06) translate(' + (-dx * 1.6) + '%,' + (-dy * 1.2) + '%)';
    });
    if (img) scene.addEventListener('pointerleave', function () {
      img.style.transform = 'scale(1.03) translate(0,0)';
    });

    document.getElementById('backMap').onclick = goBack;

    // questioning
    if (loc.person) {
      var s = suspectById(loc.person.suspectId);
      var asked = loc.person.questions.filter(function (q, qi) { return state.answered[id + ':' + qi]; }).length;
      var p = el(
        '<section class="interrogate">' +
          '<div class="int-head">' +
            '<img class="int-face" src="' + s.image + '" alt="Portrait of ' + esc(s.name) + '">' +
            '<div>' +
              '<p class="kicker">Questioning</p>' +
              '<h3 class="int-name">' + esc(s.name) + '</h3>' +
              '<p class="int-role">' + esc(s.role) + '</p>' +
            '</div>' +
          '</div>' +
          '<p class="int-intro">' + esc(loc.person.intro) + '</p>' +
          '<div class="int-thread" id="thread"></div>' +
          '<div class="int-asks" id="asks"></div>' +
        '</section>'
      );
      document.getElementById('locBelow').appendChild(p);

      var thread = p.querySelector('#thread');
      var asks = p.querySelector('#asks');
      loc.person.questions.forEach(function (q, qi) {
        if (!roleAllowed(loc, qi)) return;
        var key = id + ':' + qi;
        if (state.answered[key]) {
          thread.appendChild(el(
            '<div class="exchange">' +
              '<p class="ex-q">' + esc(q.q) + '</p>' +
              '<p class="ex-a">' + esc(q.a) + '</p>' +
              (q.clueId ? '<p class="ex-note">Key testimony &middot; filed to the case board</p>' : '') +
            '</div>'
          ));
        } else {
          var qb = el('<button class="ask">' + esc(q.q) + '</button>');
          qb.onclick = function () {
            act({ k: 'answer', id: key, clueId: q.clueId || null }, true);
            renderLocation(id);
          };
          asks.appendChild(qb);
        }
      });
      if (!asks.children.length) {
        asks.appendChild(el('<p class="int-done">' + esc(s.name) + ' has told you everything there is.</p>'));
      }
    }
  }

  function flash() {
    var f = el('<div class="flash"></div>');
    document.body.appendChild(f);
    requestAnimationFrame(function () { f.classList.add('on'); });
    setTimeout(function () { f.remove(); }, 420);
  }

  function evidenceNumber(id) {
    return state.clues.indexOf(id) + 1;
  }

  function showEvidence(s, loc, isNew) {
    var n = evidenceNumber(s.id);
    var sheet = el(
      '<div class="overlay" role="dialog" aria-modal="true">' +
        '<div class="ev-card">' +
          '<p class="ev-stamp">' + (isNew ? 'Evidence filed' : 'Evidence') + (n > 0 ? ' &middot; no. ' + n : '') + '</p>' +
          '<h3 class="ev-title">' + esc(s.title) + '</h3>' +
          '<p class="ev-where">' + esc(loc.name) + ' &middot; ' + esc(loc.time) + '</p>' +
          '<p class="ev-text">' + esc(s.text) + '</p>' +
          '<div class="ev-actions">' +
            '<button class="btn-primary" id="evOk">' + (isNew ? 'File it' : 'Back to the scene') + '</button>' +
            '<button class="btn-quiet" id="evBoard">Open case board</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    openOverlay(sheet);
    sheet.querySelector('#evOk').onclick = function () { closeOverlay(); rerender(); };
    sheet.querySelector('#evBoard').onclick = function () { leaveOverlay(renderBoard); };
  }

  function showFlavor(f, loc) {
    var sheet = el(
      '<div class="overlay" role="dialog" aria-modal="true">' +
        '<div class="ev-card minor-card">' +
          '<p class="ev-stamp">Detail &middot; ' + esc(loc.name) + '</p>' +
          '<h3 class="ev-title">' + esc(f.title) + '</h3>' +
          '<p class="ev-text">' + esc(f.text) + '</p>' +
          '<div class="ev-actions"><button class="btn-primary" id="evOk">Back to the scene</button></div>' +
        '</div>' +
      '</div>'
    );
    openOverlay(sheet);
    sheet.querySelector('#evOk').onclick = function () { closeOverlay(); rerender(); };
  }

  /* ---------- suspects ---------- */

  function renderSuspects() {
    currentScreen = 'suspects';
    var node = el(
      '<div class="wrap">' +
        '<div class="page-head">' +
          '<p class="kicker">Four people, one thief</p>' +
          '<h2 class="page-title">The suspects</h2>' +
          '<p class="page-sub">Everyone here had a reason. Two of them had the code. Only one of them has the Deva.</p>' +
        '</div>' +
        '<div class="suspect-row" id="susRow"></div>' +
      '</div>'
    );
    mount('suspects', node);
    var row = document.getElementById('susRow');
    CASE.suspects.forEach(function (s) {
      var card = el(
        '<article class="suspect" tabindex="0">' +
          '<div class="suspect-imgwrap"><img src="' + s.image + '" alt="Portrait of ' + esc(s.name) + '"></div>' +
          '<div class="suspect-body">' +
            '<h3>' + esc(s.name) + '</h3>' +
            '<p class="suspect-role">' + esc(s.role) + '</p>' +
            '<p class="suspect-bio">' + esc(s.bio) + '</p>' +
          '</div>' +
        '</article>'
      );
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var dx = (e.clientX - r.left) / r.width - 0.5;
        var dy = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(900px) rotateY(' + (dx * 7) + 'deg) rotateX(' + (-dy * 5) + 'deg) translateY(-4px)';
      });
      card.addEventListener('pointerleave', function () { card.style.transform = ''; });
      row.appendChild(card);
    });
  }

  /* ---------- case board (notebook) ---------- */

  function renderBoard() {
    currentScreen = 'board';
    var node = el(
      '<div class="wrap">' +
        '<div class="page-head">' +
          '<p class="kicker">Evidence and testimony</p>' +
          '<h2 class="page-title">The case board</h2>' +
          '<p class="page-sub">' +
            (state.clues.length
              ? state.clues.length + ' of ' + totalClues() + ' pieces filed. Strings tie evidence that proves each other - the truth sits where they knot.'
              : 'Empty. Go walk the city.') +
          '</p>' +
        '</div>' +
        '<div class="board" id="board"></div>' +
      '</div>'
    );
    mount('board', node);
    var board = document.getElementById('board');

    var found = state.clues.map(clueInfo).filter(Boolean);
    if (partnerRole) {
      var partner = el('<div class="partner-note"><h3>File what your partner found</h3><p>Ask them for the evidence title, then add it to your board. Your phones do not exchange this automatically.</p><select id="partnerClue"><option value="">Choose a clue they describe</option></select><button class="btn-quiet" id="partnerFile">File partner evidence</button></div>');
      board.appendChild(partner);
      EVIDENCE.filter(function (c) { return !state.found[c.id]; }).forEach(function (c) { var opt = document.createElement("option"); opt.value = c.id; opt.textContent = c.title; partner.querySelector("select").appendChild(opt); });
      partner.querySelector("#partnerFile").onclick = function () { var id = partner.querySelector("select").value; if (id) { act({ k:"find", id:id }); toast("Partner evidence filed"); } };
    }
    if (found.length) {
      var inner = el('<div class="board-inner" id="boardInner"></div>');
      board.appendChild(inner);
      found.forEach(function (c, i) {
        var rot = ((i * 37) % 7) - 3; // deterministic slight tilt, not random
        var card = el(
          '<article class="pin-card" data-id="' + esc(c.id) + '" style="--rot:' + rot + 'deg">' +
            '<span class="pin" aria-hidden="true"></span>' +
            '<p class="pc-kind">' + esc(c.kind) + ' &middot; ' + esc(c.where) + '</p>' +
            '<h3 class="pc-title">' + esc(c.title) + '</h3>' +
            '<p class="pc-text">' + esc(c.text) + '</p>' +
          '</article>'
        );
        inner.appendChild(card);
      });
      // strings between related, both-found clues
      requestAnimationFrame(function () { drawStrings(board, inner); });
    }

    // what is still out there
    var missing = EVIDENCE.filter(function (c) { return !state.found[c.id]; });
    if (missing.length) {
      var ml = el(
        '<div class="missing">' +
          '<h3>Still out there</h3>' +
          '<p>' + missing.length + ' piece' + (missing.length === 1 ? '' : 's') + ' of evidence unfound. The scenes keep their secrets until you look.</p>' +
        '</div>'
      );
      board.appendChild(ml);
    }
  }

  function drawStrings(board, inner) {
    var old = board.querySelector('svg.strings');
    if (old) closeOverlay();
    var ids = {};
    inner.querySelectorAll('.pin-card').forEach(function (c) {
      var r = c.getBoundingClientRect();
      var br = inner.getBoundingClientRect();
      ids[c.getAttribute('data-id')] = {
        x: r.left - br.left + r.width / 2,
        y: r.top - br.top + 8
      };
    });
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'strings');
    var br = inner.getBoundingClientRect();
    svg.setAttribute('width', br.width);
    svg.setAttribute('height', br.height);
    svg.setAttribute('viewBox', '0 0 ' + br.width + ' ' + br.height);
    CASE.links.forEach(function (pair) {
      var a = ids[pair[0]], b = ids[pair[1]];
      if (!a || !b) return;
      var midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2 + 18;
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M ' + a.x + ' ' + a.y + ' Q ' + midX + ' ' + midY + ' ' + b.x + ' ' + b.y);
      svg.appendChild(p);
    });
    inner.appendChild(svg);
  }

  /* ---------- accusation ---------- */

  var picked = null;
  var dedIndex = 0;
  var strikes = 0;
  var evidencePicks = {};

  function renderAccuse() {
    if (state.solved) return renderEnding(true, true);
    if (!restoringRoute) { picked = null; dedIndex = 0; strikes = 0; evidencePicks = {}; }
    accuseStage = 'lineup';
    currentScreen = 'accuse';
    var node = el(
      '<div class="wrap">' +
        '<div class="page-head center">' +
          '<p class="kicker">One shot</p>' +
          '<h2 class="page-title">Name the thief</h2>' +
          '<p class="page-sub">Choose the person your evidence actually convicts. Then answer for how it was done - and present the proof.</p>' +
        '</div>' +
        '<div class="lineup" id="lineup"></div>' +
        '<div class="center-row"><button class="btn-primary" id="confirmAccuse" disabled>Make the accusation</button></div>' +
      '</div>'
    );
    mount('accuse', node);
    var lineup = document.getElementById('lineup');
    CASE.suspects.forEach(function (s) {
      var card = el(
        '<button class="lineup-card">' +
          '<img src="' + s.image + '" alt="' + esc(s.name) + '">' +
          '<span class="lineup-name">' + esc(s.name) + '</span>' +
          '<span class="lineup-role">' + esc(s.role) + '</span>' +
        '</button>'
      );
      card.onclick = function () {
        picked = s.id;
        lineup.querySelectorAll('.lineup-card').forEach(function (c) { c.classList.remove('picked'); });
        card.classList.add('picked');
        document.getElementById('confirmAccuse').disabled = false;
      };
      lineup.appendChild(card);
    });
    document.getElementById('confirmAccuse').onclick = function () {
      if (picked === CASE.culprit) renderDeduction();
      else renderEnding(false);
    };
  }

  function renderDeduction() {
    accuseStage = 'deduction';
    currentScreen = 'accuse';
    var d = CASE.deduction[dedIndex];
    var node = el(
      '<div class="wrap narrow">' +
        '<div class="page-head center">' +
          '<p class="kicker">Answer for it &middot; ' + (dedIndex + 1) + ' of ' + CASE.deduction.length + '</p>' +
          '<h2 class="page-title sm">' + esc(d.question) + '</h2>' +
          '<p class="page-sub">Three mistakes and the case falls apart.</p>' +
        '</div>' +
        '<div class="answers" id="answers"></div>' +
        '<div class="strike-row" id="strikes">' + strikeRow() + '</div>' +
        '<div id="dedNext" class="center-row"></div>' +
      '</div>'
    );
    mount('accuse', node);
    var list = document.getElementById('answers');
    d.options.forEach(function (opt, oi) {
      var b = el('<button class="answer">' + esc(opt) + '</button>');
      b.onclick = function () {
        if (oi === d.correct) {
          b.classList.add('right');
          list.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
          var next = el('<p class="explain">' + esc(d.explain) + '</p>');
          document.getElementById('dedNext').appendChild(next);
          var nextIndex = dedIndex + 1;
          var nb = el('<button class="btn-primary">' + (nextIndex < CASE.deduction.length ? 'Next question' : 'Present the evidence') + '</button>');
          document.getElementById('dedNext').appendChild(nb);
          nb.onclick = function () {
            if (nextIndex < CASE.deduction.length) { dedIndex = nextIndex; renderDeduction(); }
            else renderEvidence();
          };
        } else {
          b.classList.add('wrong');
          b.disabled = true;
          strikes++;
          document.getElementById('strikes').innerHTML = strikeRow();
          if (strikes >= 3) renderEnding(false);
        }
      };
      list.appendChild(b);
    });
  }

  function strikeRow() {
    var out = '';
    for (var i = 0; i < 3; i++) out += '<span class="strike' + (i < strikes ? ' spent' : '') + '"></span>';
    return '<span class="strike-label">Credibility</span>' + out;
  }

  function renderEvidence() {
    accuseStage = 'evidence';
    currentScreen = 'accuse';
    evidencePicks = {};
    var found = state.clues.map(clueInfo).filter(Boolean);
    var node = el(
      '<div class="wrap">' +
        '<div class="page-head center">' +
          '<p class="kicker">The proof</p>' +
          '<h2 class="page-title sm">Present the two pieces that convict</h2>' +
          '<p class="page-sub">From everything on your board, pick the evidence a jury could not argue with. Both, or it does not hold.</p>' +
        '</div>' +
        '<div class="ev-pick-grid" id="evGrid"></div>' +
        '<div class="strike-row" id="strikes">' + strikeRow() + '</div>' +
        '<p class="hint-line" id="evHint"></p>' +
        '<div class="center-row"><button class="btn-primary" id="evSubmit" disabled>Present the evidence</button></div>' +
      '</div>'
    );
    mount('accuse', node);
    var grid = document.getElementById('evGrid');
    if (!found.length) {
      grid.appendChild(el('<p class="page-sub">Your notebook is empty. Nothing to present.</p>'));
    }
    found.forEach(function (c) {
      var b = el(
        '<button class="ev-pick" data-id="' + esc(c.id) + '">' +
          '<span class="pc-kind">' + esc(c.kind) + ' &middot; ' + esc(c.where) + '</span>' +
          '<span class="pc-title">' + esc(c.title) + '</span>' +
        '</button>'
      );
      b.onclick = function () {
        var cid = b.getAttribute('data-id');
        if (evidencePicks[cid]) { delete evidencePicks[cid]; b.classList.remove('picked'); }
        else if (Object.keys(evidencePicks).length < 2) { evidencePicks[cid] = true; b.classList.add('picked'); }
        document.getElementById('evSubmit').disabled = Object.keys(evidencePicks).length !== 2;
      };
      grid.appendChild(b);
    });
    document.getElementById('evSubmit').onclick = function () {
      var need = CASE.evidenceAnswer;
      var have = Object.keys(evidencePicks);
      var good = have.length === 2 && need.every(function (n) { return have.indexOf(n) >= 0; });
      if (good) {
        act({ k: 'solve' }, true);
        renderEnding(true);
      } else {
        strikes++;
        document.getElementById('strikes').innerHTML = strikeRow();
        if (strikes >= 3) { renderEnding(false); return; }
        document.getElementById('evHint').textContent = CASE.evidenceHint;
        document.getElementById('evSubmit').disabled = true;
        evidencePicks = {};
        grid.querySelectorAll('.ev-pick').forEach(function (x) { x.classList.remove('picked'); });
      }
    };
  }

  function renderEnding(win, replay) {
    currentScreen = 'ending';
    var foundTotal = state.clues.length;
    var node = el(
      '<div class="wrap narrow">' +
        '<div class="ending ' + (win ? 'won' : 'lost') + '">' +
          '<p class="kicker">' + (win ? 'Case file 01 &middot; closed' : 'The accusation fails') + '</p>' +
          '<h2 class="page-title">' + (win ? 'Case closed' : 'Wrong call') + '</h2>' +
          '<p class="ending-text">' + esc(win ? CASE.winText : CASE.loseText) + '</p>' +
          (win ? '<p class="ending-stats">Evidence filed: ' + foundTotal + ' of ' + totalClues() + (partnerRole ? ' &middot; ' + esc(roleName()) : '') + '</p>' : '') +
          '<div class="center-row">' +
            (win
              ? '<button class="btn-primary" id="againBtn">Reopen the case</button><button class="btn-quiet" id="mapBtn">Walk the city</button>'
              : '<button class="btn-primary" id="mapBtn">Back to the city</button>') +
          '</div>' +
        '</div>' +
      '</div>'
    );
    mount('ending', node);
    var again = document.getElementById('againBtn');
    if (again) again.onclick = function () { act({ k: 'reset' }); renderStart(); };
    document.getElementById('mapBtn').onclick = renderMap;
  }

  /* ---------- co-op: sync modal, links, wiring ---------- */

  function copyProgressLink() {
    var url = location.origin + location.pathname + '#s=' + SYNC.encodeState(state);
    copyText(url, 'Progress link copied - send it to your partner');
  }

  function copyText(text, doneMsg) {
    function ok() { toast(doneMsg); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { legacy(); });
    } else legacy();
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { toast('Copy failed - select the code manually'); }
      ta.remove();
    }
  }

  /* ---------- progress link in the URL ---------- */

  function checkHashState() {
    var h = location.hash || '';
    if (h.indexOf('#s=') !== 0) return;
    var incoming = SYNC.decodeState(h.slice(3));
    history.replaceState(history.state, '', location.pathname);
    if (!incoming) return;
    var hasIncoming = incoming.clues.length || Object.keys(incoming.visited).length;
    if (!hasIncoming) return;
    var m = el(
      '<div class="overlay" role="dialog" aria-modal="true">' +
        '<div class="ev-card">' +
          '<p class="ev-stamp">Progress link</p>' +
          '<h3 class="ev-title">A partner&#39;s notebook is in this link</h3>' +
          '<p class="ev-text">' + incoming.clues.length + ' pieces of evidence, ' + Object.keys(incoming.visited).length + ' locations visited. Merge it with your own case, or take it as your starting point.</p>' +
          '<div class="ev-actions">' +
            '<button class="btn-primary" id="hashMerge">Merge with mine</button>' +
            '<button class="btn-quiet" id="hashReplace">Start from theirs</button>' +
            '<button class="btn-quiet" id="hashIgnore">Ignore</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    openOverlay(m);
    m.querySelector('#hashMerge').onclick = function () {
      state = SYNC.mergeState(state, incoming);
      save(); leaveOverlay(renderStart);
      toast('Notebooks merged');
    };
    m.querySelector('#hashReplace').onclick = function () {
      state = incoming;
      save(); leaveOverlay(renderStart);
      toast('Case loaded from the link');
    };
    m.querySelector('#hashIgnore').onclick = closeOverlay;
  }

  /* ---------- 3D walk mode ---------- */

  function renderWalk() {
    document.querySelectorAll('.overlay').forEach(function (x) { x.remove(); });
    overlayOpen = false;
    currentScreen = 'walk';
    app.innerHTML = '';
    syncRoute();
    window.scrollTo(0, 0);
    document.body.classList.add('in-walk');
    var ok = window.Walk3D && window.Walk3D.start(walkApi);
    if (!ok) { document.body.classList.remove('in-walk'); toast('3D needs WebGL, which this browser has turned off. Showing the classic view.'); renderMap(); }
  }
  var _mount = mount;
  mount = function (active, node) { document.body.classList.remove('in-walk'); return _mount(active, node); };
  var _renderStart = renderStart;
  var walkApi = {
    getCase: function () { return CASE; }, mount: app,
    cases: function () { return registry.map(function (r) { var c = r.loader(); return { id: r.id, title: c.title, city: c.city, current: c === CASE }; }); },
    setCase: setCase,
    state: function () { return state; },
    act: function (a) { return act(a, true); },
    suspect: suspectById,
    toast: toast,
    go: {
      map: function () { renderMap(); }, board: function () { renderBoard(); }, phone: function () { renderPhone(); }, accuse: function () { renderAccuse(); },
      walk: function () { renderWalk(); }, start: function () { renderStart(); }, classic: function () { document.body.classList.remove('in-walk'); _renderStart(); }
    }
  };
  renderStart = function () {
    document.body.classList.remove('in-walk');
    if (window.Walk3D && !partnerRole) {
      currentScreen = 'start'; document.body.classList.add('in-walk'); syncRoute();
      if (window.Walk3D.landing(walkApi)) return;
      document.body.classList.remove('in-walk');
    }
    return _renderStart();
  };

  function boot() { renderStart(); checkHashState(); }
  if (window.THREE || document.readyState === 'complete') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
