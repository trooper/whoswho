// WhosWho · life on the map: animals visiting each other, the odd stadium
// wave across London, little floating hearts and Zs, and the weather.
//   var life = WWLife.create(ctx, { onFlash });  // ctx from WWMap (extras)
//   life.update(t, dt, focusIndex) every frame; life.setWeather('rain')
// Weather kinds: sunny, breezy, rain, snow, rainbow, fog, thunder.
(function () {
  var L = window.WWLife = {};

  L.KINDS = ['sunny', 'breezy', 'rain', 'snow', 'rainbow', 'fog', 'thunder'];

  // light and fog for each kind; the scene eases from one to the next
  var LOOK = {
    sunny:   { sun: [0xFFE7B8, 0.95], hemi: 0.6,  fog: [0xF6E2BC, 80, 190] },
    breezy:  { sun: [0xFFF6E6, 0.8],  hemi: 0.55, fog: [0xECE6C9, 70, 170] },
    rain:    { sun: [0xDDE3EE, 0.35], hemi: 0.46, fog: [0xC7CDD6, 45, 140] },
    snow:    { sun: [0xF0F4FF, 0.55], hemi: 0.64, fog: [0xE8EDF3, 50, 150] },
    rainbow: { sun: [0xFFF1DD, 0.85], hemi: 0.56, fog: [0xF3E3D3, 75, 180] },
    fog:     { sun: [0xF4F1EA, 0.4],  hemi: 0.62, fog: [0xEDEBE6, 16, 70] },
    thunder: { sun: [0xB9B6D6, 0.28], hemi: 0.38, fog: [0xA9A8C2, 40, 130] },
  };

  // ------------------------------------------------------------ sprites
  function texture(T, draw) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d'); x.translate(64, 64); draw(x);
    var tx = new T.CanvasTexture(c); tx.anisotropy = 4; return tx;
  }
  function icons(T) {
    var ink = '#2A1E16';
    var outline = function (x, fill) { x.fillStyle = fill; x.fill(); x.lineWidth = 7; x.strokeStyle = '#FFFDF8'; x.stroke(); };
    return {
      heart: texture(T, function (x) { x.beginPath(); x.moveTo(0, 38); x.bezierCurveTo(-58, 0, -40, -52, 0, -22); x.bezierCurveTo(40, -52, 58, 0, 0, 38); outline(x, '#FF6F91'); }),
      star: texture(T, function (x) { x.beginPath(); for (var k = 0; k < 10; k++) { var r = k % 2 ? 22 : 50, a = k / 10 * Math.PI * 2 - Math.PI / 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); outline(x, '#FFC93D'); }),
      note: texture(T, function (x) {
        x.beginPath(); x.ellipse(-14, 26, 20, 15, -0.4, 0, 6.3); x.rect(2, -44, 10, 70); x.moveTo(12, -44); x.quadraticCurveTo(46, -30, 34, 2); x.quadraticCurveTo(40, -24, 12, -26); outline(x, '#8D6BFF');
      }),
      z: texture(T, function (x) { x.font = '800 84px Unbounded, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = '#FFFDF8'; x.strokeText('z', 0, 0); x.fillStyle = '#6C7BD9'; x.fillText('z', 0, 0); }),
      dot: texture(T, function (x) { var g = x.createRadialGradient(0, 0, 0, 0, 0, 60); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(-64, -64, 128, 128); }),
      ink: ink,
    };
  }

  L.create = function (ctx, opts) {
    opts = opts || {};
    var T = ctx.T, S = ctx.scene;
    var ico = icons(T);
    var rnd = Math.random;
    var tmp = new T.Vector3(), tmp2 = new T.Vector3();

    // --------------------------------------------------- floating icons
    var pool = [];
    for (var k = 0; k < 48; k++) {
      var sp = new T.Sprite(new T.SpriteMaterial({ map: ico.heart, transparent: true, depthWrite: false, fog: false }));
      sp.visible = false; S.add(sp); pool.push({ s: sp, life: 0, dur: 1, vx: 0, vz: 0, size: 0.5 });
    }
    var emit = function (kind, at, o2) {
      var p = null; for (var n = 0; n < pool.length; n++) if (!pool[n].s.visible) { p = pool[n]; break; }
      if (!p) return;
      o2 = o2 || {};
      p.s.material.map = ico[kind] || ico.heart; p.s.material.needsUpdate = true;
      p.s.position.copy(at); p.s.visible = true; p.life = 0; p.dur = o2.dur || 1.8; p.size = o2.size || 0.55;
      p.vx = (rnd() - 0.5) * 0.5; p.vz = (rnd() - 0.5) * 0.5; p.vy = o2.vy || 0.9;
    };
    ctx.fx = function (kind, at) { emit(kind, tmp.copy(at).add(tmp2.set(0.35, 0.1, 0)), { dur: 2.4, size: 0.42, vy: 0.45 }); };

    // ------------------------------------------------------- director
    var visits = [], nextVisit = 0, nextWave = 0, flashQueue = [];
    var GREETS = ['heart', 'heart', 'note', 'star'];
    var free = function (m, ms, f) { return ms.indexOf(m) !== f && m.idle() && !m.busy; };
    function startVisit(t, ms, f) {
      var cands = ms.filter(function (m) { return free(m, ms, f); });
      if (cands.length < 2) return;
      var A = cands[Math.floor(rnd() * cands.length)], best = null, bd = 1e9;
      A.pos(tmp);
      cands.forEach(function (B) { if (B === A) return; var d = B.pos(tmp2).distanceTo(tmp); if (d > 1.3 && d < 7.5 && d < bd) { bd = d; best = B; } });
      if (!best) return;
      var B = best, v = { A: A, B: B, phase: 'going', icon: GREETS[Math.floor(rnd() * GREETS.length)] };
      A.busy = B.busy = true;
      var meet = B.pos(new T.Vector3()), from = A.pos(new T.Vector3());
      meet.add(from.sub(meet).setY(0).normalize().multiplyScalar(1.05));
      A.goTo(meet, function () { v.phase = 'greet'; v.until = performance.now() / 1000 + 2.8; v.emitAt = 0; });
      visits.push(v);
    }
    function endVisit(v) {
      v.phase = 'back';
      v.B.face(null); v.B.busy = false;
      v.A.goHome(function () { v.A.busy = false; v.phase = 'done'; });
    }
    function wave(t, ms, f) {
      var xs = ms.map(function (m) { return m.home.x; }), lo = Math.min.apply(null, xs), span = Math.max(1, Math.max.apply(null, xs) - lo);
      ms.forEach(function (m, n) { if (n !== f && !m.away()) m.act('wave', 0.8, t + 0.3 + (m.home.x - lo) / span * 4.5); });
    }
    function startle(t, ms, f) {
      ms.forEach(function (m, n) { if (n !== f && !m.away()) m.act('startle', 0.55, t + 0.05 + rnd() * 0.15); });
    }

    // -------------------------------------------------------- weather
    var wx = new T.Group(); S.add(wx);
    var kind = 'sunny', amt = {}; L.KINDS.forEach(function (k2) { amt[k2] = 0; });
    var sunC = ctx.sun.color.clone(), fogC = S.fog ? S.fog.color.clone() : null, want = new T.Color();
    var W = 14, H = 9; // a box around what the camera is looking at

    // rain: slanted streaks (thin bars, so they read on a projector)
    var RN = 2000, rainD = [], ro = new T.Object3D();
    for (var r1 = 0; r1 < RN; r1++) rainD.push({ x: (rnd() * 2 - 1) * W, y: rnd() * H, z: (rnd() * 2 - 1) * W, v: 11 + rnd() * 5, l: 0.6 + rnd() * 0.6 });
    var rainM = new T.MeshBasicMaterial({ color: 0x6F8FC6, transparent: true, opacity: 0, depthWrite: false });
    var rain = new T.InstancedMesh(new T.BoxGeometry(0.028, 1, 0.028), rainM, RN); rain.frustumCulled = false; wx.add(rain);

    // snow: soft flakes
    var SN = 1600, snowPos = new Float32Array(SN * 3), snowD = [];
    for (var s1 = 0; s1 < SN; s1++) snowD.push({ x: (rnd() * 2 - 1) * W, y: rnd() * H, z: (rnd() * 2 - 1) * W, v: 0.7 + rnd() * 0.6, ph: rnd() * 6.28 });
    var snowG = new T.BufferGeometry(); snowG.setAttribute('position', new T.BufferAttribute(snowPos, 3));
    var snowM = new T.PointsMaterial({ color: 0xFFFFFF, size: 0.34, map: ico.dot, transparent: true, opacity: 0, depthWrite: false });
    var snow = new T.Points(snowG, snowM); snow.frustumCulled = false; wx.add(snow);

    // sunshine: golden motes drifting up
    var MN = 260, motePos = new Float32Array(MN * 3), moteD = [];
    for (var m1 = 0; m1 < MN; m1++) moteD.push({ x: (rnd() * 2 - 1) * W, y: rnd() * H, z: (rnd() * 2 - 1) * W, v: 0.15 + rnd() * 0.25, ph: rnd() * 6.28 });
    var moteG = new T.BufferGeometry(); moteG.setAttribute('position', new T.BufferAttribute(motePos, 3));
    var moteM = new T.PointsMaterial({ color: 0xFFD45E, size: 0.32, map: ico.dot, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
    var motes = new T.Points(moteG, moteM); motes.frustumCulled = false; wx.add(motes);

    // breeze: tumbling leaves
    var LN = 160, leafD = [], leafM = new T.MeshLambertMaterial({ side: T.DoubleSide, transparent: true, opacity: 0 });
    var leaves = new T.InstancedMesh(new T.PlaneGeometry(0.46, 0.27), leafM, LN), lc = new T.Color(), lo3 = new T.Object3D();
    for (var l1 = 0; l1 < LN; l1++) {
      leafD.push({ x: (rnd() * 2 - 1) * W, y: 0.5 + rnd() * 6, z: (rnd() * 2 - 1) * W, v: 2.6 + rnd() * 2, ph: rnd() * 6.28, sp: 2 + rnd() * 4 });
      leaves.setColorAt(l1, lc.set(['#7BC86C', '#A9D46B', '#F2B544', '#E9823A', '#5FAE5B'][l1 % 5]));
    }
    leaves.frustumCulled = false; wx.add(leaves);

    // rainbow: a paper-model arch standing over the city, just beyond the focus
    var bow = new T.Group(), bowM = [], bowAt = null;
    ['#FF8FA8', '#FFB35C', '#FFD84D', '#7FD6A6', '#86A9DA', '#B98CFF'].forEach(function (c, n) {
      var m = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0, depthWrite: false });
      bow.add(new T.Mesh(new T.TorusGeometry(4.6 - n * 0.26, 0.13, 8, 96, Math.PI), m)); bowM.push(m);
    });
    S.add(bow);

    var flash = 0, nextFlash = 0;
    function look(dt) {
      var L2 = LOOK[kind], k = Math.min(1, dt * 0.6);
      sunC.lerp(want.set(L2.sun[0]), k); ctx.sun.color.copy(sunC);
      ctx.sun.intensity += (L2.sun[1] - ctx.sun.intensity) * k;
      var hemiWant = L2.hemi + flash * 1.8;
      ctx.hemi.intensity += (hemiWant - ctx.hemi.intensity) * (flash > 0.05 ? 1 : k);
      if (S.fog) { fogC.lerp(want.set(L2.fog[0]), k); S.fog.color.copy(fogC); S.fog.near += (L2.fog[1] - S.fog.near) * k; S.fog.far += (L2.fog[2] - S.fog.far) * k; }
    }

    function particles(t, dt) {
      wx.position.set(ctx.target.x, 0, ctx.target.z);
      L.KINDS.forEach(function (k2) { var on = k2 === kind || (k2 === 'rain' && kind === 'thunder'); amt[k2] += ((on ? 1 : 0) - amt[k2]) * Math.min(1, dt * 0.7); });
      var wind = kind === 'thunder' ? -0.5 : -0.2;
      if (amt.rain > 0.01) {
        for (var n = 0; n < RN; n++) {
          var d = rainD[n]; d.y -= d.v * dt * (kind === 'thunder' ? 1.25 : 1); if (d.y < 0) { d.y += H; d.x = (rnd() * 2 - 1) * W; d.z = (rnd() * 2 - 1) * W; }
          ro.position.set(d.x, d.y, d.z); ro.rotation.set(0, 0, wind * 0.6); ro.scale.set(1, d.l, 1); ro.updateMatrix(); rain.setMatrixAt(n, ro.matrix);
        }
        rain.instanceMatrix.needsUpdate = true;
      }
      rain.visible = amt.rain > 0.01; rainM.opacity = 0.6 * amt.rain;
      if (amt.snow > 0.01) {
        for (var n2 = 0; n2 < SN; n2++) {
          var e = snowD[n2]; e.y -= e.v * dt; if (e.y < 0) e.y += H;
          snowPos[n2 * 3] = e.x + Math.sin(t * 0.6 + e.ph) * 0.6; snowPos[n2 * 3 + 1] = e.y; snowPos[n2 * 3 + 2] = e.z + Math.cos(t * 0.5 + e.ph) * 0.4;
        }
        snowG.attributes.position.needsUpdate = true;
      }
      snow.visible = amt.snow > 0.01; snowM.opacity = 0.95 * amt.snow;
      if (amt.sunny > 0.01) {
        for (var n3 = 0; n3 < MN; n3++) {
          var q = moteD[n3]; q.y += q.v * dt; if (q.y > 10) q.y = 0;
          motePos[n3 * 3] = q.x + Math.sin(t * 0.4 + q.ph) * 0.5; motePos[n3 * 3 + 1] = q.y; motePos[n3 * 3 + 2] = q.z;
        }
        moteG.attributes.position.needsUpdate = true;
      }
      motes.visible = amt.sunny > 0.01; moteM.opacity = 0.75 * amt.sunny * (0.75 + Math.sin(t * 2) * 0.25);
      if (amt.breezy > 0.01) {
        for (var n4 = 0; n4 < LN; n4++) {
          var f2 = leafD[n4]; f2.x += f2.v * dt; if (f2.x > W) { f2.x -= 2 * W; f2.z = (rnd() * 2 - 1) * W; }
          lo3.position.set(f2.x, f2.y + Math.sin(t * 1.3 + f2.ph) * 0.8, f2.z + Math.sin(t * 0.7 + f2.ph) * 0.6);
          lo3.rotation.set(t * f2.sp + f2.ph, t * f2.sp * 0.7, t * f2.sp * 0.4); lo3.updateMatrix(); leaves.setMatrixAt(n4, lo3.matrix);
        }
        leaves.instanceMatrix.needsUpdate = true;
      }
      leaves.visible = amt.breezy > 0.01; leafM.opacity = amt.breezy;
      bow.visible = amt.rainbow > 0.01;
      if (bow.visible) {
        tmp.copy(ctx.target).sub(ctx.cam.position).setY(0).normalize().multiplyScalar(6.5).add(ctx.target); tmp.y = ctx.maxTop || 0.5;
        if (!bowAt) bowAt = tmp.clone(); else bowAt.lerp(tmp, Math.min(1, dt * 0.5));
        bow.position.copy(bowAt); bow.lookAt(ctx.cam.position.x, bowAt.y, ctx.cam.position.z);
        bowM.forEach(function (m) { m.opacity = 0.85 * amt.rainbow; });
      }
    }

    return {
      kinds: L.KINDS,
      get weather() { return kind; },
      setWeather: function (k2) { if (LOOK[k2]) kind = k2; },

      update: function (t, dt, f) {
        dt = Math.max(0, Math.min(0.05, dt || 0));
        var ms = ctx.markers ? ctx.markers() : [];
        // visits: one animal hops over to a neighbour, they greet, it hops home
        if (!nextVisit) { nextVisit = t + 3; nextWave = t + 75 + rnd() * 45; }
        if (t > nextVisit) { nextVisit = t + 4 + rnd() * 5; if (visits.length < 3) startVisit(t, ms, f); }
        visits.forEach(function (v) {
          var gone = ms.indexOf(v.A) < 0 || ms.indexOf(v.B) < 0, focused = ms.indexOf(v.A) === f || ms.indexOf(v.B) === f;
          if (gone) { v.A.busy = v.B.busy = false; v.phase = 'done'; return; }
          if ((focused && v.phase !== 'back')) return endVisit(v);
          if (v.phase === 'going') v.B.face(v.A.pos(tmp));
          if (v.phase === 'greet') {
            if (!v.started) { v.started = true; v.A.face(v.B.pos(tmp)); v.B.face(v.A.pos(tmp2)); v.A.act('greet', 2.8, t); v.B.act('greet', 2.8, t); }
            if (t > v.emitAt) { v.emitAt = t + 0.45; v.A.pos(tmp).add(v.B.pos(tmp2)).multiplyScalar(0.5); tmp.y += 2.6; emit(v.icon, tmp); }
            if (t > v.until) endVisit(v);
          }
        });
        visits = visits.filter(function (v) { return v.phase !== 'done'; });
        // now and then, a stadium wave rolls across London, west to east
        if (t > nextWave) { nextWave = t + 140 + rnd() * 80; wave(t, ms, f); }

        // weather
        if (kind === 'thunder' && t > nextFlash) {
          nextFlash = t + 5 + rnd() * 7; flashQueue = [t, t + 0.16 + rnd() * 0.1];
          startle(t, ms, f); if (opts.onFlash) opts.onFlash();
        }
        if (flashQueue.length && t >= flashQueue[0]) { flashQueue.shift(); flash = 1; }
        flash *= Math.exp(-dt * 9);
        look(dt);
        particles(t, dt);

        // floating icons
        pool.forEach(function (p) {
          if (!p.s.visible) return;
          p.life += dt; var k = p.life / p.dur;
          if (k >= 1) { p.s.visible = false; return; }
          p.s.position.x += p.vx * dt; p.s.position.z += p.vz * dt; p.s.position.y += p.vy * dt;
          var sc = p.size * (0.6 + Math.min(1, k * 4) * 0.5); p.s.scale.set(sc, sc, 1);
          p.s.material.opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
        });
      },
    };
  };
})();
