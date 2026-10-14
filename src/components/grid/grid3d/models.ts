import * as THREE from "three";

/**
 * Small procedural low-poly models for the 3D campus grid. Everything is built
 * from primitives (no downloaded assets), sized to sit on a ~2.4-unit platform.
 * Materials are passed in so the scene can recolour them when the theme changes.
 */

export interface ModelMaterials {
  body: THREE.MeshStandardMaterial; // building walls
  roof: THREE.MeshStandardMaterial; // roofs, plant on roofs
  dark: THREE.MeshStandardMaterial; // panels, transformers
  window: THREE.MeshStandardMaterial; // lit windows (emissive)
  glass: THREE.MeshPhysicalMaterial; // battery glass
  metal: THREE.LineBasicMaterial; // pylon lattice
}

const box = (w: number, h: number, d: number, m: THREE.Material) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.y = h / 2;
  return mesh;
};

/** A grid of lit windows on the front (+z) and right (+x) faces of a block. */
function windows(group: THREE.Group, w: number, h: number, d: number, y0: number, m: THREE.Material, rows: number, cols: number) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const count = rows * cols * 2;
  const inst = new THREE.InstancedMesh(geo, m, count);
  const dummy = new THREE.Object3D();
  let k = 0;
  const cw = (w * 0.78) / cols;
  const rh = ((h - 0.25) * 0.8) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const y = y0 + 0.2 + rh * (r + 0.5) + ((h - 0.25) * 0.1);
      // front face
      dummy.position.set(-w * 0.39 + cw * (c + 0.5), y, d / 2 + 0.005);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(cw * 0.62, rh * 0.55, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(k++, dummy.matrix);
      // side face
      const sw = (d * 0.78) / cols;
      dummy.position.set(w / 2 + 0.005, y, d * 0.39 - sw * (c + 0.5));
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.scale.set(sw * 0.62, rh * 0.55, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(k++, dummy.matrix);
    }
  }
  inst.userData.isWindows = true;
  group.add(inst);
}

export function hostel(m: ModelMaterials) {
  const g = new THREE.Group();
  const b = box(1.25, 2.1, 0.95, m.body);
  g.add(b);
  const cap = box(1.32, 0.08, 1.02, m.roof);
  cap.position.y = 2.14;
  g.add(cap);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 10), m.roof);
  tank.position.set(-0.35, 2.29, -0.2);
  g.add(tank);
  windows(g, 1.25, 2.1, 0.95, 0, m.window, 6, 4);
  return g;
}

export function lab(m: ModelMaterials) {
  const g = new THREE.Group();
  g.add(box(1.8, 0.85, 1.25, m.body));
  for (let i = 0; i < 3; i++) {
    const u = box(0.32, 0.18, 0.32, m.roof);
    u.position.set(-0.55 + i * 0.5, 0.85 + 0.09, -0.2);
    g.add(u);
  }
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 10), m.roof);
  vent.position.set(0.6, 1.1, 0.25);
  g.add(vent);
  windows(g, 1.8, 0.85, 1.25, 0, m.window, 2, 6);
  return g;
}

export function library(m: ModelMaterials) {
  const g = new THREE.Group();
  g.add(box(1.7, 0.8, 1.25, m.body));
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.18, 24), m.roof);
  drum.position.y = 0.89;
  g.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.body);
  dome.position.y = 0.98;
  g.add(dome);
  windows(g, 1.7, 0.8, 1.25, 0, m.window, 2, 5);
  return g;
}

export function lecture(m: ModelMaterials) {
  const g = new THREE.Group();
  // stepped auditorium block
  // stepped auditorium: three blocks rising towards the back
  [0.5, 0.75, 1.0].forEach((h, i) => {
    const s = box(1.8, h, 0.4, m.body);
    s.position.z = 0.4 - i * 0.4;
    g.add(s);
    const cap = box(1.84, 0.05, 0.42, m.roof);
    cap.position.set(0, h, 0.4 - i * 0.4);
    g.add(cap);
  });
  windows(g, 1.8, 0.5, 1.2, 0, m.window, 1, 6);
  return g;
}

export function admin(m: ModelMaterials) {
  const g = new THREE.Group();
  g.add(box(1.55, 1.15, 1.05, m.body));
  const pediment = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.62, 0.32, 3, 1), m.roof);
  pediment.rotation.set(0, Math.PI / 6, 0);
  pediment.scale.set(1.35, 1, 0.6);
  pediment.position.set(0, 1.31, 0.32);
  g.add(pediment);
  for (let i = 0; i < 4; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), m.roof);
    col.position.set(-0.5 + i * 0.33, 0.45, 0.62);
    g.add(col);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6), m.roof);
  pole.position.set(0.6, 1.6, -0.3);
  g.add(pole);
  windows(g, 1.55, 1.15, 1.05, 0, m.window, 3, 4);
  return g;
}

export function faculty(m: ModelMaterials) {
  const g = new THREE.Group();
  const spots: [number, number][] = [[-0.55, -0.45], [0.45, -0.5], [-0.5, 0.45], [0.5, 0.4]];
  for (const [x, z] of spots) {
    const h = new THREE.Group();
    h.add(box(0.6, 0.42, 0.5, m.body));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.3, 4), m.roof);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 0.57;
    roof.scale.set(1, 1, 0.82);
    h.add(roof);
    windows(h, 0.6, 0.42, 0.5, 0, m.window, 1, 2);
    h.position.set(x, 0, z);
    g.add(h);
  }
  return g;
}

export function solarFarm(m: ModelMaterials) {
  const g = new THREE.Group();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.04, 0.5), m.dark);
      p.position.set(-0.9 + c * 0.9, 0.32, -0.75 + r * 0.72);
      p.rotation.x = -0.45;
      g.add(p);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), m.roof);
      leg.position.set(p.position.x, 0.15, p.position.z);
      g.add(leg);
    }
  }
  const inv = box(0.35, 0.3, 0.25, m.body);
  inv.position.set(1.15, 0, 0.95);
  g.add(inv);
  return g;
}

/** Three battery cells: glass shells with a glowing fill that shows the charge. */
export function batteryBank(m: ModelMaterials, fill: THREE.MeshStandardMaterial) {
  const g = new THREE.Group();
  const fills: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const x = -0.75 + i * 0.75;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.1, 24), m.roof);
    base.position.set(x, 0.05, 0);
    g.add(base);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 24, 1, true), m.glass);
    shell.position.set(x, 0.65, 0);
    g.add(shell);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.08, 24), m.roof);
    cap.position.set(x, 1.24, 0);
    g.add(cap);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1, 20), fill);
    f.position.set(x, 0.1, 0);
    f.userData.baseY = 0.1;
    f.userData.maxH = 1.05;
    g.add(f);
    fills.push(f);
  }
  const cab = box(0.5, 0.35, 0.3, m.body);
  cab.position.set(0, 0, 0.75);
  g.add(cab);
  g.userData.fills = fills;
  return g;
}

/** Lattice transmission tower made of line segments. */
function pylon(m: THREE.LineBasicMaterial, h = 2.4) {
  const pts: number[] = [];
  const seg = (a: number[], b: number[]) => pts.push(...a, ...b);
  const w0 = 0.32;
  const levels = 6;
  for (let i = 0; i < levels; i++) {
    const y0 = (h * i) / levels;
    const y1 = (h * (i + 1)) / levels;
    const a = w0 * (1 - (i / levels) * 0.8);
    const b = w0 * (1 - ((i + 1) / levels) * 0.8);
    const c0 = [[-a, y0, -a], [a, y0, -a], [a, y0, a], [-a, y0, a]];
    const c1 = [[-b, y1, -b], [b, y1, -b], [b, y1, b], [-b, y1, b]];
    for (let k = 0; k < 4; k++) {
      seg(c0[k], c1[k]);
      seg(c0[k], c1[(k + 1) % 4]);
      seg(c1[k], c1[(k + 1) % 4]);
    }
  }
  // cross arms
  for (const y of [h * 0.72, h * 0.9]) {
    seg([-0.6, y, 0], [0.6, y, 0]);
    seg([-0.6, y, 0], [-0.1, y + 0.12, 0]);
    seg([0.6, y, 0], [0.1, y + 0.12, 0]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(geo, m);
}

export function gridSubstation(m: ModelMaterials) {
  const g = new THREE.Group();
  const p1 = pylon(m.metal);
  p1.position.set(-0.75, 0, -0.55);
  const p2 = pylon(m.metal, 2.0);
  p2.position.set(0.85, 0, -0.75);
  g.add(p1, p2);
  // sagging wires between the arms
  const wire = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.35, 1.73, -0.55),
    new THREE.Vector3(0, 1.45, -0.65),
    new THREE.Vector3(0.25, 1.44, -0.75),
  ]);
  for (const dx of [0, 1.2]) {
    const c = wire.clone();
    c.points = c.points.map((p) => p.clone().add(new THREE.Vector3(dx, 0, 0)));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(16)), m.metal);
    g.add(line);
  }
  for (let i = 0; i < 2; i++) {
    const t = box(0.45, 0.45, 0.38, m.dark);
    t.position.set(-0.35 + i * 0.7, 0, 0.6);
    g.add(t);
    for (let f = 0; f < 3; f++) {
      const fin = box(0.03, 0.4, 0.3, m.roof);
      fin.position.set(t.position.x - 0.26, 0, 0.6 + (f - 1) * 0.1);
      g.add(fin);
    }
  }
  return g;
}

/** Campus substation (the bus): transformers and a small frame. */
export function campusBus(m: ModelMaterials) {
  const g = new THREE.Group();
  const t = box(0.6, 0.5, 0.5, m.dark);
  g.add(t);
  const frame = new THREE.Group();
  for (const x of [-0.55, 0.55]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), m.roof);
    post.position.set(x, 0.45, -0.45);
    frame.add(post);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.04), m.roof);
  bar.position.set(0, 0.88, -0.45);
  frame.add(bar);
  g.add(frame);
  return g;
}
