/* =====================================================
 *  คลังภาพกิจกรรมโรงเรียน — ฝั่งผู้ใช้ (index.html)
 *  -----------------------------------------------
 *  ★ ตั้งค่าอย่างเดียวที่ต้องแก้: API_URL ด้านล่าง
 * ===================================================== */
const API_URL = 'https://script.google.com/macros/s/AKfycbyCAHt-GZpsoP-NXADVuNwrWp3Yov0DQmAfFvkQcZTqCPbvlMW-NWGsx5Qgb0maucbw/exec'; // เช่น https://script.google.com/macros/s/XXXX/exec

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                     'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

const PER_PAGE = 12; // จำนวนอัลบั้มต่อหน้า

const state = {
  albums: [],          // อัลบั้มทั้งหมดจาก API
  category: '',        // หมวดที่เลือก ('' = ทั้งหมด)
  year: '',            // ปีการศึกษาที่เลือก
  keyword: '',         // คำค้นหา
  view: 'grid',        // grid | cal
  sort: 'date-desc',   // date-desc | date-asc | views-desc | name-asc
  page: 1,             // หน้าปัจจุบันของมุมมองกริด
  calDate: new Date(), // เดือนที่ปฏิทินแสดงอยู่
  selectedDay: ''      // วันที่กดในปฏิทิน (yyyy-mm-dd)
};

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const thumb = (id, size) => `https://drive.google.com/thumbnail?id=${id}&sz=w${size || 400}`;
const folderUrl = id => `https://drive.google.com/drive/folders/${id}`;
const thaiDate = iso => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${THAI_MONTHS[m - 1].slice(0, 3)}. ${y + 543}`;
};
function toast(msg, isError) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  setTimeout(() => t.className = '', 2800);
}

/* ---------- แคชรายการอัลบั้มไว้ในเบราว์เซอร์ (กันเว็บค้าง/โหลดช้า) ----------
   แนวคิด stale-while-revalidate: แสดงข้อมูลล่าสุดที่บันทึกไว้ "ทันที"
   แล้วค่อยดึงข้อมูลใหม่จาก API เบื้องหลัง ถ้า API ล่ม เว็บก็ยังใช้ได้ */
const ALBUMS_LS_KEY = 'gh_albums_v1';
function saveAlbumsCache(albums) {
  try { localStorage.setItem(ALBUMS_LS_KEY, JSON.stringify({ t: Date.now(), albums })); } catch (e) {}
}
function readAlbumsCache() {
  try {
    const o = JSON.parse(localStorage.getItem(ALBUMS_LS_KEY) || 'null');
    return o && Array.isArray(o.albums) ? o.albums : null;
  } catch (e) { return null; }
}

/* ---------- โหลดข้อมูล ---------- */
async function loadAlbums() {
  if (!API_URL || API_URL.indexOf('script.google.com') === -1) {
    $('#album-grid').innerHTML =
      `<div class="empty"><i class="ti ti-settings"></i>ยังไม่ได้ตั้งค่า URL ของ GAS ในไฟล์ app.js (บรรทัด API_URL)</div>`;
    $('#pagination').innerHTML = '';
    return;
  }

  const cached = readAlbumsCache();
  if (cached && cached.length) {
    // มีข้อมูลเก่า → โชว์ทันที ไม่ต้องรอ ไม่มีหน้าโหลด แล้วค่อยรีเฟรชเงียบๆ
    state.albums = cached;
    buildFilters();
    render();
    focusFromUrl();
    refreshAlbums(true);
    return;
  }

  // ยังไม่เคยมีข้อมูล → โหลดปกติ (มีโครงกระดูก)
  renderSkeleton();
  refreshAlbums(false);
}

/* ดึงข้อมูลใหม่จาก API — silent=true คือรีเฟรชเบื้องหลังโดยไม่รบกวนผู้ใช้ */
async function refreshAlbums(silent) {
  try {
    const data = await fetchAlbums();
    state.albums = data.albums;
    saveAlbumsCache(data.albums);
    // จำตัวกรองที่ผู้ใช้เลือกไว้ก่อนสร้าง chip ใหม่ (กันรีเซ็ตตอนรีเฟรชเบื้องหลัง)
    const cat = state.category, yr = state.year;
    buildFilters();
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.cat === cat));
    const ys = $('#year-select'); if (ys) ys.value = yr;
    render();
    if (!silent) focusFromUrl();
  } catch (err) {
    console.error(err);
    if (silent) return; // มีข้อมูลแคชแสดงอยู่แล้ว — เงียบไว้ ไม่ต้องแจ้ง error
    $('#album-grid').innerHTML =
      `<div class="empty">
         <i class="ti ti-plug-x"></i>
         เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง
         <div class="empty-actions"><button class="btn primary" id="btn-retry"><i class="ti ti-refresh"></i> ลองใหม่</button></div>
       </div>`;
    $('#pagination').innerHTML = '';
    const rb = $('#btn-retry');
    if (rb) rb.addEventListener('click', loadAlbums);
  }
}

/* ดึงรายการอัลบั้ม
   1) ลองไฟล์ static `albums.json` บน GitHub Pages ก่อน — เร็ว/นิ่งสุด ไม่พึ่ง GAS
   2) ถ้ายังไม่มีไฟล์/โหลดไม่ได้ → fallback ไป Apps Script (มี retry กันอาการเด้ง 404) */
async function fetchAlbums() {
  const fromJson = await fetchAlbumsJson();
  if (fromJson) return fromJson;
  return fetchAlbumsGAS();
}

/* อ่าน albums.json (ถ้ามี) — คืน null เงียบๆ ถ้าไม่มี/ผิดพลาด เพื่อไป fallback ต่อ */
async function fetchAlbumsJson() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`albums.json?_=${Date.now()}`, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;                 // ยังไม่ได้เผยแพร่ไฟล์ → ไป GAS
    const data = await res.json();
    if (data && Array.isArray(data.albums)) return { ok: true, albums: data.albums };
    return null;
  } catch (e) { return null; }
}

/* fallback: เรียก Apps Script แบบทนทาน (ลองซ้ำ + timeout) */
async function fetchAlbumsGAS(attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(`${API_URL}?action=getAlbums&_=${Date.now()}`, { signal: ctrl.signal });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch (e) { throw new Error('ข้อมูลที่ได้ไม่ใช่ JSON (Google อาจจำกัดชั่วคราว)'); }
      if (!data.ok) throw new Error(data.error || 'api error');
      return data;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 800 * (i + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

function renderSkeleton() {
  $('#album-grid').innerHTML = Array(8).fill(
    `<div class="album-card skeleton">
       <div class="cover"></div>
       <div class="line"></div><div class="line short"></div>
     </div>`).join('');
}

/* ---------- สร้าง filter chips + ปีการศึกษา ---------- */
function buildFilters() {
  const cats = [...new Set(state.albums.map(a => a.category).filter(Boolean))];
  $('#chips').innerHTML =
    `<button class="chip active" data-cat="">ทั้งหมด</button>` +
    cats.map(c => `<button class="chip" data-cat="${c}">${c}</button>`).join('');

  const years = [...new Set(state.albums.map(a => a.year).filter(Boolean))].sort().reverse();
  $('#year-select').innerHTML = `<option value="">ทุกปีการศึกษา</option>` +
    years.map(y => `<option value="${y}">ปีการศึกษา ${y}</option>`).join('');
}

/* ---------- กรองข้อมูลตาม state ---------- */
function filtered() {
  const list = state.albums.filter(a =>
    (!state.category || a.category === state.category) &&
    (!state.year || a.year === state.year) &&
    (!state.keyword || a.name.toLowerCase().includes(state.keyword))
  );
  const byDate = (a, b) => (a.date || '').localeCompare(b.date || '');
  const sorters = {
    'date-desc': (a, b) => -byDate(a, b),
    'date-asc':  byDate,
    'views-desc': (a, b) => (b.views || 0) - (a.views || 0),
    'name-asc':  (a, b) => a.name.localeCompare(b.name, 'th')
  };
  return list.sort(sorters[state.sort] || sorters['date-desc']);
}

/* ---------- render หลัก ---------- */
function render() {
  renderFeatured();
  $('#view-grid').hidden = state.view !== 'grid';
  $('#view-cal').hidden = state.view !== 'cal';
  if (state.view === 'grid') renderGrid();
  else renderCalendar();
}

/* ===================== มุมมองกริด ===================== */
function renderGrid() {
  const list = filtered();
  const grid = $('#album-grid');
  const pager = $('#pagination');

  if (!list.length) {
    grid.innerHTML =
      `<div class="empty"><i class="ti ti-photo-off"></i>ไม่พบอัลบั้มที่ตรงกับเงื่อนไข</div>`;
    pager.innerHTML = '';
    return;
  }

  // แบ่งหน้า
  const totalPages = Math.ceil(list.length / PER_PAGE);
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;
  const start = (state.page - 1) * PER_PAGE;
  const pageItems = list.slice(start, start + PER_PAGE);

  grid.innerHTML = pageItems.map(a => {
    // รูป preview 2-3 รูปแรกสำหรับสไลด์ตอน hover
    const previews = a.coverIds.slice(0, 3);
    const slides = previews.map((id, i) =>
      `<img src="${thumb(id, 400)}" alt="${i === 0 ? 'รูปปก ' + a.name : ''}"
            class="slide${i === 0 ? ' active' : ''}" loading="lazy">`).join('');
    const dots = previews.length > 1
      ? `<div class="cover-dots">${previews.map((_, i) =>
          `<span class="${i === 0 ? 'on' : ''}"></span>`).join('')}</div>`
      : '';
    const liked = isLiked(a.id);
    return `
    <article class="album-card" data-id="${a.id}" data-slides="${previews.length}">
      <div class="cover" role="button" tabindex="0" data-act="open" data-id="${a.id}"
           data-folder="${a.folderId}" aria-label="เปิดอัลบั้ม ${a.name} ใน Google Drive">
        ${slides || '<div class="cover-empty"><i class="ti ti-photo"></i></div>'}
        <span class="count-badge">${a.photoCount} รูป</span>
        ${dots}
        <span class="cover-hint"><i class="ti ti-external-link"></i> เปิดใน Drive</span>
      </div>
      <div class="card-body">
        <h3>${a.name}</h3>
        <div class="card-meta">
          <span><i class="ti ti-calendar"></i> ${thaiDate(a.date) || 'ไม่ระบุวันที่'}</span>
          ${a.category ? `<span class="cat-tag">${a.category}</span>` : ''}
        </div>
        <div class="card-actions">
          <button class="like-btn${liked ? ' liked' : ''}" data-act="like" data-id="${a.id}"
                  aria-label="บันทึกเป็นรายการโปรด ${a.name}" aria-pressed="${liked}" title="รายการโปรด">
            <i class="ti ti-heart${liked ? '-filled' : ''}"></i>
          </button>
          <button class="icon-btn" data-act="share" data-id="${a.id}" aria-label="แชร์ลิงก์อัลบั้ม ${a.name}">
            <i class="ti ti-share-2"></i>
          </button>
          <button class="card-link" data-act="open" data-id="${a.id}" data-folder="${a.folderId}">
            <i class="ti ti-external-link"></i> เปิด Drive
          </button>
        </div>
      </div>
    </article>`;
  }).join('');

  renderPagination(totalPages, list.length);
}

/* ---------- แถบแบ่งหน้า ---------- */
function renderPagination(totalPages, totalItems) {
  const pager = $('#pagination');
  if (totalPages <= 1) {
    pager.innerHTML = `<span class="page-info">ทั้งหมด ${totalItems} อัลบั้ม</span>`;
    return;
  }

  const p = state.page;
  const btn = (label, page, opts = {}) =>
    `<button class="page-btn${opts.active ? ' active' : ''}" ${opts.disabled ? 'disabled' : ''}
             data-page="${page}" aria-label="${opts.aria || 'หน้า ' + page}">${label}</button>`;

  // สร้างเลขหน้าแบบย่อ: 1 … 4 5 [6] 7 8 … 20
  const nums = [];
  const push = n => nums.push(n);
  push(1);
  const from = Math.max(2, p - 1), to = Math.min(totalPages - 1, p + 1);
  if (from > 2) nums.push('…');
  for (let i = from; i <= to; i++) push(i);
  if (to < totalPages - 1) nums.push('…');
  if (totalPages > 1) push(totalPages);

  pager.innerHTML =
    btn('<i class="ti ti-chevron-left"></i>', p - 1, { disabled: p === 1, aria: 'หน้าก่อนหน้า' }) +
    nums.map(n => n === '…'
      ? '<span class="page-gap">…</span>'
      : btn(n, n, { active: n === p })).join('') +
    btn('<i class="ti ti-chevron-right"></i>', p + 1, { disabled: p === totalPages, aria: 'หน้าถัดไป' }) +
    `<span class="page-info">${totalItems} อัลบั้ม</span>`;
}

/* ---------- ไปหน้าที่ระบุ + เลื่อนขึ้นบนสุดของกริด ---------- */
function goToPage(page) {
  state.page = page;
  renderGrid();
  document.querySelector('.toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- เปิดอัลบั้ม (นับยอดชม + เปิดแท็บใหม่) ---------- */
function openAlbum(id, folderId) {
  fetch(`${API_URL}?action=view&id=${id}`).catch(() => {}); // นับยอด ไม่ต้องรอผล
  window.open(folderUrl(folderId), '_blank', 'noopener');
}

/* =====================================================
 *  แชร์ลิงก์เข้าอัลบั้มโดยตรง
 *  ลิงก์รูปแบบ  <โดเมนเว็บ>/?album=<id>
 *  เปิดแล้วจะเลื่อนไปไฮไลต์อัลบั้มนั้นให้อัตโนมัติ (focusFromUrl)
 * ===================================================== */
const albumUrl = id => location.origin + location.pathname + '?album=' + encodeURIComponent(id);

async function shareAlbum(album) {
  const url = albumUrl(album.id);
  const text = `${album.name}${album.date ? ' · ' + thaiDate(album.date) : ''}\nคลังภาพกิจกรรมโรงเรียน`;
  // มือถือ/เบราว์เซอร์ที่รองรับ → เรียกเมนูแชร์ของเครื่อง (LINE, Messenger ฯลฯ)
  if (navigator.share) {
    try { await navigator.share({ title: album.name, text, url }); return; }
    catch (err) { if (err && err.name === 'AbortError') return; } // ผู้ใช้กดยกเลิก
  }
  // ไม่รองรับ → คัดลอกลิงก์ไปคลิปบอร์ด
  try {
    await navigator.clipboard.writeText(url);
    toast('คัดลอกลิงก์อัลบั้มแล้ว');
  } catch (err) {
    window.prompt('คัดลอกลิงก์นี้เพื่อแชร์', url);
  }
}

/* เปิดเว็บด้วยลิงก์ ?album=<id> → เคลียร์ตัวกรอง เลื่อนไปหน้าที่ใช่ แล้วไฮไลต์การ์ด */
function focusFromUrl() {
  const id = new URLSearchParams(location.search).get('album');
  if (!id) return;
  const album = state.albums.find(a => a.id === id);
  if (!album) { toast('ไม่พบอัลบั้มที่แชร์มา', true); return; }

  // เคลียร์ตัวกรอง/ค้นหา ให้แน่ใจว่าอัลบั้มจะแสดง
  state.category = ''; state.year = ''; state.keyword = ''; state.view = 'grid';
  const search = $('#search'); if (search) search.value = '';
  const ys = $('#year-select'); if (ys) ys.value = '';
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.cat === ''));
  $('#btn-grid').classList.add('active'); $('#btn-cal').classList.remove('active');
  $('#btn-grid').setAttribute('aria-selected', 'true');
  $('#btn-cal').setAttribute('aria-selected', 'false');

  // หาว่าอัลบั้มอยู่หน้าไหนของมุมมองกริด
  const list = filtered();
  const idx = list.findIndex(a => a.id === id);
  state.page = idx >= 0 ? Math.floor(idx / PER_PAGE) + 1 : 1;
  render();

  requestAnimationFrame(() => {
    const card = document.querySelector(`.album-card[data-id="${id}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('spotlight');
    setTimeout(() => card.classList.remove('spotlight'), 3200);
  });
}

/* =====================================================
 *  แบนเนอร์รูปเด่นประจำสัปดาห์ (อัลบั้มที่ครูปักหมุด)
 * ===================================================== */
function renderFeatured() {
  const featured = state.albums.filter(a => a.featured);
  const el = $('#featured-banner');
  if (!featured.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `
    <div class="fb-label"><i class="ti ti-star-filled"></i> อัลบั้มแนะนำ</div>
    <div class="fb-track">
      ${featured.map(a => `
        <div class="fb-card" role="button" tabindex="0" data-act="open" data-id="${a.id}"
             data-folder="${a.folderId}" aria-label="เปิดอัลบั้ม ${a.name}">
          <img src="${a.coverIds[0] ? thumb(a.coverIds[0], 800) : ''}" alt="" loading="lazy">
          <div class="fb-info">
            <b>${a.name}</b>
            <span>${thaiDate(a.date) || ''} · ${a.photoCount} รูป</span>
          </div>
        </div>`).join('')}
    </div>`;
}

/* =====================================================
 *  ปุ่มรายการโปรด — เก็บในเครื่อง (localStorage) อย่างเดียว ไม่พึ่งเซิร์ฟเวอร์
 * ===================================================== */
function likedSet() {
  try { return new Set(JSON.parse(localStorage.getItem('gh_liked') || '[]')); }
  catch (err) { return new Set(); }
}
function isLiked(id) { return likedSet().has(id); }

function toggleLike(album, btn) {
  const set = likedSet();
  const liked = set.has(album.id);
  const icon = btn.querySelector('i');
  // สลับสถานะโปรด + อัปเดตไอคอนทันที
  btn.classList.toggle('liked', !liked);
  btn.setAttribute('aria-pressed', String(!liked));
  icon.className = `ti ti-heart${!liked ? '-filled' : ''}`;
  // บันทึกลงเครื่อง
  if (liked) set.delete(album.id); else set.add(album.id);
  localStorage.setItem('gh_liked', JSON.stringify([...set]));
}

/* ===================== มุมมองปฏิทิน ===================== */
function eventsByDate() {
  const map = {};
  filtered().forEach(a => {
    if (!a.date) return;
    (map[a.date] = map[a.date] || []).push(a);
  });
  return map;
}

function renderCalendar() {
  const y = state.calDate.getFullYear();
  const m = state.calDate.getMonth();
  $('#cal-title').textContent = `${THAI_MONTHS[m]} ${y + 543}`;

  const events = eventsByDate();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayIso = isoOf(new Date());

  let html = '';
  for (let i = 0; i < firstDow; i++) html += '<div class="cal-day"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoOf(new Date(y, m, d));
    const list = events[iso] || [];
    const classes = ['cal-day'];
    if (list.length) classes.push('has-event');
    if (iso === todayIso) classes.push('today');
    if (iso === state.selectedDay) classes.push('selected');

    const dots = list.slice(0, 3).map(() => '<span class="dot"></span>').join('') +
                 (list.length > 3 ? '<span class="dot more">+</span>' : '');
    html += `
      <div class="${classes.join(' ')}" ${list.length ? `data-date="${iso}" role="button" tabindex="0"` : ''}
           aria-label="วันที่ ${d}${list.length ? ` มี ${list.length} อัลบั้ม` : ''}">
        <span class="num">${d}</span>
        <div class="dots">${dots}</div>
      </div>`;
  }
  $('#cal-grid').innerHTML = html;
  renderDayPanel(events);
}

function renderDayPanel(events) {
  const panel = $('#day-panel');
  const list = events[state.selectedDay];
  if (!state.selectedDay || !list) {
    panel.innerHTML = `<p class="hint">กดวันที่มีจุดสีเพื่อดูอัลบั้มของวันนั้น</p>`;
    return;
  }
  panel.innerHTML =
    `<h4>อัลบั้มวันที่ ${thaiDate(state.selectedDay)} (${list.length} อัลบั้ม)</h4>` +
    list.map(a => `
      <div class="day-album" role="link" tabindex="0"
           aria-label="เปิดอัลบั้ม ${a.name}" data-act="open" data-id="${a.id}" data-folder="${a.folderId}">
        ${a.coverIds[0] ? `<img src="${thumb(a.coverIds[0], 200)}" alt="" loading="lazy">` : '<img alt="">'}
        <div class="info">
          <b>${a.name}</b>
          <span>${a.category || ''} · ${a.photoCount} รูป</span>
        </div>
        <span class="open-link">เปิด Drive <i class="ti ti-external-link"></i></span>
      </div>`).join('');
}

const isoOf = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* ===================== events ===================== */
document.addEventListener('DOMContentLoaded', () => {
  loadAlbums();

  // ค้นหา
  $('#search').addEventListener('input', e => {
    state.keyword = e.target.value.trim().toLowerCase();
    state.page = 1;
    render();
  });

  // หมวดหมู่
  $('#chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.category = chip.dataset.cat;
    state.page = 1;
    render();
  });

  // ปีการศึกษา
  $('#year-select').addEventListener('change', e => {
    state.year = e.target.value;
    state.page = 1;
    render();
  });

  // เรียงลำดับ
  $('#sort-select').addEventListener('change', e => {
    state.sort = e.target.value;
    state.page = 1;
    render();
  });

  // แบ่งหน้า
  $('#pagination').addEventListener('click', e => {
    const btn = e.target.closest('.page-btn');
    if (btn && !btn.disabled) goToPage(+btn.dataset.page);
  });

  // สลับมุมมอง
  $('#btn-grid').addEventListener('click', () => setView('grid'));
  $('#btn-cal').addEventListener('click', () => setView('cal'));

  // ปฏิทิน: เลื่อนเดือน
  $('#cal-prev').addEventListener('click', () => shiftMonth(-1));
  $('#cal-next').addEventListener('click', () => shiftMonth(1));
  $('#cal-today').addEventListener('click', () => {
    state.calDate = new Date();
    state.selectedDay = '';
    renderCalendar();
  });

  // ปฏิทิน: กดวัน
  $('#cal-grid').addEventListener('click', e => {
    const cell = e.target.closest('[data-date]');
    if (!cell) return;
    state.selectedDay = cell.dataset.date;
    renderCalendar();
  });

  // จัดการปุ่มการ์ด/แผงวัน ผ่าน data-act
  const dispatch = el => {
    const act = el.dataset.act;
    const album = state.albums.find(a => a.id === el.dataset.id);
    if (!album) return;
    if (act === 'open') openAlbum(album.id, album.folderId);
    else if (act === 'like') toggleLike(album, el);
    else if (act === 'share') shareAlbum(album);
  };
  document.body.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el) dispatch(el);
  });
  document.body.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest('[data-act]');
    if (el) { e.preventDefault(); dispatch(el); return; }
    const day = e.target.closest('[data-date]');
    if (day) { state.selectedDay = day.dataset.date; renderCalendar(); }
  });

  // สไลด์ preview ตอน hover การ์ด (เฉพาะการ์ดที่มีรูปมากกว่า 1)
  setupHoverPreview();
});

/* วนรูป preview ตอนเมาส์อยู่บนการ์ด และหยุด/รีเซ็ตเมื่อเมาส์ออก */
function setupHoverPreview() {
  const grid = $('#album-grid');
  let timer = null;

  const stop = card => {
    clearInterval(timer);
    timer = null;
    if (!card) return;
    const slides = card.querySelectorAll('.slide');
    const dots = card.querySelectorAll('.cover-dots span');
    slides.forEach((s, i) => s.classList.toggle('active', i === 0));
    dots.forEach((d, i) => d.classList.toggle('on', i === 0));
  };

  grid.addEventListener('mouseenter', e => {
    const card = e.target.closest('.album-card');
    if (!card || +card.dataset.slides < 2) return;
    const slides = card.querySelectorAll('.slide');
    const dots = card.querySelectorAll('.cover-dots span');
    let i = 0;
    clearInterval(timer);
    timer = setInterval(() => {
      slides[i].classList.remove('active');
      dots[i] && dots[i].classList.remove('on');
      i = (i + 1) % slides.length;
      slides[i].classList.add('active');
      dots[i] && dots[i].classList.add('on');
    }, 900);
  }, true);

  grid.addEventListener('mouseleave', e => {
    const card = e.target.closest('.album-card');
    if (card) stop(card);
  }, true);
}

function setView(v) {
  state.view = v;
  $('#btn-grid').classList.toggle('active', v === 'grid');
  $('#btn-cal').classList.toggle('active', v === 'cal');
  $('#btn-grid').setAttribute('aria-selected', v === 'grid');
  $('#btn-cal').setAttribute('aria-selected', v === 'cal');
  render();
}

function shiftMonth(delta) {
  state.calDate = new Date(state.calDate.getFullYear(), state.calDate.getMonth() + delta, 1);
  state.selectedDay = '';
  renderCalendar();
}
