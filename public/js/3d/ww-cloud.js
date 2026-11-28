// WhosWho · The Cloud in 3D. Every secret is a cloud whose weather comes from its words.
// WWCloud.create(canvas, {vibes, groups, boroughs, labels(), groupEls(), getSpot(), onPick(id)})
// getSpot() names the cloud in focus: it floats to the front, big, and the rest
// drift back into the haze.
(function () {
  var C = window.WWCloud = {};

  // Vibes, grouping and the classifier live in /js/weather.js (shared with the
  // server); the view passes them in as o.vibes and o.groups.
  var hash = function (s, k) { var h = 2166136261 ^ k; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

  C.create = function (canvas, o) {
    var T = window.THREE, VIBES = o.vibes;
    var r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); r.setSize(1920, 1080, false);
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    var scene = new T.Scene(); scene.fog = new T.Fog(0xF4F2FB, 30, 80);
    var cam = new T.PerspectiveCamera(40, 1920 / 1080, 0.5, 300);
    var env = window.WWZoo3D ? window.WWZoo3D.env(T, r) : null;
    scene.add(new T.HemisphereLight(0xFFFFFF, 0xC9B79A, 0.7));
    var sun = new T.DirectionalLight(0xFFF4E4, 0.75); sun.position.set(-12, 30, 14); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 }); sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
    scene.add(sun);

    // paper London far below, catching cloud shadows
    if (o.boroughs) {
      var pal = ['#F2D3A8', '#EDB9A0', '#BFDCB0', '#B5CDE8', '#EFCB7E', '#D9B6DC', '#F5C7A3'];
      var below = new T.Group(); below.position.set(0, -9, -6); below.scale.setScalar(0.9);
      o.boroughs.forEach(function (b, bi) {
        b.r.forEach(function (ring) {
          var cx = 0, cy = 0; ring.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= ring.length; cy /= ring.length;
          var sh = new T.Shape(ring.map(function (p) { return new T.Vector2(cx + (p[0] - cx) * 0.99, cy + (p[1] - cy) * 0.99); }));
          var g = new T.ExtrudeGeometry(sh, { depth: 0.3 + ((bi * 37) % 4) * 0.1, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2);
          var m = new T.Mesh(g, new T.MeshLambertMaterial({ color: new T.Color(pal[(bi * 3) % 7]) })); m.receiveShadow = true; below.add(m);
        });
      });
      var gp = new T.Mesh(new T.CircleGeometry(200, 48), new T.MeshLambertMaterial({ color: 0xEAD7BA })); gp.rotation.x = -Math.PI / 2; gp.position.y = -0.05; gp.receiveShadow = true; below.add(gp);
      scene.add(below);
    }

    var SG = new T.SphereGeometry(1, 24, 18);
    var mats = {};
    var mat = function (c, gloss, own) {
      var mk = function () { var m = new T.MeshPhysicalMaterial({ color: new T.Color(c), roughness: gloss ? 0.15 : 0.6, clearcoat: gloss ? 1 : 0.35, clearcoatRoughness: 0.4 }); if (env) { m.envMap = env; m.envMapIntensity = gloss ? 0.9 : 0.35; } return m; };
      if (own) return mk();
      var k = c + (gloss ? 'g' : ''); return mats[k] || (mats[k] = mk());
    };
    var ball = function (par, c, x, y, z, s, sy, gloss) { var m = new T.Mesh(SG, typeof c === 'string' ? mat(c, gloss) : c); m.position.set(x, y, z); m.scale.set(s, sy == null ? s : sy, s); m.castShadow = true; par.add(m); return m; };

    var build = function (cl) {
      var v = VIBES[cl.vibe] || VIBES.mist, seed = String(cl.id);
      var root = new T.Group(), body = new T.Group(); root.add(body);
      var cm = cl.vibe === 'storm' ? mat(v.cloud, false, true) : mat(v.cloud);
      var puffs = [[0, 0.1, 0, 1], [-0.9, -0.12, 0.05, 0.72], [0.92, -0.1, 0.05, 0.78], [-0.42, 0.55, -0.05, 0.7], [0.45, 0.6, 0, 0.74], [0.05, 0.2, 0.45, 0.62], [-1.5, -0.3, 0, 0.48], [1.5, -0.28, 0, 0.5]];
      puffs.forEach(function (p, k) { var j = (hash(seed, k) - 0.5) * 0.2; ball(body, cm, p[0] + j, p[1] + j * 0.5, p[2], p[3] * (1 + j * 0.6), p[3] * 0.86 * (1 + j * 0.6)); });
      var fx = { t: 0 };
      var add = function (m) { body.add(m); return m; };
      if (cl.vibe === 'wander') {
        var sg = new T.Group(); sg.position.set(1.0, 0.95, -0.55); body.add(sg);
        var sunM = new T.MeshPhysicalMaterial({ color: 0xFFD84D, roughness: 0.2, clearcoat: 1, emissive: 0xFFB020, emissiveIntensity: 0.35 }); if (env) { sunM.envMap = env; }
        ball(sg, sunM, 0, 0, 0, 0.62);
        var rays = new T.Group(); sg.add(rays);
        for (var k = 0; k < 10; k++) { var a = k / 10 * Math.PI * 2, rc = new T.Mesh(new T.ConeGeometry(0.1, 0.32, 10), sunM); rc.position.set(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0); rc.rotation.z = a - Math.PI / 2; rays.add(rc); }
        fx.update = function (t) { rays.rotation.z = t * 0.4; };
      } else if (cl.vibe === 'creative') {
        var bow = new T.Group(); bow.position.set(0, -0.35, -0.55); body.add(bow);
        ['#FF8FA8', '#FFB35C', '#FFD84D', '#7FD6A6', '#86A9DA', '#B98CFF'].forEach(function (c, k) { var tm = new T.Mesh(new T.TorusGeometry(1.75 - k * 0.13, 0.065, 10, 48, Math.PI), mat(c, true)); tm.castShadow = true; bow.add(tm); });
        fx.update = function (t) { bow.rotation.z = Math.sin(t * 0.8) * 0.06; bow.scale.setScalar(1 + Math.sin(t * 1.6) * 0.02); };
      } else if (cl.vibe === 'happy') {
        var face = new T.Group(); face.position.set(0, 0.12, 1.0); body.add(face);
        [-1, 1].forEach(function (m) { ball(face, '#2A1E16', m * 0.27, 0.1, 0, 0.09, 0.12, true); ball(face, '#FFFFFF', m * 0.27 + 0.03, 0.15, 0.07, 0.03, null, false); var bl = ball(face, '#FF7AA8', m * 0.5, -0.08, -0.06, 0.12, 0.07); bl.scale.z = 0.03; });
        var sm = new T.Mesh(new T.TorusGeometry(0.18, 0.035, 8, 20, Math.PI), mat('#2A1E16', true)); sm.rotation.z = Math.PI; sm.position.set(0, -0.02, 0); face.add(sm);
        fx.update = function (t, ph) { var b = Math.abs(Math.sin(t * 2.6 + ph)); body.position.y = b * 0.25; body.scale.set(1 + (1 - b) * 0.05, 1 - (1 - b) * 0.06, 1); };
      } else if (cl.vibe === 'storm') {
        var sh = new T.Shape(); [[0, 0], [0.32, 0], [0.12, -0.45], [0.38, -0.45], [-0.1, -1.15], [0.04, -0.62], [-0.2, -0.62]].forEach(function (p, k) { if (k) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); });
        var bolt = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }), new T.MeshPhysicalMaterial({ color: 0xFFD84D, emissive: 0xFFC000, emissiveIntensity: 0.8, roughness: 0.2, clearcoat: 1 }));
        bolt.position.set(-0.05, -0.55, 0.35); bolt.castShadow = true; body.add(bolt);
        fx.update = function (t, ph) { var q = (t + ph) % 3.6, on = q < 0.12 || (q > 0.22 && q < 0.32); bolt.visible = true; bolt.material.emissiveIntensity = on ? 1.4 : 0.5; bolt.rotation.z = Math.sin(t * 2 + ph) * 0.08; cm.emissive.set(0xFFF2B0); cm.emissiveIntensity = on ? 0.55 : 0; bolt.scale.setScalar(on ? 1.15 : 1); };
      } else if (cl.vibe === 'rainy' || cl.vibe === 'nature' || cl.vibe === 'foodie' || cl.vibe === 'mist') {
        var n = cl.vibe === 'rainy' ? 16 : cl.vibe === 'mist' ? 8 : 7, bits = [];
        for (var k2 = 0; k2 < n; k2++) {
          var m;
          if (cl.vibe === 'rainy') { m = new T.Mesh(SG, mat('#6F9BFF', true)); m.scale.set(0.045, 0.12, 0.045); }
          else if (cl.vibe === 'nature') { m = new T.Mesh(SG, mat(k2 % 2 ? '#5FB36E' : '#9CCF8A')); m.scale.set(0.14, 0.03, 0.08); }
          else if (cl.vibe === 'foodie') { m = new T.Mesh(SG, new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.8, depthWrite: false })); }
          else { m = new T.Mesh(new T.OctahedronGeometry(0.11, 0), new T.MeshPhysicalMaterial({ color: k2 % 2 ? 0xFFE38A : 0xFFFFFF, emissive: 0xFFF2C0, emissiveIntensity: 0.6, roughness: 0.2 })); }
          m.castShadow = cl.vibe !== 'foodie'; body.add(m); bits.push({ m: m, x: (hash(seed, 20 + k2) - 0.5) * 2.4, z: (hash(seed, 40 + k2) - 0.5) * 0.9, o: hash(seed, 60 + k2) });
        }
        fx.update = function (t, ph) {
          bits.forEach(function (b, k3) {
            var u = (t * (cl.vibe === 'rainy' ? 0.9 : cl.vibe === 'nature' ? 0.25 : 0.35) + b.o) % 1;
            if (cl.vibe === 'rainy') b.m.position.set(b.x, -0.55 - u * 3.2, b.z);
            else if (cl.vibe === 'nature') { b.m.position.set(b.x + Math.sin(u * 9 + k3) * 0.35, -0.6 - u * 3, b.z); b.m.rotation.set(u * 6, u * 4 + k3, Math.sin(u * 8) * 0.8); }
            else if (cl.vibe === 'foodie') { b.m.position.set(b.x * 0.4 + Math.sin(u * 6 + k3) * 0.15, 1.0 + u * 1.6, b.z * 0.5); b.m.scale.setScalar(0.12 + u * 0.22); b.m.material.opacity = 0.75 * (1 - u); }
            else { var a = b.o * 6.283 + t * 0.4; b.m.position.set(Math.cos(a) * 1.9, 0.2 + Math.sin(a * 1.3) * 0.9, Math.sin(a) * 0.6 + 0.3); var tw = 0.5 + 0.5 * Math.sin(t * 3 + k3 * 1.7); b.m.scale.setScalar(0.4 + tw * 0.9); b.m.rotation.y = t * 2; }
          });
        };
      }
      root.userData.id = cl.id;
      return { root: root, body: body, fx: fx, ph: hash(seed, 99) * 6.283, pos: new T.Vector3(), target: new T.Vector3(), s: 0, ts: 1, born: true };
    };

    var objs = {}, groups = [], clouds = [], mode = 'drift';
    var layout = function () {
      var ids = clouds.map(function (c) { return c.id; });
      Object.keys(objs).forEach(function (id) { if (ids.indexOf(id) < 0) { scene.remove(objs[id].root); delete objs[id]; } });
      clouds.forEach(function (c) { if (!objs[c.id]) { var ob = build(c); objs[c.id] = ob; scene.add(ob.root); ob.pos.set((hash(c.id, 7) - 0.5) * 30, 16, -24); ob.root.position.copy(ob.pos); } });
      if (mode === 'drift') {
        groups = [];
        clouds.forEach(function (c, k) {
          var ob = objs[c.id], col = k % 7, row = Math.floor(k / 7) % 5;
          ob.target.set(-14 + col * 4.6 + (hash(c.id, 1) - 0.5) * 2.4 + (row % 2) * 2.2, -1.5 + row * 2.6 + (hash(c.id, 2) - 0.5) * 1.2, -6 + (hash(c.id, 3) - 0.5) * 9);
          ob.ts = 1;
        });
      } else {
        groups = o.groups(clouds, mode);
        var n = groups.length, rows = n > 4 ? 2 : 1, cols = Math.ceil(n / rows);
        groups.forEach(function (g, gi) {
          var row = rows === 2 ? Math.floor(gi / cols) : 0, col = gi % cols, cn = rows === 2 && row === 1 ? n - cols : cols;
          var span = cn > 1 ? 26 : 0, cx = cn > 1 ? -13 + span * col / (cn - 1) : 0;
          var cy = rows === 2 ? (row === 0 ? 4.6 : -1.0) : 1.6, cz = -3 - Math.abs(cx) * 0.18;
          var sc = mode === 'voice' ? 0.85 : 0.66;
          g.center = new T.Vector3(cx, cy, cz); g.radius = (mode === 'voice' ? 1.6 : 1.15) * Math.sqrt(g.members.length) + 1;
          g.members.forEach(function (id, j) {
            var a = j * 2.4, rad = j === 0 ? 0 : (mode === 'voice' ? 1.6 : 1.15) * Math.sqrt(j);
            objs[id].target.set(cx + Math.cos(a) * rad * 1.15, cy + Math.sin(a) * rad * 0.62, cz + ((j % 3) - 1) * 0.7);
            objs[id].ts = sc;
          });
        });
      }
    };

    // The view owns the gestures: it asks what is under a tap (pick), and
    // drags the cloud in front sideways while someone flips through (nudge).
    var th = 0, nudge = 0, held = false, nudgeNow = 0;
    var ray = new T.Raycaster(), ndc = new T.Vector2();
    var pickAt = function (cx, cy) {
      var b = canvas.getBoundingClientRect(); ndc.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1); ray.setFromCamera(ndc, cam);
      var hit = ray.intersectObjects(Object.keys(objs).map(function (k) { return objs[k].root; }), true)[0], ob = hit && hit.object;
      while (ob && ob.userData.id == null) ob = ob.parent; return ob ? ob.userData.id : null;
    };
    var right = new T.Vector3();

    var look = new T.Vector3(0, 2.2, -3), fpos = new T.Vector3(), back = new T.Vector3();
    var v = new T.Vector3(), last = performance.now(), raf = 0, running = true, skyNow = new T.Color(0xF4F2FB), skyWant = new T.Color(0xF4F2FB);
    var loop = function (now) {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      var dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; var t = now / 1000;
      th += (Math.sin(t * 0.07) * 0.12 - th) * Math.min(1, dt * 2);
      cam.position.set(Math.sin(th) * 26, 4 + Math.sin(t * 0.11) * 0.5, Math.cos(th) * 26 - 2); cam.lookAt(look);
      // the focus spot sits halfway to the camera, a little above the line of sight
      fpos.copy(look).lerp(cam.position, 0.5); fpos.y += 1.9;
      // a hand on the card drags the cloud with it (stage px → world units at the spot)
      if (!held) nudge *= Math.exp(-dt * 6);
      nudgeNow += (nudge - nudgeNow) * Math.min(1, dt * (held ? 18 : 8));
      var per = 2 * cam.position.distanceTo(fpos) * Math.tan(cam.fov * Math.PI / 360) / 1080;
      right.set(1, 0, 0).applyQuaternion(cam.quaternion); fpos.addScaledVector(right, nudgeNow * per);
      skyNow.lerp(skyWant, Math.min(1, dt * 1.5)); scene.fog.color.copy(skyNow);
      var spot = o.getSpot ? o.getSpot() : null, k = 1 - Math.exp(-dt * 1.4), kf = 1 - Math.exp(-dt * 2.4);
      if (spot && !objs[spot]) spot = null;
      Object.keys(objs).forEach(function (id) {
        var ob = objs[id], f = spot === id;
        if (f) ob.pos.lerp(fpos, held ? 1 - Math.exp(-dt * 14) : kf);
        else if (spot) ob.pos.lerp(back.copy(ob.target).setZ(ob.target.z - 7), k);
        else ob.pos.lerp(ob.target, k);
        var want = ob.ts * (f ? 1.9 : spot ? 0.85 : 1);
        ob.s += (want - ob.s) * Math.min(1, dt * 3);
        var sway = f ? 0.35 : 1;
        ob.root.position.set(ob.pos.x + Math.sin(t * 0.3 + ob.ph) * 0.25 * sway, ob.pos.y + Math.sin(t * 0.5 + ob.ph) * 0.22 * sway, ob.pos.z);
        ob.root.scale.setScalar(ob.s); ob.root.rotation.y = Math.sin(t * 0.2 + ob.ph) * 0.15 * sway;
        ob.root.rotation.z = f ? -nudgeNow * 0.0004 : 0;
        if (ob.fx.update) ob.fx.update(t, ob.ph);
      });
      r.render(scene, cam);
      var labels = o.labels ? o.labels() : {};
      Object.keys(objs).forEach(function (id) {
        var el = labels[id]; if (!el) return; var ob = objs[id];
        v.set(ob.root.position.x, ob.root.position.y - 1.25 * ob.s, ob.root.position.z);
        var d = cam.position.distanceTo(v); v.project(cam);
        var sc = Math.max(0.55, Math.min(1.2, 24 / d)) * (mode === 'drift' ? 1 : 0.85);
        el.style.transform = 'translate(' + ((v.x + 1) * 960).toFixed(1) + 'px,' + ((1 - v.y) * 540).toFixed(1) + 'px) translate(-50%,0) scale(' + sc.toFixed(3) + ')';
        var op = Math.max(0.25, Math.min(1, 1.6 - d / 28)); el.style.opacity = (spot && spot !== id ? op * 0.35 : op).toFixed(2);
        el.style.zIndex = String(1000 - Math.round(d * 10) + (spot === id ? 500 : 0));
      });
      var gels = o.groupEls ? o.groupEls() : {};
      Object.keys(gels).forEach(function (key) {
        var el = gels[key]; if (!el) return; var g = groups.filter(function (x) { return x.key === key; })[0];
        if (!g || mode === 'drift') { el.style.opacity = 0; return; }
        v.copy(g.center); v.y += g.radius * 0.62 * (mode === 'voice' ? 0.85 : 0.66) + 1.6; v.project(cam);
        // keep cluster labels below the title plate (top 260px of the stage)
        el.style.transform = 'translate(' + ((v.x + 1) * 960).toFixed(1) + 'px,' + Math.max(o.labelTop || 0, (1 - v.y) * 540).toFixed(1) + 'px) translate(-50%,-100%)'; el.style.opacity = 1;
      });
    };
    raf = requestAnimationFrame(loop);

    return {
      sync: function (list, m) { clouds = list.slice(); mode = m || mode; layout(); },
      setSky: function (hex) { skyWant.set(hex); },
      pick: pickAt,
      // px: how far (stage px) the card is dragged; hold: a hand is on it;
      // jump: start there now (a flipped-in cloud slides in from that side)
      setNudge: function (px, hold, jump) { nudge = px; held = !!hold; if (hold || jump) nudgeNow = px; },
      snap: function () { Object.keys(objs).forEach(function (id) { objs[id].pos.copy(objs[id].target); objs[id].s = objs[id].ts; }); skyNow.copy(skyWant); },
      pause: function () { running = false; cancelAnimationFrame(raf); },
      resume: function () { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
      dispose: function () { running = false; cancelAnimationFrame(raf); r.dispose(); if (r.forceContextLoss) r.forceContextLoss(); }
    };
  };
})();
