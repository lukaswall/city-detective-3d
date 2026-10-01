/* City Detective - Walk mode.
   A first-person 3D night Bangkok built from the case data: walk the street,
   enter each location, examine evidence in the room, question the people there.
   Everything is procedural (three.js r128, no extra assets except the existing art).
   Controls: arrows / WASD, drag to look, touch joystick + drag to look, E / Space / tap to act. */
(function () {
  'use strict';
  var T = null; // three.min.js is deferred; resolved in start()
  var HEAD = 1.62;
  var Walk = { start: start };
  window.Walk3D = Walk;

  var last = { where: 'street', x: -56, z: 4, yaw: -Math.PI / 2 };

  /* ---------- tiny helpers ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function mk(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  var seed = 7;
  function srand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }
  var glowTex = null;
  function glowTexture() {
    if (glowTex) return glowTex;
    glowTex = canvasTex(64, 64, function (g, w, h) {
      var r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    });
    return glowTex;
  }
  function glow(color, size, x, y, z, op) {
    var s = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(), color: color, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: op == null ? 0.9 : op, fog: false }));
    s.scale.set(size, size, 1); s.position.set(x, y, z);
    return s;
  }
  var matCache = {};
  function lam(color, emissive, ei) {
    var k = color + ':' + (emissive || 0) + ':' + (ei || 0);
    if (!matCache[k]) matCache[k] = new T.MeshLambertMaterial({ color: color, emissive: emissive || 0x000000, emissiveIntensity: ei == null ? 1 : ei });
    return matCache[k];
  }
  function box(p, w, h, d, color, x, y, z, emissive, ei) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), lam(color, emissive, ei));
    m.position.set(x, y, z); p.add(m); return m;
  }
  function cyl(p, rt, rb, h, color, x, y, z, seg, emissive) {
    var m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 12), lam(color, emissive));
    m.position.set(x, y, z); p.add(m); return m;
  }
  function plane(p, w, h, mat, x, y, z, ry) {
    var m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); if (ry) m.rotation.y = ry; p.add(m); return m;
  }
  function textTex(lines, w, h, opts) {
    opts = opts || {};
    return canvasTex(w, h, function (g) {
      g.fillStyle = opts.bg || 'rgba(0,0,0,0)'; g.fillRect(0, 0, w, h);
      if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16); }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach(function (l) {
        g.font = l.font; g.fillStyle = l.color;
        if (l.shadow) { g.shadowColor = l.shadow; g.shadowBlur = 18; } else g.shadowBlur = 0;
        g.fillText(l.text, w / 2, l.y);
      });
    });
  }

  /* ---------- audio: soft rain + tiny cues ---------- */
  var audio = null;
  function initAudio() {
    if (audio || !(window.AudioContext || window.webkitAudioContext)) return;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
      var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      var g = ctx.createGain(); g.gain.value = 0.07;
      src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
      audio = { ctx: ctx, rain: g, muted: false, f: f };
    } catch (e) { audio = null; }
  }
  function beep(freq, dur, vol) {
    if (!audio || audio.muted) return;
    try {
      var o = audio.ctx.createOscillator(), g = audio.ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq; g.gain.value = vol || 0.05;
      g.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + dur);
      o.connect(g); g.connect(audio.ctx.destination); o.start(); o.stop(audio.ctx.currentTime + dur);
    } catch (e) {}
  }
  function setMuted(m) { if (!audio) return; audio.muted = m; audio.rain.gain.value = m ? 0 : 0.07; }


  var CUR_TH = null;
  function skylineTex(TH, seed) {
    return canvasTex(1024, 512, function (c, w, h) {
      var gr = c.createLinearGradient(0, 0, 0, h);
      var sky = '#' + ('000000' + TH.fog.toString(16)).slice(-6);
      gr.addColorStop(0, '#05080c'); gr.addColorStop(0.7, sky); gr.addColorStop(1, '#' + ('000000' + TH.bg.toString(16)).slice(-6));
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (var layer = 0; layer < 3; layer++) {
        var x = -20, base = h - 10 - layer * 18, shade = 10 + layer * 8;
        while (x < w) {
          var bw = 30 + srand() * 60, bh = (TH.solid ? 60 + srand() * 50 : 80 + srand() * (TH.hvar > 10 ? 300 : 120)) * (1 - layer * 0.18);
          c.fillStyle = 'rgb(' + shade + ',' + (shade + 4) + ',' + (shade + 10) + ')'; c.fillRect(x, base - bh, bw, bh + 40);
          if (layer < 2) for (var wy = base - bh + 8; wy < base - 4; wy += 11) for (var wx = x + 4; wx < x + bw - 6; wx += 9) {
            if (srand() < 0.35) { var cc = TH.win[(srand() * 3) | 0]; c.fillStyle = 'rgba(' + cc[0] + ',' + cc[1] + ',' + cc[2] + ',' + (0.35 + srand() * 0.5) + ')'; c.fillRect(wx, wy, 4, 6); }
          }
          x += bw + srand() * 6;
        }
      }
      var rg = c.createRadialGradient(w * 0.7, h * 0.9, 10, w * 0.7, h * 0.9, w * 0.6);
      var lc = TH.lamp; rg.addColorStop(0, 'rgba(' + ((lc >> 16) & 255) + ',' + ((lc >> 8) & 255) + ',' + (lc & 255) + ',0.25)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg; c.fillRect(0, 0, w, h);
    });
  }
  var SKIN = [0xe0b48c, 0xc89870, 0xa8764f, 0x8a5a3a, 0xf0c8a0], HAIR = [0x111111, 0x2a1a10, 0x6a4a2a, 0xb8b8b8, 0x1a1a22];
  function makeFigure(grp, key) {
    var h = 0; for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    var skin = SKIN[h % 5], hair = HAIR[(h >> 3) % 5], coatC = [0x2a2d36, 0x4a2a2a, 0x1f3a3a, 0x3a3326, 0x2a2a4a, 0x5a4a2a][(h >> 5) % 6], trC = 0x14161a;
    var skirt = (h >> 9) % 3 === 0;
    cyl(grp, 0.1, 0.09, 0.8, trC, -0.12, 0.4, 0, 8); cyl(grp, 0.1, 0.09, 0.8, trC, 0.12, 0.4, 0, 8);
    box(grp, 0.2, 0.1, 0.34, 0x0a0a0a, -0.12, 0.05, 0.05); box(grp, 0.2, 0.1, 0.34, 0x0a0a0a, 0.12, 0.05, 0.05);
    var torso = cyl(grp, 0.24, 0.3, 0.7, coatC, 0, 1.15, 0, 10);
    if (skirt) cyl(grp, 0.3, 0.44, 0.55, coatC, 0, 0.62, 0, 10);
    var a1 = cyl(grp, 0.07, 0.06, 0.7, coatC, -0.34, 1.12, 0, 7); a1.rotation.z = 0.12; var a2 = cyl(grp, 0.07, 0.06, 0.7, coatC, 0.34, 1.12, 0, 7); a2.rotation.z = -0.12;
    var hd = new T.Group(); hd.position.y = 1.58; grp.add(hd);
    cyl(hd, 0.07, 0.08, 0.14, skin, 0, -0.18, 0, 8);
    var head = new T.Mesh(new T.SphereGeometry(0.17, 14, 12), lam(skin)); hd.add(head);
    var cap = new T.Mesh(new T.SphereGeometry(0.18, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), lam(hair)); cap.position.y = 0.02; cap.rotation.x = -0.25; hd.add(cap);
    box(hd, 0.04, 0.03, 0.03, 0x111111, -0.06, 0.02, 0.15); box(hd, 0.04, 0.03, 0.03, 0x111111, 0.06, 0.02, 0.15);
    if ((h >> 12) % 3 === 0) { var hat = cyl(hd, 0.16, 0.2, 0.06, 0x14110d, 0, 0.17, 0, 14); cyl(hd, 0.14, 0.14, 0.12, 0x14110d, 0, 0.23, 0, 14); }
    if ((h >> 14) % 3 === 1) { box(hd, 0.2, 0.025, 0.02, 0x222, 0, 0.02, 0.17); }
    return hd;
  }

  /* ---------- room blueprints ---------- */
  // spots: [x, z, y] where evidence/detail markers float. npc: [x, z].
  var BP = {
    gallery: { W: 18, D: 14, H: 5, open: false, wall: 0xb9b2a3, floor: 0x3a3733, ambient: [0x9aa6b8, 0x2a2420, 0.9],
      spots: [[2.2, -0.2, 1.35], [0, -1, 2.4], [7.6, -5.6, 3.9], [-6, 3, 1.15], [-7.7, -3, 2.7], [6.5, 3.6, 1.1]], npc: [-2.6, -1.6], door: 7 },
    pier: { W: 20, D: 14, H: 0, open: true, wall: 0x3a2c20, floor: 0x5a4634, ambient: [0x6f86a0, 0x1a1410, 0.85],
      spots: [[5, -4, 1.9], [0.5, 2.6, 1.1], [], [], [-6, -2.4, 1.7], [8.2, -6, 2.6]], npc: [-2.5, -0.5], door: 7 },
    studio: { W: 14, D: 11, H: 4, open: false, wall: 0x6b5a45, floor: 0x4a382a, ambient: [0xb09870, 0x2a1d12, 0.95],
      spots: [[-3, -3.4, 1.5], [4, -4.1, 1.4], [5.4, 1.2, 0.95], [-5, 1.6, 1.3], [0.6, -4.7, 1.95], [-1.5, -3.4, 1.95]], npc: [2, 0.2], door: 5.5 },
    market: { W: 22, D: 14, H: 0, open: true, wall: 0x2b2420, floor: 0x4a443f, ambient: [0x9a8aa0, 0x241a14, 0.95],
      spots: [[5, -2, 1.5], [-4, -3, 1.5], [], [], [0, -6, 3.3], [-7, 3.6, 1.4]], npc: [0.5, 1.0], door: 7 },
    bar: { W: 16, D: 11, H: 4, open: false, wall: 0x3a2a30, floor: 0x3a2a2e, ambient: [0xa088a0, 0x20121a, 0.95],
      spots: [[-2, -2.5, 1.45], [5.4, 2, 1.2], [], [], [-7.3, 0, 2.2], [0, 1, 3.4]], npc: [3.4, -0.6], door: 5.5 },
    tuktuk: { W: 18, D: 12, H: 0, open: true, wall: 0x2c2a27, floor: 0x3f3c38, ambient: [0x7f8ea5, 0x181410, 0.9],
      spots: [[-4.2, -1, 1.3], [], [], [], [7, -5, 3.2], [-7, -3, 3.8]], npc: [1.6, -0.8], door: 6 }
  };
  // which flavor index uses which spot (flavor takes spots after the searches, in order)
  function spotsFor(id, loc) {
    var bp = BP[id], out = { search: [], flavor: [] }, sp = bp.spots;
    var si = 0, taken = {};
    loc.searches.forEach(function (s, i) { out.search.push(sp[i]); taken[i] = 1; });
    var fl = (loc.flavor || []);
    // flavor spots are the last two entries of the spot list
    out.flavor = [sp[sp.length - 2], sp[sp.length - 1]].slice(0, fl.length);
    return out;
  }

  function buildRoom(lid, loc, root) {
    var id = loc.room || lid;
    var bp = BP[id], W = bp.W, D = bp.D, H = bp.H, g = new T.Group();
    var colliders = [];
    // floor
    var floorMat = lam(bp.floor);
    plane(g, W, D, floorMat, 0, 0, 0).rotation.x = -Math.PI / 2;
    if (!bp.open) {
      var wm = lam(bp.wall);
      box(g, W, H, 0.3, bp.wall, 0, H / 2, -D / 2 - 0.15);
      box(g, 0.3, H, D, bp.wall, -W / 2 - 0.15, H / 2, 0);
      box(g, 0.3, H, D, bp.wall, W / 2 + 0.15, H / 2, 0);
      box(g, W, H, 0.3, bp.wall, 0, H / 2, D / 2 + 0.15);
      box(g, W, 0.2, D, 0x23242a, 0, H + 0.1, 0, 0x16171c, 1);
      // ceiling light strips
      for (var i = -1; i <= 1; i++) box(g, 0.1, 0.04, D * 0.7, 0x8a8478, i * W * 0.28, H - 0.04, 0, 0xb8a888, 0.35);
    } else {
      // open-air: water or ground, low fences at the bounds
      var water = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshBasicMaterial({ color: id === 'pier' ? 0x061a22 : 0x0c0d10 }));
      water.rotation.x = -Math.PI / 2; water.position.y = -0.6; g.add(water);
      var rail = 0x2a2018;
      box(g, W, 0.08, 0.08, rail, 0, 1.0, D / 2 - 0.1); box(g, 0.08, 0.08, D, rail, -W / 2 + 0.1, 1.0, 0); box(g, 0.08, 0.08, D, rail, W / 2 - 0.1, 1.0, 0);
      box(g, W, 0.08, 0.08, rail, 0, 1.0, -D / 2 + 0.1);
      for (var k = -W / 2 + 0.1; k <= W / 2; k += 3) { box(g, 0.1, 1.0, 0.1, rail, k, 0.5, D / 2 - 0.1); box(g, 0.1, 1.0, 0.1, rail, k, 0.5, -D / 2 + 0.1); }
      for (var z = -D / 2 + 3; z < D / 2; z += 3) { box(g, 0.1, 1.0, 0.1, rail, -W / 2 + 0.1, 0.5, z); box(g, 0.1, 1.0, 0.1, rail, W / 2 - 0.1, 0.5, z); }
    }
    // plank lines on the pier
    if (id === 'pier') for (var p = -W / 2 + 1; p < W / 2; p += 1.2) box(g, 0.04, 0.02, D, 0x1c140e, p, 0.011, 0);
    // procedural skyline backdrop (drawn in code, same palette as the street)
    var TH0 = CUR_TH || THEMES.thailand;
    var skyTex = skylineTex(TH0, id);
    var artMat = new T.MeshBasicMaterial({ map: skyTex, fog: false });
    var art;
    if (bp.open) {
      art = plane(g, 150, 75, artMat, 0, 30, -D / 2 - 60);
    } else {
      var winW = Math.min(W * 0.5, 8), winH = Math.min(H - 1.4, 2.4);
      art = plane(g, winW, winH, artMat, 0, 2.0 + 0.0, -D / 2 + 0.02);
      art.position.y = Math.min(H - winH / 2 - 0.5, 2.3);
      [[0, winH / 2 + 0.06, winW + 0.3, 0.12], [0, -winH / 2 - 0.06, winW + 0.3, 0.12]].forEach(function (f) { box(g, f[2], f[3], 0.1, 0x14110d, 0, art.position.y + f[1], -D / 2 + 0.05); });
      for (var wm2 = -2; wm2 <= 2; wm2++) box(g, 0.08, winH, 0.1, 0x14110d, wm2 * winW / 4, art.position.y, -D / 2 + 0.05);
      g.add(glow(TH0.lamp, 6, 0, art.position.y, -D / 2 + 1.2, 0.18));
    }
    // exit marker
    var ex = box(g, 2.2, 3.0, 0.15, 0x0d0f12, bp.door === undefined ? 0 : 0, 1.5, D / 2 - 0.05, 0xc9a24b, 0.55);
    ex.position.x = 0;
    var exLabel = plane(g, 2.6, 0.5, new T.MeshBasicMaterial({ map: textTex([{ text: 'STREET', font: '600 62px "IBM Plex Mono"', color: '#e8c87e', y: 50, shadow: '#c9a24b' }], 400, 100), transparent: true, depthWrite: false }), 0, 3.3, D / 2 - 0.2, Math.PI);
    g.add(glow(0xc9a24b, 5, 0, 1.5, D / 2 - 0.6, 0.35));

    // spot plinths + props per room
    var S = spotsFor(id, loc);
    function plinth(s, c) { if (!s || !s.length) return; if (s[2] < 2) { cyl(g, 0.26, 0.3, Math.max(0.2, s[2] - 0.38), c || 0x3a342c, s[0], (s[2] - 0.38) / 2, s[1], 10); colliders.push([s[0], s[1], 0.5]); } }
    function lampAt(x, y, z, c, s) { g.add(glow(c, s || 3, x, y, z, 0.8)); }

    if (id === 'gallery') {
      box(g, 1.3, 1.1, 1.3, 0xe8e2d4, 0, 0.55, -1);
      var glass = new T.Mesh(new T.BoxGeometry(1.2, 1.0, 1.2), new T.MeshLambertMaterial({ color: 0x9fc8d8, transparent: true, opacity: 0.22, emissive: 0x335566 }));
      glass.position.set(0, 1.6, -1); g.add(glass);
      box(g, 0.5, 0.1, 0.4, 0x1f6b4e, 0, 1.16, -1, 0x0a3a28);
      colliders.push([0, -1, 1.05]);
      box(g, 0.3, 1.2, 0.3, 0x222226, 2.2, 0.6, -0.2); colliders.push([2.2, -0.2, 0.5]);
      box(g, 0.4, 0.5, 0.2, 0x0b0d10, 2.2, 1.0, -0.2, 0x3fae87, 0.6);
      [-8.4, 8.4].forEach(function (x) { });
      for (var b = 0; b < 3; b++) {
        var bm = new T.MeshLambertMaterial({ color: 0x1c6a6a, emissive: 0x0b2e2e, side: T.DoubleSide });
        plane(g, 1.3, 3.6, bm, -8.6 + 0, 2.6, -5.2 + b * 2.4, Math.PI / 2).position.x = -8.7;
        box(g, 0.04, 2.4, 0.04, 0xc9a24b, -8.66, 2.6, -5.2 + b * 2.4, 0x6a5420);
      }
      box(g, 2.6, 0.45, 0.7, 0x2a2018, -6, 0.22, 3); colliders.push([-6, 3, 1.3]);
      box(g, 2.6, 0.45, 0.7, 0x2a2018, 6.5, 0.22, 3.6); colliders.push([6.5, 3.6, 1.3]);
      cyl(g, 0.12, 0.12, 0.3, 0x111111, 7.6, 3.75, -5.6, 8);
      box(g, 0.35, 0.25, 0.35, 0x111114, 7.6, 3.6, -5.6);
      lampAt(0, 4.4, -1, 0xfff3d0, 5);
    }
    if (id === 'studio') {
      box(g, 3.2, 0.9, 1.1, 0x4a3a2a, -3, 0.45, -3.9); colliders.push([-3, -3.9, 1.7]);
      box(g, 0.15, 1.1, 0.15, 0x222, -1.5, 1.5, -3.6); box(g, 0.7, 0.08, 0.08, 0x222, -1.8, 2.0, -3.6); lampAt(-2.1, 1.95, -3.6, 0xffd9a0, 2.5);
      box(g, 1.6, 1.8, 0.8, 0x3a2f24, 4, 0.9, -4.6); colliders.push([4, -4.6, 1.2]);
      cyl(g, 0.45, 0.4, 0.9, 0x555a60, 5.4, 0.45, 1.2, 12);
      box(g, 2.0, 0.8, 0.9, 0x3a2f24, -5, 0.4, 1.6); colliders.push([-5, 1.6, 1.3]);
      box(g, 5, 0.08, 0.5, 0x2a1f16, 0.5, 1.6, -5.1); box(g, 5, 0.08, 0.5, 0x2a1f16, 0.5, 2.5, -5.1);
      for (var j = 0; j < 8; j++) cyl(g, 0.12, 0.12, 0.35, [0x3fae87, 0xc9a24b, 0x8a6a4a][j % 3], -1.5 + j * 0.65, 1.8, -5.1, 8);
      cyl(g, 0.3, 0.34, 0.5, 0xb89b4a, 0.6, 2.2, -5.0, 10, 0x3a2e0a);
      lampAt(0, 3.4, 0, 0xffd9a0, 6);
    }
    if (id === 'bar') {
      box(g, 8, 1.1, 1.0, 0x2a1a14, 0, 0.55, -2.8); colliders.push([-3, -2.8, 1.2], [0, -2.8, 1.2], [3, -2.8, 1.2]);
      box(g, 8.2, 0.08, 1.2, 0x120c0a, 0, 1.12, -2.8);
      for (var s2 = -3; s2 <= 3; s2 += 1.5) { cyl(g, 0.22, 0.22, 0.06, 0x7a2a2a, s2, 0.72, -1.7, 12); cyl(g, 0.04, 0.04, 0.7, 0x333, s2, 0.36, -1.7, 6); }
      box(g, 8, 2.2, 0.3, 0x1a1210, 0, 1.6, -D / 2 + 0.5);
      for (var q = 0; q < 14; q++) cyl(g, 0.1, 0.1, 0.4 + (q % 3) * 0.1, [0x3fae87, 0xc9a24b, 0x8a3a2a][q % 3], -3.6 + q * 0.55, 2.0, -D / 2 + 0.6, 8);
      box(g, 2.6, 0.5, 0.06, 0x200808, 0, 3.3, -D / 2 + 0.7, 0xff3a4a, 1.2);
      lampAt(0, 3.3, -D / 2 + 1.2, 0xff3a4a, 6);
      box(g, 1.4, 0.07, 1.4, 0x20140e, 5.4, 0.95, 2); cyl(g, 0.06, 0.06, 0.9, 0x111, 5.4, 0.45, 2, 6); colliders.push([5.4, 2, 1.0]);
      box(g, 0.08, 1.6, 3, 0x0d1a2a, -W / 2 + 0.2, 2.2, 0, 0x2a6a9a, 0.7);
      lampAt(-W / 2 + 1, 2.2, 0, 0x4a8acc, 4);
      for (var bl = -4; bl <= 4; bl += 2) { cyl(g, 0.01, 0.01, 1.2, 0x111, bl, 3.4, 1, 4); lampAt(bl, 2.8, 1, 0xffc070, 1.4); }
      lampAt(0, 3.1, 1, 0xffc070, 3);
    }
    if (id === 'pier') {
      box(g, 2.4, 2.2, 1.6, 0x4a3320, -6, 1.1, -2.4); box(g, 2.8, 0.15, 2, 0x20150d, -6, 2.3, -2.4); colliders.push([-6, -2.4, 1.6]);
      box(g, 0.1, 2.4, 0.1, 0x222, 5, 1.2, -4.1); box(g, 1.8, 1.0, 0.1, 0x10151a, 5, 2.0, -4.15, 0x2a5a6a, 0.5); colliders.push([5, -4.1, 1.0]);
      box(g, 1.8, 0.5, 0.6, 0x2a2018, 0.5, 0.25, 2.6); colliders.push([0.5, 2.6, 1.2]);
      for (var l = -8; l <= 8; l += 4) { cyl(g, 0.08, 0.08, 3, 0x1a1410, l, 1.5, D / 2 - 0.4, 6); lampAt(l, 3.1, D / 2 - 0.4, 0xffb060, 3.4); }
      for (var bo = -7; bo <= 7; bo += 5) cyl(g, 0.18, 0.2, 0.7, 0x111, bo, 0.35, -D / 2 + 0.6, 8);
      // the far bank: Wat Arun-style prang
      var pr = new T.Group(); pr.position.set(14, -0.6, -18);
      cyl(pr, 2.6, 3.2, 3, 0x3a3a40, 0, 1.5, 0, 6); cyl(pr, 1.8, 2.6, 3, 0x44444c, 0, 4.5, 0, 6);
      cyl(pr, 0.6, 1.8, 5, 0x4a4a52, 0, 8.5, 0, 6); cyl(pr, 0.05, 0.4, 2.5, 0x6a6a40, 0, 12.2, 0, 6);
      pr.add(glow(0xffcf80, 10, 0, 6, 1.5, 0.35)); g.add(pr);
    }
    if (id === 'market') {
      var cols = [0xa83a3a, 0x2a7a6a, 0xc9a24b, 0x6a3a8a];
      [[-8, -3], [-4, -3], [5, -2], [9, -3], [-8, 3]].forEach(function (p, i) {
        box(g, 3, 1.0, 1.4, 0x3a2a1c, p[0], 0.5, p[1]); colliders.push([p[0] - 0.9, p[1], 1.0], [p[0] + 0.9, p[1], 1.0]);
        box(g, 0.1, 2.4, 0.1, 0x222, p[0] - 1.4, 1.2, p[1] - 0.6); box(g, 0.1, 2.4, 0.1, 0x222, p[0] + 1.4, 1.2, p[1] - 0.6);
        var aw = box(g, 3.4, 0.08, 1.8, cols[i % 4], p[0], 2.4, p[1] - 0.1, cols[i % 4], 0.35); aw.rotation.x = 0.15;
        lampAt(p[0], 2.1, p[1] + 0.2, 0xffc070, 2.2);
        for (var c = 0; c < 4; c++) cyl(g, 0.16, 0.16, 0.22, [0xd9a040, 0x8a3a2a, 0x3fae87][c % 3], p[0] - 1.0 + c * 0.65, 1.12, p[1], 8);
      });
      for (var x2 = -9; x2 <= 9; x2 += 1.5) lampAt(x2, 3.4 + Math.sin(x2) * 0.15, -6, 0xffcf80, 1.6);
      for (var x3 = -9; x3 <= 9; x3 += 1.5) lampAt(x3, 3.4, 1, 0xffcf80, 1.4);
      box(g, 1.6, 1.0, 1.0, 0x6a6a70, -7, 0.5, 3.6); colliders.push([-7, 3.6, 1.1]);
      for (var cr = 0; cr < 5; cr++) box(g, 0.7, 0.6, 0.7, 0x4a3820, 8 + (cr % 2) * 0.7, 0.3 + (cr > 2 ? 0.6 : 0), 4 - (cr % 3) * 0.7);
    }
    if (id === 'tuktuk') {
      var tt = new T.Group(); tt.position.set(-2, 0, -2.4); tt.rotation.y = 0.25;
      box(tt, 2.4, 0.7, 1.2, 0x2a8a5a, 0, 0.75, 0); box(tt, 1.1, 0.6, 1.2, 0x2a8a5a, 1.0, 1.35, 0, 0x0a2a1a);
      box(tt, 2.6, 0.08, 1.4, 0xc9a24b, -0.1, 2.0, 0); box(tt, 0.06, 0.7, 0.06, 0x222, 1.5, 1.65, 0.55); box(tt, 0.06, 0.7, 0.06, 0x222, -1.2, 1.65, 0.55); box(tt, 0.06, 0.7, 0.06, 0x222, -1.2, 1.65, -0.55);
      cyl(tt, 0.35, 0.35, 0.2, 0x111111, 1.3, 0.35, 0, 14).rotation.x = Math.PI / 2;
      cyl(tt, 0.35, 0.35, 0.2, 0x111111, -0.9, 0.35, 0.65, 14).rotation.x = Math.PI / 2;
      cyl(tt, 0.35, 0.35, 0.2, 0x111111, -0.9, 0.35, -0.65, 14).rotation.x = Math.PI / 2;
      tt.add(glow(0xfff0b0, 2, 1.7, 0.9, 0, 0.9)); g.add(tt); colliders.push([-2, -2.4, 1.6], [-0.8, -2.2, 1.0]);
      box(g, 0.12, 1.4, 0.12, 0x222, -4.2, 0.7, -1); box(g, 1.2, 0.8, 0.08, 0x14181c, -4.2, 1.7, -1.1, 0x3a5a4a, 0.5); colliders.push([-4.2, -1, 0.9]);
      cyl(g, 0.08, 0.1, 4, 0x1a1a1c, -7, 2, -3, 6); lampAt(-7, 4.0, -3, 0xffc070, 4);
      var tg = new T.Group(); tg.position.set(8, -0.6, -20);
      box(tg, 8, 2.5, 3, 0x3a3a40, 0, 1.2, 0); cyl(tg, 0.4, 1.8, 6, 0x4a4a52, -2, 5.5, 0, 6); cyl(tg, 0.3, 1.3, 5, 0x4a4a52, 1.5, 5, 0, 6); tg.add(glow(0xffcf80, 12, 0, 4, 2, 0.3)); g.add(tg);
    }

    // glowing spots with plinths
    var items = [];
    function addItem(kind, data, s, loc2) {
      if (!s || !s.length) return;
      plinth(s);
      var grp = new T.Group(); grp.position.set(s[0], s[2], s[1]);
      var isEv = kind === 'evidence';
      var mesh = new T.Mesh(isEv ? new T.OctahedronGeometry(0.17, 0) : new T.SphereGeometry(0.09, 10, 8),
        new T.MeshBasicMaterial({ color: isEv ? 0xe8c87e : 0xcfd6dd }));
      grp.add(mesh);
      var gl = glow(isEv ? 0xe8b84b : 0x9aa6b3, isEv ? 1.5 : 0.7, 0, 0, 0, isEv ? 0.95 : 0.45); grp.add(gl);
      g.add(grp);
      items.push({ kind: kind, data: data, grp: grp, mesh: mesh, glow: gl, x: s[0], z: s[1], y: s[2], range: 3.1 });
    }
    loc.searches.forEach(function (s, i) { addItem('evidence', s, S.search[i]); });
    (loc.flavor || []).forEach(function (f, i) { addItem('flavor', f, S.flavor[i]); });

    // person
    var npc = null;
    if (loc.person && bp.npc) {
      var sus = null; // resolved by caller via data; we set a placeholder group
      var pg = new T.Group(); pg.position.set(bp.npc[0], 0, bp.npc[1]);
      npc = { group: pg, x: bp.npc[0], z: bp.npc[1], suspectId: loc.person.suspectId };
      g.add(pg); colliders.push([bp.npc[0], bp.npc[1], 0.7]);
    }
    g.visible = false; root.add(g);
    return { id: lid, group: g, bp: bp, items: items, npc: npc, colliders: colliders, art: art, artMat: artMat };
  }
  window.__WalkBuildRoom = buildRoom;

  /* ---------- street ---------- */
  var DOOR_X = [-50, -30, -10, 10, 30, 50];
  var NEON = [0xe8c87e, 0x4fd0e0, 0xff5a8a, 0xf0a030, 0xff3a4a, 0x7affb0];

  var THEMES = {
    thailand: { bg: 0x04070b, fog: 0x0a0f18, fd: 0.02, hemi: 0x9fb2cc, hg: 0x2a2420, hi: 1.05, hmin: 8, hvar: 14, bcol: [0x2a2e36, 0x33302c, 0x262a30, 0x30272a], win: [[255,205,130],[150,210,255],[255,120,150]], lamp: 0xffc880 },
    hongkong: { bg: 0x03080a, fog: 0x0a1a1c, fd: 0.026, hemi: 0x86d0c4, hg: 0x201418, hi: 1.0, hmin: 20, hvar: 22, bcol: [0x1f2a2c, 0x2a2a30, 0x24302c, 0x2c2428], win: [[120,255,200],[255,90,170],[255,220,120]], lamp: 0x9affd0, signs: true, rails: true },
    berlin: { bg: 0x07090e, fog: 0x161c26, fd: 0.03, hemi: 0xaab4c4, hg: 0x1c1c20, hi: 0.95, hmin: 15, hvar: 2, bcol: [0x4a4640, 0x3e403f, 0x504a42, 0x45464a], win: [[255,190,110],[255,210,150],[200,215,235]], lamp: 0xffa850, trees: true, tower: true, solid: true }
  };
  function themeOf(CASE) { return THEMES[CASE.id] || THEMES.thailand; }

  function windowsTexture(rows, cols, warm, pal) {
    return canvasTex(128, 256, function (g, w, h) {
      g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h);
      var cw = w / cols, ch = h / rows;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        if (srand() < 0.42) {
          var a = 0.5 + srand() * 0.5, pick = srand(), pl = pal || THEMES.thailand.win, cc = pick < 0.6 ? pl[0] : pick < 0.85 ? pl[1] : pl[2];
          g.fillStyle = 'rgba(' + cc[0] + ',' + cc[1] + ',' + cc[2] + ',' + a + ')';
          g.fillRect(c * cw + cw * 0.18, r * ch + ch * 0.2, cw * 0.64, ch * 0.6);
        } else { g.fillStyle = '#0b0f14'; g.fillRect(c * cw + cw * 0.18, r * ch + ch * 0.2, cw * 0.64, ch * 0.6); }
      }
    });
  }

  function buildStreet(scene, CASE, helpers) {
    var g = new T.Group(), TH = themeOf(CASE);
    var road = canvasTex(256, 256, function (c, w, h) {
      c.fillStyle = '#0d0f12'; c.fillRect(0, 0, w, h);
      for (var i = 0; i < 1400; i++) { c.fillStyle = 'rgba(' + (30 + (srand() * 30 | 0)) + ',' + (32 + (srand() * 30 | 0)) + ',' + (38 + (srand() * 30 | 0)) + ',0.5)'; c.fillRect(srand() * w, srand() * h, 2, 2); }
    });
    road.wrapS = road.wrapT = T.RepeatWrapping; road.repeat.set(60, 8);
    var ground = new T.Mesh(new T.PlaneGeometry(260, 34), new T.MeshLambertMaterial({ map: road, color: 0xb4bac6 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 3); g.add(ground);
    // sidewalk along the buildings
    box(g, 260, 0.14, 4, 0x1d1f23, 0, 0.07, -4);
    // dashed line
    for (var x = -125; x < 125; x += 6) box(g, 2.6, 0.01, 0.16, 0x8a7a50, x, 0.012, 3);
    // river and embankment
    box(g, 260, 0.9, 0.6, 0x1a1b1f, 0, 0.45, 9.6);
    var river = new T.Mesh(new T.PlaneGeometry(500, 160), new T.MeshBasicMaterial({ color: 0x041218 }));
    river.rotation.x = -Math.PI / 2; river.position.set(0, -0.8, 90); g.add(river);
    for (var rx = -120; rx <= 120; rx += 9) box(g, 0.14, 0.9, 0.14, 0x2a2b30, rx, 0.45, 9.4);
    box(g, 260, 0.06, 0.1, 0x2a2b30, 0, 1.0, 9.4);
    // far bank skyline across the river (low glows)
    for (var fx = -130; fx < 130; fx += 5 + srand() * 6) {
      var fh = 3 + srand() * 12;
      box(g, 4 + srand() * 5, fh, 4, 0x0a0d12, fx, fh / 2 - 0.8, 62 + srand() * 10, 0x0a1118, 1);
      g.add(glow([0xffc080, 0x70c8ff, 0xff7090][(srand() * 3) | 0], 5, fx, fh * 0.5, 58, 0.22));
    }
    // reflected neon streaks on the river
    for (var rf = -120; rf <= 120; rf += 11) { var m = new T.Mesh(new T.PlaneGeometry(0.5, 30), new T.MeshBasicMaterial({ color: [0xffc080, 0x70c8ff, 0xff7090][(srand() * 3) | 0], transparent: true, opacity: 0.12, blending: T.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(rf, -0.78, 40); g.add(m); }
    // buildings along the north side
    var tex = [windowsTexture(18, 6, 0, TH.win), windowsTexture(14, 5, 0, TH.win), windowsTexture(22, 7, 0, TH.win)];
    var doors = [];
    var x0 = -66, bi = 0;
    var doorBuildings = {};
    DOOR_X.forEach(function (dx, i) { doorBuildings[dx] = i; });
    function facade(cx, w, h, depth, doorIdx) {
      var t = tex[bi % 3].clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(Math.max(1, Math.round(w / 3.5)), Math.max(1, Math.round(h / 5)));
      var mat = new T.MeshLambertMaterial({ color: TH.bcol[bi % 4], map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.85 });
      var b = new T.Mesh(new T.BoxGeometry(w, h, depth), mat); b.position.set(cx, h / 2, -6 - depth / 2); g.add(b);
      box(g, w + 0.4, 0.3, depth + 0.4, 0x14161a, cx, h + 0.15, -6 - depth / 2);
      bi++;
      return b;
    }
    // fill buildings between door buildings
    var cursor = -68;
    DOOR_X.forEach(function (dx, i) {
      // filler up to this door building
      var left = dx - 8;
      while (cursor < left - 4) { var w = Math.min(left - cursor, 7 + srand() * 5); facade(cursor + w / 2, w - 0.3, TH.hmin + srand() * TH.hvar, 9); cursor += w; }
      cursor = dx + 8;
      var hh = TH.solid ? 16 : TH.hmin + 1 + (i % 3) * 3;
      facade(dx, 15.6, hh, 10, i);
      var col = NEON[i];
      // door frame + glow
      box(g, 3.0, 3.6, 0.3, 0x090b0e, dx, 1.8, -5.9);
      box(g, 2.4, 3.2, 0.2, 0x050505, dx, 1.6, -5.78, col, 0.3);
      var rep = new T.Mesh(new T.PlaneGeometry(2.4, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false }));
      rep.rotation.x = -Math.PI / 2; rep.position.set(dx, 0.02, 14); g.add(rep);
      g.add(glow(col, 9, dx, 1.8, -4.8, 0.4));
      var loc = CASE.locations[i];
      var hex = '#' + ('000000' + col.toString(16)).slice(-6);
      var sign = plane(g, 8.4, 1.5, new T.MeshBasicMaterial({ map: textTex([
        { text: loc.name.toUpperCase().slice(0, 28), font: '700 66px "IBM Plex Mono"', color: hex, y: 62, shadow: hex },
        { text: loc.time + ' / ' + CASE.city.toUpperCase(), font: '500 38px "IBM Plex Mono"', color: '#d8d2c0', y: 130 }
      ], 1024, 180, { bg: 'rgba(5,6,8,0.88)', border: hex }), transparent: true }), dx, 5.2, -5.7);
      g.add(glow(col, 14, dx, 5.2, -4.5, 0.3));
      var chev = new T.Mesh(new T.OctahedronGeometry(0.35, 0), new T.MeshBasicMaterial({ color: col }));
      chev.position.set(dx, 7.2, -5.2); chev.scale.y = 1.6; g.add(chev);
      doors.push({ i: i, x: dx, chev: chev, id: loc.id });
    });
    while (cursor < 66) { var w2 = 7 + srand() * 5; facade(cursor + w2 / 2, w2 - 0.3, TH.hmin + srand() * TH.hvar, 9); cursor += w2; }
    // lamp posts
    for (var lx = -60; lx <= 60; lx += 10) {
      cyl(g, 0.07, 0.09, 5.2, 0x15171a, lx, 2.6, 6.2, 6);
      box(g, 1.1, 0.07, 0.07, 0x15171a, lx + 0.5, 5.2, 6.2);
      g.add(glow(TH.lamp, 5, lx + 1, 5.1, 6.2, 0.7));
      var cone = new T.Mesh(new T.PlaneGeometry(4.5, 4.5), new T.MeshBasicMaterial({ map: glowTexture(), color: TH.lamp, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false }));
      cone.rotation.x = -Math.PI / 2; cone.position.set(lx + 1, 0.03, 6.2); g.add(cone);
    }
    // parked scooters and a few signs for life
    for (var sc = 0; sc < 14; sc++) { var sx = -64 + sc * 9.7 + srand() * 3; box(g, 0.5, 0.5, 1.4, [0x222a30, 0x4a2a2a, 0x2a3a4a][sc % 3], sx, 0.45, -4.4 + srand() * 0.6); }
    // overhead cables
    for (var cb = -60; cb < 60; cb += 12) { var cab = box(g, 12, 0.02, 0.02, 0x050607, cb + 6, 6.5 + srand() * 1.2, -2 + srand() * 4); cab.rotation.z = (srand() - 0.5) * 0.06; }
    // city-specific dressing
    if (TH.signs) {
      var scol = [0xff3a8a, 0x3affc0, 0xffd23a, 0x3ab8ff, 0xff5a3a];
      for (var sx2 = -64; sx2 < 64; sx2 += 7) {
        var sc2 = scol[((sx2 + 64) / 7 | 0) % 5], sh = 3 + srand() * 3.5, sy = 5.5 + srand() * 5;
        box(g, 0.9, sh, 0.25, sc2, sx2, sy, -4.2 + srand() * 0.8, sc2, 1);
        box(g, 0.5, sh * 0.7, 0.15, 0x050505, sx2, sy, -3.95 + srand() * 0.8);
        g.add(glow(sc2, 7, sx2, sy, -3.6, 0.45));
      }
      for (var tx = -125; tx < 125; tx += 120) { }
    }
    if (TH.rails) {
      box(g, 260, 0.03, 0.07, 0x555a60, 0, 0.02, 1.2); box(g, 260, 0.03, 0.07, 0x555a60, 0, 0.02, 2.6);
      for (var ow = -120; ow <= 120; ow += 24) { cyl(g, 0.06, 0.06, 6.5, 0x15171a, ow, 3.2, 0.3, 5); }
      box(g, 260, 0.03, 0.03, 0x0a0a0a, 0, 6.4, 1.9); 
    }
    if (TH.trees) {
      for (var tr = -62; tr <= 62; tr += 10) {
        cyl(g, 0.16, 0.24, 4.4, 0x1c1713, tr + 5, 2.2, -3.2, 6);
        for (var br = 0; br < 6; br++) { var bb = box(g, 0.06, 1.8, 0.06, 0x1c1713, tr + 5 + (br - 2.5) * 0.35, 5.0, -3.2 + ((br % 2) - 0.5) * 0.4); bb.rotation.z = (br - 2.5) * 0.28; bb.rotation.x = ((br % 2) - 0.5) * 0.5; }
      }
      // elevated U-Bahn viaduct across the far side
      box(g, 260, 0.8, 3.2, 0x2a2a2e, 0, 7.5, 14);
      for (var vx = -125; vx <= 125; vx += 12) box(g, 1.2, 7.1, 1.4, 0x25252a, vx, 3.5, 14);
      for (var wl = -120; wl <= 120; wl += 30) { g.add(glow(0xc8e0ff, 10, wl, 8.6, 12, 0.35)); }
    }
    if (TH.tower) {
      var tw = new T.Group(); tw.position.set(-20, 0, 110);
      cyl(tw, 1.2, 2.2, 150, 0x202630, 0, 75, 0, 8); var ball = new T.Mesh(new T.SphereGeometry(9, 12, 10), new T.MeshBasicMaterial({ color: 0x2a313c })); ball.position.y = 150; tw.add(ball);
      cyl(tw, 0.2, 0.5, 60, 0x202630, 0, 190, 0, 5); tw.add(glow(0xff4040, 12, 0, 220, 0, 0.9)); tw.add(glow(0xa0c0ff, 40, 0, 150, -2, 0.25));
      g.add(tw);
    }
    // moon
    g.add(glow(TH.solid ? 0x8a98b0 : 0xcfe0ff, 40, -40, 55, 120, TH.solid ? 0.3 : 0.8));
    var movers = [];
    for (var m = 0; m < 7; m++) {
      var sg = new T.Group(), dir = m % 2 ? 1 : -1;
      box(sg, 1.5, 0.55, 0.5, [0x2a3a4a, 0x6a2a2a, 0x3a3a3a, 0x2a5a4a][m % 4], 0, 0.55, 0); box(sg, 0.4, 0.9, 0.4, 0x151515, -0.1, 0.9, 0);
      sg.add(glow(0xfff0c0, 2.2, dir * 0.9, 0.6, 0, 0.9)); sg.add(glow(0xff2a2a, 0.9, -dir * 0.8, 0.6, 0, 0.8));
      sg.position.set(rnd(-60, 60), 0, dir > 0 ? 4.8 : 1.4); sg.userData = { dir: dir, sp: rnd(5, 9) };
      sg.rotation.y = dir > 0 ? 0 : Math.PI; g.add(sg); movers.push(sg);
    }
    scene.add(g);
    return { group: g, doors: doors, movers: movers };
  }

  /* ---------- landing ---------- */
  function landing(cd) {
    T = window.THREE;
    var app = cd.mount; app.innerHTML = '';
    if (!T || !window.WebGLRenderingContext) return false;
    var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    var wrap = mk('<div class="walk land"></div>'); app.appendChild(wrap);
    var renderer;
    try { renderer = new T.WebGLRenderer({ antialias: !isTouch }); } catch (e) { wrap.remove(); return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    var cv = renderer.domElement; cv.className = 'walk-canvas'; wrap.appendChild(cv);
    var scene = new T.Scene(); scene.background = new T.Color(0x05080d); scene.fog = new T.FogExp2(0x101826, 0.006);
    var cam = new T.PerspectiveCamera(55, 1, 0.1, 500);
    scene.add(new T.HemisphereLight(0x8aa0c0, 0x1a1410, 1.0));
    var key = new T.PointLight(0xffc880, 2, 120, 1.2); key.position.set(0, 20, -30); scene.add(key);
    var water = new T.Mesh(new T.PlaneGeometry(400, 300), new T.MeshBasicMaterial({ color: 0x041018 })); water.rotation.x = -Math.PI / 2; scene.add(water);
    // far bank
    for (var i = 0; i < 46; i++) {
      var h = 3 + srand() * 14, w = 3 + srand() * 5, x = -100 + i * 4.4;
      box(scene, w, h, 4, 0x151c28, x, h / 2, -52 - srand() * 10, 0x1a2536, 1);
      scene.add(glow([0xffc080, 0x70c8ff, 0xff7090][(srand() * 3) | 0], 5, x, h * 0.55, -49, 0.3));
    }
    // temple prang (Wat Arun silhouette)
    var pr = new T.Group(); pr.position.set(14, 0, -40);
    cyl(pr, 5, 6.5, 6, 0x6a6a78, 0, 3, 0, 6); cyl(pr, 3.6, 5, 6, 0x767686, 0, 9, 0, 6); cyl(pr, 1.2, 3.6, 10, 0x84848f, 0, 17, 0, 6); cyl(pr, 0.1, 0.8, 5, 0x9a8a50, 0, 24.5, 0, 6);
    [[-6, 0], [6, 0]].forEach(function (p) { cyl(pr, 0.6, 2.0, 7, 0x484750, p[0], 3.5, 2, 6); });
    pr.add(glow(0xffcf80, 60, 0, 12, 8, 0.7)); scene.add(pr);
    var LC = cd.getCase(), LT = themeOf(LC);
    if (LC.id !== 'thailand') {
      pr.visible = false; scene.fog.color.setHex(LT.fog); scene.background.setHex(LT.bg);
      var lt = new T.Group(); lt.position.set(LC.id === 'berlin' ? 10 : 12, 0, -42);
      if (LC.id === 'berlin') { cyl(lt, 0.8, 1.6, 40, 0x2a313c, 0, 20, 0, 8); var bl = new T.Mesh(new T.SphereGeometry(5, 12, 10), new T.MeshBasicMaterial({ color: 0x3a424e })); bl.position.y = 38; lt.add(bl); cyl(lt, 0.1, 0.3, 16, 0x2a313c, 0, 52, 0, 5); lt.add(glow(0xff4040, 5, 0, 60, 0, 0.9)); }
      else { box(lt, 5, 46, 5, 0x1c2830, 0, 23, 0, 0x2a8a80, 0.6); box(lt, 4, 14, 4, 0x1c2830, 9, 7, 2, 0xff3a8a, 0.4); box(lt, 6, 30, 6, 0x1c2830, -10, 15, 0, 0x3ab8ff, 0.5); lt.add(glow(0x40ffc0, 50, 0, 30, 6, 0.6)); }
      scene.add(lt);
    }
    // river reflections
    for (var r = 0; r < 30; r++) { var m = new T.Mesh(new T.PlaneGeometry(0.6, 40), new T.MeshBasicMaterial({ color: [0xffc080, 0x70c8ff, 0xff7090][r % 3], transparent: true, opacity: 0.13, blending: T.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(-90 + r * 6.2, 0.05, -25); scene.add(m); }
    // boats
    var boats = [];
    for (var b = 0; b < 4; b++) { var bg = new T.Group(); box(bg, 6, 0.7, 1.6, 0x2a1d14, 0, 0.35, 0); box(bg, 2.4, 1.2, 1.4, 0x1c1410, -0.5, 1.2, 0); bg.add(glow(0xffb060, 3, 2, 1.6, 0, 0.9)); bg.position.set(-40 + b * 28, 0, -14 - b * 5); scene.add(bg); boats.push(bg); }
    // rising lanterns
    var N = 140, lp = new Float32Array(N * 3), lg = new T.BufferGeometry();
    for (var l = 0; l < N; l++) lp.set([rnd(-60, 60), rnd(1, 35), rnd(-45, 0)], l * 3);
    lg.setAttribute('position', new T.BufferAttribute(lp, 3));
    var lantern = new T.Points(lg, new T.PointsMaterial({ map: glowTexture(), color: 0xffb860, size: 1.8, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
    scene.add(lantern);
    // rain
    var RN = 700, rpos = new Float32Array(RN * 6), rgeo = new T.BufferGeometry();
    for (var q = 0; q < RN; q++) { var rx = rnd(-30, 30), ry = rnd(0, 25), rz = rnd(-30, 8); rpos.set([rx, ry, rz, rx - 0.03, ry - 0.7, rz], q * 6); }
    rgeo.setAttribute('position', new T.BufferAttribute(rpos, 3));
    var rain = new T.LineSegments(rgeo, new T.LineBasicMaterial({ color: 0x9ab4cc, transparent: true, opacity: 0.3 })); rain.frustumCulled = false; scene.add(rain);

    var CASE = cd.getCase(), st = cd.state(), started = Object.keys(st.visited).length > 0 || st.clues.length > 0;
    var ui = mk('<div class="l-ui"><h1 class="l-title">' + esc(CASE.title || 'City Detective').replace(/ (?=[^ ]+$)/, '<br>') + '</h1><p class="l-sub">' + esc(CASE.city + '. ' + (CASE.tagline || '')) + '</p>' +
      '<button class="l-enter" id="lEnter">' + (st.solved ? 'Play again' : started ? 'Continue' : 'Enter') + '</button>' +
      '<div class="l-sec">' + (started ? '<button id="lReset">New game</button>' : '') + '</div></div>');
    var cs = cd.cases();
    if (cs.length > 1) {
      var pick = mk('<div class="l-cases"></div>');
      cs.forEach(function (c) { var b = mk('<button' + (c.current ? ' class="on"' : '') + '>' + esc(c.city) + '</button>'); b.onclick = function () { cd.setCase(c.id); stop(); cd.go.start(); }; pick.appendChild(b); });
      ui.insertBefore(pick, ui.firstChild);
    }
    wrap.appendChild(ui);
    ui.querySelector('#lEnter').onclick = function () {
      stop();
      var d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen;
      if (f && !document.fullscreenElement) { try { var pr2 = f.call(d); if (pr2 && pr2.catch) pr2.catch(function () {}); } catch (e) {} }
      if (st.solved) cd.act({ k: 'reset' });
      cd.go.walk();
    };
    var rs = ui.querySelector('#lReset'); if (rs) rs.onclick = function () { cd.act({ k: 'reset' }); stop(); cd.go.start(); };
    var mx = 0, my = 0; wrap.addEventListener('pointermove', function (e) { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
    var run = true; function stop() { run = false; window.removeEventListener('resize', rs2); try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {} }
    function rs2() { var w = wrap.clientWidth || innerWidth, h = wrap.clientHeight || innerHeight; renderer.setSize(w, h, false); cv.style.width = '100%'; cv.style.height = '100%'; cam.aspect = w / h; cam.position.z = cam.aspect < 0.8 ? 26 : 16; cam.updateProjectionMatrix(); }
    window.addEventListener('resize', rs2); rs2();
    var clock = new T.Clock();
    (function tick() {
      if (!run) return; if (!cv.isConnected) { stop(); return; }
      requestAnimationFrame(tick);
      var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      cam.position.x += (mx * 7 - cam.position.x) * 0.04; cam.position.y = 4.2 - my * 2 + Math.sin(t * 0.3) * 0.3; cam.lookAt(2, 12, -40);
      boats.forEach(function (b, i) { b.position.x += dt * (0.8 + i * 0.2); if (b.position.x > 70) b.position.x = -70; b.position.y = Math.sin(t * 1.2 + i) * 0.08; });
      var a = lg.attributes.position.array; for (var i = 0; i < N; i++) { a[i * 3 + 1] += dt * (0.8 + (i % 5) * 0.2); a[i * 3] += Math.sin(t + i) * dt * 0.3; if (a[i * 3 + 1] > 40) a[i * 3 + 1] = 0.5; } lg.attributes.position.needsUpdate = true;
      var ra = rgeo.attributes.position.array; for (var j = 0; j < RN; j++) { var k = j * 6, d = dt * 18; ra[k + 1] -= d; ra[k + 4] -= d; if (ra[k + 1] < 0) { var h2 = 22 + Math.random() * 3; ra[k + 1] = h2; ra[k + 4] = h2 - 0.7; } } rgeo.attributes.position.needsUpdate = true;
      renderer.render(scene, cam);
    })();
    window.__land = true;
    return true;
  }
  Walk.landing = landing;

  /* ---------- the game ---------- */

  function start(cd) {
    T = window.THREE;
    var CASE = cd.getCase(), app = cd.mount;
    app.innerHTML = '';
    if (!T || !window.WebGLRenderingContext) { return false; }
    var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    var wrap = mk('<div class="walk" id="walk"></div>');
    app.appendChild(wrap);
    var renderer;
    try { renderer = new T.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' }); }
    catch (e) { wrap.remove(); return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.6 : 2));
    var cv = renderer.domElement; cv.className = 'walk-canvas'; wrap.appendChild(cv);

    var scene = new T.Scene();
    var TH = themeOf(CASE); CUR_TH = TH;
    scene.background = new T.Color(TH.bg);
    scene.fog = new T.FogExp2(TH.fog, TH.fd);
    var camera = new T.PerspectiveCamera(72, 1, 0.1, 400);
    camera.rotation.order = 'YXZ';
    var hemi = new T.HemisphereLight(TH.hemi, TH.hg, TH.hi); scene.add(hemi);
    var lamp = new T.PointLight(0xffd8a0, 1.7, 20, 1.2); scene.add(lamp);

    var street = buildStreet(scene, CASE);
    var rooms = {};
    var roomRoot = new T.Group(); scene.add(roomRoot);
    CASE.locations.forEach(function (loc, i) {
      var r = buildRoom(loc.id, loc, roomRoot);
      r.off = 400 * (i + 1); r.group.position.set(r.off, 0, 0);
      rooms[loc.id] = r;
      r.loc = loc;
      // npc visuals
      if (r.npc) {
        var sus = cd.suspect(r.npc.suspectId);
        var head = makeFigure(r.npc.group, r.npc.suspectId);
        r.npc.head = head; r.npc.sus = sus;
        r.npc.group.add(glow(0xe8c87e, 2.4, 0, 1.2, 0, 0.35));
        r.npc.ring = new T.Mesh(new T.RingGeometry(0.55, 0.62, 28), new T.MeshBasicMaterial({ color: 0xe8c87e, transparent: true, opacity: 0.6, side: T.DoubleSide }));
        r.npc.ring.rotation.x = -Math.PI / 2; r.npc.ring.position.y = 0.03; r.npc.group.add(r.npc.ring);
        r.npc.faceLoaded = false;
      }
    });

    // rain
    var RAIN = 900, rainPos = new Float32Array(RAIN * 6), rainGeo = new T.BufferGeometry();
    for (var i = 0; i < RAIN; i++) { var rx = rnd(-18, 18), ry = rnd(0, 14), rz = rnd(-18, 18); rainPos.set([rx, ry, rz, rx - 0.02, ry - 0.5, rz], i * 6); }
    rainGeo.setAttribute('position', new T.BufferAttribute(rainPos, 3));
    var rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0x9ab4cc, transparent: true, opacity: 0.35, fog: false }));
    rain.frustumCulled = false; scene.add(rain);

    /* ---- state ---- */
    var P = { where: last.where, x: last.x, z: last.z, yaw: last.yaw, pitch: 0, vx: 0, vz: 0 };
    var keys = {}, joy = { x: 0, z: 0 }, lookDelta = { x: 0, y: 0 };
    var panelOpen = false, running = true, target = null, bob = 0, fade = 0, introOpen = true;
    var tapInfo = {}, vision = false;
    function toggleVision() { vision = !vision; $('wVision').classList.toggle('on', vision); $('wVis').classList.toggle('on', vision); }
    var radar = null, rg = null;
    function drawRadar() {
      radar = radar || $('wRadar'); rg = rg || radar.getContext('2d');
      var W = radar.width, C = W / 2, st = cd.state(), sc = P.where === 'street' ? 2.4 : 9;
      rg.clearRect(0, 0, W, W);
      rg.save(); rg.beginPath(); rg.arc(C, C, C - 3, 0, 6.2832); rg.fillStyle = 'rgba(6,8,11,.72)'; rg.fill(); rg.clip();
      rg.strokeStyle = 'rgba(236,229,213,.12)'; rg.lineWidth = 2; rg.beginPath(); rg.arc(C, C, C * 0.5, 0, 6.2832); rg.stroke();
      function pt(x, z) { var dx = x - P.x, dz = z - P.z, c = Math.cos(P.yaw), s2 = Math.sin(P.yaw); return [C + (dx * c - dz * s2) * sc, C + (dx * s2 + dz * c) * sc]; }
      var ph = place();
      if (ph) { var a = pt(-ph.bp.W / 2, -ph.bp.D / 2), b = pt(ph.bp.W / 2, -ph.bp.D / 2), c2 = pt(ph.bp.W / 2, ph.bp.D / 2), d = pt(-ph.bp.W / 2, ph.bp.D / 2);
        rg.strokeStyle = 'rgba(236,229,213,.35)'; rg.beginPath(); rg.moveTo(a[0], a[1]); [b, c2, d].forEach(function (q) { rg.lineTo(q[0], q[1]); }); rg.closePath(); rg.stroke(); }
      else { var l1 = pt(-70, -5.3), l2 = pt(70, -5.3), l3 = pt(70, 8.2), l4 = pt(-70, 8.2); rg.strokeStyle = 'rgba(236,229,213,.25)'; rg.beginPath(); rg.moveTo(l1[0], l1[1]); rg.lineTo(l2[0], l2[1]); rg.moveTo(l3[0], l3[1]); rg.lineTo(l4[0], l4[1]); rg.stroke(); }
      interactables().forEach(function (it) {
        var p = pt(it.x, it.z), col = '#e8c87e', r = 7;
        if (it.kind === 'evidence') { col = st.found[it.item.data.id] ? '#3fae87' : '#e8c87e'; }
        else if (it.kind === 'flavor') { col = 'rgba(200,210,220,.5)'; r = 4; }
        else if (it.kind === 'npc') { col = '#ff8a6a'; r = 8; }
        else if (it.kind === 'exit') { col = '#e8c87e'; r = 5; }
        else if (it.kind === 'door') { var l = CASE.locations[it.i]; col = (st.visited[l.id] && remaining(l) === 0) ? '#3fae87' : '#' + ('000000' + NEON[it.i].toString(16)).slice(-6); r = 9; }
        rg.fillStyle = col; rg.beginPath();
        if (it.kind === 'door' || it.kind === 'exit') rg.rect(p[0] - r / 2, p[1] - r / 2, r, r); else rg.arc(p[0], p[1], r / 2, 0, 6.2832);
        rg.fill();
      });
      rg.restore();
      rg.fillStyle = '#ece5d5'; rg.beginPath(); rg.moveTo(C, C - 11); rg.lineTo(C + 8, C + 8); rg.lineTo(C - 8, C + 8); rg.closePath(); rg.fill();
    }

    function place() { return P.where === 'street' ? null : rooms[P.where]; }
    function off() { var r = place(); return r ? r.off : 0; }

    /* ---- HUD ---- */
    var hud = mk(
      '<div class="w-hud">' +
        '<button id="wBack" class="w-back">&larr; Back</button>' +
        '<div class="w-where"><span id="wTime" hidden></span><strong id="wName"></strong><span id="wGuide" class="w-guide"></span></div>' +
        '<canvas id="wRadar" class="w-radar" width="260" height="260"></canvas>' +
        '<div class="w-stack">' +
          '<button id="wVision" title="Detective vision (V)">Vision <i>V</i></button>' +
          '<button id="wBoard">Notebook <b id="wCount">0</b></button>' +
          '<button id="wPhone">Phone</button>' +
          '<button id="wAccuse" class="w-accuse">Accuse</button>' +
          '<button id="wSound" aria-label="Sound" class="w-icon">&#9835;</button>' +
        '</div>' +
        '<div class="w-prompt" id="wPrompt" hidden></div>' +
        '<div class="w-narr" id="wNarr" hidden></div>' +
        '<div class="w-cross" aria-hidden="true"></div>' +
        '<div class="w-vis" id="wVis"></div>' +
        '<div class="w-joy" id="wJoy"><div class="w-knob" id="wKnob"></div></div>' +
        '<div class="w-help" id="wHelp">' + (isTouch ? '' : 'Click to look &middot; WASD / arrows walk &middot; E act &middot; V vision &middot; Shift run') + '</div>' +
      '</div>'
    );
    wrap.appendChild(hud);
    var $ = function (id) { return hud.querySelector('#' + id); };
    var fadeEl = mk('<div class="w-fade"></div>'); wrap.appendChild(fadeEl);
    var loader = mk('<div class="w-loading" id="wLoading"><span>CITY DETECTIVE</span><em>Loading&hellip;</em></div>'); wrap.appendChild(loader);

    function remaining(loc) {
      var st = cd.state(), n = 0;
      loc.searches.forEach(function (s) { if (!st.found[s.id]) n++; });
      if (loc.person) loc.person.questions.forEach(function (q, qi) { if (!st.answered[loc.id + ':' + qi]) n++; });
      return n;
    }
    function updateHud() {
      var st = cd.state(), loc = P.where === 'street' ? null : rooms[P.where].loc;
      $('wTime').textContent = loc ? loc.time + ' / ' + CASE.city.toUpperCase() : 'NIGHT / ' + CASE.city.toUpperCase();
      $('wName').textContent = loc ? loc.name : (CASE.streetName || CASE.city + ' night streets');
      $('wCount').textContent = st.clues.length;
      var all = CASE.locations.every(function (l) { return st.visited[l.id]; });
      $('wAccuse').disabled = !(all && !st.solved);
      $('wAccuse').title = all ? '' : 'Visit all six places first';
      var guide = '';
      if (!loc) {
        var best = null, bd = 1e9;
        CASE.locations.forEach(function (l, i) {
          if (st.visited[l.id] && remaining(l) === 0) return;
          var d = Math.abs(DOOR_X[i] - P.x); if (d < bd) { bd = d; best = i; }
        });
        if (best != null) guide = (DOOR_X[best] > P.x ? '\u25B6 ' : '\u25C0 ') + CASE.locations[best].name + ' \u00B7 ' + Math.round(bd) + ' m';
        else guide = 'Every lead followed. Time to accuse.';
      } else {
        var r = remaining(loc);
        guide = r ? r + ' lead' + (r > 1 ? 's' : '') + ' left here' : 'Nothing left here';
      }
      $('wGuide').textContent = guide;
      street.doors.forEach(function (d) {
        var l = CASE.locations[d.i], done = st.visited[l.id] && remaining(l) === 0;
        d.chev.material.color.setHex(done ? 0x3fae87 : NEON[d.i]);
      });
    }

    /* ---- panels ---- */
    var panel = null;
    function closePanel() { if (panel) { panel.remove(); panel = null; } panelOpen = false; resetInput(); }
    function openPanel(html, cls) {
      closePanel();
      panelOpen = true; resetInput();
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
      panel = mk('<div class="w-panel"><div class="w-card ' + (cls || '') + '">' + html + '</div></div>');
      wrap.appendChild(panel);
      panel.addEventListener('pointerdown', function (e) { if (e.target === panel) closePanel(); });
      return panel.firstElementChild;
    }
    function showEvidence(s, loc, isNew) {
      var n = cd.state().clues.indexOf(s.id) + 1;
      var c = openPanel(
                '<h3 class="ev-title">' + esc(s.title) + '</h3>' +
                '<p class="ev-text">' + esc(s.text) + '</p>' +
        '<div class="ev-actions"><button class="btn-primary" id="wOk">' + (isNew ? 'Got it' : 'Keep looking') + '</button><button class="btn-quiet" id="wBd">Case board</button></div>'
      );
      c.querySelector('#wOk').onclick = closePanel;
      c.querySelector('#wBd').onclick = function () { exit(cd.go.board); };
    }
    function showFlavor(f, loc) {
      var c = openPanel('<h3 class="ev-title">' + esc(f.title) + '</h3><p class="ev-text">' + esc(f.text) + '</p><div class="ev-actions"><button class="btn-primary" id="wOk">Keep looking</button></div>', 'minor-card');
      c.querySelector('#wOk').onclick = closePanel;
    }
    function showTalk(r) {
      var loc = r.loc, s = r.npc.sus, st = cd.state();
      var c = openPanel(
        '<div class="int-head"><div class="int-face" style="display:grid;place-items:center;background:#1a1d22;color:#e8c87e;font:700 22px Fraunces,serif">' + esc(s.name.replace(/^(Dr\. |Mr\. |Ms\. )/, '').charAt(0)) + '</div><div><h3 class="int-name">' + esc(s.name) + '</h3><p class="int-role">' + esc(s.role) + '</p></div></div>' +
        '<p class="int-intro">' + esc(loc.person.intro) + '</p><div class="int-thread" id="wThread"></div><div class="int-asks" id="wAsks"></div>' +
        '<div class="ev-actions"><button class="btn-quiet" id="wBye">Walk away</button></div>', 'talk-card'
      );
      var thread = c.querySelector('#wThread'), asks = c.querySelector('#wAsks');
      loc.person.questions.forEach(function (q, qi) {
        var key = loc.id + ':' + qi;
        if (st.answered[key]) {
          thread.appendChild(mk('<div class="exchange"><p class="ex-q">' + esc(q.q) + '</p><p class="ex-a">' + esc(q.a) + '</p>' + (q.clueId ? '<p class="ex-note">Key testimony &middot; filed to the case board</p>' : '') + '</div>'));
        } else {
          var b = mk('<button class="ask">' + esc(q.q) + '</button>');
          b.onclick = function () { cd.act({ k: 'answer', id: key, clueId: q.clueId || null }); if (q.clueId) { cd.toast('Key testimony filed'); beep(660, 0.25); } showTalk(r); updateHud(); var t = panel && panel.querySelector('.ex-a:last-of-type'); };
          asks.appendChild(b);
        }
      });
      if (!asks.children.length) asks.appendChild(mk('<p class="int-done">' + esc(s.name) + ' has told you everything there is.</p>'));
      c.querySelector('#wBye').onclick = closePanel;
      // scroll the newest answer into view
      var ex = thread.querySelectorAll('.exchange'); if (ex.length) setTimeout(function () { ex[ex.length - 1].scrollIntoView({ block: 'nearest' }); }, 30);
    }
    function showIntro() {
      var c = openPanel(
        '<h3 class="ev-title">Find the thief</h3>' +
        '<p class="ev-text">A gallery amulet is gone. Visit all six places, collect evidence, question people, then accuse. Three wrong answers lose.</p>' +
        '<p class="ev-text w-keys">' + (isTouch
          ? 'Left circle: walk. Drag the right side: look. Tap gold markers to examine. Vision button shows hidden leads.'
          : 'Click the game to capture the mouse and look. WASD or arrows walk. E examines. V shows hidden leads. Shift runs.') + '</p>' +
        '<div class="ev-actions"><button class="btn-primary" id="wGo">Start</button></div>'
      );
      c.querySelector('#wGo').onclick = function () { introOpen = false; closePanel(); initAudio(); narrate(); };
    }

    var narrTimer = 0;
    function narrate(text) {
      var n = $('wNarr'), loc = P.where === 'street' ? null : rooms[P.where].loc;
      var t = text || (loc ? loc.name + ': ' + (remaining(loc) ? remaining(loc) + ' lead' + (remaining(loc) > 1 ? 's' : '') + ' to find' : 'nothing left') : 'Find the six places. Follow the lit signs.');
      n.textContent = t; n.hidden = false; n.classList.add('on');
      clearTimeout(narrTimer); narrTimer = setTimeout(function () { n.classList.remove('on'); setTimeout(function () { n.hidden = true; }, 600); }, Math.min(4000, 2200 + t.length * 25));
    }

    /* ---- navigation between street and rooms ---- */
    function setPlace(where, x, z, yaw) {
      fadeEl.classList.add('on');
      setTimeout(function () {
        P.where = where; P.x = x; P.z = z; P.yaw = yaw; P.pitch = 0; P.vx = P.vz = 0;
        var inRoom = where !== 'street';
        street.group.visible = !inRoom;
        for (var id in rooms) rooms[id].group.visible = (id === where);
        var bp = inRoom ? rooms[where].bp : null;
        if (inRoom) {
          var A = bp.ambient; hemi.color.setHex(A[0]); hemi.groundColor.setHex(A[1]); hemi.intensity = A[2] + 0.25;
          scene.background.setHex(bp.open ? 0x04070b : 0x050506);
          scene.fog.color.setHex(bp.open ? 0x0a0f18 : 0x08080a); scene.fog.density = bp.open ? 0.024 : 0.026;
          cd.act({ k: 'visit', id: where });
          loadArt(rooms[where]); loadFace(rooms[where]);
          lamp.color.setHex(0xffd8a0); lamp.distance = 14;
        } else {
          hemi.color.setHex(TH.hemi); hemi.groundColor.setHex(TH.hg); hemi.intensity = TH.hi;
          scene.background.setHex(TH.bg); scene.fog.color.setHex(TH.fog); scene.fog.density = TH.fd;
          lamp.distance = 22;
        }
        rain.visible = !inRoom || bp.open;
        last.where = where; last.x = x; last.z = z; last.yaw = yaw;
        updateHud(); target = null;
        setTimeout(function () { fadeEl.classList.remove('on'); narrate(); }, 60);
      }, 330);
    }
    function loadArt(r) {
      return; r.artLoaded = true;
      var im = new Image();
      im.onload = function () {
        var c = document.createElement('canvas'); var s = Math.min(1, 1024 / im.width);
        c.width = im.width * s; c.height = im.height * s; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        var t = new T.CanvasTexture(c); r.artMat.map = t; r.artMat.color.setHex(0xaaaaaa); r.artMat.needsUpdate = true;
      };
      im.src = r.art.userData.src;
    }
    function loadFace(r) {
      return; r.npc.faceLoaded = true;
      var im = new Image();
      im.onload = function () {
        var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d');
        g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.clip();
        g.drawImage(im, 0, 0, 256, 256);
        g.strokeStyle = '#c9a24b'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 122, 0, Math.PI * 2); g.stroke();
        var t = new T.CanvasTexture(c); r.npc.head.material.map = t; r.npc.head.material.color.setHex(0xffffff); r.npc.head.material.needsUpdate = true;
      };
      im.src = r.npc.sus.image;
    }

    function interactables() {
      var list = [];
      if (P.where === 'street') {
        DOOR_X.forEach(function (dx, i) { list.push({ kind: 'door', i: i, x: dx, z: -5, y: 1.6, range: 3.4, label: 'Enter ' + CASE.locations[i].name }); });
      } else {
        var r = rooms[P.where], st = cd.state();
        r.items.forEach(function (it) {
          var done = it.kind === 'evidence' ? st.found[it.data.id] : st.flavor[it.data.id];
          list.push({ kind: it.kind, item: it, x: it.x, z: it.z, y: it.y, range: it.range, label: (it.kind === 'evidence' ? (done ? 'Re-read: ' : 'Examine: ') : 'Look at: ') + it.data.title });
        });
        if (r.npc) list.push({ kind: 'npc', r: r, x: r.npc.x, z: r.npc.z, y: 1.7, range: 3.4, label: 'Talk to ' + r.npc.sus.name });
        list.push({ kind: 'exit', x: 0, z: r.bp.D / 2, y: 1.5, range: 2.8, label: 'Leave to the street' });
      }
      return list;
    }
    function activate(t) {
      if (!t || panelOpen) return;
      initAudio();
      if (t.kind === 'door') {
        var loc = CASE.locations[t.i];
        setPlace(loc.id, 0, rooms[loc.id].bp.D / 2 - 1.8, 0);
      } else if (t.kind === 'exit') {
        var i = CASE.locations.map(function (l) { return l.id; }).indexOf(P.where);
        setPlace('street', DOOR_X[i], -3.2, Math.PI);
      } else if (t.kind === 'evidence') {
        var s = t.item.data, loc2 = rooms[P.where].loc, st = cd.state();
        if (st.found[s.id]) showEvidence(s, loc2, false);
        else { cd.act({ k: 'find', id: s.id }); beep(880, 0.35, 0.07); beep(1320, 0.5, 0.04); pulse(); showEvidence(s, loc2, true); }
        updateHud();
      } else if (t.kind === 'flavor') {
        cd.act({ k: 'flavor', id: t.item.data.id }); showFlavor(t.item.data, rooms[P.where].loc);
      } else if (t.kind === 'npc') showTalk(t.r);
    }
    var pulseT = 0;
    function pulse() { pulseT = 0.5; }

    function findTarget() {
      var fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), best = null, bs = 1e9;
      interactables().forEach(function (it) {
        var dx = it.x - P.x, dz = it.z - P.z, d = Math.sqrt(dx * dx + dz * dz);
        if (d > it.range) return;
        var dot = d < 0.01 ? 1 : (dx * fx + dz * fz) / d;
        if (dot < (d < 1.3 ? -0.2 : 0.35)) return;
        var sc = d * (2.2 - dot);
        if (sc < bs) { bs = sc; best = it; }
      });
      return best;
    }

    /* ---- input ---- */
    function resetInput() { keys = {}; joy.x = joy.z = 0; lookDelta.x = lookDelta.y = 0; var k = $('wKnob'); if (k) k.style.transform = ''; }
    function kd(e) {
      if (!cv.isConnected) return;
      var k = e.key.toLowerCase();
      if (k === 'escape') { if (panelOpen && !introOpen) closePanel(); return; }
      if (panelOpen) return;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
      keys[k] = true;
      if (k === 'v') toggleVision();
      if ((k === 'e' || k === ' ' || k === 'enter') && target) activate(target);
    }
    function ku(e) { keys[e.key.toLowerCase()] = false; }
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    window.addEventListener('blur', resetInput);

    // pointer: touch joystick (left), look drag (right / mouse)
    var joyEl = $('wJoy'), knob = $('wKnob'), joyId = null, lookId = null, lastP = {}, JR = 56;
    function joyMove(e) {
      var r = joyEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy) || 1, m = Math.min(d, JR);
      var nx = dx / d * m, ny = dy / d * m;
      knob.style.transform = 'translate(' + nx + 'px,' + ny + 'px)';
      joy.x = nx / JR; joy.z = ny / JR;
    }
    joyEl.addEventListener('pointerdown', function (e) { if (panelOpen) return; joyId = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); initAudio(); e.preventDefault(); });
    joyEl.addEventListener('pointermove', function (e) { if (e.pointerId === joyId) joyMove(e); });
    function joyEnd(e) { if (e.pointerId === joyId) { joyId = null; joy.x = joy.z = 0; knob.style.transform = ''; } }
    joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);

    cv.addEventListener('pointerdown', function (e) {
      if (panelOpen) return;
      if (e.pointerType === 'mouse' && cv.requestPointerLock && document.pointerLockElement !== cv) { try { cv.requestPointerLock(); } catch (er) {} }
      if (lookId != null) return;
      lookId = e.pointerId; cv.setPointerCapture(e.pointerId);
      lastP = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
    });
    cv.addEventListener('pointermove', function (e) {
      if (e.pointerId !== lookId) return;
      var k = e.pointerType === 'touch' ? 0.0052 : 0.0034;
      P.yaw -= (e.clientX - lastP.x) * k; P.pitch -= (e.clientY - lastP.y) * k;
      P.pitch = Math.max(-0.7, Math.min(0.7, P.pitch));
      lastP.x = e.clientX; lastP.y = e.clientY;
    });
    document.addEventListener('mousemove', mm);
    function mm(e) {
      if (document.pointerLockElement !== cv || panelOpen) return;
      P.yaw -= e.movementX * 0.0022; P.pitch -= e.movementY * 0.0022; P.pitch = Math.max(-0.7, Math.min(0.7, P.pitch));
    }
    function lookEnd(e) {
      if (e.pointerId !== lookId) return; lookId = null;
      var moved = Math.hypot(e.clientX - lastP.sx, e.clientY - lastP.sy), dt = performance.now() - lastP.t;
      if (moved < 10 && dt < 400) { if (document.pointerLockElement === cv) { if (target) activate(target); } else tapPick(e.clientX, e.clientY); }
    }
    cv.addEventListener('pointerup', lookEnd); cv.addEventListener('pointercancel', lookEnd);

    var v3 = new T.Vector3();
    function tapPick(cx, cy) {
      var rect = cv.getBoundingClientRect(), best = null, bd = 56;
      interactables().forEach(function (it) {
        v3.set(off() + it.x, it.y, it.z).project(camera);
        if (v3.z > 1) return;
        var sx = rect.left + (v3.x + 1) / 2 * rect.width, sy = rect.top + (1 - v3.y) / 2 * rect.height;
        var d = Math.hypot(sx - cx, sy - cy);
        if (d < bd) { bd = d; best = it; }
      });
      if (!best) return;
      var dist = Math.hypot(best.x - P.x, best.z - P.z);
      if (dist <= best.range + 0.6) activate(best);
      else cd.toast('Walk closer to ' + (best.label.split(': ')[1] || best.label.replace('Enter ', '').replace('Talk to ', '')));
    }

    $('wPrompt').addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); if (target) activate(target); });
    function exit(fn) { running = false; cleanup(); fn(); }
    $('wBack').onclick = function () { exit(cd.go.start); };
    $('wVision').onclick = function () { toggleVision(); };
    $('wBoard').onclick = function () { exit(cd.go.board); };
    $('wPhone').onclick = function () { exit(cd.go.phone); };
    $('wAccuse').onclick = function () { if (!$('wAccuse').disabled) exit(cd.go.accuse); };
    $('wSound').onclick = function () { initAudio(); setMuted(audio ? !audio.muted : false); $('wSound').classList.toggle('off', !!(audio && audio.muted)); };

    function cleanup() {
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', resetInput); document.removeEventListener('mousemove', mm); if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); window.removeEventListener('resize', onResize);
      if (audio) { try { audio.rain.gain.value = 0; } catch (e) {} }
      try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {}
    }

    function onResize() {
      var w = wrap.clientWidth || window.innerWidth, h = wrap.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false); cv.style.width = '100%'; cv.style.height = '100%';
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize); onResize();

    /* ---- loop ---- */
    var clock = new T.Clock(), frame = 0;
    function tick() {
      if (!running) return;
      if (!cv.isConnected) { running = false; cleanup(); return; }
      requestAnimationFrame(tick);
      var dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
      var ph = P.where === 'street' ? null : rooms[P.where];

      if (!panelOpen) {
        var turn = (keys.arrowleft ? 1 : 0) - (keys.arrowright ? 1 : 0);
        P.yaw += turn * 1.9 * dt;
        var fwd = (keys.arrowup || keys.w ? 1 : 0) - (keys.arrowdown || keys.s ? 1 : 0) - joy.z;
        var str = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + joy.x;
        var len = Math.hypot(fwd, str); if (len > 1) { fwd /= len; str /= len; }
        var sp = (keys.shift ? 7.5 : 4.4) * (joy.x || joy.z ? (Math.hypot(joy.x, joy.z) > 0.85 ? 1.35 : 1) : 1);
        var sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
        var tvx = (-sy * fwd + cy * str) * sp, tvz = (-cy * fwd - sy * str) * sp;
        P.vx += (tvx - P.vx) * Math.min(1, dt * 12); P.vz += (tvz - P.vz) * Math.min(1, dt * 12);
        var nx = P.x + P.vx * dt, nz = P.z + P.vz * dt;
        var minX, maxX, minZ, maxZ;
        if (!ph) { minX = -64; maxX = 64; minZ = -5.3; maxZ = 8.2; }
        else { minX = -ph.bp.W / 2 + 0.6; maxX = ph.bp.W / 2 - 0.6; minZ = -ph.bp.D / 2 + 0.7; maxZ = ph.bp.D / 2 - 0.2; }
        nx = Math.max(minX, Math.min(maxX, nx)); nz = Math.max(minZ, Math.min(maxZ, nz));
        if (ph) ph.colliders.forEach(function (c) {
          var dx = nx - c[0], dz = nz - c[1], d = Math.hypot(dx, dz), R = c[2] + 0.3;
          if (d < R && d > 0.001) { nx = c[0] + dx / d * R; nz = c[1] + dz / d * R; }
        });
        var moved = Math.hypot(nx - P.x, nz - P.z); P.x = nx; P.z = nz;
        bob += moved * 2.6;
      }

      var o = off();
      camera.position.set(o + P.x, HEAD + Math.sin(bob) * 0.035, P.z);
      camera.rotation.set(P.pitch, P.yaw, 0);
      var tf = (innerWidth / innerHeight < 0.8 ? 82 : 72) + (keys.shift ? 6 : 0) + (vision ? -4 : 0); if (Math.abs(camera.fov - tf) > 0.2) { camera.fov += (tf - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix(); }
      lamp.position.set(o + P.x - Math.sin(P.yaw) * 0.6, 2.4, P.z - Math.cos(P.yaw) * 0.6);

      // rain follows the camera
      if (rain.visible) {
        rain.position.set(camera.position.x, 0, camera.position.z);
        var a = rainGeo.attributes.position.array;
        for (var i = 0; i < RAIN; i++) {
          var j = i * 6, d = dt * 14;
          a[j + 1] -= d; a[j + 4] -= d;
          if (a[j + 1] < 0) { var h = 12 + Math.random() * 3; a[j + 1] = h; a[j + 4] = h - 0.5; }
        }
        rainGeo.attributes.position.needsUpdate = true;
      }

      // animate markers
      if (ph) {
        var st = cd.state();
        ph.items.forEach(function (it, idx) {
          var isEv = it.kind === 'evidence', done = isEv ? st.found[it.data.id] : st.flavor[it.data.id];
          it.grp.position.y = it.y + Math.sin(time * 1.8 + idx) * 0.06;
          it.mesh.rotation.y = time * 1.4;
          if (isEv) {
            it.mesh.material.color.setHex(done ? 0x3fae87 : 0xe8c87e);
            it.glow.material.color.setHex(done ? 0x3fae87 : 0xe8b84b);
            it.glow.material.opacity = done ? 0.35 : 0.7 + Math.sin(time * 3 + idx) * 0.25;
            var gs = done ? 1.2 : vision ? 4.2 : 1.5; it.glow.scale.set(gs, gs, 1);
          } else {
            it.mesh.visible = !done; it.glow.material.opacity = done ? 0.12 : 0.45;
          }
        });
        if (ph.npc) {
          ph.npc.group.position.y = Math.sin(time * 1.3) * 0.015;
          ph.npc.head.position.y = 1.58 + Math.sin(time * 1.6) * 0.012; ph.npc.head.rotation.y = Math.sin(time * 0.7) * 0.35;
          ph.npc.ring.material.opacity = 0.35 + Math.sin(time * 2.5) * 0.2;
        }
      } else {
        street.movers.forEach(function (m) { m.position.x += m.userData.dir * m.userData.sp * dt; if (m.position.x > 70) m.position.x = -70; if (m.position.x < -70) m.position.x = 70; });
        street.doors.forEach(function (d, i) { d.chev.rotation.y = time * 1.5; d.chev.position.y = 7.2 + Math.sin(time * 2 + i) * 0.25; });
      }
      if (pulseT > 0) { pulseT -= dt; hemi.intensity += pulseT * 0.06; }

      // target + prompt
      if (!panelOpen && ++frame % 3 === 0) {
        var nt = findTarget();
        if ((nt && nt.label) !== (target && target.label) || (!nt) !== (!target)) {
          target = nt;
          var pr = $('wPrompt');
          if (nt) { pr.hidden = false; pr.innerHTML = '<span class="w-key">' + (isTouch ? 'TAP' : 'E') + '</span>' + esc(nt.label); }
          else pr.hidden = true;
        } else target = nt;
      } else if (panelOpen) { target = null; $('wPrompt').hidden = true; }
      if (frame % 20 === 0) updateHud();
      if (frame % 2 === 0) drawRadar();

      renderer.render(scene, camera);
    }

    // init
    setPlaceInstant(P.where, P.x, P.z, P.yaw);
    function setPlaceInstant(where, x, z, yaw) {
      var inRoom = where !== 'street';
      street.group.visible = !inRoom;
      for (var id in rooms) rooms[id].group.visible = (id === where);
      if (inRoom) {
        var A = rooms[where].bp.ambient; hemi.color.setHex(A[0]); hemi.groundColor.setHex(A[1]); hemi.intensity = A[2] + 0.25;
        scene.fog.color.setHex(rooms[where].bp.open ? 0x0a0f18 : 0x08080a); scene.fog.density = rooms[where].bp.open ? 0.024 : 0.026;
        loadArt(rooms[where]); loadFace(rooms[where]);
      }
      rain.visible = !inRoom || (inRoom && rooms[where].bp.open);
    }
    updateHud();
    renderer.render(scene, camera);
    setTimeout(function () { loader.classList.add('gone'); setTimeout(function () { loader.remove(); }, 700); }, 450);
    var firstTime = !Object.keys(cd.state().visited).length && !cd.state().clues.length;
    if (firstTime) showIntro(); else { introOpen = false; narrate(); }
    requestAnimationFrame(tick);

    window.__walk = { P: P, rooms: rooms, setPlace: setPlace, activate: activate, interactables: interactables, closePanel: closePanel, camera: camera };
    return true;
  }
})();
