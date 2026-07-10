/* =====================================================
 *  คลังภาพกิจกรรมโรงเรียน — แผงผู้ดูแล (admin.html)
 *  -----------------------------------------------
 *  ★ ตั้งค่าอย่างเดียวที่ต้องแก้: API_URL ด้านล่าง
 *    (ต้องเป็น URL เดียวกับใน app.js)
 * ===================================================== */
const API_URL = 'https://script.google.com/macros/s/AKfycbyCAHt-GZpsoP-NXADVuNwrWp3Yov0DQmAfFvkQcZTqCPbvlMW-NWGsx5Qgb0maucbw/exec';

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                     'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const $ = s => document.querySelector(s);
const thumb = id => `https://drive.google.com/thumbnail?id=${id}&sz=w200`;
const thaiDate = iso => {
  if (!iso) return 'ไม่ระบุวันที่';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
};

function toast(msg, isError) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  setTimeout(() => t.className = '', 3000);
}

/* ---------- เรียก API ฝั่งเขียน (POST แบบ text/plain เลี่ยง CORS preflight) ---------- */
async function api(payload) {
  payload.token = sessionStorage.getItem('gh_token') || '';
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

/* ---------- login ---------- */
async function login() {
  const btn = $('#btn-login');
  btn.disabled = true;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'login',
        username: $('#username').value.trim(),
        password: $('#password').value
      })
    });
    const data = await res.json();
    if (!data.ok) return toast(data.error, true);
    sessionStorage.setItem('gh_token', data.token);
    showAdmin();
  } catch (err) {
    toast('เชื่อมต่อระบบไม่ได้', true);
  } finally {
    btn.disabled = false;
  }
}

function logout() {
  sessionStorage.removeItem('gh_token');
  location.reload();
}

function showAdmin() {
  $('#login-view').hidden = true;
  $('#admin-view').hidden = false;
  $('#btn-logout').hidden = false;
  loadAlbums();
}

/* ---------- โหลดรายการอัลบั้ม (รวมที่ซ่อนอยู่) ---------- */
async function loadAlbums() {
  const data = await api({ action: 'listAll' });
  if (!data.ok) {
    // token หมดอายุหรือไม่ถูกต้อง → กลับไปหน้า login
    toast(data.error, true);
    if (String(data.error).includes('token')) logout();
    return;
  }
  renderList(data.albums);
}

function renderList(albums) {
  $('#album-count').textContent = `(${albums.length} อัลบั้ม)`;

  // เติม datalist หมวดหมู่จากข้อมูลจริง
  const cats = [...new Set(albums.map(a => a.category).filter(Boolean))];
  $('#cat-list').innerHTML = cats.map(c => `<option value="${c}">`).join('');

  if (!albums.length) {
    $('#album-list').innerHTML =
      `<p style="color:var(--muted); font-size:13.5px;">ยังไม่มีอัลบั้ม เริ่มเพิ่มอัลบั้มแรกได้จากฟอร์มด้านบน</p>`;
    return;
  }

  $('#album-list').innerHTML = albums.map(a => `
    <div class="album-row" data-id="${a.id}">
      <img src="${a.coverIds[0] ? thumb(a.coverIds[0]) : ''}" alt="">
      <div class="info">
        <b>${a.name}
          <span class="status-pill ${a.status}">${a.status === 'show' ? 'แสดง' : 'ซ่อนอยู่'}</span>
        </b>
        <span>${thaiDate(a.date)} · ${a.category || 'ไม่มีหมวด'} · ${a.photoCount} รูป · ${a.views} วิว</span>
      </div>
      <div class="actions">
        <button class="btn sm" data-act="rescan" title="สแกนรูปในโฟลเดอร์ใหม่">
          <i class="ti ti-refresh"></i> สแกนใหม่
        </button>
        <button class="btn sm" data-act="toggle">
          <i class="ti ti-eye${a.status === 'show' ? '-off' : ''}"></i>
          ${a.status === 'show' ? 'ซ่อน' : 'แสดง'}
        </button>
        <button class="btn sm" data-act="open" title="เปิดโฟลเดอร์ใน Drive">
          <i class="ti ti-external-link"></i>
        </button>
        <button class="btn sm danger" data-act="delete">
          <i class="ti ti-trash"></i>
        </button>
      </div>
    </div>`).join('');

  // เก็บข้อมูลไว้ใช้ตอนกดปุ่ม
  window._albums = Object.fromEntries(albums.map(a => [a.id, a]));
}

/* ---------- เพิ่มอัลบั้ม ---------- */
async function addAlbum() {
  const btn = $('#btn-add');
  const payload = {
    action: 'addAlbum',
    folderUrl: $('#f-url').value.trim(),
    name: $('#f-name').value.trim(),
    category: $('#f-cat').value.trim(),
    date: $('#f-date').value,
    year: $('#f-year').value.trim()
  };
  if (!payload.folderUrl) return toast('กรุณาวางลิงก์โฟลเดอร์ Drive', true);
  if (!payload.name) return toast('กรุณากรอกชื่อกิจกรรม', true);

  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i> กำลังสแกนโฟลเดอร์…';
  try {
    const data = await api(payload);
    if (!data.ok) return toast(data.error, true);
    toast(`เพิ่มอัลบั้มแล้ว พบรูปทั้งหมด ${data.photoCount} รูป`);
    ['#f-url', '#f-name', '#f-date'].forEach(s => $(s).value = '');
    loadAlbums();
  } catch (err) {
    toast('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-plus"></i> เพิ่มอัลบั้ม (ระบบจะสแกนรูปปกให้อัตโนมัติ)';
  }
}

/* ---------- ปุ่มจัดการในแต่ละแถว ---------- */
async function handleRowAction(id, act) {
  const album = window._albums[id];
  if (act === 'open') {
    window.open(`https://drive.google.com/drive/folders/${album.folderId}`, '_blank', 'noopener');
    return;
  }
  if (act === 'delete') {
    if (!confirm(`ลบอัลบั้ม "${album.name}" ออกจากเว็บ?\n(ไฟล์รูปใน Drive จะไม่ถูกลบ)`)) return;
    const data = await api({ action: 'deleteAlbum', id });
    toast(data.ok ? 'ลบอัลบั้มแล้ว' : data.error, !data.ok);
  }
  if (act === 'toggle') {
    const data = await api({ action: 'toggleStatus', id });
    toast(data.ok ? (data.status === 'show' ? 'แสดงอัลบั้มบนเว็บแล้ว' : 'ซ่อนอัลบั้มแล้ว') : data.error, !data.ok);
  }
  if (act === 'rescan') {
    toast('กำลังสแกนโฟลเดอร์ใหม่…');
    const data = await api({ action: 'rescanAlbum', id });
    toast(data.ok ? `สแกนเสร็จ พบรูปทั้งหมด ${data.photoCount} รูป` : data.error, !data.ok);
  }
  loadAlbums();
}

/* ---------- events ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // ถ้ามี token ค้างอยู่ใน session → เข้าหน้าจัดการเลย
  if (sessionStorage.getItem('gh_token')) showAdmin();

  $('#btn-login').addEventListener('click', login);
  $('#password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('#btn-logout').addEventListener('click', logout);
  $('#btn-add').addEventListener('click', addAlbum);
  $('#btn-scan-parent').addEventListener('click', scanParentFolder);

  // ฟอร์มเพิ่มทีละอัน: ถ้าชื่อกิจกรรมมีวันที่ติดมา (เช่น "65-05-18 กีฬาสี")
  // → เติมวันที่ + ปีการศึกษาให้อัตโนมัติ และตัดวันที่ออกจากชื่อ
  $('#f-name').addEventListener('blur', () => {
    const found = findDateInName($('#f-name').value);
    if (!found) return;
    if (!$('#f-date').value) $('#f-date').value = found.iso;
    if (!$('#f-year').value) $('#f-year').value = academicYear(found.iso);
    $('#f-name').value = $('#f-name').value
      .replace(found.text, '').replace(/^[\s\-_.]+|[\s\-_.]+$/g, '').trim();
    toast('เติมวันที่และปีการศึกษาจากชื่อให้แล้ว');
  });

  $('#album-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const row = btn.closest('.album-row');
    handleRowAction(row.dataset.id, btn.dataset.act);
  });
});

/* =====================================================
 *  นำเข้าหลายอัลบั้มจากโฟลเดอร์ใหญ่ (Bulk Import)
 *  -----------------------------------------------
 *  1) สแกนโฟลเดอร์ย่อยทั้งหมดในโฟลเดอร์ใหญ่
 *  2) เดาชื่อ / วันที่ / หมวดหมู่ / ปีการศึกษา จากชื่อโฟลเดอร์
 *  3) แสดงตารางให้ตรวจแก้ → นำเข้าทีละรายการพร้อม progress
 * ===================================================== */

/* คำในชื่อโฟลเดอร์ → หมวดหมู่ (เพิ่ม/แก้ได้ตามบริบทโรงเรียน) */
const CATEGORY_KEYWORDS = {
  'กีฬา': 'กีฬา', 'กรีฑา': 'กีฬา', 'ฟุตบอล': 'กีฬา', 'วอลเลย์': 'กีฬา',
  'ไหว้ครู': 'วันสำคัญ', 'วันแม่': 'วันสำคัญ', 'วันพ่อ': 'วันสำคัญ',
  'ลอยกระทง': 'วันสำคัญ', 'สุนทรภู่': 'วันสำคัญ', 'ปีใหม่': 'วันสำคัญ',
  'คริสต์มาส': 'วันสำคัญ', 'สงกรานต์': 'วันสำคัญ', 'เข้าพรรษา': 'วันสำคัญ',
  'วันเด็ก': 'วันสำคัญ', 'ครบรอบ': 'วันสำคัญ',
  'ทัศนศึกษา': 'ทัศนศึกษา', 'ศึกษาดูงาน': 'ทัศนศึกษา',
  'ค่าย': 'ค่าย', 'ลูกเสือ': 'ค่าย', 'เนตรนารี': 'ค่าย',
  'วิชาการ': 'วิชาการ', 'แข่งขัน': 'วิชาการ', 'นิทรรศการ': 'วิชาการ',
  'ติว': 'วิชาการ', 'สอบ': 'วิชาการ',
  'อบรม': 'อบรม', 'ประชุม': 'ประชุม',
  'ปัจฉิม': 'พิธีการ', 'ปฐมนิเทศ': 'พิธีการ', 'มอบตัว': 'พิธีการ',
  'รับสมัคร': 'พิธีการ', 'มอบเกียรติบัตร': 'พิธีการ'
};

let bulkRows = [];   // ข้อมูลตาราง preview
let bulkBusy = false;

/* ---------- เดาข้อมูลจากชื่อโฟลเดอร์ ---------- */
function parseFolderName(rawName, createdDate) {
  let name = rawName.trim();
  let date = '';
  let category = '';

  // 1) หมวดหมู่จากวงเล็บเหลี่ยม เช่น "กีฬาสี [กีฬา]"
  const catMatch = name.match(/\[([^\]]+)\]/);
  if (catMatch) {
    category = catMatch[1].trim();
    name = name.replace(catMatch[0], '').trim();
  }

  // 2) วันที่จากชื่อ — รองรับปี 4 หลัก (พ.ศ./ค.ศ.) และปี พ.ศ. 2 หลัก เช่น 65-05-18
  const found = findDateInName(name);
  if (found) {
    date = found.iso;
    name = name.replace(found.text, '').replace(/^[\s\-_.]+|[\s\-_.]+$/g, '').trim();
  }
  if (!date) date = createdDate; // ไม่มีในชื่อ → ใช้วันที่สร้างโฟลเดอร์แทน

  // 3) หมวดหมู่จากคำในชื่อ (ถ้ายังไม่ได้จากวงเล็บ)
  if (!category) {
    for (const kw in CATEGORY_KEYWORDS) {
      if (rawName.includes(kw)) { category = CATEGORY_KEYWORDS[kw]; break; }
    }
  }
  if (!category) category = 'ทั่วไป';

  return { name: name || rawName, date, category, year: academicYear(date) };
}

/* ---------- หาวันที่ในข้อความ ---------- */
/* รองรับ:
 *   ปี 4 หลัก:  2569-06-12, 12-06-2569, 20260612 (พ.ศ. หรือ ค.ศ. ก็ได้)
 *   ปี 2 หลัก:  65-05-18 (= 18 พ.ค. พ.ศ. 2565), 18-05-65, 650518
 *   ★ ปี 2 หลักถือเป็น พ.ศ. เสมอ และระบบแปลงเป็น ค.ศ. ให้ตอนบันทึก
 *   คั่นด้วย - _ . / ได้ทั้งหมด
 */
function findDateInName(str) {
  // --- ปี 4 หลัก ---
  const four = [
    { re: /(25\d{2}|20\d{2})[-_./](\d{1,2})[-_./](\d{1,2})/, order: 'ymd' }, // 2569-06-12
    { re: /(\d{1,2})[-_./](\d{1,2})[-_./](25\d{2}|20\d{2})/, order: 'dmy' }, // 12-06-2569
    { re: /(25\d{2}|20\d{2})(\d{2})(\d{2})(?!\d)/,           order: 'ymd' }  // 25690612
  ];
  for (const p of four) {
    const m = str.match(p.re);
    if (!m) continue;
    let y, mo, d;
    if (p.order === 'ymd') { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else                   { y = +m[3]; mo = +m[2]; d = +m[1]; }
    if (y > 2400) y -= 543; // พ.ศ. → ค.ศ.
    const iso = validDate(y, mo, d);
    if (iso) return { iso, text: m[0] };
  }

  // --- ปี พ.ศ. 2 หลัก มีตัวคั่น เช่น 65-05-18 หรือ 18-05-65 ---
  const m2 = str.match(/(^|\D)(\d{1,2})[-_./](\d{1,2})[-_./](\d{1,2})(?!\d)/);
  if (m2) {
    const a = +m2[2], b = +m2[3], c = +m2[4];
    let y = 0, mo = 0, d = 0;
    if (a > 31)      { y = a; mo = b; d = c; } // ตัวแรกเกิน 31 → เป็นปีแน่ (yy-mm-dd)
    else if (c > 31) { y = c; mo = b; d = a; } // ตัวท้ายเกิน 31 → ปีอยู่ท้าย (dd-mm-yy)
    // ถ้าทุกตัวไม่เกิน 31 = ไม่มีปีที่สมเหตุสมผล (พ.ศ. 25xx ปัจจุบันคือ 40 ขึ้นไป) → ข้าม
    if (y) {
      const iso = validDate(y + 2500 - 543, mo, d); // พ.ศ. 25yy → ค.ศ.
      if (iso) return { iso, text: m2[0].replace(/^\D/, '') };
    }
  }

  // --- ปี พ.ศ. 2 หลัก ติดกัน 6 หลัก เช่น 650518 (ปีต้อง 40 ขึ้นไป กันจับเลขอื่นมั่ว) ---
  const m3 = str.match(/(^|\D)([4-9]\d)(\d{2})(\d{2})(?!\d)/);
  if (m3) {
    const iso = validDate(+m3[2] + 2500 - 543, +m3[3], +m3[4]);
    if (iso) return { iso, text: m3[0].replace(/^\D/, '') };
  }

  return null;
}

function validDate(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* ปีการศึกษาไทย: พ.ค.–เม.ย. (ม.ค.–เม.ย. นับเป็นปีการศึกษาก่อนหน้า) */
function academicYear(isoDate) {
  if (!isoDate) return '';
  const [y, m] = isoDate.split('-').map(Number);
  return String((m >= 5 ? y : y - 1) + 543);
}

/* ---------- ขั้นที่ 1: สแกนโฟลเดอร์ย่อย ---------- */
async function scanParentFolder() {
  const url = $('#b-url').value.trim();
  if (!url) return toast('กรุณาวางลิงก์โฟลเดอร์ใหญ่', true);

  const btn = $('#btn-scan-parent');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i> กำลังสแกนโฟลเดอร์ย่อย…';
  try {
    const data = await api({ action: 'listSubfolders', folderUrl: url });
    if (!data.ok) return toast(data.error, true);

    bulkRows = data.folders.map(f => ({
      ...f,
      ...parseFolderName(f.name, f.created),
      selected: !f.exists
    }));
    renderBulkPreview(data.parentName);
  } catch (err) {
    toast('เชื่อมต่อระบบไม่ได้', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-search"></i> สแกนโฟลเดอร์ย่อย';
  }
}

/* ---------- ขั้นที่ 2: ตาราง preview แก้ไขได้ ---------- */
function renderBulkPreview(parentName) {
  const newCount = bulkRows.filter(r => !r.exists).length;
  const dupCount = bulkRows.length - newCount;

  $('#bulk-preview').innerHTML = `
    <p class="bulk-summary">
      พบ ${bulkRows.length} โฟลเดอร์ย่อยใน "${parentName}"
      — นำเข้าได้ ${newCount} รายการ${dupCount ? ` (มีอยู่แล้ว ${dupCount} รายการ ระบบข้ามให้)` : ''}
    </p>
    <div class="bulk-head">
      <span></span><span>ชื่อกิจกรรม</span><span>วันที่จัด</span><span>หมวดหมู่</span><span>ปีการศึกษา</span>
    </div>
    ${bulkRows.map((r, i) => `
      <div class="bulk-row ${r.exists ? 'exists' : ''}">
        ${r.exists
          ? '<span class="status-pill hide">มีแล้ว</span>'
          : `<input type="checkbox" data-bi="${i}" data-bf="selected" ${r.selected ? 'checked' : ''}
               aria-label="เลือกนำเข้า ${r.name}">`}
        <input value="${r.name.replace(/"/g, '&quot;')}" data-bi="${i}" data-bf="name" ${r.exists ? 'disabled' : ''}>
        <input type="date" value="${r.date}" data-bi="${i}" data-bf="date" ${r.exists ? 'disabled' : ''}>
        <input value="${r.category}" data-bi="${i}" data-bf="category" list="cat-list" ${r.exists ? 'disabled' : ''}>
        <input value="${r.year}" data-bi="${i}" data-bf="year" ${r.exists ? 'disabled' : ''}>
      </div>`).join('')}
    <button class="btn primary" id="btn-bulk-import" ${newCount ? '' : 'disabled'}>
      <i class="ti ti-download"></i> นำเข้าอัลบั้มที่เลือก
    </button>
    <p class="section-hint" style="margin-top:8px;">
      ระบบจะสแกนรูปปกของแต่ละอัลบั้มระหว่างนำเข้า เปิดหน้านี้ค้างไว้จนเสร็จ
    </p>`;

  // ผูกการแก้ไขในตารางกลับเข้า bulkRows
  $('#bulk-preview').addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.bi === undefined) return;
    const row = bulkRows[+el.dataset.bi];
    const field = el.dataset.bf;
    if (field === 'selected') row.selected = el.checked;
    else row[field] = el.value;
    if (field === 'date') { // เปลี่ยนวันที่ → คำนวณปีการศึกษาใหม่ให้
      row.year = academicYear(el.value);
      el.closest('.bulk-row').querySelector('[data-bf="year"]').value = row.year;
    }
  });

  $('#btn-bulk-import').addEventListener('click', bulkImport);
}

/* ---------- ขั้นที่ 3: นำเข้าทีละรายการพร้อม progress ---------- */
async function bulkImport() {
  if (bulkBusy) return;
  const targets = bulkRows.filter(r => !r.exists && r.selected);
  if (!targets.length) return toast('ยังไม่ได้เลือกรายการที่จะนำเข้า', true);
  if (!confirm(`นำเข้า ${targets.length} อัลบั้ม?\nระบบจะสแกนรูปปกของทุกอัลบั้ม อาจใช้เวลาสักครู่`)) return;

  bulkBusy = true;
  const btn = $('#btn-bulk-import');
  btn.disabled = true;

  let success = 0;
  const failed = [];
  for (let i = 0; i < targets.length; i++) {
    const r = targets[i];
    btn.innerHTML = `<i class="ti ti-loader-2"></i> นำเข้า ${i + 1}/${targets.length}: ${r.name}`;
    try {
      const data = await api({
        action: 'addAlbum',
        folderUrl: r.id, // ส่ง Folder ID ตรงๆ ได้ (extractFolderId_ รองรับ)
        name: r.name.trim(),
        category: r.category.trim(),
        date: r.date,
        year: r.year.trim()
      });
      if (data.ok) success++;
      else failed.push(`${r.name} (${data.error})`);
    } catch (err) {
      failed.push(`${r.name} (เชื่อมต่อไม่ได้)`);
    }
  }

  bulkBusy = false;
  btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-download"></i> นำเข้าอัลบั้มที่เลือก';

  if (failed.length) {
    toast(`นำเข้าสำเร็จ ${success} รายการ, ไม่สำเร็จ ${failed.length} รายการ`, true);
    console.warn('รายการที่ไม่สำเร็จ:', failed);
  } else {
    toast(`นำเข้าสำเร็จครบ ${success} อัลบั้ม`);
  }
  $('#bulk-preview').innerHTML = '';
  $('#b-url').value = '';
  loadAlbums();
}
