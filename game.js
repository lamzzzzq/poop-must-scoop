/* 屎必须铲 Poop Must Scoop — v0.3 换皮 demo
   钱的说法（方案 A）：上门铲屎按坨计费，主人付工钱；屎里没有钱。3% 档 = 猫屎咖啡彩蛋。
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

// ---------- 猫 = 存钱罐（会跑的目标，血量=便意）；屎 = 掉落（一铲收工钱） ----------
// loot: 这坨屎主人给的工钱档位 [概率, 低, 高]。move: slow=Normalito 慢慢挪 · still=Tourist 趴着 · loco=El Loco 乱窜
const CATS = {
  libua:  { name: '狸花', src: 'Normalito', emoji: '🐈', verb: '梳毛', shape: 'swirl', color: '#6b3e1e', size: 1.0,
            hp: 8,  move: 'slow', speed: 32,  loot: [[0.65, 3, 5], [0.32, 6, 8], [0.03, 30, 45]], restore: 0, note: '[待核] 便意/单价按 Tourist 表等比缩 1/3' },
  siam:   { name: '暹罗', src: 'El Loco', emoji: '😼', verb: '剪指甲', shape: 'swirl', color: '#5c3a1e', size: 0.9,
            hp: 10, move: 'loco', speed: 170, firstHit: true, loot: [[0.6, 4, 6], [0.35, 8, 12], [0.05, 40, 60]], restore: 0, note: '[待核] 便意/速度/单价全部占位；首撸必中=原作 first hit always landing' },
  orange: { name: '大橘', src: 'The Tourist', emoji: '😺', verb: '揉肚子', shape: 'log', color: '#8a4b1c', size: 1.5,
            hp: 22, move: 'still', speed: 0, loot: [[0.65, 8, 13], [0.32, 20, 40], [0.03, 85, 125]], restore: 3, note: '中档 20–40 与回腰力 +3 为 [待核]' },
  sphynx: { name: '无毛猫', src: 'Woody', emoji: '🐱', verb: '擦身子', shape: 'cube', color: '#5c3a1e', size: 1.0,
            hp: 14, move: 'still', speed: 0, loot: [[0.65, 6, 9], [0.32, 12, 20], [0.03, 50, 70]], restore: 0, note: '[待核] 全部占位' },
  kitten: { name: '小猫', src: 'Piñata', emoji: '😸', verb: '挠下巴', shape: 'ball', color: '#7d4a25', size: 0.6,
            hp: 6,  move: 'slow', speed: 60, loot: [[0.5, 1, 2], [0.4, 5, 15], [0.1, 40, 80]], restore: 0, note: '[待核] 掉落极随机=原作 Piñata' },
  maine:  { name: '缅因', src: 'Taurus', emoji: '🐈‍⬛', verb: '梳大毛', shape: 'log', color: '#3a2415', size: 1.8,
            hp: 40, move: 'slow', speed: 15, loot: [[0.65, 15, 25], [0.32, 40, 70], [0.03, 150, 220]], restore: 0, note: '[待核] 大而懒=原作 Taurus' },
};
const CAT_ORDER = ['libua', 'siam', 'orange', 'sphynx', 'kitten', 'maine'];
const UNLOCK_BY_BILL = { siam: 1, orange: 2, sphynx: 3, kitten: 4, maine: 5 }; // 随账单进度解锁（原作猪随账单解锁），门槛 [待核]
const MOVE_DESC = { slow: '慢慢挪', still: '趴着不动', loco: '乱窜' };

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

// ---------- 技能树：网状发散（原作：从根节点长出，节点随账单进度出现）价格 [待核] ----------
// req = 前置节点(买到 Lv.1 才长出来)；minBill = 至少付清几张账单才解锁；x,y = 图上坐标
const TREE = [
  // 中心
  { id: 'dmg',     br: '握力',   ico: '🥄', name: '臂力',       desc: '+1 臂力',                         base: 60,  max: 20, x: 220, y: 175, req: [] },
  // 右：握力（红）
  { id: 'rad',     br: '握力',   ico: '⭕', name: '铲面',       desc: '+0.2 铲面',                       base: 150, max: 8,  x: 300, y: 130, req: ['dmg'] },
  { id: 'coll',    br: '握力',   ico: '💥', name: '连带铲',     desc: '一铲打中 2 只以上时 +25% 臂力（原作 Collateral Damage 原文数值）', base: 180, max: 4, x: 380, y: 130, req: ['rad'], minBill: 1 },
  { id: 'crit',    br: '握力',   ico: '🎯', name: '一铲到底',   desc: '+2% 暴击',                        base: 120, max: 10, x: 300, y: 60,  req: ['rad'] },
  { id: 'critdmg', br: '握力',   ico: '✨', name: '暴击臂力',   desc: '+10% 暴击倍率',                   base: 200, max: 10, x: 380, y: 60,  req: ['crit'], minBill: 1 },
  { id: 'rockrain',br: '握力',   ico: '🪨', name: '猫砂雨',     desc: '原作 Rock Rain 主动技，待做',     base: 0,   max: 1,  x: 440, y: 95,  req: ['coll'], todo: true, diamond: true },
  // 左：咖啡（蓝）
  { id: 'stam',    br: '咖啡',   ico: '☕', name: '腰力上限',   desc: '+10 腰力',                        base: 80,  max: 20, x: 140, y: 130, req: ['dmg'] },
  { id: 'drain',   br: '咖啡',   ico: '🩹', name: '护腰',       desc: '腰力消耗 −10%',                   base: 100, max: 5,  x: 60,  y: 130, req: ['stam'], minBill: 1 },
  { id: 'lightning',br:'咖啡',   ico: '⚡', name: '电动铲',     desc: '原作 Electrify 主动技，待做',     base: 0,   max: 1,  x: 60,  y: 60,  req: ['drain'], todo: true, diamond: true },
  // 上：猫（棕）
  { id: 'spawn',   br: '猫',     ico: '🐾', name: '猫来的频率', desc: '补猫间隔 −10%',                   base: 130, max: 6,  x: 220, y: 95,  req: ['dmg'], minBill: 1 },
  { id: 'start',   br: '猫',     ico: '🐈', name: '场上猫数',   desc: '+1 只猫同时在场',                 base: 130, max: 6,  x: 220, y: 25,  req: ['spawn'], minBill: 2 },
  // 下：健身房（金）
  { id: 'spd',     br: '健身房', ico: '🏋️', name: '手速',       desc: '+5% 手速',                        base: 90,  max: 10, x: 220, y: 255, req: ['dmg'] },
  { id: 'combo',   br: '健身房', ico: '🔁', name: '连铲',       desc: '原作 Combo Speed Plus，待做',     base: 0,   max: 1,  x: 140, y: 255, req: ['spd'], todo: true },
  // 下右：幸运（绿）
  { id: 'luck',    br: '幸运',   ico: '🍀', name: '幸运',       desc: '+3% 工钱升档几率',                base: 110, max: 10, x: 300, y: 255, req: ['spd'], minBill: 1 },
  { id: 'loot',    br: '幸运',   ico: '💰', name: '工钱',       desc: '+5% 工钱',                        base: 100, max: 10, x: 380, y: 255, req: ['luck'], minBill: 2 },
  { id: 'jackpot', br: '幸运',   ico: '🐷', name: '大奖',       desc: '原作 Super Jackpot $2,000,000：每坨 0.5% 双倍最高档，待做', base: 0, max: 1, x: 380, y: 320, req: ['loot'], todo: true, diamond: true },
];
const BR_COLOR = { '握力': '#8e3b3b', '咖啡': '#3b4f6e', '健身房': '#8a6a1f', '幸运': '#3e6b3a', '猫': '#6b4a2e' };
const treeNode = id => TREE.find(n => n.id === id);
// 可见：前置全部 ≥Lv.1（根节点恒可见）；可买：可见且账单进度够
const treeVisible = n => n.req.every(r => lv(r) >= 1);            // 可买：前置全买
const treePeek = n => n.req.length && n.req.some(r => treeVisible(treeNode(r))); // 一环之外：画成锁（原作也显示锁）
const treeUnlocked = n => !n.todo && treeVisible(n) && S.run.billIdx >= (n.minBill || 0);
const treeCost = n => Math.round(n.base * Math.pow(1.6, S.run.tree[n.id] || 0)); // 1.6 [待核]

// ---------- Perk 三选一（原作效果，原数值） ----------
const PERKS = [
  { id: 'freeze',   name: '猫都睡了',     src: 'Deep Freeze',      desc: '命中有几率冻住全场 2.5s（几率随每铲累积）' },
  { id: 'recover',  name: '越铲越精神',   src: 'Recovery Smash',   desc: '每铲一下 +1 腰力' },
  { id: 'interest', name: '罐头基金复利', src: 'Interest Rate',    desc: '每局开始按存款 5% 发利息' },
  { id: 'house',    name: '手气顺',       src: 'House Never Wins', desc: '赌赢后，下一局收益 ×1.5' },
  { id: 'lucky',    name: '否极泰来',     src: 'Lucky Loss',       desc: '赌输后，下一局掉落 100% 幸运' },
  { id: 'critgold', name: '一铲到底掉金', src: '暴击掉金（玩家转述）', desc: '暴击时额外掉 1 枚金币 [待核]' },
];

// ---------- 戒指（破产后用传承点购买，永久；原作 1 点/$50） ----------
const RINGS = [
  { id: 'crit',  name: '一铲到底戒', cost: 50,   src: 'Crit Ring 50 LP',        desc: '+10% 暴击，+50% 暴伤' },
  { id: 'early', name: '勤快戒',     cost: 75,   src: 'Early Speed Ring 75 LP', desc: '每提前 1 天付账 +2% 手速（上限 25%），持续本周目' },
  { id: 'drain', name: '护腰戒',     cost: 100,  src: '−10% 体力消耗戒（价格 [待核]）', desc: '腰力消耗 −10%' },
  { id: 'loot',  name: '掉落戒',     cost: 100,  src: '+10% 掉落戒（价格 [待核]）',   desc: '掉落 +10%' },
  { id: 'dmg3',  name: '臂力戒 III', cost: 1000, src: 'Damage Ring III 1,000 LP', desc: '+20% 臂力' },
];
const LP_PER_DOLLAR = 1 / 50;
// 工钱面值（原作金币面值：$1 银币 / $5 金币 / $25 绿宝石 / $100 红宝石）
const DENOMS = [{ v: 100, name: '红宝石', color: '#c0392b', kind: 'gem' }, { v: 25, name: '绿宝石', color: '#2e8b57', kind: 'gem' }, { v: 5, name: '金币', color: '#ffcc4d', kind: 'coin' }, { v: 1, name: '银币', color: '#b9bfc7', kind: 'coin' }];
// 猫熟练度：收够它的屎升级（原作猪等级 1–10 带进度条，按砸碎数涨）。门槛与每级 +10% 工钱为 [待核]
const CAT_LV_STEPS = [0, 5, 12, 22, 35, 50, 70, 95, 125, 160];
const catLevel = t => { const n = (S.run.catXp && S.run.catXp[t]) || 0; let l = 1; for (let i = 1; i < CAT_LV_STEPS.length; i++) if (n >= CAT_LV_STEPS[i]) l = i + 1; return l; };
const catLvProg = t => { const n = (S.run.catXp && S.run.catXp[t]) || 0, l = catLevel(t); if (l >= 10) return 1; return (n - CAT_LV_STEPS[l - 1]) / (CAT_LV_STEPS[l] - CAT_LV_STEPS[l - 1]); };

// ---------- 体力 [待核] ----------
const STAMINA_BASE = 60, STAMINA_PER_SWING = 1, MOVE_DRAIN = 0.5, TIME_DRAIN = 0.8; // TIME_DRAIN [待核]：腰力每秒自然流逝（原作「drains over time」，量未知）
const SPAWN_BASE = 4.0, START_CATS = 3; // [待核]：场上猫数 = 开局猫数节点；猫拉完就走，按间隔补新猫
// 埋屎 = 原作「猪会跑」的换皮：屎不长腿，但会被猫扒砂盖住。三个数都是 [待核]
const BURY_TIME = 3.0, SAND_HP_RATIO = 0.5, BURIED_TIER_UP = 1;
const TRAY = { x: 20, y: 70, w: 440, h: 400 };

// ---------- 存档 ----------
const freshRun = () => ({ cash: 0, day: 1, billIdx: 0, billDue: BILLS[0].due, paidTotal: 0, tree: {}, shovel: 0, perks: [], unlocked: ['libua'], earlyDays: 0, nextMult: 1, nextLuck: 0, catXp: {} });
const freshSave = () => ({ cycle: 1, lp: 0, rings: [], run: freshRun(), stats: { bankrupt: 0, paid: 0, best: 0 } });
let S = freshSave();
function load() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d && d.run) { S = Object.assign(freshSave(), d); S.run = Object.assign(freshRun(), d.run); S.stats = Object.assign(freshSave().stats, d.stats || {}); if (!Array.isArray(S.run.unlocked) || !S.run.unlocked.length) S.run.unlocked = ['libua']; if (!S.run.catXp) S.run.catXp = {}; return true; } } catch (e) {} return false; }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }

// ---------- 派生 ----------
const hasRing = id => S.rings.includes(id);
const lv = id => S.run.tree[id] || 0;
const shovel = () => SHOVELS[S.run.shovel];
const maxStamina = () => STAMINA_BASE + lv('stam') * 10;
const critChance = () => shovel().crit + lv('crit') * 0.02 + (hasRing('crit') ? 0.10 : 0);
const critMult = () => CRIT_MULT * (1 + lv('critdmg') * 0.1) + (hasRing('crit') ? 0.5 : 0);
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
  rub() { noise(0.09, 0.22, 1200, 0.7); },
  purr() { tone(55, 0.35, 'sawtooth', 0.07); tone(58, 0.35, 'sawtooth', 0.05, 0.02); },
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
  D = { t: 0, stamina: maxStamina(), poops: [], cats: [], parts: [], floats: [], haul: 0, hits: 0, combo: 0, streak: 0, swingCd: 0, swingAnim: 0, freezeT: 0, freezeChance: 0, gambled: false, gambleMsg: '', spent: false, unlockMsg: '', pending: null, spawnT: spawnInterval() * 0.5, over: false, endT: 0, shake: 0, critCount: 0, destroyed: 0, rubbed: 0, misses: 0, byCat: {}, coins: { 1: 0, 5: 0, 25: 0, 100: 0 }, settleView: 'summary', settleTab: 'tree' };
  // 复利：每局开始按存款 5%（只在真正开局发，预览不发）
  if (real && hasPerk('interest') && S.run.cash > 0) { const g = Math.round(S.run.cash * 0.05); S.run.cash += g; addFloat(240, 120, `复利 +${fmt(g)}`, '#ffcc4d', 16); }
  for (let i = 0; i < catCap(); i++) spawnCat(pick(S.run.unlocked));
}
const catCap = () => START_CATS + lv('start');
function spawnCat(type) {
  const x = rnd(TRAY.x + 40, TRAY.x + TRAY.w - 40), y = rnd(TRAY.y + 50, TRAY.y + TRAY.h - 40);
  puff(x, y - 10, 10, '#ffffff'); // 凭空出现
  const T = CATS[type];
  D.cats.push({ id: uid++, type, x, y, hp: T.hp, maxhp: T.hp, state: 'roam', timer: rnd(0.3, 1), dir: { x: 0, y: 0 }, squash: 0, hitOnce: false, poop: null, wob: rnd(0, 6) });
}
// 屎：一铲就收（血量 1）；被埋后加砂层
function mkPoop(T, type, x, y) { return { id: uid++, type, x, y, hp: 1, maxhp: 1, baseHp: 1, sandHp: Math.max(1, Math.round(T.hp * SAND_HP_RATIO)), shape: T.shape, color: T.color, size: T.size, squash: 0, bury: 0, buried: false, wasBuried: false }; }

function updateCats(dt) {
  if (D.freezeT > 0) return; // 猫都睡了：不动、不埋
  for (const c of D.cats) {
    const T = CATS[c.type];
    c.wob += dt * 8; c.squash = Math.max(0, c.squash - dt * 6); c.showHpT = Math.max(0, (c.showHpT || 0) - dt);
    if (c.state === 'roam') {
      c.timer -= dt;
      if (T.move === 'slow' && c.timer <= 0) { if (Math.random() < 0.4) { c.dir = { x: 0, y: 0 }; c.timer = rnd(0.8, 2); } else { const a = rnd(0, Math.PI * 2); c.dir = { x: Math.cos(a), y: Math.sin(a) }; c.timer = rnd(1, 2.5); } }
      if (T.move === 'loco' && c.timer <= 0) { if (Math.random() < 0.25) { c.dir = { x: 0, y: 0 }; c.timer = rnd(0.3, 0.7); } else { const a = rnd(0, Math.PI * 2); c.dir = { x: Math.cos(a), y: Math.sin(a) }; c.timer = rnd(0.2, 0.5); } }
      if (c.dir.x || c.dir.y) {
        c.x += c.dir.x * T.speed * dt; c.y += c.dir.y * T.speed * dt;
        const bx = clamp(c.x, TRAY.x + 30, TRAY.x + TRAY.w - 30), by = clamp(c.y, TRAY.y + 40, TRAY.y + TRAY.h - 30);
        if (bx !== c.x || by !== c.y) { c.x = bx; c.y = by; c.dir = { x: -c.dir.x, y: -c.dir.y }; }
      }
    } else if (c.state === 'squat') {
      c.timer -= dt;
      if (c.timer <= 0) {
        const p = mkPoop(T, c.type, c.x, c.y); D.poops.push(p); c.poop = p; c.state = 'bury'; c.timer = BURY_TIME;
        puff(c.x, c.y, 6, T.color); SFX.crack();
        if (T.restore) { D.stamina = Math.min(maxStamina(), D.stamina + T.restore); addFloat(c.x, c.y - 44, `腰力 +${T.restore}`, '#7ee081', 13); }
      }
    } else if (c.state === 'bury') {
      const p = c.poop;
      if (!D.poops.includes(p)) { leave(c); continue; } // 屎被抢先铲走，猫悻悻消失
      c.timer -= dt; p.bury = clamp(1 - c.timer / BURY_TIME, 0, 1);
      if (Math.random() < dt * 6) puff(p.x + rnd(-14, 14), p.y + rnd(-6, 6), 2, '#e8d9b0');
      if (c.timer <= 0) { p.buried = true; p.wasBuried = true; p.bury = 1; p.hp = 1 + p.sandHp; p.maxhp = p.hp; addFloat(p.x, p.y - 30, '埋起来了', '#c9b48a', 13); leave(c); }
    }
  }
  D.cats = D.cats.filter(c => !c.dead);
  function leave(c) { puff(c.x, c.y - 10, 8, '#ffffff'); c.dead = true; }
}
function updatePoops(dt) { for (const p of D.poops) p.squash = Math.max(0, p.squash - dt * 6); }

// ---------- 悬停自动撸 / 铲 ----------
const catHit = (c, x, y, r) => c.state === 'roam' && dist(x, y, c.x, c.y) <= r + 16;
const poopHit = (p, x, y, r) => dist(x, y, p.x, p.y) <= r + 8 * p.size;
function updateSwing(dt) {
  D.swingCd -= dt; D.swingAnim = Math.max(0, D.swingAnim - dt * 6);
  const active = ptr.inside && (ptr.down || ptr.type !== 'touch');
  if (!active || D.over) return;
  if (ptr.moved) { D.stamina -= MOVE_DRAIN * drainMult() * dt; ptr.moved = false; }
  if (D.pending) { D.pending.t -= dt; if (D.pending.t <= 0) { const h = D.pending; D.pending = null; resolveSwing(h.x, h.y, h.lock); } }
  if (D.swingCd > 0 || D.pending) return;
  const r = radiusPx();
  const cats = D.cats.filter(c => catHit(c, ptr.x, ptr.y, r)), poops = D.poops.filter(p => poopHit(p, ptr.x, ptr.y, r));
  if (!cats.length && !poops.length) return;
  if (D.stamina <= 0) return;
  const iv = 1 / speed();
  D.swingCd = iv; D.swingAnim = 1;
  D.stamina -= STAMINA_PER_SWING * drainMult();
  if (hasPerk('recover')) D.stamina = Math.min(maxStamina(), D.stamina + 1);
  // 首撸必中（El Loco）：出手时锁定还没被撸过的乱窜猫
  const lock = cats.filter(c => CATS[c.type].firstHit && !c.hitOnce).map(c => c.id);
  D.pending = { x: ptr.x, y: ptr.y, t: iv * 0.35, lock }; // [待核] 前摇占间隔 35%
}
function resolveSwing(x, y, lock) {
  const r = radiusPx();
  const cats = D.cats.filter(c => c.state === 'roam' && (catHit(c, x, y, r) || (lock.includes(c.id) && !c.hitOnce)));
  const poops = D.poops.filter(p => poopHit(p, x, y, r));
  if (!cats.length && !poops.length) { D.streak = 0; D.misses++; puff(x, y, 5, '#e8d9b0'); addFloat(x, y - 20, '扑空', '#ddd', 12); SFX.miss(); return; }
  D.hits++; D.streak++;
  if (D.streak % 10 === 0) { D.combo++; addFloat(x, y - 50, `连击 ${D.combo}`, '#ffcc4d', 18); }
  if (hasPerk('freeze')) { D.freezeChance += 0.01; if (Math.random() < D.freezeChance) { D.freezeT = 2.5; D.freezeChance = 0; addFloat(240, 110, '猫都睡了 · 2.5s', '#9fd8ff', 16); } }
  const isCrit = Math.random() < critChance();
  let dmg = dmgRoll(); if (isCrit) dmg = Math.round(dmg * critMult());
  if (cats.length + poops.length >= 2 && lv('coll')) { dmg = Math.round(dmg * (1 + 0.25 * lv('coll'))); addFloat(x, y - 64, `连带 ×${(1 + 0.25 * lv('coll')).toFixed(2)}`, '#ffb3a7', 12); }
  if (isCrit) { D.critCount++; SFX.crit(); D.shake = 4; if (hasPerk('critgold')) { D.haul += 1; addFloat(x + 16, y - 40, '+$1', '#ffcc4d', 12); } }
  // 铲面之内的猫全部吃到（原作范围=面）
  for (const c of cats) {
    const T = CATS[c.type];
    c.hitOnce = true; c.hp -= dmg; c.squash = 1; c.showHpT = 0.7; D.rubbed++;
    hearts(c.x, c.y - 20, isCrit ? 5 : 2);
    addFloat(c.x + rnd(-10, 10), c.y - 34, `${isCrit ? '挠到点上 ' : ''}${T.verb} -${dmg}`, isCrit ? '#ffcc4d' : '#fff', isCrit ? 16 : 13);
    if (c.hp <= 0) { c.hp = 0; c.state = 'squat'; c.timer = 0.8; c.dir = { x: 0, y: 0 }; addFloat(c.x, c.y - 52, '要拉了…', '#ffe08a', 15); SFX.purr(); }
  }
  if (cats.length) SFX.rub();
  for (const p of poops) {
    if (p.buried) {
      p.hp -= dmg; p.squash = 1; puff(p.x, p.y, 5, '#e8d9b0');
      addFloat(p.x + rnd(-10, 10), p.y - 24, `挖 -${dmg}`, '#f3ead6', 13);
      if (p.hp <= 1) { p.buried = false; p.hp = 1; addFloat(p.x, p.y - 40, '挖出来了！', '#ffcc4d', 16); puff(p.x, p.y, 14, '#e8d9b0'); SFX.crack(); }
    } else destroyPoop(p);
  }
}
function rollLoot(T, tierBonus = 0) {
  let tier = 0; const r = Math.random(); let acc = 0;
  for (let i = 0; i < T.loot.length; i++) { acc += T.loot[i][0]; if (r < acc) { tier = i; break; } }
  tier += tierBonus; // 埋过的结块更大：升一档 [待核]
  if (Math.random() < luck()) tier += 1;
  tier = Math.min(T.loot.length - 1, tier);
  const t = T.loot[tier];
  return { v: rint(t[1], t[2]), tier };
}
function destroyPoop(p) {
  const T = CATS[p.type];
  const { v, tier } = rollLoot(T, p.wasBuried ? BURIED_TIER_UP : 0);
  const gain = Math.round(v * lootMult() * (1 + 0.1 * (catLevel(p.type) - 1))); // 熟练度每级 +10% [待核]
  D.haul += gain; D.destroyed++; D.byCat[p.type] = (D.byCat[p.type] || 0) + 1;
  S.run.catXp[p.type] = (S.run.catXp[p.type] || 0) + 1;
  const lvBefore = catLevel(p.type); // 注意：已加过 1，下面比较升级用
  D.poops = D.poops.filter(x => x.id !== p.id);
  puff(p.x, p.y, 10, p.color); puff(p.x, p.y, 8, '#e8d9b0');
  // 按面值拆成实物币（原作 $1/$5/$25/$100）
  let rest = gain; const drops = [];
  for (const d of DENOMS) { while (rest >= d.v && (d.v > 1 || drops.length < 40)) { rest -= d.v; drops.push(d); D.coins[d.v]++; } }
  drops.slice(0, 24).forEach(d => D.parts.push({ x: p.x, y: p.y, vx: rnd(-160, 160), vy: rnd(-320, -140), g: 520, life: rnd(0.7, 1.1), r: d.kind === 'gem' ? 7 : 6, kind: d.kind, color: d.color, rot: rnd(0, 6) }));
  for (let i = 0; i < Math.min(6, drops.length); i++) SFX.coin(i);
  if (S.run.catXp[p.type] === CAT_LV_STEPS[lvBefore - 1] && lvBefore > 1) addFloat(p.x, p.y - 74, `${T.name} 等级 ${lvBefore}！`, '#7ee081', 16);
  addFloat(p.x, p.y - 34, `+${fmt(gain)} 工钱`, tier === 2 ? '#ff9de2' : tier === 1 ? '#ffcc4d' : '#fff3b0', 15 + tier * 4);
  if (tier === 2) { addFloat(p.x, p.y - 56, '☕ 猫屎咖啡！', '#ff9de2', 20); D.shake = 8; SFX.win(); } else SFX.crack();
  if (p.wasBuried) addFloat(p.x + 24, p.y - 20, '埋过·结块更大', '#c9b48a', 11);
}

// ---------- 粒子 ----------
function puff(x, y, n, color) { for (let i = 0; i < n; i++) D.parts.push({ x, y, vx: rnd(-90, 90), vy: rnd(-160, -40), g: 320, life: rnd(0.3, 0.6), r: rnd(2, 4), color, kind: 'dot' }); }
function coins(x, y, n) { for (let i = 0; i < n; i++) { D.parts.push({ x, y, vx: rnd(-160, 160), vy: rnd(-320, -140), g: 520, life: rnd(0.7, 1.1), r: 6, kind: Math.random() < 0.15 ? 'gem' : 'coin', rot: rnd(0, 6) }); if (i < 6) SFX.coin(i); } }
function hearts(x, y, n) { for (let i = 0; i < n; i++) D.parts.push({ x: x + rnd(-10, 10), y, vx: rnd(-30, 30), vy: rnd(-90, -50), g: -20, life: rnd(0.5, 0.9), r: 7, kind: 'heart' }); }
function addFloat(x, y, txt, color, size) { D.floats.push({ x, y, txt, color, size, life: 1 }); }

// ---------- 主循环 ----------
function update(dt) {
  D.t += dt;
  if (!D.over) {
    D.stamina -= TIME_DRAIN * drainMult() * dt; // 时间一直在走，腰越弯越酸
    updateCats(dt); updatePoops(dt); updateSwing(dt);
    D.spawnT -= dt; if (D.spawnT <= 0) { D.spawnT = spawnInterval(); if (D.cats.length < catCap()) spawnCat(pick(S.run.unlocked)); }
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
  ctx.fillText(`${sh.name} · 臂力 ${sh.dmg[0] + lv('dmg')}–${sh.dmg[1] + lv('dmg')} · 手速 ${speed().toFixed(2)}/s · 铲面 ${(radiusPx() / PX_PER_UNIT).toFixed(1)} · 一铲到底 ${Math.round(critChance() * 100)}%`, 36, 556);
  ctx.fillText(`今日工钱 ${fmt(D.haul)} · 撸 ${D.rubbed} 下 · 收 ${D.destroyed} 坨 · 扑空 ${D.misses} · 连击 ${D.combo}${D.freezeT > 0 ? ' · ❄ 猫都睡了' : ''}`, 36, 578);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '12px -apple-system,"PingFang SC",sans-serif';
  ctx.fillText((ptr.type === 'touch' ? '手指按住跟着猫，自动撸' : '鼠标停在猫身上自动撸，撸到它拉') + ' · 屎一铲收工钱 · 不收会被埋', 36, 604);
  if (D.over) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawShovel() {
  const r = radiusPx();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(ptr.x, ptr.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  const overCat = D.cats.some(c => c.state !== 'bury' && dist(ptr.x, ptr.y, c.x, c.y) <= r + 16);
  if (overCat) { drawHand(); return; }
  ctx.save(); ctx.translate(ptr.x + 18, ptr.y - 18); ctx.rotate(-0.6 + D.swingAnim * 1.1);
  ctx.fillStyle = '#c9962c'; ctx.fillRect(-3, -46, 6, 46);
  ctx.fillStyle = '#9aa7b5'; roundRect(-14, -4, 28, 18, 5); ctx.fill(); ctx.strokeStyle = '#5c6b7a'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let i = -8; i <= 8; i += 8) ctx.fillRect(i - 1, 2, 2, 10);
  ctx.restore();
}
function drawHand() {
  // 手掌贴着猫背来回撸：x 方向摆动；出手瞬间往下按 + 手指弯（挠）
  const stroke = Math.sin(D.t * 9) * 9, press = D.swingAnim, curl = press * 0.9;
  ctx.save(); ctx.translate(ptr.x + stroke, ptr.y - 6 + press * 4); ctx.rotate(-0.25 + Math.sin(D.t * 9) * 0.12);
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#f6c9a0'; ctx.strokeStyle = '#c98b5e'; ctx.lineWidth = 1.5;
  // 手腕/手臂
  ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(26, 30); ctx.lineTo(36, 22); ctx.lineTo(12, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  // 手掌
  ctx.beginPath(); ctx.ellipse(0, 0, 14, 11, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 四指（挠的时候弯下去变短）
  for (let i = 0; i < 4; i++) {
    const a = -1.9 + i * 0.42, len = (16 - Math.abs(i - 1.5) * 1.5) * (1 - curl * 0.45);
    ctx.save(); ctx.rotate(a); ctx.beginPath(); roundRect(-3.2, -len - 4, 6.4, len + 6, 3.2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  // 拇指
  ctx.save(); ctx.rotate(0.9); ctx.beginPath(); roundRect(-3, -14, 6, 15, 3); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.restore();
  // 撸的轨迹线
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(ptr.x - 22, ptr.y + 14); ctx.quadraticCurveTo(ptr.x, ptr.y + 20, ptr.x + 22, ptr.y + 14); ctx.stroke(); ctx.setLineDash([]);
}
function drawPoop(p) {
  const s = 10 * p.size, sq = 1 - p.squash * 0.18;
  if (p.buried) { // 鼓包 + 破绽（苍蝇）
    ctx.save(); ctx.translate(p.x, p.y);
    const k = 1 - (p.hp - p.baseHp) / Math.max(1, p.maxhp - p.baseHp); // 挖开进度
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.beginPath(); ctx.ellipse(0, s * 0.6, s * 1.7, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e4d5ae'; ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, s * 0.2, s * 1.6, s * (0.9 - k * 0.4), 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (k > 0.3) { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, s * 0.1, s * 0.35 * k, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#111';
    for (let i = 0; i < 2; i++) { const a = D.t * 5 + i * Math.PI + p.id; const fx = Math.cos(a) * s * 1.3, fy = -s * 1.1 + Math.sin(a * 1.7) * s * 0.4; ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(fx - 3, fy - 2, 6, 1); }
    ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(-s * 1.2, -s * 1.9, s * 2.4, 5, 2); ctx.fill(); ctx.fillStyle = '#e4d5ae'; roundRect(-s * 1.2, -s * 1.9, s * 2.4 * (1 - k), 5, 2); ctx.fill();
    ctx.restore(); return;
  }
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
  if (p.bury > 0 && !p.buried) { ctx.fillStyle = '#e4d5ae'; ctx.beginPath(); ctx.ellipse(0, s * 0.9 - p.bury * s * 1.2, s * 1.5, s * 1.4 * p.bury, 0, 0, Math.PI * 2); ctx.fill(); }
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
  const moving = c.state === 'roam' && (c.dir.x || c.dir.y);
  if (T.move === 'loco' && moving) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-c.dir.x * 18 - i * 6 * c.dir.x, -6 + i * 6); ctx.lineTo(-c.dir.x * 30 - i * 6 * c.dir.x, -6 + i * 6); ctx.stroke(); } }
  ctx.save();
  if (c.state === 'squat') ctx.translate(Math.sin(D.t * 30) * 1.5, -14);
  else if (c.state === 'bury') ctx.translate(Math.sin(D.t * 18) * 4, -20);
  else ctx.translate(0, moving ? Math.sin(c.wob) * 2 : 0);
  ctx.scale(1 + c.squash * 0.15, 1 - c.squash * 0.15);
  ctx.fillStyle = '#000'; ctx.globalAlpha = 1; // Chrome 会把 fillStyle 的透明度套到彩色 emoji 上
  ctx.font = '30px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(T.emoji, 0, 10);
  ctx.restore();
  ctx.font = '10px -apple-system,"PingFang SC",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText(T.name, 0, 26);
  if (c.state === 'bury') { ctx.font = '11px -apple-system,"PingFang SC",sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(`埋… ${Math.ceil(c.timer)}`, 0, -34); }
  if (c.state === 'roam' && c.hp < c.maxhp) { // 便意条：越满越要拉
    ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(-18, -28, 36, 6, 3); ctx.fill();
    ctx.fillStyle = '#b8760f'; roundRect(-18, -28, 36 * (1 - c.hp / c.maxhp), 6, 3); ctx.fill();
    if (c.showHpT > 0) { ctx.fillStyle = '#c0392b'; roundRect(-12, -46, 24, 14, 4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '700 11px -apple-system,sans-serif'; ctx.fillText(`${c.hp}`, 0, -35); } // 原作：砸中时猪身上显示剩余血量
  }
  if (D.freezeT > 0) { ctx.font = '12px sans-serif'; ctx.fillText('💤', 16, -16); }
  ctx.restore();
}
function drawParticles() {
  for (const p of D.parts) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    if (p.kind === 'coin') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color || '#ffcc4d'; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 0, p.r * 0.6, p.r * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    else if (p.kind === 'heart') { ctx.fillStyle = '#ff7fa8'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥', p.x, p.y); }
    else if (p.kind === 'gem') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color || '#7fd8ff'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 0); ctx.lineTo(0, 7); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
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
  $('bar-stamina').classList.toggle('low', !!(D && !D.over && st / maxStamina() < 0.25));
  const b = curBill(); const pct = clamp((S.run.cash + (D && !D.over ? D.haul : 0)) / b.amt, 0, 1);
  $('bar-clean').style.width = `${pct * 100}%`; $('txt-clean').textContent = `${Math.round(pct * 100)}%`;
  $('combo-hint').textContent = D && !D.over ? `场上 ${D.cats.length} 只猫 · ${D.poops.length} 坨` : '';
}

// ---------- 结算 ----------
function startRun() { newRun(true); $('dayend').classList.add('hidden'); $('btn-endday').disabled = false; save(); }
function endRun() {
  if (!D || D.over) return;
  D.over = true; D.pending = null; $('btn-endday').disabled = true;
  S.run.cash += D.haul;
  S.run.nextMult = 1; S.run.nextLuck = 0;
  S.stats.best = Math.max(S.stats.best, D.haul);
  D.settleView = 'summary';
  renderSettle();
  $('dayend').classList.remove('hidden');
}
function renderSettle() {
  const done = S.run.billIdx >= BILLS.length;
  const b = curBill(); const canPay = !done && S.run.cash >= b.amt;
  const mustPay = !done && S.run.billDue <= 0;
  $('de-title').textContent = D.settleView === 'summary' ? '腰酸了！' : ({ bill: '账单', tree: '技能树', shop: '商店', codex: '猫图鉴' })[D.settleTab];
  $('de-cash').textContent = fmt(S.run.cash);
  let html = '';
  if (D.settleView === 'summary') {
    const acc = D.hits + D.misses ? Math.round(D.hits / (D.hits + D.misses) * 100) : 100;
    const coinTotal = Object.values(D.coins).reduce((a, n) => a + n, 0);
    html += `<div class="panels"><div class="panel">
      <div class="kv"><span>精准度：</span><b>${acc}%</b></div>
      <div class="kv"><span>金币：</span><b>${coinTotal}</b></div>
      <div class="denoms">${DENOMS.slice().reverse().map(d => `<span><i class="${d.kind}" style="background:${d.color}"></i>${D.coins[d.v]}</span>`).join('')}</div>
      <div class="kv total"><span>总计：</span><b>${fmt(D.haul)}</b></div>
    </div><div class="panel">
      <div class="kv"><span>收走的屎：</span><b>${D.destroyed}</b></div>
      <div class="bycat">${Object.entries(D.byCat).map(([t, n]) => `<span>${CATS[t].emoji} ${n}</span>`).join('') || '<span class="sub">今天一坨没收到</span>'}</div>
      <div class="kv"><span>撸了：</span><b>${D.rubbed} 下</b></div><div class="kv"><span>挠到点上：</span><b>${D.critCount}</b></div><div class="kv"><span>连击：</span><b>${D.combo}</b></div>
    </div></div>`;
    // 猫等级（原作右侧：等级+进度条，锁住的显示已锁定）
    html += `<div class="catlv">${CAT_ORDER.map(id => { const T = CATS[id]; const un = S.run.unlocked.includes(id); return un ? `<div class="row"><span class="l">等级 ${catLevel(id)}</span><div class="bar-track"><div class="bar-fill" style="width:${catLvProg(id) * 100}%"></div></div><span class="e">${T.emoji}</span></div>` : `<div class="row locked"><span class="l">已锁定 · 付清第 ${UNLOCK_BY_BILL[id]} 张</span><div class="bar-track"></div><span class="e">🔒</span></div>`; }).join('')}</div>`;
    if (D.unlockMsg) html += `<div class="sect"><div class="sect-t">🐾 ${D.unlockMsg}</div></div>`;
    if (!D.gambled && !D.spent && D.haul > 0 && S.run.cash >= D.haul) html += `<div class="sect"><div class="sect-t">🪙 猫推硬币 <span class="sub">Double or Nothing · 押今日工钱 ${fmt(D.haul)} · 50/50</span></div><button class="ghost" id="btn-flip">让猫推一下</button></div>`;
    else if (D.gambleMsg) html += `<div class="sect"><div class="sect-t">${D.gambleMsg}</div></div>`;
    html += `<div class="btns3"><button class="ghost" id="btn-upg">升级</button><button class="${mustPay || canPay ? 'primary' : 'ghost'} ${mustPay ? 'urgent' : ''}" id="btn-gobill">支付账单${mustPay ? '<small>今天到期！</small>' : canPay ? '<small>可以付了</small>' : ''}</button><button class="ghost" id="btn-next" ${mustPay ? 'disabled' : ''}>${mustPay ? '先付账单' : '继续'}</button></div>`;
  } else {
    html += `<nav class="tabs">${[['bill', '账单'], ['tree', '技能树'], ['shop', '商店'], ['codex', '猫图鉴']].map(([k, n]) => `<button class="tab ${D.settleTab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</nav>`;
    if (D.settleTab === 'bill') {
      if (done) html += `<div class="sect bill"><div class="sect-t">🎉 全部账单付清 · 自由！</div><div class="sub">原作此处进入 King Piggy Boss → 税 → 结局，demo v0.5 再做。</div></div>`;
      else html += `<div class="billpaper ${mustPay && !canPay ? 'danger' : ''}"><div class="bp-from">猫咪后院物业 · 账单 ${S.run.billIdx + 1}</div><div class="bp-name">${b.name}</div><div class="bp-note">屎必须铲，账单必须付。逾期即破产。</div><div class="bp-amt-l">应付金额</div><div class="bp-amt">${fmt(b.amt)}</div><div class="bp-due-l">到期</div><div class="bp-due">${S.run.billDue <= 0 ? '今天！' : `${S.run.billDue} 天后`}</div><div class="src">${b.src}</div>
        ${S.run.billDue > 0 ? `<div class="sub">现在付 = 提前 ${S.run.billDue} 天，下一张到期日提前同样天数${hasRing('early') ? '，勤快戒 +' + S.run.billDue * 2 + '% 手速' : ''}</div>` : ''}
        <button class="primary sm" id="btn-pay" ${canPay ? '' : 'disabled'}>${canPay ? `付清 ${fmt(b.amt)}` : `还差 ${fmt(b.amt - S.run.cash)}`}</button>
        ${mustPay && !canPay ? `<button class="ghost danger" id="btn-bankrupt">付不出 → 破产（传承点 ${Math.floor(S.run.paidTotal * LP_PER_DOLLAR)}）</button>` : ''}</div>`;
      if (S.run.perks.length) html += `<div class="sub">持有 perk：${S.run.perks.map(id => PERKS.find(p => p.id === id).name).join(' · ')}</div>`;
    } else if (D.settleTab === 'tree') {
      html += `<div class="sub" style="margin-top:0">从中心「臂力」往外长，买到 Lv.1 才长出下一环；带锁的还没到（前置没买 / 账单没付清 / 原作节点待做）</div><div id="tree"></div><div id="tree-detail" class="sect"></div>`;
    } else if (D.settleTab === 'shop') {
      html += `<div id="shop"></div>`;
    } else {
      html += `<div class="cats">${CAT_ORDER.map(id => { const T = CATS[id]; const un = S.run.unlocked.includes(id); const need = UNLOCK_BY_BILL[id] || 0; return `<div class="cat ${un ? '' : 'locked'}"><div class="em">${un ? T.emoji : '🔒'}</div><div class="nm">${T.name}${un ? ` <span class="sub">Lv.${catLevel(id)}</span>` : ''}</div><div class="ds">${un ? `${T.verb} · 便意 ${T.hp} · ${MOVE_DESC[T.move]}<br>工钱 ${T.loot.map(l => `${Math.round(l[0] * 100)}% $${l[1]}–${l[2]}`).join(' / ')}` : `付清第 ${need} 张账单解锁`}</div><div class="src">${T.src}</div></div>`; }).join('')}</div>`;
    }
    html += `<div class="btns3"><button class="ghost" id="btn-back">← 结算</button><button class="primary" id="btn-next" ${mustPay ? 'disabled' : ''}>${mustPay ? (canPay ? '账单今天到期，先付清' : '付不出账单') : '继续 · 下一天'}</button></div>`;
  }
  $('de-body').innerHTML = html;
  // 绑定
  const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
  on('btn-upg', () => { D.settleView = 'tabs'; D.settleTab = 'tree'; renderSettle(); });
  on('btn-gobill', () => { D.settleView = 'tabs'; D.settleTab = 'bill'; renderSettle(); });
  on('btn-back', () => { D.settleView = 'summary'; renderSettle(); });
  on('btn-next', nextDay);
  on('btn-pay', payBill);
  on('btn-bankrupt', bankrupt);
  $('de-body').querySelectorAll('.tab').forEach(t => t.onclick = () => { D.settleTab = t.dataset.tab; renderSettle(); });
  on('btn-flip', () => {
    const win = Math.random() < 0.5;
    if (win) { S.run.cash += D.haul; if (hasPerk('house')) S.run.nextMult = 1.5; SFX.win(); }
    else { S.run.cash -= D.haul; if (hasPerk('lucky')) S.run.nextLuck = 1; SFX.bad(); }
    D.gambled = true; D.gambleMsg = win ? `🪙 正面！今日工钱翻倍 → +${fmt(D.haul)}${hasPerk('house') ? ' · 手气顺：下局 ×1.5' : ''}` : `🪙 反面…今日工钱归零 −${fmt(D.haul)}${hasPerk('lucky') ? ' · 否极泰来：下局 100% 幸运' : ''}`;
    save(); renderSettle(); hud();
  });
  if (D.settleView === 'tabs' && D.settleTab === 'tree') renderTree();
  if (D.settleView === 'tabs' && D.settleTab === 'shop') renderShop();
}
function renderShop() {
  const shop = $('shop'); shop.innerHTML = '';
  SHOVELS.forEach((sh, i) => {
    const owned = i <= S.run.shovel;
    const el = document.createElement('div'); el.className = 'item' + (i === S.run.shovel ? ' max' : '');
    el.innerHTML = `<div class="ico">🥄</div><div class="info"><div class="name">${sh.name}</div><div class="desc">臂力 ${sh.dmg[0]}–${sh.dmg[1]} · 手速 ${sh.spd[0]}–${sh.spd[1]}/s · 铲面 ${sh.r} · 一铲到底 ${sh.crit * 100}% <span class="src">${sh.src}</span></div></div>`;
    const btn = document.createElement('button'); btn.textContent = i === S.run.shovel ? '在用' : owned ? '已有' : fmt(sh.price); btn.disabled = owned || S.run.cash < sh.price || i !== S.run.shovel + 1;
    btn.onclick = () => { S.run.cash -= sh.price; S.run.shovel = i; D.spent = true; SFX.ui(); save(); renderSettle(); hud(); };
    el.appendChild(btn); shop.appendChild(el);
  });
}
let treeSel = 'dmg';
function renderTree() {
  const shown = TREE.filter(n => treeVisible(n) || treePeek(n));
  let svg = `<svg viewBox="0 0 480 350" class="tree-svg">`;
  for (const n of shown) for (const r of n.req) { const p = treeNode(r); if (!shown.includes(p)) continue; svg += `<line x1="${p.x}" y1="${p.y}" x2="${n.x}" y2="${n.y}" class="edge ${lv(n.id) ? 'on' : treeVisible(n) ? 'mid' : ''}"/>`; }
  for (const n of shown) {
    const l = lv(n.id), vis = treeVisible(n), un = treeUnlocked(n), maxed = l >= n.max, cost = treeCost(n);
    const cls = ['node', l ? 'bought' : '', vis ? '' : 'peek', (vis && !un) ? 'locked' : '', maxed ? 'maxed' : '', treeSel === n.id ? 'sel' : '', (un && !maxed && S.run.cash >= cost) ? 'afford' : '', n.diamond ? 'diamond' : ''].join(' ');
    const sz = n.id === 'dmg' ? 26 : 22;
    const shape = n.diamond ? `<rect x="${-sz}" y="${-sz}" width="${sz * 2}" height="${sz * 2}" rx="6" transform="rotate(45)"/>` : `<rect x="${-sz}" y="${-sz}" width="${sz * 2}" height="${sz * 2}" rx="8"/>`;
    svg += `<g class="${cls}" data-id="${n.id}" transform="translate(${n.x},${n.y})" style="--br:${BR_COLOR[n.br]}">${shape}<text y="4" class="ico">${vis && !n.todo ? n.ico : '🔒'}</text>${vis && !n.todo ? `<text y="${sz + 12}" class="lv">${maxed ? '满' : `Lv.${l}`}</text>` : ''}</g>`;
  }
  svg += '</svg>';
  $('tree').innerHTML = svg;
  $('tree').querySelectorAll('g.node').forEach(g => g.onclick = () => { treeSel = g.dataset.id; renderTree(); });
  const n = treeNode(treeSel); if (!n || !shown.includes(n)) { treeSel = 'dmg'; return renderTree(); }
  const l = lv(n.id), vis = treeVisible(n), un = treeUnlocked(n), maxed = l >= n.max, cost = treeCost(n);
  const kids = TREE.filter(k => k.req.includes(n.id)).map(k => k.name);
  let lockWhy = '';
  if (n.todo) lockWhy = '原作节点，demo 待做';
  else if (!vis) lockWhy = `先买 ${n.req.map(r => treeNode(r).name).join('、')}`;
  else if (!un) lockWhy = `付清第 ${n.minBill} 张账单后解锁`;
  $('tree-detail').innerHTML = `<div class="sect-t"><span class="dot" style="background:${BR_COLOR[n.br]}"></span>${n.ico} ${n.name} <span class="sub">Lv.${l}/${n.max} · ${n.br}</span></div><div>${n.desc}</div>${kids.length ? `<div class="sub">买到 Lv.1 长出：${kids.join('、')}</div>` : ''}${lockWhy ? `<div class="sub" style="color:#b8760f">🔒 ${lockWhy}</div>` : ''}<button class="primary sm" id="btn-tree-buy" ${(!un || maxed || S.run.cash < cost) ? 'disabled' : ''}>${maxed ? '已满级' : !un ? '未解锁' : `升级 ${fmt(cost)}`}</button>`;
  $('btn-tree-buy').onclick = () => { if (!un || maxed || S.run.cash < cost) return; S.run.cash -= cost; S.run.tree[n.id] = l + 1; D.spent = true; SFX.ui(); save(); renderSettle(); hud(); };
}
function payBill() {
  const b = curBill();
  S.run.cash -= b.amt; S.run.paidTotal += b.amt; S.stats.paid += b.amt;
  const early = Math.max(0, S.run.billDue); S.run.earlyDays += early;
  S.run.billIdx++;
  const nb = curBill(); S.run.billDue = Math.max(0, nb.due - early); // 提前付：下一张到期日提前同样天数（原作）
  for (const [cat, idx] of Object.entries(UNLOCK_BY_BILL)) if (S.run.billIdx >= idx && !S.run.unlocked.includes(cat)) { S.run.unlocked.push(cat); D.unlockMsg = `解锁新猫：${CATS[cat].name} ${CATS[cat].emoji}，要${CATS[cat].verb}（原作 ${CATS[cat].src}）`; }
  if (S.run.billIdx >= BILLS.length) { S.run.billDue = 99; SFX.win(); save(); renderSettle(); hud(); return; }
  D.settleView = 'summary';
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
