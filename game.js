/* 屎必须铲 Poop Must Scoop — v0.1 playable demo
   纯 Canvas + WebAudio 合成音，无外部资源。 */
(() => {
'use strict';

// ---------- 常量 ----------
const W = 480, H = 640;
const SAVE_KEY = 'pms_save_v1';

// 屎的生命周期：每档一个新形态。t = 起始秒数，mult = 收益倍率
const STAGES = [
  { key: 'fresh',  name: '新鲜',   t: 0,  mult: 1.5, w: 0.0 },
  { key: 'clump',  name: '结块',   t: 6,  mult: 1.0, w: 0.3 },
  { key: 'flies',  name: '招苍蝇', t: 15, mult: 1.0, w: 0.6 },
  { key: 'stink',  name: '臭气',   t: 25, mult: 0.8, w: 1.0 },
  { key: 'shroom', name: '长蘑菇', t: 40, mult: 1.0, w: 1.0, drop: 'shroom' },
  { key: 'fossil', name: '化石',   t: 60, mult: 0.5, w: 0.8, drop: 'fossil', hp: 3 },
];

// 猫：形状 / 颜色 / 偏好 / 频率
const CATS = {
  libua:   { name: '狸花', emoji: '🐈',   shape: 'swirl', color: '#6b3e1e', size: 1.0, interval: 3.0, pref: 'box',       value: 1, minDay: 1 },
  orange:  { name: '大橘', emoji: '😺',   shape: 'log',   color: '#8a4b1c', size: 1.4, interval: 5.0, pref: 'flowerbed', value: 2, minDay: 2 },
  ragdoll: { name: '布偶', emoji: '🐱',   shape: 'ball',  color: '#7a5230', size: 0.9, interval: 3.5, pref: 'box', strict: true, value: 1, minDay: 2 },
  sphynx:  { name: '无毛猫', emoji: '😼', shape: 'cube',  color: '#5c3a1e', size: 1.0, interval: 2.4, pref: 'box',       value: 1, minDay: 3 },
  kitten:  { name: '小猫', emoji: '😸',   shape: 'bean',  color: '#7d4a25', size: 0.6, interval: 2.0, pref: 'any', burst: 3, value: 0.5, minDay: 3 },
  black:   { name: '黑猫', emoji: '🐈‍⬛', shape: 'swirl', color: '#3a2415', size: 1.1, interval: 4.5, pref: 'roof',      value: 1.5, minDay: 4 },
};
const CAT_ORDER = ['libua', 'ragdoll', 'orange', 'sphynx', 'kitten', 'black'];

// 院子点位
const SPOTS = [
  { id: 'flowerbed', name: '花坛', x: 70,  y: 150, emoji: '🌷' },
  { id: 'roof',      name: '围墙', x: 410, y: 140, emoji: '🧱' },
  { id: 'bush',      name: '草丛', x: 80,  y: 400, emoji: '🌿' },
  { id: 'shoe',      name: '鞋',   x: 400, y: 410, emoji: '👟' },
  { id: 'lawn',      name: '草坪', x: 240, y: 280, emoji: '' },
  { id: 'pot',       name: '花盆', x: 240, y: 440, emoji: '🪴' },
];
const SPOT_CAP = 5;            // 同点位堆满 5 坨 → 屎山
const BOX_Y = 560, BOX_W = 120, BOX_H = 70, BOX_CAP = 4;
const BOX_SLOTS = [[-30, -12], [30, -12], [-30, 14], [30, 14]];

// 商店
const SHOP = [
  { id: 'shovel',  ico: '🥄', name: '铲子',     base: 10, max: 5,
    levels: ['塑料铲', '宽口铲 · 半径+40%', '筛砂铲 · 半径+80%，结块×1.3', '电动铲 · 半径+150%，连击窗口↑', '耙子 · 半径+250%', '铲屎机甲 · 全场一铲'] },
  { id: 'stamina', ico: '💪', name: '体力',     base: 8,  max: 10, desc: '手酸阈值 +5' },
  { id: 'grip',    ico: '🤜', name: '握力',     base: 15, max: 6,  desc: '连击倍率上限 +0.5' },
  { id: 'litter',  ico: '🧂', name: '猫砂',     base: 20, max: 2,  levels: ['普通猫砂', '结团猫砂 · 演变慢 30%', '除臭猫砂 · 跳过臭气'] },
  { id: 'box',     ico: '🧺', name: '猫砂盆',   base: 25, max: 2,  desc: '再放一个盆（最多 3）' },
  { id: 'yard',    ico: '🏡', name: '扩建后院', base: 40, max: 3,  desc: '猫容量 +5' },
  { id: 'autobox', ico: '🤖', name: '自动猫砂盆', base: 60, max: 3, desc: '定时自动清盆里一坨（收益 ×0.5）' },
  { id: 'helper',  ico: '🧑‍🌾', name: '兼职铲屎官', base: 90, max: 3, desc: '定时自动铲院子一坨（收益 ×0.5）' },
];
const SHOVEL_R = [0, 0.4, 0.8, 1.5, 2.5, 6];

// ---------- 工具 ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
let uid = 1;

// ---------- 存档 ----------
const defaultSave = () => ({
  day: 1, cans: 0, clock: 0,
  up: { shovel: 0, stamina: 0, grip: 0, litter: 0, box: 0, yard: 0, autobox: 0, helper: 0 },
  cats: ['libua'],
  col: { shroom: 0, fossil: 0 },
  stats: { scooped: 0, bestCombo: 0, mountains: 0, earned: 0 },
  poops: [], mounts: [],
});
let S = defaultSave();
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    S = Object.assign(defaultSave(), d);
    S.up = Object.assign(defaultSave().up, d.up || {});
    S.col = Object.assign(defaultSave().col, d.col || {});
    S.stats = Object.assign(defaultSave().stats, d.stats || {});
    return true;
  } catch (e) { return false; }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 隐私模式忽略 */ }
}

// ---------- 派生数值 ----------
const maxStamina = () => 15 + S.up.stamina * 5;
const catCap = () => 5 + S.up.yard * 5;
const boxCount = () => 1 + S.up.box;
const shovelRadius = () => 26 * (1 + SHOVEL_R[S.up.shovel]);
const shovelMult = () => 1 + 0.25 * S.up.shovel;
const comboCap = () => 2 + 0.5 * S.up.grip;
const comboWindow = () => S.up.shovel >= 3 ? 1.2 : 0.8;
const agingRate = () => S.up.litter >= 1 ? 0.7 : 1;
const cleanThreshold = () => 6 + boxCount() * 2 + S.up.yard * 2;
const shopCost = (item) => Math.round(item.base * Math.pow(1.6, S.up[item.id]));

function boxPositions() {
  const n = boxCount();
  return (n === 1 ? [240] : n === 2 ? [160, 320] : [90, 240, 390]).map((x, i) => ({ i, x, y: BOX_Y }));
}
function stageIdx(p) {
  const age = (S.clock - p.born) * agingRate();
  let idx = 0;
  for (let i = 0; i < STAGES.length; i++) if (age >= STAGES[i].t) idx = i;
  if (S.up.litter >= 2 && idx === 3) idx = 2; // 除臭猫砂跳过臭气
  return idx;
}
const stageOf = p => STAGES[stageIdx(p)];
function boxPoops(bi) { return S.poops.filter(p => p.loc.kind === 'box' && p.loc.box === bi); }
function boxIsClean(bi) {
  const ps = boxPoops(bi);
  return ps.length < BOX_CAP && !ps.some(p => stageIdx(p) >= 3);
}
function cleanliness() {
  let w = 0;
  for (const p of S.poops) w += stageOf(p).w;
  for (const m of S.mounts) w += m.maxhp * 0.4;
  return clamp(1 - w / cleanThreshold(), 0, 1);
}

// ---------- 音效（WebAudio 合成） ----------
let AC = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function noise(dur, vol, freq, q = 1, delay = 0) {
  const a = ac(); if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(a.destination);
  src.start(a.currentTime + delay);
}
function tone(freq, dur, type, vol, delay = 0, slide = 0) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(); o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, a.currentTime + delay + dur);
  const g = a.createGain();
  const t0 = a.currentTime + delay;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
const SFX = {
  scoop(stageKey) {
    noise(0.14, 0.5, 2800, 0.8);                                   // 沙沙
    if (stageKey === 'clump' || stageKey === 'fossil') tone(1400, 0.045, 'square', 0.12, 0.04); // 咔
    if (stageKey === 'fresh') noise(0.08, 0.25, 900, 2, 0.02);
  },
  coin(combo) {
    const f = 620 + Math.min(combo, 20) * 35;
    tone(f, 0.11, 'sine', 0.22, 0.05);
    tone(f * 1.5, 0.09, 'sine', 0.16, 0.11);
  },
  miss() { noise(0.08, 0.18, 1400, 1.5); },
  chip() { noise(0.06, 0.35, 1800, 1.2); tone(300, 0.05, 'square', 0.08); },
  boom() {
    noise(0.55, 0.9, 220, 0.6); tone(70, 0.6, 'sine', 0.5, 0, -40);
    for (let i = 0; i < 8; i++) tone(700 + i * 90, 0.1, 'sine', 0.14, 0.15 + i * 0.06);
  },
  purr() { tone(55, 0.35, 'sawtooth', 0.06); tone(58, 0.35, 'sawtooth', 0.05, 0.02); },
  drop() { tone(880, 0.08, 'triangle', 0.2); tone(1320, 0.12, 'triangle', 0.18, 0.09); },
};

// ---------- 运行时状态 ----------
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize(); window.addEventListener('resize', resize);

let D = null; // 当天运行时
let running = false;
let lastT = 0;

function newDay() {
  D = {
    stamina: maxStamina(), cats: [], parts: [], floats: [],
    combo: 0, lastHit: -9, scooped: 0, bestCombo: 0, earned: 0,
    shake: 0, ring: null, autoT: 0, helperT: 0, over: false, endTimer: 0,
    t: 0,
  };
  for (const type of S.cats) D.cats.push(makeCat(type));
}
function makeCat(type) {
  const c = { id: uid++, type, x: rnd(60, 420), y: rnd(120, 480), tx: 0, ty: 0, state: 'wander', timer: rnd(0.5, 2), nextPoop: CATS[type].interval * rnd(0.6, 1.2), target: null, wob: rnd(0, 6) };
  c.tx = c.x; c.ty = c.y; return c;
}

// ---------- 猫行为 ----------
function choosePoopTarget(cat) {
  const T = CATS[cat.type];
  const cleanBoxes = boxPositions().filter(b => boxIsClean(b.i));
  const wantsBox = T.pref === 'box' || (T.pref === 'any' && Math.random() < 0.5);
  if (wantsBox && cleanBoxes.length) return { kind: 'box', box: pick(cleanBoxes).i };
  if (T.strict) return null; // 洁癖：没干净盆就憋着
  if (T.pref !== 'box' && T.pref !== 'any') {
    const s = SPOTS.find(s => s.id === T.pref);
    return Math.random() < 0.7 ? { kind: 'spot', spot: s.id } : { kind: 'spot', spot: pick(SPOTS).id };
  }
  return { kind: 'spot', spot: pick(SPOTS).id };
}
function targetPos(t) {
  if (t.kind === 'box') { const b = boxPositions()[t.box]; return { x: b.x, y: b.y - 30 }; }
  const s = SPOTS.find(s => s.id === t.spot); return { x: s.x, y: s.y + 10 };
}
function updateCat(c, dt) {
  const T = CATS[c.type];
  c.wob += dt * 6;
  if (c.state === 'wander') {
    c.nextPoop -= dt;
    if (c.nextPoop <= 0) {
      const t = choosePoopTarget(c);
      if (t) { c.target = t; const p = targetPos(t); c.tx = p.x + rnd(-6, 6); c.ty = p.y; c.state = 'walk'; }
      else c.nextPoop = 2; // 憋着，两秒后再看
    } else {
      c.timer -= dt;
      if (c.timer <= 0) { c.tx = rnd(50, 430); c.ty = rnd(120, 490); c.timer = rnd(1.5, 4); }
      moveToward(c, 45, dt);
    }
  } else if (c.state === 'walk') {
    if (moveToward(c, 90, dt)) { c.state = 'squat'; c.timer = 1.0; }
  } else if (c.state === 'squat') {
    c.timer -= dt;
    if (c.timer <= 0) {
      layPoop(c);
      c.state = 'wander'; c.timer = rnd(1, 3);
      c.nextPoop = T.interval * rnd(0.7, 1.3);
    }
  }
}
function moveToward(c, speed, dt) {
  const d = dist(c.x, c.y, c.tx, c.ty);
  if (d < 3) return true;
  const step = Math.min(d, speed * dt);
  c.x += (c.tx - c.x) / d * step; c.y += (c.ty - c.y) / d * step;
  return d - step < 3;
}
function layPoop(c) {
  const T = CATS[c.type];
  const t = c.target; if (!t) return;
  const n = T.burst || 1;
  for (let k = 0; k < n; k++) {
    if (t.kind === 'box') {
      if (!boxIsClean(t.box)) break; // 走到一半盆已经满了，就不拉了（回去游荡）
      const used = boxPoops(t.box).map(p => p.loc.slot);
      const free = [0, 1, 2, 3].filter(i => !used.includes(i));
      if (!free.length) break;
      const slot = pick(free); const b = boxPositions()[t.box];
      S.poops.push(mkPoop(T, b.x + BOX_SLOTS[slot][0], b.y + BOX_SLOTS[slot][1], { kind: 'box', box: t.box, slot }));
    } else {
      const s = SPOTS.find(s => s.id === t.spot);
      const m = S.mounts.find(m => m.spot === s.id);
      const val = T.value * T.size;
      if (m) { m.hp += 2; m.maxhp += 2; m.val += val; m.count++; continue; }
      const here = S.poops.filter(p => p.loc.kind === 'spot' && p.loc.spot === s.id);
      if (here.length >= SPOT_CAP) { formMountain(s, here, val); continue; }
      S.poops.push(mkPoop(T, s.x + rnd(-22, 22), s.y + rnd(-10, 16), { kind: 'spot', spot: s.id }));
    }
  }
}
function mkPoop(T, x, y, loc) {
  return { id: uid++, x, y, shape: T.shape, color: T.color, size: T.size, val: T.value * T.size, born: S.clock, loc, hp: STAGES[5].hp, cat: T.name };
}
function formMountain(s, here, extraVal) {
  const ids = new Set(here.map(p => p.id));
  S.poops = S.poops.filter(p => !ids.has(p.id));
  const val = here.reduce((a, p) => a + p.val, 0) + extraVal;
  const count = here.length + 1;
  S.mounts.push({ id: uid++, spot: s.id, x: s.x, y: s.y + 6, hp: count * 2, maxhp: count * 2, val, count, born: S.clock });
  addFloat(s.x, s.y - 40, '屎山成形！', '#ffcc4d', 18);
  D.shake = Math.max(D.shake, 4);
}

// ---------- 铲 ----------
function scoopAt(x, y) {
  if (!D || D.over) return;
  const r = shovelRadius();
  D.ring = { x, y, r, life: 0.25 };
  const hitP = S.poops.filter(p => dist(x, y, p.x, p.y) <= r + 10 * p.size);
  const hitM = S.mounts.filter(m => dist(x, y, m.x, m.y) <= r + 26);
  if (!hitP.length && !hitM.length) { puff(x, y, 6, '#e8d9b0'); SFX.miss(); return; }
  if (D.stamina <= 0) return;
  D.stamina--;

  // 连击
  if (D.t - D.lastHit <= comboWindow()) D.combo++; else D.combo = 1;
  D.lastHit = D.t;
  D.bestCombo = Math.max(D.bestCombo, D.combo);
  const cm = Math.min(1 + 0.1 * (D.combo - 1), comboCap());
  let gained = 0, sfxStage = null, dropped = false;

  for (const p of hitP) {
    const st = stageOf(p);
    sfxStage = sfxStage || st.key;
    if (st.hp) {
      p.hp--;
      puff(p.x, p.y, 4, '#9a9a9a');
      if (p.hp > 0) { SFX.chip(); addFloat(p.x, p.y - 14, `敲 ${p.hp}`, '#ddd', 13); continue; }
    }
    let v = p.val * st.mult * shovelMult() * cm;
    if (st.key === 'clump' && S.up.shovel >= 2) v *= 1.3;
    v = Math.max(1, Math.round(v));
    gained += v;
    removePoop(p);
    puff(p.x, p.y, 8, p.color); puff(p.x, p.y, 6, '#e8d9b0');
    coins(p.x, p.y, Math.min(6, 2 + Math.floor(v / 3)));
    addFloat(p.x, p.y - 18, `+${v}`, '#fff3b0', 15 + Math.min(D.combo, 10));
    if (st.drop) { S.col[st.drop]++; dropped = true; addFloat(p.x + 20, p.y - 34, st.drop === 'shroom' ? '🍄 收藏' : '🦴 化石', '#ffcc4d', 14); }
  }
  for (const m of hitM) {
    const dmg = 1 + Math.floor(S.up.shovel / 2);
    m.hp -= dmg;
    puff(m.x + rnd(-20, 20), m.y + rnd(-20, 10), 6, '#6b3e1e');
    if (m.hp > 0) { SFX.chip(); addFloat(m.x, m.y - 46, `${m.hp}/${m.maxhp}`, '#fff', 13); D.shake = Math.max(D.shake, 2); continue; }
    const v = Math.max(1, Math.round(m.val * 1.3 * shovelMult() * cm));
    gained += v;
    S.mounts = S.mounts.filter(x => x.id !== m.id);
    S.stats.mountains++;
    coins(m.x, m.y - 10, 40); puff(m.x, m.y, 30, '#6b3e1e'); puff(m.x, m.y, 20, '#e8d9b0');
    addFloat(m.x, m.y - 50, `屎山崩塌 +${v}`, '#ffcc4d', 24);
    D.shake = Math.max(D.shake, 10);
    SFX.boom();
  }
  if (gained > 0) {
    S.cans += gained; D.earned += gained; S.stats.earned += gained;
    D.scooped += hitP.filter(p => !S.poops.includes(p)).length;
    SFX.scoop(sfxStage || 'clump'); SFX.coin(D.combo);
    if (dropped) SFX.drop();
    if (S.poops.length === 0 && S.mounts.length === 0) { SFX.purr(); addFloat(240, 110, '院子全干净 · 猫呼噜了', '#c8ffb0', 15); }
    D.shake = Math.max(D.shake, 2);
  } else if (hitP.length) { SFX.scoop('fossil'); }

  if (D.stamina <= 0) { D.endTimer = 0.9; }
}
function removePoop(p) { S.poops = S.poops.filter(x => x.id !== p.id); }

// 自动化
function autoTick(dt) {
  if (S.up.autobox > 0) {
    D.autoT += dt;
    const iv = 4 / (1 + 0.5 * (S.up.autobox - 1));
    if (D.autoT >= iv) {
      D.autoT = 0;
      const ps = S.poops.filter(p => p.loc.kind === 'box').sort((a, b) => a.born - b.born);
      if (ps.length) autoScoop(ps[0]);
    }
  }
  if (S.up.helper > 0) {
    D.helperT += dt;
    const iv = 6 / (1 + 0.5 * (S.up.helper - 1));
    if (D.helperT >= iv) {
      D.helperT = 0;
      const ps = S.poops.filter(p => p.loc.kind === 'spot').sort((a, b) => a.born - b.born);
      if (ps.length) autoScoop(ps[0]);
      else if (S.mounts.length) { const m = S.mounts[0]; m.hp--; puff(m.x, m.y, 4, '#6b3e1e'); if (m.hp <= 0) { const v = Math.round(m.val * 0.5); S.cans += v; D.earned += v; S.mounts = S.mounts.filter(x => x !== m); coins(m.x, m.y, 12); addFloat(m.x, m.y - 40, `帮工清山 +${v}`, '#cde', 14); } }
    }
  }
}
function autoScoop(p) {
  const st = stageOf(p);
  const v = Math.max(1, Math.round(p.val * st.mult * 0.5));
  S.cans += v; D.earned += v; S.stats.earned += v;
  removePoop(p); puff(p.x, p.y, 4, p.color); addFloat(p.x, p.y - 14, `+${v}`, '#cde', 12);
  if (st.drop) S.col[st.drop]++;
}

// ---------- 粒子 / 浮字 ----------
function puff(x, y, n, color) {
  for (let i = 0; i < n; i++) D.parts.push({ x, y, vx: rnd(-90, 90), vy: rnd(-160, -40), g: 320, life: rnd(0.35, 0.7), r: rnd(2, 4.5), color, kind: 'dot' });
}
function coins(x, y, n) {
  for (let i = 0; i < n; i++) D.parts.push({ x, y, vx: rnd(-140, 140), vy: rnd(-300, -120), g: 420, life: rnd(0.6, 1.1), r: 7, color: '#ffcc4d', kind: 'coin', rot: rnd(0, 6) });
}
function addFloat(x, y, txt, color, size) { D.floats.push({ x, y, txt, color, size, life: 1.0 }); }

// ---------- 主循环 ----------
function update(dt) {
  D.t += dt;
  if (!D.over) {
    S.clock += dt;
    for (const c of D.cats) updateCat(c, dt);
    autoTick(dt);
    if (D.endTimer > 0) { D.endTimer -= dt; if (D.endTimer <= 0) endDay(); }
  }
  for (const p of D.parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.rot !== undefined) p.rot += dt * 8; }
  D.parts = D.parts.filter(p => p.life > 0);
  for (const f of D.floats) { f.life -= dt * 0.9; f.y -= 40 * dt; }
  D.floats = D.floats.filter(f => f.life > 0);
  if (D.ring) { D.ring.life -= dt; if (D.ring.life <= 0) D.ring = null; }
  D.shake = Math.max(0, D.shake - dt * 30);
  if (D.combo > 0 && D.t - D.lastHit > comboWindow() * 2) D.combo = 0;
}

function draw() {
  ctx.save();
  if (D.shake > 0) ctx.translate(rnd(-D.shake, D.shake) * 0.5, rnd(-D.shake, D.shake) * 0.5);
  drawYard();
  const items = [];
  for (const p of S.poops) items.push({ y: p.y, f: () => drawPoop(p) });
  for (const m of S.mounts) items.push({ y: m.y + 20, f: () => drawMountain(m) });
  for (const c of D.cats) items.push({ y: c.y + 12, f: () => drawCat(c) });
  items.sort((a, b) => a.y - b.y).forEach(i => i.f());
  drawParticles();
  if (D.ring) {
    ctx.strokeStyle = `rgba(255,255,255,${D.ring.life * 2.5})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(D.ring.x, D.ring.y, D.ring.r * (1 + (0.25 - D.ring.life)), 0, Math.PI * 2); ctx.stroke();
  }
  for (const f of D.floats) {
    ctx.globalAlpha = clamp(f.life * 1.5, 0, 1);
    ctx.font = `700 ${f.size}px -apple-system, "PingFang SC", sans-serif`;
    ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.strokeText(f.txt, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.txt, f.x, f.y);
    ctx.globalAlpha = 1;
  }
  if (D.combo >= 2) {
    const s = 22 + Math.min(D.combo, 15) * 1.2;
    ctx.font = `900 ${s}px -apple-system, "PingFang SC", sans-serif`; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(60,30,0,.6)'; ctx.strokeText(`连击 ×${D.combo}`, 240, 60);
    ctx.fillStyle = '#ffcc4d'; ctx.fillText(`连击 ×${D.combo}`, 240, 60);
  }
  if (D.over) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawYard() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#5a8f3a'); g.addColorStop(1, '#3f6a2c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 草纹
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < 40; i++) { const x = (i * 97) % W, y = 90 + (i * 53) % 420; ctx.fillRect(x, y, 14, 3); }
  // 点位
  for (const s of SPOTS) {
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 12, 42, 16, 0, 0, Math.PI * 2); ctx.fill();
    if (s.emoji) { ctx.font = '30px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(s.emoji, s.x, s.y - 14); }
    ctx.font = '11px -apple-system, "PingFang SC", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText(s.name, s.x, s.y + 36);
  }
  // 猫砂盆
  for (const b of boxPositions()) {
    const clean = boxIsClean(b.i);
    ctx.fillStyle = '#7a8aa0'; roundRect(b.x - BOX_W / 2, b.y - BOX_H / 2, BOX_W, BOX_H, 12); ctx.fill();
    ctx.fillStyle = clean ? '#efe3c2' : '#d9c9a2'; roundRect(b.x - BOX_W / 2 + 8, b.y - BOX_H / 2 + 8, BOX_W - 16, BOX_H - 16, 8); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let i = 0; i < 18; i++) { const x = b.x - BOX_W / 2 + 12 + ((i * 37) % (BOX_W - 24)), y = b.y - BOX_H / 2 + 12 + ((i * 23) % (BOX_H - 24)); ctx.fillRect(x, y, 2, 2); }
    if (!clean) { ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('猫不肯用', b.x, b.y - BOX_H / 2 - 6); }
  }
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// 屎：形状 × 阶段 × 可爱脸
function drawPoop(p) {
  const si = stageIdx(p), st = STAGES[si];
  const s = 10 * p.size;
  const isFossil = st.key === 'fossil';
  const base = isFossil ? '#a8a29a' : p.color;
  const dark = isFossil ? '#7d776f' : shade(p.color, -25);
  ctx.save(); ctx.translate(p.x, p.y);
  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, s * 0.9, s * 1.2, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = base; ctx.strokeStyle = dark; ctx.lineWidth = 1.5;
  let faceY = -s * 0.2;
  if (p.shape === 'swirl') {
    blob(0, s * 0.35, s * 1.25, s * 0.7); blob(0, -s * 0.15, s * 0.95, s * 0.6); blob(0, -s * 0.6, s * 0.6, s * 0.45);
    ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 1.0); ctx.quadraticCurveTo(s * 0.5, -s * 1.5, s * 0.15, -s * 1.55); ctx.lineWidth = 3; ctx.stroke();
    faceY = -s * 0.05;
  } else if (p.shape === 'ball') {
    ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); faceY = -s * 0.1;
  } else if (p.shape === 'log') {
    roundRect(-s * 1.5, -s * 0.55, s * 3, s * 1.1, s * 0.55); ctx.fill(); ctx.stroke(); faceY = -s * 0.05;
  } else if (p.shape === 'cube') {
    roundRect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7, s * 0.3); ctx.fill(); ctx.stroke(); faceY = -s * 0.15;
  } else { // bean
    ctx.beginPath(); ctx.ellipse(0, 0, s * 1.1, s * 0.75, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); faceY = -s * 0.1;
  }
  // 脸
  const ex = s * 0.32, ey = faceY;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-ex, ey, s * 0.2, 0, Math.PI * 2); ctx.arc(ex, ey, s * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-ex + 1, ey, s * 0.1, 0, Math.PI * 2); ctx.arc(ex + 1, ey, s * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, ey + s * 0.15, s * 0.28, 0.2, Math.PI - 0.2); ctx.stroke();
  // 阶段装饰
  const t = D.t;
  if (st.key === 'fresh') {
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) { const ph = t * 3 + i; ctx.beginPath(); ctx.moveTo(i * s * 0.5, -s * 1.2); ctx.quadraticCurveTo(i * s * 0.5 + Math.sin(ph) * 3, -s * 1.7, i * s * 0.5, -s * 2.1 - (Math.sin(ph) * 2)); ctx.stroke(); }
  } else if (st.key === 'clump') {
    ctx.fillStyle = 'rgba(240,228,190,.95)';
    for (let i = 0; i < 7; i++) { const a = i * 0.9, r = s * 0.75; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.7, 1.8, 0, Math.PI * 2); ctx.fill(); }
  } else if (st.key === 'flies') {
    ctx.fillStyle = '#111';
    for (let i = 0; i < 2; i++) { const a = t * 5 + i * Math.PI + p.id; const fx = Math.cos(a) * s * 1.3, fy = -s * 1.4 + Math.sin(a * 1.7) * s * 0.4; ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(fx - 3, fy - 2, 6, 1); }
  } else if (st.key === 'stink') {
    ctx.strokeStyle = 'rgba(140,220,90,.8)'; ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); for (let k = 0; k <= 8; k++) { const y = -s * 1.1 - k * 3 - ((t * 20 + i * 7) % 8); const x = i * s * 0.55 + Math.sin(k * 0.9 + t * 4 + i) * 3; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
  } else if (st.key === 'shroom') {
    ctx.fillStyle = '#f5efe0'; ctx.fillRect(-2, -s * 1.6, 4, s * 0.7);
    ctx.fillStyle = '#e2493d'; ctx.beginPath(); ctx.arc(0, -s * 1.6, s * 0.55, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-s * 0.2, -s * 1.8, 1.6, 0, Math.PI * 2); ctx.arc(s * 0.22, -s * 1.7, 1.3, 0, Math.PI * 2); ctx.fill();
  } else if (isFossil) {
    ctx.strokeStyle = '#5f5a52'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-s * 0.6, s * 0.2); ctx.lineTo(-s * 0.2, -s * 0.1); ctx.lineTo(0, s * 0.4); ctx.moveTo(s * 0.3, -s * 0.5); ctx.lineTo(s * 0.55, s * 0.1); ctx.stroke();
    if (p.hp < STAGES[5].hp) { ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(`${p.hp}`, 0, -s * 1.3); }
  }
  ctx.restore();

  function blob(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}
function drawMountain(m) {
  const k = 1 + Math.min(m.count, 20) * 0.05;
  const w = 46 * k, h = 40 * k;
  ctx.save(); ctx.translate(m.x, m.y);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, h * 0.35, w * 1.1, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b3e1e'; ctx.strokeStyle = '#4a2a12'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-w, h * 0.3); ctx.quadraticCurveTo(-w * 0.6, -h * 0.2, -w * 0.25, -h * 0.55); ctx.quadraticCurveTo(0, -h * 1.1, w * 0.25, -h * 0.55); ctx.quadraticCurveTo(w * 0.6, -h * 0.2, w, h * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7d4a25'; ctx.beginPath(); ctx.ellipse(-w * 0.3, -h * 0.1, w * 0.25, h * 0.18, 0, 0, Math.PI * 2); ctx.ellipse(w * 0.3, 0, w * 0.22, h * 0.15, 0, 0, Math.PI * 2); ctx.fill();
  // 脸（屎山也可爱）
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-9, -h * 0.5, 5, 0, Math.PI * 2); ctx.arc(9, -h * 0.5, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-8, -h * 0.5, 2.5, 0, Math.PI * 2); ctx.arc(10, -h * 0.5, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -h * 0.42, 7, 0.2, Math.PI - 0.2); ctx.stroke();
  // 苍蝇
  ctx.fillStyle = '#111';
  for (let i = 0; i < 3; i++) { const a = D.t * 4 + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * w * 0.8, -h * 0.9 + Math.sin(a * 1.6) * 8, 2, 0, Math.PI * 2); ctx.fill(); }
  // 血条
  ctx.fillStyle = 'rgba(0,0,0,.5)'; roundRect(-w * 0.8, -h - 18, w * 1.6, 8, 4); ctx.fill();
  ctx.fillStyle = '#ff6b5a'; roundRect(-w * 0.8, -h - 18, w * 1.6 * (m.hp / m.maxhp), 8, 4); ctx.fill();
  ctx.font = '700 12px -apple-system, "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.fillText(`屎山 ${m.count} 坨`, 0, -h - 24);
  ctx.restore();
}
function drawCat(c) {
  const T = CATS[c.type];
  ctx.save(); ctx.translate(c.x, c.y);
  const sq = c.state === 'squat';
  const wob = c.state === 'walk' || (c.state === 'wander' && dist(c.x, c.y, c.tx, c.ty) > 3) ? Math.sin(c.wob) * 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 14, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.font = `${sq ? 26 : 30}px sans-serif`; ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  if (sq) ctx.translate(Math.sin(D.t * 30) * 1.5, 4);
  ctx.fillText(T.emoji, 0, 10 + wob);
  if (sq) { ctx.font = '13px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('…', 0, -22); }
  ctx.font = '10px -apple-system, "PingFang SC", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(T.name, 0, 26);
  ctx.restore();
}
function drawParticles() {
  for (const p of D.parts) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    if (p.kind === 'coin') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = '#ffcc4d'; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0a52c'; ctx.beginPath(); ctx.ellipse(0, 0, p.r * 0.6, p.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- HUD ----------
const $ = id => document.getElementById(id);
function hud() {
  $('hud-day').textContent = `第 ${S.day} 天`;
  $('hud-cans').textContent = `🥫 ${S.cans}`;
  $('hud-cats').textContent = `🐈 ${S.cats.length}/${catCap()}`;
  const st = D ? D.stamina : maxStamina();
  $('bar-stamina').style.width = `${(st / maxStamina()) * 100}%`;
  $('txt-stamina').textContent = `${st}`;
  const cl = cleanliness();
  $('bar-clean').style.width = `${cl * 100}%`;
  $('txt-clean').textContent = `${Math.round(cl * 100)}%`;
  $('combo-hint').textContent = D && D.combo >= 2 ? `连击 ×${D.combo} · 倍率 ×${Math.min(1 + 0.1 * (D.combo - 1), comboCap()).toFixed(1)}` : (S.poops.length + S.mounts.length ? `院子里 ${S.poops.length} 坨${S.mounts.length ? ` + ${S.mounts.length} 座屎山` : ''}` : '院子干净 · 等猫来');
}

// ---------- 一天的开始与结束 ----------
function startDay() {
  newDay(); running = true; lastT = performance.now();
  $('dayend').classList.add('hidden');
  $('btn-endday').disabled = false;
}
function endDay() {
  if (!D || D.over) return;
  D.over = true; $('btn-endday').disabled = true;
  const clean = cleanliness();
  const msgs = [];
  const gain = clean >= 0.7 || (S.day <= 3 && clean >= 0.5);
  if (gain) {
    if (S.cats.length < catCap()) {
      const avail = CAT_ORDER.filter(t => CATS[t].minDay <= S.day + 1);
      const unseen = avail.filter(t => !S.cats.includes(t));
      const t = unseen.length && Math.random() < 0.75 ? pick(unseen) : pick(avail);
      S.cats.push(t);
      msgs.push(`清洁度 ${Math.round(clean * 100)}%，一只${CATS[t].name}被吸引来了 ${CATS[t].emoji}`);
    } else msgs.push(`清洁度 ${Math.round(clean * 100)}%，后院满了，新猫在围墙外张望（扩建后院）`);
  } else if (clean < 0.3 && S.cats.length > 1) {
    const t = S.cats.pop();
    msgs.push(`清洁度只有 ${Math.round(clean * 100)}%，${CATS[t].name}嫌脏搬走了…`);
  } else msgs.push(`清洁度 ${Math.round(clean * 100)}%。猫们观望中，≥70% 才会来新猫。`);
  if (S.mounts.length) msgs.push(`院子里有 ${S.mounts.length} 座屎山，明天敲塌它有大奖。`);
  S.stats.scooped += D.scooped; S.stats.bestCombo = Math.max(S.stats.bestCombo, D.bestCombo);

  $('de-title').textContent = `第 ${S.day} 天 · 收工`;
  $('de-summary').innerHTML = `<div>铲了 <b>${D.scooped}</b> 坨</div><div>赚了 <b>🥫 ${D.earned}</b></div><div>最高连击 <b>×${D.bestCombo}</b></div><div>收藏 🍄 <b>${S.col.shroom}</b> · 🦴 <b>${S.col.fossil}</b></div>`;
  $('de-cats').textContent = msgs.join(' ');
  S.day++;
  save();
  renderShop();
  $('dayend').classList.remove('hidden');
}
function renderShop() {
  $('de-cans').textContent = `🥫 ${S.cans}`;
  const el = $('shop'); el.innerHTML = '';
  for (const it of SHOP) {
    const lv = S.up[it.id];
    const maxed = lv >= it.max;
    const cost = shopCost(it);
    const desc = it.levels ? (maxed ? it.levels[lv] : `→ ${it.levels[lv + 1]}`) : it.desc;
    const row = document.createElement('div'); row.className = 'item' + (maxed ? ' max' : '');
    row.innerHTML = `<div class="ico">${it.ico}</div><div class="info"><div class="name">${it.name} <span style="opacity:.5">Lv.${lv}</span></div><div class="desc">${desc}</div></div>`;
    const btn = document.createElement('button');
    btn.textContent = maxed ? '已满' : `🥫 ${cost}`;
    btn.disabled = maxed || S.cans < cost;
    btn.onclick = () => { if (S.cans >= cost && !maxed) { S.cans -= cost; S.up[it.id]++; SFX.drop(); save(); renderShop(); hud(); } };
    row.appendChild(btn); el.appendChild(row);
  }
}

// ---------- 输入 ----------
function canvasPos(e) {
  const r = cv.getBoundingClientRect();
  // object-fit: contain → 计算实际绘制区域
  const scale = Math.min(r.width / W, r.height / H);
  const ox = (r.width - W * scale) / 2, oy = (r.height - H * scale) / 2;
  return { x: (e.clientX - r.left - ox) / scale, y: (e.clientY - r.top - oy) / scale };
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); ac();
  if (!running) return;
  const p = canvasPos(e);
  if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) return;
  scoopAt(p.x, p.y);
});
$('btn-endday').onclick = () => { if (running && D && !D.over) endDay(); };
$('btn-next').onclick = () => { startDay(); };
$('btn-start').onclick = () => { ac(); $('splash').classList.add('hidden'); startDay(); };
$('btn-reset').onclick = () => { localStorage.removeItem(SAVE_KEY); S = defaultSave(); hud(); $('btn-reset').textContent = '已清空'; };
window.addEventListener('beforeunload', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// ---------- 启动 ----------
if (load()) { $('btn-start').textContent = `继续 · 第 ${S.day} 天`; }
newDay(); D.over = true; // 未开始前先画一帧静态后院
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0); lastT = now;
  if (D) { update(dt); draw(); hud(); }
  requestAnimationFrame(frame);
}
lastT = performance.now();
requestAnimationFrame(frame);
})();
