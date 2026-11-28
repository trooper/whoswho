// WhosWho · 3D spirit animals: modelled chibi characters that hop, blink and wiggle.
(function () {
  var Z3 = window.WWZoo3D = {};
  var INK = '#2A1E16';

  Z3.env = function (T, renderer) {
    var s = new T.Scene();
    var g = new T.SphereGeometry(10, 32, 16), cols = [], p = g.attributes.position, c = new T.Color();
    for (var i = 0; i < p.count; i++) { var y = p.getY(i) / 10; c.set(y > 0.2 ? 0xFFF8EC : y > -0.1 ? 0xF6D9B8 : 0xB89A74); cols.push(c.r, c.g, c.b); }
    g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    s.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    var panel = new T.Mesh(new T.PlaneGeometry(6, 3), new T.MeshBasicMaterial({ color: 0xFFFFFF }));
    panel.position.set(-4, 6, 5); panel.lookAt(0, 0, 0); s.add(panel);
    var pm = new T.PMREMGenerator(renderer);
    var tex = pm.fromScene(s, 0.03).texture; pm.dispose();
    return tex;
  };

  Z3.build = function (T, kind, env) {
    var cache = {};
    var M = function (c, gloss) {
      var k = c + (gloss ? 'g' : '');
      if (!cache[k]) {
        cache[k] = new T.MeshPhysicalMaterial({ color: new T.Color(c), roughness: gloss ? 0.12 : 0.55, clearcoat: gloss ? 1 : 0.4, clearcoatRoughness: 0.35 });
        if (env) { cache[k].envMap = env; cache[k].envMapIntensity = gloss ? 0.9 : 0.25; }
      }
      return cache[k];
    };
    var SG = Z3._sg || (Z3._sg = new T.SphereGeometry(1, 28, 20));
    var root = new T.Group(), ch = new T.Group(); ch.position.y = 0.95; root.add(ch);
    var head = new T.Group(); ch.add(head);
    var parts = { eyes: [], ears: [], tail: null };
    var R = 0.5;
    var fz = function (x, y) { return Math.sqrt(Math.max(0, R * R - x * x - y * y)); };
    var mesh = function (geo, c, gloss) { var m = new T.Mesh(geo, M(c, gloss)); m.castShadow = true; m.receiveShadow = true; return m; };
    var sph = function (par, c, x, y, z, sx, sy, sz, gloss) { var m = mesh(SG, c, gloss); m.position.set(x, y, z); m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz); par.add(m); return m; };
    var stick = function (c, x, y, sx, sy, sz, rz, rad) {
      var r = rad || R, z = Math.sqrt(Math.max(0, r * r - x * x - y * y));
      var m = mesh(SG, c); m.position.set(x, y, z * 0.98); m.scale.set(sx, sy, sz); m.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(x, y, z).normalize()); m.rotateZ(rz || 0); head.add(m); return m;
    };
    var cone = function (par, c, r, h, x, y, z, rx, rz, seg) { var m = mesh(new T.ConeGeometry(r, h, seg || 24), c); m.position.set(x, y, z); m.rotation.set(rx || 0, 0, rz || 0); par.add(m); return m; };
    var eye = function (x, y, r, zo, white) {
      var g = new T.Group(); g.position.set(x, y, zo != null ? zo : fz(x, y) * 0.95);
      if (white) sph(g, '#FFFFFF', 0, 0, 0, r * 1.7, r * 1.7, r * 0.7);
      sph(g, INK, 0, 0, white ? r * 0.45 : 0, r, r * 1.08, r * 0.7, true);
      sph(g, '#FFFFFF', r * 0.35, r * 0.4, (white ? r * 0.45 : 0) + r * 0.6, r * 0.3);
      head.add(g); parts.eyes.push(g); return g;
    };
    var eyes = function (x, y, r, zo, white) { eye(-x, y, r, zo, white); eye(x, y, r, zo, white); };
    var cheeks = function (x, y, rad) { [-1, 1].forEach(function (m) { stick('#FF8FA8', m * x, y, 0.075, 0.05, 0.018, 0, rad); }); };
    var earCone = function (c, inner, x, y, r, h, tilt, fwd) {
      [-1, 1].forEach(function (m) {
        var g = new T.Group(); g.position.set(m * x, y, 0); g.rotation.z = -m * tilt; g.rotation.x = fwd || 0;
        cone(g, c, r, h, 0, h / 2, 0);
        if (inner) cone(g, inner, r * 0.55, h * 0.7, 0, h * 0.4, r * 0.38);
        head.add(g); parts.ears.push(g);
      });
    };
    var earRound = function (c, inner, x, y, r, z, ry) {
      [-1, 1].forEach(function (m) {
        var g = new T.Group(); g.position.set(m * x, y, z || 0); g.rotation.y = (ry || 0) * m;
        sph(g, c, 0, 0, 0, r, r, r * 0.55);
        if (inner) sph(g, inner, 0, 0, r * 0.32, r * 0.6, r * 0.6, r * 0.3);
        head.add(g); parts.ears.push(g);
      });
    };
    var nose = function (c, y, z, r, gl) { return sph(head, c, 0, y, z, r * 1.25, r * 0.9, r * 0.8, gl !== false); };
    var smile = function (y, z, r, c) { var m = mesh(new T.TorusGeometry(r, 0.016, 8, 24, Math.PI), c || INK); m.rotation.z = Math.PI; m.position.set(0, y, z); head.add(m); return m; };
    var whiskers = function (y, z) { [-1, 1].forEach(function (m) { [-0.06, 0.03].forEach(function (dy, k) { var w = mesh(new T.CylinderGeometry(0.006, 0.006, 0.28, 4), INK); w.rotation.z = Math.PI / 2 + m * (k ? 0.15 : -0.1); w.position.set(m * 0.3, y + dy, z); head.add(w); }); }); };
    var body = function (c, belly, w) {
      var b = sph(ch, c, 0, -0.62, -0.02, 0.33 * (w || 1), 0.3, 0.3);
      if (belly) sph(ch, belly, 0, -0.64, 0.1, 0.24 * (w || 1), 0.22, 0.22);
      [-1, 1].forEach(function (m) { sph(ch, c, m * 0.16, -0.9, 0.06, 0.1, 0.06, 0.12); sph(ch, c, m * 0.3, -0.6, 0.04, 0.08, 0.13, 0.08); });
      return b;
    };
    var H = function (c, sx, sy, sz) { return sph(head, c, 0, 0, 0, R * (sx || 1), R * (sy || 1), R * (sz || 1)); };
    var dirs = function (n, filter) { var out = [], ga = Math.PI * (3 - Math.sqrt(5)); for (var k = 0; k < n; k++) { var y = 1 - 2 * (k + 0.5) / n, rr = Math.sqrt(1 - y * y), a = k * ga, d = new T.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr); if (!filter || filter(d)) out.push(d); } return out; };

    var both = function (fn) { fn(-1); fn(1); };
    var tube = function (par, c, pts, r, cap) {
      var cv = new T.CatmullRomCurve3(pts.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); }));
      var m = mesh(new T.TubeGeometry(cv, 20, r, 10, false), c); par.add(m);
      var e = pts[pts.length - 1], s = pts[0];
      if (cap !== false) { sph(par, c, e[0], e[1], e[2], r); sph(par, c, s[0], s[1], s[2], r); }
      return m;
    };
    var leaf = function (c, inner, x, y, len, wid, tilt, z) { // a flat ear that leans out by `tilt`
      both(function (m) {
        var g = new T.Group(); g.position.set(m * x, y, z || 0); g.rotation.z = -m * tilt;
        sph(g, c, 0, len, 0, wid, len, wid * 0.45);
        if (inner) sph(g, inner, 0, len, wid * 0.24, wid * 0.58, len * 0.72, wid * 0.24);
        head.add(g); parts.ears.push(g);
      });
    };
    var eyeGroup = function (x, y, z, build) { var g = new T.Group(); g.position.set(x, y, z); build(g); head.add(g); parts.eyes.push(g); return g; };
    var irisEyes = function (x, y, r, iris) { // coloured eyes (wolf, goat, eagle)
      both(function (m) { eyeGroup(m * x, y, fz(m * x, y) * 0.95, function (g) { sph(g, iris, 0, 0, 0, r * 1.15, r * 1.15, r * 0.5); sph(g, INK, 0, 0, r * 0.3, r * 0.62, r * 0.66, r * 0.4, true); sph(g, '#FFFFFF', r * 0.25, r * 0.3, r * 0.65, r * 0.22); }); });
    };
    var muzzle = function (c, w, h, y, z) { return sph(head, c, 0, y == null ? -0.15 : y, z == null ? 0.33 : z, w || 0.2, h || 0.15, 0.16); };
    var nostrils = function (c, dx, y, z, r) { both(function (m) { sph(head, c, m * dx, y, z, r || 0.025, (r || 0.025) * 1.4, (r || 0.025) * 0.7); }); };
    var bands = function (par, c, cy, cz, rx, ry, rz, ys) { // stripes around an ellipsoid body
      ys.forEach(function (dy) { var k = Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry))); sph(par, c, 0, cy + dy, cz, rx * k * 1.03, 0.028, rz * k * 1.03); });
    };
    var tailGroup = function (x, y, z) { var g = new T.Group(); g.position.set(x, y, z); ch.add(g); parts.tail = g; return g; };
    var lune = function (c, center, width, t0, t1) { // a stripe hugging the head from the crown down the face (angles in turns of PI)
      head.add(mesh(new T.SphereGeometry(R * 1.012, 24, 16, Math.PI / 2 + center - width / 2, width, t0 * Math.PI, (t1 - t0) * Math.PI), c));
    };
    var mane = function (c, from, to, n, r) { for (var k = 0; k < n; k++) { var a = from + (to - from) * k / (n - 1); sph(head, c, 0, 0.5 * Math.cos(a), 0.5 * Math.sin(a) * -1 + 0.02, r * 0.8, r, r * 0.9); } };
    switch (kind) {
      case 'fox':
        body('#FF7A3D', '#FFF6EC'); H('#FF7A3D'); earCone('#FF7A3D', '#3A2320', 0.27, 0.32, 0.14, 0.32, 0.3);
        [-1, 1].forEach(function (m) { sph(head, '#FFF6EC', m * 0.19, -0.14, 0.3, 0.17, 0.14, 0.12); });
        sph(head, '#FFF6EC', 0, -0.13, 0.36, 0.17, 0.13, 0.2); nose(INK, -0.08, 0.56, 0.05); eyes(0.17, 0.07, 0.065);
        parts.tail = sph(ch, '#FF7A3D', 0, -0.62, -0.38, 0.12, 0.12, 0.26); sph(parts.tail, '#FFF6EC', 0, 0, -0.8, 0.7); break;
      case 'cat':
        body('#8E9AB4', '#FFFFFF'); H('#8E9AB4'); earCone('#8E9AB4', '#FFB3C7', 0.26, 0.33, 0.13, 0.26, 0.25);
        [[-0.09, 0.32], [0, 0.35], [0.09, 0.32]].forEach(function (p) { stick('#8A8DA0', p[0], p[1], 0.022, 0.07, 0.015); });
        sph(head, '#FFFFFF', 0, -0.15, 0.36, 0.15, 0.1, 0.12); nose('#FF6F91', -0.08, 0.48, 0.035); whiskers(-0.12, 0.42); eyes(0.17, 0.06, 0.065); cheeks(0.27, -0.1);
        parts.tail = sph(ch, '#8E9AB4', 0.1, -0.5, -0.36, 0.06, 0.24, 0.06); break;
      case 'bear':
        body('#A86B45', '#E7C9A6'); H('#A86B45'); earRound('#A86B45', '#E7B98F', 0.33, 0.33, 0.15);
        sph(head, '#E7C9A6', 0, -0.14, 0.34, 0.2, 0.15, 0.14); nose(INK, -0.08, 0.47, 0.055); eyes(0.17, 0.07, 0.065); cheeks(0.3, -0.08); break;
      case 'rabbit':
        body('#F1E6FF', '#FFFFFF'); H('#F1E6FF');
        [-1, 1].forEach(function (m) { var g = new T.Group(); g.position.set(m * 0.16, 0.36, 0); g.rotation.z = -m * 0.12; sph(g, '#F1E6FF', 0, 0.3, 0, 0.1, 0.32, 0.07); sph(g, '#FFB3C7', 0, 0.3, 0.045, 0.055, 0.24, 0.035); head.add(g); parts.ears.push(g); });
        sph(head, '#FFFFFF', 0, -0.14, 0.36, 0.15, 0.1, 0.12); nose('#FF6F91', -0.09, 0.48, 0.035); var tt = mesh(new T.BoxGeometry(0.07, 0.07, 0.02), '#FFFFFF'); tt.position.set(0, -0.23, 0.44); head.add(tt);
        eyes(0.17, 0.06, 0.065); cheeks(0.28, -0.1); parts.tail = sph(ch, '#FFFFFF', 0, -0.68, -0.34, 0.1); break;
      case 'frog':
        body('#62C370', '#C9F2C0'); H('#62C370', 1.15, 0.85, 1);
        [-1, 1].forEach(function (m) { sph(head, '#62C370', m * 0.22, 0.3, 0.1, 0.16); });
        eye(-0.22, 0.32, 0.06, 0.25, true); eye(0.22, 0.32, 0.06, 0.25, true);
        smile(-0.02, 0.42, 0.2); cheeks(0.36, -0.08, 0.52); break;
      case 'panda':
        body(INK, '#FAFAFA'); H('#FAFAFA'); earRound(INK, null, 0.33, 0.34, 0.14);
        [-1, 1].forEach(function (m) { stick(INK, m * 0.16, 0.03, 0.1, 0.13, 0.04, m * 0.5); });
        eye(-0.16, 0.05, 0.035, 0.49); eye(0.16, 0.05, 0.035, 0.49); sph(head, '#FFFFFF', 0, -0.15, 0.36, 0.14, 0.1, 0.12); nose(INK, -0.1, 0.47, 0.045); break;
      case 'owl':
        body('#9A6B4A', '#D8B48A'); H('#9A6B4A', 1, 1.05, 1); sph(head, '#D8B48A', 0, -0.02, 0.22, 0.4, 0.4, 0.3);
        [-1, 1].forEach(function (m) { var d = mesh(new T.CylinderGeometry(0.15, 0.15, 0.04, 32), '#FFB020'); d.rotation.x = Math.PI / 2; d.position.set(m * 0.15, 0.04, 0.49); head.add(d); });
        eye(-0.15, 0.04, 0.07, 0.52, true); eye(0.15, 0.04, 0.07, 0.52, true);
        cone(head, '#FFB020', 0.05, 0.14, 0, -0.14, 0.52, Math.PI * 0.8); earCone('#6E4A33', null, 0.3, 0.38, 0.07, 0.2, 0.45); break;
      case 'pig':
        body('#FF9FB8', '#FFC2D2'); H('#FF9FB8'); earCone('#FF9FB8', '#FF7FA0', 0.3, 0.3, 0.13, 0.22, 0.55, 0.6);
        var sn = mesh(new T.CylinderGeometry(0.14, 0.15, 0.12, 28), '#FF7FA0'); sn.rotation.x = Math.PI / 2; sn.position.set(0, -0.1, 0.46); head.add(sn);
        [-1, 1].forEach(function (m) { sph(head, INK, m * 0.05, -0.1, 0.52, 0.025, 0.04, 0.02); }); eyes(0.18, 0.12, 0.05); cheeks(0.3, -0.06);
        parts.tail = mesh(new T.TorusGeometry(0.05, 0.015, 8, 16), '#FF9FB8'); parts.tail.position.set(0, -0.55, -0.32); ch.add(parts.tail); break;
      case 'lion':
        body('#F5B94E', '#FFF1D6'); sph(head, '#C8742E', 0, 0, -0.12, 0.62, 0.62, 0.4);
        for (var k = 0; k < 16; k++) { var a = k / 16 * Math.PI * 2; sph(head, '#C8742E', Math.cos(a) * 0.52, Math.sin(a) * 0.52, -0.05, 0.16); }
        H('#F5B94E'); earRound('#F5B94E', '#C8742E', 0.3, 0.34, 0.11, 0.05);
        [-1, 1].forEach(function (m) { sph(head, '#FFF1D6', m * 0.08, -0.16, 0.37, 0.1, 0.08, 0.08); }); nose('#6B3A22', -0.08, 0.46, 0.05); eyes(0.17, 0.07, 0.065); cheeks(0.3, -0.08);
        parts.tail = sph(ch, '#C8742E', 0, -0.7, -0.4, 0.08); break;
      case 'tiger':
        body('#FF8A2B', '#FFF6EC'); H('#FF8A2B'); earRound('#FF8A2B', '#FFF6EC', 0.32, 0.34, 0.13);
        [[-0.08, 0.36, 0.2], [0, 0.4, 0], [0.08, 0.36, -0.2]].forEach(function (p) { stick(INK, p[0], p[1], 0.022, 0.08, 0.015, p[2]); });
        [-1, 1].forEach(function (m) { stick(INK, m * 0.42, 0.08, 0.022, 0.09, 0.015, Math.PI / 2 - m * 0.2); stick(INK, m * 0.4, -0.08, 0.022, 0.08, 0.015, Math.PI / 2 + m * 0.2); sph(head, '#FFF6EC', m * 0.09, -0.16, 0.36, 0.12, 0.09, 0.09); });
        nose('#FF6F91', -0.09, 0.47, 0.045); eyes(0.17, 0.07, 0.065); break;
      case 'monkey':
        body('#8B5A3C', '#F2C9A0'); H('#8B5A3C'); earRound('#8B5A3C', '#E8B48C', 0.5, 0, 0.15, 0, Math.PI / 2.4);
        sph(head, '#F2C9A0', 0, -0.1, 0.2, 0.36, 0.3, 0.32); [-1, 1].forEach(function (m) { sph(head, '#F2C9A0', m * 0.13, 0.08, 0.3, 0.16, 0.15, 0.18); });
        eye(-0.13, 0.08, 0.05, 0.48); eye(0.13, 0.08, 0.05, 0.48); [-1, 1].forEach(function (m) { sph(head, INK, m * 0.04, -0.06, 0.52, 0.018, 0.028, 0.015); }); smile(-0.12, 0.5, 0.11); break;
      case 'penguin':
        body('#26304A', '#FFFFFF'); H('#26304A'); sph(head, '#FFFFFF', 0, -0.07, 0.18, 0.38, 0.34, 0.34);
        eye(-0.15, 0.04, 0.05, 0.5); eye(0.15, 0.04, 0.05, 0.5); cone(head, '#FF9A3D', 0.07, 0.16, 0, -0.1, 0.6, Math.PI / 2);
        cone(head, '#26304A', 0.05, 0.15, 0, 0.55, 0); cheeks(0.27, -0.1, 0.52); break;
      case 'dog':
        body('#E3B26E', '#FFF1DA'); H('#E3B26E'); stick('#C98C4A', 0.16, 0.1, 0.12, 0.11, 0.04);
        [-1, 1].forEach(function (m) { var g = new T.Group(); g.position.set(m * 0.4, 0.22, 0); g.rotation.z = m * 0.3; sph(g, '#8A5A35', 0, -0.2, 0, 0.12, 0.26, 0.08); head.add(g); parts.ears.push(g); });
        sph(head, '#FFF1DA', 0, -0.14, 0.34, 0.2, 0.15, 0.14); nose(INK, -0.07, 0.47, 0.06); sph(head, '#FF6F91', 0, -0.26, 0.4, 0.05, 0.07, 0.03); eyes(0.17, 0.07, 0.065);
        parts.tail = sph(ch, '#E3B26E', 0, -0.48, -0.34, 0.06, 0.16, 0.06); break;
      case 'mouse':
        body('#BFA8DD', '#E9E5F0'); H('#BFA8DD');
        [-1, 1].forEach(function (m) { var g = new T.Group(); g.position.set(m * 0.32, 0.38, -0.02); g.rotation.z = -m * 0.3; sph(g, '#BFA8DD', 0, 0, 0, 0.22, 0.22, 0.06); sph(g, '#FFB3C7', 0, 0, 0.035, 0.14, 0.14, 0.03); head.add(g); parts.ears.push(g); });
        sph(head, '#BFA8DD', 0, -0.1, 0.36, 0.14, 0.12, 0.16); nose('#FF6F91', -0.08, 0.52, 0.035); whiskers(-0.1, 0.44); eyes(0.16, 0.07, 0.05); cheeks(0.28, -0.08);
        parts.tail = mesh(new T.TorusGeometry(0.18, 0.015, 6, 20, Math.PI), '#FFB3C7'); parts.tail.position.set(0, -0.8, -0.38); parts.tail.rotation.y = Math.PI / 2; ch.add(parts.tail); break;
      case 'raccoon':
        body('#8E8EA0', '#C9C9D6'); H('#8E8EA0'); earCone('#8E8EA0', '#3A3442', 0.27, 0.32, 0.13, 0.26, 0.25);
        sph(head, '#3A3442', 0, 0.06, 0.26, 0.4, 0.12, 0.24); [-1, 1].forEach(function (m) { stick('#FFFFFF', m * 0.16, 0.2, 0.1, 0.035, 0.02); });
        sph(head, '#FFFFFF', 0, -0.14, 0.34, 0.17, 0.12, 0.14); nose(INK, -0.08, 0.47, 0.045); eye(-0.16, 0.06, 0.04, 0.5, true); eye(0.16, 0.06, 0.04, 0.5, true);
        parts.tail = sph(ch, '#8E8EA0', 0, -0.62, -0.38, 0.1, 0.1, 0.24); break;
      case 'koala':
        body('#8F99AD', '#E4E6EC'); H('#8F99AD'); earRound('#8F99AD', '#F2EEF7', 0.42, 0.26, 0.2);
        sph(head, INK, 0, -0.06, 0.45, 0.08, 0.11, 0.07, true); eyes(0.18, 0.08, 0.045); cheeks(0.3, -0.12); break;
      case 'elephant':
        body('#86A9DA', '#C5D3E6', 1.1); H('#86A9DA');
        [-1, 1].forEach(function (m) { var g = new T.Group(); g.position.set(m * 0.44, 0.02, -0.06); g.rotation.y = m * 0.5; sph(g, '#86A9DA', 0, 0, 0, 0.32, 0.36, 0.06); sph(g, '#FFC7D6', 0, 0, 0.04, 0.22, 0.26, 0.03); head.add(g); parts.ears.push(g); });
        var tc = new T.CatmullRomCurve3([new T.Vector3(0, -0.05, 0.42), new T.Vector3(0, -0.25, 0.56), new T.Vector3(0, -0.45, 0.56), new T.Vector3(0, -0.52, 0.66)]);
        var tr = mesh(new T.TubeGeometry(tc, 20, 0.075, 12, false), '#86A9DA'); head.add(tr); sph(head, '#86A9DA', 0, -0.52, 0.66, 0.075);
        eyes(0.18, 0.1, 0.05); cheeks(0.3, -0.06); break;
      case 'hedgehog':
        body('#7A5236', '#F2D7B0'); H('#7A5236');
        dirs(130, function (d) { return d.z < 0.4 && d.y > -0.6; }).forEach(function (d) { var c = mesh(new T.ConeGeometry(0.055, 0.3, 8), '#4A2E1C'); c.position.copy(d).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d); head.add(c); });
        sph(head, '#F2D7B0', 0, -0.06, 0.2, 0.36, 0.32, 0.32); sph(head, '#F2D7B0', 0, -0.1, 0.46, 0.1, 0.09, 0.12); nose(INK, -0.08, 0.58, 0.04);
        eye(-0.14, 0.06, 0.045, 0.48); eye(0.14, 0.06, 0.045, 0.48); cheeks(0.24, -0.08, 0.52); break;
      case 'sheep':
        body('#FFFFFF', null, 1.15); dirs(26, function (d) { return d.z < 0.45; }).forEach(function (d) { sph(head, '#FFFFFF', d.x * 0.44, d.y * 0.44, d.z * 0.44, 0.17); });
        sph(head, '#FFFFFF', 0, 0, 0, 0.45); sph(head, '#3A2E2A', 0, -0.06, 0.24, 0.28, 0.33, 0.28);
        [-1, 1].forEach(function (m) { var g = new T.Group(); g.position.set(m * 0.34, 0.02, 0.12); g.rotation.z = m * 0.5; sph(g, '#3A2E2A', 0, 0, 0, 0.14, 0.06, 0.08); head.add(g); parts.ears.push(g); });
        [[-0.1, 0.3], [0.1, 0.3], [0, 0.36]].forEach(function (p) { sph(head, '#FFFFFF', p[0], p[1], 0.3, 0.1); });
        eye(-0.11, 0.0, 0.04, 0.51, true); eye(0.11, 0.0, 0.04, 0.51, true); smile(-0.16, 0.5, 0.06, '#FFFFFF'); break;
      case 'cow':
        body('#FFFFFF', '#FFE0EA'); H('#FFFFFF'); stick(INK, -0.26, 0.2, 0.15, 0.12, 0.04, 0.4); stick(INK, 0.3, 0.26, 0.1, 0.08, 0.04, -0.3);
        [-1, 1].forEach(function (m) { cone(head, '#F3E3C3', 0.05, 0.16, m * 0.24, 0.46, 0, 0, -m * 0.6); var g = new T.Group(); g.position.set(m * 0.46, 0.14, 0); g.rotation.z = -m * 0.3; sph(g, '#FFFFFF', 0, 0, 0, 0.16, 0.07, 0.09); head.add(g); parts.ears.push(g); });
        sph(head, '#FFB3C7', 0, -0.2, 0.32, 0.28, 0.16, 0.18); [-1, 1].forEach(function (m) { sph(head, '#C2557A', m * 0.09, -0.19, 0.49, 0.03, 0.045, 0.02); });
        eyes(0.18, 0.1, 0.05); sph(ch, INK, 0.14, -0.55, 0.22, 0.09, 0.08, 0.04); break;
      case 'chick':
        body('#FFD84D', '#FFE88A'); H('#FFD84D'); [[-0.06, -0.4], [0.05, 0.25]].forEach(function (p) { var f = sph(head, '#FFD84D', p[0], 0.55, 0, 0.05, 0.13, 0.05); f.rotation.z = p[1]; });
        cone(head, '#FF9A3D', 0.07, 0.14, 0, -0.08, 0.55, Math.PI / 2); eyes(0.17, 0.08, 0.065); cheeks(0.3, -0.08); break;
      case 'unicorn':
        body('#F7F3FF', '#FFE0EA'); [['#FFD84D', -0.08, 0.42, -0.12], ['#FF9DBF', -0.26, 0.32, -0.2], ['#A9C8FF', -0.36, 0.12, -0.24], ['#C9F2DE', -0.38, -0.1, -0.2], ['#FF9DBF', 0.2, 0.36, -0.14]].forEach(function (c) { sph(head, c[0], c[1], c[2], c[3], 0.15); });
        H('#F7F3FF'); earCone('#F7F3FF', '#FFC7D6', 0.26, 0.33, 0.11, 0.24, 0.25);
        var horn = cone(head, '#FFD84D', 0.07, 0.42, 0, 0.62, 0.12, -0.25, 0, 24); horn.material = M('#FFD84D', true);
        sph(head, '#FF9DBF', -0.14, 0.34, 0.25, 0.1); sph(head, '#A9C8FF', 0.02, 0.4, 0.24, 0.09);
        sph(head, '#FFE0EA', 0, -0.18, 0.34, 0.2, 0.13, 0.14); [-1, 1].forEach(function (m) { sph(head, '#C2557A', m * 0.07, -0.17, 0.47, 0.02, 0.03, 0.015); });
        eyes(0.17, 0.05, 0.065); cheeks(0.3, -0.1); break;
      case 'deer':
        body('#C98A55', '#F6DDBF'); H('#C98A55'); leaf('#C98A55', '#FFD9C2', 0.36, 0.12, 0.13, 0.08, 1.15);
        both(function (m) { tube(head, '#8A5A35', [[m * 0.14, 0.4, 0], [m * 0.24, 0.62, 0], [m * 0.28, 0.82, 0.02]], 0.03); tube(head, '#8A5A35', [[m * 0.23, 0.6, 0], [m * 0.42, 0.7, 0]], 0.025); tube(head, '#8A5A35', [[m * 0.26, 0.74, 0.01], [m * 0.16, 0.88, 0.03]], 0.022); });
        [[-0.1, 0.3], [0, 0.34], [0.1, 0.3], [-0.05, 0.24], [0.06, 0.23]].forEach(function (p) { stick('#FFF1DA', p[0], p[1], 0.028, 0.028, 0.01); });
        muzzle('#F6DDBF', 0.19, 0.14); nose(INK, -0.06, 0.48, 0.05); eyes(0.17, 0.07, 0.065); cheeks(0.3, -0.08);
        parts.tail = sph(ch, '#FFFFFF', 0, -0.56, -0.33, 0.07, 0.08, 0.06); break;
      case 'moose':
        body('#7A4E33', '#A2724E', 1.1); H('#7A4E33'); leaf('#7A4E33', null, 0.4, 0.1, 0.1, 0.07, 1.25);
        both(function (m) { var g = new T.Group(); g.position.set(m * 0.26, 0.34, 0); g.rotation.z = -m * 0.95; tube(g, '#E8C48A', [[0, 0, 0], [0, 0.14, 0]], 0.04); sph(g, '#E8C48A', 0, 0.28, 0, 0.22, 0.13, 0.04); for (var k = 0; k < 4; k++) cone(g, '#E8C48A', 0.03, 0.12, -0.15 + k * 0.1, 0.42, 0); head.add(g); });
        muzzle('#A2724E', 0.26, 0.2, -0.16, 0.32); nostrils('#3A2320', 0.08, -0.12, 0.52, 0.03); eyes(0.18, 0.12, 0.055); cheeks(0.32, -0.02);
        sph(head, '#7A4E33', 0, -0.44, 0.22, 0.06, 0.1, 0.05); break;
      case 'giraffe':
        head.position.y = 0.24; sph(ch, '#FFC94D', 0, -0.22, 0.02, 0.15, 0.34, 0.15);
        [[0.1, -0.2, 0.13], [-0.09, -0.32, 0.12], [0.02, -0.08, 0.14]].forEach(function (p) { sph(ch, '#D98A3A', p[0], p[1], p[2], 0.05, 0.05, 0.03); });
        body('#FFC94D', '#FFE7A8'); [[0.2, -0.5, 0.2], [-0.22, -0.62, 0.18], [0.12, -0.72, 0.22]].forEach(function (p) { sph(ch, '#D98A3A', p[0], p[1], p[2], 0.06, 0.05, 0.04); });
        H('#FFC94D'); [[-0.3, 0.2], [0.28, 0.24], [0.4, -0.05], [-0.4, -0.08], [0.05, 0.4], [-0.18, 0.36]].forEach(function (p) { stick('#D98A3A', p[0], p[1], 0.075, 0.065, 0.02); });
        both(function (m) { tube(head, '#FFC94D', [[m * 0.12, 0.38, 0], [m * 0.15, 0.62, 0]], 0.035); sph(head, '#8A5A35', m * 0.15, 0.64, 0, 0.065); });
        leaf('#FFC94D', '#FFB3C7', 0.38, 0.16, 0.12, 0.07, 1.3);
        muzzle('#FFE7A8', 0.2, 0.15); nostrils(INK, 0.06, -0.1, 0.49); eyes(0.17, 0.07, 0.065); cheeks(0.3, -0.08);
        parts.tail = tailGroup(0, -0.55, -0.32); tube(parts.tail, '#FFC94D', [[0, 0, 0], [0, -0.18, -0.06]], 0.02); sph(parts.tail, '#8A5A35', 0, -0.22, -0.07, 0.04, 0.06, 0.04); break;
      case 'zebra':
        body('#FFFFFF', '#FFFFFF'); bands(ch, INK, -0.62, -0.02, 0.33, 0.3, 0.3, [0.16, 0.05, -0.06]);
        H('#FFFFFF'); [[-0.09, 0.32, 0.25], [0, 0.36, 0], [0.09, 0.32, -0.25]].forEach(function (p) { stick(INK, p[0], p[1], 0.025, 0.09, 0.015, p[2]); });
        both(function (m) { [0.14, -0.02, -0.18].forEach(function (y) { stick(INK, m * 0.42, y, 0.025, 0.1, 0.015, Math.PI / 2 - m * 0.25); }); });
        mane(INK, -0.2, 1.7, 8, 0.06); earCone('#FFFFFF', INK, 0.24, 0.33, 0.1, 0.26, 0.25);
        muzzle('#4A4458', 0.21, 0.15, -0.16, 0.33); nostrils('#9A90AA', 0.07, -0.13, 0.49); eyes(0.17, 0.08, 0.065); cheeks(0.3, -0.06);
        parts.tail = tailGroup(0, -0.55, -0.32); tube(parts.tail, '#FFFFFF', [[0, 0, 0], [0, -0.18, -0.05]], 0.02); sph(parts.tail, INK, 0, -0.24, -0.06, 0.045, 0.08, 0.045); break;
      case 'horse':
        body('#A0623A', '#C98A5E'); H('#A0623A'); earCone('#A0623A', '#6E3F22', 0.22, 0.34, 0.09, 0.26, 0.15);
        stick('#FFF6EC', 0, 0.12, 0.05, 0.16, 0.02); mane('#4A2E1C', 0.15, 1.7, 8, 0.07);
        sph(head, '#4A2E1C', -0.06, 0.42, 0.2, 0.14, 0.08, 0.12); sph(head, '#4A2E1C', 0.08, 0.43, 0.16, 0.12, 0.07, 0.12);
        muzzle('#D9A882', 0.22, 0.15, -0.17, 0.33); nostrils('#6E3F22', 0.08, -0.14, 0.49); eyes(0.18, 0.06, 0.065); cheeks(0.31, -0.06);
        parts.tail = tailGroup(0, -0.5, -0.32); tube(parts.tail, '#4A2E1C', [[0, 0, 0], [0, -0.08, -0.12], [0, -0.3, -0.16]], 0.055); break;
      case 'donkey':
        body('#A6A0AE', '#F1EEF4'); H('#A6A0AE'); leaf('#A6A0AE', '#F1EEF4', 0.18, 0.34, 0.27, 0.085, 0.5);
        parts.ears.forEach(function (g) { sph(g, '#5A5462', 0, 0.5, 0, 0.06, 0.06, 0.035); });
        sph(head, '#5A5462', 0, 0.44, 0.18, 0.1, 0.06, 0.08); both(function (m) { stick('#E4E0EA', m * 0.17, 0.06, 0.1, 0.1, 0.02); });
        muzzle('#F1EEF4', 0.25, 0.18, -0.17, 0.31); nostrils('#5A5462', 0.08, -0.12, 0.5); eyes(0.17, 0.06, 0.06); cheeks(0.32, -0.08);
        parts.tail = tailGroup(0, -0.55, -0.32); tube(parts.tail, '#A6A0AE', [[0, 0, 0], [0, -0.18, -0.05]], 0.02); sph(parts.tail, '#5A5462', 0, -0.24, -0.06, 0.045, 0.08, 0.045); break;
      case 'llama':
        head.position.y = 0.22; sph(ch, '#F4E6D0', 0, -0.25, 0.02, 0.17, 0.33, 0.17);
        body('#F4E6D0', '#FFF8EC'); dirs(22, function (d) { return d.y > 0.1; }).forEach(function (d) { sph(ch, '#FFF8EC', d.x * 0.3, -0.62 + d.y * 0.28, -0.02 + d.z * 0.28, 0.1); });
        H('#F4E6D0'); [[-0.14, 0.42, 0.1], [0.12, 0.43, 0.12], [0, 0.46, 0.0], [0, 0.4, 0.22]].forEach(function (p) { sph(head, '#FFF8EC', p[0], p[1], p[2], 0.13); });
        leaf('#F4E6D0', '#E8B48C', 0.2, 0.32, 0.2, 0.06, 0.25);
        both(function (m) { sph(head, '#FF7AA8', m * 0.25, 0.32, 0.16, 0.055); sph(head, '#FFD84D', m * 0.32, 0.26, 0.1, 0.05); sph(head, '#4F9BFF', m * 0.36, 0.34, 0.04, 0.045); });
        muzzle('#FFF8EC', 0.17, 0.14, -0.16, 0.34); nose(INK, -0.09, 0.49, 0.035); eyes(0.17, 0.06, 0.065); cheeks(0.3, -0.1); break;
      case 'camel':
        body('#E0B07A', '#F2D3A6', 1.05); sph(ch, '#E0B07A', 0, -0.6, -0.26, 0.29, 0.27, 0.3);
        sph(ch, '#D9A066', 0, -0.34, -0.14, 0.16, 0.18, 0.14); sph(ch, '#D9A066', 0, -0.36, -0.42, 0.15, 0.16, 0.13);
        H('#E0B07A', 0.95, 1.05, 1); earRound('#E0B07A', '#B9814A', 0.4, 0.22, 0.08); sph(head, '#B9814A', 0, 0.48, 0.1, 0.12, 0.07, 0.1);
        muzzle('#F2D3A6', 0.23, 0.17, -0.18, 0.32); sph(head, '#F2D3A6', 0, -0.33, 0.38, 0.12, 0.06, 0.08); nostrils('#8A5A35', 0.08, -0.14, 0.5);
        eyes(0.17, 0.08, 0.06); both(function (m) { sph(head, '#C98F55', m * 0.17, 0.115, 0.452, 0.078, 0.045, 0.045); }); cheeks(0.31, -0.08);
        parts.tail = tailGroup(0, -0.58, -0.56); tube(parts.tail, '#E0B07A', [[0, 0, 0], [0, -0.18, -0.04]], 0.02); sph(parts.tail, '#B9814A', 0, -0.22, -0.05, 0.035, 0.06, 0.035); break;
      case 'goat':
        body('#F4F1EA', '#FFFFFF'); H('#F4F1EA');
        both(function (m) { tube(head, '#C8B79A', [[m * 0.12, 0.38, 0.06], [m * 0.2, 0.56, -0.06], [m * 0.3, 0.56, -0.24], [m * 0.34, 0.42, -0.3]], 0.035); });
        leaf('#F4F1EA', '#FFC7D6', 0.42, 0.06, 0.12, 0.06, 1.9);
        cone(head, '#E2DACB', 0.07, 0.2, 0, -0.5, 0.3, Math.PI);
        both(function (m) { eyeGroup(m * 0.17, 0.08, fz(0.17, 0.08) * 0.95, function (g) { sph(g, '#FFE08A', 0, 0, 0, 0.075, 0.075, 0.035); sph(g, INK, 0, 0, 0.028, 0.05, 0.02, 0.02); sph(g, '#FFFFFF', 0.02, 0.03, 0.04, 0.015); }); });
        muzzle('#FFFFFF', 0.15, 0.11, -0.16, 0.36); nose('#C2557A', -0.1, 0.48, 0.035); cheeks(0.3, -0.08);
        parts.tail = sph(ch, '#F4F1EA', 0, -0.48, -0.32, 0.05, 0.1, 0.05); break;
      case 'hippo':
        body('#B79BD9', '#D3C0EE', 1.2); H('#B79BD9', 1.1, 1, 1);
        muzzle('#D3C0EE', 0.34, 0.22, -0.16, 0.3); nostrils('#6E5A8C', 0.1, -0.02, 0.53, 0.035);
        both(function (m) { var t = mesh(new T.BoxGeometry(0.06, 0.07, 0.03), '#FFFFFF'); t.position.set(m * 0.1, -0.3, 0.46); head.add(t); });
        eyes(0.19, 0.2, 0.05); earRound('#B79BD9', '#E8B4D6', 0.25, 0.42, 0.07); cheeks(0.36, -0.08, 0.55);
        parts.tail = sph(ch, '#B79BD9', 0, -0.55, -0.33, 0.04, 0.07, 0.04); break;
      case 'rhino':
        body('#9AA5B5', '#B5BECB', 1.15); H('#9AA5B5'); earCone('#9AA5B5', '#C9CFDA', 0.28, 0.32, 0.08, 0.18, 0.35);
        muzzle('#B5BECB', 0.24, 0.17, -0.14, 0.33); cone(head, '#F1EAD8', 0.09, 0.3, 0, 0.06, 0.52, 0.35); cone(head, '#F1EAD8', 0.05, 0.14, 0, 0.27, 0.44, 0.3);
        nostrils('#6A7486', 0.12, -0.22, 0.46); eyes(0.24, 0.04, 0.045); cheeks(0.34, -0.1);
        parts.tail = sph(ch, '#9AA5B5', 0, -0.52, -0.33, 0.04, 0.09, 0.04); break;
      case 'gorilla':
        body('#3A3442', '#5A5266', 1.15); both(function (m) { sph(ch, '#3A3442', m * 0.38, -0.62, 0.06, 0.12, 0.2, 0.12); sph(ch, '#5A5266', m * 0.4, -0.8, 0.1, 0.08, 0.05, 0.08); });
        H('#3A3442'); sph(head, '#9C90A8', 0, -0.06, 0.24, 0.34, 0.34, 0.3); sph(head, '#2A2432', 0, 0.14, 0.42, 0.27, 0.07, 0.08);
        earRound('#3A3442', '#7A6E85', 0.48, 0, 0.08, 0, Math.PI / 2.4);
        eye(-0.13, 0.05, 0.045, 0.5); eye(0.13, 0.05, 0.045, 0.5); sph(head, '#7A6E85', 0, -0.06, 0.52, 0.1, 0.06, 0.05); nostrils(INK, 0.04, -0.07, 0.565, 0.02); smile(-0.2, 0.5, 0.09); break;
      case 'sloth':
        body('#B59A7A', '#D9C3A5'); both(function (m) { [-0.03, 0, 0.03].forEach(function (d) { sph(ch, '#F1E3CC', m * 0.33 + d, -0.76, 0.1, 0.015, 0.05, 0.015); }); });
        H('#B59A7A'); sph(head, '#F1E3CC', 0, -0.03, 0.2, 0.4, 0.36, 0.32);
        both(function (m) { stick('#5A4230', m * 0.17, 0.02, 0.12, 0.06, 0.03, m * 0.45); });
        eye(-0.17, 0.03, 0.04, 0.5); eye(0.17, 0.03, 0.04, 0.5); sph(head, '#3A2320', 0, -0.1, 0.5, 0.06, 0.045, 0.04, true); smile(-0.17, 0.48, 0.08); cheeks(0.3, -0.14);
        [-0.06, 0, 0.06].forEach(function (d) { sph(head, '#8A6E50', d, 0.47, 0.12, 0.03, 0.07, 0.03); }); break;
      case 'otter':
        body('#8A5A3C', '#EBD3B4'); H('#8A5A3C'); sph(head, '#EBD3B4', 0, -0.13, 0.22, 0.38, 0.28, 0.32);
        both(function (m) { sph(head, '#F6E6D0', m * 0.07, -0.13, 0.43, 0.09, 0.07, 0.07); }); nose(INK, -0.05, 0.5, 0.05); whiskers(-0.13, 0.45);
        eyes(0.17, 0.1, 0.055); earRound('#8A5A3C', '#C9A07E', 0.42, 0.16, 0.07); cheeks(0.3, -0.06);
        parts.tail = tailGroup(0, -0.75, -0.3); tube(parts.tail, '#8A5A3C', [[0, 0, 0], [0, -0.08, -0.15], [0, -0.12, -0.32]], 0.06); break;
      case 'beaver':
        body('#9B6B43', '#C9A07E'); H('#9B6B43'); earRound('#6E4A30', '#C9A07E', 0.34, 0.3, 0.08);
        both(function (m) { sph(head, '#D9B08C', m * 0.08, -0.12, 0.4, 0.12, 0.1, 0.09); }); nose(INK, -0.04, 0.5, 0.05);
        var bt = mesh(new T.BoxGeometry(0.12, 0.1, 0.04), '#FFFFFF'); bt.position.set(0, -0.27, 0.44); head.add(bt); var bl = mesh(new T.BoxGeometry(0.008, 0.1, 0.045), INK); bl.position.set(0, -0.27, 0.445); head.add(bl);
        eyes(0.17, 0.12, 0.055); cheeks(0.3, -0.04);
        parts.tail = sph(ch, '#5A3A26', 0, -0.84, -0.44, 0.16, 0.04, 0.24); break;
      case 'squirrel':
        body('#E07B39', '#FFE7CC'); H('#E07B39'); earCone('#E07B39', '#F6B77A', 0.24, 0.34, 0.09, 0.24, 0.2);
        parts.ears.forEach(function (g) { cone(g, '#C25E22', 0.035, 0.12, 0, 0.25, 0); });
        both(function (m) { sph(head, '#FFE7CC', m * 0.16, -0.14, 0.33, 0.16, 0.13, 0.12); }); sph(head, INK, 0, -0.05, 0.5, 0.04, 0.03, 0.03, true);
        var st2 = mesh(new T.BoxGeometry(0.06, 0.06, 0.03), '#FFFFFF'); st2.position.set(0, -0.22, 0.45); head.add(st2);
        eyes(0.17, 0.09, 0.062); cheeks(0.31, -0.1);
        parts.tail = tailGroup(0, -0.6, -0.3); tube(parts.tail, '#E07B39', [[0, 0, 0], [0, 0.25, -0.18], [0, 0.55, -0.14], [0, 0.72, 0.02]], 0.14); sph(parts.tail, '#F6B77A', 0, 0.76, 0.05, 0.12); break;
      case 'badger':
        body('#3A3442', '#5A5466'); H('#9A9AA8');
        lune('#FFFFFF', 0, 0.36, 0.02, 0.66); both(function (m) { lune(INK, m * 0.38, 0.32, 0.06, 0.6); });
        earRound(INK, '#9A9AA8', 0.36, 0.28, 0.07); eye(-0.16, 0.05, 0.035, 0.5, true); eye(0.16, 0.05, 0.035, 0.5, true);
        muzzle('#FFFFFF', 0.16, 0.12, -0.14, 0.36); nose(INK, -0.1, 0.5, 0.05); cheeks(0.32, -0.14); break;
      case 'wolf':
        body('#7E8AA0', '#E9EDF3'); H('#7E8AA0'); earCone('#7E8AA0', '#E9EDF3', 0.26, 0.32, 0.13, 0.34, 0.22);
        both(function (m) { sph(head, '#E9EDF3', m * 0.2, -0.16, 0.3, 0.18, 0.14, 0.13); }); stick('#5E6A80', 0, 0.26, 0.07, 0.11, 0.02);
        sph(head, '#E9EDF3', 0, -0.12, 0.42, 0.14, 0.11, 0.16); nose(INK, -0.05, 0.58, 0.05); irisEyes(0.17, 0.09, 0.065, '#FFC94D');
        parts.tail = tailGroup(0, -0.55, -0.32); tube(parts.tail, '#7E8AA0', [[0, 0, 0], [0, -0.12, -0.14], [0, -0.26, -0.22]], 0.08); sph(parts.tail, '#E9EDF3', 0, -0.28, -0.24, 0.07); break;
      case 'polarbear':
        body('#F4F8FF', '#FFFFFF'); H('#F4F8FF'); earRound('#F4F8FF', '#DCE6FF', 0.33, 0.33, 0.13);
        muzzle('#FFFFFF', 0.2, 0.15, -0.14, 0.34); nose(INK, -0.08, 0.47, 0.055); eyes(0.17, 0.07, 0.065); cheeks(0.3, -0.08);
        var sc = mesh(new T.TorusGeometry(0.26, 0.06, 10, 28), '#4F7BFF'); sc.rotation.x = Math.PI / 2; sc.position.set(0, -0.42, 0); ch.add(sc);
        var se = sph(ch, '#4F7BFF', 0.14, -0.56, 0.24, 0.06, 0.14, 0.04); se.rotation.z = 0.2; break;
      case 'redpanda':
        body('#D9572B', null); both(function (m) { sph(ch, '#3A2320', m * 0.16, -0.9, 0.06, 0.1, 0.06, 0.12); sph(ch, '#3A2320', m * 0.3, -0.62, 0.05, 0.085, 0.135, 0.085); }); H('#D9572B'); earCone('#FFF6EC', '#D9572B', 0.27, 0.32, 0.13, 0.26, 0.3);
        both(function (m) { sph(head, '#FFF6EC', m * 0.21, -0.1, 0.32, 0.15, 0.12, 0.12); stick('#FFF6EC', m * 0.15, 0.22, 0.05, 0.035, 0.015); stick('#8A2E14', m * 0.2, -0.02, 0.03, 0.07, 0.015, -m * 0.3); });
        muzzle('#FFF6EC', 0.14, 0.1, -0.14, 0.36); nose(INK, -0.08, 0.48, 0.04); eyes(0.17, 0.07, 0.065);
        parts.tail = tailGroup(0, -0.6, -0.3); for (var rk = 0; rk < 6; rk++) sph(parts.tail, rk % 2 ? '#F2A36B' : '#D9572B', 0, 0.02 + rk * 0.07, -0.06 - rk * 0.05, 0.1 - rk * 0.006); break;
      case 'kangaroo':
        body('#D99A5E', '#F6DDBF', 1.05); both(function (m) { sph(ch, '#D99A5E', m * 0.16, -0.9, 0.16, 0.1, 0.06, 0.2); });
        sph(ch, '#F6DDBF', 0, -0.72, 0.2, 0.17, 0.12, 0.09); sph(ch, '#D99A5E', 0, -0.6, 0.25, 0.075); both(function (m) { sph(ch, INK, m * 0.025, -0.59, 0.32, 0.01, 0.012, 0.008); sph(ch, '#D99A5E', m * 0.05, -0.53, 0.24, 0.02, 0.04, 0.015); });
        H('#D99A5E'); earCone('#D99A5E', '#F6C9A0', 0.2, 0.32, 0.08, 0.34, 0.25);
        muzzle('#F6DDBF', 0.18, 0.15); nose(INK, -0.06, 0.48, 0.05); eyes(0.17, 0.08, 0.062); cheeks(0.3, -0.08);
        parts.tail = tailGroup(0, -0.62, -0.3); tube(parts.tail, '#D99A5E', [[0, 0, 0], [0, -0.16, -0.18], [0, -0.28, -0.42]], 0.07); break;
      case 'platypus':
        body('#8A5A3C', '#C9A07E'); H('#8A5A3C'); sph(head, '#4A5672', 0, -0.14, 0.48, 0.24, 0.07, 0.2); nostrils('#8A98B8', 0.05, -0.08, 0.64, 0.015);
        eyes(0.18, 0.1, 0.05); cheeks(0.3, -0.02);
        both(function (m) { sph(ch, '#4A5672', m * 0.16, -0.92, 0.16, 0.1, 0.03, 0.12); });
        parts.tail = sph(ch, '#6E4A30', 0, -0.84, -0.42, 0.15, 0.04, 0.22); break;
      case 'seal':
        sph(ch, '#A9B8C9', 0, -0.64, -0.08, 0.34, 0.28, 0.38); sph(ch, '#DCE4EE', 0, -0.66, 0.1, 0.25, 0.2, 0.22);
        both(function (m) { var f = sph(ch, '#8A9AB0', m * 0.34, -0.74, 0.1, 0.06, 0.08, 0.15); f.rotation.z = m * 0.6; });
        parts.tail = tailGroup(0, -0.84, -0.44); both(function (m) { var t = sph(parts.tail, '#8A9AB0', m * 0.1, 0, -0.04, 0.12, 0.03, 0.07); t.rotation.y = m * 0.5; });
        H('#A9B8C9'); both(function (m) { sph(head, '#E4ECF5', m * 0.07, -0.12, 0.44, 0.09, 0.07, 0.07); }); nose(INK, -0.04, 0.5, 0.045); whiskers(-0.12, 0.45);
        [[-0.2, 0.3], [0.24, 0.28], [-0.32, 0.12]].forEach(function (p) { stick('#8A9AB0', p[0], p[1], 0.035, 0.035, 0.01); });
        eyes(0.18, 0.08, 0.085); cheeks(0.32, -0.06); break;
      case 'whale':
        sph(ch, '#4F7BFF', 0, -0.62, -0.06, 0.38, 0.3, 0.4); sph(ch, '#DCE6FF', 0, -0.7, 0.12, 0.28, 0.2, 0.26);
        both(function (m) { var f = sph(ch, '#4F7BFF', m * 0.4, -0.68, 0.08, 0.05, 0.08, 0.17); f.rotation.z = m * 0.7; });
        parts.tail = tailGroup(0, -0.62, -0.5); tube(parts.tail, '#4F7BFF', [[0, 0, 0], [0, 0.12, -0.16]], 0.07); both(function (m) { var t = sph(parts.tail, '#4F7BFF', m * 0.13, 0.2, -0.2, 0.15, 0.035, 0.07); t.rotation.y = m * 0.5; });
        H('#4F7BFF', 1.05, 0.95, 1); sph(head, '#DCE6FF', 0, -0.2, 0.17, 0.42, 0.26, 0.33);
        [-0.1, 0, 0.1].forEach(function (dx) { var g = mesh(new T.BoxGeometry(0.012, 0.12, 0.01), '#A9C8FF'); g.position.set(dx, -0.34, 0.37); g.rotation.x = 0.6; head.add(g); });
        eyes(0.25, -0.02, 0.055); smile(-0.12, 0.47, 0.15); cheeks(0.34, -0.12);
        var wm2 = M('#A9C8FF', true); [[0, 0.62, 0, 0.05, 0.12], [-0.12, 0.74, 0, 0.045, 0.045], [0.12, 0.74, 0, 0.045, 0.045], [0, 0.8, 0, 0.05, 0.05]].forEach(function (d) { var w = sph(head, '#A9C8FF', d[0], d[1], d[2], d[3], d[4], d[3]); w.material = wm2; }); break;
      case 'shark':
        body('#7D8FA8', '#F4F6FA'); H('#7D8FA8'); sph(head, '#F4F6FA', 0, -0.2, 0.18, 0.42, 0.26, 0.32);
        var fin = cone(head, '#7D8FA8', 0.14, 0.34, 0, 0.6, -0.06, -0.45, 0, 20); fin.scale.x = 0.3;
        sph(head, '#5A2E3A', 0, -0.2, 0.43, 0.17, 0.05, 0.05); for (var tk = -2; tk <= 2; tk++) cone(head, '#FFFFFF', 0.022, 0.05, tk * 0.06, -0.175, 0.48 - Math.abs(tk) * 0.01, Math.PI);
        both(function (m) { [0, 0.07, 0.14].forEach(function (d) { stick('#5E6A80', m * (0.38 + d * 0.15), -0.06 - d * 0.3, 0.012, 0.07, 0.01, -m * 0.2); }); });
        eyes(0.18, 0.07, 0.06); cheeks(0.3, -0.06);
        parts.tail = tailGroup(0, -0.58, -0.32); both(function (m) { var t = cone(parts.tail, '#7D8FA8', 0.07, 0.24, 0, m * 0.1, -0.06, -0.6 * m - Math.PI / 2 * (m < 0 ? 0 : 0), 0, 16); t.rotation.x = m > 0 ? -0.9 : -2.3; t.scale.x = 0.35; }); break;
      case 'octopus':
        for (var ok = 0; ok < 8; ok++) { var oa = (ok + 0.5) / 8 * Math.PI * 2, ox = Math.sin(oa), oz = Math.cos(oa); tube(ch, '#FF7AA8', [[ox * 0.18, -0.32, oz * 0.18], [ox * 0.36, -0.6, oz * 0.36], [ox * 0.46, -0.84, oz * 0.46], [ox * 0.6, -0.86, oz * 0.6], [ox * 0.64, -0.76, oz * 0.64]], 0.065); }
        H('#FF7AA8', 1, 1.12, 1); [[-0.22, 0.3], [0.2, 0.36], [0.32, 0.12], [-0.34, 0.08]].forEach(function (p) { stick('#FF9DBF', p[0], p[1], 0.05, 0.05, 0.015); });
        eyes(0.17, -0.02, 0.075); smile(-0.2, 0.46, 0.07); cheeks(0.3, -0.14); break;
      case 'crab':
        ch.position.y = 0.75; H('#FF5A4E', 1.2, 0.72, 0.95); [[-0.25, 0.22], [0.22, 0.24], [0, 0.3]].forEach(function (p) { sph(head, '#FF8A7A', p[0], p[1], 0.24, 0.05, 0.03, 0.04); });
        both(function (m) {
          tube(head, '#FF5A4E', [[m * 0.15, 0.25, 0.15], [m * 0.18, 0.5, 0.18]], 0.035);
          eyeGroup(m * 0.18, 0.56, 0.18, function (g) { sph(g, '#FFFFFF', 0, 0, 0, 0.09); sph(g, INK, 0, 0, 0.06, 0.05, 0.05, 0.04, true); sph(g, '#FFFFFF', 0.015, 0.02, 0.1, 0.014); });
          tube(ch, '#FF5A4E', [[m * 0.5, -0.05, 0.1], [m * 0.62, 0.15, 0.24]], 0.045);
          var cg = new T.Group(); cg.position.set(m * 0.64, 0.24, 0.28); sph(cg, '#FF5A4E', 0, 0, 0, 0.17, 0.13, 0.11); var up = sph(cg, '#FF5A4E', 0, 0.16, 0.06, 0.09, 0.07, 0.07); up.rotation.z = m * 0.4; ch.add(cg); parts.ears.push(cg);
          [-0.15, 0, 0.15].forEach(function (z) { tube(ch, '#FF5A4E', [[m * 0.46, -0.12, z], [m * 0.62, -0.36, z * 1.3], [m * 0.68, -0.68, z * 1.5]], 0.035); });
        });
        smile(0.02, 0.47, 0.1); cheeks(0.4, -0.02, 0.6); break;
      case 'turtle':
        body('#B9E39A', '#F1E9A8'); sph(ch, '#4E9A57', 0, -0.5, -0.12, 0.44, 0.34, 0.44); sph(ch, '#E8C468', 0, -0.6, -0.12, 0.43, 0.06, 0.43);
        dirs(30, function (d) { return d.y > 0.15; }).forEach(function (d) { var p = new T.Vector3(d.x * 0.44, d.y * 0.34, d.z * 0.44); var n = new T.Vector3(d.x / 0.44, d.y / 0.34, d.z / 0.44).normalize(); var h2 = mesh(new T.CylinderGeometry(0.075, 0.075, 0.02, 6), '#8BCB7B'); h2.position.set(p.x, -0.5 + p.y, -0.12 + p.z); h2.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), n); ch.add(h2); });
        head.position.set(0, -0.12, 0.26); head.scale.setScalar(0.82); H('#C9E89A'); eyes(0.17, 0.06, 0.07); smile(-0.12, 0.46, 0.1); cheeks(0.3, -0.08);
        parts.tail = cone(ch, '#B9E39A', 0.06, 0.16, 0, -0.68, -0.56, -Math.PI / 2); break;
      case 'crocodile':
        body('#4FA67A', '#B9E39A', 1.1); for (var ck = 0; ck < 4; ck++) cone(ch, '#3E8A62', 0.05, 0.1, 0, -0.36 - ck * 0.02, -0.1 - ck * 0.1, -0.5);
        H('#4FA67A', 1, 0.85, 1); sph(head, '#6CC08F', 0, -0.13, 0.42, 0.27, 0.13, 0.32);
        both(function (m) { for (var k = 0; k < 4; k++) cone(head, '#FFFFFF', 0.02, 0.05, m * 0.22, -0.23, 0.36 + k * 0.1, Math.PI); });
        nostrils('#2F7A52', 0.07, -0.02, 0.72, 0.03);
        both(function (m) { sph(head, '#4FA67A', m * 0.18, 0.32, 0.12, 0.13, 0.11, 0.13); eyeGroup(m * 0.18, 0.35, 0.23, function (g) { sph(g, '#FFF7C2', 0, 0, 0, 0.075, 0.075, 0.04); sph(g, INK, 0, 0, 0.03, 0.02, 0.06, 0.02); }); });
        cheeks(0.34, -0.1); parts.tail = tailGroup(0, -0.66, -0.3); tube(parts.tail, '#4FA67A', [[0, 0, 0], [0, -0.1, -0.2], [0.04, -0.2, -0.46]], 0.09); break;
      case 'snake':
        var c1 = mesh(new T.TorusGeometry(0.32, 0.13, 12, 32), '#FFB020'); c1.rotation.x = Math.PI / 2; c1.position.y = -0.82; ch.add(c1);
        var c2 = mesh(new T.TorusGeometry(0.2, 0.12, 12, 28), '#FFB020'); c2.rotation.x = Math.PI / 2; c2.position.y = -0.62; ch.add(c2);
        [0, 1, 2, 3, 4, 5].forEach(function (k) { var a = k / 6 * Math.PI * 2 + 0.3; sph(ch, '#E2683C', Math.sin(a) * 0.44, -0.78, Math.cos(a) * 0.44, 0.05, 0.05, 0.05); });
        tube(ch, '#FFB020', [[0, -0.6, 0.05], [0, -0.45, 0.1], [0, -0.3, 0.06]], 0.13);
        H('#FFB020', 1.05, 0.88, 1); [[0, 0.32], [-0.17, 0.25], [0.17, 0.25]].forEach(function (p) { stick('#E2683C', p[0], p[1], 0.06, 0.06, 0.015, Math.PI / 4); });
        tube(head, '#FF3B5C', [[0, -0.2, 0.42], [0, -0.24, 0.58]], 0.015, false); both(function (m) { tube(head, '#FF3B5C', [[0, -0.24, 0.58], [m * 0.04, -0.27, 0.64]], 0.013); });
        eyes(0.2, 0.06, 0.07); smile(-0.12, 0.44, 0.14); cheeks(0.32, -0.08); break;
      case 'chameleon':
        body('#3FD3A0', '#C9F2DE'); H('#3FD3A0'); sph(head, '#2FB386', 0, 0.42, -0.08, 0.07, 0.22, 0.3);
        [-0.3, 0, 0.3].forEach(function (x0) { stick('#FFD84D', x0, -0.22, 0.04, 0.12, 0.015); }); [[-0.2, 0.3], [0.22, 0.32]].forEach(function (p) { stick('#FF9DBF', p[0], p[1], 0.035, 0.035, 0.01); });
        both(function (m) { eyeGroup(m * 0.34, 0.08, 0.24, function (g) { sph(g, '#2FB386', 0, 0, 0, 0.16); var rr = mesh(new T.TorusGeometry(0.1, 0.015, 8, 24), '#1E9A70'); rr.position.z = 0.13; g.add(rr); sph(g, INK, m * 0.02, m * 0.02, 0.15, 0.045, 0.045, 0.03, true); }); });
        smile(-0.12, 0.46, 0.2); cheeks(0.36, -0.12);
        parts.tail = tailGroup(0, -0.7, -0.34); var cur = mesh(new T.TorusGeometry(0.12, 0.045, 8, 24, Math.PI * 1.7), '#3FD3A0'); cur.rotation.y = Math.PI / 2; cur.position.set(0, 0.0, -0.08); parts.tail.add(cur); break;
      case 'axolotl':
        body('#FFC2D6', '#FFE0EA'); H('#FFC2D6', 1.15, 0.9, 1);
        both(function (m) { var g = new T.Group(); g.position.set(m * 0.48, 0.02, -0.04); [[0.2, 0.22], [0.28, 0], [0.2, -0.2]].forEach(function (p) { tube(g, '#FF6F91', [[0, 0, 0], [m * p[0], p[1], -0.05]], 0.03); sph(g, '#FF6F91', m * p[0], p[1], -0.05, 0.06); sph(g, '#FF6F91', m * p[0] * 0.55, p[1] * 0.55, -0.03, 0.045); }); head.add(g); parts.ears.push(g); });
        [[-0.18, 0.3], [0.2, 0.32], [0, 0.4]].forEach(function (p) { stick('#FF9DBF', p[0], p[1], 0.03, 0.03, 0.01); });
        eyes(0.26, 0.04, 0.045); smile(-0.02, 0.46, 0.2); cheeks(0.38, -0.08, 0.56);
        parts.tail = tailGroup(0, -0.62, -0.3); var af = sph(parts.tail, '#FFC2D6', 0, 0, -0.14, 0.04, 0.12, 0.2); af.rotation.x = 0.3; break;
      case 'flamingo':
        body('#FF8FB1', '#FFC2D6'); both(function (m) { var w = sph(ch, '#FF6F9A', m * 0.32, -0.58, -0.05, 0.08, 0.18, 0.22); w.rotation.z = m * 0.2; });
        H('#FF8FB1'); cone(head, '#FF8FB1', 0.04, 0.16, -0.04, 0.54, 0, 0, 0.35); cone(head, '#FF8FB1', 0.04, 0.14, 0.05, 0.53, -0.02, 0, -0.35);
        tube(head, '#FFE0B0', [[0, -0.02, 0.44], [0, -0.04, 0.58], [0, -0.14, 0.66]], 0.07); tube(head, INK, [[0, -0.17, 0.66], [0, -0.28, 0.6]], 0.06);
        irisEyes(0.2, 0.1, 0.05, '#FFFFFF'); cheeks(0.3, -0.06);
        parts.tail = sph(ch, '#FF6F9A', 0, -0.5, -0.34, 0.08, 0.06, 0.14); break;
      case 'parrot':
        body('#FF4D4D', '#FFD84D'); both(function (m) { var w = sph(ch, '#4F7BFF', m * 0.32, -0.6, -0.04, 0.08, 0.2, 0.2); w.rotation.z = m * 0.15; });
        H('#FF4D4D'); both(function (m) { stick('#FFFFFF', m * 0.18, 0.06, 0.1, 0.1, 0.025); });
        eyes(0.18, 0.07, 0.05); sph(head, '#3A3442', 0, -0.2, 0.44, 0.08, 0.05, 0.06);
        tube(head, '#F7E9D0', [[0, 0.02, 0.46], [0, 0, 0.58], [0, -0.1, 0.63], [0, -0.21, 0.57]], 0.07);
        cone(head, '#FFD84D', 0.05, 0.2, -0.06, 0.56, 0, 0, 0.35); cone(head, '#4F7BFF', 0.05, 0.22, 0.02, 0.58, -0.04, 0, 0); cone(head, '#3FD3A0', 0.045, 0.18, 0.09, 0.55, -0.06, 0, -0.35);
        cheeks(0.3, -0.12);
        parts.tail = tailGroup(0, -0.6, -0.3); [['#4F7BFF', -0.05], ['#FF4D4D', 0], ['#FFD84D', 0.05]].forEach(function (f) { var t = sph(parts.tail, f[0], f[1], -0.12, -0.12, 0.04, 0.24, 0.04); t.rotation.x = -0.5; }); break;
      case 'peacock':
        var fan = new T.Group(); fan.position.set(0, -0.35, -0.42); fan.rotation.x = -0.25; ch.add(fan);
        for (var pk = 0; pk < 9; pk++) { var pa = -1.25 + pk / 8 * 2.5, px = Math.sin(pa) * 0.82, py = Math.cos(pa) * 0.82; tube(fan, '#2FB386', [[0, 0, 0], [px * 0.85, py * 0.85, 0]], 0.012, false); sph(fan, '#2FB386', px, py, 0, 0.14, 0.18, 0.04); sph(fan, '#FFD84D', px, py, 0.03, 0.08, 0.1, 0.03); sph(fan, '#4F7BFF', px, py, 0.05, 0.055, 0.065, 0.025); sph(fan, '#1E2E7A', px, py, 0.065, 0.028, 0.033, 0.015); }
        body('#2E7DD7', '#3FB5A0'); H('#2E7DD7'); [-0.08, 0, 0.08].forEach(function (dx) { tube(head, '#2E5FB8', [[dx * 0.5, 0.45, 0], [dx, 0.68, 0.02]], 0.012, false); sph(head, '#4F7BFF', dx, 0.7, 0.02, 0.04); });
        both(function (m) { stick('#FFFFFF', m * 0.18, 0.07, 0.11, 0.06, 0.02); }); eyes(0.18, 0.07, 0.05);
        cone(head, '#F3E3C3', 0.05, 0.13, 0, -0.08, 0.55, Math.PI / 2); cheeks(0.3, -0.1); break;
      case 'duck':
        body('#C9C2B4', '#B9814A'); both(function (m) { var w = sph(ch, '#9A8F7E', m * 0.32, -0.6, -0.04, 0.08, 0.17, 0.2); w.rotation.z = m * 0.15; sph(ch, '#FF9A3D', m * 0.16, -0.92, 0.12, 0.11, 0.035, 0.15); });
        H('#2F9E5A'); var ring = mesh(new T.TorusGeometry(0.28, 0.035, 8, 28), '#FFFFFF'); ring.rotation.x = Math.PI / 2; ring.position.set(0, -0.42, 0); head.add(ring);
        sph(head, '#FFC23D', 0, -0.12, 0.46, 0.19, 0.06, 0.18); nostrils(INK, 0.05, -0.07, 0.6, 0.012); eyes(0.19, 0.1, 0.055);
        parts.tail = tailGroup(0, -0.45, -0.32); var curl = mesh(new T.TorusGeometry(0.05, 0.015, 6, 16, Math.PI * 1.4), INK); curl.rotation.y = Math.PI / 2; parts.tail.add(curl); break;
      case 'swan':
        body('#FFFFFF', '#FFFFFF'); both(function (m) { var w = sph(ch, '#F4F1EA', m * 0.3, -0.55, -0.08, 0.1, 0.2, 0.26); w.rotation.z = m * 0.2; sph(ch, '#FF8A3D', m * 0.16, -0.92, 0.12, 0.1, 0.035, 0.14); });
        H('#FFFFFF'); sph(head, '#FF8A3D', 0, -0.13, 0.5, 0.1, 0.08, 0.16); sph(head, INK, 0, -0.03, 0.46, 0.06);
        eyes(0.19, 0.09, 0.05); cheeks(0.3, -0.08);
        var crown = new T.Group(); crown.position.set(0, 0.46, 0); var gold = M('#FFD84D', true);
        var band = new T.Mesh(new T.CylinderGeometry(0.16, 0.14, 0.08, 20, 1, true), gold); band.material.side = T.DoubleSide; crown.add(band);
        for (var ck2 = 0; ck2 < 5; ck2++) { var ca = ck2 / 5 * Math.PI * 2, sp = new T.Mesh(new T.ConeGeometry(0.035, 0.1, 10), gold); sp.position.set(Math.sin(ca) * 0.15, 0.09, Math.cos(ca) * 0.15); crown.add(sp); }
        sph(crown, '#FF7AA8', 0, 0.02, 0.15, 0.025); head.add(crown); break;
      case 'toucan':
        body('#26304A', '#FFF3C9'); H('#26304A'); sph(head, '#FFF3C9', 0, -0.18, 0.24, 0.34, 0.24, 0.28);
        both(function (m) { stick('#4F9BFF', m * 0.21, 0.13, 0.1, 0.1, 0.03); }); eyes(0.21, 0.13, 0.05);
        sph(head, '#FF9A3D', 0, -0.06, 0.62, 0.12, 0.14, 0.3); sph(head, '#FFD84D', 0, 0.0, 0.5, 0.1, 0.12, 0.14); sph(head, '#FF4D4D', 0, -0.1, 0.86, 0.07, 0.08, 0.08);
        var bm = mesh(new T.BoxGeometry(0.245, 0.01, 0.5), INK); bm.position.set(0, -0.07, 0.64); head.add(bm);
        parts.tail = sph(ch, '#26304A', 0, -0.68, -0.34, 0.08, 0.14, 0.06); break;
      case 'eagle':
        body('#6B4A33', '#8A6448'); both(function (m) { var w = sph(ch, '#6B4A33', m * 0.34, -0.55, -0.06, 0.1, 0.24, 0.24); w.rotation.z = m * 0.2; sph(ch, '#FFC23D', m * 0.16, -0.92, 0.12, 0.1, 0.04, 0.13); });
        H('#FFFFFF'); both(function (m) { stick(INK, m * 0.17, 0.19, 0.11, 0.025, 0.02, m * 0.35); }); irisEyes(0.17, 0.07, 0.06, '#FFD84D');
        sph(head, '#FFC23D', 0, -0.07, 0.46, 0.12, 0.11, 0.13); tube(head, '#FFC23D', [[0, -0.03, 0.56], [0, -0.1, 0.62], [0, -0.2, 0.58]], 0.045);
        parts.tail = sph(ch, '#FFFFFF', 0, -0.7, -0.34, 0.12, 0.05, 0.12); break;
      case 'bat':
        body('#4A3A66', '#6E5A8C'); both(function (m) { var g = new T.Group(); g.position.set(m * 0.28, -0.48, -0.06); g.rotation.z = -m * 0.25; var wgm = sph(g, '#4A3A66', m * 0.36, 0.12, 0, 0.4, 0.26, 0.03); [0, 1, 2].forEach(function (k) { tube(g, '#3A2C52', [[0, 0, 0.02], [m * (0.3 + k * 0.17), 0.36 - k * 0.2, 0.02]], 0.015, false); }); ch.add(g); parts.ears.push(g); });
        H('#6E5A8C'); earCone('#6E5A8C', '#FFB3C7', 0.26, 0.32, 0.15, 0.42, 0.3); sph(head, '#8E7AAE', 0, -0.08, 0.24, 0.36, 0.3, 0.3);
        eyes(0.16, 0.06, 0.065); nose('#FF6F91', -0.08, 0.5, 0.03); both(function (m) { cone(head, '#FFFFFF', 0.022, 0.06, m * 0.05, -0.25, 0.45, Math.PI); }); smile(-0.17, 0.48, 0.07); cheeks(0.3, -0.12); break;
      case 'bee':
        body('#FFD84D', null); bands(ch, INK, -0.62, -0.02, 0.33, 0.3, 0.3, [0.12, 0.0, -0.12]);
        var wingM = new T.MeshPhysicalMaterial({ color: new T.Color('#EAF3FF'), roughness: 0.1, transparent: true, opacity: 0.75, clearcoat: 1 });
        both(function (m) { var g = new T.Group(); g.position.set(m * 0.15, -0.36, -0.26); g.rotation.z = -m * 0.5; var w = new T.Mesh(SG, wingM); w.scale.set(0.12, 0.24, 0.02); w.position.set(m * 0.06, 0.2, 0); g.add(w); var w2 = new T.Mesh(SG, wingM); w2.scale.set(0.09, 0.16, 0.02); w2.position.set(m * 0.16, 0.06, -0.02); g.add(w2); ch.add(g); parts.ears.push(g); });
        parts.tail = cone(ch, INK, 0.04, 0.12, 0, -0.66, -0.36, -Math.PI / 2);
        H('#FFD84D'); both(function (m) { tube(head, INK, [[m * 0.12, 0.42, 0.05], [m * 0.2, 0.62, 0.1], [m * 0.26, 0.7, 0.12]], 0.015, false); sph(head, INK, m * 0.26, 0.72, 0.12, 0.05); });
        eyes(0.17, 0.06, 0.07); smile(-0.12, 0.47, 0.1); cheeks(0.3, -0.08); break;
      case 'snail':
        sph(ch, '#B8E08A', 0, -0.84, 0.08, 0.3, 0.09, 0.5); sph(ch, '#FF9A4D', 0, -0.42, -0.24, 0.22, 0.38, 0.38);
        both(function (m) { [0.26, 0.15, 0.06].forEach(function (r, k) { var t = mesh(new T.TorusGeometry(r, 0.025, 8, 28), '#E2683C'); t.rotation.y = Math.PI / 2; t.position.set(m * (0.2 + k * 0.012), -0.42 + k * 0.03, -0.24 + k * 0.02); ch.add(t); }); });
        head.position.set(0, -0.3, 0.26); head.scale.setScalar(0.78); H('#B8E08A');
        both(function (m) { tube(head, '#B8E08A', [[m * 0.12, 0.35, 0.1], [m * 0.18, 0.72, 0.14]], 0.04, false); eyeGroup(m * 0.18, 0.78, 0.16, function (g) { sph(g, '#FFFFFF', 0, 0, 0, 0.09); sph(g, INK, 0, 0, 0.06, 0.05, 0.05, 0.04, true); sph(g, '#FFFFFF', 0.015, 0.02, 0.1, 0.015); }); });
        smile(-0.08, 0.47, 0.12); cheeks(0.3, -0.06); break;
      case 'hamster':
        body('#F2B36B', '#FFF6EC', 1.15); H('#F2B36B', 1.08, 1, 1);
        both(function (m) { sph(head, '#FFF6EC', m * 0.25, -0.15, 0.22, 0.24, 0.2, 0.22); }); muzzle('#FFF6EC', 0.12, 0.09, -0.1, 0.4); nose('#FF6F91', -0.06, 0.5, 0.03);
        var ht = mesh(new T.BoxGeometry(0.05, 0.05, 0.02), '#FFFFFF'); ht.position.set(0, -0.2, 0.47); head.add(ht);
        stick('#FFF6EC', 0, 0.25, 0.04, 0.1, 0.02); eyes(0.17, 0.1, 0.055); earRound('#F2B36B', '#FFB3C7', 0.3, 0.36, 0.09); cheeks(0.34, -0.06, 0.56); break;
      case 'dragon':
        body('#8E6CE0', '#B9A2F0'); for (var dk = 0; dk < 3; dk++) cone(ch, '#3FD3A0', 0.05, 0.1, 0, -0.36, -0.12 - dk * 0.1, -0.5);
        both(function (m) { var g = new T.Group(); g.position.set(m * 0.2, -0.42, -0.24); g.rotation.z = -m * 0.4; sph(g, '#3FD3A0', m * 0.2, 0.16, 0, 0.24, 0.18, 0.03); tube(g, '#6B4FC0', [[0, 0, 0.02], [m * 0.3, 0.3, 0.02]], 0.02, false); ch.add(g); parts.ears.push(g); });
        H('#8E6CE0'); both(function (m) { tube(head, '#FFB020', [[m * 0.16, 0.38, -0.04], [m * 0.24, 0.55, -0.14]], 0.045, false); cone(head, '#FFB020', 0.045, 0.14, m * 0.27, 0.62, -0.2, -0.7, -m * 0.5); var fin2 = cone(head, '#3FD3A0', 0.09, 0.22, m * 0.5, 0.08, -0.04, 0, -m * 1.3); fin2.scale.z = 0.3; });
        cone(head, '#3FD3A0', 0.05, 0.12, 0, 0.53, 0.06); muzzle('#B9A2F0', 0.22, 0.15, -0.15, 0.34); nostrils('#4A3A86', 0.07, -0.1, 0.49);
        cone(head, '#FFFFFF', 0.022, 0.06, 0.08, -0.28, 0.42, Math.PI); eyes(0.17, 0.08, 0.065); cheeks(0.31, -0.08);
        parts.tail = tailGroup(0, -0.66, -0.3); tube(parts.tail, '#8E6CE0', [[0, 0, 0], [0, -0.1, -0.18], [0.08, -0.16, -0.38]], 0.06); cone(parts.tail, '#3FD3A0', 0.08, 0.14, 0.1, -0.17, -0.48, -Math.PI / 2); break;
      default:
        body('#FF9FB8'); H('#FF9FB8'); eyes(0.17, 0.07, 0.065);
    }
    return { root: root, ch: ch, head: head, eyes: parts.eyes, ears: parts.ears, tail: parts.tail };
  };

  // A character marker for WWMap: stands on a glossy token, hops slowly, faces the camera, blinks.
  // A guest's animal on the map. Besides hopping, it can walk somewhere
  // (goTo / goHome), face something (face), and act: dance, rock, nap, flip,
  // look, zoom, greet, startle, wave. Left alone it picks its own acts on a
  // long, unsynchronised loop; WWLife's director sends it visiting.
  var ACTS = { dance: 3.2, rock: 3, nap: 8, flip: 1.4, look: 3, zoom: 3.6 };
  var IDLE = ['dance', 'rock', 'nap', 'flip', 'look', 'zoom', 'rock', 'look'];
  Z3.marker = function (ctx, g, i, at, color, opts) {
    opts = opts || {};
    var T = ctx.T;
    if (!ctx.env) ctx.env = Z3.env(T, ctx.renderer);
    var grp = new T.Group(); grp.position.set(at.x, at.y, at.z); ctx.scene.add(grp);
    var tokM = new T.MeshPhysicalMaterial({ color: new T.Color(color), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMap: ctx.env, envMapIntensity: 0.8 });
    var tok = new T.Mesh(new T.CylinderGeometry(0.5, 0.56, 0.1, 40), tokM); tok.position.y = 0.05; tok.castShadow = true; tok.receiveShadow = true; grp.add(tok);
    var ring = new T.Mesh(new T.RingGeometry(0.62, 0.74, 40), new T.MeshBasicMaterial({ color: new T.Color(color), transparent: true, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; grp.add(ring);
    var a = Z3.build(T, g.animal, ctx.env);
    var hold = new T.Group(); hold.add(a.root); grp.add(hold);
    var puffM = new T.MeshBasicMaterial({ color: 0xFFFDF8, transparent: true, opacity: 0, depthWrite: false });
    var puffs = []; for (var k = 0; k < 7; k++) { var p = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), puffM); p.visible = false; grp.add(p); puffs.push({ m: p, a: k / 7 * Math.PI * 2 }); }
    var base = opts.scale || 1.25, S = base, h = 0, drop = 0, yaw = null, spin = 0, wasAir = false, puffT = 9;
    var ph = (i * 0.61) % 3.4, born = performance.now() / 1000 + (opts.delay == null ? 0.2 + i * 0.05 : opts.delay), tmp = new T.Vector3();
    var seed = (g.key || String(i)).split('').reduce(function (n, c) { return (n * 31 + c.charCodeAt(0)) >>> 0; }, 7);
    var rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    var off = new T.Vector3(), goal = null, onArrive = null, faceAt = null, gy = 0, act = null, nextAct = null, zAt = 0, travel = 0;
    var walking = false;
    var self = {
      i: i, pick: [a.root, tok], home: new T.Vector3(at.x, at.y, at.z),
      remove: function () { ctx.scene.remove(grp); },
      /** Where the animal is now, on the ground (world coordinates). */
      pos: function (v) { return v.set(at.x + off.x, at.y + gy, at.z + off.z); },
      idle: function () { return !goal && !act && off.lengthSq() < 0.01; },
      away: function () { return !!goal || off.lengthSq() > 0.01; },
      goTo: function (world, cb) { goal = new T.Vector3(world.x - at.x, 0, world.z - at.z); onArrive = cb || null; act = null; faceAt = null; },
      goHome: function (cb) { goal = new T.Vector3(0, 0, 0); onArrive = cb || null; faceAt = null; },
      face: function (world) { faceAt = world ? world.clone() : null; },
      act: function (name, dur, t0) { act = { name: name, t0: t0 == null ? performance.now() / 1000 : t0, dur: dur || ACTS[name] || 2 }; },
      update: function (t, dt, isF) {
        S += ((isF ? base * 1.35 : base) - S) * Math.min(1, dt * 4);
        var life = performance.now() / 1000 - born;
        if (nextAct === null) nextAct = t + 4 + rnd() * 16;
        if (isF && act && act.name !== 'wave') act = null;
        // left alone: pick something to do, now and then
        if (!isF && !act && !goal && t > nextAct && life > 3) {
          var nm = IDLE[Math.floor(rnd() * IDLE.length)];
          self.act(nm, ACTS[nm], t);
          if (nm === 'zoom') travel = 0;
          nextAct = t + ACTS[nm] + 10 + rnd() * 22;
        }
        var A = act && t >= act.t0 ? act : null, ak = A ? (t - A.t0) / A.dur : 0;
        if (A && ak >= 1) { if (A.name === 'zoom') goal = new T.Vector3(0, 0, 0); act = null; A = null; }

        // walking
        walking = false;
        var dir = null;
        if (A && A.name === 'zoom') {
          var za = ak * Math.PI * 4, zr = 0.95 * Math.sin(Math.min(1, ak * 4) * Math.PI / 2);
          var nx = Math.sin(za) * zr, nz = Math.cos(za) * zr;
          dir = Math.atan2(nx - off.x, nz - off.z); off.set(nx, 0, nz); walking = true;
        } else if (goal) {
          tmp.copy(goal).sub(off); tmp.y = 0;
          var dist = tmp.length();
          if (dist < 0.04) { off.copy(goal); goal = null; var cb = onArrive; onArrive = null; if (cb) cb(); }
          else { tmp.multiplyScalar(Math.min(dist, 1.9 * dt) / dist); off.add(tmp); dir = Math.atan2(tmp.x, tmp.z); walking = true; }
        }
        // follow the paper ground (boroughs have different heights; keep home height over the river)
        var wy = off.lengthSq() > 0.0001 ? ctx.topAt(at.x + off.x, -(at.z + off.z)) : at.y;
        if (wy < 0) wy = at.y;
        gy += (wy - at.y - gy) * Math.min(1, dt * 8);

        // the hop
        var per = isF ? 1.7 : walking ? 0.55 : A && A.name === 'greet' ? 0.5 : A && A.name === 'dance' ? 0.45 : 3.4;
        var amp = isF ? 1.5 : walking ? 0.42 : A && (A.name === 'greet' || A.name === 'dance') ? 0.55 : 0.8;
        var air = isF ? 0.55 : walking ? 0.6 : 0.36;
        var u = ((t + ph) % per) / per, sy = 1, sx = 1, still = A && (A.name === 'nap' || A.name === 'rock' || A.name === 'look' || A.name === 'flip' || A.name === 'startle' || A.name === 'wave');
        h = 0; drop = 0;
        if (!still) {
          if (u < air) { var kk = u / air, s = Math.sin(Math.PI * kk); h = s * amp; sy = 1 + 0.12 * s; sx = 1 - 0.05 * s; }
          else { var k2 = (u - air) / (1 - air); if (k2 < 0.14) { var q = Math.sin(Math.PI * k2 / 0.14); sy = 1 - 0.2 * q; sx = 1 + 0.12 * q; } }
        }
        var inAir = !still && u < air;
        var roll = 0, pitch = 0, look = 0;
        if (A) {
          if (A.name === 'nap') { sy = 0.82 + Math.sin(t * 2.2) * 0.03; sx = 1.08; pitch = 0.12; if (t > zAt) { zAt = t + 1.1; if (ctx.fx) ctx.fx('z', self.anchor(new T.Vector3())); } }
          else if (A.name === 'rock') roll = Math.sin(ak * Math.PI * 6) * 0.32;
          else if (A.name === 'look') look = Math.sin(ak * Math.PI * 2) * 1.3;
          else if (A.name === 'flip' || A.name === 'startle' || A.name === 'wave') {
            var hs = Math.sin(Math.PI * Math.min(1, ak)); h = hs * (A.name === 'flip' ? 2.2 : A.name === 'wave' ? 1.3 : 1.5); sy = 1 + 0.1 * hs;
            if (A.name === 'flip') pitch = -ak * Math.PI * 2;
            inAir = ak < 1;
          }
        }
        if (wasAir && !inAir) puffT = 0; wasAir = inAir;
        if (life < 1.2) { var e = Math.max(0, life) / 1.2, dropH = Math.pow(1 - Math.min(1, e * 1.6), 2) * 14; drop = dropH; h += dropH + (e > 0.62 ? Math.abs(Math.sin((e - 0.62) / 0.38 * Math.PI)) * 0.6 * (1 - e) : 0); }
        hold.visible = life > 0; // outside the drop-in: a long first frame (shader compile) can skip it entirely
        hold.position.set(off.x, 0.1 + gy + h, off.z); hold.scale.set(sx * S, sy * S, sx * S);

        // which way to face: where it's going, who it's greeting, or the camera
        var want;
        if (dir != null) want = dir;
        else if (faceAt) want = Math.atan2(faceAt.x - (at.x + off.x), faceAt.z - (at.z + off.z));
        else { tmp.copy(ctx.cam.position).sub(grp.position); want = Math.atan2(tmp.x, tmp.z) + Math.sin(t * 0.9 + i) * 0.25; }
        want += look;
        if (yaw === null) yaw = want; var d = want - yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; yaw += d * Math.min(1, dt * (walking ? 8 : 3));
        if (isF && inAir) spin = (u / air) * Math.PI * 2;
        else if (A && A.name === 'dance') spin = ak * Math.PI * 6;
        else spin *= 0.85;
        hold.rotation.set(pitch, yaw + spin, roll, 'YXZ');
        a.head.rotation.z = Math.sin(t * 1.3 + i) * 0.08; a.head.rotation.x = -0.12 + Math.sin(t * 0.8 + i * 2) * 0.05 + (A && A.name === 'nap' ? 0.35 : 0);
        var bt = (t + i * 0.37) % 4.2, bl = A && A.name === 'nap' ? 0.12 : bt < 0.14 ? 0.12 : 1; a.eyes.forEach(function (e) { e.scale.y = bl; });
        var et = (t + i * 0.53) % 5, wig = et < 0.5 || (A && A.name === 'greet') ? Math.sin(t * 25) * 0.25 : 0; a.ears.forEach(function (e, n) { e.rotation.x = (e.userData.rx0 == null ? (e.userData.rx0 = e.rotation.x) : e.userData.rx0) + wig * (n % 2 ? 1 : -1); });
        if (a.tail) a.tail.rotation.y = Math.sin(t * (A && (A.name === 'greet' || A.name === 'dance') ? 14 : 6) + i) * 0.4;
        puffT += dt; var pl = Math.min(1, puffT / 0.5);
        puffs.forEach(function (p) { p.m.visible = pl < 1; if (pl < 1) { var r = 0.4 + pl * 0.6 * S; p.m.position.set(off.x + Math.cos(p.a) * r, gy + 0.1 + pl * 0.15, off.z + Math.sin(p.a) * r); p.m.scale.setScalar((0.6 + pl) * S * 0.8); } });
        puffM.opacity = pl < 1 ? 0.85 * (1 - pl) : 0;
        var pu = (t * 0.5 + i * 0.13) % 1; ring.scale.setScalar(S * (0.9 + pu * 0.8)); ring.material.opacity = 0.9 * (1 - pu);
      },
      // camera/labels follow the animal but ignore the drop-in
      anchor: function (v) { return v.set(at.x + off.x, at.y + gy + 0.1 + (h - drop) + 1.85 * S, at.z + off.z); },
    };
    return self;
  };
})();
