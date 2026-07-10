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

  $('#album-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const row = btn.closest('.album-row');
    handleRowAction(row.dataset.id, btn.dataset.act);
  });
});
