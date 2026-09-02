/* 屎必须铲 Poop Must Scoop — v0.2 换皮 demo
   系统与数值照《账单必须支付》(docs/BMBP_SYSTEM.md)，替换规则见 docs/RESKIN_MAP.md。
   标 [待核] 的数字 = 原作未查到，临时值，依据写在 RESKIN_MAP §10。 */
(() => {
'use strict';
const W = 480, H = 640;
const SAVE_KEY = 'pms_v2';
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
let uid = 1;

// ---------- 猫 = 存钱罐种类；屎 = 存钱罐实例 ----------
// loot: 掉落档位 [概率, 低, 高]。大橘 = The Tourist（原作：HP 22；65% 8–13；3% 85–125；砸碎回体）
const CATS = {
  libua:  { name: '狸花', src: 'Normalito', emoji: '🐈', shape: 'swirl', color: '#6b3e1e', size: 1.0,
            hp: 8,  loot: [[0.65, 3, 5], [0.32, 6, 8], [0.03, 30, 45]], drift: true,  restore: 0, note: '[待核] HP/掉落按 Tourist 表等比缩 1/3' },
  orange: { name: '大橘', src: 'The Tourist', emoji: '😺', shape: 'log', color: '#8a4b1c', size: 1.5,
            hp: 22, loot: [[0.65, 8, 13], [0.32, 20, 40], [0.03, 85, 125]], drift: false, restore: 3, note: '中档 20–40 与回体 +3 为 [待核]' },
};
const UNLOCK_BY_BILL = { orange: 2 }; // 付清第 2 张账单解锁大橘 [待核]

// ---------- 账单（原作锚点 + 占位，见 RESKIN_MAP §4） ----------
const BILLS = [
  { name: '水费',   amt: 20,     due: 0, src: 'Water Bill $20 立即（原作）' },
  { name: '猫粮',   amt: 95,     due: 3, src: '[待核] 占位' },
  { name: '兽医',   amt: 400,    due: 4, src: '[待核] 占位' },
  { name: '房租',   amt: 750,    due: 2, src: 'Rent $750 due in 2 days（原作截图）' },
  { name: '猫砂',   amt: 750,    due: 5, src: '[待核] 占位，五张合计 $2,015（原作）' },
  { name: '保释金', amt: 250000, due: 5, src: 'Bail Bond $250,000 due 5 days（原作）；中间账单未查到' },
  { name: '猫别墅按揭', amt: 4000000, due: 9, src: '$4M（原作）' },
  { name: '猫别墅按揭 II', amt: 7000000, due: 9, src: '$7M（原作）' },
  { name: '猫岛', amt: 56000000, due: 9, src: '$56M 最后一张（原作单人转述）' },
];

// ---------- 铲子 = 锤子（原作：Toy Hammer $1,000 伤害 7–9 攻速 1.20–1.76/s 范围 2–2.30） ----------
const PX_PER_UNIT = 20; // [待核] 原作范围单位→像素
const SHOVELS = [
  { name: '塑料铲', price: 0,    dmg: [4, 6],  spd: [1.0, 1.0],   r: 1.8, crit: 0.05, src: '[待核] 起始铲，比玩具铲弱' },
  { name: '玩具铲', price: 1000, dmg: [7, 9],  spd: [1.2, 1.76],  r: 2.0, crit: 0.05, src: 'Toy Hammer（原作数值）' },
  { name: '铁铲',   price: 4000, dmg: [14, 18], spd: [1.2, 1.5],  r: 2.3, crit: 0.10, src: '价格 $4,000（原作）；参数 [待核]' },
];
const CRIT_MULT = 2.0; // [待核]

// ---------- 技能树（局内现金，破产清零）价格 [待核] ----------
const TREE = [
  { id: 'dmg',   br: '握力',   name: '铲力',       desc: '+1 铲力',            base: 60,  max: 20 },
  { id: 'crit',  br: '握力',   name: '一铲到底',   desc: '+2% 暴击',           base: 120, max: 10 },
  { id: 'rad',   br: '握力',   name: '铲口',       desc: '+0.2 铲口',          base: 150, max: 8 },
  { id: 'stam',  br: '咖啡',   name: '体力上限',   desc: '+10 体力',           base: 80,  max: 20 },
  { id: 'drain', br: '咖啡',   name: '省力',       desc: '移动耗体 −10%',      base: 100, max: 5 },
  { id: 'spd',   br: '健身房', name: '铲速',       desc: '+5% 铲速',           base: 90,  max: 10 },
  { id: 'luck',  br: '幸运',   name: '幸运',       desc: '+3% 掉落升档几率',   base: 110, max: 10 },
  { id: 'loot',  br: '幸运',   name: '掉落',       desc: '+5% 掉落金额',       base: 100, max: 10 },
  { id: 'start', br: '猫',     name: '开局屎数',   desc: '+1 开局屎',          base: 130, max: 6 },
  { id: 'spawn', br: '猫',     name: '猫拉屎频率', desc: '拉屎间隔 −10%',      base: 130, max: 6 },
];
const treeCost = n => Math.round(n.base * Math.pow(1.6, S.run.tree[n.id] || 0)); // 1.6 [待核]

// ---------- Perk 三选一（原作效果，原数值） ----------
const PERKS = [
  { id: 'freeze',   name: '猫都睡了',     src: 'Deep Freeze',      desc: '命中有几率冻住全场 2.5s（几率随每铲累积）' },
  { id: 'recover',  name: '越铲越精神',   src: 'Recovery Smash',   desc: '每铲一下 +1 体力' },
  { id: 'interest', name: '罐头基金复利', src: 'Interest Rate',    desc: '每局开始按存款 5% 发利息' },
  { id: 'house',    name: '手气顺',       src: 'House Never Wins', desc: '赌赢后，下一局收益 ×1.5' },
  { id: 'lucky',    name: '否极泰来',     src: 'Lucky Loss',       desc: '赌输后，下一局掉落 100% 幸运' },
  { id: 'critgold', name: '一铲到底掉金', src: '暴击掉金（玩家转述）', desc: '暴击时额外掉 1 枚金币 [待核]' },
];

// ---------- 戒指（破产后用传承点购买，永久；原作 1 点/$50） ----------
const RINGS = [
  { id: 'crit',  name: '一铲到底戒', cost: 50,   src: 'Crit Ring 50 LP',        desc: '+10% 暴击，+50% 暴伤' },
  { id: 'early', name: '勤快戒',     cost: 75,   src: 'Early Speed Ring 75 LP', desc: '每提前 1 天付账 +2% 铲速（上限 25%），持续本周目' },
  { id: 'drain', name: '省力戒',     cost: 100,  src: '−10% 体力消耗戒（价格 [待核]）', desc: '体力消耗 −10%' },
  { id: 'loot',  name: '掉落戒',     cost: 100,  src: '+10% 掉落戒（价格 [待核]）',   desc: '掉落 +10%' },
  { id: 'dmg3',  name: '铲力戒 III', cost: 1000, src: 'Damage Ring III 1,000 LP', desc: '+20% 铲力' },
];
const LP_PER_DOLLAR = 1 / 50;

// ---------- 体力 [待核] ----------
const STAMINA_BASE = 60, STAMINA_PER_SWING = 1, MOVE_DRAIN = 0.5;
const SPAWN_BASE = 4.0, START_POOPS = 3; // [待核]
const TRAY = { x: 20, y: 70, w: 440, h: 400 };

// ---------- 存档 ----------
const freshRun = () => ({ cash: 0, day: 1, billIdx: 0, billDue: BILLS[0].due, paidTotal: 0, tree: {}, shovel: 0, perks: [], unlocked: ['libua'], earlyDays: 0, nextMult: 1, nextLuck: 0 });
const freshSave = () => ({ cycle: 1, lp: 0, rings: [], run: freshRun(), stats: { bankrupt: 0, paid: 0, best: 0 } });
let S = freshSave();
function load() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d && d.run) { S = Object.assign(freshSave(), d); S.run = Object.assign(freshRun(), d.run); S.stats = Object.assign(freshSave().stats, d.stats || {}); if (!Array.isArray(S.run.unlocked) || !S.run.unlocked.length) S.run.unlocked = ['libua']; return true; } } catch (e) {} return false; }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }

// ---------- 派生 ----------
const hasRing = id => S.rings.includes(id);
const lv = id => S.run.tree[id] || 0;
const shovel = () => SHOVELS[S.run.shovel];
const maxStamina = () => STAMINA_BASE + lv('stam') * 10;
const critChance = () => shovel().crit + lv('crit') * 0.02 + (hasRing('crit') ? 0.10 : 0);
const critMult = () => CRIT_MULT + (hasRing('crit') ? 0.5 : 0);
const radiusPx = () => (shovel().r + lv('rad') * 0.2) * PX_PER_UNIT;
const speed = () => { const s = shovel().spd; const base = (s[0] + s[1]) / 2 * (1 + lv('spd') * 0.05); const early = hasRing('early') ? Math.min(0.25, S.run.earlyDays * 0.02) : 0; return base * (1 + early); };
const dmgRoll = () => { const d = shovel().dmg; let v = rint(d[0], d[1]) + lv('dmg'); if (hasRing('dmg3')) v *= 1.2; return v; };
const drainMult = () => (1 - lv('drain') * 0.1) * (hasRing('drain') ? 0.9 : 1);
const lootMult = () => (1 + lv('loot') * 0.05) * (hasRing('loot') ? 1.1 : 1) * S.run.nextMult;
const luck = () => Math.min(1, lv('luck') * 0.03 + S.run.nextLuck);
const spawnInterval = () => SPAWN_BASE * Math.pow(0.9, lv('spawn'));
const hasPerk = id => S.run.perks.includes(id);
const curBill = () => BILLS[Math.min(S.run.billIdx, BILLS.length - 1)];

// ---------- 音效 ----------
let AC = null;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (AC.state === 'suspended') AC.resume(); return AC; }
function noise(dur, vol, freq, q = 1, delay = 0) { const a = ac(); if (!a) return; const n = Math.floor(a.sampleRate * dur); const b = a.createBuffer(1, n, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const g = a.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(a.destination); s.start(a.currentTime + delay); }
function tone(freq, dur, type, vol, delay = 0) { const a = ac(); if (!a) return; const o = a.createOscillator(); o.type = type; o.frequency.value = freq; const g = a.createGain(); const t0 = a.currentTime + delay; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02); }
const SFX = {
  hit() { noise(0.1, 0.4, 2600, 0.8); },
  crack() { noise(0.14, 0.5, 2200, 0.8); tone(1400, 0.04, 'square', 0.12, 0.03); },
  coin(i) { tone(700 + i * 60, 0.1, 'sine', 0.18, 0.02 * i); },
  crit() { noise(0.2, 0.6, 1800, 0.6); for (let i = 0; i < 5; i++) tone(900 + i * 120, 0.09, 'sine', 0.15, 0.05 + i * 0.05); },
  miss() { noise(0.07, 0.15, 1300, 1.5); },
  ui() { tone(880, 0.07, 'triangle', 0.15); tone(1320, 0.1, 'triangle', 0.12, 0.07); },
  bad() { tone(220, 0.25, 'sawtooth', 0.15); tone(160, 0.35, 'sawtooth', 0.15, 0.12); },
  win() { for (let i = 0; i < 6; i++) tone(600 + i * 110, 0.12, 'sine', 0.18, i * 0.07); },
};

// ---------- 运行时 ----------
const cv = document.getElementById('cv'); const ctx = cv.getContext('2d');
function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
resize(); window.addEventListener('resize', resize);
let D = null, lastT = 0;
const ptr = { x: 240, y: 300, down: false, inside: false, moved: false, type: 'mouse' };

function newRun(real) {
  D = { t: 0, stamina: maxStamina(), poops: [], cats: [], parts: [], floats: [], haul: 0, hits: 0, combo: 0, streak: 0, swingCd: 0, swingAnim: 0, freezeT: 0, freezeChance: 0, gambled: false, gambleMsg: '', spent: false, unlockMsg: '', pending: null, spawnT: spawnInterval() * 0.5, over: false, endT: 0, shake: 0, hitCount: 0, critCount: 0, destroyed: 0 };
  // 复利：每局开始按存款 5%
  if (real && hasPerk('interest') && S.run.cash > 0) { const g = Math.round(S.run.cash * 0.05); S.run.cash += g; addFloat(240, 120, `复利 +${fmt(g)}`, '#ffcc4d', 16); }
  for (let i = 0; i < START_POOPS + lv('start'); i++) spawnPoop(pick(S.run.unlocked), true);
}
function spawnPoop(type, instant) {
  const T = CATS[type];
  const x = rnd(TRAY.x + 40, TRAY.x + TRAY.w - 40), y = rnd(TRAY.y + 50, TRAY.y + TRAY.h - 40);
  if (instant) { D.poops.push(mkPoop(T, type, x, y)); return; }
  // 猫走进来拉
  const fromLeft = Math.random() < 0.5;
  D.cats.push({ type, x: fromLeft ? -30 : W + 30, y, tx: x, ty: y, state: 'in', timer: 0, wob: 0 });
}
function mkPoop(T, type, x, y) { return { id: uid++, type, x, y, hp: T.hp, maxhp: T.hp, shape: T.shape, color: T.color, size: T.size, driftT: rnd(1, 3), squash: 0 }; }

function updateCats(dt) {
  if (D.freezeT > 0) return;
  for (const c of D.cats) {
    c.wob += dt * 8;
    if (c.state === 'in') { const d = dist(c.x, c.y, c.tx, c.ty); const st = Math.min(d, 140 * dt); if (d < 2) { c.state = 'squat'; c.timer = 0.8; } else { c.x += (c.tx - c.x) / d * st; c.y += (c.ty - c.y) / d * st; } }
    else if (c.state === 'squat') { c.timer -= dt; if (c.timer <= 0) { D.poops.push(mkPoop(CATS[c.type], c.type, c.tx, c.ty)); c.state = 'out'; c.ox = c.x < W / 2 ? -40 : W + 40; } }
    else if (c.state === 'out') { const d = Math.abs(c.ox - c.x); c.x += Math.sign(c.ox - c.x) * Math.min(d, 160 * dt); if (d < 2) c.dead = true; }
  }
  D.cats = D.cats.filter(c => !c.dead);
}
function updatePoops(dt) {
  if (D.freezeT > 0) D.freezeT -= dt;
  for (const p of D.poops) {
    p.squash = Math.max(0, p.squash - dt * 6);
    if (!CATS[p.type].drift || D.freezeT > 0) continue;
    p.driftT -= dt;
    if (p.driftT <= 0) { // 猫刨砂：屎被踢一下
      p.driftT = rnd(1.5, 3.5);
      p.x = clamp(p.x + rnd(-40, 40), TRAY.x + 30, TRAY.x + TRAY.w - 30);
      p.y = clamp(p.y + rnd(-25, 25), TRAY.y + 40, TRAY.y + TRAY.h - 30);
      puff(p.x, p.y, 4, '#e8d9b0');
    }
  }
}

// ---------- 悬停自动铲 ----------
function updateSwing(dt) {
  D.swingCd -= dt; D.swingAnim = Math.max(0, D.swingAnim - dt * 6);
  const active = ptr.inside && (ptr.down || ptr.type !== 'touch');
  if (!active || D.over) return;
  if (ptr.moved) { D.stamina -= MOVE_DRAIN * drainMult() * dt; ptr.moved = false; }
  // 前摇结束：结算落点
  if (D.pending) { D.pending.t -= dt; if (D.pending.t <= 0) { const hp = D.pending; D.pending = null; resolveSwing(hp.x, hp.y); } }
  if (D.swingCd > 0 || D.pending) return;
  const r = radiusPx();
  const targets = D.poops.filter(p => dist(ptr.x, ptr.y, p.x, p.y) <= r + 8 * p.size);
  if (!targets.length) return;
  if (D.stamina <= 0) return;
  const iv = 1 / speed();
  D.swingCd = iv; D.swingAnim = 1;
  D.stamina -= STAMINA_PER_SWING * drainMult();
  if (hasPerk('recover')) D.stamina = Math.min(maxStamina(), D.stamina + 1);
  D.pending = { x: ptr.x, y: ptr.y, t: iv * 0.35 }; // [待核] 前摇占挥铲间隔 35%
}
function resolveSwing(x, y) {
  const r = radiusPx();
  const targets = D.poops.filter(p => dist(x, y, p.x, p.y) <= r + 8 * p.size);
  if (!targets.length) { D.streak = 0; puff(x, y, 5, '#e8d9b0'); addFloat(x, y - 20, '铲空', '#ddd', 12); SFX.miss(); return; }
  D.hits++; D.streak++;
  if (D.streak % 10 === 0) { D.combo++; addFloat(x, y - 50, `连击 ${D.combo}`, '#ffcc4d', 18); }
  if (hasPerk('freeze')) { D.freezeChance += 0.01; if (Math.random() < D.freezeChance) { D.freezeT = 2.5; D.freezeChance = 0; addFloat(240, 110, '猫都睡了 · 2.5s', '#9fd8ff', 16); } }
  const isCrit = Math.random() < critChance();
  let dmg = dmgRoll(); if (isCrit) dmg = Math.round(dmg * critMult());
  const p = targets.sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y))[0];
  p.hp -= dmg; p.squash = 1;
  puff(p.x, p.y, 5, '#e8d9b0'); puff(p.x, p.y, 3, p.color);
  addFloat(p.x + rnd(-10, 10), p.y - 24, `${isCrit ? '暴击 ' : ''}-${dmg}`, isCrit ? '#ffcc4d' : '#fff', isCrit ? 17 : 13);
  if (isCrit) { D.critCount++; SFX.crit(); coins(p.x, p.y, hasPerk('critgold') ? 6 : 3); D.shake = 4; if (hasPerk('critgold')) { D.haul += 1; addFloat(p.x + 16, p.y - 40, '+$1', '#ffcc4d', 12); } }
  if (p.hp <= 0) destroyPoop(p); else if (!isCrit) SFX.hit();
}
function rollLoot(T) {
  let tier = 0; const r = Math.random(); let acc = 0;
  for (let i = 0; i < T.loot.length; i++) { acc += T.loot[i][0]; if (r < acc) { tier = i; break; } }
  if (Math.random() < luck()) tier = Math.min(T.loot.length - 1, tier + 1);
  const t = T.loot[tier];
  return { v: rint(t[1], t[2]), tier };
}
function destroyPoop(p) {
  const T = CATS[p.type];
  const { v, tier } = rollLoot(T);
  const gain = Math.round(v * lootMult());
  D.haul += gain; D.destroyed++;
  D.poops = D.poops.filter(x => x.id !== p.id);
  puff(p.x, p.y, 10, p.color); puff(p.x, p.y, 8, '#e8d9b0');
  coins(p.x, p.y, Math.min(24, 3 + Math.floor(gain / 2)));
  addFloat(p.x, p.y - 34, `+${fmt(gain)}`, tier === 2 ? '#ff9de2' : tier === 1 ? '#ffcc4d' : '#fff3b0', 15 + tier * 4);
  if (tier === 2) { addFloat(p.x, p.y - 56, '大奖！', '#ff9de2', 20); D.shake = 8; SFX.win(); } else SFX.crack();
  if (T.restore) { D.stamina = Math.min(maxStamina(), D.stamina + T.restore); addFloat(p.x, p.y - 12, `体力 +${T.restore}`, '#7ee081', 13); }
}

// ---------- 粒子 ----------
function puff(x, y, n, color) { for (let i = 0; i < n; i++) D.parts.push({ x, y, vx: rnd(-90, 90), vy: rnd(-160, -40), g: 320, life: rnd(0.3, 0.6), r: rnd(2, 4), color, kind: 'dot' }); }
function coins(x, y, n) { for (let i = 0; i < n; i++) { D.parts.push({ x, y, vx: rnd(-160, 160), vy: rnd(-320, -140), g: 520, life: rnd(0.7, 1.1), r: 6, kind: Math.random() < 0.15 ? 'gem' : 'coin', rot: rnd(0, 6) }); if (i < 6) SFX.coin(i); } }
function addFloat(x, y, txt, color, size) { D.floats.push({ x, y, txt, color, size, life: 1 }); }

// ---------- 主循环 ----------
function update(dt) {
  D.t += dt;
  if (!D.over) {
    updateCats(dt); updatePoops(dt); updateSwing(dt);
    D.spawnT -= dt; if (D.spawnT <= 0) { D.spawnT = spawnInterval(); if (D.poops.length + D.cats.length < 12) spawnPoop(pick(S.run.unlocked), false); }
    if (D.stamina <= 0 && !D.pending && D.endT <= 0) { D.stamina = 0; D.endT = 0.8; }
    if (D.endT > 0) { D.endT -= dt; if (D.endT <= 0) endRun(); }
  }
  for (const p of D.parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.rot !== undefined) p.rot += dt * 9; }
  D.parts = D.parts.filter(p => p.life > 0);
  for (const f of D.floats) { f.life -= dt; f.y -= 40 * dt; }
  D.floats = D.floats.filter(f => f.life > 0);
  D.shake = Math.max(0, D.shake - dt * 30);
}
function draw() {
  ctx.save();
  if (D.shake > 0) ctx.translate(rnd(-D.shake, D.shake) * 0.5, rnd(-D.shake, D.shake) * 0.5);
  // 背景 + 猫砂盘
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5a8f3a'); g.addColorStop(1, '#3f6a2c'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#7a8aa0'; roundRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 18); ctx.fill();
  ctx.fillStyle = D.freezeT > 0 ? '#dbe9f5' : '#efe3c2'; roundRect(TRAY.x + 10, TRAY.y + 10, TRAY.w - 20, TRAY.h - 20, 12); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 90; i++) ctx.fillRect(TRAY.x + 16 + (i * 53) % (TRAY.w - 32), TRAY.y + 16 + (i * 37) % (TRAY.h - 32), 2, 2);
  const items = [];
  for (const p of D.poops) items.push({ y: p.y, f: () => drawPoop(p) });
  for (const c of D.cats) items.push({ y: c.y + 10, f: () => drawCat(c) });
  items.sort((a, b) => a.y - b.y).forEach(i => i.f());
  drawParticles();
  for (const f of D.floats) { ctx.globalAlpha = clamp(f.life * 1.5, 0, 1); ctx.font = `700 ${f.size}px -apple-system,"PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeText(f.txt, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.txt, f.x, f.y); ctx.globalAlpha = 1; }
  if (ptr.inside && !D.over) drawShovel();
  // 底部信息条
  ctx.fillStyle = 'rgba(0,0,0,.35)'; roundRect(20, 486, 440, 134, 14); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '700 15px -apple-system,"PingFang SC",sans-serif';
  const b = curBill();
  ctx.fillText(`账单 ${S.run.billIdx + 1}：${b.name}  ${fmt(b.amt)}`, 36, 512);
  ctx.font = '13px -apple-system,"PingFang SC",sans-serif'; ctx.fillStyle = S.run.billDue <= 0 ? '#ff8a80' : '#ffe08a';
  ctx.fillText(S.run.billDue <= 0 ? '今天收工就要付，付不出就破产' : `${S.run.billDue} 天后到期`, 36, 532);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  const sh = shovel();
  ctx.fillText(`${sh.name} · 铲力 ${sh.dmg[0] + lv('dmg')}–${sh.dmg[1] + lv('dmg')} · 铲速 ${speed().toFixed(2)}/s · 铲口 ${(radiusPx() / PX_PER_UNIT).toFixed(1)} · 暴击 ${Math.round(critChance() * 100)}%`, 36, 556);
  ctx.fillText(`本局所得 ${fmt(D.haul)} · 铲了 ${D.hits} 下 · 连击 ${D.combo}${D.freezeT > 0 ? ' · ❄ 猫都睡了' : ''}`, 36, 578);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '12px -apple-system,"PingFang SC",sans-serif';
  ctx.fillText(ptr.type === 'touch' ? '手指按住拖到屎上，自动铲' : '鼠标移到屎上，自动铲 · 不用点', 36, 604);
  if (D.over) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawShovel() {
  const r = radiusPx();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(ptr.x, ptr.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.save(); ctx.translate(ptr.x + 18, ptr.y - 18); ctx.rotate(-0.6 + D.swingAnim * 1.1);
  ctx.fillStyle = '#c9962c'; ctx.fillRect(-3, -46, 6, 46);
  ctx.fillStyle = '#9aa7b5'; roundRect(-14, -4, 28, 18, 5); ctx.fill(); ctx.strokeStyle = '#5c6b7a'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let i = -8; i <= 8; i += 8) ctx.fillRect(i - 1, 2, 2, 10);
  ctx.restore();
}
function drawPoop(p) {
  const s = 10 * p.size, sq = 1 - p.squash * 0.18;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1 + p.squash * 0.12, sq);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, s * 0.9, s * 1.2, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.color; ctx.strokeStyle = shade(p.color, -25); ctx.lineWidth = 1.5;
  let fy = -s * 0.1;
  if (p.shape === 'swirl') { blob(0, s * 0.35, s * 1.25, s * 0.7); blob(0, -s * 0.15, s * 0.95, s * 0.6); blob(0, -s * 0.6, s * 0.6, s * 0.45); ctx.beginPath(); ctx.moveTo(s * 0.1, -s); ctx.quadraticCurveTo(s * 0.5, -s * 1.5, s * 0.15, -s * 1.55); ctx.lineWidth = 3; ctx.stroke(); fy = -s * 0.05; }
  else if (p.shape === 'log') { roundRect(-s * 1.5, -s * 0.55, s * 3, s * 1.1, s * 0.55); ctx.fill(); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  // 裂纹 = 血量
  const dmgRatio = 1 - p.hp / p.maxhp;
  if (dmgRatio > 0) { ctx.strokeStyle = 'rgba(40,20,5,.7)'; ctx.lineWidth = 1.2; const n = Math.ceil(dmgRatio * 4); for (let i = 0; i < n; i++) { const a = i * 1.7 + p.id; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.2); ctx.lineTo(Math.cos(a) * s * 0.9, Math.sin(a) * s * 0.7); ctx.stroke(); } }
  // 脸
  const ex = s * 0.32;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-ex, fy, s * 0.2, 0, Math.PI * 2); ctx.arc(ex, fy, s * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-ex + 1, fy, s * 0.1, 0, Math.PI * 2); ctx.arc(ex + 1, fy, s * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.beginPath(); if (p.squash > 0.3) { ctx.arc(0, fy + s * 0.3, s * 0.22, Math.PI + 0.3, -0.3); } else ctx.arc(0, fy + s * 0.15, s * 0.28, 0.2, Math.PI - 0.2); ctx.stroke();
  if (D.freezeT > 0) { ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💤', s * 0.9, -s * 0.9); }
  // 血条
  if (p.hp < p.maxhp) { ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(-s * 1.2, -s * 1.9, s * 2.4, 5, 2); ctx.fill(); ctx.fillStyle = '#ff6b5a'; roundRect(-s * 1.2, -s * 1.9, s * 2.4 * (p.hp / p.maxhp), 5, 2); ctx.fill(); }
  ctx.restore();
  function blob(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
}
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); return `rgb(${clamp((n >> 16) + amt, 0, 255)},${clamp(((n >> 8) & 255) + amt, 0, 255)},${clamp((n & 255) + amt, 0, 255)})`; }
function drawCat(c) {
  const T = CATS[c.type];
  ctx.save(); ctx.translate(c.x, c.y);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 14, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.font = '30px sans-serif'; ctx.textAlign = 'center';
  if (c.state === 'squat') ctx.translate(Math.sin(D.t * 30) * 1.5, 4);
  ctx.fillText(T.emoji, 0, 10 + (c.state === 'squat' ? 0 : Math.sin(c.wob) * 2));
  ctx.font = '10px -apple-system,"PingFang SC",sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText(T.name, 0, 26);
  ctx.restore();
}
function drawParticles() {
  for (const p of D.parts) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    if (p.kind === 'coin') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = '#ffcc4d'; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e0a52c'; ctx.beginPath(); ctx.ellipse(0, 0, p.r * 0.6, p.r * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    else if (p.kind === 'gem') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = '#7fd8ff'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 0); ctx.lineTo(0, 7); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
    else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

// ---------- HUD ----------
const $ = id => document.getElementById(id);
function hud() {
  $('hud-day').textContent = `第 ${S.cycle} 周目 · 第 ${S.run.day} 天`;
  $('hud-cans').textContent = D && !D.over ? `${fmt(S.run.cash)} +${fmt(D.haul)}` : fmt(S.run.cash);
  $('hud-cats').textContent = `💍 ${S.lp} 点`;
  const st = D ? Math.max(0, D.stamina) : maxStamina();
  $('bar-stamina').style.width = `${(st / maxStamina()) * 100}%`; $('txt-stamina').textContent = `${Math.ceil(st)}`;
  const b = curBill(); const pct = clamp((S.run.cash + (D && !D.over ? D.haul : 0)) / b.amt, 0, 1);
  $('bar-clean').style.width = `${pct * 100}%`; $('txt-clean').textContent = `${Math.round(pct * 100)}%`;
  $('combo-hint').textContent = D && !D.over ? `盘里 ${D.poops.length} 坨` : '';
}

// ---------- 结算 ----------
function startRun() { newRun(true); $('dayend').classList.add('hidden'); $('btn-endday').disabled = false; save(); }
function endRun() {
  if (!D || D.over) return;
  D.over = true; D.pending = null; $('btn-endday').disabled = true;
  S.run.cash += D.haul;
  S.run.nextMult = 1; S.run.nextLuck = 0;
  S.stats.best = Math.max(S.stats.best, D.haul);
  renderSettle();
  $('dayend').classList.remove('hidden');
}
function renderSettle() {
  $('de-title').textContent = `第 ${S.run.day} 天 · 收工`;
  const done = S.run.billIdx >= BILLS.length;
  const b = curBill(); const canPay = !done && S.run.cash >= b.amt;
  let html = `<div class="summary"><div>本局所得 <b>${fmt(D.haul)}</b></div><div>存款 <b>${fmt(S.run.cash)}</b></div><div>铲了 <b>${D.hits}</b> 下 · 暴击 <b>${D.critCount}</b></div><div>铲净 <b>${D.destroyed}</b> 坨 · 连击 <b>${D.combo}</b></div></div>`;
  // 赌局
  if (!D.gambled && !D.spent && D.haul > 0 && S.run.cash >= D.haul) html += `<div class="sect"><div class="sect-t">🪙 猫推硬币 <span class="sub">Double or Nothing · 押本局所得 ${fmt(D.haul)} · 50/50</span></div><button class="ghost" id="btn-flip">让猫推一下</button></div>`;
  else if (D.gambleMsg) html += `<div class="sect"><div class="sect-t">${D.gambleMsg}</div></div>`;
  if (D.unlockMsg) html += `<div class="sect"><div class="sect-t">🐾 ${D.unlockMsg}</div></div>`;
  // 账单
  if (done) html += `<div class="sect bill"><div class="sect-t">🎉 全部账单付清 · 自由！</div><div class="sub">原作此处进入 King Piggy Boss → 税 → 结局，demo v0.5 再做。可以继续铲着玩。</div></div>`;
  else html += `<div class="sect bill ${S.run.billDue <= 0 && !canPay ? 'danger' : ''}"><div class="sect-t">🧾 账单 ${S.run.billIdx + 1}：${b.name} <b>${fmt(b.amt)}</b> <span class="sub">${S.run.billDue <= 0 ? '今天到期' : `${S.run.billDue} 天后到期`}${S.run.billDue > 0 ? ` · 现在付=提前 ${S.run.billDue} 天，下一张到期日提前同样天数${hasRing('early') ? '，勤快戒 +' + S.run.billDue * 2 + '% 铲速' : ''}` : ''}</span></div>
    <div class="sub src">${b.src}</div>
    <button class="primary sm" id="btn-pay" ${canPay ? '' : 'disabled'}>${canPay ? `付清 ${fmt(b.amt)}` : `还差 ${fmt(b.amt - S.run.cash)}`}</button>
    ${S.run.billDue <= 0 && !canPay ? `<button class="ghost danger" id="btn-bankrupt">付不出 → 破产（传承点 ${Math.floor(S.run.paidTotal * LP_PER_DOLLAR)}）</button>` : ''}</div>`;
  const mustPay = !done && S.run.billDue <= 0; // 今天到期：有钱必须先付，没钱只能破产
  // Perk 已持有
  if (S.run.perks.length) html += `<div class="sub">持有 perk：${S.run.perks.map(id => PERKS.find(p => p.id === id).name).join(' · ')}</div>`;
  // 技能树
  html += `<h3>技能树 <span class="cans">${fmt(S.run.cash)}</span></h3><div id="tree" class="grid"></div>`;
  // 铲子商店
  html += `<h3>铲子商店</h3><div id="shop"></div>`;
  $('de-summary').innerHTML = html;
  const tree = $('tree');
  for (const n of TREE) {
    const l = lv(n.id), cost = treeCost(n), maxed = l >= n.max;
    const el = document.createElement('div'); el.className = 'item' + (maxed ? ' max' : '');
    el.innerHTML = `<div class="info"><div class="name">${n.name} <span class="sub">Lv.${l} · ${n.br}</span></div><div class="desc">${n.desc}</div></div>`;
    const btn = document.createElement('button'); btn.textContent = maxed ? '满' : fmt(cost); btn.disabled = maxed || S.run.cash < cost;
    btn.onclick = () => { S.run.cash -= cost; S.run.tree[n.id] = l + 1; D.spent = true; SFX.ui(); save(); renderSettle(); hud(); };
    el.appendChild(btn); tree.appendChild(el);
  }
  const shop = $('shop');
  SHOVELS.forEach((sh, i) => {
    const owned = i <= S.run.shovel;
    const el = document.createElement('div'); el.className = 'item' + (i === S.run.shovel ? ' max' : '');
    el.innerHTML = `<div class="ico">🥄</div><div class="info"><div class="name">${sh.name}</div><div class="desc">铲力 ${sh.dmg[0]}–${sh.dmg[1]} · 铲速 ${sh.spd[0]}–${sh.spd[1]}/s · 铲口 ${sh.r} · 暴击 ${sh.crit * 100}% <span class="src">${sh.src}</span></div></div>`;
    const btn = document.createElement('button'); btn.textContent = i === S.run.shovel ? '在用' : owned ? '已有' : fmt(sh.price); btn.disabled = owned || S.run.cash < sh.price || i !== S.run.shovel + 1;
    btn.onclick = () => { S.run.cash -= sh.price; S.run.shovel = i; D.spent = true; SFX.ui(); save(); renderSettle(); hud(); };
    el.appendChild(btn); shop.appendChild(el);
  });
  const flip = $('btn-flip'); if (flip) flip.onclick = () => {
    const win = Math.random() < 0.5;
    if (win) { S.run.cash += D.haul; if (hasPerk('house')) S.run.nextMult = 1.5; SFX.win(); }
    else { S.run.cash -= D.haul; if (hasPerk('lucky')) S.run.nextLuck = 1; SFX.bad(); }
    D.gambled = true; D.gambleMsg = win ? `🪙 正面！本局所得翻倍 → +${fmt(D.haul)}${hasPerk('house') ? ' · 手气顺：下局 ×1.5' : ''}` : `🪙 反面…本局所得归零 −${fmt(D.haul)}${hasPerk('lucky') ? ' · 否极泰来：下局 100% 幸运' : ''}`;
    save(); renderSettle(); hud();
  };
  const pay = $('btn-pay'); if (pay) pay.onclick = payBill;
  const bk = $('btn-bankrupt'); if (bk) bk.onclick = bankrupt;
  $('btn-next').textContent = mustPay ? (canPay ? '账单今天到期，先付清' : '付不出账单，不能进入下一天') : '下一天';
  $('btn-next').disabled = mustPay;
}
function payBill() {
  const b = curBill();
  S.run.cash -= b.amt; S.run.paidTotal += b.amt; S.stats.paid += b.amt;
  const early = Math.max(0, S.run.billDue); S.run.earlyDays += early;
  S.run.billIdx++;
  const nb = curBill(); S.run.billDue = Math.max(0, nb.due - early); // 提前付：下一张到期日提前同样天数（原作）
  for (const [cat, idx] of Object.entries(UNLOCK_BY_BILL)) if (S.run.billIdx >= idx && !S.run.unlocked.includes(cat)) { S.run.unlocked.push(cat); D.unlockMsg = `解锁新猫：${CATS[cat].name} ${CATS[cat].emoji}（原作 ${CATS[cat].src}）`; }
  if (S.run.billIdx >= BILLS.length) { S.run.billDue = 99; SFX.win(); save(); renderSettle(); hud(); return; }
  SFX.win(); save();
  // 三选一 perk
  const pool = PERKS.filter(p => !S.run.perks.includes(p.id));
  const offer = []; while (offer.length < 3 && pool.length) offer.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  $('perk-list').innerHTML = '';
  for (const p of offer) { const el = document.createElement('button'); el.className = 'perk'; el.innerHTML = `<div class="name">${p.name}</div><div class="desc">${p.desc}</div><div class="src">${p.src}</div>`; el.onclick = () => { S.run.perks.push(p.id); SFX.ui(); save(); $('perkpick').classList.add('hidden'); renderSettle(); hud(); }; $('perk-list').appendChild(el); }
  $('perkpick').classList.remove('hidden');
}
function nextDay() {
  S.run.day++;
  if (S.run.billDue > 0) S.run.billDue--;
  startRun();
}
function bankrupt() {
  const lp = Math.floor(S.run.paidTotal * LP_PER_DOLLAR);
  S.lp += lp; S.stats.bankrupt++;
  SFX.bad(); save();
  $('bk-title').textContent = `破产 · 第 ${S.cycle} 周目结束`;
  $('bk-summary').innerHTML = `<div class="summary"><div>本周目付了 <b>${fmt(S.run.paidTotal)}</b> 账单</div><div>传承点 <b>+${lp}</b>（1 点 / $50）</div><div>共 <b>${S.run.day}</b> 天</div><div>现有传承点 <b>${S.lp}</b></div></div><div class="sub">保留：戒指 / 传承点。清零：现金、铲子、技能树、perk、猫解锁。（原作规则）</div>`;
  renderRings();
  $('dayend').classList.add('hidden'); $('bankrupt').classList.remove('hidden');
}
function renderRings() {
  const el = $('rings'); el.innerHTML = '';
  for (const r of RINGS) {
    const owned = hasRing(r.id);
    const row = document.createElement('div'); row.className = 'item' + (owned ? ' max' : '');
    row.innerHTML = `<div class="ico">💍</div><div class="info"><div class="name">${r.name}</div><div class="desc">${r.desc} <span class="src">${r.src}</span></div></div>`;
    const btn = document.createElement('button'); btn.textContent = owned ? '已戴' : `${r.cost} 点`; btn.disabled = owned || S.lp < r.cost;
    btn.onclick = () => { S.lp -= r.cost; S.rings.push(r.id); SFX.ui(); save(); renderRings(); hud(); };
    row.appendChild(btn); el.appendChild(row);
  }
  $('bk-lp').textContent = `💍 ${S.lp} 点`;
}
function newCycle() { S.cycle++; S.run = freshRun(); save(); $('bankrupt').classList.add('hidden'); startRun(); }

// ---------- 输入 ----------
function canvasPos(e) { const r = cv.getBoundingClientRect(); const sc = Math.min(r.width / W, r.height / H); const ox = (r.width - W * sc) / 2, oy = (r.height - H * sc) / 2; return { x: (e.clientX - r.left - ox) / sc, y: (e.clientY - r.top - oy) / sc }; }
cv.addEventListener('pointermove', e => { ptr.type = e.pointerType || 'mouse'; const p = canvasPos(e); if (Math.abs(p.x - ptr.x) + Math.abs(p.y - ptr.y) > 0.5) ptr.moved = true; ptr.x = p.x; ptr.y = p.y; ptr.inside = p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H; });
cv.addEventListener('pointerdown', e => { e.preventDefault(); ac(); ptr.type = e.pointerType || 'mouse'; const p = canvasPos(e); ptr.x = p.x; ptr.y = p.y; ptr.down = true; ptr.inside = true; });
cv.addEventListener('pointerup', () => { ptr.down = false; });
cv.addEventListener('pointerleave', () => { ptr.inside = false; ptr.down = false; });
$('btn-endday').onclick = () => { if (D && !D.over) { D.endT = 0.01; } };
$('btn-next').onclick = nextDay;
$('btn-start').onclick = () => { ac(); $('splash').classList.add('hidden'); startRun(); };
$('btn-reset').onclick = () => { localStorage.removeItem(SAVE_KEY); S = freshSave(); hud(); $('btn-reset').textContent = '已清空'; $('btn-start').textContent = '开始铲'; };
$('btn-newcycle').onclick = newCycle;
window.addEventListener('beforeunload', save);

// ---------- 调试钩子 ----------
window.PMS = { get S() { return S; }, get D() { return D; }, endRun, bankrupt, give(n) { S.run.cash += n; }, stam(n) { D.stamina = n; } };

// ---------- 启动 ----------
if (load()) $('btn-start').textContent = `继续 · 第 ${S.cycle} 周目第 ${S.run.day} 天`;
newRun(false); D.over = true;
function frame(now) { const dt = Math.min(0.05, (now - lastT) / 1000 || 0); lastT = now; if (D) { update(dt); draw(); hud(); } requestAnimationFrame(frame); }
lastT = performance.now(); requestAnimationFrame(frame);
})();
