/* เกมความน่าจะเป็น ม.3 — frontend (vanilla, no build) สำหรับ GitHub Pages
   ต่อ GAS backend ผ่าน window.API_URL; ถ้า API ไม่พร้อมจะใช้ local generator แทน */

// ---------- API layer ----------
var API = (function () {
  var url = window.API_URL || '';
  var configured = url && url.indexOf('PASTE_YOUR') === -1;
  async function call(action, params) {
    if (!configured) throw new Error('API not configured');
    var res = await fetch(url, {
      method: 'POST',
      // text/plain = simple request, no CORS preflight (GAS-friendly)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action: action }, params || {}))
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'api error');
    return data;
  }
  return {
    configured: configured,
    getProfile: function (name) { return call('getProfile', { name: name }); },
    saveScore: function (name, mode, score) { return call('saveScore', { name: name, mode: mode, score: score }); },
    getLeaderboard: function (mode) { return call('getLeaderboard', { mode: mode || 'all', limit: 20 }); },
    getScoreboard: function (mode) { return call('getScoreboard', { mode: mode || 'all', limit: 50 }); },
    getQuestions: function (count, topic) { return call('getQuestions', { count: count, topic: topic || 'mixed' }); },
    generateQuestions: function (count) { return call('generateQuestions', { count: count }); },
    saveDaily: function (name, dateKey) { return call('saveDaily', { name: name, dateKey: dateKey }); },
    adminAuth: function (pin) { return call('adminAuth', { pin: pin }); },
    listQuestions: function (pin) { return call('listQuestions', { pin: pin }); },
    addQuestion: function (pin, question) { return call('addQuestion', { pin: pin, question: question }); },
    updateQuestion: function (pin, question) { return call('updateQuestion', { pin: pin, question: question }); },
    deleteQuestion: function (pin, id) { return call('deleteQuestion', { pin: pin, id: id }); },
    ping: function () { return call('ping', {}); }
  };
})();

// ---------- Local fallback generator (same math as GAS seed) ----------
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function frac(n, d) { var g = gcd(n, d) || 1; return (n / g) + '/' + (d / g); }
function rnd(n) { return Math.floor(Math.random() * n); }
function pick(a) { return a[rnd(a.length)]; }
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function opts(correct, gen) { var s = {}; s[correct] = 1; var g = 0; while (Object.keys(s).length < 4 && g < 40) { s[gen()] = 1; g++; } var o = shuffle(Object.keys(s)); return { options: o, correctIndex: o.indexOf(correct) }; }
var qc = 0; function qid() { qc++; return 'l' + qc + '_' + Date.now(); }

function genDice(boss) {
  if (boss) { var target = 6 + rnd(4); var combos = {6:5,7:6,8:5,9:4}; var fav = combos[target]; var c = frac(fav, 36); var o = opts(c, function () { return frac(1 + rnd(8), 36); });
    return { id: qid(), topic: 'dice', difficulty: 'hard', text: 'ทอดลูกเต๋า 2 ลูก ความน่าจะเป็นที่ผลรวมแต้มเท่ากับ ' + target + ' เท่ากับเท่าใด', options: o.options, correctIndex: o.correctIndex, explanation: 'ผลลัพธ์ 36 แบบ ผลรวม ' + target + ' เกิด ' + fav + ' แบบ = ' + c, isBoss: true }; }
  var kinds = [
    function () { var t = 1 + rnd(6); var c = frac(1, 6); var o = opts(c, function () { return frac(1 + rnd(5), 6); }); return { topic: 'dice', difficulty: 'easy', text: 'ทอดลูกเต๋า 1 ลูก ความน่าจะเป็นที่จะได้แต้ม ' + t + ' เท่ากับเท่าใด', options: o.options, correctIndex: o.correctIndex, explanation: 'ลูกเต๋า 6 หน้า ได้แต้ม ' + t + ' คือ 1 ใน 6 = ' + c }; },
    function () { var even = Math.random() < .5; var c = frac(3, 6); var o = opts(c, function () { return frac(1 + rnd(5), 6); }); return { topic: 'dice', difficulty: 'easy', text: 'ทอดลูกเต๋า 1 ลูก ความน่าจะเป็นที่จะได้แต้ม' + (even ? 'คู่' : 'คี่') + 'เท่ากับเท่าใด', options: o.options, correctIndex: o.correctIndex, explanation: 'แต้ม' + (even ? 'คู่ (2,4,6)' : 'คี่ (1,3,5)') + ' 3 แบบ จาก 6 = ' + c }; },
    function () { var m = 4 + rnd(3); var fav = 7 - m; var c = frac(fav, 6); var o = opts(c, function () { return frac(1 + rnd(5), 6); }); return { topic: 'dice', difficulty: 'medium', text: 'ทอดลูกเต๋า 1 ลูก ความน่าจะเป็นที่จะได้แต้ม ≥ ' + m + ' เท่ากับเท่าใด', options: o.options, correctIndex: o.correctIndex, explanation: 'แต้ม ≥ ' + m + ' มี ' + fav + ' แบบ จาก 6 = ' + c }; }
  ];
  return Object.assign({ id: qid() }, pick(kinds)());
}
function genCoin(boss) {
  if (boss) { var c = frac(1, 8); var o = opts(c, function () { return pick(['1/4', '3/8', '1/2', '1/6']); }); return { id: qid(), topic: 'coin', difficulty: 'hard', text: 'โยนเหรียญ 3 เหรียญ ความน่าจะเป็นที่จะได้หัวทั้ง 3 เหรียญเท่ากับเท่าใด', options: o.options, correctIndex: o.correctIndex, explanation: 'ผลลัพธ์ 8 แบบ ได้หัวทั้ง 3 เหรียญ 1 แบบ = ' + c, isBoss: true }; }
  var kinds = [
    function () { var c = frac(1, 4); var o = opts(c, function () { return pick(['1/2', '2/4', '3/4', '1/8']); }); return { topic: 'coin', difficulty: 'easy', text: 'โยนเหรียญ 2 เหรียญ ความน่าจะเป็นที่จะได้หัวทั้ง 2 เหรียญเท่ากับเท่าใด', options: o.options, correctIndex: o.correctIndex, explanation: '{HH,HT,TH,TT} ได้หัวทั้งคู่ 1 แบบ = ' + c }; },
    function () { var c = frac(3, 4); var o = opts(c, function () { return pick(['1/4', '1/2', '2/4', '1/8']); }); return { topic: 'coin', difficulty: 'medium', text: 'โยนเหรียญ 2 เหรียญ ความน่าจะเป็นที่จะได้หัวอย่างน้อย 1 เหรียญเท่ากับเท่าใด', options: o.options, correctIndex: o.correctIndex, explanation: 'มีหัวอย่างน้อย 1 เหรียญ 3 แบบ จาก 4 = ' + c }; }
  ];
  return Object.assign({ id: qid() }, pick(kinds)());
}
function genCard(boss) {
  if (boss) { var c = frac(16, 52); var o = opts(c, function () { return pick(['1/4', '3/13', '13/52', '4/13']); }); return { id: qid(), topic: 'card', difficulty: 'hard', text: 'หยิบไพ่ 1 ใบจาก 52 ใบ ความน่าจะเป็นที่จะได้ไพ่หน้า (J,Q,K) หรือเอซเท่ากับเท่าใด', options: o.options, correctIndex: o.correctIndex, explanation: 'J,Q,K,A อย่างละ 4 รวม 16 ใบ จาก 52 = ' + c, isBoss: true }; }
  var kinds = [
    function () { var suit = pick(['โพดำ', 'โพแดง', 'ข้าวหลามตัด', 'ดอกจิก']); var c = frac(13, 52); var o = opts(c, function () { return pick(['1/4', '1/13', '4/52', '12/52']); }); return { topic: 'card', difficulty: 'easy', text: 'หยิบไพ่ 1 ใบจาก 52 ใบ ความน่าจะเป็นที่จะได้ไพ่ดอก' + suit + 'เท่ากับเท่าใด', options: o.options, correctIndex: o.correctIndex, explanation: 'ดอกละ 13 ใบ จาก 52 = ' + c }; },
    function () { var c = frac(4, 52); var o = opts(c, function () { return pick(['1/13', '1/4', '13/52', '1/52']); }); return { topic: 'card', difficulty: 'medium', text: 'หยิบไพ่ 1 ใบจาก 52 ใบ ความน่าจะเป็นที่จะได้ไพ่เอซเท่ากับเท่าใด', options: o.options, correctIndex: o.correctIndex, explanation: 'เอซ 4 ใบ จาก 52 = ' + c }; }
  ];
  return Object.assign({ id: qid() }, pick(kinds)());
}
function genBall(boss) {
  var red = 2 + rnd(4), blue = 2 + rnd(4);
  if (boss) { var green = 1 + rnd(3); var total = red + blue + green; var c = frac(red + green, total); var o = opts(c, function () { return frac(1 + rnd(total - 1), total); }); return { id: qid(), topic: 'ball', difficulty: 'hard', text: 'ในถุงมีแดง ' + red + ' น้ำเงิน ' + blue + ' เขียว ' + green + ' ลูก หยิบ 1 ลูก ความน่าจะเป็นที่จะไม่ได้สีน้ำเงินเท่ากับเท่าใด', options: o.options, correctIndex: o.correctIndex, explanation: 'ไม่ใช่น้ำเงิน = แดง+เขียว = ' + (red + green) + ' จาก ' + total + ' = ' + c, isBoss: true }; }
  var total = red + blue; var c = frac(red, total); var o = opts(c, function () { return frac(1 + rnd(total - 1), total); });
  return { id: qid(), topic: 'ball', difficulty: 'medium', text: 'ในถุงมีแดง ' + red + ' ลูก น้ำเงิน ' + blue + ' ลูก หยิบ 1 ลูก ความน่าจะเป็นที่จะได้สีแดงเท่ากับเท่าใด', options: o.options, correctIndex: o.correctIndex, explanation: 'รวม ' + total + ' ลูก แดง ' + red + ' ลูก = ' + c };
}
var GENS = { dice: genDice, coin: genCoin, card: genCard, ball: genBall };
function localSet(n, topics) { topics = topics && topics.length ? topics : ['dice', 'coin', 'card', 'ball']; var a = []; for (var i = 0; i < n; i++) a.push(GENS[pick(topics)](false)); return a; }
function localBoss() { return GENS[pick(['dice', 'coin', 'card', 'ball'])](true); }

/* ============ รูปแบบการเล่นแบบอื่น (ไม่ใช่แค่เลือกข้อ) ============ */
// แต่ละ builder ผูก topic ไว้เพื่อให้โหมดฝึกตามหัวข้อกรองได้ q.type: mc|fraction|truefalse|estimate|multiselect

// ----- FRACTION (เติมเศษส่วน) -----
function fracQ(topic, diff, text, ansNum, ansDen, expl) { return { id: qid(), type: 'fraction', topic: topic, difficulty: diff, text: text, ansNum: ansNum, ansDen: ansDen, explanation: expl }; }
var FRACTION_BUILDERS = [
  function () { var t = 1 + rnd(6); return fracQ('dice', 'easy', 'ทอดลูกเต๋า 1 ลูก ความน่าจะเป็นที่จะได้แต้ม ' + t + ' — พิมพ์เป็นเศษส่วน', 1, 6, 'ได้แต้ม ' + t + ' 1 แบบ จาก 6 = 1/6'); },
  function () { return fracQ('dice', 'medium', 'ทอดลูกเต๋า 1 ลูก ความน่าจะเป็นที่จะได้แต้มคู่ — พิมพ์เป็นเศษส่วน', 3, 6, 'แต้มคู่ 2,4,6 = 3/6 = 1/2'); },
  function () { return fracQ('coin', 'easy', 'โยนเหรียญ 2 เหรียญ ความน่าจะเป็นที่จะได้หัวทั้งคู่ — พิมพ์เป็นเศษส่วน', 1, 4, '{HH,HT,TH,TT} ได้ HH 1 แบบ = 1/4'); },
  function () { return fracQ('card', 'medium', 'หยิบไพ่ 1 ใบจาก 52 ใบ ความน่าจะเป็นที่จะได้ไพ่เอซ — พิมพ์เป็นเศษส่วน', 4, 52, 'เอซ 4 ใบ จาก 52 = 4/52 = 1/13'); },
  function () { var r = 2 + rnd(4), b = 2 + rnd(4); return fracQ('ball', 'medium', 'ในถุงมีแดง ' + r + ' น้ำเงิน ' + b + ' ลูก หยิบ 1 ลูก ความน่าจะเป็นที่จะได้สีแดง — พิมพ์เป็นเศษส่วน', r, r + b, 'แดง ' + r + ' จาก ' + (r + b) + ' = ' + frac(r, r + b)); }
];

// ----- TRUE/FALSE (จริง/เท็จ) -----
function tfQ(topic, diff, actualFrac, shownFrac, ctx) {
  var isTrue = actualFrac === shownFrac;
  return { id: qid(), type: 'truefalse', topic: topic, difficulty: diff, text: ctx + ' โอกาสเท่ากับ ' + shownFrac + ' — จริงหรือเท็จ?', isTrue: isTrue, explanation: 'ค่าที่ถูกต้องคือ ' + actualFrac };
}
var TF_BUILDERS = [
  function () { var shown = pick(['1/2', '1/3', '2/3']); return tfQ('dice', 'easy', '1/2', shown, 'ทอดลูกเต๋า 1 ลูก ได้แต้มคู่'); },
  function () { var shown = pick(['1/6', '1/3', '1/2']); return tfQ('dice', 'easy', '1/6', shown, 'ทอดลูกเต๋า 1 ลูก ได้แต้ม 5'); },
  function () { var shown = pick(['3/4', '1/2', '1/4']); return tfQ('coin', 'medium', '3/4', shown, 'โยนเหรียญ 2 เหรียญ ได้หัวอย่างน้อย 1 เหรียญ'); },
  function () { var shown = pick(['1/4', '1/13', '1/2']); return tfQ('card', 'medium', '1/4', shown, 'หยิบไพ่ 1 ใบ ได้ไพ่โพแดง'); }
];

// ----- ESTIMATE (ลากแถบประมาณค่า 0-100%) -----
function estQ(topic, diff, text, ansVal, tol, expl) { return { id: qid(), type: 'estimate', topic: topic, difficulty: diff, text: text, ansVal: ansVal, tol: tol || 0.1, explanation: expl }; }
var EST_BUILDERS = [
  function () { return estQ('dice', 'easy', 'ลากแถบให้ตรงกับความน่าจะเป็นที่จะได้แต้มคู่ เมื่อทอดลูกเต๋า 1 ลูก', 0.5, 0.1, 'แต้มคู่ = 3/6 = 0.5 (50%)'); },
  function () { return estQ('dice', 'medium', 'ลากแถบให้ตรงกับความน่าจะเป็นที่จะได้แต้ม ≥ 5 เมื่อทอดลูกเต๋า 1 ลูก', 2 / 6, 0.1, 'แต้ม 5,6 = 2/6 ≈ 0.33 (33%)'); },
  function () { return estQ('coin', 'medium', 'ลากแถบให้ตรงกับความน่าจะเป็นที่จะได้หัวอย่างน้อย 1 เหรียญ เมื่อโยน 2 เหรียญ', 0.75, 0.1, '3/4 = 0.75 (75%)'); },
  function () { return estQ('card', 'hard', 'ลากแถบให้ตรงกับความน่าจะเป็นที่จะได้ไพ่เอซ เมื่อหยิบ 1 ใบจาก 52 ใบ', 4 / 52, 0.07, '4/52 ≈ 0.077 (ประมาณ 8%)'); }
];

// ----- MULTISELECT (เลือกผลลัพธ์ที่เข้าเงื่อนไขทั้งหมด) -----
function multiQ(topic, diff, text, items, favSet, expl) {
  return { id: qid(), type: 'multiselect', topic: topic, difficulty: diff, text: text, items: items, favorable: favSet, explanation: expl };
}
var MULTI_BUILDERS = [
  function () { return multiQ('dice', 'easy', 'แตะเลือกแต้มลูกเต๋า "ทั้งหมด" ที่เป็นเลขคู่', ['1', '2', '3', '4', '5', '6'], [1, 3, 5], 'เลขคู่บนลูกเต๋าคือ 2, 4, 6'); },
  function () { return multiQ('dice', 'medium', 'แตะเลือกแต้มลูกเต๋า "ทั้งหมด" ที่หารด้วย 3 ลงตัว', ['1', '2', '3', '4', '5', '6'], [2, 5], 'หารด้วย 3 ลงตัวคือ 3 และ 6'); },
  function () { return multiQ('dice', 'medium', 'แตะเลือกแต้มลูกเต๋า "ทั้งหมด" ที่มากกว่า 4', ['1', '2', '3', '4', '5', '6'], [4, 5], 'มากกว่า 4 คือ 5 และ 6'); },
  function () { return multiQ('coin', 'medium', 'โยนเหรียญ 2 เหรียญ แตะเลือกผลลัพธ์ "ทั้งหมด" ที่มีหัว (H) อย่างน้อย 1 เหรียญ', ['HH', 'HT', 'TH', 'TT'], [0, 1, 2], 'มีหัวอย่างน้อย 1 คือ HH, HT, TH (ไม่นับ TT)'); }
];

var VARIED_ALL = []
  .concat(FRACTION_BUILDERS.map(function (f) { return { topic: null, fn: f }; }))
  .concat(TF_BUILDERS.map(function (f) { return { fn: f }; }))
  .concat(EST_BUILDERS.map(function (f) { return { fn: f }; }))
  .concat(MULTI_BUILDERS.map(function (f) { return { fn: f }; }));

function buildOneVaried(topics) {
  // สุ่มชนิด + หัวข้อ; ถ้าหัวข้อถูกจำกัด ให้กรอง
  var tries = 0;
  while (tries < 30) {
    tries++;
    var roll = rnd(5); // 0=mc, 1=fraction, 2=tf, 3=estimate, 4=multiselect (เพิ่มน้ำหนัก mc นิดหน่อย)
    var q;
    if (roll === 0) q = GENS[pick(topics)](false);
    else if (roll === 1) q = pick(FRACTION_BUILDERS)();
    else if (roll === 2) q = pick(TF_BUILDERS)();
    else if (roll === 3) q = pick(EST_BUILDERS)();
    else q = pick(MULTI_BUILDERS)();
    if (!topics || topics.length === 4 || topics.indexOf(q.topic) !== -1) return q;
  }
  return GENS[pick(topics)](false);
}
function localVariedSet(n, topics) {
  topics = topics && topics.length ? topics : ['dice', 'coin', 'card', 'ball'];
  var a = []; for (var i = 0; i < n; i++) a.push(buildOneVaried(topics)); return a;
}

// ----- grading + time by type -----
function gradeQ(q, resp) {
  var type = q.type || 'mc';
  if (type === 'mc') return resp === q.correctIndex;
  if (type === 'fraction') { if (!resp || !resp.den) return false; return q.ansNum * resp.den === q.ansDen * resp.num; }
  if (type === 'truefalse') return resp === q.isTrue;
  if (type === 'estimate') return Math.abs(resp - q.ansVal) <= (q.tol || 0.1);
  if (type === 'multiselect') { var a = (resp || []).slice().sort(function (x, y) { return x - y; }); var b = (q.favorable || []).slice().sort(function (x, y) { return x - y; }); if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  return false;
}
function timeForType(q) {
  var base = q.difficulty === 'hard' ? 12 : q.difficulty === 'medium' ? 15 : 18;
  var t = q.type || 'mc';
  if (t === 'truefalse') return Math.max(8, base - 4);
  if (t === 'fraction') return base + 4;
  if (t === 'estimate') return base + 3;
  if (t === 'multiselect') return base + 6;
  return base;
}


// ---------- Rank ----------
var RANKS = [{ n: 'บรอนซ์', m: 0, c: '#a8703f' }, { n: 'ซิลเวอร์', m: 300, c: '#8b96a5' }, { n: 'โกลด์', m: 800, c: '#c9971f' }, { n: 'แพลทินัม', m: 1600, c: '#3f9b8f' }, { n: 'ไดมอนด์', m: 3000, c: '#4f7fd6' }, { n: 'มาสเตอร์', m: 5000, c: '#8c4fd6' }];
function rankFor(xp) { var r = RANKS[0]; for (var i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].m) r = RANKS[i]; return r; }
function nextRank(xp) { for (var i = 0; i < RANKS.length; i++) if (RANKS[i].m > xp) return RANKS[i]; return null; }
function todayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

// ---------- tiny DOM helpers ----------
function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
var root = document.getElementById('root');

// ---------- App state ----------
var state = { name: '', xp: 0, dailyDate: '', dailyStreak: 0, online: API.configured };

function loadRemembered() { try { return localStorage.getItem('probgame-name') || ''; } catch (e) { return ''; } }
function saveRemembered(n) { try { localStorage.setItem('probgame-name', n); } catch (e) {} }

async function refreshProfile() {
  if (!state.name.trim()) { state.xp = 0; return; }
  if (API.configured) {
    try { var d = await API.getProfile(state.name.trim()); state.xp = d.profile.xp; state.dailyDate = d.profile.dailyLastDate; state.dailyStreak = d.profile.dailyStreak; state.online = true; return; }
    catch (e) { state.online = false; }
  }
  // offline: per-name local profile
  try { var v = JSON.parse(localStorage.getItem('probgame-xp-' + state.name.trim()) || '0'); state.xp = v; } catch (e) { state.xp = 0; }
}
async function awardXP(mode, score) {
  var gained = Math.round(score * 0.5);
  if (API.configured) {
    try { var d = await API.saveScore(state.name.trim(), mode, score); state.xp = d.xp; return { gained: d.xpGained, xp: d.xp }; }
    catch (e) { state.online = false; }
  }
  state.xp += gained;
  try { localStorage.setItem('probgame-xp-' + state.name.trim(), JSON.stringify(state.xp)); } catch (e) {}
  return { gained: gained, xp: state.xp };
}

// ================= Screens =================
function screenHome() {
  var s = el('div', 'screen home');

  // header bar (full width)
  var hdr = el('div', 'app-header');
  var brand = el('div', 'brand');
  brand.appendChild(el('div', 'brand-badge', 'P'));
  var bt = el('div'); bt.appendChild(el('h1', null, 'เกมความน่าจะเป็น')); bt.appendChild(el('p', 'sub', 'ฝึกความน่าจะเป็น ม.3 แบบสนุก ท้าทาย')); brand.appendChild(bt);
  hdr.appendChild(brand);
  var hdrRight = el('div', 'header-right');
  hdrRight.appendChild(el('span', 'status-pill ' + (state.online ? 'online' : 'offline'), state.online ? '● ออนไลน์' : '○ ออฟไลน์'));
  var adminLink = el('button', 'admin-link', '⚙ สำหรับครู'); adminLink.addEventListener('click', function () { adminGate(); }); hdrRight.appendChild(adminLink);
  hdr.appendChild(hdrRight);
  s.appendChild(hdr);

  var layout = el('div', 'home-layout');

  // ----- side: identity -----
  var side = el('div', 'home-side');
  var r = rankFor(state.xp), nx = nextRank(state.xp);
  var rc = el('div', 'card rank-card'); rc.style.borderColor = r.c;
  var rr = el('div', 'rank-row'); var rb = el('span', 'rank-badge', r.n); rb.style.background = r.c; rr.appendChild(rb); rr.appendChild(el('span', 'xp-text', state.xp + ' XP')); rc.appendChild(rr);
  if (nx) { var pt = el('div', 'progress-track'); var pf = el('div', 'progress-fill'); pf.style.width = Math.min(100, ((state.xp - r.m) / (nx.m - r.m)) * 100) + '%'; pf.style.background = r.c; pt.appendChild(pf); rc.appendChild(pt); rc.appendChild(el('p', 'hint', 'อีก ' + (nx.m - state.xp) + ' XP ถึงระดับ ' + nx.n)); }
  else rc.appendChild(el('p', 'hint', 'ระดับสูงสุดแล้ว!'));
  side.appendChild(rc);

  var nameCard = el('div', 'card');
  nameCard.appendChild(el('label', 'field-label', 'ชื่อผู้เล่น (ผูก Rank/XP กับชื่อนี้)'));
  var inp = el('input', 'text-input'); inp.value = state.name; inp.placeholder = 'เช่น ปอนด์-ม.3/2'; inp.maxLength = 20;
  inp.addEventListener('input', function () { state.name = inp.value; });
  inp.addEventListener('blur', async function () { saveRemembered(state.name); await refreshProfile(); render(screenHome); });
  nameCard.appendChild(inp);
  nameCard.appendChild(el('p', 'hint', 'พิมพ์ชื่อเดิมกลับมา Rank/XP เดิมกลับมาด้วย — ใช้ชื่อไม่ซ้ำกับเพื่อน'));
  if (!state.name.trim()) nameCard.appendChild(el('p', 'warn-text', 'ใส่ชื่อก่อนถึงจะเริ่มเล่นได้'));
  side.appendChild(nameCard);

  var lbBtn = el('button', 'btn-primary board-btn', '🏆 ดูสกอร์บอร์ด'); lbBtn.addEventListener('click', function () { leaderboard('all'); }); side.appendChild(lbBtn);
  layout.appendChild(side);

  // ----- main: modes -----
  var main = el('div', 'home-main');
  main.appendChild(el('h2', 'section-title', 'เลือกโหมดการเล่น'));
  var isDaily = state.dailyDate === todayKey();
  var modes = [
    { icon: '⚡', t: 'Quick Quiz', d: '10 ข้อ จับเวลา ตอบเร็วได้โบนัส หลายรูปแบบคำถาม', go: function () { startQuiz('quick', null, function () { return getPool(10, 'mixed'); }, difTime); } },
    { icon: '❤️', t: 'Survival', d: 'มี 3 หัวใจ เล่นจนหมดหัวใจ', go: function () { startQuiz('survival', 3, function () { return getPool(60, 'mixed'); }, difTime); } },
    { icon: '⚔️', t: 'Boss Battle', d: 'ผ่าน 5 ด่าน เจอบอสทุกด่าน', go: startBoss },
    { icon: '🤺', t: 'PvP Duel', d: 'ผลัดกันตอบ 2 คน หลอดเลือดใครหมดก่อนแพ้', go: pvpSetup },
    { icon: '📅', t: 'Daily Challenge', d: isDaily ? ('เล่นแล้ววันนี้ · สตรีค ' + state.dailyStreak + ' วัน') : 'ชุดพิเศษวันนี้ เล่น 1 ครั้ง', go: startDaily, disabled: isDaily },
    { icon: '📘', t: 'Practice by Topic', d: 'เลือกหัวข้อฝึก ไม่จับเวลา ไม่เสียหัวใจ', go: practiceSetup }
  ];
  var grid = el('div', 'mode-grid');
  modes.forEach(function (m) {
    var b = el('button', 'mode-card'); b.disabled = !state.name.trim() || m.disabled;
    b.appendChild(el('span', 'mode-icon', m.icon)); b.appendChild(el('span', 'mode-title', m.t)); b.appendChild(el('span', 'mode-desc', m.d));
    b.addEventListener('click', m.go); grid.appendChild(b);
  });
  main.appendChild(grid);
  main.appendChild(el('p', 'formats-note', 'แต่ละโหมดมีคำถามหลายรูปแบบ: เลือกข้อ · เติมเศษส่วน · จริง/เท็จ · ลากแถบประมาณค่า · เลือกผลลัพธ์หลายข้อ'));
  layout.appendChild(main);

  s.appendChild(layout);
  return s;
}

function difTime(q) { return timeForType(q); }

async function getPool(n, topic) {
  var out = localVariedSet(n, topic === 'mixed' ? null : [topic]);
  if (API.configured) {
    try {
      var want = Math.max(2, Math.round(n * 0.3));
      var d = await API.getQuestions(want, topic);
      if (d.questions && d.questions.length) {
        var bank = d.questions.map(function (q) { q.type = 'mc'; return q; });
        for (var i = 0; i < bank.length && i < out.length; i++) out[i] = bank[i];
        out = shuffle(out);
      }
    } catch (e) {}
  }
  return out;
}

// ---------- Generic quiz runner ----------
async function startQuiz(mode, hpStart, poolFn, timeFn, manual) {
  renderLoading();
  var questions = await poolFn();
  runQuiz({ mode: mode, hpStart: hpStart, questions: questions, timeFn: timeFn, manual: manual });
}

function runQuiz(cfg) {
  var idx = 0, hp = cfg.hpStart || 0, combo = 0, score = 0, correct = 0;
  var answered = null, wasCorrect = false, draft = null; // draft = staged response before submit
  var timer = null, timeLeft = 0, finished = false;
  var s = el('div', 'screen playing');
  root.replaceChildren(s);

  function clearT() { if (timer) { clearInterval(timer); timer = null; } }
  function stop(cleared) { if (finished) return; finished = true; clearT(); onQuizDone(cfg.mode, score, correct, idx + (answered !== null ? 1 : 0), cleared); }
  function maxTimeOf(q) { return cfg.timeFn ? cfg.timeFn(q) : null; }

  function draw() {
    clear(s);
    var q = cfg.questions[idx];
    var top = el('div', 'hud');
    var back = el('button', 'back-link', '← กลับ'); back.addEventListener('click', function () { clearT(); render(screenHome); }); top.appendChild(back);
    top.appendChild(el('div', 'hud-score', (cfg.label || cfg.mode) + ' · ' + score + ' คะแนน')); s.appendChild(top);

    var row2 = el('div', 'hud');
    if (cfg.hpStart) { var hb = el('div', 'hud-hearts'); for (var i = 0; i < cfg.hpStart; i++) hb.appendChild(el('span', 'heart ' + (i < hp ? 'full' : 'empty'), '♥')); row2.appendChild(hb); }
    else row2.appendChild(el('span', 'hint', 'ข้อ ' + (idx + 1) + ' / ' + cfg.questions.length));
    row2.appendChild(el('div', 'hud-combo', combo > 1 ? '🔥 x' + combo : '')); s.appendChild(row2);

    var maxT = maxTimeOf(q);
    if (maxT) { var tt = el('div', 'timer-track'); var tf = el('div', 'timer-fill' + (timeLeft <= 4 ? ' low' : '')); tf.style.width = (timeLeft / maxT) * 100 + '%'; tt.appendChild(tf); s.appendChild(tt); }

    var typeLabel = { fraction: 'เติมเศษส่วน', truefalse: 'จริง/เท็จ', estimate: 'ประมาณค่า', multiselect: 'เลือกหลายข้อ' }[q.type];
    var qc2 = el('div', 'card question-card diff-' + q.difficulty);
    var tagWrap = el('div', 'q-tags');
    tagWrap.appendChild(el('span', 'diff-tag', q.difficulty === 'easy' ? 'ง่าย' : q.difficulty === 'medium' ? 'ปานกลาง' : 'ยาก'));
    if (typeLabel) tagWrap.appendChild(el('span', 'type-tag', typeLabel));
    qc2.appendChild(tagWrap);
    qc2.appendChild(el('p', 'question-text', q.text)); s.appendChild(qc2);

    renderBody(q);

    if (answered !== null) {
      var fb = el('div', 'feedback-banner ' + (wasCorrect ? 'correct' : 'wrong'), wasCorrect ? 'ถูกต้อง! +' + lastGain + ' คะแนน' : 'ยังไม่ถูก — ' + q.explanation);
      s.appendChild(fb);
      if (cfg.manual) { var nb = el('button', 'btn-primary', idx + 1 >= cfg.questions.length ? 'จบการฝึก' : 'ข้อถัดไป →'); nb.addEventListener('click', function () { idx + 1 >= cfg.questions.length ? stop(true) : next(); }); s.appendChild(nb); }
    }
  }

  var lastGain = 0;

  function renderBody(q) {
    var type = q.type || 'mc';
    var locked = answered !== null;
    if (type === 'mc') {
      var og = el('div', 'options-grid');
      q.options.forEach(function (opt, i) {
        var b = el('button', 'option-btn', opt);
        if (locked) { if (i === q.correctIndex) b.className += ' correct'; else if (answered === i) b.className += ' wrong'; b.disabled = true; }
        else b.addEventListener('click', function () { submit(i); });
        og.appendChild(b);
      });
      s.appendChild(og);
    } else if (type === 'truefalse') {
      var tf = el('div', 'tf-grid');
      [['จริง', true], ['เท็จ', false]].forEach(function (o) {
        var b = el('button', 'tf-btn ' + (o[1] ? 'yes' : 'no'), o[0]);
        if (locked) { if (o[1] === q.isTrue) b.className += ' correct'; else if (answered === o[1]) b.className += ' wrong'; b.disabled = true; }
        else b.addEventListener('click', function () { submit(o[1]); });
        tf.appendChild(b);
      });
      s.appendChild(tf);
    } else if (type === 'fraction') {
      var box = el('div', 'card frac-card');
      var fr = el('div', 'frac-input');
      var top = el('input', 'frac-field'); top.type = 'number'; top.placeholder = 'เศษ'; top.inputMode = 'numeric';
      var bar = el('div', 'frac-bar');
      var bot = el('input', 'frac-field'); bot.type = 'number'; bot.placeholder = 'ส่วน'; bot.inputMode = 'numeric';
      fr.appendChild(top); fr.appendChild(bar); fr.appendChild(bot); box.appendChild(fr);
      if (locked) { top.value = draft ? draft.num : ''; bot.value = draft ? draft.den : ''; top.disabled = bot.disabled = true; box.appendChild(el('p', 'hint', 'เฉลย: ' + frac(q.ansNum, q.ansDen))); }
      else { var sb = el('button', 'btn-primary submit-btn', 'ส่งคำตอบ'); sb.addEventListener('click', function () { submit({ num: parseInt(top.value, 10), den: parseInt(bot.value, 10) }); }); box.appendChild(sb); }
      s.appendChild(box);
    } else if (type === 'estimate') {
      var ebox = el('div', 'card est-card');
      var pct = el('div', 'est-value', (draft != null ? Math.round(draft * 100) : 50) + '%');
      ebox.appendChild(pct);
      var sl = el('input', 'est-slider'); sl.type = 'range'; sl.min = '0'; sl.max = '100'; sl.value = (draft != null ? Math.round(draft * 100) : 50);
      sl.addEventListener('input', function () { pct.textContent = sl.value + '%'; });
      if (locked) { sl.value = Math.round((draft || 0) * 100); sl.disabled = true; pct.textContent = sl.value + '%'; }
      ebox.appendChild(sl);
      var scale = el('div', 'est-scale'); scale.appendChild(el('span', null, '0% ไม่เกิด')); scale.appendChild(el('span', null, '50%')); scale.appendChild(el('span', null, '100% เกิดแน่')); ebox.appendChild(scale);
      if (locked) { ebox.appendChild(el('p', 'hint', 'ค่าที่ถูก ≈ ' + Math.round(q.ansVal * 100) + '% · ' + q.explanation)); }
      else { var esb = el('button', 'btn-primary submit-btn', 'ส่งคำตอบ'); esb.addEventListener('click', function () { submit(parseInt(sl.value, 10) / 100); }); ebox.appendChild(esb); }
      s.appendChild(ebox);
    } else if (type === 'multiselect') {
      var sel = draft && draft.slice ? draft.slice() : [];
      var grid = el('div', 'multi-grid');
      q.items.forEach(function (label, i) {
        var b = el('button', 'multi-chip', label);
        var isSel = sel.indexOf(i) !== -1;
        if (isSel) b.className += ' on';
        if (locked) {
          var fav = q.favorable.indexOf(i) !== -1;
          if (fav) b.className += ' correct'; else if (isSel) b.className += ' wrong';
          b.disabled = true;
        } else {
          b.addEventListener('click', function () { var p = sel.indexOf(i); if (p === -1) sel.push(i); else sel.splice(p, 1); draft = sel.slice(); draw(); });
        }
        grid.appendChild(b);
      });
      s.appendChild(grid);
      if (!locked) { var msb = el('button', 'btn-primary submit-btn', 'ส่งคำตอบ (' + sel.length + ' ข้อ)'); msb.addEventListener('click', function () { submit(sel.slice()); }); s.appendChild(msb); }
    }
  }

  function scoreGain(q, maxT) {
    var base = q.difficulty === 'hard' ? 30 : q.difficulty === 'medium' ? 20 : 10;
    var sb = maxT ? Math.round((timeLeft / maxT) * 10) : 0;
    var mult = 1 + Math.min(combo, 5) * 0.2; // combo already incremented
    return Math.round((base + sb) * mult);
  }

  function submit(resp) {
    if (answered !== null) return; clearT();
    var q = cfg.questions[idx]; answered = resp; if (q.type === 'fraction') draft = resp; if (q.type === 'estimate') draft = resp; if (q.type === 'multiselect') draft = resp;
    var ok = gradeQ(q, resp); wasCorrect = ok;
    var maxT = maxTimeOf(q);
    if (ok) { correct++; combo++; lastGain = scoreGain(q, maxT); score += lastGain; draw(); if (!cfg.manual) setTimeout(next, 950); }
    else {
      combo = 0;
      if (cfg.hpStart) { hp--; draw(); if (hp <= 0) { setTimeout(function () { stop(false); }, 1200); return; } if (!cfg.manual) setTimeout(next, 1200); }
      else { draw(); if (!cfg.manual) setTimeout(next, 1200); }
    }
  }

  function startTimer() {
    var q = cfg.questions[idx]; if (!cfg.timeFn) return; var maxT = cfg.timeFn(q); timeLeft = maxT;
    clearT(); timer = setInterval(function () { timeLeft--; if (timeLeft <= 0) { clearT(); onTimeout(); } else { var tf = s.querySelector('.timer-fill'); if (tf) { tf.style.width = (timeLeft / maxT) * 100 + '%'; if (timeLeft <= 4) tf.className = 'timer-fill low'; } } }, 1000);
  }
  function next() { idx++; if (idx >= cfg.questions.length) { stop(true); return; } answered = null; draft = null; wasCorrect = false; draw(); startTimer(); }
  function onTimeout() {
    if (answered !== null) return;
    combo = 0; answered = '__timeout__'; wasCorrect = false;
    if (cfg.hpStart) { hp--; draw(); if (hp <= 0) { setTimeout(function () { stop(false); }, 950); return; } setTimeout(next, 950); }
    else { draw(); setTimeout(next, 950); }
  }

  cfg.label = ({ quick: 'Quick Quiz', survival: 'Survival', daily: 'Daily', practice: 'Practice' })[cfg.mode] || cfg.mode;
  draw(); startTimer();
}

async function onQuizDone(mode, score, correct, total, cleared) {
  if (mode === 'practice') { showResult('practice', 0, 0, 'ฝึกจบแล้ว — ตอบถูก ' + correct + '/' + total + ' ข้อ'); return; }
  if (mode === 'daily') {
    var dk = todayKey();
    if (API.configured) { try { var d = await API.saveDaily(state.name.trim(), dk); state.dailyDate = dk; state.dailyStreak = d.dailyStreak; } catch (e) {} }
    else { state.dailyStreak = state.dailyDate ? state.dailyStreak + 1 : 1; state.dailyDate = dk; }
    var res = await awardXP('daily', score); showResult('daily', score, res.gained, 'สตรีค ' + state.dailyStreak + ' วัน · ถูก ' + correct + '/' + total); return;
  }
  var r = await awardXP(mode, score); showResult(mode, score, r.gained, 'ตอบถูก ' + correct + '/' + total + ' ข้อ');
}

// ---------- Boss ----------
async function startBoss() {
  renderLoading();
  var STAGES = 5, PER = 2, hp = 3, stage = 1, step = 0, score = 0, selected = null, timer = null, timeLeft = 0, finished = false, current = null, flash = false;
  var s = el('div', 'screen playing'); root.replaceChildren(s);
  function clearT() { if (timer) { clearInterval(timer); timer = null; } }
  function stop(cleared) { if (finished) return; finished = true; clearT(); showResult('boss', score, Math.round(score * 0.5), cleared ? 'ผ่านทุกด่านแล้ว!' : 'ไปถึงด่าน ' + stage, true); }
  async function loadStep() {
    selected = null; flash = false; var isBoss = step >= PER;
    current = isBoss ? localBoss() : (await getPool(1, 'mixed'))[0];
    timeLeft = isBoss ? 18 : 14; draw(); startTimer();
  }
  function startTimer() { clearT(); var maxT = current.isBoss ? 18 : 14; timer = setInterval(function () { timeLeft--; if (timeLeft <= 0) { clearT(); onTimeout(); } else { var tf = s.querySelector('.timer-fill'); if (tf) tf.style.width = (timeLeft / maxT) * 100 + '%'; } }, 1000); }
  function goNext() { if (step + 1 > PER) { if (stage + 1 > STAGES) { stop(true); return; } stage++; step = 0; loadStep(); } else { step++; loadStep(); } }
  function onTimeout() { selected = -1; draw(); hp--; if (hp <= 0) setTimeout(function () { stop(false); }, 900); else setTimeout(goNext, 900); }
  function answer(i) {
    if (selected !== null) return; clearT(); selected = i; var ok = i === current.correctIndex; var isBoss = current.isBoss;
    if (ok) { var base = isBoss ? 60 : current.difficulty === 'hard' ? 30 : current.difficulty === 'medium' ? 20 : 10; score += base + Math.round((timeLeft / (isBoss ? 18 : 14)) * 10); if (isBoss) flash = true; draw(); setTimeout(goNext, 900); }
    else { hp--; draw(); if (hp <= 0) { setTimeout(function () { stop(false); }, 1100); return; } setTimeout(loadStep, 1100); }
  }
  function draw() {
    clear(s);
    var top = el('div', 'hud'); var back = el('button', 'back-link', '← กลับ'); back.addEventListener('click', function () { clearT(); render(screenHome); }); top.appendChild(back); top.appendChild(el('div', 'hud-score', 'ด่าน ' + stage + '/' + STAGES + ' · ' + score + ' คะแนน')); s.appendChild(top);
    var row2 = el('div', 'hud'); var hb = el('div', 'hud-hearts'); for (var i = 0; i < 3; i++) hb.appendChild(el('span', 'heart ' + (i < hp ? 'full' : 'empty'), '♥')); row2.appendChild(hb); row2.appendChild(el('span', 'hint', current.isBoss ? '⚔️ ด่านบอส' : 'ข้อที่ ' + (step + 1) + '/' + PER)); s.appendChild(row2);
    var maxT = current.isBoss ? 18 : 14; var tt = el('div', 'timer-track'); var tf = el('div', 'timer-fill' + (timeLeft <= 4 ? ' low' : '')); tf.style.width = (timeLeft / maxT) * 100 + '%'; tt.appendChild(tf); s.appendChild(tt);
    if (current.isBoss) { var bb = el('div', 'boss-banner' + (flash ? ' hit' : '')); bb.appendChild(el('span', null, 'บอสด่าน ' + stage)); var bh = el('div', 'boss-hp-track'); var bf = el('div', 'boss-hp-fill'); bf.style.width = flash ? '0%' : '100%'; bh.appendChild(bf); bb.appendChild(bh); s.appendChild(bb); }
    var qc2 = el('div', 'card question-card diff-' + current.difficulty + (current.isBoss ? ' boss-card' : '')); qc2.appendChild(el('span', 'diff-tag', current.isBoss ? 'บอส' : current.difficulty === 'easy' ? 'ง่าย' : current.difficulty === 'medium' ? 'ปานกลาง' : 'ยาก')); qc2.appendChild(el('p', 'question-text', current.text)); s.appendChild(qc2);
    var og = el('div', 'options-grid'); current.options.forEach(function (opt, i) { var b = el('button', 'option-btn', opt); if (selected !== null) { if (i === current.correctIndex) b.className += ' correct'; else if (i === selected) b.className += ' wrong'; b.disabled = true; } b.addEventListener('click', function () { answer(i); }); og.appendChild(b); }); s.appendChild(og);
    if (selected !== null) s.appendChild(el('div', 'feedback-banner ' + (selected === current.correctIndex ? 'correct' : 'wrong'), selected === current.correctIndex ? (current.isBoss ? 'โจมตีบอสสำเร็จ!' : 'ถูกต้อง!') : 'ผิด — ' + current.explanation));
  }
  loadStep();
}

// ---------- PvP ----------
function pvpSetup() {
  var s = el('div', 'screen home'); s.appendChild(el('h1', null, 'PvP Duel')); s.appendChild(el('p', 'sub-note', 'ผลัดกันเล่นเครื่องเดียวกัน โจทย์ชุดเดียวกันทั้งคู่'));
  var n1 = '', n2 = '';
  var c1 = el('div', 'card'); c1.appendChild(el('label', 'field-label', 'ชื่อผู้เล่น 1')); var i1 = el('input', 'text-input'); i1.placeholder = 'ผู้เล่น 1'; i1.maxLength = 16; i1.addEventListener('input', function () { n1 = i1.value; go.disabled = !n1.trim() || !n2.trim(); }); c1.appendChild(i1); s.appendChild(c1);
  var c2 = el('div', 'card'); c2.appendChild(el('label', 'field-label', 'ชื่อผู้เล่น 2')); var i2 = el('input', 'text-input'); i2.placeholder = 'ผู้เล่น 2'; i2.maxLength = 16; i2.addEventListener('input', function () { n2 = i2.value; go.disabled = !n1.trim() || !n2.trim(); }); c2.appendChild(i2); s.appendChild(c2);
  var go = el('button', 'btn-primary', 'เริ่มดวล'); go.disabled = true; go.addEventListener('click', function () { startPvp(n1.trim() || 'ผู้เล่น 1', n2.trim() || 'ผู้เล่น 2'); }); s.appendChild(go);
  var bk = el('button', 'btn-secondary', 'กลับหน้าแรก'); bk.addEventListener('click', function () { render(screenHome); }); s.appendChild(bk);
  root.replaceChildren(s);
}
async function startPvp(name1, name2) {
  renderLoading();
  var HP = 5, TPQ = 12, pool = await getPool(15, 'mixed');
  var round = 0, turn = 1, hp1 = HP, hp2 = HP, selected = null, timer = null, timeLeft = 0, p1res = null, banner = null, finished = false;
  var s = el('div', 'screen playing'); root.replaceChildren(s);
  function clearT() { if (timer) { clearInterval(timer); timer = null; } }
  function stop(winner) { if (finished) return; finished = true; clearT(); showResult('pvp', 0, 0, winner === 'draw' ? 'เสมอกัน!' : winner + ' ชนะ!'); }
  function startTurn() { selected = null; timeLeft = TPQ; clearT(); timer = setInterval(function () { timeLeft--; if (timeLeft <= 0) { clearT(); onTimeout(); } else { var tf = s.querySelector('.timer-fill'); if (tf) tf.style.width = (timeLeft / TPQ) * 100 + '%'; } }, 1000); draw(); }
  function onTimeout() { if (turn === 1) { p1res = { c: false, t: 0 }; turn = 2; startTurn(); } else resolve(p1res || { c: false, t: 0 }, { c: false, t: 0 }); }
  function answer(i) {
    if (selected !== null) return; clearT(); selected = i; var ok = i === pool[round].correctIndex;
    if (turn === 1) { p1res = { c: ok, t: timeLeft }; draw(); setTimeout(function () { turn = 2; startTurn(); }, 500); }
    else { draw(); var p1 = p1res || { c: false, t: 0 }; setTimeout(function () { resolve(p1, { c: ok, t: timeLeft }); }, 500); }
  }
  function resolve(p1, p2) {
    var d2 = 0, d1 = 0; if (p1.c) d2++; if (p2.c) d1++; if (p1.c && p2.c) { if (p1.t > p2.t) d2++; else if (p2.t > p1.t) d1++; }
    hp2 = Math.max(0, hp2 - d2); hp1 = Math.max(0, hp1 - d1);
    banner = ''; if (d2) banner += name1 + ' โจมตี ' + name2 + ' -' + d2 + ' HP  '; if (d1) banner += name2 + ' โจมตี ' + name1 + ' -' + d1 + ' HP'; if (!banner) banner = 'ทั้งคู่ตอบผิด ไม่มีใครเสีย HP';
    draw();
    setTimeout(function () {
      if (hp1 <= 0 && hp2 <= 0) return stop('draw'); if (hp2 <= 0) return stop(name1); if (hp1 <= 0) return stop(name2);
      round++; if (round >= pool.length) return stop('draw'); turn = 1; banner = null; startTurn();
    }, 1400);
  }
  function draw() {
    clear(s);
    var top = el('div', 'hud'); var back = el('button', 'back-link', '← กลับ'); back.addEventListener('click', function () { clearT(); render(screenHome); }); top.appendChild(back); top.appendChild(el('div', 'hud-score', 'รอบที่ ' + (round + 1))); s.appendChild(top);
    var hpRow = el('div', 'pvp-hp-row');
    [[name1, hp1], [null, null], [name2, hp2]].forEach(function (x) { if (x[0] === null) { hpRow.appendChild(el('span', 'pvp-vs', 'VS')); return; } var side = el('div', 'pvp-side'); side.appendChild(el('span', 'pvp-name', x[0])); var tk = el('div', 'pvp-hp-track'); var tf = el('div', 'pvp-hp-fill'); tf.style.width = (x[1] / HP) * 100 + '%'; tk.appendChild(tf); side.appendChild(tk); hpRow.appendChild(side); });
    s.appendChild(hpRow);
    if (banner) { s.appendChild(el('div', 'feedback-banner correct', banner)); return; }
    var active = turn === 1 ? name1 : name2;
    var tag = el('div', 'turn-tag'); tag.textContent = 'ตาของ ' + active; if (turn === 2) tag.appendChild(el('span', 'hint', ' — ' + name1 + ' ตอบไปแล้ว')); s.appendChild(tag);
    var tt = el('div', 'timer-track'); var tf2 = el('div', 'timer-fill' + (timeLeft <= 4 ? ' low' : '')); tf2.style.width = (timeLeft / TPQ) * 100 + '%'; tt.appendChild(tf2); s.appendChild(tt);
    var q = pool[round]; var qc2 = el('div', 'card question-card diff-' + q.difficulty); qc2.appendChild(el('span', 'diff-tag', q.difficulty === 'easy' ? 'ง่าย' : q.difficulty === 'medium' ? 'ปานกลาง' : 'ยาก')); qc2.appendChild(el('p', 'question-text', q.text)); s.appendChild(qc2);
    var og = el('div', 'options-grid'); q.options.forEach(function (opt, i) { var b = el('button', 'option-btn', opt); if (selected !== null && i === selected) b.className += selected === q.correctIndex ? ' correct' : ' wrong'; if (selected !== null) b.disabled = true; b.addEventListener('click', function () { answer(i); }); og.appendChild(b); }); s.appendChild(og);
  }
  startTurn();
}

// ---------- Daily / Practice ----------
async function startDaily() { if (state.dailyDate === todayKey()) return; startQuiz('daily', null, function () { return getPool(10, 'mixed'); }, difTime); }
function practiceSetup() {
  var sel = 'mixed';
  var s = el('div', 'screen home'); s.appendChild(el('h1', null, 'ฝึกตามหัวข้อ')); s.appendChild(el('p', 'sub-note', 'ไม่จับเวลา ไม่เสียหัวใจ เหมาะทบทวนก่อนสอบ'));
  var grid = el('div', 'mode-grid');
  [['mixed', 'คละหัวข้อ'], ['dice', 'ลูกเต๋า'], ['coin', 'เหรียญ'], ['card', 'ไพ่'], ['ball', 'ลูกบอลในถุง']].forEach(function (t) {
    var b = el('button', 'mode-card small' + (sel === t[0] ? ' selected' : '')); b.appendChild(el('span', 'mode-title', t[1]));
    b.addEventListener('click', function () { sel = t[0]; Array.prototype.forEach.call(grid.children, function (c) { c.className = 'mode-card small'; }); b.className = 'mode-card small selected'; });
    grid.appendChild(b);
  });
  s.appendChild(grid);
  var go = el('button', 'btn-primary', 'เริ่มฝึก'); go.addEventListener('click', function () { startQuiz('practice', null, function () { return getPool(25, sel); }, function () { return null; }, true); }); s.appendChild(go);
  var bk = el('button', 'btn-secondary', 'กลับหน้าแรก'); bk.addEventListener('click', function () { render(screenHome); }); s.appendChild(bk);
  root.replaceChildren(s);
}

// ---------- Result / Leaderboard ----------
function showResult(mode, score, gained, extra, isBoss) {
  var r = rankFor(state.xp);
  var s = el('div', 'screen home'); s.appendChild(el('h1', null, 'จบเกม'));
  var rc = el('div', 'card result-card');
  function rr(label, val, color) { var d = el('div', 'result-row'); d.appendChild(el('span', null, label)); var st = el('strong', null, val); if (color) st.style.color = color; d.appendChild(st); rc.appendChild(d); }
  if (mode !== 'pvp') rr('คะแนนที่ได้', String(score));
  if (extra) rr('ผลลัพธ์', extra);
  if (gained > 0) rr('XP ที่ได้รับ', '+' + gained);
  if (mode !== 'pvp') rr('ระดับปัจจุบัน', r.n, r.c);
  s.appendChild(rc);
  var again = el('button', 'btn-primary', 'กลับหน้าแรก'); again.addEventListener('click', function () { render(screenHome); }); s.appendChild(again);
  var lb = el('button', 'btn-secondary', '🏆 ดูกระดานคะแนน'); lb.addEventListener('click', function () { leaderboard('all'); }); s.appendChild(lb);
  root.replaceChildren(s);
}

// avatar color from name (stable hash -> hue)
function avatarColor(name) { var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return 'hsl(' + h + ',55%,45%)'; }
function initial(name) { name = (name || '?').trim(); return name ? name.charAt(0).toUpperCase() : '?'; }
function rankColorOf(rankName) { for (var i = 0; i < RANKS.length; i++) if (RANKS[i].n === rankName) return RANKS[i].c; return '#8a8175'; }
function relTime(ts) {
  if (!ts) return ''; var t = new Date(ts).getTime(); if (isNaN(t)) return '';
  var diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 60) return 'เมื่อสักครู่';
  if (diff < 3600) return Math.floor(diff / 60) + ' นาทีที่แล้ว';
  if (diff < 86400) return Math.floor(diff / 3600) + ' ชม.ที่แล้ว';
  if (diff < 604800) return Math.floor(diff / 86400) + ' วันที่แล้ว';
  return new Date(ts).toLocaleDateString('th-TH');
}

function sbRow(e, pos, mode, isMe) {
  var r = el('div', 'sb-row' + (isMe ? ' me' : '')); r.style.animationDelay = (Math.min(pos, 12) * 30) + 'ms';
  r.appendChild(el('span', 'sb-pos', String(pos + 1)));
  var av = el('span', 'sb-avatar', initial(e.name)); av.style.background = avatarColor(e.name); r.appendChild(av);
  var mid = el('div', 'sb-mid');
  var nl = el('div', 'sb-name-line');
  nl.appendChild(el('span', 'sb-name', e.name));
  if (isMe) nl.appendChild(el('span', 'sb-me-tag', 'คุณ'));
  var chip = el('span', 'sb-rankchip', e.rank); chip.style.background = rankColorOf(e.rank); nl.appendChild(chip);
  mid.appendChild(nl);
  var sub = el('div', 'sb-sub');
  sub.appendChild(el('span', null, '🎮 เล่น ' + (e.gamesPlayed || 0) + ' เกม'));
  if (mode === 'all') { if (e.bestScore) sub.appendChild(el('span', null, '⭐ ดีสุด ' + e.bestScore)); }
  else { sub.appendChild(el('span', null, '✨ XP รวม ' + e.xp)); }
  if (e.lastPlayed) sub.appendChild(el('span', null, '🕐 ' + relTime(e.lastPlayed)));
  mid.appendChild(sub);
  r.appendChild(mid);
  var val = el('div', 'sb-value');
  if (mode === 'all') { val.appendChild(el('span', 'sb-value-num', String(e.xp))); val.appendChild(el('span', 'sb-value-label', 'XP')); }
  else { val.appendChild(el('span', 'sb-value-num', String(e.bestScore))); val.appendChild(el('span', 'sb-value-label', 'คะแนน')); }
  r.appendChild(val);
  return r;
}

function podium(top3, mode) {
  // visual order: 2nd, 1st, 3rd
  var order = [{ e: top3[1], pos: 1, cls: 'p2', medal: '🥈' }, { e: top3[0], pos: 0, cls: 'p1', medal: '🥇' }, { e: top3[2], pos: 2, cls: 'p3', medal: '🥉' }];
  var wrap = el('div', 'podium');
  order.forEach(function (o) {
    var slot = el('div', 'podium-slot ' + o.cls);
    if (!o.e) { slot.style.visibility = 'hidden'; wrap.appendChild(slot); return; }
    slot.appendChild(el('span', 'podium-medal', o.medal));
    var av = el('div', 'podium-avatar', initial(o.e.name)); av.style.background = avatarColor(o.e.name); slot.appendChild(av);
    slot.appendChild(el('span', 'podium-name', o.e.name));
    var chip = el('span', 'podium-rankchip', o.e.rank); chip.style.background = rankColorOf(o.e.rank); slot.appendChild(chip);
    var base = el('div', 'podium-base');
    base.appendChild(el('span', 'podium-pos', '#' + (o.pos + 1)));
    var xp = el('span', 'podium-xp'); var num = mode === 'all' ? o.e.xp : o.e.bestScore; xp.innerHTML = num + ' <small>' + (mode === 'all' ? 'XP' : 'คะแนน') + '</small>'; base.appendChild(xp);
    slot.appendChild(base);
    wrap.appendChild(slot);
  });
  return wrap;
}

async function leaderboard(filter) {
  filter = filter || 'all';
  renderLoading();
  var rows = [];
  if (API.configured) { try { var d = await API.getScoreboard(filter); rows = d.scoreboard || []; } catch (e) {} }
  else { rows = offlineScoreboard(filter); }

  var s = el('div', 'screen home');
  var head = el('div', 'sb-header');
  var tw = el('div', 'sb-title-wrap'); tw.appendChild(el('span', 'sb-trophy', '🏆')); tw.appendChild(el('h1', null, 'สกอร์บอร์ด')); head.appendChild(tw);
  s.appendChild(head);
  s.appendChild(el('p', 'sub-note', API.configured ? (filter === 'all' ? 'อันดับรวมตาม XP สะสม' : 'อันดับตามคะแนนดีสุดของโหมดนี้') : 'โหมดออฟไลน์ — แสดงเฉพาะสถิติในเครื่องนี้'));

  var tabs = el('div', 'sb-tabs');
  [['all', 'อันดับรวม'], ['quick', '⚡ Quick'], ['survival', '❤️ Survival'], ['boss', '⚔️ Boss'], ['daily', '📅 Daily']].forEach(function (f) {
    var b = el('button', 'sb-tab' + (filter === f[0] ? ' active' : ''), f[1]); b.addEventListener('click', function () { leaderboard(f[0]); }); tabs.appendChild(b);
  });
  s.appendChild(tabs);

  if (!rows.length) {
    var empty = el('div', 'card'); empty.appendChild(el('div', 'sb-empty', 'ยังไม่มีผู้เล่นบันทึกคะแนนในหมวดนี้\nเล่นให้จบสัก 1 เกมแล้วกลับมาดูใหม่'));
    s.appendChild(empty);
  } else {
    if (rows.length >= 1) s.appendChild(podium(rows.slice(0, 3), filter));
    var list = el('div', 'sb-list');
    var meName = state.name.trim();
    var meIdx = -1;
    rows.forEach(function (e, i) { if (e.name === meName) meIdx = i; });
    // list ranks 4+ (podium already shows top 3)
    for (var i = 3; i < rows.length; i++) list.appendChild(sbRow(rows[i], i, filter, rows[i].name === meName));
    if (list.children.length) s.appendChild(list);
    // my position card if I'm outside visible list / in top3 highlight handled by podium
    if (meIdx >= 3) { /* already shown & highlighted in list */ }
    else if (meName && meIdx === -1) {
      var mp = el('div', 'my-pos-card'); mp.appendChild(el('div', 'my-pos-head', 'ตำแหน่งของคุณ'));
      mp.appendChild(el('div', 'sb-empty', 'ยังไม่ติดอันดับในหมวดนี้ — เล่นให้จบเพื่อขึ้นกระดาน'));
      s.appendChild(mp);
    }
  }

  var bk = el('button', 'btn-primary', 'กลับหน้าแรก'); bk.addEventListener('click', function () { render(screenHome); }); s.appendChild(bk);
  root.replaceChildren(s);
}

// offline scoreboard: only this device's own profile(s) stored locally
function offlineScoreboard(filter) {
  var out = [];
  try {
    for (var k = 0; k < localStorage.length; k++) {
      var key = localStorage.key(k);
      if (key && key.indexOf('probgame-xp-') === 0) {
        var name = key.slice('probgame-xp-'.length);
        var xp = JSON.parse(localStorage.getItem(key) || '0');
        out.push({ name: name, xp: xp, rank: rankFor(xp).n, gamesPlayed: 0, bestScore: 0, lastPlayed: '' });
      }
    }
  } catch (e) {}
  out.sort(function (a, b) { return b.xp - a.xp; });
  return out;
}

// ---------- render ----------
function render(fn) { root.replaceChildren(fn()); }
function renderLoading() { var s = el('div', 'screen home'); s.appendChild(el('p', 'hint', '')); s.lastChild.innerHTML = '<span class="spinner"></span> กำลังโหลดโจทย์...'; root.replaceChildren(s); }

// ---------- Admin (สำหรับครู: จัดการคลังโจทย์) ----------
var _adminPin = '';
function adminGate() {
  if (!API.configured) { onlinelessNotice('ต้องตั้งค่า API (config.js) ก่อนถึงจะใช้ระบบจัดการโจทย์ได้'); return; }
  var s = el('div', 'screen home');
  s.appendChild(el('h1', null, '⚙ สำหรับครู'));
  s.appendChild(el('p', 'sub-note', 'ใส่รหัสผ่านผู้ดูแลเพื่อจัดการคลังโจทย์ (เพิ่ม/แก้/ลบ)'));
  var c = el('div', 'card');
  c.appendChild(el('label', 'field-label', 'รหัสผ่านผู้ดูแล'));
  var inp = el('input', 'text-input'); inp.type = 'password'; inp.placeholder = 'รหัส PIN'; c.appendChild(inp);
  var msg = el('p', 'warn-text', ''); msg.style.display = 'none'; c.appendChild(msg);
  var go = el('button', 'btn-primary submit-btn', 'เข้าสู่ระบบ');
  go.addEventListener('click', async function () {
    go.disabled = true; go.textContent = 'กำลังตรวจสอบ...';
    try { await API.adminAuth(inp.value); _adminPin = inp.value; adminManager(); }
    catch (e) { msg.textContent = e.message || 'รหัสผ่านไม่ถูกต้อง'; msg.style.display = 'block'; go.disabled = false; go.textContent = 'เข้าสู่ระบบ'; }
  });
  c.appendChild(go);
  s.appendChild(c);
  s.appendChild(el('p', 'hint', 'ตั้งรหัสได้ที่ Script Properties: ADMIN_PIN (ค่าเริ่มต้น 1234)'));
  var bk = el('button', 'btn-secondary', 'กลับหน้าแรก'); bk.addEventListener('click', function () { render(screenHome); }); s.appendChild(bk);
  root.replaceChildren(s);
}
function onlinelessNotice(msg) {
  var s = el('div', 'screen home'); s.appendChild(el('h1', null, '⚙ สำหรับครู'));
  var c = el('div', 'card'); c.appendChild(el('p', 'warn-text', msg)); s.appendChild(c);
  var bk = el('button', 'btn-primary', 'กลับหน้าแรก'); bk.addEventListener('click', function () { render(screenHome); }); s.appendChild(bk);
  root.replaceChildren(s);
}

async function adminManager() {
  renderLoading();
  var qs = [];
  try { var d = await API.listQuestions(_adminPin); qs = d.questions || []; } catch (e) { onlinelessNotice('โหลดคลังโจทย์ไม่สำเร็จ: ' + e.message); return; }
  var s = el('div', 'screen home');
  var hdr = el('div', 'app-header');
  hdr.appendChild(el('h1', null, '⚙ จัดการคลังโจทย์'));
  var hr = el('div', 'header-right');
  var addBtn = el('button', 'btn-primary', '➕ เพิ่มโจทย์'); addBtn.style.padding = '10px 16px'; addBtn.addEventListener('click', function () { adminEdit(null); }); hr.appendChild(addBtn);
  hdr.appendChild(hr); s.appendChild(hdr);
  s.appendChild(el('p', 'sub-note', 'มีโจทย์ในคลัง ' + qs.length + ' ข้อ (โจทย์เหล่านี้เป็นแบบเลือกตอบ ผสมกับคำถามหลายรูปแบบที่ระบบสร้างอัตโนมัติตอนเล่น)'));

  var list = el('div', 'admin-list');
  if (!qs.length) list.appendChild(el('div', 'sb-empty', 'ยังไม่มีโจทย์ในคลัง กด "เพิ่มโจทย์" เพื่อสร้าง'));
  qs.forEach(function (q) {
    var row = el('div', 'admin-row');
    var mid = el('div', 'admin-mid');
    var tags = el('div', 'q-tags'); tags.appendChild(el('span', 'diff-tag', q.difficulty)); tags.appendChild(el('span', 'type-tag', q.topic)); if (q.source) tags.appendChild(el('span', 'src-tag', q.source));
    mid.appendChild(tags);
    mid.appendChild(el('p', 'admin-qtext', q.text));
    mid.appendChild(el('p', 'admin-ans', 'เฉลย: ' + (q.options[q.correctIndex] || '-')));
    row.appendChild(mid);
    var acts = el('div', 'admin-acts');
    var ed = el('button', 'icon-btn', '✏️'); ed.title = 'แก้ไข'; ed.addEventListener('click', function () { adminEdit(q); }); acts.appendChild(ed);
    var del = el('button', 'icon-btn danger', '🗑'); del.title = 'ลบ'; del.addEventListener('click', function () { adminDelete(q); }); acts.appendChild(del);
    row.appendChild(acts);
    list.appendChild(row);
  });
  s.appendChild(list);
  var bk = el('button', 'btn-secondary', 'ออกจากระบบจัดการ'); bk.addEventListener('click', function () { _adminPin = ''; render(screenHome); }); s.appendChild(bk);
  root.replaceChildren(s);
}

function adminEdit(q) {
  var isNew = !q;
  var data = q ? { id: q.id, topic: q.topic, difficulty: q.difficulty, text: q.text, options: q.options.slice(), correctIndex: q.correctIndex, explanation: q.explanation } : { topic: 'dice', difficulty: 'easy', text: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' };
  var s = el('div', 'screen home');
  s.appendChild(el('h1', null, isNew ? 'เพิ่มโจทย์ใหม่' : 'แก้ไขโจทย์'));

  var c = el('div', 'card admin-form');
  // topic + difficulty
  var rowTD = el('div', 'form-row2');
  var topicSel = selectField('หัวข้อ', [['dice', 'ลูกเต๋า'], ['coin', 'เหรียญ'], ['card', 'ไพ่'], ['ball', 'ลูกบอล'], ['mixed', 'อื่นๆ']], data.topic);
  var difSel = selectField('ความยาก', [['easy', 'ง่าย'], ['medium', 'ปานกลาง'], ['hard', 'ยาก']], data.difficulty);
  rowTD.appendChild(topicSel.wrap); rowTD.appendChild(difSel.wrap); c.appendChild(rowTD);
  // question text
  c.appendChild(el('label', 'field-label', 'คำถาม'));
  var qtext = el('textarea', 'text-input'); qtext.rows = 2; qtext.value = data.text; c.appendChild(qtext);
  // options
  c.appendChild(el('label', 'field-label', 'ตัวเลือก 4 ข้อ (เลือกวงกลมหน้าข้อที่ถูก)'));
  var optInputs = [];
  var correctIdx = data.correctIndex;
  data.options.forEach(function (opt, i) {
    var orow = el('div', 'opt-row');
    var radio = el('button', 'opt-radio' + (i === correctIdx ? ' on' : ''), i === correctIdx ? '●' : '○');
    radio.addEventListener('click', function () { correctIdx = i; Array.prototype.forEach.call(orow.parentNode.querySelectorAll('.opt-radio'), function (rr, j) { rr.className = 'opt-radio' + (j === correctIdx ? ' on' : ''); rr.textContent = j === correctIdx ? '●' : '○'; }); });
    var oin = el('input', 'text-input'); oin.value = opt; oin.placeholder = 'ตัวเลือกที่ ' + (i + 1);
    optInputs.push(oin);
    orow.appendChild(radio); orow.appendChild(oin); c.appendChild(orow);
  });
  // explanation
  c.appendChild(el('label', 'field-label', 'คำอธิบายเฉลย'));
  var expl = el('textarea', 'text-input'); expl.rows = 2; expl.value = data.explanation; c.appendChild(expl);
  var msg = el('p', 'warn-text', ''); msg.style.display = 'none'; c.appendChild(msg);
  s.appendChild(c);

  var save = el('button', 'btn-primary', isNew ? 'บันทึกโจทย์' : 'บันทึกการแก้ไข');
  save.addEventListener('click', async function () {
    var payload = { topic: topicSel.get(), difficulty: difSel.get(), text: qtext.value.trim(), options: optInputs.map(function (i) { return i.value.trim(); }), correctIndex: correctIdx, explanation: expl.value.trim() };
    if (!payload.text || payload.options.some(function (o) { return !o; })) { msg.textContent = 'กรอกคำถามและตัวเลือกให้ครบทั้ง 4 ข้อ'; msg.style.display = 'block'; return; }
    save.disabled = true; save.textContent = 'กำลังบันทึก...';
    try { if (isNew) await API.addQuestion(_adminPin, payload); else { payload.id = data.id; await API.updateQuestion(_adminPin, payload); } adminManager(); }
    catch (e) { msg.textContent = e.message || 'บันทึกไม่สำเร็จ'; msg.style.display = 'block'; save.disabled = false; save.textContent = 'บันทึก'; }
  });
  s.appendChild(save);
  var bk = el('button', 'btn-secondary', 'ยกเลิก'); bk.addEventListener('click', function () { adminManager(); }); s.appendChild(bk);
  root.replaceChildren(s);
}

function selectField(label, options, current) {
  var wrap = el('div', 'field-col');
  wrap.appendChild(el('label', 'field-label', label));
  var sel = el('select', 'text-input');
  options.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; if (o[0] === current) op.selected = true; sel.appendChild(op); });
  wrap.appendChild(sel);
  return { wrap: wrap, get: function () { return sel.value; } };
}

function adminDelete(q) {
  var s = el('div', 'screen home');
  s.appendChild(el('h1', null, 'ยืนยันการลบ'));
  var c = el('div', 'card'); c.appendChild(el('p', 'question-text', q.text)); c.appendChild(el('p', 'hint', 'ลบแล้วกู้คืนไม่ได้')); s.appendChild(c);
  var del = el('button', 'btn-primary', 'ลบโจทย์นี้'); del.style.background = 'var(--danger)';
  del.addEventListener('click', async function () { del.disabled = true; del.textContent = 'กำลังลบ...'; try { await API.deleteQuestion(_adminPin, q.id); adminManager(); } catch (e) { del.textContent = 'ลบไม่สำเร็จ'; } });
  s.appendChild(del);
  var bk = el('button', 'btn-secondary', 'ยกเลิก'); bk.addEventListener('click', function () { adminManager(); }); s.appendChild(bk);
  root.replaceChildren(s);
}

// extra styles for boss/pvp injected (kept out of main CSS for brevity)
var extra = document.createElement('style');
extra.textContent = '.boss-banner{display:flex;flex-direction:column;gap:6px;background:#2a1810;color:#ffe6c9;border-radius:10px;padding:10px 14px;font-family:Kanit;font-weight:600;font-size:14px;transition:background .2s}.boss-banner.hit{background:#7a2418}.boss-hp-track{height:8px;background:#4a2f22;border-radius:6px;overflow:hidden}.boss-hp-fill{height:100%;background:linear-gradient(90deg,#e05a2b,#ffb15c);transition:width .6s ease}.boss-card{border-color:#d97a2a;border-width:2px}.pvp-hp-row{display:flex;align-items:center;gap:10px}.pvp-side{flex:1;display:flex;flex-direction:column;gap:4px}.pvp-name{font-family:Kanit;font-weight:600;font-size:13px}.pvp-hp-track{height:10px;background:#eee7d8;border-radius:6px;overflow:hidden}.pvp-hp-fill{height:100%;background:linear-gradient(90deg,#c0392b,#e88a3e);transition:width .5s ease}.pvp-vs{font-family:Kanit;font-weight:700;color:#d97a2a;font-size:13px}.turn-tag{font-family:Kanit;font-weight:600;font-size:14px;color:#094f44}';
document.head.appendChild(extra);

// ---------- boot ----------
(async function () {
  state.name = loadRemembered();
  if (API.configured) { try { await API.ping(); state.online = true; } catch (e) { state.online = false; } }
  await refreshProfile();
  render(screenHome);
})();
