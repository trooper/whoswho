// Shared 3D London base for the WhosWho map.
// WWMap(canvas, opts) builds boroughs, river, optional buildings/trees, camera tour, picking and label projection.
// opts.boroughs / opts.thames come from /data/london-3d.json; guests arrive via setGuests([{key, x, y, ...}]).
(function () {
  window.WWMap = function (canvas, o) {
    var T = window.THREE, W = { boroughs: o.boroughs, thames: o.thames }, th = o.theme;
    var r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    r.setSize(1920, 1080, false);
    r.shadowMap.enabled = th.shadows !== false;
    r.shadowMap.type = T.PCFSoftShadowMap;
    var scene = new T.Scene();
    if (th.fog != null) scene.fog = new T.Fog(th.fog, th.fogNear || 80, th.fogFar || 220);
    var cam = new T.PerspectiveCamera(o.fov || 30, 1920 / 1080, 0.5, 600);
    var hemi = new T.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2]); scene.add(hemi);
    var sun = new T.DirectionalLight(th.sun[0], th.sun[1]);
    sun.position.set(-26, 50, 26);
    sun.castShadow = th.shadows !== false;
    var SB = th.shadowBounds || 40, SZ = th.shadowSize || 2048;
    sun.shadow.mapSize.set(SZ, SZ);
    Object.assign(sun.shadow.camera, { left: -SB, right: SB, top: SB, bottom: -SB, near: 1, far: 140 });
    if (th.shadowRadius) sun.shadow.radius = th.shadowRadius;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    scene.add(sun);
    if (th.ground != null) {
      var gm = th.groundMat ? th.groundMat(T) : new T.MeshLambertMaterial({ color: th.ground });
      var ground = new T.Mesh(new T.CircleGeometry(300, 72), gm);
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.2; ground.receiveShadow = true; scene.add(ground);
    }

    var seed = 11;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var rings = [], ringTop = [], maxTop = 0;
    W.boroughs.forEach(function (b, bi) {
      var H = th.heights ? th.heights(bi, b.n) : (th.slab || 0.6);
      b.r.forEach(function (ring) {
        var cx = 0, cy = 0;
        ring.forEach(function (p) { cx += p[0]; cy += p[1]; });
        cx /= ring.length; cy /= ring.length;
        var k = th.inset || 0.988;
        var pts2 = ring.map(function (p) { return new T.Vector2(cx + (p[0] - cx) * k, cy + (p[1] - cy) * k); });
        var bev = th.bevel == null ? 0.06 : th.bevel;
        var geo = new T.ExtrudeGeometry(new T.Shape(pts2), { depth: H, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: th.bevelSeg || 2, curveSegments: 1 });
        geo.rotateX(-Math.PI / 2);
        var col = th.borColor ? th.borColor(bi, b.n) : th.bor[(bi * 7) % th.bor.length];
        var mat = th.borMat ? th.borMat(T, col, bi) : new T.MeshStandardMaterial({ color: new T.Color(col), roughness: 0.85, metalness: 0 });
        var m = new T.Mesh(geo, mat);
        m.castShadow = th.shadows !== false; m.receiveShadow = true; scene.add(m);
        var top = H + bev;
        rings.push(ring); ringTop.push(top); maxTop = Math.max(maxTop, top);
        if (th.edge != null) {
          var lp = ring.map(function (p) { return new T.Vector3(cx + (p[0] - cx) * k, top + 0.006, -(cy + (p[1] - cy) * k)); });
          var lm = new T.LineBasicMaterial({ color: th.edge, transparent: true, opacity: th.edgeOp == null ? 0.8 : th.edgeOp, blending: th.edgeAdd ? T.AdditiveBlending : T.NormalBlending, depthWrite: !th.edgeAdd });
          scene.add(new T.Line(new T.BufferGeometry().setFromPoints(lp), lm));
        }
      });
    });
    var TOP = th.slab != null && !th.heights ? (th.slab + (th.bevel == null ? 0.06 : th.bevel)) : maxTop;
    var inRing = function (ring, x, y) {
      var c = false;
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var a = ring[i], b = ring[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
      }
      return c;
    };
    var topAt = function (x, y) { for (var i = 0; i < rings.length; i++) if (inRing(rings[i], x, y)) return ringTop[i]; return -1; };

    var curve = new T.CatmullRomCurve3(W.thames.map(function (p) { return new T.Vector3(p[0], 0, -p[1]); }), false, 'centripetal');
    var N = 440, pos = [], idx = [], samples = [], ry = maxTop + 0.025;
    for (var i = 0; i <= N; i++) {
      var u = i / N, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      var nx = -tg.z, nz = tg.x, w = (th.riverW || 0.24) + 0.55 * Math.pow(u, 1.8);
      pos.push(p.x + nx * w, ry, p.z + nz * w, p.x - nx * w, ry, p.z - nz * w);
      samples.push([p.x, p.z, w]);
      if (i < N) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    var rg = new T.BufferGeometry();
    rg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); rg.setIndex(idx); rg.computeVertexNormals();
    var riverMat = th.riverMat ? th.riverMat(T) : new T.MeshStandardMaterial({ color: th.river, roughness: 0.25, emissive: th.river, emissiveIntensity: th.riverEmis || 0.08, side: T.DoubleSide });
    var river = new T.Mesh(rg, riverMat); river.receiveShadow = true; scene.add(river);
    var nearRiver = function (x, z, pad) { for (var s = 0; s < samples.length; s++) { var q = samples[s], dx = q[0] - x, dz = q[1] - z; if (dx * dx + dz * dz < (q[2] + pad) * (q[2] + pad)) return true; } return false; };

    var ctx = { T: T, scene: scene, TOP: TOP, maxTop: maxTop, topAt: topAt, rnd: rnd, cam: cam, nearRiver: nearRiver, curve: curve, renderer: r, sun: sun, hemi: hemi, target: new T.Vector3() };

    if (th.buildings) {
      var B = th.buildings, box = new T.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
      var bm = new T.MeshStandardMaterial({ roughness: 0.7, emissive: B.emissive || 0x000000, emissiveIntensity: B.emisI || 0 });
      var inst = new T.InstancedMesh(box, bm, B.count);
      inst.castShadow = th.shadows !== false; inst.receiveShadow = true;
      var M = new T.Matrix4(), qq = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3(), cc = new T.Color(), up = new T.Vector3(0, 1, 0);
      var hubs = [[1.9, 0.9, 3.2], [7.6, -0.3, 3.6], [-1.2, 0.3, 1.4]];
      var made = 0, guard = 0;
      while (made < B.count && guard++ < 50000) {
        var rr = (B.spread || 19) * Math.pow(rnd(), 1.7), an = rnd() * Math.PI * 2;
        var x = 1.5 + Math.cos(an) * rr, y = 0.4 + Math.sin(an) * rr * 0.8, h0 = topAt(x, y);
        if (h0 < 0 || nearRiver(x, -y, 0.25)) continue;
        var h = (0.12 + 0.9 * Math.exp(-rr / 3.5) * rnd() + rnd() * 0.12) * (B.hScale || 1);
        hubs.forEach(function (hb) { var d = Math.hypot(x - hb[0], y - hb[1]); if (d < 1.1 && rnd() < 0.55) h += hb[2] * (B.hScale || 1) * (1 - d / 1.1) * (0.4 + rnd() * 0.6); });
        var wv = (0.12 + rnd() * 0.22) * (B.wScale || 1);
        ps.set(x, h0, -y); qq.setFromAxisAngle(up, rnd() * 0.5); sc.set(wv, h, wv * (0.7 + rnd() * 0.6));
        M.compose(ps, qq, sc); inst.setMatrixAt(made, M);
        inst.setColorAt(made, cc.set(B.colors[Math.floor(rnd() * B.colors.length)]));
        made++;
      }
      inst.count = made; scene.add(inst);
    }
    if (th.trees) {
      var TR = th.trees, crown = new T.SphereGeometry(1, 10, 8), trunk = new T.CylinderGeometry(0.25, 0.3, 1, 6);
      var ci = new T.InstancedMesh(crown, new T.MeshStandardMaterial({ roughness: 0.9 }), TR.count);
      var ti = new T.InstancedMesh(trunk, new T.MeshStandardMaterial({ color: TR.trunk || 0x9A6B4A, roughness: 0.9 }), TR.count);
      ci.castShadow = ti.castShadow = th.shadows !== false;
      var M2 = new T.Matrix4(), q2 = new T.Quaternion(), s2 = new T.Vector3(), p2 = new T.Vector3(), c2 = new T.Color();
      var mt = 0, g2 = 0;
      while (mt < TR.count && g2++ < 40000) {
        var x2 = -26 + rnd() * 56, y2 = -22 + rnd() * 44, top2 = topAt(x2, y2);
        var d0 = Math.hypot(x2 - 1.5, y2);
        if (top2 < 0 || d0 < (TR.minR || 7) || nearRiver(x2, -y2, 0.3)) continue;
        var sz = (TR.size || 0.32) * (0.7 + rnd() * 0.7);
        p2.set(x2, top2 + sz * 0.6, -y2); s2.set(sz * 0.25, sz * 0.6, sz * 0.25); M2.compose(p2, q2, s2); ti.setMatrixAt(mt, M2);
        p2.set(x2, top2 + sz * 1.25, -y2); s2.set(sz, sz * 1.05, sz); M2.compose(p2, q2, s2); ci.setMatrixAt(mt, M2);
        ci.setColorAt(mt, c2.set(TR.colors[Math.floor(rnd() * TR.colors.length)]));
        mt++;
      }
      ci.count = ti.count = mt; scene.add(ci); scene.add(ti);
    }

    // Markers are keyed by guest.key, so live updates only add/remove what changed.
    var markers = [], byKey = {}, pick = [], booted = false;
    ctx.markers = function () { return markers; };
    var setGuests = function (list) {
      var next = [], keep = {};
      list.forEach(function (g, i) {
        var m = byKey[g.key];
        if (!m) {
          var gy = topAt(g.x, g.y); if (gy < 0) gy = TOP;
          m = o.marker(ctx, g, i, { x: g.x, z: -g.y, y: gy }, booted ? 0.2 : 0.2 + i * 0.05);
          m.key = g.key; byKey[g.key] = m;
          (m.pick || []).forEach(function (p) { p.userData.key = g.key; });
        }
        keep[g.key] = 1; next.push(m);
      });
      Object.keys(byKey).forEach(function (k) { if (!keep[k]) { if (byKey[k].remove) byKey[k].remove(); delete byKey[k]; } });
      markers = next; booted = true;
      pick = []; markers.forEach(function (m) { (m.pick || []).forEach(function (p) { pick.push(p); }); });
    };
    var extra = o.extras ? o.extras(ctx) : null;

    var C = o.cam || {}, wide = Object.assign({ tx: 1.5, ty: 0, tz: -0.5, r: 58, phi: 0.82 }, C.wide || {}), fc = Object.assign({ r: 22, phi: 0.95, side: 4.5, lift: 0.4 }, C.focus || {});
    var cv = Object.assign({ th: 0 }, wide);
    // Manual camera: drag turns (and tilts) London, wheel or pinch zooms toward
    // the pointer, two fingers (or right/shift-drag) pan. Left alone, it eases
    // back to the tour's framing.
    var drag = 0, touched = 0, man = { zoom: 1, tilt: 0, px: 0, pz: 0 };
    var ptrs = {}, gesture = null;
    var ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hitP = new T.Vector3();
    var rect = function () { return canvas.getBoundingClientRect(); };
    var scaleK = function () { return 1920 / (rect().width || 1920); };
    var poke = function () { touched = Date.now(); if (o.onTouch) o.onTouch(); };
    var groundAt = function (cx, cy) {
      var b = rect(); ndc.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1);
      ray.setFromCamera(ndc, cam); return ray.ray.intersectPlane(plane, hitP) ? hitP.clone() : null;
    };
    // zoom by f (<1 = closer), keeping the ground under (cx, cy) in place
    var zoomBy = function (f, cx, cy) {
      var z0 = man.zoom, z1 = Math.max(0.28, Math.min(2.4, z0 * f));
      if (cx != null) {
        var p = groundAt(cx, cy);
        if (p) { var k = 1 - z1 / z0; man.px += (p.x - ctx.target.x) * k; man.pz += (p.z - ctx.target.z) * k; }
      }
      man.zoom = z1; poke();
    };
    var panBy = function (dx, dy) { // stage px
      var s = cv.r * 0.00105, c = Math.cos(cv.th), sn = Math.sin(cv.th);
      man.px += (-c * dx - sn * dy) * s; man.pz += (sn * dx - c * dy) * s;
      var lim = 26; man.px = Math.max(-lim, Math.min(lim, man.px)); man.pz = Math.max(-lim, Math.min(lim, man.pz));
      poke();
    };
    var mid = function () { var ks = Object.keys(ptrs), a = ptrs[ks[0]], b = ptrs[ks[1]]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; };
    // Gestures are read over the whole view (o.input), so a pinch works even
    // when a finger lands on a card or a label; only taps on the canvas pick.
    var inEl = o.input || canvas;
    var onDown = function (e) {
      if (e.target.closest && e.target.closest('button, a, input')) return;
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { inEl.setPointerCapture(e.pointerId); } catch (_) {}
      var n = Object.keys(ptrs).length;
      if (n === 1) gesture = { kind: e.button === 2 || e.shiftKey ? 'pan' : 'turn', x: e.clientX, y: e.clientY, moved: 0, onMap: e.target === canvas };
      else if (n === 2) { var m = mid(); gesture = { kind: 'pinch', x: m.x, y: m.y, d: m.d, moved: 99 }; }
    };
    var onMove = function (e) {
      var p = ptrs[e.pointerId]; if (!p || !gesture) return;
      p.x = e.clientX; p.y = e.clientY;
      var k = scaleK();
      if (gesture.kind === 'pinch') {
        if (Object.keys(ptrs).length < 2) return;
        var m = mid();
        zoomBy(gesture.d / m.d, m.x, m.y);
        panBy((m.x - gesture.x) * k, (m.y - gesture.y) * k);
        gesture.x = m.x; gesture.y = m.y; gesture.d = m.d;
        return;
      }
      var dx = (e.clientX - gesture.x) * k, dy = (e.clientY - gesture.y) * k;
      gesture.moved += Math.abs(dx) + Math.abs(dy);
      gesture.x = e.clientX; gesture.y = e.clientY;
      if (gesture.moved < 6) return;
      if (gesture.kind === 'pan') panBy(dx, dy);
      else { drag += dx * 0.0035; man.tilt = Math.max(-0.5, Math.min(0.45, man.tilt - dy * 0.0015)); poke(); }
    };
    var onUp = function (e) {
      if (!ptrs[e.pointerId]) return;
      delete ptrs[e.pointerId];
      var n = Object.keys(ptrs).length;
      if (gesture && gesture.kind !== 'pinch' && gesture.onMap && gesture.moved < 6 && n === 0 && e.type === 'pointerup') {
        var b = rect(); ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
        ray.setFromCamera(ndc, cam);
        var hit = ray.intersectObjects(pick, true)[0];
        var o2 = hit && hit.object; while (o2 && o2.userData.key == null) o2 = o2.parent;
        var idx = -1; if (o2) markers.forEach(function (m, j) { if (m.key === o2.userData.key) idx = j; });
        if (o.onPick) o.onPick(idx);
      }
      // lifting one finger of a pinch carries on as a turn with the other
      if (n === 1) { var q = ptrs[Object.keys(ptrs)[0]]; gesture = { kind: 'turn', x: q.x, y: q.y, moved: 99 }; }
      else if (n === 0) gesture = null;
    };
    var onWheel = function (e) {
      e.preventDefault();
      var d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomBy(Math.exp(d * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY); // ctrlKey = trackpad pinch
    };
    var noMenu = function (e) { e.preventDefault(); };
    inEl.addEventListener('pointerdown', onDown);
    inEl.addEventListener('pointermove', onMove);
    inEl.addEventListener('pointerup', onUp);
    inEl.addEventListener('pointercancel', onUp);
    inEl.addEventListener('wheel', onWheel, { passive: false });
    inEl.addEventListener('contextmenu', noMenu);
    var RESET_MS = o.resetMs || 12000;

    var v = new T.Vector3(), last = performance.now(), raf = 0, running = true;
    var loop = function (now) {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      var dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; // rAF time can trail performance.now() right after resume
      var t = now / 1000, f = o.getFocus();
      markers.forEach(function (m, i) { m.update(t, dt, f === i, f >= 0); });
      if (extra && extra.update) extra.update(t, dt, f);
      var th0 = Math.sin(t * (C.sway || 0.045)) * (C.swayAmt == null ? 0.3 : C.swayAmt) + drag + (C.spin ? t * C.spin : 0);
      var want;
      if (f >= 0 && markers[f]) {
        var a = markers[f].anchor(v.set(0, 0, 0)).clone();
        want = { tx: a.x + Math.cos(th0) * fc.side, ty: a.y * fc.lift, tz: a.z - Math.sin(th0) * fc.side, r: fc.r, phi: fc.phi, th: th0 };
      } else want = Object.assign({}, wide, { th: th0 });
      var idle = Date.now() - touched;
      if (idle > RESET_MS) { // left alone: drift back to the tour's framing
        var kr = 1 - Math.exp(-dt * 0.9);
        man.zoom += (1 - man.zoom) * kr; man.tilt -= man.tilt * kr; man.px -= man.px * kr; man.pz -= man.pz * kr;
      }
      want.r = Math.max(3.5, want.r * man.zoom);
      want.phi = Math.max(0.22, Math.min(1.32, want.phi + man.tilt));
      want.tx += man.px; want.tz += man.pz;
      // follow a hand quickly; glide between tour stops
      var k = 1 - Math.exp(-dt * (idle < 1500 ? 7 : 1.6));
      Object.keys(want).forEach(function (key) { cv[key] += (want[key] - cv[key]) * k; });
      cam.position.set(cv.tx + cv.r * Math.sin(cv.phi) * Math.sin(cv.th), cv.ty + cv.r * Math.cos(cv.phi), cv.tz + cv.r * Math.sin(cv.phi) * Math.cos(cv.th));
      cam.lookAt(cv.tx, cv.ty, cv.tz); ctx.target.set(cv.tx, cv.ty, cv.tz);
      r.render(scene, cam);
      var els = o.pins ? o.pins() : [];
      markers.forEach(function (m, i) {
        var el = els[i]; if (!el) return;
        m.anchor(v.set(0, 0, 0)); v.y += m.labelLift || 0;
        var d = cam.position.distanceTo(v);
        v.project(cam);
        var sx = (v.x + 1) * 960, sy = (1 - v.y) * 540;
        var vis = v.z < 1 && f !== i && sx > -120 && sx < 2040;
        var s = Math.max(0.7, Math.min(1.2, (o.labelScale || 36) / d));
        el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) translate(-50%,-100%) scale(' + s.toFixed(3) + ')';
        el.style.opacity = vis ? (f >= 0 ? 0.5 : 1) : 0;
        el.style.zIndex = String(2000 - Math.round(d * 10));
      });
      var lead = o.lead && o.lead(), dot = o.dot && o.dot();
      if (lead) {
        if (f >= 0 && markers[f]) {
          markers[f].anchor(v.set(0, 0, 0)); v.project(cam);
          var lx = ((v.x + 1) * 960).toFixed(1), ly = ((1 - v.y) * 540).toFixed(1), ca = o.cardAt || [1320, 330];
          lead.setAttribute('x1', lx); lead.setAttribute('y1', ly); lead.setAttribute('x2', ca[0]); lead.setAttribute('y2', ca[1]); lead.setAttribute('opacity', '1');
          if (dot) { dot.setAttribute('cx', lx); dot.setAttribute('cy', ly); dot.setAttribute('opacity', '1'); }
        } else { lead.setAttribute('opacity', '0'); if (dot) dot.setAttribute('opacity', '0'); }
      }
    };
    raf = requestAnimationFrame(loop);

    return {
      setGuests: setGuests,
      touched: function () { return touched; },
      zoomBy: function (f) { zoomBy(f); },
      // Only the view on screen renders; the others sleep.
      pause: function () { running = false; cancelAnimationFrame(raf); },
      resume: function () { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
      dispose: function () {
        running = false;
        cancelAnimationFrame(raf);
        inEl.removeEventListener('pointerdown', onDown);
        inEl.removeEventListener('pointermove', onMove);
        inEl.removeEventListener('pointerup', onUp);
        inEl.removeEventListener('pointercancel', onUp);
        inEl.removeEventListener('wheel', onWheel);
        inEl.removeEventListener('contextmenu', noMenu);
        r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
      }
    };
  };

  // Canvas texture helpers shared by the directions.
  window.WWMap.glowTex = function (T, inner, outer) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner || 'rgba(255,255,255,1)'); g.addColorStop(0.25, outer || 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  };
  window.WWMap.beamTex = function (T) {
    var c = document.createElement('canvas'); c.width = 64; c.height = 256;
    var x = c.getContext('2d'), g = x.createLinearGradient(0, 256, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 256);
    var h = x.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 64, 256);
    return new T.CanvasTexture(c);
  };
})();
