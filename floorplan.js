// Home floorplan: plan and 3D (isometric) views of a two-storey house, built in the iso-glow style,
// with lights and devices you can switch from the plan, the 3D model or the drawer.
// A classic script (not a module): three.js comes in through the page's import map, from ./vendor or a CDN.
(async () => {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const { LineMaterial } = await import('three/addons/lines/LineMaterial.js');
  const { LineSegments2 } = await import('three/addons/lines/LineSegments2.js');
  const { LineSegmentsGeometry } = await import('three/addons/lines/LineSegmentsGeometry.js');

  const $ = s => document.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('floorplan.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('floorplan.' + k, JSON.stringify(v)); } catch {} },
  };
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the page's API, for scripts that add to it (e.g. a live connection to real devices):
  // live — true while switches control real devices; remote(devices, on) — called before a switch changes;
  // night — true / false to say whether the sun is down (null: use the clock). Filled in at the end; 'floorplan:ready' fires then.
  const api = window.floorplan = { live: false, remote: null, night: null };

  // ── the house, in pixels of floor-plan.jpg: ground floor at x 4–706, first floor drawn 1117 px to its right ──
  const S = 1 / 141, CX = 355, CY = 951;   // 141 px per metre, from the room sizes printed on the plan
  const WALL = 1.05, INNER = .75, LOW = .2;   // outer walls cut at 1.05 m, inner walls at 0.75 m; outer walls facing the 3D camera drop to 0.2 m
  const FLAT = .04;                        // height scale in plan view

  const PLAN = [
    {
      name: 'Ground floor', short: 'Ground', ox: 0,
      slab: [[4, 240, 706, 1425], [4, 1425, 319, 1662]],
      ext: [   // outer walls and which way they face
        [4, 240, 28, 1662, 'w'], [28, 240, 146, 265, 'n'], [294, 240, 441, 265, 'n'], [662, 240, 681, 265, 'n'], [681, 240, 706, 1425, 'e'],
        [319, 1400, 399, 1425, 's'], [589, 1400, 681, 1425, 's'], [294, 1400, 319, 1662, 'e'], [141, 1637, 294, 1662, 's'],
      ],
      walls: [
        [28, 678, 229, 693], [342, 678, 681, 693], [28, 819, 185, 835],
        [169, 806, 185, 1271], [169, 1384, 185, 1465], [169, 1572, 185, 1637], [185, 1404, 294, 1420],
      ],
      windows: [[146, 240, 294, 265, 'kitchen', 'n'], [399, 1400, 589, 1425, 'lounge', 's']],
      doors: [[342, 686, 112, 180, 220], [177, 697, 105, 90, 50], [177, 1384, 110, -90, -50], [177, 1572, 110, -90, -131], [30, 1650, 110, 0, -41]],
      rooms: [
        { id: 'garden', name: 'Back garden', rects: [[4, 54, 706, 240]], label: [130, 175], outside: true },
        { id: 'kitchen', name: 'Kitchen', rects: [[28, 265, 681, 678], [229, 678, 342, 693]], label: [600, 610] },
        { id: 'lounge', name: 'Living Room', rects: [[185, 693, 681, 1400], [169, 1271, 185, 1384]], label: [540, 770] },
        { id: 'hallway', name: 'Hallway', rects: [[28, 835, 169, 1637], [28, 1637, 141, 1662], [169, 1465, 185, 1572]], label: [98, 1450] },
        { id: 'storage0', name: 'Storage', rects: [[28, 693, 169, 819], [169, 693, 185, 806]], label: [98, 756] },
        { id: 'wc', name: 'WC', rects: [[185, 1420, 294, 1637]], label: [240, 1532] },
      ],
      build: buildGround,
    },
    {
      name: 'First floor', short: 'First', ox: 1117,
      slab: [[1121, 240, 1823, 664], [1121, 664, 1141, 1006], [1280, 664, 1823, 1006], [1121, 1006, 1823, 1425], [1121, 1425, 1436, 1662]],
      ext: [
        [1121, 240, 1141, 1662, 'w'], [1141, 240, 1205, 265, 'n'], [1353, 240, 1541, 265, 'n'], [1689, 240, 1798, 265, 'n'], [1798, 240, 1823, 1425, 'e'],
        [1436, 1400, 1570, 1425, 's'], [1718, 1400, 1798, 1425, 's'], [1411, 1400, 1436, 1662, 'e'], [1141, 1637, 1205, 1662, 's'], [1353, 1637, 1411, 1662, 's'],
      ],
      walls: [
        [1141, 523, 1303, 539], [1416, 265, 1431, 689], [1416, 800, 1431, 965], [1431, 819, 1573, 835], [1686, 819, 1798, 835],
        [1416, 949, 1798, 965], [1416, 1090, 1432, 1400], [1141, 1141, 1303, 1157],
        [1141, 1006, 1280, 1023],
      ],
      windows: [[1205, 240, 1353, 265, 'bathroom', 'n'], [1541, 240, 1689, 265, 'master', 'n'], [1570, 1400, 1718, 1425, 'kids', 's'], [1205, 1637, 1353, 1662, 'office', 's']],
      doors: [[1416, 531, 112, 180, 221], [1423, 800, 114, -90, -48], [1686, 827, 113, 180, 221], [1424, 973, 114, 90, 53], [1415, 1149, 110, 180, 142], [1275, 1138, 112, -90, -49]],
      rooms: [
        { id: 'bathroom', name: 'Bathroom', rects: [[1141, 265, 1416, 523]], label: [1300, 380] },
        { id: 'landing', name: 'Landing', rects: [[1141, 539, 1416, 664], [1280, 664, 1416, 1141], [1303, 523, 1416, 539], [1303, 1141, 1415, 1157]], label: [1345, 835] },
        { id: 'storage1', name: 'Storage', rects: [[1141, 1023, 1280, 1141]], label: [1240, 1118] },
        { id: 'master', name: 'Master Bedroom', rects: [[1431, 265, 1798, 819], [1416, 689, 1431, 800]], label: [1615, 615] },
        { id: 'ensuite', name: 'En-suite', rects: [[1431, 835, 1798, 949], [1573, 819, 1686, 835]], label: [1490, 892] },
        { id: 'office', name: 'Office', rects: [[1141, 1157, 1416, 1400], [1141, 1400, 1411, 1637]], label: [1320, 1545] },
        { id: 'kids', name: "Children's Bedroom", rects: [[1432, 965, 1798, 1400], [1416, 965, 1432, 1090]], label: [1600, 1290] },
      ],
      build: buildFirst,
    },
  ];

  // ── devices, by room ──
  const DEVICES = [
    { id: 'arch', kind: 'light', name: 'Arch', floor: 0, room: 'lounge', icon: 'lamp' },
    { id: 'lamp', kind: 'light', name: 'Lamp', floor: 0, room: 'lounge', icon: 'lamp' },
    { id: 'corner', kind: 'light', name: 'Corner', floor: 0, room: 'lounge', icon: 'lamp' },
    { id: 'ceiling', kind: 'light', name: 'Ceiling', floor: 0, room: 'lounge', icon: 'bulb' },
    { id: 'tv', kind: 'media', name: 'Living Room TV', short: 'TV', floor: 0, room: 'lounge', icon: 'tv' },
    { id: 'kitchen-display', kind: 'media', name: 'Kitchen Display', short: 'Display', floor: 0, room: 'kitchen', icon: 'display' },
    { id: 'robovac', kind: 'vacuum', name: 'RoboVac', floor: 0, room: 'kitchen', icon: 'vacuum' },
    { id: 'stair-strip', kind: 'light', name: 'Strip', floor: 0, room: 'hallway', icon: 'strip' },
    { id: 'hallway-sensor', kind: 'sensor', name: 'Hallway Sensor', floor: 0, room: 'hallway', icon: 'sensor' },
    { id: 'garden-lights', kind: 'light', name: 'Back garden', floor: 0, room: 'garden', icon: 'strip' },
    { id: 'bedroom-one', kind: 'light', name: 'Bedroom One', floor: 1, room: 'master', icon: 'lamp' },
    { id: 'bedroom-two', kind: 'light', name: 'Bedroom Two', floor: 1, room: 'master', icon: 'lamp' },
    { id: 'panels', kind: 'light', name: 'Panels', floor: 1, room: 'office', icon: 'hex' },
    { id: 'printer', kind: 'light', name: '3D printer', floor: 1, room: 'office', icon: 'printer' },
    { id: 'amp', kind: 'media', name: 'Amp', floor: 1, room: 'office', icon: 'speaker', text: false },
    { id: 'office-display', kind: 'media', name: 'Office Display', short: 'Display', floor: 1, room: 'office', icon: 'display' },
    { id: 'fan', kind: 'fan', name: 'Fan', floor: 1, room: 'office', icon: 'fan', align: 'left' },
    { id: 'landing-sensor', kind: 'sensor', name: 'Landing Sensor', floor: 1, room: 'landing', icon: 'sensor' },
  ];
  const DEV = Object.fromEntries(DEVICES.map(d => [d.id, d]));

  // starting state; an integration (see api below) can replace it with the real thing
  const START = {
    arch: ['on', { brightness: 128 }], lamp: ['on', { brightness: 128 }], corner: ['on', { brightness: 255 }], printer: ['off', { status: 'idle' }], robovac: ['docked'],
  };
  const states = {};
  for (const d of DEVICES) { const [state, attributes = {}] = START[d.id] || ['off']; states[d.id] = { id: d.id, state, attributes }; }
  const st = id => states[id] || { state: 'unknown', attributes: {} };

  const ICON = {
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2.2h5.2c0-1 .4-1.7 1-2.2A6 6 0 0 0 12 3z"/>',
    lamp: '<path d="M8 3h8l3 8H5z"/><path d="M12 11v9M8 21h8"/>',
    strip: '<path d="M3 12h18"/><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/>',
    hex: '<path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M8 21h8M12 17v4"/>',
    display: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M8 20h8l-1.5-4h-5z"/>',
    speaker: '<rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="14" r="3"/><circle cx="12" cy="7.5" r="1"/>',
    vacuum: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v3"/>',
    printer: '<path d="M5 4h14v16H5zM5 9h14M10 9v4h4V9M8 20v-3h8v3"/>',
    fan: '<rect x="8.5" y="2" width="7" height="12" rx="3.5"/><path d="M9 14h6l1 8H8z"/>',
    sensor: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  };
  const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

  // iso-glow "city" palette, warm tungsten yellow first (the default)
  const PALETTE = [['Tungsten', '#ffd166'], ['Sodium', '#ff9a2e'], ['Neon', '#ff4fa3'], ['Signal', '#3ee8a0'], ['Dusk', '#6f9dff'], ['Moon', '#dfe7f5']];
  const THEMES = {
    dark: { bg: 0x121314, wall: 0x5b6066, body: 0x36393d, soft: 0x3b3e43, top: 0x44474c, slab: 0x2b2d31, floor: 0x17181a, out: 0x111214,
      lamp: 0x3a3d42, glass: 0x0b0d10, line: 0x666c73, minor: 0x393d42, sky: 0xdde4ff, ground: 0x080808, hemi: .8, amb: 0, sun: .9 },
    light: { bg: 0xe9eaea, wall: 0xb5b9bc, body: 0xeeeeed, soft: 0xe6e7e7, top: 0xf6f6f5, slab: 0xd9dbdb, floor: 0xf8f8f7, out: 0xe2e4e4,
      lamp: 0xd8dadb, glass: 0xc6d0d7, line: 0x8e9397, minor: 0xc6c9cb, sky: 0xffffff, ground: 0xe6e6e6, hemi: .9, amb: 1.6, sun: .4 },
  };

  // ── renderer, scene, camera ──
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Floorplan of the house with its lights and devices. Use the drawer to switch devices.');
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-innerWidth / 2, innerWidth / 2, innerHeight / 2, -innerHeight / 2, .1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .12; controls.zoomToCursor = true;
  const hemi = new THREE.HemisphereLight(0xdde4ff, 0x080808, .8); scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0); scene.add(amb);
  const sun = new THREE.DirectionalLight(0xffffff, .9); sun.position.set(-5, 12, 7); scene.add(sun);

  const accent = new THREE.Color(PALETTE[0][1]);
  const res = () => renderer.getDrawingBufferSize(new THREE.Vector2());
  const lineMats = [], glowMats = [], pls = [];
  const lineMat = () => { const m = new LineMaterial({ linewidth: 1, resolution: res(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }); lineMats.push(m); return m; };
  const NOISE = 'float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }';
  let theme = 'dark';
  const T = () => THEMES[theme];

  // ── one floor: its own group and materials, so a floor can fade and slide on its own ──
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  function makeFloor(def, index) {
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    const F = { def, index, g, fade: 1, edges: [], minor: [], mats: [], roles: {}, lits: [], rooms: {}, tag: null };
    const x = px => (px - def.ox - CX) * S, z = py => (py - CY) * S;
    F.x = x; F.z = z; F.v = (px, py, h) => new THREE.Vector3(x(px), h, z(py));
    const own = m => { F.mats.push(m); return m; };
    const std = (o = {}) => own(new THREE.MeshStandardMaterial({ roughness: .9, metalness: .05, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...o }));
    F.mat = role => F.roles[role] ??= role === 'line' || role === 'minor' ? own(lineMat()) : std();
    F.std = std;
    F.lit = () => { const m = std({ roughness: .5, emissive: accent.clone(), emissiveIntensity: 0 }); F.lits.push(m); return m; };
    F.glass = () => { const m = std({ roughness: .15, transparent: true, opacity: .55, depthWrite: false, emissive: accent.clone(), emissiveIntensity: 0 }); m.userData.op = .55; F.lits.push(m); m.userData.glass = true; return m; };
    const mat = m => typeof m === 'string' ? F.mat(m) : m;
    const add = (mesh) => { if (F.tag) mesh.userData.dev = F.tag; F.g.add(mesh); return mesh; };
    const lines = (parent, edges, minor) => {
      for (const [arr, role] of [[edges, 'line'], [minor, 'minor']]) if (arr.length) {
        const l = new LineSegments2(new LineSegmentsGeometry().setPositions(arr), F.mat(role)); l.raycast = () => {}; parent.add(l);
      }
    };
    // build into a sub-group with its own hairlines, so it can be scaled on its own (the cut-away outer walls)
    F.part = fn => {
      const sub = new THREE.Group(), saved = [F.g, F.edges, F.minor];
      F.g = sub; F.edges = []; F.minor = [];
      fn(); lines(sub, F.edges, F.minor);
      [F.g, F.edges, F.minor] = saved; F.g.add(sub);
      return sub;
    };

    // a box from plan pixels and heights in metres, with its 12 hairline edges
    F.solid = (x0, y0, x1, y1, h0, h1, m = 'body') => {
      const mesh = new THREE.Mesh(BOX, mat(m));
      mesh.scale.set((x1 - x0) * S, h1 - h0, (y1 - y0) * S);
      mesh.position.set(x((x0 + x1) / 2), (h0 + h1) / 2, z((y0 + y1) / 2));
      return add(mesh);
    };
    F.box = (x0, y0, x1, y1, h0, h1, m = 'body') => {
      const X0 = x(x0), X1 = x(x1), Z0 = z(y0), Z1 = z(y1), e = F.edges;
      for (const h of [h0, h1]) e.push(X0, h, Z0, X1, h, Z0, X1, h, Z0, X1, h, Z1, X1, h, Z1, X0, h, Z1, X0, h, Z1, X0, h, Z0);
      for (const [a, b] of [[X0, Z0], [X1, Z0], [X1, Z1], [X0, Z1]]) e.push(a, h0, b, a, h1, b);
      return F.solid(x0, y0, x1, y1, h0, h1, m);
    };
    // a door leaf hinged at (hx, hy), len px long and th px thick, in its own group so a click swings it
    // between closed (a0) and open (a1); plan angles in degrees, y pointing down
    F.door = (hx, hy, len, a0, a1, th, h0, h1, m) => {
      const g = new THREE.Group(), L = len * S, T = th * S / 2, E = [];
      g.position.set(x(hx), 0, z(hy)); g.rotation.y = -a1 * Math.PI / 180;
      const mesh = new THREE.Mesh(BOX, mat(m)); mesh.scale.set(L, h1 - h0, 2 * T); mesh.position.set(L / 2, (h0 + h1) / 2, 0);
      const P = [[0, -T], [L, -T], [L, T], [0, T]];
      for (let i = 0; i < 4; i++) { const [a, b] = P[i], [c, d] = P[(i + 1) % 4]; E.push(a, h0, b, c, h0, d, a, h1, b, c, h1, d, a, h0, b, a, h1, b); }
      const l = new LineSegments2(new LineSegmentsGeometry().setPositions(E), F.mat('line')); l.raycast = () => {};
      // an invisible, wider slab around the leaf so the door is easy to hit, even flattened in plan view
      const hit = new THREE.Mesh(BOX, mesh.material); hit.visible = false;
      hit.scale.set(L, h1 - h0, .3); hit.position.copy(mesh.position);
      g.add(mesh, l, hit); F.g.add(g);
      mesh.userData.door = hit.userData.door = { g, a0, a1, open: true };
    };
    F.cyl = (cx, cy, r, h0, h1, m = 'body', rTop = r, seg = 28) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop * S, r * S, h1 - h0, seg), mat(m));
      mesh.position.set(x(cx), (h0 + h1) / 2, z(cy));
      F.ring(cx, cy, r, h0, F.edges); F.ring(cx, cy, rTop, h1, F.edges);
      return add(mesh);
    };
    F.ring = (cx, cy, r, h, arr = F.minor, a0 = 0, a1 = 360, n = 32) => {
      for (let i = 0; i < n; i++) {
        const p = (a0 + (a1 - a0) * i / n) * Math.PI / 180, q = (a0 + (a1 - a0) * (i + 1) / n) * Math.PI / 180;
        arr.push(x(cx + r * Math.cos(p)), h, z(cy + r * Math.sin(p)), x(cx + r * Math.cos(q)), h, z(cy + r * Math.sin(q)));
      }
    };
    F.seg = (pts, arr = F.minor) => { for (let i = 1; i < pts.length; i++) arr.push(x(pts[i - 1][0]), pts[i - 1][2], z(pts[i - 1][1]), x(pts[i][0]), pts[i][2], z(pts[i][1])); };
    F.rect = (x0, y0, x1, y1, h, arr = F.minor) => F.seg([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h], [x0, y0, h]], arr);
    // a low-poly bush: faceted, so its creases read as hairlines
    F.bush = (cx, cy, r, h) => {
      const geo = new THREE.IcosahedronGeometry(r * S, 0), mesh = new THREE.Mesh(geo, F.mat('soft'));
      mesh.position.set(x(cx), h, z(cy)); add(mesh);
      const ep = new THREE.EdgesGeometry(geo).attributes.position.array;
      for (let i = 0; i < ep.length; i += 3) F.minor.push(ep[i] + x(cx), ep[i + 1] + h, ep[i + 2] + z(cy));
    };
    F.tube = (pts, r, m = 'body') => {
      const curve = new THREE.CatmullRomCurve3(pts.map(([px, py, h]) => F.v(px, py, h)));
      add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r * S, 8), mat(m)));
      const sp = curve.getPoints(32);
      for (let i = 1; i < sp.length; i++) F.edges.push(sp[i - 1].x, sp[i - 1].y, sp[i - 1].z, sp[i].x, sp[i].y, sp[i].z);
    };
    // a flat-top hexagon panel on a wall face at plan x = xFace that looks towards −x
    F.hex = (cy, h, r, xFace, m) => {
      const shape = new THREE.Shape(), P = [];
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; P.push([r * S * Math.cos(a), r * S * Math.sin(a)]); }
      shape.moveTo(...P[0]); P.slice(1).forEach(p => shape.lineTo(...p));
      const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3 * S, bevelEnabled: false }), mat(m));
      mesh.position.set(x(xFace), h, z(cy)); mesh.rotation.y = -Math.PI / 2; add(mesh);   // shape x → plan y, extrusion → −x
      for (let i = 0; i < 6; i++) { const [a, b] = P[i], [c, d] = P[(i + 1) % 6]; F.edges.push(x(xFace - 3), h + b, z(cy) + a, x(xFace - 3), h + d, z(cy) + c); }
    };
    F.glow = (points, size) => {
      const m = new THREE.ShaderMaterial({
        uniforms: { color: { value: accent }, intensity: { value: 0 }, px: { value: 1 }, day: { value: 0 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `uniform float px; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); mv.z += 0.4; gl_PointSize = px; gl_Position = projectionMatrix * mv; }`,
        // dark theme adds light; in Day the halo is laid over the pale floor as a tint
        fragmentShader: `uniform vec3 color; uniform float intensity, day; ${NOISE}
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
            float halo = exp(-d * d * mix(7.0, 2.5, day)) * (1.0 - d), core = 1.0 - smoothstep(0.04, 0.11, d);   // wider, softer halo in Day
            float a = (halo * 0.8 + core * 0.9) * intensity + (hash(gl_FragCoord.xy) - 0.5) / 255.0;
            vec3 c = mix(color, vec3(1.0), core * 0.6 * (1.0 - day));
            gl_FragColor = day > 0.5 ? vec4(c, clamp(a, 0.0, 1.0)) : vec4(c * max(a, 0.0), 1.0);
            #include <colorspace_fragment>
          }`,
      });
      m.userData.size = size; glowMats.push(m);
      const p = new THREE.Points(new THREE.BufferGeometry().setFromPoints(points), m); p.renderOrder = 5; p.raycast = () => {}; F.g.add(p); return p;
    };

    // floor slab, rooms (their floors carry the light pools), walls, windows, doors
    for (const r of def.slab) F.solid(...r, -.14, 0, 'slab');
    outline(F, def.slab, -.14, 0);
    for (const r of def.rooms) {
      const m = own(roomMat()), h = r.outside ? -.018 : .002;
      m.userData.outside = !!r.outside;
      for (const [x0, y0, x1, y1] of r.rects) {
        const geo = new THREE.PlaneGeometry((x1 - x0) * S, (y1 - y0) * S).rotateX(-Math.PI / 2).translate(x((x0 + x1) / 2), h, z((y0 + y1) / 2));
        g.add(new THREE.Mesh(geo, m));
      }
      F.rooms[r.id] = { ...r, mat: m, devs: [], glass: [] };
    }
    for (const r of def.walls) F.solid(...r, 0, INNER, 'wall');
    outline(F, def.walls, 0, INNER);
    const N = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
    F.cut = def.ext.map(([x0, y0, x1, y1, dir]) => ({ n: N[dir], g: F.part(() => F.box(x0, y0, x1, y1, 0, WALL, 'wall')) }));
    for (const [x0, y0, x1, y1, room, dir] of def.windows) F.cut.push({ n: N[dir], g: F.part(() => {
      F.box(x0, y0, x1, y1, 0, .55, 'wall');
      const gl = F.glass(); F.rooms[room].glass.push(gl);
      if (x1 - x0 > y1 - y0) { const m = (y0 + y1) / 2; F.box(x0, m - 2, x1, m + 2, .55, WALL, gl); }
      else { const m = (x0 + x1) / 2; F.box(m - 2, y0, m + 2, y1, .55, WALL, gl); }
    }) });
    for (const [hx, hy, len, a0, a1] of def.doors) { F.door(hx, hy, len - 4, a0, a1, 4, 0, INNER - .05, 'top'); F.ring(hx, hy, len, .004, F.minor, a0, a1, 12); }
    def.build(F);
    lines(g, F.edges, F.minor);
    return F;
  }

  // hairlines around the union of axis-aligned rectangles: no seams where walls meet
  function outline(F, rects, h0, h1) {
    const xs = rects.flatMap(r => [r[0], r[2]]), ys = rects.flatMap(r => [r[1], r[3]]);
    const ox = Math.min(...xs), oy = Math.min(...ys), w = Math.max(...xs) - ox, h = Math.max(...ys) - oy;
    const grid = new Uint8Array(w * h);
    for (const [x0, y0, x1, y1] of rects) for (let y = y0 - oy; y < y1 - oy; y++) grid.fill(1, y * w + x0 - ox, y * w + x1 - ox);
    const at = (i, j) => i >= 0 && j >= 0 && i < w && j < h ? grid[j * w + i] : 0;
    const E = F.edges, corners = new Set();
    const line = (ax, ay, bx, by) => { for (const hh of [h0, h1]) E.push(F.x(ax), hh, F.z(ay), F.x(bx), hh, F.z(by)); };
    for (let j = 0; j <= h; j++) {
      let s = -1;
      for (let i = 0; i <= w; i++) {
        const edge = i < w && at(i, j - 1) !== at(i, j);
        if (edge && s < 0) s = i;
        if (!edge && s >= 0) { line(s + ox, j + oy, i + ox, j + oy); corners.add(`${s + ox},${j + oy}`).add(`${i + ox},${j + oy}`); s = -1; }
      }
    }
    for (let i = 0; i <= w; i++) {
      let s = -1;
      for (let j = 0; j <= h; j++) {
        const edge = j < h && at(i - 1, j) !== at(i, j);
        if (edge && s < 0) s = j;
        if (!edge && s >= 0) { line(i + ox, s + oy, i + ox, j + oy); s = -1; }
      }
    }
    for (const c of corners) { const [px, py] = c.split(',').map(Number); E.push(F.x(px), h0, F.z(py), F.x(px), h1, F.z(py)); }
  }

  // room floor: flat colour plus soft pools of light from the lamps in that room only
  function roomMat() {
    return new THREE.ShaderMaterial({
      uniforms: { base: { value: new THREE.Color() }, accent: { value: accent }, fade: { value: 1 }, day: { value: 0 }, L: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 1, 0)) } },
      vertexShader: 'varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 base, accent; uniform float fade, day; uniform vec4 L[6]; varying vec2 vP; ${NOISE}
        void main() {
          float a = 0.0;
          for (int i = 0; i < 6; i++) { float d = clamp(1.0 - length(vP - L[i].xy) / L[i].z, 0.0, 1.0); a += L[i].w * d * d; }
          vec3 night = base + accent * min(a, 1.3) * 0.42, lit = mix(base, accent, min(a, 1.0) * 0.5);
          gl_FragColor = vec4(mix(night, lit, day), fade);
          #include <colorspace_fragment>
          gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
        }`,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
  }

  // register what a device is made of: lit materials, glow points, light pools, a real point light, chip position
  function fixture(F, id, fn) {
    F.tag = id; const parts = fn(); F.tag = null;
    Object.assign(DEV[id], parts);
  }

  const DOCK = [486, 640];   // robot vacuum dock, kitchen

  // ── furniture ──
  function table(F, x0, y0, x1, y1, h) {
    F.box(x0, y0, x1, y1, h - .04, h, 'top');
    for (const [a, b] of [[x0 + 3, y0 + 3], [x1 - 9, y0 + 3], [x1 - 9, y1 - 9], [x0 + 3, y1 - 9]]) F.box(a, b, a + 6, b + 6, 0, h - .04);
  }
  function chair(F, x0, y0, x1, y1, back, seat = .42) {
    F.box(x0, y0, x1, y1, seat, seat + .04, 'top');
    for (const [a, b] of [[x0 + 2, y0 + 2], [x1 - 6, y0 + 2], [x1 - 6, y1 - 6], [x0 + 2, y1 - 6]]) F.box(a, b, a + 4, b + 4, 0, seat);
    const B = { l: [x0, y0, x0 + 5, y1], r: [x1 - 5, y0, x1, y1], t: [x0, y0, x1, y0 + 5], b: [x0, y1 - 5, x1, y1] }[back];
    F.box(...B, seat + .04, seat + .4);
  }
  function stool(F, cx, cy, h) { F.cyl(cx, cy, 11, 0, .015); F.cyl(cx, cy, 3, .015, h - .03); F.cyl(cx, cy, 14, h - .03, h, 'top'); }
  function pot(F, cx, cy) { F.cyl(cx, cy, 22, 0, .38, 'body', 25); F.bush(cx, cy, 30, .6); }
  // a sofa or armchair: base, seat cushions, a back and two arms; side = which side the back is on
  function sofa(F, x0, y0, x1, y1, back, seats) {
    F.box(x0, y0, x1, y1, 0, .25, 'soft');
    const arm = 23, deep = 25;
    if (back === 'l' || back === 'r') {
      const bx = back === 'l' ? [x0, x0 + deep] : [x1 - deep, x1], sx = back === 'l' ? [x0 + deep, x1 - 3] : [x0 + 3, x1 - deep];
      F.box(x0, y0, x1, y0 + arm, .25, .6, 'soft'); F.box(x0, y1 - arm, x1, y1, .25, .6, 'soft');
      F.box(bx[0], y0 + arm, bx[1], y1 - arm, .25, .78, 'soft');
      const step = (y1 - y0 - 2 * arm) / seats;
      for (let i = 0; i < seats; i++) F.box(sx[0], y0 + arm + i * step + 1, sx[1], y0 + arm + (i + 1) * step - 1, .25, .42, 'soft');
    } else {
      const by = back === 't' ? [y0, y0 + deep] : [y1 - deep, y1], sy = back === 't' ? [y0 + deep, y1 - 3] : [y0 + 3, y1 - deep];
      F.box(x0, y0, x0 + arm, y1, .25, .6, 'soft'); F.box(x1 - arm, y0, x1, y1, .25, .6, 'soft');
      F.box(x0 + arm, by[0], x1 - arm, by[1], .25, .78, 'soft');
      const step = (x1 - x0 - 2 * arm) / seats;
      for (let i = 0; i < seats; i++) F.box(x0 + arm + i * step + 1, sy[0], x0 + arm + (i + 1) * step - 1, sy[1], .25, .42, 'soft');
    }
  }
  function bed(F, x0, y0, x1, y1, pillows, head = 'r') {   // headboard against the wall on the right (x1) or the top (y0)
    if (head === 't') {
      F.box(x0, y0, x1, y0 + 14, 0, .9); F.box(x0, y0 + 14, x1, y1, 0, .32);
      F.box(x0 + 3, y0 + 14, x1 - 3, y1 - 3, .32, .52, 'soft'); F.box(x0 + 3, y0 + 90, x1 - 3, y1 - 1, .52, .57, 'soft');
      const w = (x1 - x0 - 12) / pillows;
      for (let i = 0; i < pillows; i++) F.box(x0 + 8 + i * w, y0 + 22, x0 + 4 + (i + 1) * w, y0 + 66, .52, .62, 'top');
      return;
    }
    F.box(x1 - 14, y0, x1, y1, 0, .9); F.box(x0, y0, x1 - 14, y1, 0, .32);
    F.box(x0 + 3, y0 + 3, x1 - 14, y1 - 3, .32, .52, 'soft'); F.box(x0 + 1, y0 + 3, x1 - 90, y1 - 3, .52, .57, 'soft');
    const w = (y1 - y0 - 12) / pillows;
    for (let i = 0; i < pillows; i++) F.box(x1 - 66, y0 + 8 + i * w, x1 - 22, y0 + 4 + (i + 1) * w, .52, .62, 'top');
  }
  function wardrobe(F, x0, y0, x1, y1, face, doors) {
    F.box(x0, y0, x1, y1, 0, .95);
    for (let i = 1; i < doors; i++) {
      if (face === 'l') { const y = y0 + (y1 - y0) * i / doors; F.seg([[x0 - .3, y, .02], [x0 - .3, y, .92]]); }
      else { const x = x0 + (x1 - x0) * i / doors; F.seg([[x, y1 + .3, .02], [x, y1 + .3, .92]]); }
    }
  }
  function toilet(F, tx0, ty0, tx1, ty1, bx, by) { F.box(tx0, ty0, tx1, ty1, 0, .8, 'top'); F.cyl(bx, by, 20, 0, .4, 'top', 22); F.ring(bx, by, 14, .401); }
  function basin(F, x0, y0, x1, y1) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    F.cyl(cx, cy, 6, 0, .62); F.box(x0, y0, x1, y1, .62, .75, 'top'); F.ring(cx, cy, Math.min(x1 - x0, y1 - y0) / 2 - 7, .751);
  }
  function tableLamp(F, id, cx, cy, h0) {
    fixture(F, id, () => {
      const m = F.lit();
      F.cyl(cx, cy, 7, h0, h0 + .03); F.cyl(cx, cy, 1.5, h0 + .03, h0 + .14);
      F.cyl(cx, cy, 16, h0 + .12, h0 + .3, m, 11);
      return { mats: [m], glow: F.glow([F.v(cx, cy, h0 + .2)], .55), pools: [[cx, cy, 1.8, 1]], light: [cx, cy, h0 + .2, 5], at: [cx, cy, h0 + .34] };
    });
  }

  function buildGround(F) {
    const { box, cyl } = F;
    // back garden: terrace, planter wall with the garden light strip, pots, a bistro set
    F.solid(4, 40, 706, 240, -.12, -.02, 'slab'); outline(F, [[4, 40, 706, 240]], -.12, -.02);
    box(4, 40, 706, 54, -.02, .3);
    for (let px = 74; px < 706; px += 70) F.seg([[px, 54, -.016], [px, 240, -.016]]);
    for (let py = 116; py < 240; py += 62) F.seg([[4, py, -.016], [706, py, -.016]]);
    pot(F, 40, 94); pot(F, 668, 94);
    cyl(300, 140, 12, -.02, 0); cyl(300, 140, 3, 0, .68); cyl(300, 140, 24, .68, .71, 'top');
    stool(F, 260, 140, .45); stool(F, 340, 140, .45);
    fixture(F, 'garden-lights', () => {
      const m = F.lit(), pts = [];
      box(8, 54, 702, 57, .22, .27, m);
      for (let px = 40; px <= 680; px += 64) pts.push(F.v(px, 58, .25));
      return { mats: [m], glow: F.glow(pts, .5), pools: [[160, 110, 2.4, 1], [520, 110, 2.4, 1]], light: [355, 110, .4, 6], at: [355, 56, .34] };
    });
    // French doors, open onto the terrace
    box(441, 240, 662, 265, 0, .02, 'top');
    const fd = F.glass(); F.rooms.kitchen.glass.push(fd);
    F.door(441, 252, 108, 0, -45, 4, .02, WALL - .06, fd); F.door(662, 252, 108, 180, 225, 4, .02, WALL - .06, fd);
    F.ring(441, 252, 110, -.014, F.minor, -45, 0, 10); F.ring(662, 252, 110, -.014, F.minor, 180, 225, 10);

    // kitchen: worktops (top run under the window, left run with the hob, peninsula), fridge, dining table
    const WT = .75;   // worktop height
    box(28, 265, 380, 350, 0, WT - .04); box(28, 265, 383, 353, WT - .04, WT, 'top');
    box(28, 353, 115, 580, 0, WT - .04); box(28, 353, 118, 580, WT - .04, WT, 'top');
    box(265, 353, 380, 455, 0, WT - .04); box(262, 353, 383, 458, WT - .04, WT, 'top');
    F.rect(128, 272, 302, 342, WT + .001); F.rect(140, 282, 185, 335, WT + .001); F.rect(192, 282, 215, 335, WT + .001);
    for (let px = 226; px < 298; px += 9) F.seg([[px, 285, WT + .001], [px, 335, WT + .001]]);
    cyl(180, 276, 3, WT, WT + .15); box(177, 276, 183, 294, WT + .12, WT + .15);
    box(34, 404, 104, 484, WT, WT + .005);
    for (const [a, b, r] of [[52, 424, 12], [86, 424, 11], [52, 464, 14], [86, 464, 11]]) { F.ring(a, b, r, WT + .006); F.ring(a, b, r * .55, WT + .006, F.minor, 0, 360, 20); }
    F.seg([[115.6, 400, .1], [115.6, 490, .1], [115.6, 490, .6], [115.6, 400, .6], [115.6, 400, .1]]);
    box(28, 585, 115, 668, 0, .95); F.seg([[115.6, 585, .62], [115.6, 668, .62]]);
    // round dining table on a pedestal, four chairs
    cyl(535, 465, 25, 0, .03); cyl(535, 465, 5, .03, .61); cyl(535, 465, 62, .61, .65, 'top', 62, 40);
    chair(F, 438, 445, 470, 485, 'l', .36); chair(F, 600, 445, 632, 485, 'r', .36); chair(F, 515, 368, 555, 400, 't', .36); chair(F, 515, 530, 555, 562, 'b', .36);
    fixture(F, 'kitchen-display', () => {
      const m = F.lit();
      box(342, 281, 368, 292, WT, WT + .13); box(344, 292, 366, 293.5, WT + .03, WT + .12, m);
      return { mats: [m], pools: [[355, 340, .9, .3]], at: [355, 287, WT + .18] };
    });
    // robot vacuum and its dock (the robot is its own group so it can drive around)
    fixture(F, 'robovac', () => {
      const m = F.lit();
      box(DOCK[0] - 21, 664, DOCK[0] + 21, 678, 0, .12, 'top'); box(DOCK[0] - 18, 662, DOCK[0] + 18, 664, .02, .03, m);
      const vac = new THREE.Group(); vac.position.copy(F.v(...DOCK, 0)); F.g.add(vac);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.16, .165, .08, 36), F.mat('body')); body.position.y = .05;
      const led = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .012, 24), m); led.position.y = .096;
      const bump = new THREE.Mesh(BOX, F.mat('top')); bump.scale.set(.02, .035, .2); bump.position.set(.15, .05, 0);
      for (const o of [body, led, bump]) { o.userData.dev = 'robovac'; vac.add(o); }
      const L = [];
      for (const [r, hh] of [[.165, .01], [.16, .09], [.055, .102]]) for (let i = 0; i < 36; i++) {
        const a = i / 36 * Math.PI * 2, b = (i + 1) / 36 * Math.PI * 2;
        L.push(r * Math.cos(a), hh, r * Math.sin(a), r * Math.cos(b), hh, r * Math.sin(b));
      }
      const l = new LineSegments2(new LineSegmentsGeometry().setPositions(L), F.mat('line')); l.raycast = () => {}; vac.add(l);
      return { mats: [m], vac, pools: [], at: null };
    });

    // living room: TV on the hallway wall, sofa against the right-hand wall facing it, rug, coffee table, armchair, plant
    box(305, 900, 572, 1200, 0, .012, 'soft');
    sofa(F, 581, 880, 681, 1230, 'r', 3);
    box(430, 985, 530, 1125, .38, .42, 'top'); box(438, 993, 522, 1117, 0, .38);
    sofa(F, 470, 1275, 562, 1362, 'b', 1);
    box(372, 693, 668, 740, 0, .6); box(368, 693, 672, 743, .6, .63, 'top');   // sideboard against the kitchen wall
    for (const px of [446, 520, 594]) F.seg([[px, 740.4, .03], [px, 740.4, .57]]);
    box(185, 930, 230, 1170, 0, .4);
    F.seg([[230.4, 1010, .03], [230.4, 1010, .37]]); F.seg([[230.4, 1090, .03], [230.4, 1090, .37]]);
    fixture(F, 'tv', () => {
      const m = F.lit();
      box(198, 1035, 218, 1065, .4, .43); box(204, 962, 212, 1138, .43, .98); box(212, 967, 213.5, 1133, .46, .95, m);
      return { mats: [m], pools: [[285, 1050, 1.6, .45]], at: [208, 1050, 1.04] };
    });
    box(631, 1236, 681, 1268, 0, .5);
    tableLamp(F, 'lamp', 392, 716, .63);   // on the sideboard, at the end by the kitchen door
    fixture(F, 'arch', () => {
      const m = F.lit();
      // base by the sideboard, arching over the first sofa seat
      cyl(650, 775, 17, 0, .05, 'top');
      F.tube([[650, 775, .05], [650, 775, .75], [646, 800, 1.08], [636, 870, 1.13], [622, 942, .99]], 2.2);
      const shade = new THREE.Mesh(new THREE.SphereGeometry(20 * S, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), m);
      shade.position.copy(F.v(620, 950, .9)); shade.userData.dev = 'arch'; F.g.add(shade);
      F.ring(620, 950, 20, .9, F.edges);
      return { mats: [m], glow: F.glow([F.v(620, 950, .88)], .6), pools: [[610, 960, 2.0, 1]], light: [620, 950, .85, 6], at: [620, 950, 1.04] };
    });
    fixture(F, 'corner', () => {
      const m = F.lit();
      cyl(655, 1372, 13, 0, .03); cyl(655, 1372, 2, .03, .95); cyl(655, 1372, 20, .93, 1.12, m, 15);
      return { mats: [m], glow: F.glow([F.v(655, 1372, 1.0)], .6), pools: [[640, 1355, 2.2, 1]], light: [655, 1372, .98, 6], at: [655, 1372, 1.16] };
    });
    // the ceiling light has no fixture (there is no ceiling in a cut-away), only its glow and pool
    fixture(F, 'ceiling', () => ({ glow: F.glow([F.v(433, 1046, WALL)], .9), pools: [[433, 1046, 3.2, .9]], light: [433, 1046, WALL, 8], at: [433, 1046, WALL] }));

    // hallway: stairs up to the first floor with the LED strip along the outside wall, the motion sensor, a doormat
    fixture(F, 'stair-strip', () => {
      const m = F.lit(), pts = [];
      const tread = (1228 - 836) / 13;
      for (let i = 0; i < 13; i++) {
        const y1 = 1228 - tread * i, top = Math.min(.17 * (i + 1), INNER);   // cut at the inner-wall height
        box(28, y1 - tread, 165, y1, 0, top, 'top');
        box(28, y1 - tread, 31.5, y1, top + .01, top + .03, m);              // strip on the wall, just above each tread
        pts.push(F.v(31, y1 - tread / 2, top + .02));
      }
      return { mats: [m], glow: F.glow(pts, .3), pools: [[60, 1190, 1.8, .9], [60, 1420, 1.7, .6]], light: [33, 1080, .7, 2.5], at: [36, 1100, .95] };
    });
    fixture(F, 'hallway-sensor', () => {
      const m = F.lit();
      box(162, 1415, 169, 1435, .58, .68, 'top'); box(160.5, 1422, 162, 1428, .61, .63, m);
      return { mats: [m], at: [164, 1425, .76] };
    });
    box(40, 1588, 130, 1630, 0, .012, 'soft');
    // under-stairs storage, WC
    box(31, 698, 63, 815, 0, .9); box(82, 760, 142, 815, 0, .35); box(92, 770, 132, 805, .35, .6);
    toilet(F, 212, 1424, 268, 1446, 240, 1478); basin(F, 226, 1582, 290, 1634);
  }

  // Bambu A1 on its cabinet; (ox, oy) is the cabinet's top-left corner, the printer faces +y
  function printer(F, ox, oy) {
    const { box, cyl } = F, P = (x0, y0, x1, y1) => [ox + x0, oy + y0, ox + x1, oy + y1];
    box(...P(0, 0, 90, 75), 0, .5);
    fixture(F, 'printer', () => {
      const m = F.lit();
      box(...P(8, 10, 82, 67), .5, .55); box(...P(40, 15, 50, 65), .55, .58); box(...P(20, 17, 70, 60), .58, .6, 'top');
      box(...P(8, 17, 17, 61), .55, 1.0); box(...P(17, 33, 80, 41), .82, .86); box(...P(42, 26, 56, 48), .73, .88, 'top');
      box(...P(20, 34, 76, 40), .812, .82, m);
      cyl(ox + 12, oy + 39, 16, 1.0, 1.04, 'soft');
      return { mats: [m], glow: F.glow([F.v(ox + 48, oy + 37, .8)], .32), pools: [[ox + 48, oy + 37, 1.0, .6]], light: [ox + 48, oy + 37, .78, 1.5], at: [ox + 45, oy + 37, 1.08] };
    });
  }

  function buildFirst(F) {
    const { box, cyl } = F;
    // bathroom: bath, basin, toilet, mat
    box(1145, 268, 1255, 520, 0, .55, 'top'); F.rect(1157, 280, 1243, 508, .551); F.ring(1200, 496, 4, .552);
    basin(F, 1268, 268, 1338, 330);
    toilet(F, 1362, 266, 1412, 288, 1387, 318);
    // landing: stairs going down through the void, darker step by step (kept inside the slab so nothing hangs below the floor)
    for (let i = 0; i < 11; i++) { const m = F.std(); m.userData.mix = (i + 1) / 12; box(1141, 664 + 31 * i, 1280, 664 + 31 * (i + 1), -.14, -.011 * (i + 1), m); }
    // balustrade: handrail on spindles, newel posts at each end
    box(1280, 664, 1286, 1006, 0, .03);
    for (let y = 680; y < 992; y += 18) box(1281.5, y, 1284.5, y + 3, .03, .7);
    box(1279, 664, 1287, 672, 0, .78); box(1279, 998, 1287, 1006, 0, .78); box(1278, 672, 1288, 998, .7, .74, 'top');
    // chest of drawers on the landing side of the master bedroom wall
    box(1376, 575, 1416, 685, 0, .7);
    for (const h of [.24, .47]) F.seg([[1375.6, 575, h], [1375.6, 685, h]]);
    fixture(F, 'landing-sensor', () => {
      const m = F.lit();
      box(1409, 880, 1416, 900, .58, .68, 'top'); box(1407.5, 887, 1409, 893, .61, .63, m);
      return { mats: [m], at: [1411, 890, .76] };
    });
    // storage: hot water cylinder
    cyl(1180, 1075, 32, 0, .95, 'top');
    // master bedroom: bed against the right-hand wall between the bedside lamps, two-door wardrobe on the same wall
    bed(F, 1515, 322, 1798, 534, 2);
    box(1746, 268, 1798, 318, 0, .5); box(1746, 538, 1798, 588, 0, .5);
    tableLamp(F, 'bedroom-one', 1772, 293, .5);
    tableLamp(F, 'bedroom-two', 1772, 563, .5);
    wardrobe(F, 1722, 640, 1798, 812, 'l', 2);
    // en-suite: shower tray and screen, basin, toilet
    box(1435, 838, 1545, 946, 0, .06, 'top'); F.ring(1490, 892, 5, .061);
    const scr = F.glass(); F.box(1543, 838, 1547, 902, .06, WALL - .05, scr);
    basin(F, 1594, 902, 1662, 949);
    toilet(F, 1776, 852, 1798, 908, 1748, 880);

    // office (the 11'3" room): long desk on the left wall with the computer, display, amp and speakers; printer in the corner; panels behind the door
    box(1141, 1290, 1214, 1590, .72, .76, 'top'); box(1141, 1290, 1214, 1297, 0, .72); box(1141, 1583, 1214, 1590, 0, .72);
    box(1150, 1430, 1175, 1460, .76, .775); box(1152, 1438, 1158, 1452, .775, .8); box(1155, 1385, 1163, 1505, .8, 1.04);
    cyl(1255, 1445, 24, 0, .06); cyl(1255, 1445, 3, .06, .42); box(1230, 1415, 1280, 1475, .42, .48, 'soft'); box(1282, 1415, 1290, 1475, .48, .86, 'soft');
    fixture(F, 'office-display', () => {
      const m = F.lit();
      box(1146, 1330, 1162, 1362, .76, .88); box(1162, 1332, 1163.5, 1360, .78, .87, m);
      return { mats: [m], pools: [[1210, 1346, .9, .3]], at: [1155, 1346, .94] };
    });
    fixture(F, 'amp', () => {
      const m = F.lit();
      box(1146, 1550, 1196, 1582, .76, .84); box(1196, 1556, 1197.5, 1572, .79, .81, m); box(1196, 1575, 1197.5, 1579, .79, .805, m);
      box(1146, 1298, 1176, 1325, .76, .98); box(1146, 1515, 1176, 1542, .76, .98);
      for (const cy of [1311.5, 1528.5]) for (const [hh, r] of [[.9, 7], [.8, 4]]) {
        const P = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2; P.push([1176.4, cy + r * Math.cos(a), hh + r * S * Math.sin(a)]); }
        F.seg(P);
      }
      return { mats: [m], at: [1170, 1566, .9] };
    });
    printer(F, 1146, 1162);
    fixture(F, 'panels', () => {
      const m = F.lit(), pts = [], r = 11;
      for (let i = 0; i < 6; i++) {   // a zig-zag column of six
        const cy = 1200 + (i % 2) * 1.5 * r, hh = .22 + i * Math.sqrt(3) / 2 * r * S;
        F.hex(cy, hh, r * .93, 1416, m); pts.push(F.v(1412, cy, hh));
      }
      return { mats: [m], glow: F.glow(pts, .28), pools: [[1355, 1215, 1.8, 1]], light: [1385, 1215, .45, 5], at: [1408, 1208, .76] };
    });
    // tower fan in the corner by the window: a round base with the loop on top, facing the desk; the loop glows while it runs
    fixture(F, 'fan', () => {
      const m = F.lit(), cx = 1388, cy = 1612, w = 11, r = w * S, P = [];
      cyl(cx, cy, 15, 0, .4, 'body', 13);
      const arc = (hc, a0) => { for (let i = 0; i <= 8; i++) { const a = a0 + i / 8 * Math.PI; P.push([cx, cy + w * Math.cos(a), hc + r * Math.sin(a)]); } };
      arc(1 - r, 0); arc(.4 + r, Math.PI); P.push(P[0]);
      F.tube(P, 2.5, m);
      return { mats: [m], glow: F.glow([F.v(cx, cy, .7)], .3), at: [cx, cy, 1.06] };
    });

    // children's bedroom (the 10'2" room): bed in the corner, head against the en-suite wall; drawers beside it on that wall; small desk on the office wall
    bed(F, 1671, 965, 1798, 1248, 1, 't');
    box(1593, 965, 1667, 1017, 0, .7);
    for (const h of [.24, .47]) F.seg([[1593, 1017.4, h], [1667, 1017.4, h]]);
    table(F, 1432, 1230, 1492, 1340, .62); stool(F, 1512, 1285, .44);
  }

  // ── build ──
  const floors = PLAN.map(makeFloor);
  for (const d of DEVICES) {
    const F = floors[d.floor];
    F.rooms[d.room].devs.push(d);
    if (d.light) {
      const [px, py, h, I] = d.light, pl = new THREE.PointLight(accent, 0, 3.2, 2);
      pl.userData = { F, local: F.v(px, py, h), I }; scene.add(pl); d.pl = pl; pls.push(pl);
    }
  }
  // framing box shared by both floors, so they line up when you switch
  const BOUNDS = (() => { const F = floors[0], c = []; for (const px of [4, 706]) for (const py of [40, 1662]) for (const h of [-.15, 1.25]) c.push(F.v(px, py, h)); return c; })();

  // ── device state ──
  const avail = d => !['unavailable', 'unknown'].includes(st(d.id).state);
  const readonly = d => d.kind === 'sensor';
  function isOn(d) {
    const s = st(d.id).state;
    if (d.kind === 'vacuum') return s === 'cleaning';
    return !['off', 'unavailable', 'unknown', 'standby', 'none'].includes(s);
  }
  function level(d) { const b = st(d.id).attributes.brightness; return d.kind === 'light' && b != null ? .35 + .65 * b / 255 : 1; }
  const nice = s => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
  function stateText(d) {
    const s = st(d.id), a = s.attributes, dom = d.kind;
    if (!avail(d)) return 'Unavailable';
    const temp = a.temperature != null && !isNaN(a.temperature) ? ` · ${a.temperature}°` : '';
    if (dom === 'light') {
      const t = s.state === 'on' ? (a.brightness != null ? Math.round(a.brightness / 2.55) + '%' : 'On') : 'Off';
      return a.status ? `Light ${t.toLowerCase()} · ${nice(a.status)}${temp}` : t;
    }
    if (dom === 'sensor') return (s.state === 'on' ? 'Motion' : 'Clear') + temp;
    if (dom === 'fan') return (s.state === 'on' && a.percentage != null ? `${a.percentage}%` : nice(s.state)) + temp;
    if (dom === 'media') return nice(s.state) + (a.media_title ? ` · ${a.media_title}${a.media_artist ? ' – ' + a.media_artist : ''}` : '');
    return nice(s.state);
  }

  // 3D side of a device: lit parts, glow, pool, point light
  function light3D(d) {
    const F = floors[d.floor], dark = theme === 'dark', on = isOn(d), k = on ? level(d) : 0;
    d.k = k;
    for (const m of d.mats || []) {
      if (dark) { m.color.set(T().lamp); m.emissiveIntensity = k * 1.5; }
      else { if (on) m.color.copy(accent); else m.color.set(T().lamp); m.emissiveIntensity = on ? .2 : 0; }
    }
    if (d.glow) { d.glow.visible = k > 0; d.glow.material.uniforms.intensity.value = k * F.fade * (dark ? 1 : .8); }
    if (d.pl) d.pl.intensity = dark && F.g.visible ? k * d.pl.userData.I * F.fade : 0;
    paintRoom3D(F, d.room);
    invalidate();
  }
  function paintRoom3D(F, id) {
    const R = F.rooms[id], L = R.mat.uniforms.L.value;
    let i = 0, lit = 0;
    for (const d of R.devs) {
      for (const [px, py, r, k] of d.pools || []) if (i < L.length) L[i++].set(F.x(px), F.z(py), r, (d.k || 0) * k);
      if (d.kind === 'light') lit = Math.max(lit, d.k || 0);
    }
    for (; i < L.length; i++) L[i].w = 0;
    for (const g of R.glass) g.emissiveIntensity = theme === 'dark' ? lit * .8 : 0;
  }

  // ── overlay: room labels and device chips, placed over the 3D scene every frame ──
  const overlay = $('#overlay'), pins = [];
  for (const F of floors) for (const r of Object.values(F.rooms)) {
    const el = document.createElement('div'); el.className = 'room';
    el.innerHTML = `<b></b><span></span>`; el.querySelector('b').textContent = r.name;
    overlay.append(el); r.el = el;
    pins.push({ el, F, at: F.v(r.label[0], r.label[1], .05) });
  }
  for (const d of DEVICES) {
    const F = floors[d.floor], el = document.createElement('button');
    el.className = 'chip'; el.type = 'button'; el.dataset.name = d.name;
    el.innerHTML = `${svg(d.icon)}<span class="t"></span>`;
    el.addEventListener('click', () => toggle(d));
    overlay.append(el); d.chip = el;
    pins.push({ el, F, at: d.at ? F.v(...d.at) : null, follow: d.vac, chip: true, left: d.align === 'left' });
  }
  const pv = new THREE.Vector3();
  function place() {
    const W = innerWidth, H = innerHeight, shown = [];
    for (const p of pins) {
      const on = p.F.g.visible;
      p.el.style.display = on ? '' : 'none';
      if (!on) continue;
      if (p.follow) pv.set(p.follow.position.x, .26, p.follow.position.z); else pv.copy(p.at);
      pv.applyMatrix4(p.F.g.matrixWorld).project(camera);
      p.x = (pv.x + 1) / 2 * W; p.y = (1 - pv.y) / 2 * H - (p.follow ? 24 : 0);
      p.el.style.opacity = p.F.fade;
      shown.push(p);
    }
    // a left-aligned chip keeps its icon on the point and grows to the right as its text appears
    for (const p of shown) { p.w = p.el.offsetWidth; p.h = p.el.offsetHeight; if (p.left) p.x += (p.w - p.h) / 2; }
    // a chip steps below an earlier chip it would cover, and a room label below any chip
    const chips = shown.filter(p => p.chip), hit = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + 2;
    const settle = (p, others) => { for (let n = 0; n < 3; n++) { const c = others.find(c => c !== p && hit(c, p)); if (!c) break; p.y = c.y + (c.h + p.h) / 2 + 4; } };
    chips.forEach((p, i) => settle(p, chips.slice(0, i)));
    for (const p of shown) if (!p.chip) settle(p, chips);
    for (const p of shown) p.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
  }

  // ── drawer ──
  const list = $('#list');
  for (const F of floors) {
    const sec = document.createElement('div'); sec.className = 'dsec';
    sec.innerHTML = `<h3 class="floor-h">${F.def.name}</h3>`;
    for (const R of Object.values(F.rooms)) {
      if (!R.devs.length) continue;
      const head = document.createElement('div'); head.className = 'room-h';
      const name = document.createElement('button'); name.className = 'rname'; name.type = 'button'; name.textContent = R.name;
      name.addEventListener('click', () => showRoom(F, R));
      head.append(name);
      if (R.devs.some(d => d.kind === 'light')) {
        const sw = document.createElement('button'); sw.className = 'sw'; sw.type = 'button'; sw.setAttribute('role', 'switch');
        sw.setAttribute('aria-label', `All ${R.name} lights`);
        sw.addEventListener('click', () => roomLights(R, sw.getAttribute('aria-checked') !== 'true'));
        head.append(sw); R.sw = sw;
      }
      sec.append(head);
      for (const d of R.devs) {
        const row = document.createElement('div'); row.className = 'row';
        row.innerHTML = `<span class="ico">${svg(d.icon)}</span><span class="nm"></span>`;
        row.querySelector('.nm').innerHTML = '<span></span><small></small>';
        row.querySelector('.nm span').textContent = d.name;
        if (!readonly(d)) {
          const sw = document.createElement('button'); sw.className = 'sw'; sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-label', d.name);
          sw.addEventListener('click', () => toggle(d));
          row.append(sw); d.sw = sw;
        }
        sec.append(row); d.row = row;
      }
    }
    list.append(sec);
  }

  function paint(d) {
    light3D(d);
    const on = isOn(d), ok = avail(d), text = stateText(d), dom = d.kind;
    d.chip.classList.toggle('on', on); d.chip.classList.toggle('na', !ok); d.chip.classList.toggle('ro', readonly(d));
    d.chip.disabled = !ok || readonly(d);
    d.chip.setAttribute('aria-label', `${d.name}: ${text}`);
    if (!readonly(d)) d.chip.setAttribute('aria-pressed', on);
    d.chip.querySelector('.t').textContent = dom !== 'light' && d.text !== false && (on || dom === 'vacuum') ? `${d.short || d.name} ${st(d.id).state}` : '';
    d.row.classList.toggle('on', on); d.row.classList.toggle('na', !ok);
    d.row.querySelector('small').textContent = text;
    if (d.sw) { d.sw.setAttribute('aria-checked', on); d.sw.disabled = !ok; }
    paintRoomLabel(floors[d.floor].rooms[d.room]);
  }
  function paintRoomLabel(R) {
    const lights = R.devs.filter(d => d.kind === 'light' && avail(d)), on = lights.filter(isOn).length;
    let s = '';
    if (lights.length) s = on ? `${on} of ${lights.length} light${lights.length > 1 ? 's' : ''} on` : 'Lights off';
    else {
      const on = R.devs.filter(d => isOn(d) && !readonly(d)), sensor = R.devs.find(d => readonly(d) && avail(d));
      s = on.length ? on.map(d => `${d.short || d.name} ${st(d.id).state}`).join(' · ') : sensor ? stateText(sensor) : '';
    }
    if (R.note) s += (s ? ' · ' : '') + R.note;
    R.el.querySelector('span').textContent = s;
    if (R.sw) { R.sw.setAttribute('aria-checked', on > 0); R.sw.disabled = !lights.length; }
  }
  function showRoom(F, R) {
    goFloor(F.index);
    R.el.classList.add('flash'); setTimeout(() => R.el.classList.remove('flash'), 1600);
    setDrawer(false);
  }

  // ── actions: the same functions for chips, 3D clicks, the drawer and Day/Night ──
  function setLocal(id, state, attrs = {}) { applyState({ id, state, attributes: { ...st(id).attributes, ...attrs } }); }
  function applyState(s) { if (!DEV[s.id]) return; states[s.id] = s; paint(DEV[s.id]); }
  function setNote(room, text) { for (const F of floors) if (F.rooms[room]) { F.rooms[room].note = text; paintRoomLabel(F.rooms[room]); } }
  function toggle(d) {
    if (readonly(d) || !avail(d)) return;
    const on = !isOn(d), dom = d.kind;
    api.remote?.([d], on);
    if (dom === 'vacuum') setLocal(d.id, on ? 'cleaning' : 'returning');
    else setLocal(d.id, on ? 'on' : 'off', on && dom === 'light' && st(d.id).attributes.brightness == null ? { brightness: 255 } : {});
  }
  function setLights(devs, on) {
    const lights = devs.filter(d => d.kind === 'light' && avail(d) && isOn(d) !== on);
    if (!lights.length) return;
    api.remote?.(lights, on);
    for (const { id } of lights) setLocal(id, on ? 'on' : 'off', on && st(id).attributes.brightness == null ? { brightness: 255 } : {});
  }
  const roomLights = (R, on) => setLights(R.devs, on);
  const allLights = on => setLights(DEVICES, on);

  // ── views: plan (top-down) and 3D (true isometric), floors, Day / Night / Auto ──
  const ISO = Math.acos(1 / Math.sqrt(3)), TOP = 1e-4;
  let view = 'plan', cur = 0, mode = store.get('mode', 'auto');   // always opens on the ground-floor plan
  const wide = () => innerWidth > innerHeight * 1.05;
  // plan: turned to landscape on wide screens; 3D: isometric elevation, turned so the long side of the house runs across the screen
  const angles = v => wide() ? [v === 'plan' ? Math.PI / 2 : Math.PI / 3, v === 'plan' ? TOP : ISO] : [v === 'plan' ? 0 : .22, v === 'plan' ? TOP : ISO];
  const tmp = new THREE.Object3D();
  function frameFor(v) {
    const [th, ph] = angles(v), sy = v === 'plan' ? FLAT : 1;
    tmp.position.setFromSphericalCoords(60, ph, th); tmp.up.set(0, 1, 0); tmp.lookAt(0, 0, 0); tmp.updateMatrixWorld();
    const inv = tmp.matrixWorld.clone().invert(), q = new THREE.Vector3();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of BOUNDS) { q.copy(c); q.y *= sy; q.applyMatrix4(inv); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const top = 84, bot = $('#bar').offsetHeight + 34, side = 24;
    const w = innerWidth - side * 2, h = innerHeight - top - bot;
    const zoom = Math.min(w / (x1 - x0), h / (y1 - y0)) * .96, ay = (top - bot) / 2;
    const right = new THREE.Vector3().setFromMatrixColumn(tmp.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(tmp.matrixWorld, 1);
    const target = new THREE.Vector3().addScaledVector(right, (x0 + x1) / 2).addScaledVector(up, (y0 + y1) / 2 + ay / zoom);
    return { th, ph, zoom, target, sy };
  }
  function setControls() {
    const plan = view === 'plan';
    controls.enableRotate = !plan;
    controls.minPolarAngle = plan ? 0 : .2; controls.maxPolarAngle = plan ? Math.PI : 1.25;
    controls.mouseButtons = { LEFT: plan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: plan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    $('#hint').textContent = `${plan ? 'drag to pan' : 'drag to orbit · right-drag to pan'} · scroll to zoom`;
  }
  let camTween = null;
  function setView(v, instant) {
    view = v; syncUI();
    if (controls.enabled) { controls.enableDamping = false; controls.update(); controls.enableDamping = true; }   // drop leftover orbit momentum
    const off = new THREE.Vector3(), tg = new THREE.Vector3(), sph = new THREE.Spherical().setFromVector3(off.subVectors(camera.position, controls.target));
    const to = frameFor(v), from = { th: sph.theta, ph: sph.phi, zoom: camera.zoom, target: controls.target.clone(), sy: floors[0].g.scale.y };
    const dth = Math.atan2(Math.sin(to.th - from.th), Math.cos(to.th - from.th));
    controls.enabled = false; controls.minZoom = to.zoom * .5; controls.maxZoom = to.zoom * 6;
    if (camTween) cancel(camTween);
    camTween = tween(instant || RM ? 0 : 950, t => {
      const e = ease(t);
      tg.lerpVectors(from.target, to.target, e);
      camera.position.copy(tg).add(off.setFromSphericalCoords(60, from.ph + (to.ph - from.ph) * e, from.th + dth * e));
      camera.lookAt(tg); controls.target.copy(tg);
      camera.zoom = from.zoom * Math.pow(to.zoom / from.zoom, e); camera.updateProjectionMatrix();
      for (const F of floors) F.g.scale.y = from.sy + (to.sy - from.sy) * e;
    }, () => { camTween = null; setControls(); controls.enabled = true; controls.update(); });
  }
  let floorTween = null;
  function goFloor(n) {
    if (n === cur || !floors[n]) return;
    if (floorTween) finish(floorTween);
    const A = floors[cur], B = floors[n], dir = n > cur ? 1 : -1;
    cur = n; syncUI();
    B.g.visible = true; setFade(B, 0);
    floorTween = tween(RM ? 0 : 700, t => {
      const e = ease(t);
      A.g.position.y = -dir * 1.6 * e; B.g.position.y = dir * 1.6 * (1 - e);
      setFade(A, 1 - e); setFade(B, e);
    }, () => { floorTween = null; A.g.visible = false; A.g.position.y = 0; setFade(A, 1); });
  }
  function setFade(F, f) {
    F.fade = f;
    for (const m of F.mats) {
      if (m.uniforms?.fade) m.uniforms.fade.value = f; else m.opacity = f * (m.userData.op ?? 1);
      m.transparent = f < 1 || m.userData.op < 1;
    }
    for (const d of DEVICES) if (d.floor === F.index) light3D(d);
  }

  const isNight = () => api.night ?? (h => h < 7 || h >= 19)(new Date().getHours());
  let lastNight;
  // a mode sets the theme and switches the page's lights; while an integration is live (api.live) it only sets the theme,
  // so only manual switches touch real devices. Auto acts on an actual sunset or sunrise, never on page load.
  function setMode(m, user) {
    mode = m; store.set('mode', m);
    const night = m === 'night' || (m === 'auto' && isNight());
    lastNight = isNight();
    setTheme(night ? 'dark' : 'light');
    if (user && !api.live) allLights(night);
    syncUI();
  }
  // pick up a new idea of night (e.g. from an integration) without switching any lights
  function resync() { lastNight = isNight(); if (mode === 'auto') setTheme(lastNight ? 'dark' : 'light'); }
  function autoCheck() {
    const n = isNight();
    if (n === lastNight) return;
    lastNight = n;
    if (mode === 'auto') { setTheme(n ? 'dark' : 'light'); if (!api.live) allLights(n); }
  }
  function setTheme(t) {
    theme = t; document.documentElement.dataset.theme = t;
    const C = THEMES[t];
    scene.background = new THREE.Color(C.bg);
    for (const m of glowMats) { m.uniforms.day.value = +(t === 'light'); m.blending = t === 'light' ? THREE.NormalBlending : THREE.AdditiveBlending; }
    hemi.color.set(C.sky); hemi.groundColor.set(C.ground); hemi.intensity = C.hemi; amb.intensity = C.amb; sun.intensity = C.sun;
    for (const F of floors) {
      for (const [role, m] of Object.entries(F.roles)) m.color.set(C[role]);
      for (const m of F.mats) if (m.uniforms?.base) { m.uniforms.base.value.set(m.userData.outside ? C.out : C.floor); m.uniforms.day.value = +(t === 'light'); }
      for (const m of F.lits) if (m.userData.glass) m.color.set(C.glass);
      for (const m of F.mats) if (m.userData.mix != null) m.color.set(C.top).lerp(new THREE.Color(C.bg), m.userData.mix);
    }
    DEVICES.forEach(light3D);
  }
  function setAccent(i) {
    const [, hex] = PALETTE[i] || PALETTE[0];
    accent.set(hex); store.set('accent', i);
    document.documentElement.style.setProperty('--accent', hex);
    for (const F of floors) for (const m of F.lits) m.emissive.copy(accent);
    for (const pl of pls) pl.color.copy(accent);
    document.querySelectorAll('#swatches button').forEach((b, j) => b.setAttribute('aria-checked', i === j));
    DEVICES.forEach(light3D);
  }

  function syncUI() {
    $('#floorname').textContent = floors[cur].def.name;
    $('#down').disabled = cur === 0; $('#up').disabled = cur === floors.length - 1;
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-checked', b.dataset.view === view));
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-checked', b.dataset.mode === mode));
  }
  function setDrawer(open) {
    const dr = $('#drawer');
    dr.classList.toggle('open', open); dr.inert = !open;
    $('#menu').setAttribute('aria-expanded', open);
    if (open) $('#close').focus(); else if (dr.contains(document.activeElement)) $('#menu').focus();
  }

  // ── header clock ──
  function clock() {
    const now = new Date();
    $('#time').textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    $('#date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // ── tweens and the render loop (renders only while something changes) ──
  const tweens = [];
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function tween(ms, fn, done) {
    const tw = { t0: performance.now(), ms, fn, done };
    if (ms <= 0) { fn(1); done?.(); return null; }
    tweens.push(tw); invalidate(); return tw;
  }
  function cancel(tw) { const i = tweens.indexOf(tw); if (i >= 0) tweens.splice(i, 1); }
  function finish(tw) { cancel(tw); tw.fn(1); tw.done?.(); }
  let dirty = true;
  function invalidate() { dirty = true; }
  controls.addEventListener('change', invalidate);

  // the robot vacuum drives a loop of the kitchen floor while cleaning, then back to its dock
  const PATH = [[640, 640], [640, 598], [140, 598], [140, 650], [450, 650], DOCK];
  const vacState = { pos: [...DOCK], i: 0, last: 0 };
  function tickVac(now) {
    const d = DEV['robovac'], s = st(d.id).state, dt = Math.min(.05, (now - (vacState.last || now)) / 1000);
    vacState.last = now;
    const p = vacState.pos, home = Math.hypot(p[0] - DOCK[0], p[1] - DOCK[1]) < 1;
    if (home && s !== 'cleaning') { if (s === 'returning' && !api.live) setLocal(d.id, 'docked'); return false; }
    const goal = s === 'cleaning' ? PATH[vacState.i] : DOCK;
    const dx = goal[0] - p[0], dy = goal[1] - p[1], len = Math.hypot(dx, dy), step = 70 * dt;
    if (len <= step) {
      p[0] = goal[0]; p[1] = goal[1];
      if (s === 'cleaning') vacState.i = (vacState.i + 1) % PATH.length;
    } else { p[0] += dx / len * step; p[1] += dy / len * step; d.vac.rotation.y = -Math.atan2(dy, dx); }
    d.vac.position.copy(floors[0].v(p[0], p[1], 0));
    return true;
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  // the nearest thing under the pointer: a device id or a door
  function pick(e) {
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const u = ray.intersectObject(floors[cur].g, true)[0]?.object.userData || {};
    return { dev: u.dev && DEV[u.dev], door: u.door };
  }
  function swing(door) {
    door.open = !door.open;
    const from = door.g.rotation.y, to = -(door.open ? door.a1 : door.a0) * Math.PI / 180;
    tween(RM ? 0 : 450, t => { door.g.rotation.y = from + (to - from) * ease(t); });
  }

  // dollhouse cut-away: in 3D, outer walls on the camera's side drop low so every room stays visible as you orbit
  const cam2 = new THREE.Vector2();
  function cutaway(dt) {
    cam2.set(camera.position.x - controls.target.x, camera.position.z - controls.target.z).normalize();
    let moving = false;
    for (const F of floors) for (const c of F.cut) {
      const want = view === 'iso' && c.n[0] * cam2.x + c.n[1] * cam2.y > .2 ? LOW / WALL : 1, y = c.g.scale.y;
      if (y === want) continue;
      const next = y + (want - y) * Math.min(1, dt * 8);
      c.g.scale.y = Math.abs(next - want) < .003 ? want : next; moving = true;
    }
    return moving;
  }
  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - (last || now)) / 1000); last = now;
    for (const tw of [...tweens]) { const t = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(t); if (t >= 1) { cancel(tw); tw.done?.(); } }
    if (controls.enabled) controls.update();
    const moving = tickVac(now) | cutaway(RM ? 1 : dt);
    if (!dirty && !tweens.length && !moving) return;
    dirty = false;
    const px = camera.zoom * renderer.getPixelRatio();
    for (const m of glowMats) m.uniforms.px.value = Math.min(m.userData.size * px, 480);
    for (const pl of pls) pl.position.copy(pl.userData.local).applyMatrix4(pl.userData.F.g.matrixWorld);
    renderer.render(scene, camera);
    place();
  }

  // ── wiring ──
  $('#menu').innerHTML = svg('menu'); $('#close').innerHTML = svg('close');
  $('#up').innerHTML = svg('up'); $('#down').innerHTML = svg('down');
  $('#menu').addEventListener('click', () => setDrawer(!$('#drawer').classList.contains('open')));
  $('#close').addEventListener('click', () => setDrawer(false));
  document.addEventListener('pointerdown', e => { if ($('#drawer').classList.contains('open') && !e.target.closest('#drawer, #menu')) setDrawer(false); });
  $('#up').addEventListener('click', () => goFloor(cur + 1));
  $('#down').addEventListener('click', () => goFloor(cur - 1));
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode, true)));
  document.querySelectorAll('[data-all]').forEach(b => b.addEventListener('click', () => allLights(b.dataset.all === '1')));
  PALETTE.forEach(([name, hex], i) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', name); b.title = name;
    b.style.setProperty('--sw', hex); b.innerHTML = '<i></i>'; b.addEventListener('click', () => setAccent(i));
    $('#swatches').append(b);
  });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') return setDrawer(false);
    if (e.target.closest('input, textarea, #drawer') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'pageup') { goFloor(cur + 1); e.preventDefault(); }
    else if (k === 'arrowdown' || k === 'pagedown') { goFloor(cur - 1); e.preventDefault(); }
    else if (k === 'v') setView(view === 'plan' ? 'iso' : 'plan');
    else if (k === 'd') setDrawer(!$('#drawer').classList.contains('open'));
  });
  let down = null, hover = null;
  const cv = renderer.domElement;
  cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  cv.addEventListener('pointerup', e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 600) { const { dev, door } = pick(e); if (dev) toggle(dev); else if (door) swing(door); }
    down = null;
  });
  cv.addEventListener('pointermove', e => {
    if (e.buttons) return;
    if (!hover) requestAnimationFrame(() => { const { dev, door } = pick(hover); cv.style.cursor = door || dev && avail(dev) && !readonly(dev) ? 'pointer' : ''; hover = null; });
    hover = e;
  });
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    Object.assign(camera, { left: -innerWidth / 2, right: innerWidth / 2, top: innerHeight / 2, bottom: -innerHeight / 2 });
    for (const m of lineMats) m.resolution.copy(res());
    setView(view, true);
  });

  // ── start ──
  setAccent(store.get('accent', 0));
  setMode(mode, false);
  floors[cur].g.visible = true;
  camera.position.set(0, 60, 0.001); controls.target.set(0, 0, 0);
  for (const F of floors) F.g.scale.y = view === 'plan' ? FLAT : 1;
  { const f = frameFor(view); camera.zoom = f.zoom; camera.updateProjectionMatrix(); }
  setView(view, true);
  DEVICES.forEach(paint);
  clock(); setInterval(clock, 15000); setInterval(autoCheck, 60000);
  $('#load').remove();
  requestAnimationFrame(frame);
  Object.assign(api, { DEVICES, DEV, states, floors, applyState, setNote, autoCheck, resync, setView, goFloor, setMode, setAccent, toggle, allLights, camera, controls });
  document.dispatchEvent(new Event('floorplan:ready'));
})();
