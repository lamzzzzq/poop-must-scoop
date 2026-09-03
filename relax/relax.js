/* 再铲一坨 · 解压版 demo v0.1 — 一个盆、一把铲、砂的高度场物理
   规格见 docs/GDD_relax_scooper_detail.md；标 [调] 的数字等手感实测后调 */
(() => {
'use strict';
const W = 480, H = 640;
const TRAY = { x: 24, y: 40, w: 432, h: 360 };
const GW = 96, GH = 80, CELL = TRAY.w / GW; // 4.5px
const BAG = { x: 340, y: 430, w: 112, h: 130 };
const REFILL = { x: 28, y: 430, w: 112, h: 130 };
const BASE_H = 0.6;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const inRect = (x, y, r) => x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
const inTray = (x, y) => inRect(x, y, TRAY);

// ---------- 砂的参数（GDD 细化 §3） ----------
const LITTERS = {
  bentonite: { name: '膨润土', color: [217, 201, 162], grain: 0.07, streak: 0, digRate: 1.0, siftRate: 1.0, dust: 12, cap: 1.0, clumpShell: '#cbb98f', sfx: { dig: 2600, sift: 3200 } },
  tofu:      { name: '豆腐砂', color: [239, 230, 207], grain: 0.05, streak: 0.12, digRate: 1.2, siftRate: 1.6, dust: 3, cap: 0.8, clumpShell: '#e8dfc4', sfx: { dig: 1800, sift: 2400 } },
};
let litter = LITTERS.bentonite;
const SAND_UNIT = 0.007;     // 一格高度 1.0 = 0.007 铲容量：满铲约需 3 秒铲入 [调]
const GRAMS_PER_CAP = 250;   // 满铲砂 ≈ 250g [调]
const SIFT_V = 600;          // 横向速度阈值 px/s [调]

// ---------- 音效 ----------
let AC = null;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (AC.state === 'suspended') AC.resume(); return AC; }
function noise(dur, vol, freq, q = 1, delay = 0) { const a = ac(); if (!a) return; const n = Math.floor(a.sampleRate * dur); const b = a.createBuffer(1, n, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq * rnd(0.95, 1.05); f.Q.value = q; const g = a.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(a.destination); s.start(a.currentTime + delay); }
function tone(freq, dur, type, vol, delay = 0) { const a = ac(); if (!a) return; const o = a.createOscillator(); o.type = type; o.frequency.value = freq * rnd(0.97, 1.03); const g = a.createGain(); const t0 = a.currentTime + delay; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02); }
let sfxT = 0;
const SFX = {
  dig(dt) { sfxT -= dt; if (sfxT <= 0) { sfxT = 0.09; noise(0.12, 0.25, litter.sfx.dig, 0.7); } },
  sift(str, dt) { sfxT -= dt; if (sfxT <= 0) { sfxT = 0.05; noise(0.07, 0.12 + str * 0.25, litter.sfx.sift, 0.9); } },
  clump() { noise(0.1, 0.35, 1400, 1.2); tone(900, 0.05, 'square', 0.06); },
  plop() { tone(180, 0.12, 'sine', 0.3); noise(0.08, 0.2, 700, 1.5, 0.02); },
  tick() { tone(880, 0.07, 'triangle', 0.15); tone(1320, 0.1, 'triangle', 0.12, 0.07); },
  tie() { noise(0.05, 0.3, 2200, 2); tone(240, 0.08, 'square', 0.12, 0.05); },
  pour(dt) { sfxT -= dt; if (sfxT <= 0) { sfxT = 0.08; noise(0.1, 0.18, 2000, 0.6); } },
  purr() { tone(52, 0.5, 'sawtooth', 0.06); tone(55, 0.5, 'sawtooth', 0.05, 0.03); },
  step() { noise(0.06, 0.15, 1200, 1.2); },
};

// ---------- 高度场 ----------
const cv = document.getElementById('cv'); const ctx = cv.getContext('2d');
const off = document.createElement('canvas'); off.width = GW; off.height = GH; const octx = off.getContext('2d');
const img = octx.createImageData(GW, GH);
let h = new Float32Array(GW * GH), wet = new Float32Array(GW * GH), grainN = new Float32Array(GW * GH);
function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
resize(); window.addEventListener('resize', resize);
const gi = (gx, gy) => gy * GW + gx;
const toG = (x, y) => [Math.floor((x - TRAY.x) / CELL), Math.floor((y - TRAY.y) / CELL)];
function bump(x, y, r, amt) { const [cx, cy] = toG(x, y); const rc = Math.ceil(r / CELL); for (let gy = cy - rc; gy <= cy + rc; gy++) for (let gx = cx - rc; gx <= cx + rc; gx++) { if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue; const d = Math.hypot((gx - cx) * CELL, (gy - cy) * CELL) / r; if (d > 1) continue; h[gi(gx, gy)] += amt * (1 - d * d); } }
function wetMark(x, y, r, amt) { const [cx, cy] = toG(x, y); const rc = Math.ceil(r / CELL); for (let gy = cy - rc; gy <= cy + rc; gy++) for (let gx = cx - rc; gx <= cx + rc; gx++) { if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue; const d = Math.hypot((gx - cx) * CELL, (gy - cy) * CELL) / r; if (d > 1) continue; wet[gi(gx, gy)] = Math.min(1, wet[gi(gx, gy)] + amt * (1 - d)); } }
const level = () => { let s = 0; for (let i = 0; i < h.length; i++) s += h[i]; return s / h.length; };
function renderSand() {
  const d = img.data, c = litter.color;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const i = gi(gx, gy);
    const hl = h[i - (gx > 0 ? 1 : 0)], hr = h[i + (gx < GW - 1 ? 1 : 0)], hu = h[i - (gy > 0 ? GW : 0)], hd = h[i + (gy < GH - 1 ? GW : 0)];
    const nx = hr - hl, ny = hd - hu;
    let b = 1 + (-(nx + ny)) * 3.2 + (h[i] - BASE_H) * 0.35 + grainN[i] * litter.grain - wet[i] * 0.16;
    if (h[i] < 0.08) b *= 0.55 + h[i] * 5; // 见底：盆底更暗
    const k = i * 4; d[k] = clamp(c[0] * b, 0, 255); d[k + 1] = clamp(c[1] * b, 0, 255); d[k + 2] = clamp(c[2] * b, 0, 255); d[k + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
}

// ---------- 场景 ----------
let D = null;
const ptr = { x: 240, y: 200, px: 240, py: 200, down: false, vx: 0, inside: false, type: 'mouse' };
function reset() {
  for (let i = 0; i < h.length; i++) { h[i] = BASE_H + rnd(-0.02, 0.02); wet[i] = 0; grainN[i] = rnd(-1, 1) + (litter.streak ? Math.sin(i % GW * 0.9) * litter.streak * 8 : 0); }
  D = { t: 0, state: 'hover', carrySand: 0, carryClumps: [], clumps: [], parts: [], floats: [], bagClumps: 0, bagGrams: 0, poured: false, tied: false, cat: null, catT: 0, tasks: { scoop: false, refill: false, bag: false, cat: false }, banner: null, shake: 0, sift: 0, reviewed: false, pourMode: false, cleanT: 0 };
  for (let i = 0; i < 3; i++) addClump(rnd(TRAY.x + 60, TRAY.x + TRAY.w - 60), rnd(TRAY.y + 60, TRAY.y + TRAY.h - 50), rnd(0.06, 0.16), false);
  renderTasks();
}
function addClump(x, y, depth, fresh) {
  const r = rnd(11, 16);
  const c = { id: Math.random(), x, y, r, depth, exposed: depth <= 0.02, sizeCat: 1 };
  D.clumps.push(c); bump(x, y, r + 8, 0.14 + depth * 0.4); // 鼓包：找的破绽 [调]
  if (fresh) wetMark(x, y, r + 14, 0.9);
  return c;
}
const foot = () => ({ x: ptr.x - 28, y: ptr.y - 4, w: 56, h: 22 }); // 铲刃脚印
function cellsIn(rect) { const out = []; const [x0, y0] = toG(rect.x, rect.y), [x1, y1] = toG(rect.x + rect.w, rect.y + rect.h); for (let gy = Math.max(0, y0); gy <= Math.min(GH - 1, y1); gy++) for (let gx = Math.max(0, x0); gx <= Math.min(GW - 1, x1); gx++) out.push(gi(gx, gy)); return out; }
function ringOf(rect) { const outer = cellsIn({ x: rect.x - 8, y: rect.y - 8, w: rect.w + 16, h: rect.h + 16 }); const inner = new Set(cellsIn(rect)); return outer.filter(i => !inner.has(i)); }

// ---------- 四阶段 ----------
function updateShovel(dt) {
  const f = foot();
  if (D.state === 'dig' && ptr.down && inTray(ptr.x, ptr.y)) {
    const cells = cellsIn(f); const ring = ringOf(f);
    let taken = 0; const room = litter.cap - D.carrySand;
    if (room > 0) {
      for (const i of cells) { const take = Math.min(h[i], litter.digRate * dt * 0.9, room * 0.3); h[i] -= take; taken += take; }
      const toShovel = taken * 0.7, toRing = taken * 0.3;
      D.carrySand = Math.min(litter.cap, D.carrySand + toShovel * SAND_UNIT);
      if (ring.length) for (const i of ring) h[i] += toRing / ring.length;
      if (taken > 0.002) { SFX.dig(dt); for (let k = 0; k < litter.dust * dt * 3; k++) D.parts.push({ x: rnd(f.x, f.x + f.w), y: rnd(f.y, f.y + f.h), vx: rnd(-20, 20), vy: rnd(-40, -10), g: -10, life: rnd(0.4, 0.9), r: rnd(1.5, 3), color: `rgba(${litter.color.join(',')},.6)`, kind: 'dust' }); }
    } else if (Math.random() < dt * 8) D.parts.push({ x: rnd(f.x, f.x + f.w), y: f.y + f.h, vx: rnd(-30, 30), vy: rnd(10, 40), g: 300, life: 0.5, r: 2, color: `rgb(${litter.color.join(',')})`, kind: 'grain' });
    // 端起结块：脚印覆盖 + 挖到埋深
    for (const c of D.clumps) {
      if (c.carried) continue;
      const [gx, gy] = toG(c.x, c.y); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
      if (h[gi(gx, gy)] <= BASE_H + 0.06 - c.depth) c.exposed = true;
      if (c.exposed && inRect(c.x, c.y, { x: f.x - 6, y: f.y - 6, w: f.w + 12, h: f.h + 12 })) { c.carried = true; D.carryClumps.push(c); SFX.clump(); D.shake = 2; addFloat(c.x, c.y - 24, '端起来了', '#fff'); for (let k = 0; k < 8; k++) D.parts.push({ x: c.x, y: c.y, vx: rnd(-60, 60), vy: rnd(-80, -20), g: 300, life: 0.5, r: 2, color: `rgb(${litter.color.join(',')})`, kind: 'grain' }); }
    }
  }
  if (D.state === 'lift') {
    const v = Math.abs(ptr.vx);
    if (v > SIFT_V && D.carrySand > 0) {
      const str = Math.min(1, v / SIFT_V - 1 + 0.4);
      const drain = Math.min(D.carrySand, litter.siftRate * str * 0.55 * dt);
      D.carrySand -= drain; D.sift = Math.min(1, D.sift + dt * 4);
      const cells = cellsIn({ x: f.x - 10, y: f.y + 6, w: f.w + 20, h: f.h + 14 });
      if (cells.length && inTray(ptr.x, ptr.y)) for (const i of cells) h[i] += drain / SAND_UNIT / cells.length; else D.bagGrams += 0; // 盆外筛砂就撒地上了（不计）
      for (let k = 0; k < drain * 900; k++) D.parts.push({ x: rnd(f.x + 4, f.x + f.w - 4), y: f.y + 10 + rnd(-2, 2), vx: rnd(-25, 25) + ptr.vx * 0.05, vy: rnd(40, 90), g: 380, life: rnd(0.18, 0.32), r: rnd(1.2, 2.2), color: `rgb(${litter.color.join(',')})`, kind: 'grain' });
      SFX.sift(str, dt);
    } else D.sift = Math.max(0, D.sift - dt * 3);
  }
}
function lift() { D.state = 'lift'; }
function dump() {
  const n = D.carryClumps.length; D.bagClumps += n; D.bagGrams += Math.round(D.carrySand * GRAMS_PER_CAP);
  if (n) { SFX.plop(); addFloat(BAG.x + BAG.w / 2, BAG.y - 10, `+${n} 坨`, '#ffe08a'); }
  if (D.carrySand > 0.05) addFloat(BAG.x + BAG.w / 2, BAG.y + 10, `带走砂 ${Math.round(D.carrySand * GRAMS_PER_CAP)}g`, '#f3ead6', 12);
  D.clumps = D.clumps.filter(c => !c.carried); D.carryClumps = []; D.carrySand = 0; D.state = 'hover';
  checkTasks();
}
function putBack() {
  const f = foot(); const cells = cellsIn(f);
  if (cells.length) for (const i of cells) h[i] += D.carrySand / SAND_UNIT / cells.length;
  for (const c of D.carryClumps) { c.carried = false; c.exposed = true; c.depth = 0; c.x = clamp(ptr.x + rnd(-10, 10), TRAY.x + 20, TRAY.x + TRAY.w - 20); c.y = clamp(ptr.y + rnd(-6, 6), TRAY.y + 20, TRAY.y + TRAY.h - 20); }
  D.carryClumps = []; D.carrySand = 0; D.state = 'hover'; noise(0.1, 0.2, 1500, 1);
}
function pour(dt) {
  if (!inTray(ptr.x, ptr.y)) return;
  const cells = cellsIn({ x: ptr.x - 26, y: ptr.y - 14, w: 52, h: 36 });
  for (const i of cells) h[i] += 0.55 * dt;
  for (let k = 0; k < 40 * dt; k++) D.parts.push({ x: ptr.x + rnd(-8, 8), y: ptr.y - 30, vx: rnd(-30, 30), vy: rnd(60, 120), g: 300, life: 0.3, r: 2, color: `rgb(${litter.color.join(',')})`, kind: 'grain' });
  SFX.pour(dt); D.poured = true;
  if (level() >= 0.62) { D.pourMode = false; addFloat(ptr.x, ptr.y - 30, '够了', '#fff'); checkTasks(); }
}

// ---------- 猫 ----------
function updateCat(dt) {
  const clean = D.clumps.length === 0 && level() >= 0.5 && D.state === 'hover' && !D.pourMode;
  if (!D.cat) {
    if (clean && D.tasks.refill && !D.tasks.cat) { D.cleanT += dt; if (D.cleanT > 2.5) { D.cat = { x: -40, y: rnd(TRAY.y + 80, TRAY.y + TRAY.h - 80), tx: rnd(TRAY.x + 90, TRAY.x + TRAY.w - 90), ty: 0, state: 'in', t: 0, wob: 0 }; D.cat.ty = D.cat.y; D.banner = { txt: '干净了，阿婆回来了', t: 3 }; SFX.purr(); } } else D.cleanT = 0;
    return;
  }
  const c = D.cat; c.wob += dt * 8;
  if (c.state === 'in') { const d = dist(c.x, c.y, c.tx, c.ty); const st = Math.min(d, 110 * dt); if (d < 2) { c.state = 'step'; c.t = 1.0; } else { c.x += (c.tx - c.x) / d * st; c.y += (c.ty - c.y) / d * st; } }
  else if (c.state === 'step') { c.t -= dt; if (Math.random() < dt * 6) { bump(c.x + rnd(-14, 14), c.y + rnd(-6, 10), 7, rnd(-0.03, 0.03)); SFX.step(); } if (c.t <= 0) { c.state = 'squat'; c.t = 1.2; } }
  else if (c.state === 'squat') { c.t -= dt; if (c.t <= 0) { addClump(c.x, c.y + 6, 0, true); SFX.plop(); c.state = 'dig'; c.t = 1.0; D.banner = { txt: '拉了一坨新的。再铲一坨？', t: 3 }; } }
  else if (c.state === 'dig') { c.t -= dt; if (Math.random() < dt * 10) { bump(c.x + rnd(-24, 24), c.y + rnd(-10, 16), 8, rnd(-0.04, 0.05)); } if (c.t <= 0) { c.state = 'out'; } }
  else if (c.state === 'out') { c.x += 130 * dt; if (c.x > W + 40) { D.cat = null; D.tasks.cat = true; renderTasks(); SFX.tick(); if (!D.reviewed) review(); } }
}

// ---------- 工单 ----------
const TASKS = [['scoop', '铲屎 3 坨（膨润土，装袋别冲）'], ['refill', '补砂到够用'], ['bag', '袋子扎口，放门口'], ['cat', '阿婆回来用了']];
function checkTasks() {
  let changed = false;
  if (!D.tasks.scoop && D.bagClumps >= 3 && D.clumps.filter(c => !c.carried).length === 0) { D.tasks.scoop = true; changed = true; }
  if (!D.tasks.refill && D.poured && level() >= 0.58) { D.tasks.refill = true; changed = true; }
  if (changed) { SFX.tick(); renderTasks(); }
}
function renderTasks() {
  const ul = document.getElementById('tasks'); ul.innerHTML = '';
  for (const [k, txt] of TASKS) { const li = document.createElement('li'); li.className = D.tasks[k] ? 'done' : ''; li.innerHTML = `<span class="box">${D.tasks[k] ? '✓' : ''}</span>${txt}${k === 'bag' && D.tasks.scoop && D.tasks.refill && !D.tasks.bag ? ' <b style="color:#ffcc4d">← 点袋子扎口</b>' : ''}`; ul.appendChild(li); }
}
function tie() { D.tied = true; D.tasks.bag = true; SFX.tie(); renderTasks(); addFloat(BAG.x + BAG.w / 2, BAG.y - 16, '扎好了', '#ffe08a'); }
function review() {
  D.reviewed = true;
  let stars = 5; const why = [];
  if (D.bagGrams > 80) { stars--; why.push(`带走砂 ${D.bagGrams}g（>80g）`); }
  if (!D.tasks.refill) { stars--; why.push('没补砂'); }
  const txt = { 5: '阿婆今天肯用盆了，谢谢你。', 4: '干净。下次砂少带点走。', 3: '还行，阿婆嗅了半天。' }[Math.max(3, stars)];
  const el = document.getElementById('review'); el.classList.remove('hidden');
  el.innerHTML = `<b>${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</b> 陈婆婆：「${txt}」${why.length ? `<div style="font-size:11px;opacity:.7;margin-top:4px">扣星：${why.join('；')}</div>` : ''}<div style="font-size:11px;opacity:.7;margin-top:4px">带走砂 ${D.bagGrams}g · 袋里 ${D.bagClumps} 坨 · 盆里还有阿婆刚拉的一坨，想铲就铲，没有工单了。</div>`;
  document.getElementById('stars').textContent = '★'.repeat(stars);
}

// ---------- 粒子 / 浮字 ----------
function addFloat(x, y, txt, color, size = 14) { D.floats.push({ x, y, txt, color, size, life: 1 }); }
function update(dt) {
  D.t += dt;
  ptr.vx = ptr.vx * 0.6 + ((ptr.x - ptr.px) / Math.max(dt, 1e-3)) * 0.4; ptr.px = ptr.x; ptr.py = ptr.y;
  updateShovel(dt); if (D.pourMode && ptr.down) pour(dt);
  updateCat(dt);
  for (let i = 0; i < wet.length; i++) if (wet[i] > 0) wet[i] = Math.max(0, wet[i] - dt * 0.03);
  for (const p of D.parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  D.parts = D.parts.filter(p => p.life > 0);
  for (const f of D.floats) { f.life -= dt; f.y -= 30 * dt; } D.floats = D.floats.filter(f => f.life > 0);
  if (D.banner) { D.banner.t -= dt; if (D.banner.t <= 0) D.banner = null; }
  D.shake = Math.max(0, D.shake - dt * 20);
}

// ---------- 画 ----------
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function draw() {
  ctx.save(); if (D.shake > 0) ctx.translate(rnd(-D.shake, D.shake) * 0.5, rnd(-D.shake, D.shake) * 0.5);
  ctx.fillStyle = '#3b3128'; ctx.fillRect(0, 0, W, H);
  // 盆
  ctx.fillStyle = '#7a8aa0'; roundRect(TRAY.x - 12, TRAY.y - 12, TRAY.w + 24, TRAY.h + 24, 18); ctx.fill();
  ctx.fillStyle = '#5c6b7a'; roundRect(TRAY.x - 4, TRAY.y - 4, TRAY.w + 8, TRAY.h + 8, 10); ctx.fill();
  renderSand(); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, TRAY.x, TRAY.y, TRAY.w, TRAY.h);
  // 露出的结块
  for (const c of D.clumps) if (!c.carried && c.exposed) drawClump(c.x, c.y, c.r, 1);
  // 猫
  if (D.cat) drawCat(D.cat);
  // 粒子
  for (const p of D.parts) { ctx.globalAlpha = clamp(p.life * 3, 0, 1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1;
  // 袋子 / 补砂
  drawBag(); drawRefill();
  // 浮字
  for (const f of D.floats) { ctx.globalAlpha = clamp(f.life * 1.5, 0, 1); ctx.font = `700 ${f.size}px -apple-system,"PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeText(f.txt, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.txt, f.x, f.y); ctx.globalAlpha = 1; }
  // 提示
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '12px -apple-system,"PingFang SC",sans-serif'; ctx.textAlign = 'center';
  const hint = D.pourMode ? '按住在盆里倒砂' : D.state === 'lift' ? (D.carrySand > 0.05 ? '左右晃筛砂 · 点袋子倒进去 · 点砂放回' : D.carryClumps.length ? '点袋子倒进去' : '空铲 · 点砂面放下') : '按住铲入 · 松开端起';
  ctx.fillText(hint, 240, 600);
  ctx.fillText(`砂量 ${Math.round(level() * 100)}% · 铲上 ${Math.round(D.carrySand * GRAMS_PER_CAP)}g${D.carryClumps.length ? ' + ' + D.carryClumps.length + ' 坨' : ''}`, 240, 620);
  if (D.banner) { ctx.fillStyle = 'rgba(20,14,8,.85)'; roundRect(90, 8, 300, 30, 10); ctx.fill(); ctx.fillStyle = '#ffe08a'; ctx.font = '700 14px -apple-system,"PingFang SC",sans-serif'; ctx.fillText(D.banner.txt, 240, 28); }
  // 铲子 / 砂袋光标
  if (ptr.inside) { if (D.pourMode) drawPourBag(); else drawShovel(); }
  ctx.restore();
}
function drawClump(x, y, r, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, r * 0.5, r * 1.1, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = litter.clumpShell; ctx.strokeStyle = 'rgba(80,50,20,.35)'; ctx.lineWidth = 1.2; // 砂壳
  ctx.beginPath(); ctx.ellipse(0, r * 0.15, r * 1.15, r * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6b3e1e'; ctx.strokeStyle = '#4a2a12'; ctx.lineWidth = 1.4;
  const s = r * 0.62;
  ctx.beginPath(); ctx.ellipse(0, s * 0.35, s * 1.25, s * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -s * 0.15, s * 0.95, s * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -s * 0.6, s * 0.6, s * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-s * 0.32, -s * 0.05, s * 0.18, 0, Math.PI * 2); ctx.arc(s * 0.32, -s * 0.05, s * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-s * 0.28, -s * 0.05, s * 0.09, 0, Math.PI * 2); ctx.arc(s * 0.36, -s * 0.05, s * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, s * 0.1, s * 0.25, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}
function drawShovel() {
  const lifted = D.state === 'lift', f = foot();
  const dy = lifted ? -14 : 0, shake = lifted ? Math.sin(D.t * 40) * D.sift * 4 : 0;
  // 影子
  ctx.fillStyle = lifted ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(ptr.x + (lifted ? 6 : 2), ptr.y + 10, lifted ? 40 : 30, lifted ? 12 : 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(ptr.x + shake, ptr.y + dy);
  // 柄
  ctx.strokeStyle = '#c9962c'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(6, -2); ctx.lineTo(44, -48); ctx.stroke();
  ctx.strokeStyle = '#8a6a1f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, -2); ctx.lineTo(44, -48); ctx.stroke();
  // 刃
  ctx.fillStyle = D.state === 'dig' ? '#8f9cab' : '#9aa7b5'; roundRect(-28, -4, 56, 22, 5); ctx.fill(); ctx.strokeStyle = '#5c6b7a'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.28)'; for (let i = -18; i <= 18; i += 12) ctx.fillRect(i - 1.2, 0, 2.4, 14);
  // 铲上的砂
  if (D.carrySand > 0.02) { const k = D.carrySand / litter.cap; ctx.fillStyle = `rgb(${litter.color.join(',')})`; ctx.beginPath(); ctx.ellipse(0, 6 - k * 4, 24 * Math.min(1, k + 0.3), 8 * Math.min(1, k + 0.2), 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.ellipse(0, 8 - k * 4, 22 * Math.min(1, k + 0.3), 4, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  for (let i = 0; i < D.carryClumps.length; i++) { const c = D.carryClumps[i]; drawClump(ptr.x + shake + (i - (D.carryClumps.length - 1) / 2) * 18, ptr.y + dy + 2, c.r * 0.85, 1); }
  // 筛砂轨迹提示
  if (lifted && D.carrySand > 0.05 && D.sift < 0.1) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ptr.x - 40, ptr.y + 24); ctx.lineTo(ptr.x + 40, ptr.y + 24); ctx.stroke(); ctx.setLineDash([]); ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.textAlign = 'center'; ctx.fillText('⇠ 晃 ⇢', ptr.x, ptr.y + 38); }
}
function drawPourBag() { ctx.save(); ctx.translate(ptr.x, ptr.y - 26); ctx.rotate(ptr.down ? -0.5 : -0.15); ctx.fillStyle = '#e2b96b'; roundRect(-16, -22, 32, 44, 6); ctx.fill(); ctx.fillStyle = '#6b3e1e'; ctx.font = '700 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('猫砂', 0, 4); ctx.restore(); }
function drawBag() {
  const b = BAG, full = D.bagClumps;
  ctx.fillStyle = D.state === 'lift' && (D.carryClumps.length || D.carrySand > 0.05) ? '#4a3f30' : '#3a3128'; roundRect(b.x, b.y, b.w, b.h, 12); ctx.fill();
  if (D.state === 'lift') { ctx.strokeStyle = '#ffcc4d'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); roundRect(b.x, b.y, b.w, b.h, 12); ctx.stroke(); ctx.setLineDash([]); }
  ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2 + 8);
  const sag = Math.min(1, full / 6);
  ctx.fillStyle = '#e8e4da'; ctx.beginPath(); ctx.moveTo(-26, -30); ctx.quadraticCurveTo(-34 - sag * 6, 10, -22, 34); ctx.lineTo(22, 34); ctx.quadraticCurveTo(34 + sag * 6, 10, 26, -30); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#b9b3a6'; ctx.lineWidth = 1.5; ctx.stroke();
  if (D.tied) { ctx.strokeStyle = '#6b3e1e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -30); ctx.lineTo(14, -30); ctx.stroke(); ctx.fillStyle = '#6b3e1e'; ctx.beginPath(); ctx.arc(0, -30, 5, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.fillStyle = '#c9c3b6'; ctx.beginPath(); ctx.ellipse(0, -30, 22, 6, 0, 0, Math.PI * 2); ctx.fill(); }
  for (let i = 0; i < Math.min(full, 5); i++) { ctx.fillStyle = '#6b3e1e'; ctx.beginPath(); ctx.arc(-14 + i * 7, 18 - (i % 2) * 8, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = '#f3e9d6'; ctx.font = '700 12px -apple-system,"PingFang SC",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`袋子 · ${full} 坨 · ${D.bagGrams}g 砂`, b.x + b.w / 2, b.y + b.h - 8);
  if (D.tasks.scoop && D.tasks.refill && !D.tied) { ctx.fillStyle = '#ffcc4d'; ctx.fillText('点我扎口', b.x + b.w / 2, b.y + 16); }
}
function drawRefill() {
  const r = REFILL; ctx.fillStyle = D.pourMode ? '#4a3f30' : '#3a3128'; roundRect(r.x, r.y, r.w, r.h, 12); ctx.fill();
  ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2 + 4); ctx.fillStyle = '#e2b96b'; roundRect(-22, -30, 44, 60, 8); ctx.fill(); ctx.fillStyle = '#6b3e1e'; ctx.font = '700 12px -apple-system,"PingFang SC",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(litter.name, 0, 4); ctx.restore();
  ctx.fillStyle = level() < 0.5 ? '#ffcc4d' : '#f3e9d6'; ctx.font = '700 12px -apple-system,"PingFang SC",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(level() < 0.5 ? '砂不够了 · 点我补砂' : '补砂', r.x + r.w / 2, r.y + r.h - 8);
}
function drawCat(c) { ctx.save(); ctx.translate(c.x, c.y); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 14, 16, 5, 0, 0, Math.PI * 2); ctx.fill(); if (c.state === 'squat') ctx.translate(Math.sin(D.t * 30) * 1.5, -10); else if (c.state === 'dig') ctx.translate(Math.sin(D.t * 18) * 4, -12); else ctx.translate(0, Math.sin(c.wob) * 2); ctx.fillStyle = '#000'; ctx.globalAlpha = 1; ctx.font = '32px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🐈', 0, 10); ctx.restore(); }

// ---------- 输入 ----------
function canvasPos(e) { const r = cv.getBoundingClientRect(); const sc = Math.min(r.width / W, r.height / H); const ox = (r.width - W * sc) / 2, oy = (r.height - H * sc) / 2; return { x: (e.clientX - r.left - ox) / sc, y: (e.clientY - r.top - oy) / sc }; }
cv.addEventListener('pointermove', e => { const p = canvasPos(e); ptr.x = p.x; ptr.y = p.y; ptr.inside = true; ptr.type = e.pointerType || 'mouse'; });
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); ac(); const p = canvasPos(e); ptr.x = p.x; ptr.y = p.y; ptr.down = true; ptr.inside = true; if (!D) return;
  if (D.pourMode) { if (!inTray(p.x, p.y)) D.pourMode = false; return; }
  if (D.state === 'lift') { if (inRect(p.x, p.y, BAG)) dump(); else if (inTray(p.x, p.y)) putBack(); else if (inRect(p.x, p.y, REFILL)) { addFloat(p.x, p.y - 20, '先把铲子放下', '#fff', 12); } return; }
  if (inRect(p.x, p.y, BAG)) { if (D.tasks.scoop && D.tasks.refill && !D.tied) tie(); else addFloat(p.x, p.y - 20, D.tied ? '已经扎好了' : '先铲完、补完砂', '#fff', 12); return; }
  if (inRect(p.x, p.y, REFILL)) { D.pourMode = true; addFloat(p.x, p.y - 20, '拿了砂袋，去盆里倒', '#fff', 12); return; }
  if (inTray(p.x, p.y)) { D.state = 'dig'; sfxT = 0; }
});
cv.addEventListener('pointerup', () => { ptr.down = false; if (D && D.state === 'dig') lift(); });
cv.addEventListener('pointerleave', () => { ptr.inside = false; ptr.down = false; if (D && D.state === 'dig') lift(); });
document.querySelectorAll('.litter-pick button').forEach(b => b.onclick = () => { document.querySelectorAll('.litter-pick button').forEach(x => x.classList.toggle('on', x === b)); litter = LITTERS[b.dataset.l]; reset(); document.getElementById('review').classList.add('hidden'); document.getElementById('stars').textContent = ''; document.getElementById('tasks').firstChild && (document.getElementById('tasks').firstChild.innerHTML = `<span class="box"></span>铲屎 3 坨（${litter.name}，${litter === LITTERS.tofu ? '可以冲' : '装袋别冲'}）`); });
document.getElementById('btn-start').onclick = () => { ac(); document.getElementById('splash').classList.add('hidden'); };

// ---------- 调试钩子 / 启动 ----------
window.RX = { get D() { return D; }, get h() { return h; }, level, ptr, litter: () => litter, reset };
reset();
let lastT = performance.now();
function frame(now) { const dt = Math.min(0.05, (now - lastT) / 1000 || 0); lastT = now; if (D) { update(dt); draw(); } requestAnimationFrame(frame); }
requestAnimationFrame(frame);
})();
