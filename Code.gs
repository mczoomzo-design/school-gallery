/**
 * เกมความน่าจะเป็น ม.3 — Google Apps Script Backend (Web App JSON API)
 * ------------------------------------------------------------------
 * Stack: Google Apps Script (Web App) + Google Sheets (database).
 * Frontend: hosted on GitHub Pages, calls this Web App URL via fetch().
 *
 * SETUP (ทำครั้งเดียว):
 *   1. สร้าง Google Sheet ใหม่ 1 ไฟล์ เปิด Extensions > Apps Script วางไฟล์นี้
 *   2. รันฟังก์ชัน setup() หนึ่งครั้ง (สร้างชีตทั้งหมดอัตโนมัติ)
 *   3. (ถ้าจะใช้ AI สร้างโจทย์) ใส่ ANTHROPIC_API_KEY ใน Script Properties
 *      Project Settings > Script properties > Add: ANTHROPIC_API_KEY = sk-ant-...
 *   4. Deploy > New deployment > Web app
 *        Execute as: Me
 *        Who has access: Anyone
 *      คัดลอก Web app URL เอาไปใส่ในไฟล์ frontend (config.js -> API_URL)
 *
 * หมายเหตุ CORS: frontend ต้องส่ง POST ด้วย Content-Type: text/plain
 *   (เป็น "simple request" ไม่มี preflight ที่ GAS ตอบไม่ได้) โค้ด frontend
 *   ที่ให้มาทำแบบนี้อยู่แล้ว
 */

var SHEET_PROFILES = 'Profiles';
var SHEET_SCORES = 'Scores';
var SHEET_QUESTIONS = 'Questions';

// ---------- One-time setup ----------
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_PROFILES, [
    'name', 'passwordHash', 'xp', 'rank', 'dailyLastDate', 'dailyStreak', 'createdAt', 'lastPlayed'
  ]);
  ensureSheet_(ss, SHEET_SCORES, [
    'name', 'mode', 'score', 'rank', 'timestamp'
  ]);
  ensureSheet_(ss, SHEET_QUESTIONS, [
    'id', 'topic', 'difficulty', 'text', 'opt1', 'opt2', 'opt3', 'opt4', 'correctIndex', 'explanation', 'source', 'createdAt'
  ]);
  // เติมโจทย์ตั้งต้นถ้าคลังว่าง
  var qSheet = ss.getSheetByName(SHEET_QUESTIONS);
  if (qSheet.getLastRow() < 2) {
    seedQuestions_(qSheet);
  }
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ---------- Router ----------
function doGet(e) {
  return handle_(e, 'GET');
}
function doPost(e) {
  return handle_(e, 'POST');
}

function handle_(e, method) {
  var params = {};
  try {
    if (method === 'POST' && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else {
      params = e.parameter || {};
    }
  } catch (err) {
    params = e.parameter || {};
  }
  var action = params.action || (e.parameter && e.parameter.action) || '';
  var result;
  try {
    switch (action) {
      case 'getProfile':      result = apiGetProfile_(params); break;
      case 'saveScore':       result = apiSaveScore_(params); break;
      case 'getLeaderboard':  result = apiGetLeaderboard_(params); break;
      case 'getScoreboard':   result = apiGetScoreboard_(params); break;
      case 'getQuestions':    result = apiGetQuestions_(params); break;
      case 'generateQuestions': result = apiGenerateQuestions_(params); break;
      case 'adminAuth':       result = apiAdminAuth_(params); break;
      case 'listQuestions':   result = apiListQuestions_(params); break;
      case 'addQuestion':     result = apiAddQuestion_(params); break;
      case 'updateQuestion':  result = apiUpdateQuestion_(params); break;
      case 'deleteQuestion':  result = apiDeleteQuestion_(params); break;
      case 'saveDaily':       result = apiSaveDaily_(params); break;
      case 'ping':            result = { ok: true, time: new Date().toISOString() }; break;
      default:                result = { ok: false, error: 'unknown action: ' + action };
    }
  } catch (err) {
    result = { ok: false, error: String(err) };
  }
  return json_(result);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- Rank ----------
var RANKS = [
  { name: 'บรอนซ์', min: 0 },
  { name: 'ซิลเวอร์', min: 300 },
  { name: 'โกลด์', min: 800 },
  { name: 'แพลทินัม', min: 1600 },
  { name: 'ไดมอนด์', min: 3000 },
  { name: 'มาสเตอร์', min: 5000 }
];
function rankForXP_(xp) {
  var r = RANKS[0];
  for (var i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].min) r = RANKS[i];
  return r.name;
}

// ---------- Profiles ----------
function findProfileRow_(sheet, name) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(name)) return { row: i + 1, values: data[i] };
  }
  return null;
}

function apiGetProfile_(p) {
  var name = (p.name || '').trim();
  if (!name) return { ok: false, error: 'missing name' };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PROFILES);
  var found = findProfileRow_(sheet, name);
  if (!found) {
    // create fresh profile
    var now = new Date().toISOString();
    sheet.appendRow([name, '', 0, rankForXP_(0), '', 0, now, now]);
    return { ok: true, profile: { name: name, xp: 0, rank: rankForXP_(0), dailyLastDate: '', dailyStreak: 0 } };
  }
  var v = found.values;
  return {
    ok: true,
    profile: {
      name: name, xp: Number(v[2]) || 0, rank: v[3] || rankForXP_(0),
      dailyLastDate: v[4] || '', dailyStreak: Number(v[5]) || 0
    }
  };
}

function apiSaveScore_(p) {
  var name = (p.name || '').trim();
  var mode = (p.mode || '').trim();
  var score = Number(p.score) || 0;
  if (!name) return { ok: false, error: 'missing name' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pSheet = ss.getSheetByName(SHEET_PROFILES);
  var found = findProfileRow_(pSheet, name);
  var now = new Date().toISOString();
  var gained = Math.round(score * 0.5);
  var newXp;
  if (!found) {
    newXp = gained;
    pSheet.appendRow([name, '', newXp, rankForXP_(newXp), '', 0, now, now]);
  } else {
    newXp = (Number(found.values[2]) || 0) + gained;
    pSheet.getRange(found.row, 3).setValue(newXp);         // xp
    pSheet.getRange(found.row, 4).setValue(rankForXP_(newXp)); // rank
    pSheet.getRange(found.row, 8).setValue(now);           // lastPlayed
  }
  // log score row
  ss.getSheetByName(SHEET_SCORES).appendRow([name, mode, score, rankForXP_(newXp), now]);
  return { ok: true, xp: newXp, rank: rankForXP_(newXp), xpGained: gained };
}

function apiSaveDaily_(p) {
  var name = (p.name || '').trim();
  var dateKey = (p.dateKey || '').trim();
  if (!name || !dateKey) return { ok: false, error: 'missing name/dateKey' };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PROFILES);
  var found = findProfileRow_(sheet, name);
  if (!found) { apiGetProfile_({ name: name }); found = findProfileRow_(sheet, name); }
  var lastDate = found.values[4] || '';
  var streak = Number(found.values[5]) || 0;
  if (lastDate === dateKey) {
    return { ok: false, error: 'already played today', dailyStreak: streak };
  }
  streak = lastDate ? streak + 1 : 1;
  sheet.getRange(found.row, 5).setValue(dateKey); // dailyLastDate
  sheet.getRange(found.row, 6).setValue(streak);  // dailyStreak
  return { ok: true, dailyLastDate: dateKey, dailyStreak: streak };
}

// ---------- Leaderboard ----------
function apiGetLeaderboard_(p) {
  var mode = (p.mode || '').trim();
  var limit = Number(p.limit) || 20;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SCORES);
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    if (mode && mode !== 'all' && String(data[i][1]) !== mode) continue;
    rows.push({ name: data[i][0], mode: data[i][1], score: Number(data[i][2]) || 0, rank: data[i][3], ts: data[i][4] });
  }
  rows.sort(function (a, b) { return b.score - a.score; });
  return { ok: true, leaderboard: rows.slice(0, limit) };
}

/**
 * สกอร์บอร์ดแบบรวมสถิติต่อผู้เล่น 1 คน 1 แถว
 *  - mode = 'all'  -> จัดอันดับตาม XP (จาก Profiles) แนบสถิติจาก Scores
 *  - mode = อื่นๆ  -> จัดอันดับตามคะแนนดีสุดของโหมดนั้น
 * คืน: name, xp, rank, gamesPlayed, bestScore, lastPlayed
 */
function apiGetScoreboard_(p) {
  var mode = (p.mode || 'all').trim();
  var limit = Number(p.limit) || 50;
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // profiles map: name -> {xp, rank}
  var pData = ss.getSheetByName(SHEET_PROFILES).getDataRange().getValues();
  var prof = {};
  for (var i = 1; i < pData.length; i++) {
    prof[String(pData[i][0])] = { xp: Number(pData[i][2]) || 0, rank: pData[i][3] || rankForXP_(0) };
  }

  // aggregate scores per player (optionally within one mode)
  var sData = ss.getSheetByName(SHEET_SCORES).getDataRange().getValues();
  var agg = {};
  for (var j = 1; j < sData.length; j++) {
    var nm = String(sData[j][0]); var md = String(sData[j][1]); var sc = Number(sData[j][2]) || 0; var ts = sData[j][4];
    if (mode !== 'all' && md !== mode) continue;
    if (!agg[nm]) agg[nm] = { name: nm, gamesPlayed: 0, bestScore: 0, lastPlayed: '' };
    agg[nm].gamesPlayed++;
    if (sc > agg[nm].bestScore) agg[nm].bestScore = sc;
    if (!agg[nm].lastPlayed || ts > agg[nm].lastPlayed) agg[nm].lastPlayed = ts;
  }

  var rows = [];
  if (mode === 'all') {
    // one row per profile, sorted by xp
    for (var name in prof) {
      var a = agg[name] || { gamesPlayed: 0, bestScore: 0, lastPlayed: '' };
      rows.push({ name: name, xp: prof[name].xp, rank: prof[name].rank, gamesPlayed: a.gamesPlayed, bestScore: a.bestScore, lastPlayed: a.lastPlayed });
    }
    rows.sort(function (x, y) { return y.xp - x.xp; });
  } else {
    for (var n2 in agg) {
      var pr = prof[n2] || { xp: 0, rank: rankForXP_(0) };
      rows.push({ name: n2, xp: pr.xp, rank: pr.rank, gamesPlayed: agg[n2].gamesPlayed, bestScore: agg[n2].bestScore, lastPlayed: agg[n2].lastPlayed });
    }
    rows.sort(function (x, y) { return y.bestScore - x.bestScore; });
  }
  return { ok: true, mode: mode, scoreboard: rows.slice(0, limit) };
}

// ---------- Questions ----------
function apiGetQuestions_(p) {
  var count = Number(p.count) || 10;
  var topic = (p.topic || '').trim();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  var data = sheet.getDataRange().getValues();
  var pool = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (topic && topic !== 'mixed' && String(r[1]) !== topic) continue;
    pool.push(rowToQuestion_(r));
  }
  // shuffle
  for (var j = pool.length - 1; j > 0; j--) {
    var k = Math.floor(Math.random() * (j + 1));
    var t = pool[j]; pool[j] = pool[k]; pool[k] = t;
  }
  return { ok: true, questions: pool.slice(0, count) };
}

function rowToQuestion_(r) {
  return {
    id: r[0], topic: r[1], difficulty: r[2], text: r[3],
    options: [r[4], r[5], r[6], r[7]],
    correctIndex: Number(r[8]) || 0,
    explanation: r[9]
  };
}

/**
 * เรียก Claude API สร้างโจทย์ใหม่ เก็บลงคลัง แล้วคืนโจทย์ที่สร้าง
 * ต้องตั้ง Script Property: ANTHROPIC_API_KEY
 */
function apiGenerateQuestions_(p) {
  var count = Math.min(Number(p.count) || 8, 15);
  var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) return { ok: false, error: 'ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ใน Script Properties' };

  var prompt = 'สร้างโจทย์ความน่าจะเป็นระดับมัธยมศึกษาปีที่ 3 (หลักสูตร สสวท.) จำนวน ' + count +
    ' ข้อ หัวข้อ: การทดลองสุ่ม เหตุการณ์ ความน่าจะเป็นของเหตุการณ์ (ลูกเต๋า เหรียญ ไพ่ ลูกบอลในถุง สลาก) ' +
    'แต่ละข้อมีตัวเลือก 4 ข้อ (คำตอบเป็นเศษส่วนอย่างต่ำ) คำตอบถูก 1 ข้อ คำอธิบายเฉลยสั้นๆ ห้ามซ้ำแบบเดิม ' +
    'คละระดับความยาก easy/medium/hard และระบุ topic เป็นหนึ่งใน dice/coin/card/ball\n\n' +
    'ตอบเป็น JSON array เท่านั้น ไม่มีข้อความอื่น ไม่มี markdown fence รูปแบบ:\n' +
    '[{"topic":"dice","difficulty":"easy","text":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]';

  var payload = {
    model: 'claude-sonnet-4-6',
    max_tokens: 2200,
    messages: [{ role: 'user', content: prompt }]
  };
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var body = JSON.parse(res.getContentText());
  if (!body.content) return { ok: false, error: 'AI response error', raw: res.getContentText().slice(0, 300) };
  var textBlock = null;
  for (var i = 0; i < body.content.length; i++) if (body.content[i].type === 'text') textBlock = body.content[i];
  if (!textBlock) return { ok: false, error: 'no text block from AI' };
  var cleaned = textBlock.text.replace(/```json/g, '').replace(/```/g, '').trim();
  var parsed;
  try { parsed = JSON.parse(cleaned); } catch (err) { return { ok: false, error: 'parse fail', raw: cleaned.slice(0, 300) }; }
  if (!(parsed instanceof Array)) return { ok: false, error: 'not an array' };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  var now = new Date().toISOString();
  var out = [];
  for (var j = 0; j < parsed.length; j++) {
    var q = parsed[j];
    if (!q.options || q.options.length !== 4) continue;
    var id = 'ai_' + now + '_' + j;
    sheet.appendRow([id, q.topic || 'mixed', q.difficulty || 'medium', q.text,
      q.options[0], q.options[1], q.options[2], q.options[3],
      Number(q.correctIndex) || 0, q.explanation || '', 'ai', now]);
    out.push({ id: id, topic: q.topic, difficulty: q.difficulty, text: q.text, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation });
  }
  return { ok: true, added: out.length, questions: out };
}

// ---------- Admin (จัดการคลังโจทย์) ----------
function adminPin_() {
  var p = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  return p || '1234'; // ค่าเริ่มต้น 1234 — ควรตั้ง ADMIN_PIN ใน Script Properties
}
function checkPin_(p) { return String(p.pin || '') === adminPin_(); }

function apiAdminAuth_(p) {
  if (!checkPin_(p)) return { ok: false, error: 'รหัสผ่านไม่ถูกต้อง' };
  return { ok: true };
}

function apiListQuestions_(p) {
  if (!checkPin_(p)) return { ok: false, error: 'unauthorized' };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    out.push({ id: r[0], topic: r[1], difficulty: r[2], text: r[3], options: [r[4], r[5], r[6], r[7]], correctIndex: Number(r[8]) || 0, explanation: r[9], source: r[10] });
  }
  out.reverse(); // ใหม่สุดก่อน
  return { ok: true, questions: out };
}

function apiAddQuestion_(p) {
  if (!checkPin_(p)) return { ok: false, error: 'unauthorized' };
  var q = p.question || {};
  if (!q.text || !q.options || q.options.length !== 4) return { ok: false, error: 'ข้อมูลไม่ครบ (ต้องมีคำถามและตัวเลือก 4 ข้อ)' };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  var id = 'man_' + Date.now();
  sheet.appendRow([id, q.topic || 'mixed', q.difficulty || 'medium', q.text, q.options[0], q.options[1], q.options[2], q.options[3], Number(q.correctIndex) || 0, q.explanation || '', 'manual', new Date().toISOString()]);
  return { ok: true, id: id };
}

function findQuestionRow_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) if (String(data[i][0]) === String(id)) return i + 1;
  return -1;
}

function apiUpdateQuestion_(p) {
  if (!checkPin_(p)) return { ok: false, error: 'unauthorized' };
  var q = p.question || {};
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  var row = findQuestionRow_(sheet, q.id);
  if (row < 0) return { ok: false, error: 'ไม่พบโจทย์' };
  if (!q.options || q.options.length !== 4) return { ok: false, error: 'ต้องมีตัวเลือก 4 ข้อ' };
  sheet.getRange(row, 2, 1, 9).setValues([[q.topic || 'mixed', q.difficulty || 'medium', q.text, q.options[0], q.options[1], q.options[2], q.options[3], Number(q.correctIndex) || 0, q.explanation || '']]);
  return { ok: true };
}

function apiDeleteQuestion_(p) {
  if (!checkPin_(p)) return { ok: false, error: 'unauthorized' };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUESTIONS);
  var row = findQuestionRow_(sheet, p.id);
  if (row < 0) return { ok: false, error: 'ไม่พบโจทย์' };
  sheet.deleteRow(row);
  return { ok: true };
}

// ---------- Seed starter questions ----------
function seedQuestions_(sheet) {
  var now = new Date().toISOString();
  var seed = [
    ['dice', 'easy', 'ทอดลูกเต๋า 1 ลูก ความน่าจะเป็นที่จะได้แต้ม 3 เท่ากับเท่าใด', '1/6', '1/3', '1/2', '3/6', 0, 'ลูกเต๋า 6 หน้า ได้แต้ม 3 คือ 1 ใน 6 = 1/6'],
    ['dice', 'easy', 'ทอดลูกเต๋า 1 ลูก ความน่าจะเป็นที่จะได้แต้มคู่เท่ากับเท่าใด', '1/2', '1/3', '1/6', '2/3', 0, 'แต้มคู่คือ 2,4,6 รวม 3 แบบ จาก 6 = 1/2'],
    ['dice', 'medium', 'ทอดลูกเต๋า 1 ลูก ความน่าจะเป็นที่จะได้แต้มมากกว่า 4 เท่ากับเท่าใด', '1/3', '1/2', '1/6', '2/3', 0, 'แต้ม 5,6 รวม 2 แบบ จาก 6 = 1/3'],
    ['dice', 'hard', 'ทอดลูกเต๋า 2 ลูก ความน่าจะเป็นที่ผลรวมแต้มเท่ากับ 7 เท่ากับเท่าใด', '1/6', '1/9', '5/36', '1/12', 0, 'ผลรวม 7 เกิดได้ 6 แบบ จาก 36 = 1/6'],
    ['coin', 'easy', 'โยนเหรียญ 2 เหรียญ ความน่าจะเป็นที่จะได้หัวทั้ง 2 เหรียญเท่ากับเท่าใด', '1/4', '1/2', '3/4', '1/8', 0, '{HH,HT,TH,TT} ได้หัวทั้งคู่ 1 แบบ จาก 4 = 1/4'],
    ['coin', 'medium', 'โยนเหรียญ 2 เหรียญ ความน่าจะเป็นที่จะได้หัวอย่างน้อย 1 เหรียญเท่ากับเท่าใด', '3/4', '1/2', '1/4', '2/3', 0, 'มีหัวอย่างน้อย 1 เหรียญ 3 แบบ จาก 4 = 3/4'],
    ['coin', 'hard', 'โยนเหรียญ 3 เหรียญ ความน่าจะเป็นที่จะได้หัวทั้ง 3 เหรียญเท่ากับเท่าใด', '1/8', '1/4', '1/2', '3/8', 0, 'ผลลัพธ์ 8 แบบ ได้หัวทั้ง 3 เหรียญ 1 แบบ = 1/8'],
    ['card', 'easy', 'หยิบไพ่ 1 ใบจากสำรับ 52 ใบ ความน่าจะเป็นที่จะได้ไพ่โพแดงเท่ากับเท่าใด', '1/4', '1/13', '1/2', '1/52', 0, 'ไพ่แต่ละดอก 13 ใบ จาก 52 = 1/4'],
    ['card', 'medium', 'หยิบไพ่ 1 ใบจากสำรับ 52 ใบ ความน่าจะเป็นที่จะได้ไพ่เอซเท่ากับเท่าใด', '1/13', '1/4', '4/13', '1/52', 0, 'เอซมี 4 ใบ จาก 52 = 1/13'],
    ['ball', 'medium', 'ในถุงมีลูกบอลแดง 3 ลูก น้ำเงิน 5 ลูก หยิบ 1 ลูก ความน่าจะเป็นที่จะได้สีแดงเท่ากับเท่าใด', '3/8', '5/8', '1/2', '3/5', 0, 'รวม 8 ลูก แดง 3 ลูก = 3/8']
  ];
  for (var i = 0; i < seed.length; i++) {
    var s = seed[i];
    sheet.appendRow(['seed_' + i, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], 'seed', now]);
  }
}
