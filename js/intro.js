// Load intro: the business card is drawn out of a flip-top steel case.
// The case is real geometry with a physically based steel material lit by a
// studio environment map. The card in the scene is a texture painted from the
// live HTML card, and it lands exactly on top of it, so the hand-off at the
// end is invisible. The inline script in index.html decides whether to play.
import * as THREE from 'three';

const root = document.documentElement;

if (root.classList.contains('intro')) {
  play().catch((err) => {
    console.error(err);
    root.classList.remove('intro');
  });
}

// Timeline, in ms.
const T = {
  settle: [0, 900],
  clasp: [950, 1150],
  pop: [1100, 1300],
  lid: [1300, 2250],
  slide: [2350, 2850],
  lift: [2800, 3250],
  fly: [3150, 4000],
  exit: [3250, 4000],
  end: 4000,
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const phase = (t, [a, b]) => clamp01((t - a) / (b - a));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeOut = (x) => 1 - (1 - x) ** 3;
const easeIn = (x) => x * x * x;
const lerp = (a, b, x) => a + (b - a) * x;

async function play() {
  const card = document.querySelector('.card');
  await document.fonts.ready;
  // A PNG, not the SVG the page uses: Safari taints any canvas an SVG filter
  // is drawn into, and WebGL then refuses the card texture.
  const paper = await loadImage('assets/paper.png').catch(() => null);

  const startWidth = window.innerWidth;
  const rect = card.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  const canvas = renderer.domElement;
  canvas.className = 'intro-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  // Size the scene to the canvas as laid out, not to innerWidth/innerHeight:
  // on iOS Safari a fixed full-screen box can be taller than innerHeight
  // (toolbars), and the frame would stretch to fit it, missing the card.
  const box = canvas.getBoundingClientRect();
  const vw = box.width;
  const vh = box.height;
  renderer.setSize(vw, vh, false);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = makeStudio();
  scene.environment = pmrem.fromScene(studio, 0).texture;
  studio.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });

  // One world unit = one CSS pixel on the z = 0 plane.
  const fov = 30;
  const dist = vh / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const camera = new THREE.PerspectiveCamera(fov, vw / vh, 1, dist * 6);
  camera.position.set(0, 0, dist);

  const final = new THREE.Vector3(rect.left - box.left + W / 2 - vw / 2, vh / 2 - (rect.top - box.top + H / 2), 0);

  // ---- Case ----------------------------------------------------------
  // A clamshell like the one in the film: a base tray with a rounded barrel
  // along the bottom, and a lid hinged to it along the top edge of the seam
  // (the hinge sits inside, so nothing shows). Closed, the lid's clip hooks
  // onto the barrel. Local axes: x across, y up, z out of the front.
  const s = W / 600;
  const t = 0.011 * W; // wall thickness, ~1 mm on a real case
  const D = 0.09 * W; // overall thickness
  const R = D / 2; // barrel radius
  const CW = W + 2 * t + 6 * s;
  const CH = H + 0.7 * R + t + 3 * s;
  const yb = -CH / 2 + R; // barrel axis
  const zs = -D / 2 + D * 0.58; // seam between base (behind) and lid (in front)

  const steel = new THREE.MeshPhysicalMaterial({
    color: 0xe2e5ea,
    metalness: 1,
    roughness: 0.03,
    // A clear lacquer layer on top keeps highlights crisp, like polished chrome.
    clearcoat: 1,
    clearcoatRoughness: 0.02,
  });
  const steelDark = steel.clone();
  steelDark.color.set(0xbdc0c5);
  // The inside is brushed satin, as on real cases. A flat mirror swinging
  // through the studio strobes as each light sweeps across it.
  steelDark.roughness = 0.24;
  steelDark.anisotropy = 0.6;
  steelDark.clearcoat = 0;

  const caseGroup = new THREE.Group();
  scene.add(caseGroup);
  const put = (mesh, x, y, z, parent = caseGroup) => {
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // Walls butt against the plates rather than overlapping them; coincident
  // surfaces shimmer as the case moves.
  // Base: back plate, side walls, the notched front lip, the barrel. The
  // hinge edge is open so a card can slide up and out.
  const wallH = CH / 2 - yb;
  const baseD = zs + D / 2;
  put(slab(CW, wallH, t, 3 * s, [steelDark, steel]), 0, yb + wallH / 2, -D / 2 + t / 2);
  for (const side of [-1, 1]) {
    put(slab(t, wallH, baseD - t, 0.8 * s, steel), side * (CW / 2 - t / 2), yb + wallH / 2, -D / 2 + t + (baseD - t) / 2);
  }
  put(lipMesh(CW, CH * 0.2, CH * 0.1, t, steel), 0, yb, zs - t / 2 - 0.5 * s);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(R, R, CW, 64, 1), steel);
  barrel.rotation.z = Math.PI / 2;
  put(barrel, 0, yb, 0);

  // Lid: front plate with a raised panel, a rim on the sides and free edge,
  // and the clip.
  // Its parts are placed relative to the hinge line.
  const lidPivot = put(new THREE.Group(), 0, CH / 2, zs);
  const lidD = D / 2 - zs;
  const toHinge = (mesh, x, y, z) => put(mesh, x, y - CH / 2, z - zs, lidPivot);
  toHinge(slab(CW, wallH, t, 3 * s, [steel, steelDark]), 0, yb + wallH / 2, D / 2 - t / 2);
  const inset = CH * 0.045;
  toHinge(slab(CW - 2 * inset, wallH - 2 * inset, 3 * s, 3 * s, steel), 0, yb + wallH / 2, D / 2 + 1.2 * s);
  for (const side of [-1, 1]) {
    toHinge(slab(t, wallH, lidD - t, 0.8 * s, steel), side * (CW / 2 - t / 2), yb + wallH / 2, zs + (lidD - t) / 2);
  }
  toHinge(slab(CW - 2 * t, t, lidD - t, 0.8 * s, steel), 0, yb + t / 2, zs + (lidD - t) / 2);
  // The clip curls from the lid's bottom edge around the front of the barrel.
  const clipPivot = toHinge(new THREE.Group(), 0, yb, D / 2);
  put(clipMesh(W * 0.075, R, t * 0.8, steel), 0, 0, -D / 2, clipPivot);

  // ---- Card ----------------------------------------------------------
  const tex = new THREE.CanvasTexture(paintCard(card, rect, paper, dpr));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const face = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const edge = new THREE.MeshBasicMaterial({ color: 0xe6e4de, toneMapped: false });
  const cardMesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.8 * s), [edge, edge, edge, edge, face, edge]);
  scene.add(cardMesh);
  // The rest of the stack stays behind in the tray.
  const cardY = yb - 0.3 * R + H / 2;
  const cardZ = zs - t - 1.5 * s;
  const stackD = cardZ - (-D / 2 + t) - 1 * s;
  const stackEdge = new THREE.MeshBasicMaterial({ color: 0xd9d6cf, toneMapped: false });
  stackEdge.color.setScalar(0.85);
  const stack = new THREE.Mesh(new THREE.BoxGeometry(W, H, stackD), [stackEdge, stackEdge, stackEdge, stackEdge, face.clone(), stackEdge]);
  stack.material[4].color.setScalar(0.7);
  put(stack, 0, cardY, cardZ - 0.4 * s - stackD / 2);

  // Case poses. Each sits far enough back to fit the viewport with margin:
  // closed and centered, then (lid open flat, twice as tall) centered on the
  // hinge, which is the middle of the open case.
  // Closed, it sits at a three-quarter angle; as it opens it squares up to
  // face the viewer, so the open case reads centered and level.
  const tilt = -0.75;
  const openTilt = -0.62;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const fitDepth = (w, h) => -Math.max(0, Math.max(h / (2 * tanHalf), w / (2 * tanHalf * (vw / vh))) - dist);
  const closedAt = new THREE.Vector3(final.x, final.y, fitDepth(CW * 1.35, (CH * Math.cos(tilt) + D) * 1.5));
  const openTall = Math.cos(openTilt);
  const openAt = new THREE.Vector3(final.x, final.y - (CH / 2) * openTall, fitDepth(CW * 1.25, (2 * CH * openTall + D) * 1.3));

  // ---- Run -----------------------------------------------------------
  let start = null;
  let done = false;
  const trayPos = new THREE.Vector3();
  const trayQuat = new THREE.Quaternion();
  const liftPos = new THREE.Vector3();
  const liftQuat = new THREE.Quaternion();
  const identity = new THREE.Quaternion();
  const tmp = new THREE.Object3D();

  // Test hook: a page that sets window.introAt renders that moment and stops.
  const frozenAt = window.introAt;

  function frame(now) {
    if (done) return;
    if (start === null) {
      // The failsafe covers setup too; if it already fired, the card is up.
      clearTimeout(window.introFailsafe);
      if (!root.classList.contains('intro')) return finish();
      start = now;
      canvas.classList.add('shown');
    }
    const t = frozenAt ?? now - start;

    // Case settles in, drifting slowly so reflections slide across it,
    // then backs off as it opens, then drops away once the card is out.
    const a = easeOut(phase(t, T.settle));
    const o = easeInOut(phase(t, T.lid));
    const ex = easeInOut(phase(t, T.exit));
    caseGroup.position.set(
      lerp(closedAt.x, openAt.x, o),
      lerp(closedAt.y - H * 0.12, closedAt.y, a) + (openAt.y - closedAt.y) * o,
      lerp(closedAt.z, openAt.z, o) - ex * H * 0.6,
    );
    const closedYaw = lerp(-0.32, -0.26, phase(t, [0, T.lid[0]]));
    const openYaw = lerp(-0.04, 0.02, phase(t, [T.lid[1], T.end]));
    caseGroup.rotation.set(
      lerp(lerp(tilt - 0.3, tilt, a), openTilt, o),
      lerp(closedYaw, openYaw, o),
      lerp(lerp(0.03, 0, a), 0, o),
    );
    // On the way out the case recedes and its reflections fade to black, so
    // it dissolves into the page without leaving the frame.
    steel.envMapIntensity = steelDark.envMapIntensity = 1 - ex;
    stack.material[4].color.setScalar(0.7 * (1 - ex));
    stackEdge.color.setScalar(0.85 * (1 - ex));

    // The clip springs out off the barrel, the lid pops, then swings back on
    // its hinge until it lies flat, like an open book. Flat is the least it
    // can open: any less and its far end rises into the card's path as the
    // card slides up over the hinge.
    clipPivot.rotation.x = -0.35 * easeOut(phase(t, T.clasp)) * (1 - phase(t, T.lid));
    const pop = 0.06 * easeOut(phase(t, T.pop));
    lidPivot.rotation.x = -(t < T.lid[0] ? pop : lerp(pop, Math.PI, easeInOut(phase(t, T.lid))));

    // Card: slides up in the tray until it clears the lip, lifts out, then
    // turns and flies to its spot on the page.
    caseGroup.updateMatrixWorld();
    tmp.position.set(0, cardY, cardZ);
    tmp.quaternion.identity();
    caseGroup.add(tmp);
    tmp.updateMatrixWorld();
    tmp.getWorldPosition(trayPos);
    tmp.getWorldQuaternion(trayQuat);
    const sl = easeInOut(phase(t, T.slide));
    const l = easeInOut(phase(t, T.lift));
    tmp.position.set(0, cardY + H * 0.3 * sl, cardZ + H * 0.55 * l);
    tmp.rotation.x = 0.15 * l;
    tmp.updateMatrixWorld();
    tmp.getWorldPosition(liftPos);
    tmp.getWorldQuaternion(liftQuat);
    caseGroup.remove(tmp);

    const f = easeInOut(phase(t, T.fly));
    if (t < T.fly[0]) {
      cardMesh.position.copy(liftPos);
      cardMesh.quaternion.copy(liftQuat);
    } else {
      cardMesh.position.lerpVectors(liftPos, final, f);
      cardMesh.quaternion.slerpQuaternions(liftQuat, identity, f);
    }
    // In the shade of the case until it comes out.
    face.color.setScalar(lerp(0.78, 1, Math.max(sl * 0.3, l * 0.7, f)));

    renderer.render(scene, camera);
    if (frozenAt !== undefined) return;
    if (t >= T.end) finish();
    else requestAnimationFrame(frame);
  }

  function finish() {
    if (done) return;
    done = true;
    root.classList.remove('intro');
    canvas.classList.remove('shown');
    removeEventListener('pointerdown', finish);
    removeEventListener('keydown', finish);
    removeEventListener('resize', onResize);
    setTimeout(() => {
      canvas.remove();
      scene.traverse((o) => o.geometry?.dispose());
      [steel, steelDark, face, edge, stackEdge, stack.material[4]].forEach((m) => m.dispose());
      tex.dispose();
      pmrem.dispose();
      renderer.dispose();
    }, 400);
  }

  // Any click or key skips straight to the card, as does a width change
  // (rotation). Height-only resizes are mobile toolbars; ignore those.
  const onResize = () => { if (window.innerWidth !== startWidth) finish(); };
  addEventListener('pointerdown', finish);
  addEventListener('keydown', finish);
  addEventListener('resize', onResize);
  requestAnimationFrame(frame);
}

// A rounded rectangle plate with beveled edges, centered on the origin.
// `material` may be [front, back]; the edges take the front material.
function slab(w, h, depth, radius, material) {
  const bevel = Math.min(depth * 0.4, radius * 0.8);
  const iw = w - 2 * bevel;
  const ih = h - 2 * bevel;
  const r = Math.max(0.01, Math.min(radius - bevel, iw / 2, ih / 2));
  const shape = new THREE.Shape();
  shape.moveTo(-iw / 2 + r, -ih / 2);
  shape.lineTo(iw / 2 - r, -ih / 2);
  shape.quadraticCurveTo(iw / 2, -ih / 2, iw / 2, -ih / 2 + r);
  shape.lineTo(iw / 2, ih / 2 - r);
  shape.quadraticCurveTo(iw / 2, ih / 2, iw / 2 - r, ih / 2);
  shape.lineTo(-iw / 2 + r, ih / 2);
  shape.quadraticCurveTo(-iw / 2, ih / 2, -iw / 2, ih / 2 - r);
  shape.lineTo(-iw / 2, -ih / 2 + r);
  shape.quadraticCurveTo(-iw / 2, -ih / 2, -iw / 2 + r, -ih / 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - 2 * bevel),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 10,
  });
  geo.center();
  if (!Array.isArray(material)) return new THREE.Mesh(geo, material);
  return splitCaps(geo, material);
}

// ExtrudeGeometry is non-indexed, with group 0 = both caps and group 1 = the
// sides. Reorder the cap triangles so front-facing ones come first, then give
// the back cap its own group so it can take a different material.
function splitCaps(geo, materials) {
  const attrs = Object.values(geo.attributes);
  const caps = geo.groups.find((g) => g.materialIndex === 0);
  const sides = geo.groups.find((g) => g.materialIndex === 1);
  const z = geo.attributes.position;
  const front = [];
  const back = [];
  for (let i = caps.start; i < caps.start + caps.count; i += 3) {
    (z.getZ(i) + z.getZ(i + 1) + z.getZ(i + 2) < 0 ? back : front).push(i);
  }
  const copies = attrs.map((a) => a.array.slice());
  [...front, ...back].forEach((src, n) => {
    attrs.forEach((a, k) => {
      const size = a.itemSize;
      a.array.set(copies[k].subarray(src * size, (src + 3) * size), (caps.start + n * 3) * size);
      a.needsUpdate = true;
    });
  });
  geo.clearGroups();
  geo.addGroup(caps.start, front.length * 3, 0);
  geo.addGroup(caps.start + front.length * 3, back.length * 3, 1);
  geo.addGroup(sides.start, sides.count, 0);
  return new THREE.Mesh(geo, materials);
}

// A dark photo studio: softboxes and light strips are what polished steel
// actually shows, as bright gradients and crisp bands on a near-black room.
function makeStudio() {
  const studio = new THREE.Scene();
  // The room itself: never pure black, or a mirror turned toward an unlit
  // corner shows a black hole. Lighter overhead, darker toward the floor.
  const sky = document.createElement('canvas');
  sky.width = 4;
  sky.height = 256;
  const sg = sky.getContext('2d');
  const sgrad = sg.createLinearGradient(0, 0, 0, 256);
  sgrad.addColorStop(0, '#45464b');
  sgrad.addColorStop(0.5, '#26272a');
  sgrad.addColorStop(1, '#1d1e21');
  sg.fillStyle = sgrad;
  sg.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(sky);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  studio.add(new THREE.Mesh(
    new THREE.SphereGeometry(9, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide }),
  ));
  // A softbox glows brightest in the middle and falls off toward its edges.
  const glow = document.createElement('canvas');
  glow.width = glow.height = 128;
  const g = glow.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.35, '#8c8c8c');
  grad.addColorStop(0.75, '#262626');
  grad.addColorStop(1, '#0c0c0c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(glow);

  const panel = (w, h, intensity, pos, rotX = 0, rotY = 0, map = null) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }));
    m.material.color.setScalar(intensity);
    m.position.set(...pos);
    m.rotation.set(rotX, rotY, 0);
    studio.add(m);
  };
  const flat = Math.PI / 2;
  // Broad sources keep every angle lit; thin, very bright strips give the
  // hard white lines that make chrome read as polished.
  panel(8, 6, 2, [0, 4.9, 2], flat, 0, glowTex); // big overhead-front softbox
  panel(8, 4, 1.5, [0, 2.5, -4.9], 0, 0, glowTex); // high softbox behind the case
  panel(10, 9, 1.4, [0, -4.9, 1], flat, 0, glowTex); // floor bounce
  panel(8, 3, 1.1, [0, -2.6, 4.9], 0, 0, glowTex); // low fill card in front
  panel(9, 0.3, 12, [0, 4.85, -1.6], flat); // crisp strip, overhead back
  panel(9, 0.22, 10, [0, 4.85, 0.6], flat); // crisp strip, overhead middle
  panel(9, 0.3, 12, [0, 4.85, 3.4], flat); // crisp strip, overhead front
  panel(9, 0.25, 9, [0, 1.6, 4.9]); // crisp band behind the camera
  panel(9, 0.2, 7, [0, -1.2, 4.9]); // low band behind the camera
  panel(0.35, 7, 9, [-4.9, 0.5, 1.5], 0, flat); // left strip
  panel(0.25, 7, 7, [4.9, 0.5, 1.5], 0, flat); // right strip
  panel(0.3, 6, 8, [0, 0.5, -4.85]); // vertical strip behind the case
  return studio;
}

// The base's front lip: tall at both ends, scooped down to a lower edge
// across the middle 85% so a thumb can reach the cards. Bottom at y = 0.
// The base's front lip: full height at both ends, with a square notch cut
// down to a lower edge across the middle 85% so a thumb can reach the cards.
// Bottom at y = 0; the notch corners get a small radius.
function lipMesh(w, tall, low, depth, material) {
  const edge = w / 2;
  const notch = w * 0.425;
  const rr = Math.min(w * 0.008, (tall - low) / 3);
  const shape = new THREE.Shape();
  shape.moveTo(-edge, 0);
  shape.lineTo(-edge, tall);
  shape.lineTo(-notch - rr, tall);
  shape.quadraticCurveTo(-notch, tall, -notch, tall - rr);
  shape.lineTo(-notch, low + rr);
  shape.quadraticCurveTo(-notch, low, -notch + rr, low);
  shape.lineTo(notch - rr, low);
  shape.quadraticCurveTo(notch, low, notch, low + rr);
  shape.lineTo(notch, tall - rr);
  shape.quadraticCurveTo(notch, tall, notch + rr, tall);
  shape.lineTo(edge, tall);
  shape.lineTo(edge, 0);
  shape.closePath();
  const bevel = depth * 0.35;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 24,
  });
  geo.translate(0, 0, -depth / 2 + bevel);
  return new THREE.Mesh(geo, material);
}

// The clip: a short band that curls from the lid's bottom edge down around
// the front of the barrel. Built around the barrel axis at the origin.
function clipMesh(width, radius, thickness, material) {
  const r0 = radius + 0.3;
  const r1 = r0 + thickness;
  const shape = new THREE.Shape();
  // Profile in (z, y): an arc from straight ahead (angle 0) down 55 degrees.
  const a0 = 0.15;
  const a1 = -0.95;
  shape.absarc(0, 0, r1, a0, a1, true);
  shape.absarc(0, 0, r0, a1, a0, false);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: thickness * 0.3,
    bevelSize: thickness * 0.3,
    bevelSegments: 3,
    curveSegments: 24,
  });
  // Shape x -> world z, shape y -> world y, extrusion -> world x.
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  return new THREE.Mesh(geo, material);
}

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

// Paint the HTML card onto a canvas: paper, then every letter at the exact
// spot the browser laid it out, with the same font and letterpress shadow.
function paintCard(card, rect, paper, scale) {
  const c = document.createElement('canvas');
  c.width = Math.round(rect.width * scale);
  c.height = Math.round(rect.height * scale);
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);

  ctx.fillStyle = getComputedStyle(card).backgroundColor;
  ctx.fillRect(0, 0, rect.width, rect.height);
  if (paper) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = ctx.createPattern(paper, 'repeat');
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  const range = document.createRange();
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const style = getComputedStyle(node.parentElement);
    // One glyph at a time, each at the exact spot the browser laid it out,
    // so spacing and kerning match the page and not the canvas's metrics.
    for (const m of node.data.matchAll(/\S/gu)) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const r = range.getClientRects()[0];
      if (r) drawWord(ctx, transform(m[0], style.textTransform), r.left - rect.left, r.top - rect.top, style);
    }
  }

  // Generated separators (the dot between the contact links).
  for (const el of card.querySelectorAll('li')) {
    const before = getComputedStyle(el, '::before');
    const text = before.content.match(/^"(.*)"$/)?.[1];
    const first = el.querySelector('a')?.firstChild;
    if (!text || !first) continue;
    range.selectNodeContents(first);
    const r = range.getClientRects()[0];
    const elRect = el.getBoundingClientRect();
    if (r) drawWord(ctx, text, elRect.left - rect.left + parseFloat(before.paddingLeft), r.top - rect.top, before);
  }
  return c;
}

function transform(text, mode) {
  if (mode === 'uppercase') return text.toUpperCase();
  if (mode === 'lowercase') return text.toLowerCase();
  return text;
}

function drawWord(ctx, text, x, y, style) {
  const caps = style.fontVariantCaps === 'small-caps' ? 'small-caps' : 'normal';
  ctx.font = `${style.fontStyle} ${caps} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  // Copperplate has no true small caps, so CSS synthesizes them from scaled
  // capitals. Ask the canvas for the same synthesis, or lowercase letters
  // render at a different size than on the page.
  if ('fontVariantCaps' in ctx) ctx.fontVariantCaps = caps;
  if ('letterSpacing' in ctx) ctx.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
  ctx.textBaseline = 'alphabetic';
  const base = y + ctx.measureText(text).fontBoundingBoxAscent;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(text, x, base + 1);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillText(text, x, base - 0.5);
  ctx.fillStyle = style.color;
  ctx.fillText(text, x, base);
}
