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

/* ---------- โหลดข้อมูล ---------- */
async function loadAlbums() {
  renderSkeleton();
  try {
    const res = await fetch(`${API_URL}?action=getAlbums`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    state.albums = data.albums;
    buildFilters();
    render();
  } catch (err) {
    $('#album-grid').innerHTML =
      `<div class="empty"><i class="ti ti-plug-x"></i>เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่ภายหลัง</div>`;
    $('#pagination').innerHTML = '';
    console.error(err);
  }
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
  return state.albums.filter(a =>
    (!state.category || a.category === state.category) &&
    (!state.year || a.year === state.year) &&
    (!state.keyword || a.name.toLowerCase().includes(state.keyword))
  );
}

/* ---------- render หลัก ---------- */
function render() {
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
    return `
    <article class="album-card" tabindex="0" role="link"
             aria-label="เปิดอัลบั้ม ${a.name}" data-id="${a.id}" data-folder="${a.folderId}"
             data-slides="${previews.length}">
      <div class="cover">
        ${slides || '<div class="cover-empty"><i class="ti ti-photo"></i></div>'}
        <span class="count-badge">${a.photoCount} รูป</span>
        ${dots}
      </div>
      <div class="card-body">
        <h3>${a.name}</h3>
        <div class="card-meta">
          <span><i class="ti ti-calendar"></i> ${thaiDate(a.date) || 'ไม่ระบุวันที่'}</span>
          ${a.category ? `<span class="cat-tag">${a.category}</span>` : ''}
        </div>
        <span class="open-link">เปิดใน Google Drive <i class="ti ti-external-link"></i></span>
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
           aria-label="เปิดอัลบั้ม ${a.name}" data-id="${a.id}" data-folder="${a.folderId}">
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

  // เปิดอัลบั้ม (ทั้งกริดและแผงวัน) — รองรับคีย์บอร์ดด้วย
  document.body.addEventListener('click', e => {
    const el = e.target.closest('[data-folder]');
    if (el) openAlbum(el.dataset.id, el.dataset.folder);
  });
  document.body.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const el = e.target.closest('[data-folder]');
    if (el) openAlbum(el.dataset.id, el.dataset.folder);
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
