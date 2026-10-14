import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { GridState, Zone } from "@/types/grid";
import { formatKw, formatNumber } from "@/utils/format";
import * as M from "./models";

/**
 * The 3D campus grid: platforms for every source and building, glowing feeder
 * lines with power flowing along them, and floating labels with live numbers.
 * Plain three.js (no React) so the canvas can be updated in place every few
 * seconds without re-creating anything. All colours come from theme tokens.
 */

type Tone = "solar" | "battery" | "grid" | "zone" | "fault" | "reroute" | "idle";

interface Palette {
  ground: THREE.Color;
  gridLine: THREE.Color;
  platform: THREE.Color;
  platformEdge: THREE.Color;
  body: THREE.Color;
  roof: THREE.Color;
  dark: THREE.Color;
  window: THREE.Color;
  accent: THREE.Color;
  success: THREE.Color;
  warning: THREE.Color;
  danger: THREE.Color;
  ai: THREE.Color;
  solar: THREE.Color;
  idle: THREE.Color;
  dark_mode: boolean;
}

function readPalette(): Palette {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const v = (n: string) => css.getPropertyValue(n).trim();
  const c = (n: string, f: string) => {
    try {
      return new THREE.Color(v(n) || f);
    } catch {
      return new THREE.Color(f);
    }
  };
  const dark = root.dataset.theme === "dark";
  return {
    dark_mode: dark,
    ground: c("--bg", dark ? "#0a0d0c" : "#e9e6df"),
    gridLine: dark ? new THREE.Color("#6f8f86") : new THREE.Color("#8a8478"),
    platform: dark ? new THREE.Color("#1d2523") : new THREE.Color("#f6f4ef"),
    platformEdge: dark ? new THREE.Color("#2c3633") : new THREE.Color("#d9d4ca"),
    body: dark ? new THREE.Color("#c9d3cf") : new THREE.Color("#fbfaf7"),
    roof: dark ? new THREE.Color("#7f8c88") : new THREE.Color("#cfc9bd"),
    dark: dark ? new THREE.Color("#2a3a4a") : new THREE.Color("#34495e"),
    window: dark ? new THREE.Color("#ffd29a") : new THREE.Color("#f2b35a"),
    accent: c("--accent", "#0d6b5f"),
    success: c("--success", "#3b7414"),
    warning: c("--warning", "#a14f00"),
    danger: c("--danger", "#b3261e"),
    ai: c("--ai", "#2d5b88"),
    solar: c("--solar", "#965400"),
    idle: dark ? new THREE.Color("#3a4743") : new THREE.Color("#c7c1b5"),
  };
}

// ---------- layout (world units; x → right, z → towards the viewer) ----------
const ZONE_X = [0, 3.1, 6.2, 9.3, 12.4];
const ROW_Z = { top: -4.6, bottom: 4.6 };
const SPINE_Z = 0;
const HUB = new THREE.Vector3(-3.6, 0, 0);
const SRC = {
  solar: new THREE.Vector3(-9.6, 0, -4.6),
  battery: new THREE.Vector3(-3.6, 0, -5.4),
  grid: new THREE.Vector3(-9.6, 0, 4.6),
};

interface NodeView {
  group: THREE.Group;
  ring: THREE.LineLoop;
  label: CSS2DObject;
  model: THREE.Group;
}

interface FlowLine {
  group: THREE.Group;
  curve: THREE.CurvePath<THREE.Vector3>;
  length: number;
  dots: THREE.InstancedMesh | null;
  phase: number;
  reverse: boolean;
}

/** Orthogonal route with rounded corners through the given points (on the ground). */
function route(points: THREE.Vector3[], r = 0.55, y = 0.06) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const p = points.map((q) => new THREE.Vector3(q.x, y, q.z));
  let start = p[0];
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1];
    const b = p[i];
    const c = p[i + 1];
    const din = b.clone().sub(a).normalize();
    const dout = c.clone().sub(b).normalize();
    const rr = Math.min(r, b.distanceTo(a) / 2, c.distanceTo(b) / 2);
    const p1 = b.clone().sub(din.clone().multiplyScalar(rr));
    const p2 = b.clone().add(dout.clone().multiplyScalar(rr));
    if (start.distanceTo(p1) > 1e-4) path.add(new THREE.LineCurve3(start, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, b, p2));
    start = p2;
  }
  path.add(new THREE.LineCurve3(start, p[p.length - 1]));
  return path;
}

function roundedRect(w: number, d: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Shorter names for small screens, where full labels would overlap. */
const SHORT: Record<string, string> = {
  "Electrical Lab": "Elec. Lab",
  "Computer Science Lab": "CS Lab",
  "Central Library": "Library",
  "Lecture Theatres": "Lectures",
  "Admin Block": "Admin",
  "Faculty Compound": "Faculty",
  "Campus load": "Campus",
  "Main grid": "Grid",
};
const shortName = (n: string) => SHORT[n] ?? n;

export class GridScene {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  private controls: OrbitControls;
  private root = new THREE.Group();
  private pal: Palette;
  private mats: {
    platform: THREE.MeshStandardMaterial;
    platformSide: THREE.MeshStandardMaterial;
    models: M.ModelMaterials;
    batteryFill: THREE.MeshStandardMaterial;
    ground: THREE.ShaderMaterial;
  };
  private nodes = new Map<string, NodeView>();
  private lines: FlowLine[] = [];
  private lineGroup = new THREE.Group();
  private dotGeo = new THREE.SphereGeometry(0.075, 10, 8);
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private disposed = false;
  private reduceMotion: boolean;
  private narrow = false;
  private compact = false;
  private width = 1;
  private height = 1;
  private state: GridState | null = null;
  private faultT = 0;

  constructor(private host: HTMLElement) {
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.pal = readPalette();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.style.display = "block";
    host.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    const ld = this.labels.domElement;
    ld.style.position = "absolute";
    ld.style.inset = "0";
    ld.style.pointerEvents = "none";
    ld.className = "grid3d-labels";
    host.appendChild(ld);

    // lights
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.6));
    const sun = new THREE.DirectionalLight(0xfff1e0, 1.4);
    sun.position.set(-8, 14, 10);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 0.5);
    rim.position.set(10, 6, -10);
    this.scene.add(rim);

    this.mats = {
      platform: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.05 }),
      platformSide: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      batteryFill: new THREE.MeshStandardMaterial({ roughness: 0.3, emissiveIntensity: 0.9 }),
      models: {
        body: new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }),
        roof: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
        dark: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.4 }),
        window: new THREE.MeshStandardMaterial({ roughness: 0.4, emissiveIntensity: 1 }),
        glass: new THREE.MeshPhysicalMaterial({ roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.35, thickness: 0.2 }),
        metal: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.85 }),
      },
      ground: this.groundMaterial(),
    };

    this.scene.add(this.root);
    this.buildGround();
    this.buildNodes();
    this.root.add(this.lineGroup);
    this.applyPalette();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = 0.5;
    this.controls.maxPolarAngle = 1.15;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.6;
    // Touch screens keep normal page scrolling; mouse users can drag and zoom.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.controls.enabled = !coarse;
    this.controls.enableZoom = false;
    this.controls.addEventListener("change", () => this.requestFrame());
  }

  // ---------- ground: soft grid that fades out at the edges ----------
  private groundMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uLine: { value: new THREE.Color() },
        uAlpha: { value: 0.5 },
      },
      vertexShader: `varying vec2 vXZ; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vXZ = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform vec3 uLine; uniform float uAlpha; varying vec2 vXZ;
        float gridLine(vec2 p, float s, float w){ vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
        void main(){
          float minor = gridLine(vXZ, 1.0, 1.0) * 0.35;
          float major = gridLine(vXZ, 4.0, 1.2) * 0.7;
          vec2 c = (vXZ - vec2(1.5, 0.0)) / vec2(20.0, 12.0);
          float fade = 1.0 - smoothstep(0.55, 1.0, length(c));
          float a = max(minor, major) * fade * uAlpha;
          gl_FragColor = vec4(uLine, a);
        }`,
      extensions: { derivatives: true } as never,
    });
  }

  private buildGround() {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), this.mats.ground);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(1.5, -0.001, 0);
    this.root.add(plane);
  }

  // ---------- platforms + models ----------
  private platform(size: [number, number]) {
    const [w, d] = size;
    const shape = roundedRect(w, d, 0.35);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 8 });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, [this.mats.platform, this.mats.platformSide]);
    const pts = shape.getPoints(32).map((p) => new THREE.Vector3(p.x * 1.04, 0.3, -p.y * 1.04));
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 }));
    return { mesh, ring };
  }

  private addNode(id: string, pos: THREE.Vector3, size: [number, number], model: THREE.Group, lift = 0, labelInFront = false) {
    const group = new THREE.Group();
    group.position.copy(pos);
    const { mesh, ring } = this.platform(size);
    group.add(mesh, ring);
    model.position.y = 0.27;
    group.add(model);
    const el = document.createElement("div");
    el.className = "grid3d-label";
    const label = new CSS2DObject(el);
    const top = new THREE.Box3().setFromObject(model).max.y;
    if (labelInFront) label.position.set(0, 0.2, size[1] / 2 + 0.75 + lift);
    else label.position.set(0, Math.max(1.2, top) + 0.75 + lift, 0);
    group.add(label);
    this.root.add(group);
    this.nodes.set(id, { group, ring, label, model });
  }

  private buildNodes() {
    const m = this.mats.models;
    this.addNode("solar", SRC.solar, [3.4, 2.8], M.solarFarm(m));
    this.addNode("battery", SRC.battery, [3.0, 2.2], M.batteryBank(m, this.mats.batteryFill));
    this.addNode("grid", SRC.grid, [3.4, 2.8], M.gridSubstation(m));
    this.addNode("bus", HUB, [2.0, 2.0], M.campusBus(m));
  }

  /** Builds or refreshes zone platforms from the state (ids are stable). */
  private ensureZones(zones: Zone[]) {
    const placed = this.zoneSlots(zones);
    for (const { zone, pos, index, row } of placed) {
      if (this.nodes.has(zone.id)) continue;
      const m = this.mats.models;
      const model =
        zone.kind === "hostel" ? M.hostel(m)
        : zone.kind === "lab" ? M.lab(m)
        : zone.kind === "library" ? M.library(m)
        : zone.kind === "academic" ? M.lecture(m)
        : zone.kind === "residence" ? M.faculty(m)
        : M.admin(m);
      // Neighbouring labels sit at alternating heights so they never overlap.
      // Back row: labels above the roofs at alternating heights. Front row: labels
      // in front of the platforms (also alternating), so neighbours never overlap.
      if (row === "top") this.addNode(zone.id, pos, [2.4, 2.2], model, index % 2 === 1 ? 1.25 : 0);
      else this.addNode(zone.id, pos, [2.4, 2.2], model, index % 2 === 1 ? 1.9 : 0, true);
    }
  }

  /** Residential buildings along the back row, academic/admin along the front. */
  private zoneSlots(zones: Zone[]) {
    const residential = (z: Zone) => z.kind === "hostel" || z.kind === "residence";
    const back = zones.filter(residential).slice(0, ZONE_X.length);
    const front = zones.filter((z) => !residential(z)).slice(0, ZONE_X.length);
    return [
      ...back.map((zone, i) => ({ zone, index: i, pos: new THREE.Vector3(ZONE_X[i], 0, ROW_Z.top), row: "top" as const, x: ZONE_X[i] })),
      ...front.map((zone, i) => ({ zone, index: i, pos: new THREE.Vector3(ZONE_X[i], 0, ROW_Z.bottom), row: "bottom" as const, x: ZONE_X[i] })),
    ];
  }

  // ---------- colours ----------
  applyPalette() {
    this.pal = readPalette();
    const p = this.pal;
    this.mats.platform.color.copy(p.platform);
    this.mats.platformSide.color.copy(p.platformEdge);
    this.mats.models.body.color.copy(p.body);
    this.mats.models.roof.color.copy(p.roof);
    this.mats.models.dark.color.copy(p.dark);
    this.mats.models.window.color.copy(p.window);
    this.mats.models.window.emissive.copy(p.window);
    this.mats.models.glass.color.set(p.dark_mode ? "#9fd8ff" : "#ffffff");
    this.mats.models.metal.color.copy(p.dark_mode ? p.body : p.roof).multiplyScalar(p.dark_mode ? 1 : 0.7);
    this.mats.batteryFill.color.copy(p.success);
    this.mats.batteryFill.emissive.copy(p.success);
    this.mats.ground.uniforms.uLine.value.copy(p.gridLine);
    this.mats.ground.uniforms.uAlpha.value = p.dark_mode ? 0.45 : 0.4;
    if (this.state) this.update(this.state);
    this.requestFrame();
  }

  private tone(t: Tone) {
    const p = this.pal;
    return t === "solar" ? p.solar : t === "battery" ? p.success : t === "fault" ? p.danger : t === "reroute" ? p.ai : t === "idle" ? p.idle : p.accent;
  }

  // ---------- flow lines ----------
  private clearLines() {
    for (const l of this.lines) {
      l.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry && mesh.geometry !== this.dotGeo) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | undefined;
        if (mat) mat.dispose();
      });
      this.lineGroup.remove(l.group);
    }
    this.lines = [];
  }

  private addLine(points: THREE.Vector3[], kw: number, maxKw: number, tone: Tone, opts: { reverse?: boolean } = {}) {
    const curve = route(points);
    const length = curve.getLength();
    const group = new THREE.Group();
    const active = kw > 1 && tone !== "fault";
    const color = this.tone(active || tone === "fault" ? tone : "idle");
    const r = 0.035 + 0.055 * Math.sqrt(Math.min(Math.max(kw, 0), maxKw) / maxKw);
    const segs = Math.max(24, Math.round(length * 10));

    const core = new THREE.Mesh(
      new THREE.TubeGeometry(curve, segs, tone === "fault" ? 0.05 : r, 8, false),
      new THREE.MeshBasicMaterial({ color, transparent: tone === "fault", opacity: 1 }),
    );
    group.add(core);
    if (active || tone === "fault") {
      const glow = new THREE.Mesh(
        new THREE.TubeGeometry(curve, segs, r * 3.2 + 0.05, 8, false),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: this.pal.dark_mode ? 0.22 : 0.16, depthWrite: false, blending: this.pal.dark_mode ? THREE.AdditiveBlending : THREE.NormalBlending }),
      );
      group.add(glow);
    }

    let dots: THREE.InstancedMesh | null = null;
    if (active) {
      const n = Math.max(2, Math.min(16, Math.round(length * (0.35 + 0.9 * Math.sqrt(Math.min(kw, maxKw) / maxKw)))));
      dots = new THREE.InstancedMesh(this.dotGeo, new THREE.MeshBasicMaterial({ color: color.clone().lerp(new THREE.Color("#ffffff"), 0.45) }), n);
      group.add(dots);
    }
    if (tone === "fault") {
      // a red break marker in the middle of the line
      const mid = curve.getPointAt(0.5);
      const x = new THREE.Group();
      for (const a of [Math.PI / 4, -Math.PI / 4]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: this.pal.danger }));
        bar.rotation.y = a;
        x.add(bar);
      }
      x.position.copy(mid).add(new THREE.Vector3(0, 0.25, 0));
      x.userData.fault = true;
      group.add(x);
    }
    this.lineGroup.add(group);
    const line: FlowLine = { group, curve, length, dots, phase: Math.random(), reverse: !!opts.reverse };
    this.placeDots(line);
    this.lines.push(line);
  }

  private placeDots(l: FlowLine) {
    if (!l.dots) return;
    const m = new THREE.Matrix4();
    const n = l.dots.count;
    for (let i = 0; i < n; i++) {
      let t = (l.phase + i / n) % 1;
      if (l.reverse) t = 1 - t;
      const p = l.curve.getPointAt(t);
      m.makeTranslation(p.x, p.y + 0.02, p.z);
      l.dots.setMatrixAt(i, m);
    }
    l.dots.instanceMatrix.needsUpdate = true;
  }

  // ---------- data ----------
  update(state: GridState) {
    this.state = state;
    const before = this.nodes.size;
    this.ensureZones(state.zones);
    if (this.nodes.size !== before) {
      this.root.updateMatrixWorld(true);
      this.fitCamera();
    }
    const outage = state.activeFault?.type === "grid_outage";
    const batteryOut = Math.max(0, -state.battery.powerKw);
    const batteryIn = Math.max(0, state.battery.powerKw);
    const maxKw = Math.max(400, state.demandKw / 2);

    // labels + rings for sources
    this.setLabel("solar", "Solar", formatKw(state.solarKw), state.solarKw > 0 ? "Generating" : "No output", "solar");
    this.setLabel(
      "battery",
      "Battery",
      `${state.battery.socPct}%`,
      batteryOut > 0 ? `Supplying ${formatKw(batteryOut)}` : batteryIn > 0 ? `Charging ${formatKw(batteryIn)}` : "Standby · ready",
      "battery",
    );
    this.setLabel("grid", "Main grid", outage ? "Offline" : formatKw(state.gridImportKw), outage ? "Supply lost" : `₹${state.tariff.ratePerKwh.toFixed(2)}/kWh`, outage ? "fault" : "grid");
    this.setLabel("bus", "Campus load", `${formatNumber(state.demandKw)} kW`, undefined, "zone");
    this.ring("solar", state.solarKw > 0 ? "solar" : "idle");
    this.ring("battery", "battery");
    this.ring("grid", outage ? "fault" : "zone");
    this.ring("bus", "zone");

    // battery fill height follows the state of charge
    const fills = (this.nodes.get("battery")?.model.userData.fills ?? []) as THREE.Mesh[];
    const frac = Math.max(0.05, Math.min(1, state.battery.socPct / 100));
    for (const f of fills) {
      const h = (f.userData.maxH as number) * frac;
      f.scale.y = h;
      f.position.y = (f.userData.baseY as number) + h / 2;
    }

    // lines
    this.clearLines();
    const bus = HUB.clone();
    this.addLine([SRC.solar, new THREE.Vector3(-6.6, 0, SRC.solar.z), new THREE.Vector3(-6.6, 0, -0.5), new THREE.Vector3(bus.x - 0.6, 0, -0.5)], state.solarKw, maxKw, "solar");
    this.addLine([SRC.grid, new THREE.Vector3(-6.6, 0, SRC.grid.z), new THREE.Vector3(-6.6, 0, 0.5), new THREE.Vector3(bus.x - 0.6, 0, 0.5)], outage ? 0 : state.gridImportKw, maxKw, outage ? "fault" : "grid");
    this.addLine(
      batteryIn > 0 ? [bus, SRC.battery] : [SRC.battery, bus],
      batteryOut || batteryIn,
      maxKw,
      "battery",
    );

    const slots = this.zoneSlots(state.zones);
    // feeder spine from the bus along the campus
    const lastX = Math.max(...slots.map((s) => s.x));
    this.addLine([bus, new THREE.Vector3(lastX, 0, SPINE_Z)], Math.max(0, state.demandKw), maxKw * 2, "zone");
    for (const s of slots) {
      const z = s.zone;
      const faulted = z.status === "faulted" || z.status === "isolated";
      const rerouted = z.status === "reduced" && !!z.note?.includes("backup feeder");
      const sign = s.row === "top" ? -1 : 1;
      const end = new THREE.Vector3(s.x, 0, s.pos.z - sign * 1.2);
      if (rerouted) {
        // dead normal feeder, and power arriving from the neighbour on the backup feeder
        this.addLine([new THREE.Vector3(s.x, 0, SPINE_Z), end], 0, maxKw / 2, "idle");
        const same = slots.filter((o) => o.row === s.row && o.zone.id !== z.id);
        // nearest neighbour in the row (ties go to the one further along the feeder)
        const nb = same.sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x) || b.x - a.x)[0];
        if (nb) {
          // a tie line between the two platforms, in front of them
          const edge = s.pos.z - sign * 1.15;
          const tie = s.pos.z - sign * 1.95;
          const dx = nb.x > s.x ? 0.55 : -0.55;
          this.addLine(
            [new THREE.Vector3(nb.x - dx, 0, edge), new THREE.Vector3(nb.x - dx, 0, tie), new THREE.Vector3(s.x + dx, 0, tie), new THREE.Vector3(s.x + dx, 0, edge)],
            z.demandKw,
            maxKw / 2,
            "reroute",
          );
        }
      } else {
        this.addLine([new THREE.Vector3(s.x, 0, SPINE_Z), end], faulted ? 0 : z.demandKw, maxKw / 2, faulted ? "fault" : "zone");
      }
      const peakSaving = z.status === "reduced" && !!z.note?.startsWith("Pre-cool");
      const status = faulted ? "Fault" : rerouted ? "Rerouted" : peakSaving ? "Peak saving" : z.status === "reduced" ? "Reduced" : undefined;
      this.setLabel(z.id, z.name, formatKw(z.demandKw), status, faulted ? "fault" : rerouted ? "reroute" : z.status === "reduced" && !peakSaving ? "warning" : "zone", z.priority === "critical");
      this.ring(z.id, faulted ? "fault" : rerouted ? "reroute" : "zone", z.status === "reduced" && !peakSaving && !rerouted);
      // windows dim when the building is dark or running reduced
      this.setWindows(z.id, faulted ? 0.04 : z.status === "reduced" ? 0.55 : 1);
    }
    this.requestFrame();
  }

  private setWindows(id: string, level: number) {
    const node = this.nodes.get(id);
    if (!node) return;
    node.model.traverse((o) => {
      if (o.userData.isWindows) {
        const inst = o as THREE.InstancedMesh;
        if (inst.material !== this.mats.models.window && level === 1) {
          (inst.material as THREE.Material).dispose();
          inst.material = this.mats.models.window;
        } else if (level !== 1) {
          const m = this.mats.models.window.clone();
          m.emissiveIntensity = level;
          m.color.copy(this.mats.models.window.color).multiplyScalar(0.4 + 0.6 * level);
          if (inst.material !== this.mats.models.window) (inst.material as THREE.Material).dispose();
          inst.material = m;
        }
      }
    });
  }

  private ring(id: string, tone: Tone, warn = false) {
    const node = this.nodes.get(id);
    if (!node) return;
    const mat = node.ring.material as THREE.LineBasicMaterial;
    mat.color.copy(warn ? this.pal.warning : this.tone(tone));
    node.ring.userData.fault = tone === "fault";
  }

  private setLabel(id: string, rawName: string, rawValue: string, rawSub: string | undefined, tone: string, shield = false) {
    const node = this.nodes.get(id);
    if (!node) return;
    const esc = (t: string) => t.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
    const name = esc(this.compact ? shortName(rawName) : rawName);
    const value = esc(rawValue);
    const sub = rawSub === undefined ? undefined : esc(rawSub);
    const el = node.label.element;
    el.dataset.tone = tone;
    el.innerHTML =
      `<span class="grid3d-label__name">${name}${shield ? ' <span aria-hidden="true" class="grid3d-label__shield">◆</span>' : ""}</span>` +
      `<span class="grid3d-label__value">${value}</span>` +
      (sub ? `<span class="grid3d-label__sub">${sub}</span>` : "");
  }

  // ---------- sizing / camera ----------
  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.narrow = width < 520;
    const wasCompact = this.compact;
    this.compact = width < 760;
    if (wasCompact !== this.compact && this.state) this.update(this.state);
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.domElement.style.width = `${this.width}px`;
    this.renderer.domElement.style.height = `${this.height}px`;
    this.labels.setSize(this.width, this.height);
    this.host.classList.toggle("grid3d--narrow", this.narrow);
    this.host.classList.toggle("grid3d--compact", this.compact);

    // On phones the campus is turned so its long side runs top to bottom.
    this.root.rotation.y = this.narrow ? -Math.PI / 2 : 0;
    this.root.updateMatrixWorld(true);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.fitCamera();
    this.requestFrame();
  }

  /** Moves the camera back until every platform and label fits in the frame. */
  private fitCamera() {
    const pts: THREE.Vector3[] = [];
    const labelPts: THREE.Vector3[] = [];
    for (const n of this.nodes.values()) {
      const c = n.group.getWorldPosition(new THREE.Vector3());
      for (const [dx, dz] of [[-1.3, -1.2], [1.3, -1.2], [-1.3, 1.2], [1.3, 1.2]]) pts.push(c.clone().add(new THREE.Vector3(dx, 0, dz)));
      const lp = n.label.getWorldPosition(new THREE.Vector3());
      pts.push(lp);
      labelPts.push(lp);
    }
    // Labels are ~120 x 44 px boxes centred on their anchor.
    const padX = (this.compact ? 40 : 62) / (this.width / 2);
    const padY = (this.compact ? 18 : 26) / (this.height / 2);
    if (!pts.length) return;
    const box = new THREE.Box3().setFromPoints(pts);
    const target = box.getCenter(new THREE.Vector3());
    target.y = 0.4;
    const dir = (this.narrow ? new THREE.Vector3(-0.06, 0.9, 0.44) : new THREE.Vector3(-0.12, 0.74, 0.66)).normalize();
    const margin = this.narrow ? 0.95 : 0.93;
    const place = (d: number) => {
      this.camera.position.copy(target).add(dir.clone().multiplyScalar(d));
      this.camera.lookAt(target);
      this.camera.updateMatrixWorld(true);
    };
    const bounds = () => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) {
        const q = p.clone().project(this.camera);
        const isLabel = labelPts.includes(p);
        const px = isLabel ? padX : 0;
        const py = isLabel ? padY : 0;
        x0 = Math.min(x0, q.x - px); x1 = Math.max(x1, q.x + px); y0 = Math.min(y0, q.y - py); y1 = Math.max(y1, q.y + py);
      }
      return { x0, x1, y0, y1 };
    };
    const search = () => {
      let lo = 4;
      let hi = 220;
      for (let i = 0; i < 26; i++) {
        const mid = (lo + hi) / 2;
        place(mid);
        const b = bounds();
        if (Math.max(-b.x0, b.x1, -b.y0, b.y1) <= margin) hi = mid;
        else lo = mid;
      }
      place(hi);
      return hi;
    };
    let hi = search();
    // Re-centre on what is actually drawn (labels make the top heavier), then fit again.
    for (let k = 0; k < 3; k++) {
      const b = bounds();
      const ox = (b.x0 + b.x1) / 2;
      const oy = (b.y0 + b.y1) / 2;
      const halfH = hi * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const halfW = halfH * this.camera.aspect;
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      target.add(right.multiplyScalar(ox * halfW)).add(up.multiplyScalar(oy * halfH));
      hi = search();
    }
    this.controls.target.copy(target);
    this.controls.minDistance = hi * 0.7;
    this.controls.maxDistance = hi * 1.3;
    this.controls.minAzimuthAngle = -0.8;
    this.controls.maxAzimuthAngle = 0.6;
    this.controls.update();
  }

  // ---------- loop ----------
  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.clock.getDelta();
    const tick = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      this.frame(this.clock.getDelta());
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** One frame when animation is off (reduced motion / paused). */
  requestFrame() {
    if (this.running || this.disposed) return;
    requestAnimationFrame(() => this.frame(0));
  }

  private frame(dt: number) {
    if (this.disposed) return;
    this.controls.update();
    if (!this.reduceMotion && dt > 0) {
      const speed = 1.6; // world units per second
      for (const l of this.lines) {
        if (!l.dots) continue;
        l.phase = (l.phase + (dt * speed) / l.length) % 1;
        this.placeDots(l);
      }
      // faults blink
      this.faultT += dt;
      const blink = 0.55 + 0.45 * Math.sin(this.faultT * 6);
      this.lineGroup.traverse((o) => {
        if (o.userData.fault) o.visible = blink > 0.3;
      });
      for (const n of this.nodes.values()) {
        if (n.ring.userData.fault) (n.ring.material as THREE.LineBasicMaterial).opacity = 0.4 + 0.6 * blink;
        else (n.ring.material as THREE.LineBasicMaterial).opacity = 0.9;
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.controls.dispose();
    this.clearLines();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose?.();
    });
    this.dotGeo.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}

