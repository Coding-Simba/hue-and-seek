import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createKit(THREE) {
  const geometryCache = new Map();
  const materialCache = new Map();
  const textureCache = new Map();
  const loader = new THREE.TextureLoader();
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const colorHex = (value, fallback = 0xffffff) => {
    if (value == null) return fallback;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value.startsWith('#') ? Number.parseInt(value.slice(1), 16) : Number.parseInt(value, 16);
    return fallback;
  };
  const rounded = (v) => Number(v.toFixed(3));

  function cachedGeometry(key, make) {
    if (!geometryCache.has(key)) geometryCache.set(key, make());
    return geometryCache.get(key);
  }

  function texture(name) {
    if (!textureCache.has(name)) {
      const tex = loader.load(`assets/kit/${name}.webp`);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      textureCache.set(name, tex);
    }
    return textureCache.get(name);
  }

  function mat(name, color, textureName = null) {
    const hex = colorHex(color);
    const key = `${name}:${hex}:${textureName || ''}`;
    if (!materialCache.has(key)) {
      materialCache.set(key, new THREE.MeshLambertMaterial({
        color: hex,
        map: textureName ? texture(textureName) : null,
      }));
    }
    return materialCache.get(key);
  }

  function box(w, h, d, r = 0.07, smoothness = 2) {
    const radius = clamp(r, 0.005, Math.min(w, h, d) * 0.46);
    const key = `rounded:${rounded(w)}:${rounded(h)}:${rounded(d)}:${rounded(radius)}:${smoothness}`;
    return cachedGeometry(key, () => new RoundedBoxGeometry(w, h, d, smoothness, radius));
  }
  function cylinder(rt, rb, h, segments = 12, open = false) {
    const key = `cylinder:${rounded(rt)}:${rounded(rb)}:${rounded(h)}:${segments}:${open ? 1 : 0}`;
    return cachedGeometry(key, () => new THREE.CylinderGeometry(rt, rb, h, segments, 1, open));
  }
  function sphere(r = 0.2, width = 12, height = 8) {
    const key = `sphere:${rounded(r)}:${width}:${height}`;
    return cachedGeometry(key, () => new THREE.SphereGeometry(r, width, height));
  }
  function torus(r, tube, radial = 8, tubular = 16) {
    const key = `torus:${rounded(r)}:${rounded(tube)}:${radial}:${tubular}`;
    return cachedGeometry(key, () => new THREE.TorusGeometry(r, tube, radial, tubular));
  }
  function lathe(points, segments = 14) {
    const key = `lathe:${segments}:${points.map((p) => `${rounded(p[0])},${rounded(p[1])}`).join(';')}`;
    return cachedGeometry(key, () => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments));
  }
  function plane(w, h) {
    const key = `plane:${rounded(w)}:${rounded(h)}`;
    return cachedGeometry(key, () => new THREE.PlaneGeometry(w, h));
  }
  function tube(points, radius = 0.025, tubularSegments = 12, radialSegments = 5) {
    const key = `tube:${rounded(radius)}:${tubularSegments}:${radialSegments}:${points.map((p) => p.map(rounded).join(',')).join(';')}`;
    return cachedGeometry(key, () => {
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
      return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
    });
  }
  function gable(w, h, rise, d) {
    const key = `gable:${rounded(w)}:${rounded(h)}:${rounded(rise)}:${rounded(d)}`;
    return cachedGeometry(key, () => {
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, 0);
      shape.lineTo(w / 2, 0);
      shape.lineTo(0, rise);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: d,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.025,
        bevelThickness: 0.025,
      });
      geo.translate(0, h, -d / 2);
      return geo;
    });
  }

  function put(group, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function roundedMesh(group, w, h, d, material, position, rotation = [0, 0, 0], radius = 0.06) {
    return put(group, box(w, h, d, radius), material, position, rotation);
  }
  function stick(group, start, end, radius, material, topRadius = radius, segments = 8) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    const length = direction.length();
    const mesh = put(group, cylinder(topRadius, radius, 1, segments), material, a.clone().add(b).multiplyScalar(0.5).toArray());
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.scale.y = length;
    return mesh;
  }
  function addNail(group, x, y, z, material = metalDark) {
    put(group, sphere(0.018, 8, 5), material, [x, y, z], [0, 0, 0], [1, 0.75, 1]);
  }
  function newGroup() { return new THREE.Group(); }

  const materials = {
    woodDark: mat('woodDark', 0x805738, 'wood_planks_dark'),
    woodLight: mat('woodLight', 0xb88755, 'wood_light'),
    woodWarm: mat('woodWarm', 0x946441, 'wood_light'),
    bark: mat('bark', 0x745139, 'bark'),
    leaves: mat('leaves', 0x548444, 'leaves'),
    leafLight: mat('leafLight', 0x7fa74f, 'leaves'),
    leafDeep: mat('leafDeep', 0x3d703e, 'leaves'),
    ivy: mat('ivy', 0x477a42, 'leaves'),
    leafSun: mat('leafSun', 0x97b95a, 'leaves'),
    burlap: mat('burlap', 0xc4a56f, 'burlap'),
    terracotta: mat('terracotta', 0xc66d48, 'terracotta'),
    paintedMetal: mat('paintedMetal', 0x6f91a0, 'painted_metal'),
    metalDark: mat('metalDark', 0x575c55, 'painted_metal'),
    hay: mat('hay', 0xd7bd69, 'hay'),
    hayLight: mat('hayLight', 0xe8d58e, 'hay'),
    stone: mat('stone', 0xb9aa89, 'stone'),
    stoneLight: mat('stoneLight', 0xd2c29d, 'stone'),
    stoneDark: mat('stoneDark', 0x8c8973, 'stone'),
    plaster: mat('plaster', 0xf0dfbb, 'plaster'),
    roof: mat('roof', 0x9f4938, 'roof_tiles'),
    roofLight: mat('roofLight', 0xb96347, 'roof_tiles'),
    slate: mat('slate', 0x6e8692, 'roof_tiles'),
    thatch: mat('thatch', 0xd8b85f, 'thatch'),
    soil: mat('soil', 0x654a32),
    glass: mat('glass', 0xb8d7d0),
    glassWarm: mat('glassWarm', 0xf4d985),
    flowerPink: mat('flowerPink', 0xe98a91),
    flowerYellow: mat('flowerYellow', 0xf0c85d),
    flowerCream: mat('flowerCream', 0xffedc1),
    flowerPurple: mat('flowerPurple', 0x9b78b3),
    tomato: mat('tomato', 0xd75d48),
    pumpkin: mat('pumpkin', 0xd88235, 'terracotta'),
    greenVeg: mat('greenVeg', 0x71944a, 'leaves'),
    redPaint: mat('redPaint', 0xb84e3d, 'wood_light'),
  };

  const woodDark = materials.woodDark;
  const woodLight = materials.woodLight;
  const woodWarm = materials.woodWarm;
  const metalDark = materials.metalDark;

  function addLeaf(group, material, position, scale) {
    return put(group, sphere(0.2, 10, 7), material, position, [0, 0, 0], scale);
  }
  function addFlower(group, x, y, z, hexColor = 0xe98a91, size = 0.1, stemHeight = 0.3) {
    const petalMat = mat(`flower-${colorHex(hexColor)}`, colorHex(hexColor));
    const centerMat = hexColor === 0xf0c85d ? materials.flowerCream : materials.flowerYellow;
    stick(group, [x, Math.max(0.02, y), z], [x + 0.015, stemHeight, z], 0.018, materials.leafDeep, 0.012, 6);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      put(group, sphere(size * 0.55, 6, 5), petalMat,
        [x + Math.cos(angle) * size * 0.65, stemHeight + Math.sin(angle) * size * 0.25, z + Math.sin(angle) * size * 0.65],
        [0, angle, 0], [1.1, 0.82, 0.82]);
    }
    put(group, sphere(size * 0.32, 6, 5), centerMat, [x, stemHeight + 0.015, z]);
    addLeaf(group, materials.leafLight, [x + 0.07, y + (stemHeight - y) * 0.48, z], [0.55, 0.2, 0.28]);
  }

  function barrel(g) {
    put(g, lathe([[0.27, 0.03], [0.33, 0.07], [0.37, 0.25], [0.39, 0.5], [0.37, 0.77], [0.32, 1.0], [0.29, 1.03]], 16), woodDark);
    [0.14, 0.47, 0.83].forEach((y) => put(g, torus(0.36, 0.032, 7, 18), metalDark, [0, y, 0], [Math.PI / 2, 0, 0]));
    put(g, cylinder(0.3, 0.31, 0.065, 16), woodWarm, [0, 1.015, 0]);
    for (let i = -2; i <= 2; i++) roundedMesh(g, 0.115, 0.025, 0.54, woodLight, [i * 0.115, 1.054, 0], [0, 0, 0], 0.012);
    for (const y of [0.14, 0.47, 0.83]) for (const x of [-0.2, 0, 0.2]) addNail(g, x, y, 0.365, woodLight);
    [-0.24, 0.24].forEach((x) => addNail(g, x, 1.05, 0));
  }
  function crate(g) {
    roundedMesh(g, 0.78, 0.09, 0.7, woodDark, [0, 0.06, 0], [0, 0, 0], 0.025);
    for (let row = 0; row < 2; row++) {
      const y = 0.22 + row * 0.24;
      for (let i = 0; i < 2; i++) {
        const x = (i - 0.5) * 0.33;
        roundedMesh(g, 0.32, 0.19, 0.055, i ? woodLight : woodWarm, [x, y, 0.34], [0, 0, 0], 0.025);
        roundedMesh(g, 0.32, 0.19, 0.055, woodWarm, [x, y, -0.34], [0, 0, 0], 0.025);
        roundedMesh(g, 0.055, 0.19, 0.32, i ? woodLight : woodWarm, [0.39, y, x], [0, Math.PI / 2, 0], 0.025);
        roundedMesh(g, 0.055, 0.19, 0.32, woodWarm, [-0.39, y, x], [0, Math.PI / 2, 0], 0.025);
      }
    }
    for (const x of [-0.34, 0.34]) for (const z of [-0.29, 0.29]) {
      roundedMesh(g, 0.075, 0.68, 0.075, woodDark, [x, 0.36, z], [0, 0, 0], 0.022);
      addNail(g, x, 0.62, z > 0 ? 0.38 : -0.38);
    }
    stick(g, [-0.29, 0.16, 0.39], [0.29, 0.6, 0.39], 0.035, woodLight, 0.035, 6);
    stick(g, [0.29, 0.16, 0.39], [-0.29, 0.6, 0.39], 0.035, woodLight, 0.035, 6);
    for (const x of [-0.29, 0.29]) for (const y of [0.17, 0.59]) addNail(g, x, y, 0.405);
  }
  function roundHay(g) {
    put(g, cylinder(0.34, 0.34, 0.78, 14), materials.hay, [0, 0.36, 0], [0, 0, Math.PI / 2]);
    [-0.23, 0, 0.23].forEach((x) => put(g, torus(0.337, 0.018, 6, 16), materials.hayLight, [x, 0.36, 0], [0, Math.PI / 2, 0]));
    put(g, sphere(0.34, 14, 9), materials.hayLight, [0.39, 0.36, 0], [0, 0, 0], [0.14, 1, 1]);
  }
  function squareHay(g) {
    roundedMesh(g, 0.84, 0.68, 0.65, materials.hay, [0, 0.35, 0], [0, 0, -0.04], 0.18);
    for (let i = 0; i < 8; i++) {
      const x = -0.34 + i * 0.1;
      stick(g, [x, 0.06, 0.34], [x + 0.09, 0.63, 0.34], 0.008, i % 2 ? materials.hayLight : materials.hay, 0.008, 5);
    }
    roundedMesh(g, 0.81, 0.035, 0.04, materials.burlap, [0, 0.34, 0.335], [0, 0, 0], 0.015);
    roundedMesh(g, 0.04, 0.64, 0.81, materials.burlap, [0.42, 0.34, 0], [0, 0, 0], 0.014);
  }
  function milkCan(g) {
    put(g, lathe([[0.16, 0.03], [0.24, 0.07], [0.28, 0.16], [0.28, 0.43], [0.24, 0.59], [0.15, 0.66], [0.14, 0.77], [0.19, 0.8], [0.19, 0.83]], 16), materials.paintedMetal);
    put(g, cylinder(0.195, 0.195, 0.045, 14), woodLight, [0, 0.84, 0]);
    put(g, torus(0.185, 0.024, 7, 16), metalDark, [0, 0.84, 0], [Math.PI / 2, 0, 0]);
    put(g, torus(0.274, 0.018, 6, 16), materials.flowerCream, [0, 0.2, 0], [Math.PI / 2, 0, 0]);
    put(g, tube([[-0.22, 0.56, 0], [-0.31, 0.65, 0], [-0.31, 0.79, 0], [0, 0.91, 0], [0.31, 0.79, 0], [0.31, 0.65, 0], [0.22, 0.56, 0]], 0.025, 20, 6), metalDark);
    [-0.16, 0.16].forEach((x) => {
      put(g, sphere(0.035, 8, 6), woodWarm, [x, 0.61, 0]);
      put(g, sphere(0.014, 8, 5), materials.flowerCream, [x, 0.61, 0.04]);
    });
  }
  function bucket(g) {
    put(g, lathe([[0.19, 0.025], [0.22, 0.08], [0.28, 0.43], [0.3, 0.47]], 14), woodWarm);
    put(g, torus(0.29, 0.022, 6, 16), metalDark, [0, 0.46, 0], [Math.PI / 2, 0, 0]);
    put(g, torus(0.225, 0.018, 6, 16), metalDark, [0, 0.09, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI * 2 / 10;
      const x = Math.cos(a) * 0.255;
      const z = Math.sin(a) * 0.255;
      stick(g, [x * 0.9, 0.1, z * 0.9], [x, 0.4, z], 0.008, woodLight, 0.008, 5);
    }
    put(g, tube([[-0.28, 0.42, 0], [-0.31, 0.62, 0], [0, 0.76, 0], [0.31, 0.62, 0], [0.28, 0.42, 0]], 0.022, 18, 5), woodDark);
    put(g, sphere(0.035, 8, 6), woodLight, [0, 0.76, 0]);
  }
  function flowerPot(g) {
    put(g, lathe([[0.15, 0.03], [0.19, 0.08], [0.25, 0.39], [0.31, 0.48], [0.32, 0.52], [0.28, 0.54]], 16), materials.terracotta);
    put(g, cylinder(0.28, 0.28, 0.035, 16), materials.soil, [0, 0.5, 0]);
    for (let i = 0; i < 4; i++) addLeaf(g, i % 2 ? materials.leaves : materials.leafLight, [Math.cos(i * 1.6) * 0.1, 0.64 + (i % 2) * 0.04, Math.sin(i * 1.6) * 0.1], [0.48, 0.17, 0.32]);
    addFlower(g, -0.05, 0.54, 0.03, 0xe98a91, 0.08, 0.84);
    addFlower(g, 0.13, 0.53, -0.04, 0xf0c85d, 0.075, 0.78);
  }
  function wateringCan(g) {
    put(g, lathe([[0.04, 0.05], [0.21, 0.08], [0.24, 0.15], [0.24, 0.32], [0.19, 0.4], [0.07, 0.42]], 14), materials.paintedMetal, [0, 0, 0]);
    put(g, cylinder(0.1, 0.1, 0.04, 12), woodLight, [0, 0.44, 0]);
    put(g, tube([[-0.2, 0.29, -0.01], [-0.34, 0.46, -0.01], [-0.3, 0.66, -0.01], [0, 0.72, -0.01], [0.27, 0.57, -0.01], [0.21, 0.37, -0.01]], 0.028, 18, 6), materials.paintedMetal);
    stick(g, [0.19, 0.24, 0], [0.49, 0.08, 0], 0.075, materials.paintedMetal, 0.05, 10);
    put(g, lathe([[0.08, 0], [0.12, 0.03], [0.1, 0.07], [0.055, 0.09]], 12), materials.paintedMetal, [0.5, 0.075, 0], [0, 0, -Math.PI / 2]);
    put(g, sphere(0.018, 8, 5), materials.flowerCream, [0.23, 0.37, 0.2]);
  }
  function lanternPost(g) {
    put(g, cylinder(0.12, 0.17, 0.12, 10), woodDark, [0, 0.06, 0]);
    put(g, lathe([[0.065, 0.11], [0.085, 0.19], [0.06, 1.19], [0.1, 1.26]], 10), woodWarm);
    put(g, cylinder(0.28, 0.28, 0.08, 8), woodDark, [0, 1.33, 0]);
    roundedMesh(g, 0.37, 0.32, 0.37, materials.glassWarm, [0, 1.57, 0], [0, 0, 0], 0.08);
    for (const x of [-0.2, 0.2]) for (const z of [-0.2, 0.2]) roundedMesh(g, 0.045, 0.42, 0.045, woodDark, [x, 1.58, z], [0, 0, 0], 0.018);
    put(g, cylinder(0.04, 0.23, 0.2, 8), woodDark, [0, 1.83, 0]);
    put(g, sphere(0.045, 8, 6), metalDark, [0, 1.94, 0]);
    g.scale.y = 0.82;
  }
  function stool(g) {
    roundedMesh(g, 0.62, 0.14, 0.56, woodLight, [0, 0.53, 0], [0, 0, -0.02], 0.1);
    for (const x of [-0.21, 0.21]) for (const z of [-0.18, 0.18]) stick(g, [x * 1.22, 0.08, z * 1.2], [x, 0.48, z], 0.055, woodDark, 0.045, 8);
    roundedMesh(g, 0.48, 0.07, 0.42, woodWarm, [0, 0.28, 0], [0, 0, 0], 0.05);
  }
  function vegBasket(g) {
    put(g, lathe([[0.22, 0.04], [0.26, 0.08], [0.34, 0.35], [0.36, 0.4], [0.32, 0.42]], 14), woodWarm);
    put(g, torus(0.345, 0.025, 6, 18), woodLight, [0, 0.39, 0], [Math.PI / 2, 0, 0]);
    put(g, torus(0.27, 0.018, 6, 18), woodDark, [0, 0.13, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI * 2 / 12;
      const x = Math.cos(a), z = Math.sin(a);
      stick(g, [x * 0.25, 0.1, z * 0.25], [x * 0.33, 0.36, z * 0.33], 0.009, i % 2 ? woodLight : woodDark, 0.009, 5);
    }
    put(g, tube([[-0.32, 0.36, 0], [-0.29, 0.57, 0], [0, 0.73, 0], [0.29, 0.57, 0], [0.32, 0.36, 0]], 0.025, 18, 5), woodLight);
    put(g, sphere(0.14, 10, 8), materials.tomato, [-0.12, 0.48, 0.03], [0, 0, 0], [1.1, 0.75, 1]);
    put(g, sphere(0.14, 10, 8), materials.greenVeg, [0.12, 0.47, 0.04], [0.2, 0, 0], [1, 0.75, 0.9]);
    put(g, sphere(0.13, 10, 8), materials.pumpkin, [0.01, 0.51, -0.11], [0, 0, 0], [0.82, 0.85, 1]);
    addLeaf(g, materials.leafLight, [0.13, 0.58, 0.04], [0.38, 0.12, 0.24]);
    addLeaf(g, materials.leaves, [-0.12, 0.58, -0.02], [0.32, 0.12, 0.22]);
  }
  function flourSack(g) {
    put(g, lathe([[0.12, 0.02], [0.23, 0.07], [0.28, 0.25], [0.25, 0.43], [0.17, 0.56], [0.12, 0.63], [0.16, 0.68]], 14), materials.burlap);
    put(g, torus(0.145, 0.022, 6, 12), woodWarm, [0, 0.64, 0], [Math.PI / 2, 0, 0]);
    for (let i = -2; i <= 2; i++) stick(g, [i * 0.075, 0.1, 0.22], [i * 0.045, 0.51, 0.16], 0.008, materials.woodLight, 0.008, 5);
    put(g, tube([[-0.16, 0.57, 0.13], [-0.08, 0.52, 0.2], [0, 0.56, 0.22], [0.08, 0.52, 0.2], [0.16, 0.57, 0.13]], 0.014, 12, 4), woodWarm);
  }
  function pumpkin(g) {
    put(g, sphere(0.31, 14, 10), materials.pumpkin, [0, 0.31, 0], [0, 0, 0], [1.06, 0.82, 1.02]);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      put(g, sphere(0.235, 12, 8), i % 2 ? materials.pumpkin : mat('pumpkinSoft', 0xe08d3c, 'terracotta'),
        [Math.cos(a) * 0.14, 0.31, Math.sin(a) * 0.14], [0, 0, 0], [0.78, 0.88, 0.78]);
    }
    stick(g, [0, 0.54, 0], [0.035, 0.68, 0.02], 0.05, woodWarm, 0.035, 8);
    addLeaf(g, materials.leafLight, [0.11, 0.58, 0.02], [0.48, 0.12, 0.28]);
  }
  function logPile(g) {
    const logs = [
      [-0.18, 0.14, -0.13, 0.13], [0.16, 0.14, 0.13, 0.14],
      [0, 0.39, 0, 0.15], [-0.15, 0.61, 0.12, 0.14], [0.17, 0.61, -0.11, 0.14],
    ];
    logs.forEach(([x, y, z, radius], i) => {
      put(g, cylinder(radius, radius * 0.96, 0.78, 10), materials.bark, [x, y, z], [0, 0, Math.PI / 2]);
      for (const end of [-0.39, 0.39]) {
        put(g, cylinder(radius * 0.8, radius * 0.8, 0.016, 10), woodLight, [x + end, y, z], [0, 0, Math.PI / 2]);
        put(g, torus(radius * 0.49, 0.009, 5, 12), woodWarm, [x + end + (end > 0 ? 0.01 : -0.01), y, z], [0, Math.PI / 2, 0]);
      }
    });
  }
  function cartWheel(g) {
    const center = [0, 0.46, 0];
    put(g, torus(0.34, 0.052, 8, 20), woodDark, center, [0, Math.PI / 2, 0]);
    put(g, torus(0.245, 0.025, 6, 18), woodLight, center, [0, Math.PI / 2, 0]);
    put(g, cylinder(0.09, 0.09, 0.16, 10), woodWarm, center, [0, 0, Math.PI / 2]);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI * 2 / 10;
      stick(g, [0, center[1] + Math.cos(a) * 0.075, Math.sin(a) * 0.075], [0, center[1] + Math.cos(a) * 0.28, Math.sin(a) * 0.28], 0.021, woodLight, 0.018, 6);
    }
  }
  function mailbox(g) {
    put(g, cylinder(0.065, 0.085, 0.82, 10), woodDark, [0, 0.42, 0]);
    put(g, cylinder(0.15, 0.18, 0.1, 10), materials.stone, [0, 0.05, 0]);
    roundedMesh(g, 0.58, 0.4, 0.38, materials.redPaint, [0, 1.05, 0], [0, 0, 0], 0.16);
    roundedMesh(g, 0.49, 0.07, 0.045, metalDark, [0, 1.12, 0.214], [0, 0, 0], 0.025);
    roundedMesh(g, 0.29, 0.035, 0.02, materials.glassWarm, [0, 0.94, 0.215], [0, 0, 0], 0.012);
    stick(g, [0.21, 0.96, 0.02], [0.21, 1.28, 0.02], 0.018, metalDark, 0.018, 6);
    roundedMesh(g, 0.17, 0.08, 0.035, materials.flowerYellow, [0.21, 1.3, 0.03], [0, 0, -0.3], 0.025);
  }

  const props = {
    barrel: { label: 'Barrel', radius: 0.42, height: 1.1, zone: 'farm', build: () => makeProp('barrel', barrel) },
    crate: { label: 'Wooden Crate', radius: 0.55, height: 0.72, zone: 'any', build: () => makeProp('crate', crate) },
    hay_round: { label: 'Round Hay Bale', radius: 0.52, height: 0.72, zone: 'farm', build: () => makeProp('hay_round', roundHay) },
    hay_bale: { label: 'Hay Bale', radius: 0.53, height: 0.72, zone: 'farm', build: () => makeProp('hay_bale', squareHay) },
    milk_can: { label: 'Milk Can', radius: 0.35, height: 0.94, zone: 'farm', build: () => makeProp('milk_can', milkCan) },
    bucket: { label: 'Wooden Bucket', radius: 0.34, height: 0.79, zone: 'any', build: () => makeProp('bucket', bucket) },
    flower_pot: { label: 'Flower Pot', radius: 0.38, height: 0.9, zone: 'garden', build: () => makeProp('flower_pot', flowerPot) },
    watering_can: { label: 'Watering Can', radius: 0.48, height: 0.75, zone: 'garden', build: () => makeProp('watering_can', wateringCan) },
    lantern_post: { label: 'Lantern Post', radius: 0.3, height: 1.62, zone: 'plaza', build: () => makeProp('lantern_post', lanternPost) },
    stool: { label: 'Wooden Stool', radius: 0.44, height: 0.6, zone: 'any', build: () => makeProp('stool', stool) },
    veg_basket: { label: 'Veg Basket', radius: 0.45, height: 0.75, zone: 'farm', build: () => makeProp('veg_basket', vegBasket) },
    flour_sack: { label: 'Flour Sack', radius: 0.33, height: 0.72, zone: 'farm', build: () => makeProp('flour_sack', flourSack) },
    pumpkin: { label: 'Pumpkin', radius: 0.42, height: 0.72, zone: 'farm', build: () => makeProp('pumpkin', pumpkin) },
    log_pile: { label: 'Log Pile', radius: 0.58, height: 0.9, zone: 'farm', build: () => makeProp('log_pile', logPile) },
    cart_wheel: { label: 'Cart Wheel', radius: 0.43, height: 0.79, zone: 'farm', build: () => makeProp('cart_wheel', cartWheel) },
    mailbox: { label: 'Mailbox', radius: 0.38, height: 1.4, zone: 'garden', build: () => makeProp('mailbox', mailbox) },
  };
  function makeProp(id, builder) {
    const group = newGroup();
    builder(group);
    group.userData.propId = id;
    return group;
  }

  function tree() {
    const g = newGroup();
    const trunk = [
      [[0, 0.03, 0], [0.05, 0.92, 0.02], 0.38, 0.31],
      [[0.05, 0.92, 0.02], [-0.08, 1.85, 0.04], 0.31, 0.25],
      [[-0.08, 1.85, 0.04], [0.12, 2.72, -0.02], 0.25, 0.19],
      [[0.12, 2.72, -0.02], [0.26, 3.48, 0.04], 0.19, 0.12],
    ];
    trunk.forEach(([start, end, radius, topRadius]) => stick(g, start, end, radius, materials.bark, topRadius, 10));
    // Broad roots sweep out from the trunk and tuck into the grass.
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + 0.12;
      const end = [Math.cos(a) * (0.72 + (i % 2) * 0.12), 0.08, Math.sin(a) * (0.72 + (i % 2) * 0.12)];
      stick(g, [0, 0.34, 0], end, 0.24, materials.bark, 0.065, 8);
    }
    // A few crooked limbs show through the lower edge of the canopy.
    const limbs = [
      [[0.05, 2.25, 0], [-0.88, 3.06, 0.05], 0.15],
      [[0.05, 2.55, 0], [1.02, 3.18, -0.04], 0.145],
      [[0.12, 2.88, 0], [0.28, 3.72, 0.84], 0.11],
      [[-0.04, 2.73, 0.02], [-0.18, 3.72, -0.94], 0.105],
      [[-0.8, 3.0, 0.05], [-1.28, 3.63, 0.38], 0.085],
      [[0.88, 3.08, -0.03], [1.35, 3.65, -0.28], 0.08],
    ];
    limbs.forEach(([start, end, radius]) => stick(g, start, end, radius, materials.bark, radius * 0.58, 8));

    const canopy = [
      [-1.48, 3.82, 0.02, 1.15], [1.48, 3.84, -0.04, 1.12], [0.03, 3.78, -1.38, 1.12], [-0.04, 3.8, 1.38, 1.13],
      [-1.08, 3.92, -1.02, 1.06], [1.02, 3.9, -1.03, 1.07], [-1.04, 3.94, 1.02, 1.08], [1.06, 3.93, 1.01, 1.06],
      [-1.52, 4.5, -0.34, 1.04], [1.5, 4.52, 0.3, 1.04], [-0.42, 4.48, -1.55, 1.02], [0.46, 4.5, 1.54, 1.04],
      [-1.04, 4.56, 0.28, 1.16], [1.04, 4.58, -0.22, 1.15], [-0.4, 4.67, -0.74, 1.13], [0.38, 4.66, 0.76, 1.14],
      [-0.82, 5.12, 0.06, 1.06], [0.74, 5.12, -0.08, 1.08], [-0.05, 5.18, -0.82, 1.03], [0.06, 5.2, 0.82, 1.04],
      [-0.12, 5.56, 0.02, 0.95], [0.78, 5.43, 0.22, 0.83], [-0.8, 5.43, -0.18, 0.84],
    ];
    const clumpGeometry = sphere(0.72, 10, 7);
    canopy.forEach(([x, y, z, size], i) => {
      const material = y > 5.3 ? (i % 3 ? materials.leafSun : materials.leafLight)
        : y > 4.4 ? (i % 3 ? materials.leaves : materials.leafLight)
          : (i % 3 ? materials.leafDeep : materials.leaves);
      const wobble = ((i % 4) - 1.5) * 0.035;
      put(g, clumpGeometry, material, [x + wobble, y, z - wobble], [0, (i % 5) * 0.17, wobble], [size, 0.69 + (i % 3) * 0.05, size * (0.92 + (i % 2) * 0.08)]);
    });
    return g;
  }
  function pine() {
    const g = newGroup();
    put(g, cylinder(0.08, 0.22, 4.9, 10), materials.bark, [0, 2.45, 0]);
    for (let i = 0; i < 5; i++) {
      const y = 1.04 + i * 0.78;
      const spread = 1.16 - i * 0.15;
      put(g, cylinder(0.025, spread, 1.56, 12), i % 2 ? materials.leaves : materials.leafDeep, [0, y, 0]);
      for (let a = 0; a < 5; a++) {
        const angle = a * Math.PI * 2 / 5 + i * 0.23;
        addLeaf(g, a % 2 ? materials.leafLight : materials.leaves,
          [Math.cos(angle) * spread * 0.72, y + 0.03, Math.sin(angle) * spread * 0.72], [0.7, 0.43, 0.64]);
      }
    }
    return g;
  }
  function bush() {
    const g = newGroup();
    const clumps = [
      [-0.48, 0.38, -0.04, 0.88], [-0.22, 0.52, -0.16, 0.93], [0.16, 0.43, -0.12, 1.0], [0.48, 0.34, 0.04, 0.78],
      [-0.36, 0.28, 0.32, 0.8], [0.02, 0.34, 0.36, 0.92], [0.37, 0.33, 0.31, 0.78], [-0.04, 0.64, 0.08, 0.82],
    ];
    clumps.forEach(([x, y, z, s], i) => put(g, sphere(0.38, 10, 7), i % 3 ? materials.leaves : materials.leafLight,
      [x, y, z], [0, i * 0.21, 0], [s, 0.76 + (i % 2) * 0.08, s]));
    for (let i = 0; i < 7; i++) {
      const x = -0.42 + i * 0.14;
      const z = i % 2 ? 0.36 : -0.28;
      put(g, sphere(0.065, 8, 6), i % 3 ? materials.flowerPurple : materials.flowerYellow,
        [x, 0.43 + (i % 2) * 0.12, z], [0, i * 0.2, 0], [1, 0.85, 0.9]);
    }
    return g;
  }
  function rock() {
    const g = newGroup();
    const geo = cachedGeometry('rock:dodecahedron:0.52', () => new THREE.DodecahedronGeometry(0.52, 0));
    put(g, geo, materials.stone, [0, 0.28, 0], [0.12, 0.21, -0.08], [1.4, 0.78, 1.12]);
    put(g, geo, materials.stoneLight, [-0.34, 0.22, 0.24], [0.2, -0.35, 0.13], [0.75, 0.67, 0.78]);
    put(g, geo, materials.stoneDark, [0.42, 0.18, -0.2], [-0.12, 0.5, 0.08], [0.7, 0.56, 0.82]);
    addLeaf(g, materials.leafDeep, [-0.22, 0.5, 0.23], [0.52, 0.16, 0.32]);
    addLeaf(g, materials.leafLight, [0.31, 0.38, -0.14], [0.36, 0.12, 0.24]);
    return g;
  }
  function flowerClump(hexColor = 0xe98a91) {
    const g = newGroup();
    const color = colorHex(hexColor, 0xe98a91);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399;
      const r = i === 0 ? 0.03 : 0.16 + (i % 3) * 0.042;
      const bloomColor = i === 5 ? 0xf0c85d : i === 7 ? 0x9b78b3 : color;
      addFlower(g, Math.cos(a) * r, 0, Math.sin(a) * r, bloomColor, 0.084 + (i % 2) * 0.014, 0.28 + (i % 3) * 0.07);
    }
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + 0.3;
      addLeaf(g, i % 2 ? materials.leaves : materials.leafLight,
        [Math.cos(a) * 0.22, 0.16 + (i % 2) * 0.045, Math.sin(a) * 0.22], [0.5, 0.16, 0.3]);
    }
    return g;
  }
  function fence(length = 2.6) {
    const g = newGroup();
    const count = Math.max(2, Math.ceil(length / 1.15));
    const spacing = length / count;
    for (let i = 0; i <= count; i++) {
      const x = -length / 2 + (length * i) / count;
      roundedMesh(g, 0.14, 0.9, 0.14, woodDark, [x, 0.45, 0], [0, 0, 0], 0.05);
      put(g, sphere(0.09, 8, 5), woodLight, [x, 0.91, 0], [0, 0, 0], [1, 0.62, 1]);
      addNail(g, x, 0.34, 0.077);
      addNail(g, x, 0.69, 0.077);
    }
    for (const y of [0.34, 0.69]) roundedMesh(g, length, 0.13, 0.12, woodLight, [0, y, 0], [0, 0, 0], 0.05);
    for (let i = 0; i < count; i++) {
      const left = -length / 2 + i * spacing + 0.08;
      const right = -length / 2 + (i + 1) * spacing - 0.08;
      stick(g, [left, 0.37, 0.02], [right, 0.66, 0.02], 0.032, woodDark, 0.032, 6);
      if (i % 2 === 0) stick(g, [left, 0.66, 0.025], [right, 0.37, 0.025], 0.032, woodDark, 0.032, 6);
    }
    return g;
  }

  function roofSlopes(g, w, d, h, rise, roofMat, alternateMat = materials.roofLight) {
    const half = w / 2 + 0.38;
    const slopeRise = rise + 0.06;
    const slopeLength = Math.hypot(half, slopeRise);
    const angle = Math.atan2(slopeRise, half);
    for (const side of [-1, 1]) {
      const rotation = side < 0 ? angle : -angle;
      const cx = side * Math.cos(angle) * slopeLength / 2;
      const cy = h + rise - Math.sin(angle) * slopeLength / 2;
      roundedMesh(g, slopeLength, 0.17, d + 0.76, roofMat, [cx, cy, 0], [0, 0, rotation], 0.09);
      const rows = Math.max(4, Math.ceil(slopeLength / 0.42));
      const cols = Math.max(4, Math.ceil((d + 0.48) / 0.42));
      for (let row = 0; row < rows; row++) {
        const s = (row + 0.5) * (slopeLength / rows);
        for (let col = 0; col < cols; col++) {
          const z = -((cols - 1) * 0.42) / 2 + col * 0.42 + (row % 2) * 0.045;
          const drift = ((row * 3 + col * 5) % 5 - 2) * 0.012;
          const x = side * Math.cos(angle) * s + drift;
          const y = h + rise - Math.sin(angle) * s + 0.11 + ((row + col) % 3) * 0.006;
          roundedMesh(g, slopeLength / rows * 0.92, 0.055, 0.38, (row + col) % 3 === 0 ? alternateMat : roofMat,
            [x, y, z], [0, 0, rotation + drift * 0.18], 0.025);
        }
      }
    }
  }

  function cottage({ w = 4.1, d = 3.1, h = 2.25, wall = 0xf0dfbb, roof = 0x9f4938 } = {}) {
    const g = newGroup();
    const wallMat = mat('cottageWall', colorHex(wall), 'plaster');
    const roofMat = mat('cottageRoof', colorHex(roof), 'roof_tiles');
    const roofAlt = mat('cottageRoofAlt', colorHex(roof) + 0x0b0909, 'roof_tiles');
    const shutterMat = mat('cottageShutters', 0x6f8992, 'wood_light');
    const rise = Math.min(1.35, w * 0.28);
    roundedMesh(g, w, h, d, wallMat, [0, h / 2, 0], [0, 0, 0], 0.13);
    put(g, gable(w, h, rise, d), wallMat);
    roofSlopes(g, w, d, h, rise, roofMat, roofAlt);
    const front = d / 2 + 0.09;
    // Hand-hewn timber framing, slightly irregular and softened at the edges.
    for (const x of [-w * 0.44, w * 0.44]) {
      roundedMesh(g, 0.12, h * 0.98, 0.1, woodDark, [x, h * 0.5, front], [0, 0, x < 0 ? -0.015 : 0.015], 0.035);
      roundedMesh(g, 0.1, h * 0.98, 0.1, woodDark, [x, h * 0.5, -d / 2 - 0.04], [0, 0, 0], 0.03);
    }
    for (const y of [0.48, 1.22]) roundedMesh(g, w * 0.94, 0.1, 0.1, woodDark, [0, y, front], [0, 0, 0.005], 0.035);
    // Gable braces.
    stick(g, [-w * 0.43, h + 0.08, front], [0, h + rise * 0.95, front], 0.055, woodWarm, 0.055, 7);
    stick(g, [w * 0.43, h + 0.08, front], [0, h + rise * 0.95, front], 0.055, woodWarm, 0.055, 7);
    // Door with inset plank and round handle.
    roundedMesh(g, 0.78, 1.43, 0.12, woodDark, [-0.63, 0.72, front + 0.04], [0, 0, -0.015], 0.06);
    roundedMesh(g, 0.63, 1.29, 0.07, woodWarm, [-0.63, 0.72, front + 0.11], [0, 0, 0], 0.045);
    for (let i = 0; i < 3; i++) roundedMesh(g, 0.015, 1.15, 0.012, woodLight, [-0.83 + i * 0.2, 0.72, front + 0.151], [0, 0, 0], 0.006);
    put(g, sphere(0.045, 8, 6), materials.flowerYellow, [-0.38, 0.72, front + 0.16]);
    // Two shuttered windows, divided into softly coloured panes.
    for (const x of [0.62, 1.55]) {
      const y = 1.38;
      roundedMesh(g, 0.7, 0.68, 0.07, woodDark, [x, y, front + 0.025], [0, 0, 0], 0.04);
      roundedMesh(g, 0.54, 0.52, 0.035, materials.glass, [x, y, front + 0.07], [0, 0, 0], 0.02);
      roundedMesh(g, 0.045, 0.52, 0.045, woodLight, [x, y, front + 0.1], [0, 0, 0], 0.012);
      roundedMesh(g, 0.54, 0.04, 0.045, woodLight, [x, y, front + 0.1], [0, 0, 0], 0.012);
      for (const side of [-1, 1]) {
        roundedMesh(g, 0.17, 0.61, 0.09, shutterMat, [x + side * 0.42, y, front + 0.02], [0, 0, side * 0.035], 0.03);
        for (let j = 0; j < 3; j++) roundedMesh(g, 0.14, 0.065, 0.025, woodLight, [x + side * 0.42, y - 0.18 + j * 0.18, front + 0.075], [0, 0, 0], 0.01);
        for (const hingeY of [y - 0.19, y + 0.19]) {
          roundedMesh(g, 0.2, 0.035, 0.025, woodDark, [x + side * 0.42, hingeY, front + 0.09], [0, 0, 0], 0.01);
          addNail(g, x + side * 0.42, hingeY, front + 0.11);
        }
      }
      roundedMesh(g, 0.96, 0.16, 0.28, woodDark, [x, 0.88, front + 0.19], [0, 0, 0], 0.045);
      roundedMesh(g, 0.9, 0.08, 0.25, woodWarm, [x, 0.98, front + 0.19], [0, 0, 0], 0.03);
      for (const side of [-1, 1]) stick(g, [x + side * 0.34, 0.73, front + 0.12], [x + side * 0.31, 0.82, front + 0.24], 0.025, woodDark, 0.025, 6);
      for (let j = 0; j < 3; j++) {
        const px = x - 0.24 + j * 0.24;
        addLeaf(g, j % 2 ? materials.leaves : materials.leafLight, [px, 1.04 + (j % 2) * 0.025, front + 0.22], [0.38, 0.16, 0.3]);
      }
      addFlower(g, x - 0.18, 1.01, front + 0.24, 0xe98a91, 0.06, 1.09);
      addFlower(g, x + 0.19, 1.01, front + 0.24, 0xf0c85d, 0.055, 1.08);
    }
    // Ivy climbs in two uneven patches from the flower bed toward the eaves.
    const ivyVines = [
      [[-1.72, 0.2, front + 0.11], [-1.61, 0.68, front + 0.12], [-1.75, 1.08, front + 0.12], [-1.57, 1.48, front + 0.12], [-1.68, 1.98, front + 0.12]],
      [[1.9, 0.18, front + 0.11], [1.78, 0.62, front + 0.12], [1.93, 1.02, front + 0.12], [1.78, 1.4, front + 0.12], [1.86, 1.82, front + 0.12]],
    ];
    ivyVines.forEach((points, patchIndex) => {
      put(g, tube(points, 0.022, 20, 5), materials.woodWarm);
      for (let i = 0; i < 5; i++) {
        const p = points[Math.min(points.length - 1, Math.floor(i * 0.65))];
        const side = (i % 2 ? 1 : -1) * (0.12 + (i % 3) * 0.035);
        addLeaf(g, i % 3 ? materials.ivy : materials.leafLight,
          [p[0] + side, p[1] + (i % 2) * 0.08, p[2] + 0.055], [0.42, 0.21, 0.34]);
      }
      addLeaf(g, materials.ivy, [patchIndex ? 1.68 : -1.5, 2.08, front + 0.16], [0.34, 0.18, 0.3]);
    });
    // Two shallow stone steps and a loose path lead up to the door.
    roundedMesh(g, 1.08, 0.18, 0.48, materials.stone, [-0.63, 0.09, front + 0.25], [0, 0, -0.01], 0.08);
    roundedMesh(g, 0.94, 0.17, 0.43, materials.stoneLight, [-0.63, 0.255, front + 0.57], [0, 0, 0.015], 0.07);
    roundedMesh(g, 0.68, 0.12, 0.35, materials.stone, [-0.63, 0.4, front + 0.83], [0, 0, -0.02], 0.055);
    for (let i = 0; i < 4; i++) {
      const x = -1.08 + i * 0.3;
      roundedMesh(g, 0.34, 0.1, 0.28, i % 2 ? materials.stoneLight : materials.stone,
        [x, 0.045, front + 1.2 + (i % 2) * 0.08], [0, 0, (i % 2 ? 1 : -1) * 0.035], 0.045);
    }
    // A warm little lantern hangs beside the door.
    roundedMesh(g, 0.28, 0.34, 0.24, materials.glassWarm, [0.08, 1.68, front + 0.26], [0, 0, 0], 0.035);
    put(g, sphere(0.065, 10, 7), materials.flowerCream, [0.08, 1.68, front + 0.4]);
    for (const x of [-0.12, 0.28]) roundedMesh(g, 0.035, 0.39, 0.035, woodDark, [x, 1.68, front + 0.39], [0, 0, 0], 0.012);
    for (const y of [1.48, 1.88]) roundedMesh(g, 0.32, 0.035, 0.28, woodDark, [0.08, y, front + 0.27], [0, 0, 0], 0.015);
    roundedMesh(g, 0.38, 0.08, 0.34, roofMat, [0.08, 1.92, front + 0.27], [0, 0, -0.08], 0.025);
    put(g, sphere(0.035, 8, 5), woodDark, [0.08, 2.0, front + 0.27]);
    stick(g, [0.08, 2.0, front + 0.27], [0.08, 2.08, front + 0.27], 0.018, metalDark, 0.018, 6);

    // A small timber porch shelters the entry and carries its own hand-laid tiles.
    const porchCenter = -0.63;
    const porchFront = front + 1.25;
    for (const x of [porchCenter - 0.94, porchCenter + 0.94]) {
      roundedMesh(g, 0.14, 2.18, 0.14, woodDark, [x, 1.12, front + 0.91], [0, 0, x < porchCenter ? -0.018 : 0.018], 0.045);
      stick(g, [x, 1.58, front + 0.88], [porchCenter + (x < porchCenter ? -0.43 : 0.43), 2.38, front + 0.88], 0.045, woodWarm, 0.035, 7);
    }
    roundedMesh(g, 2.45, 0.13, 0.14, woodDark, [porchCenter, 2.35, front + 0.92], [0, 0, 0], 0.04);
    for (const side of [-1, 1]) {
      const roofX = porchCenter + side * 0.62;
      roundedMesh(g, 1.35, 0.14, 1.5, roofMat, [roofX, 2.72, front + 0.61], [0, 0, -side * 0.42], 0.07);
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        const tileX = porchCenter + side * (0.25 + row * 0.34);
        const tileY = 2.91 - row * 0.14 + (col % 2) * 0.012;
        const tileZ = front + 0.22 + col * 0.39;
        roundedMesh(g, 0.34, 0.055, 0.35, (row + col) % 3 ? roofMat : roofAlt,
          [tileX, tileY, tileZ], [0, 0, -side * 0.42], 0.025);
      }
    }
    roundedMesh(g, 2.25, 0.12, 0.13, woodWarm, [porchCenter, 2.46, porchFront], [0, 0, 0], 0.04);
    // Potted greenery gathers at either side of the steps.
    for (const [x, z, scale] of [[0.48, front + 0.53, 0.78], [-1.72, front + 0.34, 0.72]]) {
      const pot = newGroup();
      put(pot, lathe([[0.15, 0.03], [0.19, 0.08], [0.25, 0.39], [0.31, 0.48], [0.32, 0.52], [0.28, 0.54]], 12), materials.terracotta);
      put(pot, cylinder(0.28, 0.28, 0.035, 12), materials.soil, [0, 0.5, 0]);
      for (let i = 0; i < 3; i++) addLeaf(pot, i % 2 ? materials.leaves : materials.leafLight,
        [Math.cos(i * 2.1) * 0.1, 0.64 + (i % 2) * 0.04, Math.sin(i * 2.1) * 0.1], [0.48, 0.17, 0.32]);
      addFlower(pot, 0, 0.54, 0.02, x < 0 ? 0xf0c85d : 0xe98a91, 0.07, 0.82);
      pot.position.set(x, 0, z);
      pot.scale.setScalar(scale);
      g.add(pot);
    }
    // Small chimney peeking above the back slope.
    roundedMesh(g, 0.4, 0.82, 0.42, mat('chimneyPlaster', 0xc9a77b, 'plaster'), [0.93, h + rise + 0.2, -0.58], [0, 0, 0], 0.06);
    for (const y of [h + rise - 0.02, h + rise + 0.24, h + rise + 0.5])
      roundedMesh(g, 0.46, 0.07, 0.46, materials.roofLight, [0.93, y, -0.58], [0, 0, 0], 0.025);
    roundedMesh(g, 0.52, 0.11, 0.5, materials.roof, [0.93, h + rise + 0.63, -0.58], [0, 0, 0], 0.05);
    return g;
  }

  function barn() {
    const g = newGroup();
    const w = 6.2, d = 4.4, h = 3.05, rise = 1.55;
    const red = mat('barnRed', 0xb95340, 'wood_planks_dark');
    roundedMesh(g, w, h, d, red, [0, h / 2, 0], [0, 0, 0], 0.14);
    put(g, gable(w, h, rise, d), red);
    roofSlopes(g, w, d, h, rise, materials.slate, mat('barnSlateAlt', 0x82959a, 'roof_tiles'));
    const front = d / 2 + 0.11;
    for (let i = 0; i < 10; i++) {
      const x = -2.8 + i * 0.62;
      roundedMesh(g, 0.64, 0.28, 0.2, i % 3 ? materials.stone : materials.stoneLight,
        [x, 0.15 + (i % 2) * 0.035, front + 0.09], [0, 0, (i % 2 ? 1 : -1) * 0.025], 0.07);
    }
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
      const z = -1.82 + i * 0.73;
      roundedMesh(g, 0.19, 0.27, 0.72, i % 2 ? materials.stoneLight : materials.stone,
        [side * 3.09, 0.15, z], [0, 0, (i % 2 ? 1 : -1) * 0.02], 0.06);
    }
    for (const x of [-2.55, 2.55]) roundedMesh(g, 0.17, h * 0.98, 0.14, woodDark, [x, h / 2, front], [0, 0, 0], 0.045);
    roundedMesh(g, 3.05, 0.18, 0.13, woodDark, [0, 2.88, front], [0, 0, 0], 0.05);
    for (const x of [-0.86, 0.86]) {
      roundedMesh(g, 1.68, 2.18, 0.13, mat('barnDoor', 0x8d4538, 'wood_light'), [x, 1.1, front + 0.09], [0, 0, 0], 0.06);
      for (let i = 0; i < 5; i++) roundedMesh(g, 0.028, 2.02, 0.025, woodLight, [x - 0.64 + i * 0.32, 1.1, front + 0.17], [0, 0, 0], 0.009);
      stick(g, [x - 0.7, 0.2, front + 0.19], [x + 0.7, 2.03, front + 0.19], 0.06, woodDark, 0.06, 7);
      stick(g, [x + 0.7, 0.2, front + 0.19], [x - 0.7, 2.03, front + 0.19], 0.06, woodDark, 0.06, 7);
      for (const hingeY of [0.32, 1.85]) {
        roundedMesh(g, 0.18, 0.055, 0.04, metalDark, [x + (x < 0 ? -0.63 : 0.63), hingeY, front + 0.22], [0, 0, x < 0 ? -0.04 : 0.04], 0.018);
        addNail(g, x + (x < 0 ? -0.63 : 0.63), hingeY, front + 0.25);
      }
    }
    put(g, torus(0.105, 0.022, 7, 16), materials.metalDark, [0, 1.14, front + 0.24]);
    put(g, sphere(0.035, 8, 6), materials.metalDark, [0, 1.14, front + 0.24]);
    // A dark hay loft opening sits above the main doors, with its little doors swung aside.
    roundedMesh(g, 1.58, 0.93, 0.1, woodDark, [0, 3.74, front + 0.06], [0, 0, 0], 0.08);
    roundedMesh(g, 1.34, 0.68, 0.055, materials.woodDark, [0, 3.69, front + 0.13], [0, 0, 0], 0.045);
    for (const side of [-1, 1]) {
      roundedMesh(g, 0.44, 0.72, 0.1, mat('barnLoftDoor', 0x9b6143, 'wood_light'), [side * 0.66, 3.75, front + 0.16], [0, 0, side * 0.12], 0.045);
      stick(g, [side * 0.84, 3.42, front + 0.22], [side * 0.49, 4.07, front + 0.22], 0.035, woodLight, 0.035, 6);
      roundedMesh(g, 0.23, 0.045, 0.035, metalDark, [side * 0.77, 3.56, front + 0.23], [0, 0, 0], 0.015);
    }
    for (let i = 0; i < 5; i++) {
      const x = -0.42 + i * 0.19;
      put(g, sphere(0.15, 10, 7), i % 2 ? materials.hayLight : materials.hay,
        [x, 3.47 + (i % 2) * 0.04, front + 0.24], [0, 0, (i - 2) * 0.08], [1.1, 0.68, 0.62]);
      stick(g, [x - 0.05, 3.42, front + 0.29], [x + 0.02, 3.7, front + 0.34], 0.012, materials.hayLight, 0.009, 5);
    }
    roundedMesh(g, 1.8, 0.13, 0.16, woodWarm, [0, 3.27, front + 0.16], [0, 0, 0], 0.04);
    return g;
  }

  function well() {
    const g = newGroup();
    put(g, lathe([[0.43, 0.02], [0.55, 0.08], [0.58, 0.47], [0.55, 0.66], [0.44, 0.69]], 16), materials.stone);
    put(g, cylinder(0.4, 0.4, 0.03, 16), materials.glass, [0, 0.54, 0]);
    put(g, torus(0.49, 0.055, 7, 20), materials.stoneLight, [0, 0.67, 0], [Math.PI / 2, 0, 0]);
    for (let row = 0; row < 2; row++) for (let i = 0; i < 10; i++) {
      const a = i * Math.PI * 2 / 10 + (row % 2) * 0.2;
      const r = 0.54;
      roundedMesh(g, 0.3, 0.2, 0.22, i % 3 ? materials.stoneLight : materials.stoneDark,
        [Math.cos(a) * r, 0.18 + row * 0.27, Math.sin(a) * r], [0, -a, 0], 0.045);
    }
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI * 2 / 12;
      const r = 0.5;
      roundedMesh(g, 0.27, 0.14, 0.23, i % 3 ? materials.stoneLight : materials.stone,
        [Math.cos(a) * r, 0.67, Math.sin(a) * r], [0, -a, 0], 0.04);
    }
    for (const x of [-0.62, 0.62]) roundedMesh(g, 0.13, 1.35, 0.14, woodDark, [x, 1.32, 0], [0, 0, x < 0 ? -0.03 : 0.03], 0.05);
    roundedMesh(g, 1.48, 0.14, 0.16, woodWarm, [0, 1.98, 0], [0, 0, 0], 0.04);
    put(g, cylinder(0.045, 0.045, 1.2, 8), woodDark, [0, 1.51, 0], [0, 0, Math.PI / 2]);
    put(g, torus(0.15, 0.025, 6, 14), woodLight, [0, 1.51, 0], [0, Math.PI / 2, 0]);
    put(g, tube([[0.08, 1.5, 0], [0.1, 1.18, 0], [0.08, 0.86, 0]], 0.014, 12, 4), materials.metalDark);
    put(g, cylinder(0.18, 0.18, 0.3, 10), materials.burlap, [0.08, 0.72, 0]);
    put(g, torus(0.17, 0.018, 6, 14), woodLight, [0.08, 0.87, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      addLeaf(g, i % 2 ? materials.leaves : materials.leafLight,
        [Math.cos(a) * 0.57, 0.38 + (i % 3) * 0.035, Math.sin(a) * 0.57], [0.34, 0.13, 0.26]);
    }
    // Little pitched thatch cover above the well bucket.
    roundedMesh(g, 0.18, 0.62, 1.02, woodDark, [-0.62, 1.95, 0], [0, 0, 0], 0.045);
    roundedMesh(g, 0.18, 0.62, 1.02, woodDark, [0.62, 1.95, 0], [0, 0, 0], 0.045);
    roundedMesh(g, 0.84, 0.14, 1.12, materials.thatch, [-0.32, 2.25, 0], [0, 0, 0.48], 0.05);
    roundedMesh(g, 0.84, 0.14, 1.12, materials.thatch, [0.32, 2.25, 0], [0, 0, -0.48], 0.05);
    roundedMesh(g, 0.12, 0.12, 1.18, woodDark, [0, 2.52, 0], [0, 0, 0], 0.04);
    for (const x of [-0.62, 0.62]) for (const z of [-0.44, -0.15, 0.15, 0.44]) {
      stick(g, [x, 2.18, z], [x * 0.62, 2.48, z], 0.025, woodWarm, 0.02, 6);
    }
    return g;
  }

  function stall(awningHexA = 0xe5c36d, awningHexB = 0xb95043) {
    const g = newGroup();
    const awningA = mat(`awningA-${colorHex(awningHexA)}`, colorHex(awningHexA), 'thatch');
    const awningB = mat(`awningB-${colorHex(awningHexB)}`, colorHex(awningHexB), 'wood_light');
    // A small timber counter with a generously rounded edge.
    roundedMesh(g, 2.55, 0.17, 1.08, woodWarm, [0, 0.82, 0], [0, 0, 0], 0.075);
    roundedMesh(g, 2.34, 0.16, 0.95, woodLight, [0, 0.67, 0], [0, 0, 0], 0.06);
    for (const x of [-1.08, 1.08]) for (const z of [-0.38, 0.38])
      roundedMesh(g, 0.12, 0.68, 0.12, woodDark, [x, 0.34, z], [0, 0, x * 0.012], 0.035);
    for (const x of [-1.18, 1.18]) for (const z of [-0.45, 0.45])
      roundedMesh(g, 0.1, 1.42, 0.1, woodWarm, [x, 1.39, z], [0, 0, x * 0.012], 0.035);
    // Softly striped cloth canopy with a little dip at the front edge.
    roundedMesh(g, 2.82, 0.13, 1.42, awningA, [0, 2.17, -0.03], [0.06, 0, -0.025], 0.08);
    for (let i = 0; i < 9; i++) {
      const x = -1.25 + i * 0.3125;
      const stripe = i % 2 ? awningB : awningA;
      roundedMesh(g, 0.31, 0.11, 1.35, stripe, [x, 2.18 - Math.abs(x) * 0.018, -0.035], [0.06, 0, -0.025], 0.035);
      roundedMesh(g, 0.31, 0.31, 0.11, stripe, [x, 2.0, 0.64], [0.04, 0, 0], 0.04);
    }
    for (const x of [-1.08, 1.08]) for (const z of [-0.38, 0.38]) {
      stick(g, [x, 0.48, z], [x * 1.06, 1.15, z * 0.88], 0.035, woodDark, 0.035, 6);
    }
    // Baskets and cheerful produce make the stall read clearly at a distance.
    put(g, lathe([[0.15, 0.02], [0.22, 0.06], [0.28, 0.27], [0.25, 0.3]], 12), woodLight, [-0.72, 0.92, 0.02]);
    put(g, lathe([[0.15, 0.02], [0.21, 0.06], [0.27, 0.25], [0.25, 0.29]], 12), woodWarm, [0.7, 0.92, 0.03]);
    const produce = [
      [-0.94, materials.tomato, [1, 0.82, 0.94]], [-0.62, materials.greenVeg, [0.82, 0.8, 0.94]],
      [-0.28, materials.pumpkin, [0.92, 0.78, 0.9]], [0.1, materials.tomato, [1.05, 0.88, 0.94]],
      [0.44, materials.greenVeg, [0.86, 0.94, 0.92]], [0.79, materials.pumpkin, [0.95, 0.82, 0.95]],
    ];
    produce.forEach(([x, material, scale], i) => {
      const y = 1.06 + (i % 2) * 0.055;
      put(g, sphere(0.145, 10, 7), material, [x, y, 0.04], [0, 0, i * 0.08], scale);
      if (material === materials.greenVeg || i % 3 === 0) addLeaf(g, materials.leafLight, [x + 0.04, y + 0.11, 0.03], [0.35, 0.12, 0.25]);
    });
    // Three little preserving jars balance the baskets and make the stall feel stocked.
    const jarMats = [materials.glassWarm, mat('jarBerry', 0xa95350), mat('jarPickle', 0x829452, 'leaves')];
    for (let i = 0; i < 3; i++) {
      const x = -0.88 + i * 0.88;
      const jarMat = jarMats[i];
      put(g, lathe([[0.1, 0.02], [0.14, 0.06], [0.15, 0.28], [0.12, 0.34], [0.09, 0.36]], 12), jarMat, [x, 0.93, -0.28]);
      put(g, cylinder(0.1, 0.1, 0.05, 12), i === 1 ? materials.terracotta : woodLight, [x, 1.3, -0.28]);
      put(g, torus(0.105, 0.012, 5, 12), metalDark, [x, 1.28, -0.28], [Math.PI / 2, 0, 0]);
      put(g, sphere(0.018, 8, 5), materials.flowerCream, [x, 1.34, -0.28]);
    }
    for (let i = 0; i < 5; i++) addLeaf(g, i % 2 ? materials.leaves : materials.leafLight, [-0.22 + i * 0.12, 1.2, -0.08], [0.34, 0.12, 0.2]);
    return g;
  }

  function windmill() {
    const g = newGroup();
    put(g, lathe([[0.74, 0.02], [0.83, 0.12], [0.76, 0.72], [0.68, 1.45], [0.57, 2.25], [0.48, 3.03], [0.44, 3.12]], 16), materials.plaster);
    put(g, cylinder(0.62, 0.84, 0.09, 12), woodDark, [0, 0.07, 0]);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI * 2 / 10;
      const r = 0.72;
      roundedMesh(g, 0.37, 0.3, 0.24, i % 2 ? materials.stone : materials.stoneLight,
        [Math.cos(a) * r, 0.18, Math.sin(a) * r], [0, -a, 0], 0.065);
    }
    put(g, cylinder(0.06, 0.1, 0.58, 10), materials.slate, [0, 3.33, 0]);
    roundedMesh(g, 0.48, 0.98, 0.09, woodDark, [0, 0.55, 0.77], [0, 0, 0], 0.09);
    roundedMesh(g, 0.32, 0.82, 0.045, woodWarm, [0, 0.55, 0.83], [0, 0, 0], 0.06);
    put(g, sphere(0.035, 8, 5), materials.metalDark, [0.12, 0.55, 0.86]);
    for (const side of [-1, 1]) {
      stick(g, [side * 0.3, 0.1, 0.62], [side * 0.7, 1.08, 0.67], 0.045, woodWarm, 0.035, 7);
      roundedMesh(g, 0.38, 0.06, 0.035, metalDark, [side * 0.16, 0.55, 0.88], [0, 0, side * 0.04], 0.012);
    }
    for (const x of [-0.24, 0.24]) {
      roundedMesh(g, 0.28, 0.4, 0.06, materials.glass, [x, 1.92, 0.58], [0, 0, 0], 0.035);
      roundedMesh(g, 0.055, 0.46, 0.055, woodDark, [x, 1.92, 0.63], [0, 0, 0], 0.02);
      roundedMesh(g, 0.13, 0.43, 0.035, materials.slate, [x + (x < 0 ? -0.18 : 0.18), 1.92, 0.59], [0, 0, x < 0 ? -0.04 : 0.04], 0.02);
    }
    put(g, cylinder(0.72, 0.72, 0.13, 8), materials.slate, [0, 3.12, 0]);
    const sails = newGroup();
    sails.name = 'sails';
    sails.position.set(0, 2.57, 0.68);
    put(sails, sphere(0.16, 10, 7), woodWarm);
    for (let i = 0; i < 4; i++) {
      const blade = newGroup();
      blade.rotation.z = i * Math.PI / 2 + Math.PI / 4;
      roundedMesh(blade, 0.11, 1.45, 0.1, woodDark, [0, 0.77, 0], [0, 0, 0], 0.035);
      roundedMesh(blade, 0.43, 0.9, 0.055, materials.flowerCream, [0.22, 0.82, 0], [0, 0, 0.035], 0.055);
      roundedMesh(blade, 0.08, 0.88, 0.075, woodWarm, [0.22, 0.82, 0.045], [0, 0, 0.035], 0.025);
      sails.add(blade);
    }
    g.add(sails);
    return g;
  }

  const nature = { tree, pine, bush, rock, flowerClump, fence };
  const buildings = { cottage, barn, well, stall, windmill };

  return { props, nature, buildings, materials };
}
