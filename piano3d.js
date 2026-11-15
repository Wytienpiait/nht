'use strict';

/* =====================================================================
   CÂY ĐÀN 3D THEO KHOẢNH KHẮC  (Three.js r128 — biến toàn cục THREE)
   - Cây đàn grand piano được dựng hoàn toàn bằng code, không cần file model.
   - Mỗi khoảnh khắc trong ngày có góc máy + ánh sáng riêng.
   - Kéo để xoay, chụm 2 ngón / Ctrl + cuộn để phóng to, chạm vào phím để nghe tiếng.
   ===================================================================== */
(() => {
  const stage = document.getElementById('piano3d');
  if (!stage) return;
  const canvas = document.getElementById('pianoCanvas');
  const tabs = [...document.querySelectorAll('.moment-tab')];
  const capTitle = document.getElementById('momentTitle');
  const capText = document.getElementById('momentText');
  const songsBtn = document.getElementById('momentSongs');
  const btnZoomIn = document.getElementById('p3dZoomIn');
  const btnZoomOut = document.getElementById('p3dZoomOut');
  const btnSway = document.getElementById('p3dSway');
  const btnReset = document.getElementById('p3dReset');
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- Nội dung & cấu hình từng khoảnh khắc ----------
  const SCENE_TEXT = {
    morning: 'Nắng sáng sớm chiếu nghiêng qua thân đàn.',
    rainy: 'Nghe mưa rơi ngoài ô cửa.',
    sunset: 'Hoàng hôn nhuộm vàng những phím đàn.',
    night: 'Cả căn phòng tắt đèn, chỉ còn ngọn đèn nhỏ trên phím đàn.'
  };
  // cam.pos / cam.target: vị trí máy quay và điểm nhìn (mét). light: trạng thái ánh sáng.
  const PRESETS = {
    morning: {
      cam: { pos: [2.4, 1.65, 2.8], target: [0, 0.9, -0.95] },
      light: { sunColor: 0xfff0d2, sunI: 2.3, sunPos: [-4, 5.5, 3], hemiSky: 0xdfe9ff, hemiGround: 0x4a4031, hemiI: 0.8,
               rimColor: 0xbcd2ff, rimI: 0.6, lampI: 0, glow: 0, poolColor: 0xffe6b8, poolOp: 0.28, env: 1.0, exposure: 1.05 }
    },
    rainy: {
      cam: { pos: [3.8, 1.3, -0.1], target: [0, 0.95, -1.0] },
      light: { sunColor: 0x9fb6dc, sunI: 1.0, sunPos: [-3, 4.5, 2.5], hemiSky: 0x7f94b8, hemiGround: 0x1a1d24, hemiI: 0.6,
               rimColor: 0x6f8fc0, rimI: 1.0, lampI: 0, glow: 0.05, poolColor: 0x8aa6d6, poolOp: 0.16, env: 0.6, exposure: 0.95 }
    },
    sunset: {
      cam: { pos: [-2.7, 1.9, 2.0], target: [0, 0.9, -0.9] },
      light: { sunColor: 0xff9440, sunI: 3.0, sunPos: [4.5, 1.8, 1.2], hemiSky: 0xffb27a, hemiGround: 0x2a1a12, hemiI: 0.55,
               rimColor: 0xff6a5a, rimI: 1.2, lampI: 0, glow: 0.1, poolColor: 0xff9a4a, poolOp: 0.36, env: 0.85, exposure: 1.1 }
    },
    night: {
      cam: { pos: [0.25, 1.4, 0.9], target: [0, 0.78, -0.3] },
      light: { sunColor: 0x6c84c8, sunI: 0.35, sunPos: [-3, 5, 2], hemiSky: 0x39466b, hemiGround: 0x0c0c10, hemiI: 0.35,
               rimColor: 0x7a8fe0, rimI: 0.5, lampI: 4.2, glow: 1, poolColor: 0xffc680, poolOp: 0.2, env: 0.35, exposure: 1.0 }
    }
  };

  let current = 'morning';
  let api = null; // được gán sau khi khởi tạo 3D

  // ---------- Giao diện: tab, chú thích, nút ----------
  function setMoment(name) {
    if (!PRESETS[name]) return;
    current = name;
    stage.dataset.moment = name;
    tabs.forEach(tab => {
      const on = tab.dataset.moment === name;
      tab.setAttribute('aria-pressed', String(on));
      tab.classList.toggle('active', on);
    });
    const info = typeof momentInfo !== 'undefined' ? momentInfo[name] : null;
    if (capTitle) capTitle.textContent = info ? info.title : name;
    if (capText) capText.textContent = SCENE_TEXT[name];
    if (api) api.goTo(name);
  }
  tabs.forEach(tab => tab.addEventListener('click', () => {
    if (tab.dataset.moment === current && api) api.goTo(current); // bấm lại để trả về góc nhìn gốc
    setMoment(tab.dataset.moment);
  }));
  songsBtn?.addEventListener('click', () => { if (typeof openModal === 'function') openModal(current); });
  setMoment(current);

  // ---------- Khởi tạo lười: chỉ dựng 3D khi người xem lướt gần tới ----------
  let inited = false;
  let visible = false;
  function onVisibility(entries) {
    visible = entries[0].isIntersecting;
    if (visible && !inited) { inited = true; init(); }
    else if (api) { stageVisible = visible; if (visible) api.start(); }
  }
  let stageVisible = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { stageVisible = entries[0].isIntersecting; onVisibility(entries); }, { rootMargin: '300px 0px' }).observe(stage);
  } else {
    visible = true; inited = true; init();
  }

  function fail(reason) {
    console.warn('Piano 3D không khởi tạo được:', reason);
    stage.classList.add('is-fallback');
  }

  async function init() {
    if (typeof THREE === 'undefined') return fail('Chưa tải được Three.js');
    // đợi font chữ để bảng tên trên đàn vẽ đúng (tối đa 1,2 giây)
    try { await Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, 1200))]); } catch (e) { /* bỏ qua */ }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (error) { return fail(error); }

    const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.75 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);

    // ---------- Môi trường phản chiếu (để thân đàn bóng như sơn mài) ----------
    const envMats = []; // vật liệu cần cập nhật cường độ phản chiếu
    try {
      const envScene = new THREE.Scene();
      const dbl = c => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
      envScene.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x13110e, side: THREE.BackSide })));
      const panel = (w, h, color, pos, look) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), dbl(color));
        m.position.set(...pos); m.lookAt(...look); envScene.add(m);
      };
      panel(9, 6, new THREE.Color(6, 5.6, 5), [0, 10, -1], [0, 0, 0]);       // softbox trần
      panel(5, 9, new THREE.Color(4.2, 2.9, 1.7), [10, 3, 0], [0, 1, 0]);     // dải sáng ấm bên phải
      panel(4, 8, new THREE.Color(1.2, 1.7, 2.8), [-10, 3, 2], [0, 1, 0]);    // dải sáng lạnh bên trái
      panel(8, 3, new THREE.Color(1.6, 1.5, 1.4), [0, 2, 10], [0, 1, 0]);     // ánh sáng phía người chơi
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(envScene, 0.03).texture;
      pmrem.dispose();
    } catch (error) { console.warn('Không tạo được môi trường phản chiếu:', error); }

    // ---------- Vật liệu ----------
    const mat = (m, envBase) => { m.userData.env = envBase; envMats.push(m); return m; };
    const M = {
      lacquer: mat(new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.2, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.07 }), 1.25),
      wood: mat(new THREE.MeshStandardMaterial({ color: 0x4a2f1b, roughness: 0.65 }), 0.3),
      brass: mat(new THREE.MeshStandardMaterial({ color: 0xc9a55f, metalness: 1, roughness: 0.32 }), 1.0),
      whiteKey: mat(new THREE.MeshStandardMaterial({ color: 0xf1ede2, roughness: 0.38 }), 0.35),
      blackKey: mat(new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.28 }), 0.6),
      leather: mat(new THREE.MeshStandardMaterial({ color: 0x151414, roughness: 0.5 }), 0.5),
      felt: mat(new THREE.MeshStandardMaterial({ color: 0x3b1218, roughness: 0.9 }), 0.1)
    };

    // ---------- Tiện ích dựng hình ----------
    const V2 = (x, y) => new THREE.Vector2(x, y);
    const addMesh = (parent, geo, material, x = 0, y = 0, z = 0, cast = true, receive = true) => {
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = cast; mesh.receiveShadow = receive;
      parent.add(mesh);
      return mesh;
    };
    const box = (parent, w, h, d, material, x, y, z, cast = true) => addMesh(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z, cast);
    function canvasTexture(w, h, draw) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = 4;
      return tex;
    }
    function roundedRect(w, h, r) {
      const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      return s;
    }
    // Dịch đa giác vào trong d mét (đa giác ngược chiều kim đồng hồ)
    function offsetPoly(pts, d) {
      const n = pts.length;
      return pts.map((p, i) => {
        const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
        let tx = b.x - a.x, ty = b.y - a.y;
        const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        return V2(p.x - ty * d, p.y + tx * d);
      });
    }
    // Hình phẳng (x, y mặt bằng) -> nằm ngang trong không gian: mặt bằng y = -z
    const flatGeo = (shape, depth, bevel) => {
      const g = depth > 0
        ? new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 2, curveSegments: 1 })
        : new THREE.ShapeGeometry(shape);
      g.rotateX(-Math.PI / 2);
      return g;
    };

    // =================================================================
    // DỰNG CÂY ĐÀN
    // =================================================================
    const piano = new THREE.Group();
    scene.add(piano);

    // ---- Đường viền thân đàn (mặt bằng; y mặt bằng 0.62 -> 2.0 là phần thân sau) ----
    const outer = [];
    for (let i = 0; i <= 20; i++) outer.push(V2(-0.73 + i * (1.46 / 20), 0.62));
    const bezier = (p0, p1, p2, p3, n) => new THREE.CubicBezierCurve(V2(...p0), V2(...p1), V2(...p2), V2(...p3)).getPoints(n);
    outer.push(...bezier([0.73, 0.62], [0.73, 0.95], [0.67, 1.25], [0.50, 1.52], 36).slice(1));
    outer.push(...bezier([0.50, 1.52], [0.37, 1.77], [0.14, 1.96], [-0.12, 2.0], 28).slice(1));
    for (let i = 1; i <= 5; i++) outer.push(V2(-0.12 - (i / 5) * 0.57, 2.0));
    outer.push(V2(-0.715, 1.99), V2(-0.73, 1.96));
    for (let i = 1; i < 20; i++) outer.push(V2(-0.73, 1.96 - (1.34 * i) / 20));

    const RIM_BASE = 0.62, RIM_H = 0.34, TOP = RIM_BASE + RIM_H; // đáy thân, độ dày thành, mặt trên (0.96)

    // ---- Thành đàn rỗng ----
    const inner = offsetPoly(outer, 0.04);
    const caseShape = new THREE.Shape(outer);
    caseShape.holes.push(new THREE.Path(inner));
    addMesh(piano, flatGeo(caseShape, RIM_H), M.lacquer, 0, RIM_BASE, 0);
    addMesh(piano, flatGeo(new THREE.Shape(outer), 0), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8, side: THREE.DoubleSide }), 0, RIM_BASE + 0.02, 0, false, false);

    // ---- Mặt cộng hưởng (gỗ) + khung gang đồng + dây đàn ----
    addMesh(piano, flatGeo(new THREE.Shape(offsetPoly(outer, 0.045)), 0), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.6, side: THREE.DoubleSide }), 0, 0.8, 0, false, true);
    const endY = i => 1.80 - 0.88 * Math.pow(i / 87, 0.85); // độ dài dây giảm dần về phía âm cao
    const xOf = i => -0.62 + (1.22 * i) / 87;
    const plate = [V2(-0.66, 0.70), V2(0.66, 0.70), V2(0.66, 0.98)];
    for (let i = 87; i >= 0; i--) plate.push(V2(xOf(i), endY(i) + 0.07));
    plate.push(V2(-0.66, 1.88));
    addMesh(piano, flatGeo(new THREE.Shape(plate), 0.012), M.brass, 0, 0.83, 0, false, true);
    box(piano, 1.34, 0.05, 0.08, M.wood, 0, 0.86, -0.70, false);       // thanh ghim dây (pin block)

    const silver = [], copper = [];
    for (let i = 0; i < 88; i++) {
      const strings = i < 10 ? 1 : i < 30 ? 2 : 3, target = i < 24 ? copper : silver;
      for (let s = 0; s < strings; s++) {
        const x = xOf(i) + (s - (strings - 1) / 2) * 0.0045;
        target.push(new THREE.Vector3(x, 0.872, -0.74), new THREE.Vector3(x, 0.872, -endY(i)));
      }
    }
    const lineMat = c => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.85 });
    piano.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(silver), lineMat(0xe6e1d4)));
    piano.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(copper), lineMat(0xc98f4a)));
    const bridgePts = [];
    for (let i = 0; i < 88; i += 4) bridgePts.push(new THREE.Vector3(xOf(i), 0.88, -endY(i)));
    bridgePts.push(new THREE.Vector3(xOf(87), 0.88, -endY(87)));
    addMesh(piano, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bridgePts), 60, 0.011, 6, false), M.wood, 0, 0, 0, false, true);

    // ---- Nắp đàn (mở chống lên, bản lề ở mép trái) ----
    const lid = new THREE.Group();
    lid.position.set(-0.73, TOP, 0);
    lid.rotation.z = 0.62;
    addMesh(lid, flatGeo(new THREE.Shape(outer), 0.035, 0.006), M.lacquer, 0.73, 0, 0);
    piano.add(lid);
   // Thanh chống nắp đàn
const rimIndex = outer.reduce((best, p, i) =>
  p.x > 0 &&
  Math.abs(p.y - 1.25) < Math.abs(outer[best].y - 1.25)
    ? i : best, 20);

const rimPoint = outer[rimIndex]
  .clone().lerp(inner[rimIndex], 0.5);

const propBase = new THREE.Vector3(
  rimPoint.x, TOP - 0.005, -rimPoint.y
);

const propTip = new THREE.Vector3(
  rimPoint.x + 0.73 - 0.06,
  0.004,
  -rimPoint.y
).applyQuaternion(lid.quaternion).add(lid.position);

const propDirection = propTip.clone().sub(propBase);
const propCenter = propBase.clone().lerp(propTip, 0.5);

const prop = addMesh(
  piano,
  new THREE.CylinderGeometry(
    0.009, 0.009, propDirection.length(), 10
  ),
  M.brass,
  propCenter.x,
  propCenter.y,
  propCenter.z
);

prop.quaternion.setFromUnitVectors(
  new THREE.Vector3(0, 1, 0),
  propDirection.normalize()
);

    // ---- Phần đầu đàn: bàn phím, má đàn, nắp phím ----
    box(piano, 1.46, 0.34, 0.44, M.lacquer, 0, RIM_BASE + 0.17, -0.40);               // khối sau nắp phím
    box(piano, 1.46, 0.102, 0.195, M.lacquer, 0, 0.671, -0.0825);                    // thanh đỡ phím
    const cheekW = (0.73 - 0.6128) ;
    [-1, 1].forEach(sx => box(piano, cheekW, 0.31, 0.195, M.lacquer, sx * (0.6128 + cheekW / 2), 0.775, -0.0825)); // má đàn
    // bảng tên
    const nameTex = canvasTexture(1024, 170, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#d7b77c'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const spaced = (text, y, size, space, weight) => {
        g.font = `${weight} ${size}px "Playfair Display", Georgia, serif`;
        const widths = [...text].map(ch => g.measureText(ch).width + space);
        let x = w / 2 - (widths.reduce((a, b) => a + b, 0) - space) / 2;
        [...text].forEach((ch, i) => { g.textAlign = 'left'; g.fillText(ch, x, y); x += widths[i]; });
      };
      spaced('HUY THIEN', 70, 70, 16, 600);
      spaced('PIANO & MUSIC', 138, 26, 14, 500);
    });
    const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.0664), new THREE.MeshStandardMaterial({ map: nameTex, transparent: true, metalness: 0.5, roughness: 0.4, emissive: 0x6a5326, emissiveMap: nameTex, emissiveIntensity: 0.35 }));
    plateMesh.position.set(0, 0.86, -0.178);
    piano.add(plateMesh);

    // ---- 88 phím đàn ----
    const WHITE_W = 0.02357, BLACK_W = 0.0135, X0 = -26 * WHITE_W, PIVOT_Z = -0.18, PIVOT_Y = 0.735;
    const whiteGeo = new THREE.BoxGeometry(WHITE_W - 0.0008, 0.02, 0.15);
    const blackGeo = new THREE.BoxGeometry(BLACK_W, 0.028, 0.095);
    const keys = [], keyMeshes = [];
    const BLACK_OFFSET = { 1: -0.17, 3: 0.17, 6: -0.2, 8: 0, 10: 0.2 };
    let whiteIndex = 0;
    for (let midi = 21; midi <= 108; midi++) {
      const pc = midi % 12, isBlack = [1, 3, 6, 8, 10].includes(pc);
      const group = new THREE.Group();
      let mesh;
      if (!isBlack) {
        group.position.set(X0 + (whiteIndex + 0.5) * WHITE_W, PIVOT_Y, PIVOT_Z);
        mesh = new THREE.Mesh(whiteGeo, M.whiteKey);
        mesh.position.set(0, 0, 0.075);
        whiteIndex++;
      } else {
        group.position.set(X0 + whiteIndex * WHITE_W + BLACK_OFFSET[pc] * BLACK_W, PIVOT_Y, PIVOT_Z);
        mesh = new THREE.Mesh(blackGeo, M.blackKey);
        mesh.position.set(0, 0.011, 0.0475);
      }
      mesh.receiveShadow = true; mesh.castShadow = isBlack;
      group.add(mesh);
      piano.add(group);
      const key = { midi, group, mesh, isBlack, press: 0, target: 0 };
      mesh.userData.key = key;
      keys.push(key); keyMeshes.push(mesh);
    }
    const keyByMidi = new Map(keys.map(k => [k.midi, k]));

    // ---- Giá nhạc + bản nhạc ----
    const desk = new THREE.Group();
    desk.position.set(0, TOP, -0.30);
    desk.rotation.x = -0.3;
    box(desk, 0.58, 0.3, 0.012, M.lacquer, 0, 0.15, 0);
    box(desk, 0.58, 0.014, 0.05, M.lacquer, 0, 0.007, 0.03);
    const sheetTex = canvasTexture(512, 400, (g, w, h) => {
      g.fillStyle = '#f3eee2'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#6b6254'; g.font = 'italic 600 22px Georgia, serif'; g.textAlign = 'center';
      g.fillText('Canon in D', w / 2, 34);
      let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      for (let s = 0; s < 5; s++) {
        const top = 62 + s * 66;
        g.strokeStyle = '#8f877a'; g.lineWidth = 1;
        for (let l = 0; l < 5; l++) { g.beginPath(); g.moveTo(24, top + l * 7); g.lineTo(w - 24, top + l * 7); g.stroke(); }
        g.fillStyle = '#2a2620'; g.strokeStyle = '#2a2620';
        for (let n = 0; n < 12; n++) {
          const nx = 52 + n * 36, ny = top + 28 - Math.floor(rnd() * 8) * 3.5;
          g.beginPath(); g.ellipse(nx, ny, 5, 3.6, -0.3, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.moveTo(nx + 4.5, ny); g.lineTo(nx + 4.5, ny - 22); g.stroke();
        }
      }
    });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ map: sheetTex, roughness: 0.9 }));
    sheet.position.set(0, 0.16, 0.0075);
    sheet.receiveShadow = true;
    desk.add(sheet);
    piano.add(desk);

    // ---- Đèn nhỏ trên nắp phím ----
    const lampPos = new THREE.Vector3(-0.55, TOP, -0.46);
    const lamp = new THREE.Group();
    lamp.position.copy(lampPos);
    addMesh(lamp, new THREE.CylinderGeometry(0.04, 0.045, 0.012, 24), M.brass, 0, 0.006, 0);
    addMesh(lamp, new THREE.CylinderGeometry(0.006, 0.006, 0.17, 10), M.brass, 0, 0.097, 0);
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, emissive: 0xffb35c, emissiveIntensity: 0, roughness: 0.8, side: THREE.DoubleSide });
    addMesh(lamp, new THREE.CylinderGeometry(0.028, 0.062, 0.075, 28, 1, true), shadeMat, 0, 0.205, 0, false, false);
    piano.add(lamp);

    // ---- Chân đàn, bánh xe, bàn đạp ----
    const legs = [[-0.62, -0.42], [0.62, -0.42], [-0.40, -1.82]];
    legs.forEach(([lx, lz]) => {
      addMesh(piano, new THREE.CylinderGeometry(0.044, 0.03, 0.6, 22), M.lacquer, lx, 0.32, lz);
      addMesh(piano, new THREE.CylinderGeometry(0.062, 0.062, 0.04, 22), M.lacquer, lx, RIM_BASE - 0.02, lz);
      addMesh(piano, new THREE.CylinderGeometry(0.036, 0.036, 0.028, 18), M.brass, lx, 0.016, lz);
    });
    [-0.08, 0.08].forEach(px => addMesh(piano, new THREE.CylinderGeometry(0.012, 0.012, 0.5, 10), M.lacquer, px, 0.37, -0.40));
    box(piano, 0.2, 0.05, 0.12, M.lacquer, 0, 0.13, -0.40);
    [-0.065, 0, 0.065].forEach(px => box(piano, 0.036, 0.012, 0.14, M.brass, px, 0.085, -0.31));

    // ---- Ghế piano ----
    const bench = new THREE.Group();
    bench.position.set(0, 0, 0.58);
    const seatGeo = new THREE.ExtrudeGeometry(roundedRect(0.84, 0.34, 0.05), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 3, curveSegments: 6 });
    seatGeo.rotateX(-Math.PI / 2);
    addMesh(bench, seatGeo, M.leather, 0, 0.45, 0);
    [[-0.36, -0.12], [0.36, -0.12], [-0.36, 0.12], [0.36, 0.12]].forEach(([bx, bz]) => {
      addMesh(bench, new THREE.CylinderGeometry(0.02, 0.016, 0.45, 12), M.lacquer, bx, 0.225, bz);
      addMesh(bench, new THREE.CylinderGeometry(0.019, 0.019, 0.016, 12), M.brass, bx, 0.008, bz);
    });
    piano.add(bench);

    // ---- Sàn: chỉ hiện bóng đổ + vệt sáng dưới đàn ----
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ opacity: 0.6 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const poolTex = canvasTexture(256, 256, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.55, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 48),
      new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.25 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.003, -0.8);
    scene.add(pool);

    // ---------- Ánh sáng ----------
    const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.6);
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.castShadow = true;
    const shadowSize = isSmall ? 1024 : 2048;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    Object.assign(sun.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 0.5, far: 16 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.target.position.set(0, 0.5, -0.9);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(2, 3.5, -6);
    rim.target.position.set(0, 0.8, -0.9);
    const lampLight = new THREE.SpotLight(0xffc680, 0, 5, 0.95, 0.9, 1.2);
    lampLight.position.set(lampPos.x, lampPos.y + 0.22, lampPos.z + 0.02);
    lampLight.target.position.set(0.05, 0.75, 0.0);
    scene.add(hemi, sun, sun.target, rim, rim.target, lampLight, lampLight.target);

    // Trạng thái ánh sáng hiện tại (S) và hàm nội suy giữa hai khoảnh khắc
    const COLOR_KEYS = ['sunColor', 'hemiSky', 'hemiGround', 'rimColor', 'poolColor'];
    const makeState = l => {
      const s = {};
      Object.keys(l).forEach(k => {
        s[k] = COLOR_KEYS.includes(k) ? new THREE.Color(l[k]) : k === 'sunPos' ? new THREE.Vector3(...l[k]) : l[k];
      });
      return s;
    };
    const cloneState = s => {
      const c = {};
      Object.keys(s).forEach(k => { c[k] = typeof s[k] === 'number' ? s[k] : s[k].clone(); });
      return c;
    };
    const mixState = (out, a, b, k) => {
      Object.keys(a).forEach(key => {
        const v = a[key];
        if (typeof v === 'number') out[key] = v + (b[key] - v) * k;
        else out[key].copy(v).lerp(b[key], k);
      });
    };
    const STATES = {};
    Object.keys(PRESETS).forEach(name => { STATES[name] = makeState(PRESETS[name].light); });
    const S = cloneState(STATES[current]);
    function applyLights() {
      hemi.color.copy(S.hemiSky); hemi.groundColor.copy(S.hemiGround); hemi.intensity = S.hemiI;
      sun.color.copy(S.sunColor); sun.intensity = S.sunI; sun.position.copy(S.sunPos);
      rim.color.copy(S.rimColor); rim.intensity = S.rimI;
      lampLight.intensity = S.lampI;
      shadeMat.emissiveIntensity = 0.05 + S.glow * 1.7;
      pool.material.color.copy(S.poolColor); pool.material.opacity = S.poolOp;
      renderer.toneMappingExposure = S.exposure;
      envMats.forEach(m => { m.envMapIntensity = m.userData.env * S.env; });
    }
    applyLights();

    // ---------- Máy quay & điều khiển xoay ----------
    const PHI_MIN = 0.12, PHI_MAX = 1.55, R_MIN = 0.9, R_MAX = 8;
    const view = { theta: 0, phi: 1, radius: 5, tx: 0, ty: 0.9, tz: -0.9 };
    const goal = { ...view };
    let fly = false, fit = 1, sway = 0, swayAngle = 0, autoOn = !reduceMotion, lastInteract = -1e9;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    function camGoal(cam) {
      const dx = cam.pos[0] - cam.target[0], dy = cam.pos[1] - cam.target[1], dz = cam.pos[2] - cam.target[2];
      const radius = Math.hypot(dx, dy, dz);
      return { theta: Math.atan2(dx, dz), phi: Math.acos(dy / radius), radius, tx: cam.target[0], ty: cam.target[1], tz: cam.target[2] };
    }
    function goTo(name, instant) {
      const p = PRESETS[name];
      const g = camGoal(p.cam);
      let d = g.theta - goal.theta;
      d = Math.atan2(Math.sin(d), Math.cos(d)); // đi theo đường quay ngắn nhất
      g.theta = goal.theta + d;
      Object.assign(goal, g);
      if (instant || reduceMotion) { Object.assign(view, goal); fly = false; }
      else fly = true;
      lightTween = instant || reduceMotion ? null : { t0: performance.now(), dur: 1800, from: cloneState(S), to: STATES[name] };
      if (instant || reduceMotion) { mixState(S, STATES[name], STATES[name], 0); applyLights(); }
    }
    let lightTween = null;
    const markInteraction = () => { lastInteract = performance.now(); fly = false; };

    function updateCamera() {
      const th = view.theta + swayAngle, r = view.radius * fit, sp = Math.sin(view.phi);
      camera.position.set(view.tx + r * sp * Math.sin(th), Math.max(0.15, view.ty + r * Math.cos(view.phi)), view.tz + r * sp * Math.cos(th));
      camera.lookAt(view.tx, view.ty, view.tz);
    }
    function resize() {
      const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      fit = camera.aspect < 1 ? 1 + (1 - camera.aspect) * 0.6 : 1;
      camera.updateProjectionMatrix();
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
    window.addEventListener('resize', resize);
    resize();

    // ---------- Âm thanh ----------
    let audio = null;
    function getAudio() {
      if (!audio) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        const ctx = new Ctx();
        const comp = ctx.createDynamicsCompressor();
        comp.connect(ctx.destination);
        audio = { ctx, out: comp };
      }
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return audio;
    }
    function noteOn(midi) {
      const a = getAudio();
      if (!a) return null;
      const { ctx, out } = a, now = ctx.currentTime, f = 440 * Math.pow(2, (midi - 69) / 12);
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.3, now + 0.012);
      master.gain.exponentialRampToValueAtTime(0.1, now + 0.25);
      master.gain.exponentialRampToValueAtTime(0.012, now + 2.4);
      master.connect(out);
      const oscs = [{ m: 1, l: 0.62, t: 'triangle' }, { m: 2, l: 0.18, t: 'sine' }, { m: 3, l: 0.07, t: 'sine' }].map(h => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = h.t; o.frequency.value = f * h.m; g.gain.value = h.l;
        o.connect(g).connect(master); o.start(now); o.stop(now + 3.2);
        return o;
      });
      return { master, oscs, ctx };
    }
    function noteOff(voice, release = 0.3) {
      if (!voice) return;
      const now = voice.ctx.currentTime;
      voice.master.gain.cancelScheduledValues(now);
      voice.master.gain.setValueAtTime(Math.max(voice.master.gain.value, 0.0001), now);
      voice.master.gain.exponentialRampToValueAtTime(0.0001, now + release);
    }

    // ---------- Chạm / gõ phím ----------
    const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function pickKey(cx, cy) {
      const rect = canvas.getBoundingClientRect();
      ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(keyMeshes, false);
      return hits.length ? hits[0].object.userData.key : null;
    }
    function tapKey(key) {
      key.target = 1;
      const voice = noteOn(key.midi);
      setTimeout(() => { key.target = 0; noteOff(voice, 0.55); }, 380);
    }

    const pointers = new Map();
    let tap = null, pinchStart = 0, pinchRadius = 0;
    const pinchDist = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      markInteraction();
      if (pointers.size === 1) tap = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, button: e.button };
      else { tap = null; pinchStart = pinchDist(); pinchRadius = goal.radius; }
    });
    canvas.addEventListener('pointermove', e => {
      const p = pointers.get(e.pointerId);
      if (!p) {
        if (e.pointerType === 'mouse' && pointers.size === 0) canvas.style.cursor = pickKey(e.clientX, e.clientY) ? 'pointer' : '';
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      markInteraction();
      if (pointers.size === 1) {
        if (tap && !tap.moved && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap.moved = true;
        if (!tap || tap.moved) {
          goal.theta -= dx * 0.0065;
          goal.phi = clamp(goal.phi - dy * 0.005, PHI_MIN, PHI_MAX);
        }
      } else if (pointers.size === 2) {
        goal.radius = clamp(pinchRadius * (pinchStart / pinchDist()), R_MIN, R_MAX);
      }
    });
    const release = e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (e.type === 'pointerup' && tap && !tap.moved && performance.now() - tap.t < 600 && (e.pointerType !== 'mouse' || tap.button === 0)) {
        const key = pickKey(e.clientX, e.clientY);
        if (key) tapKey(key);
      }
      if (pointers.size < 2) tap = pointers.size === 0 ? null : tap;
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => canvas.addEventListener(type, release));
    canvas.addEventListener('wheel', e => {
      if (!(e.ctrlKey || e.metaKey)) return; // giữ Ctrl để zoom, tránh chặn cuộn trang
      e.preventDefault();
      markInteraction();
      goal.radius = clamp(goal.radius * Math.exp(e.deltaY * 0.0018), R_MIN, R_MAX);
    }, { passive: false });
    canvas.addEventListener('keydown', e => {
      const step = { ArrowLeft: [0.12, 0, 1], ArrowRight: [-0.12, 0, 1], ArrowUp: [0, 0.08, 1], ArrowDown: [0, -0.08, 1] }[e.key];
      if (step) { e.preventDefault(); markInteraction(); goal.theta += step[0]; goal.phi = clamp(goal.phi + step[1], PHI_MIN, PHI_MAX); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); goal.radius = clamp(goal.radius * 0.85, R_MIN, R_MAX); markInteraction(); }
      else if (e.key === '-') { e.preventDefault(); goal.radius = clamp(goal.radius / 0.85, R_MIN, R_MAX); markInteraction(); }
    });
    const zoom = f => { markInteraction(); goal.radius = clamp(goal.radius * f, R_MIN, R_MAX); };
    btnZoomIn?.addEventListener('click', () => zoom(0.8));
    btnZoomOut?.addEventListener('click', () => zoom(1.25));
    btnReset?.addEventListener('click', () => goTo(current));
    btnSway?.addEventListener('click', () => {
      autoOn = !autoOn;
      btnSway.setAttribute('aria-pressed', String(autoOn));
    });
    btnSway?.setAttribute('aria-pressed', String(autoOn));

    // Bàn phím máy tính: A S D F G H J = Đô Rê Mi Fa Sol La Si (quãng tám giữa)
    const LETTER_MIDI = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76 };
    const held = new Map();
    document.addEventListener('keydown', e => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || !stageVisible) return;
      const midi = LETTER_MIDI[e.key.toLowerCase()];
      if (!midi || held.has(e.key.toLowerCase())) return;
      if (document.querySelector('.modal.is-open')) return;
      const ae = document.activeElement;
      if (ae && ae !== canvas && ae.matches('input, textarea, select, button, a, [contenteditable]')) return;
      const key = keyByMidi.get(midi);
      key.target = 1;
      held.set(e.key.toLowerCase(), { key, voice: noteOn(midi) });
    });
    const releaseHeld = letter => {
      const h = held.get(letter);
      if (!h) return;
      h.key.target = 0; noteOff(h.voice, 0.3); held.delete(letter);
    };
    document.addEventListener('keyup', e => releaseHeld(e.key.toLowerCase()));
    window.addEventListener('blur', () => [...held.keys()].forEach(releaseHeld));

    // ---------- Vòng lặp vẽ ----------
    let raf = 0, last = performance.now(), firstFrame = true;
    const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    function update(dt, now) {
      if (lightTween) {
        const k = Math.min(1, (now - lightTween.t0) / lightTween.dur);
        mixState(S, lightTween.from, lightTween.to, ease(k));
        applyLights();
        if (k >= 1) lightTween = null;
      }
      const rate = fly ? 2.6 : 10, a = 1 - Math.exp(-rate * dt);
      let still = true;
      ['theta', 'phi', 'radius', 'tx', 'ty', 'tz'].forEach(k => {
        const d = goal[k] - view[k];
        view[k] += d * a;
        if (Math.abs(d) > 0.004) still = false;
      });
      if (fly && still) fly = false;
      // lắc nhẹ góc máy khi người xem không chạm vào
      const idle = autoOn && now - lastInteract > 2600;
      const swayTarget = idle ? (current === 'night' ? 0.1 : 0.42) : 0;
      sway += (swayTarget - sway) * (1 - Math.exp(-dt * 1.6));
      swayAngle = Math.sin(now * 0.00042) * sway;
      updateCamera();
      
// ==========================================
// MIDI - ĐỒNG BỘ PHÍM ĐÀN 3D
// ==========================================

const sessionAudio = document.getElementById(
    "sessionAudio"
);

const activeMidi = new Set();

if (
    sessionAudio &&
    !sessionAudio.paused &&
    !sessionAudio.ended &&
    !sessionAudio.seeking &&
    Array.isArray(sessionAudio.pianoNotes)
) {

    const songTime = sessionAudio.currentTime;

    for (const note of sessionAudio.pianoNotes) {

        if (note.start > songTime) {
            break;
        }

        if (
            songTime >= note.start &&
            songTime < note.end
        ) {

            activeMidi.add(note.midi);

        }
    }
}

// Cập nhật chuyển động 88 phím đàn

for (const key of keys) {

    const autoPress = activeMidi.has(key.midi)
        ? 1
        : 0;

    // Kết hợp phím tự động và phím chơi thủ công

    const target = Math.max(
        key.target,
        autoPress
    );

    const difference = target - key.press;

    if (difference !== 0) {

        key.press = Math.abs(difference) < 0.01
            ? target
            : key.press +
              difference * Math.min(1, dt * 35);

        key.group.rotation.x = key.press * 0.05;

    }
}

    }
    function frame(now) {
      raf = 0;
      if (!stageVisible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt, now);
      renderer.render(scene, camera);
      if (firstFrame) { firstFrame = false; stage.classList.add('is-ready'); }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('Mất ngữ cảnh WebGL'); });

    api = { goTo, start };
    goTo(current, true);
    stageVisible = visible || stageVisible;
    updateCamera();
    start();
  }
})();
