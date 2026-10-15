// 3D header: the FSAE car with clickable subsystems.
// Hotspots are built from the project register: any element with data-car-group
// (the name of a parent Empty in the .glb) becomes a hotspot anchored at that Empty.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Camera offsets from each subsystem's Empty, in model space
// (+X = car's left, +Y = up, +Z = forward). Tune these if a view feels off.
const VIEWS = {
  suspension: [1.2, 0.55, 1.15],
  tires: [1.45, 0.22, 0.6],
  steering: [0.32, 0.42, -0.78],
};
const DEFAULT_VIEW = { azimuth: 38, polar: 71, distance: 4.7, targetHeight: 0.36 };
const FOV_V = 30;          // vertical field of view on wide screens (degrees)
const FIT_ASPECT = 1.6;    // below this aspect ratio the horizontal field of view is held instead

const stage = document.querySelector("[data-car-stage]");
if (stage) start(stage);

function start(stage) {
  const host = stage.querySelector(".stage-canvas");
  const status = stage.querySelector(".stage-status");
  const layer = stage.querySelector(".hotspots");
  const exploreBtn = stage.querySelector("[data-explore]");
  const hint = stage.querySelector(".stage-hint");
  const dock = document.createElement("div");
  dock.className = "stage-dock";
  dock.hidden = true;
  dock.setAttribute("aria-live", "polite");
  dock.innerHTML = `
    <h2 class="dock-title"></h2>
    <p class="dock-result"></p>
    <div class="dock-actions">
      <a class="btn btn-solid dock-link">View project</a>
      <button class="btn dock-reset" type="button">Reset view</button>
    </div>`;
  stage.appendChild(dock);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;

  const setStatus = (text) => { status.hidden = !text; status.textContent = text || ""; };
  const fail = (why) => {
    console.warn("3D view unavailable:", why);
    setStatus("3D view unavailable on this device. Showing a still image.");
    layer.hidden = true;
    if (exploreBtn) exploreBtn.hidden = true;
    if (hint) hint.hidden = true;
  };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) { fail(e); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-label", "Interactive 3D model of the car");
  renderer.domElement.setAttribute("role", "img");

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 5, 4);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(FOV_V, 1, 0.03, 60);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 0.55;
  controls.maxDistance = 9;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
  controls.rotateSpeed = 0.7;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.45;
  controls.enabled = !coarse;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  // ---- systems from the project register ----
  const systems = [...document.querySelectorAll("[data-car-group]")].map((row) => ({
    key: row.dataset.carSystem,
    group: row.dataset.carGroup,
    title: row.querySelector("[data-title]")?.textContent.trim() || "",
    result: row.querySelector("[data-result]")?.textContent.trim() || "",
    href: row.querySelector("a[data-link]")?.getAttribute("href") || "#",
    offset: VIEWS[row.dataset.carSystem] || [1.2, 0.5, 1.0],
    meshes: [], meshSet: new Set(), anchor: new THREE.Vector3(),
    glow: 0, el: null, behind: false,
  }));
  let hovered = null, focused = null;
  let clock = () => performance.now();
  let flight = null;

  // ---- sizing ----
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    if (aspect >= FIT_ASPECT) camera.fov = FOV_V;
    else {
      const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV_V / 2)) * FIT_ASPECT);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hHalf) / aspect));
    }
    applyViewOffset();
  }
  // Wide screens: slide the car right so the intro sits beside it. Phones: when a system is
  // focused, slide the view up so the details panel at the bottom doesn't cover it.
  let shiftY = 0;
  function applyViewOffset() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const shiftX = w >= 900 ? w * 0.21 : 0;
    if (shiftX || shiftY > 0.5) camera.setViewOffset(w, h, -shiftX, shiftY, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  function easeViewOffset(dt) {
    const goal = stage.clientWidth < 900 && focused ? stage.clientHeight * 0.2 : 0;
    if (Math.abs(goal - shiftY) < 0.5) { if (shiftY !== goal) { shiftY = goal; applyViewOffset(); } return; }
    shiftY += (goal - shiftY) * Math.min(1, dt * 6);
    applyViewOffset();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---- load ----
  const loader = new GLTFLoader();
  if (stage.dataset.draco) {
    const draco = new DRACOLoader();
    draco.setDecoderPath(stage.dataset.draco);
    loader.setDRACOLoader(draco);
  }
  setStatus("Loading 3D model…");
  loader.load(
    stage.dataset.model,
    (gltf) => { try { onLoad(gltf.scene); } catch (e) { fail(e); } },
    (e) => { if (e.total) setStatus(`Loading 3D model… ${Math.round((e.loaded / e.total) * 100)}%`); },
    (e) => fail(e)
  );

  const pickable = [];
  let home = null;
  const glowColor = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue("--glow").trim() || "#2fbf8a");

  function onLoad(root) {
    scene.add(root);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    root.traverse((o) => { if (o.isMesh) pickable.push(o); });
    addContactShadow(box, size);

    for (const s of systems) {
      const node = root.getObjectByName(s.group);
      if (!node) { console.warn(`No "${s.group}" in the model`); continue; }
      node.getWorldPosition(s.anchor);
      node.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();   // own copy, so highlighting doesn't touch shared materials
        o.userData.baseEmissive = o.material.emissive.clone();
        o.userData.baseIntensity = o.material.emissiveIntensity;
        o.userData.system = s;
        s.meshes.push(o); s.meshSet.add(o);
      });
      s.el = makeHotspot(s);
    }

    const target = new THREE.Vector3(center.x, box.min.y + size.y * DEFAULT_VIEW.targetHeight, center.z);
    const narrow = stage.clientWidth / stage.clientHeight < 1;
    const offset = new THREE.Vector3().setFromSphericalCoords(
      DEFAULT_VIEW.distance * (narrow ? 0.86 : 1),
      THREE.MathUtils.degToRad(DEFAULT_VIEW.polar),
      THREE.MathUtils.degToRad(DEFAULT_VIEW.azimuth)
    );
    home = { target, position: target.clone().add(offset) };
    camera.position.copy(home.position);
    controls.target.copy(home.target);
    controls.update();

    stage.classList.add("is-ready");
    setStatus("");
    if (!reduceMotion) systems.forEach((s) => s.el?.querySelector(".hotspot-dot").classList.add("pulse"));
    window.__carViewer = { camera, controls, home, systems };   // handy for tuning views in the console

    const fromHash = location.hash.match(/^#car-([a-z0-9-]+)$/);
    if (fromHash) {
      const s = systems.find((x) => x.key === fromHash[1]);
      if (s) setTimeout(() => focus(s), 300);
    }
  }

  function addContactShadow(box, size) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grd.addColorStop(0, "rgba(0,0,0,0.55)");
    grd.addColorStop(0.55, "rgba(0,0,0,0.22)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(size.x * 1.7, size.z * 1.25),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set((box.min.x + box.max.x) / 2, box.min.y + 0.002, (box.min.z + box.max.z) / 2);
    plane.renderOrder = -1;
    scene.add(plane);
  }

  // ---- hotspots ----
  function makeHotspot(s) {
    const el = document.createElement("div");
    el.className = "hotspot";
    el.innerHTML = `
      <button class="hotspot-dot" type="button" aria-expanded="false"></button>
      <div class="hotspot-card">
        <p class="hotspot-title"></p>
        <p class="hotspot-result"></p>
        <a class="hotspot-link">View project</a>
      </div>`;
    const dot = el.querySelector(".hotspot-dot");
    dot.setAttribute("aria-label", `${s.title}: show on the car`);
    el.querySelector(".hotspot-title").textContent = s.title;
    el.querySelector(".hotspot-result").textContent = s.result;
    el.querySelector(".hotspot-link").href = s.href;
    dot.addEventListener("click", () => (focused === s ? openProject(s) : focus(s)));
    el.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && !flight) setHover(s); });
    el.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") setHover(null); });
    dot.addEventListener("focus", () => setHover(s));
    dot.addEventListener("blur", () => setHover(null));
    layer.appendChild(el);
    return el;
  }
  function openProject(s) { location.href = s.href; }

  function setHover(s) { hovered = s; syncHotspots(); }
  function syncHotspots() {
    const shown = hovered && hovered !== focused ? hovered : null;   // hover cards only; focus uses the dock
    for (const s of systems) {
      if (!s.el) continue;
      const open = s === shown;
      s.el.classList.toggle("is-open", open);
      s.el.classList.toggle("is-active", s === focused);
      s.el.querySelector(".hotspot-dot").setAttribute("aria-expanded", String(s === focused));
    }
    renderer.domElement.style.cursor = hovered ? "pointer" : "";
  }

  // ---- camera moves (swing around the car in spherical coordinates, never through it) ----
  function flyTo(position, target, ms = 1100) {
    controls.autoRotate = false;
    const from = { target: controls.target.clone(), off: new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)) };
    const to = { target: target.clone(), off: new THREE.Spherical().setFromVector3(position.clone().sub(target)) };
    let dTheta = to.off.theta - from.off.theta;
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));     // shortest way around
    flight = { from, to, dTheta, t0: clock(), ms: reduceMotion ? 0 : ms };
  }
  function stepFlight(now) {
    if (!flight) return;
    const k = flight.ms ? Math.min(1, (now - flight.t0) / flight.ms) : 1;
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const { from, to } = flight;
    const sph = new THREE.Spherical(
      from.off.radius + (to.off.radius - from.off.radius) * e,
      from.off.phi + (to.off.phi - from.off.phi) * e,
      from.off.theta + flight.dTheta * e
    );
    controls.target.lerpVectors(from.target, to.target, e);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
    if (k >= 1) flight = null;
  }
  function focus(s) {
    if (!s.meshes.length) return;
    focused = s;
    const pos = s.anchor.clone().add(new THREE.Vector3(...s.offset));
    flyTo(pos, s.anchor);
    syncHotspots();
    stage.closest(".hero")?.classList.add("is-focused");
    dock.querySelector(".dock-title").textContent = s.title;
    dock.querySelector(".dock-result").textContent = s.result;
    dock.querySelector(".dock-link").href = s.href;
    dock.hidden = false;
  }
  function reset() {
    focused = null; hovered = null;
    if (home) flyTo(home.position, home.target);
    syncHotspots();
    stage.closest(".hero")?.classList.remove("is-focused");
    dock.hidden = true;
  }
  dock.querySelector(".dock-reset").addEventListener("click", reset);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && focused) reset(); });

  // "Show on car" buttons in the project register
  document.querySelectorAll("[data-show-on-car]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = systems.find((x) => x.key === btn.dataset.showOnCar);
      stage.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      if (s) setTimeout(() => focus(s), reduceMotion ? 0 : 450);
    });
  });

  // touch screens: one finger scrolls the page until "Explore in 3D" is on
  if (exploreBtn) {
    exploreBtn.hidden = !coarse;
    exploreBtn.addEventListener("click", () => {
      const on = !stage.classList.contains("is-exploring");
      stage.classList.toggle("is-exploring", on);
      controls.enabled = on;
      controls.autoRotate = false;
      exploreBtn.textContent = on ? "Done exploring" : "Explore in 3D";
      exploreBtn.setAttribute("aria-pressed", String(on));
    });
  }
  if (hint) hint.textContent = coarse ? "Tap a marker to see that system" : "Drag to rotate · scroll to zoom · select a marker";

  // ---- pointer picking on the model itself (mouse only) ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null, pickQueued = false, lastMove = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || e.buttons || flight) return;
    lastMove = e;
    if (!pickQueued) { pickQueued = true; requestAnimationFrame(() => { pickQueued = false; const s = pick(lastMove); if (s !== hovered) setHover(s); }); }
  });
  renderer.domElement.addEventListener("pointerleave", () => { if (hovered && !hovered.el?.matches(":hover")) setHover(null); });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const s = pick(e);
    if (s) focus(s);
  });
  function pick(e) {
    if (!pickable.length) return null;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickable, false)[0];
    return hit?.object.userData.system || null;
  }

  // ---- per-frame updates ----
  const tmp = new THREE.Vector3();
  let lastOcclusion = 0;
  function placeHotspots(now) {
    const w = stage.clientWidth, h = stage.clientHeight;
    const checkOcclusion = now - lastOcclusion > 150;
    if (checkOcclusion) lastOcclusion = now;
    for (const s of systems) {
      if (!s.el) continue;
      tmp.copy(s.anchor).project(camera);
      const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
      s.el.classList.toggle("is-hidden", !visible);
      if (!visible) continue;
      const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
      s.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      s.el.classList.toggle("flip", x > w * 0.6);
      if (checkOcclusion) {
        const dist = camera.position.distanceTo(s.anchor);
        ray.set(camera.position, tmp.copy(s.anchor).sub(camera.position).normalize());
        ray.far = dist;
        const hit = ray.intersectObjects(pickable, false)[0];
        ray.far = Infinity;
        s.behind = !!hit && hit.distance < dist - 0.04 && !s.meshSet.has(hit.object);
        s.el.classList.toggle("is-behind", s.behind && s !== focused && s !== hovered);
      }
    }
  }
  function updateGlow(dt) {
    for (const s of systems) {
      const goal = s === hovered ? 1 : s === focused ? 0.15 : 0;
      const next = s.glow + (goal - s.glow) * Math.min(1, dt * 10);
      if (Math.abs(next - s.glow) < 0.001 && next === goal) continue;
      s.glow = Math.abs(next - goal) < 0.002 ? goal : next;
      for (const m of s.meshes) {
        m.material.emissive.copy(m.userData.baseEmissive).lerp(glowColor, s.glow * 0.55);
        m.material.emissiveIntensity = Math.max(m.userData.baseIntensity, s.glow > 0 ? 1 : m.userData.baseIntensity);
      }
    }
  }

  function frame(now, dt) {
    stepFlight(now);
    easeViewOffset(dt);
    controls.update();
    updateGlow(dt);
    camera.updateMatrixWorld();   // project markers with this frame's camera, not last frame's
    if (home) placeHotspots(now);
    renderer.render(scene, camera);
  }

  // Automated screenshot tests (?still under a test browser) step frames by hand instead of animating.
  if (navigator.webdriver && new URLSearchParams(location.search).has("still")) {
    let simT = 0;
    clock = () => simT;
    window.__carStep = (ms = 16) => { simT += ms; frame(simT, ms / 1000); };
    return;
  }

  // render only while the stage is on screen and the tab is visible
  let onScreen = true, last = performance.now();
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }, { threshold: 0.01 }).observe(stage);
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!onScreen || document.hidden) return;
    frame(now, dt);
  });
}
