/* =====================================================
 *  คลังภาพกิจกรรมโรงเรียน — ฝั่งผู้ใช้ (index.html)
 *  -----------------------------------------------
 *  ★ ตั้งค่าอย่างเดียวที่ต้องแก้: API_URL ด้านล่าง
 * ===================================================== */
const API_URL = 'https://script.google.com/macros/s/AKfycbyCAHt-GZpsoP-NXADVuNwrWp3Yov0DQmAfFvkQcZTqCPbvlMW-NWGsx5Qgb0maucbw/exec'; // เช่น https://script.google.com/macros/s/XXXX/exec

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                     'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

const state = {
  albums: [],          // อัลบั้มทั้งหมดจาก API
  category: '',        // หมวดที่เลือก ('' = ทั้งหมด)
  year: '',            // ปีการศึกษาที่เลือก
  keyword: '',         // คำค้นหา
  view: 'grid',        // grid | cal
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
    $('#view-grid').innerHTML =
      `<div class="empty"><i class="ti ti-plug-x"></i>เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่ภายหลัง</div>`;
    console.error(err);
  }
}

function renderSkeleton() {
  $('#view-grid').innerHTML = Array(8).fill(
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
  if (!list.length) {
    $('#view-grid').innerHTML =
      `<div class="empty"><i class="ti ti-photo-off"></i>ไม่พบอัลบั้มที่ตรงกับเงื่อนไข</div>`;
    return;
  }
  $('#view-grid').innerHTML = list.map(a => `
    <article class="album-card" tabindex="0" role="link"
             aria-label="เปิดอัลบั้ม ${a.name}" data-id="${a.id}" data-folder="${a.folderId}">
      <div class="cover">
        ${a.coverIds[0] ? `<img src="${thumb(a.coverIds[0])}" alt="รูปปก ${a.name}" loading="lazy">` : ''}
        <span class="count-badge">${a.photoCount} รูป</span>
      </div>
      <div class="card-body">
        <h3>${a.name}</h3>
        <div class="card-meta">
          <span><i class="ti ti-calendar"></i> ${thaiDate(a.date) || 'ไม่ระบุวันที่'}</span>
          ${a.category ? `<span class="cat-tag">${a.category}</span>` : ''}
        </div>
        <span class="open-link">เปิดใน Google Drive <i class="ti ti-external-link"></i></span>
      </div>
    </article>`).join('');
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

  // ค้นหาใบหน้า
  $('#btn-face').addEventListener('click', openFaceSearch);
  $('#face-close').addEventListener('click', closeFaceSearch);
  $('#btn-capture').addEventListener('click', captureAndSearch);
  $('#btn-retry').addEventListener('click', () => { showFaceStep('cam'); startCamera(); });

  // ค้นหา
  $('#search').addEventListener('input', e => {
    state.keyword = e.target.value.trim().toLowerCase();
    render();
  });

  // หมวดหมู่
  $('#chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.category = chip.dataset.cat;
    render();
  });

  // ปีการศึกษา
  $('#year-select').addEventListener('change', e => {
    state.year = e.target.value;
    render();
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
});

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

/* =====================================================
 *  ระบบค้นหาใบหน้า (Face Search)
 *  -----------------------------------------------
 *  หลักการ: รูปเซลฟี่ประมวลผลในเครื่องด้วย face-api.js
 *  แล้วเทียบกับ "ดัชนีใบหน้า" ที่ผู้ดูแลสร้างไว้ล่วงหน้า
 *  (ตัวเลข 128 ตัวต่อใบหน้า — ไม่มีการส่งรูปขึ้นระบบ)
 * ===================================================== */
const FACEAPI_JS  = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.min.js';
const MODEL_URL   = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model';
const MATCH_THRESHOLD = 0.6; // ค่าเดิมที่จูนไว้: ระยะต่ำกว่านี้ = คนเดียวกัน

let faceReady = false;
let camStream = null;

/* ---------- โหลด face-api.js + โมเดล แบบ lazy (โหลดเมื่อกดใช้เท่านั้น) ---------- */
async function loadFaceApi() {
  if (faceReady) return;
  if (!window.faceapi) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = FACEAPI_JS;
      s.onload = resolve;
      s.onerror = () => reject(new Error('โหลดไลบรารี AI ไม่สำเร็จ'));
      document.head.appendChild(s);
    });
  }
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]);
  faceReady = true;
}

/* ---------- ควบคุมขั้นตอนใน modal ---------- */
function showFaceStep(step) {
  ['load', 'cam', 'search', 'results'].forEach(s => {
    document.querySelector('#fs-' + s).hidden = (s !== step);
  });
}

async function openFaceSearch() {
  $('#face-modal').hidden = false;
  document.body.style.overflow = 'hidden';
  showFaceStep('load');
  try {
    await loadFaceApi();
    showFaceStep('cam');
    await startCamera();
  } catch (err) {
    closeFaceSearch();
    toast(String(err.message || err), true);
  }
}

function closeFaceSearch() {
  stopCamera();
  $('#face-modal').hidden = true;
  document.body.style.overflow = '';
}

/* ---------- กล้อง (pattern ที่ยืนยันแล้ว: facingMode user + playsinline) ---------- */
async function startCamera() {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 720 } },
      audio: false
    });
    $('#face-video').srcObject = camStream;
  } catch (err) {
    closeFaceSearch();
    if (err.name === 'NotAllowedError') {
      toast('กรุณาอนุญาตให้เว็บใช้กล้องในการตั้งค่าเบราว์เซอร์', true);
    } else if (err.name === 'NotFoundError') {
      toast('ไม่พบกล้องในอุปกรณ์นี้', true);
    } else {
      toast('เปิดกล้องไม่ได้: ' + err.name, true);
    }
  }
}

function stopCamera() {
  if (camStream) {
    camStream.getTracks().forEach(t => t.stop());
    camStream = null;
  }
}

/* ---------- ถ่ายรูป → คำนวณ descriptor → ค้นหา ---------- */
async function captureAndSearch() {
  const video = $('#face-video');
  if (!video.videoWidth) return toast('กล้องยังไม่พร้อม ลองอีกครั้ง', true);

  // วาดภาพจากวิดีโอลง canvas (อยู่ในเครื่องทั้งหมด)
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  stopCamera();

  showFaceStep('search');
  $('#search-status').textContent = 'กำลังวิเคราะห์ใบหน้า…';
  setProgress(0);

  const detection = await faceapi
    .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    showFaceStep('cam');
    startCamera();
    return toast('ไม่พบใบหน้าในภาพ ลองถ่ายใหม่ในที่แสงสว่างกว่านี้', true);
  }

  await searchInIndex(detection.descriptor);
}

/* ---------- เทียบกับดัชนีทีละอัลบั้ม (ตามตัวกรองหมวด/ปีที่เลือกอยู่) ---------- */
async function searchInIndex(myDesc) {
  const targets = state.albums.filter(a =>
    (!state.category || a.category === state.category) &&
    (!state.year || a.year === state.year)
  );

  const matches = [];        // { album, fileId, dist }
  const noIndexAlbums = [];  // อัลบั้มที่ยังไม่มีดัชนี

  for (let i = 0; i < targets.length; i++) {
    const album = targets[i];
    $('#search-status').textContent =
      `กำลังค้นหาในอัลบั้ม "${album.name}" (${i + 1}/${targets.length})`;
    setProgress((i / targets.length) * 100);

    try {
      const res = await fetch(`${API_URL}?action=getFaceIndex&albumId=${album.id}`);
      const data = await res.json();
      if (!data.ok || !data.rows.length) {
        if (album.photoCount > 0) noIndexAlbums.push(album.name);
        continue;
      }
      data.rows.forEach(row => {
        let best = Infinity;
        row.d.forEach(desc => {
          const dist = euclidean(myDesc, desc);
          if (dist < best) best = dist;
        });
        if (best < MATCH_THRESHOLD) matches.push({ album, fileId: row.f, dist: best });
      });
    } catch (err) { /* อัลบั้มนี้โหลดไม่ได้ ข้ามไป */ }
  }

  setProgress(100);
  renderFaceResults(matches, noIndexAlbums, targets.length);
}

function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/* ---------- แสดงผลลัพธ์ จัดกลุ่มตามอัลบั้ม ---------- */
function renderFaceResults(matches, noIndexAlbums, searchedCount) {
  showFaceStep('results');

  if (!matches.length) {
    $('#result-summary').innerHTML =
      `<i class="ti ti-mood-sad"></i> ไม่พบรูปของคุณจาก ${searchedCount} อัลบั้มที่ค้นหา`;
    $('#result-groups').innerHTML = '';
  } else {
    // จัดกลุ่มตามอัลบั้ม เรียงรูปตามความใกล้เคียง
    const groups = {};
    matches.forEach(m => {
      (groups[m.album.id] = groups[m.album.id] || { album: m.album, items: [] }).items.push(m);
    });
    $('#result-summary').innerHTML =
      `<i class="ti ti-check"></i> พบรูปของคุณ ${matches.length} รูป จาก ${Object.keys(groups).length} อัลบั้ม`;
    $('#result-groups').innerHTML = Object.values(groups).map(g => `
      <div class="result-group">
        <h4>${g.album.name}
          <a href="${folderUrl(g.album.folderId)}" target="_blank" rel="noopener">
            เปิดทั้งอัลบั้ม <i class="ti ti-external-link"></i>
          </a>
        </h4>
        <div class="result-grid">
          ${g.items.sort((a, b) => a.dist - b.dist).map(m => `
            <a href="https://drive.google.com/file/d/${m.fileId}/view" target="_blank" rel="noopener">
              <img src="${thumb(m.fileId, 400)}" alt="รูปที่พบใน ${g.album.name}" loading="lazy">
            </a>`).join('')}
        </div>
      </div>`).join('');
  }

  $('#result-note').textContent = noIndexAlbums.length
    ? `หมายเหตุ: อัลบั้ม "${noIndexAlbums.slice(0, 3).join('", "')}"` +
      `${noIndexAlbums.length > 3 ? ` และอีก ${noIndexAlbums.length - 3} อัลบั้ม` : ''}` +
      ` ยังไม่ได้สร้างดัชนีใบหน้า จึงไม่ถูกรวมในการค้นหา`
    : '';
}

function setProgress(pct) {
  $('#search-progress').style.width = pct + '%';
}
