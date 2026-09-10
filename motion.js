/* =====================================================
 *  motion.js — เอฟเฟกต์เคลื่อนไหวเสริม (เฉพาะ index.html)
 *  -----------------------------------------------------
 *  • ไม่ยุ่งกับตรรกะการทำงานของ app.js เลย
 *  • ทำงานผ่าน event delegation จึงรอดจากการ re-render กริด
 *  • ปิดอัตโนมัติเมื่อผู้ใช้ตั้ง prefers-reduced-motion
 * ===================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
  var root = document.documentElement;

  /* ---------- 1) พารัลแลกซ์พื้นหลังตามเมาส์ ---------- */
  if (!reduce && canHover) {
    var px = 0, py = 0, tx = 0, ty = 0, raf = null;
    window.addEventListener('pointermove', function (e) {
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });

    function loop() {
      tx += (px - tx) * 0.06;
      ty += (py - ty) * 0.06;
      root.style.setProperty('--par-x', (tx * 26).toFixed(2) + 'px');
      root.style.setProperty('--par-y', (ty * 26).toFixed(2) + 'px');
      if (Math.abs(px - tx) > 0.001 || Math.abs(py - ty) > 0.001) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    }
  }

  /* ---------- 2) เอียงการ์ด 3D ตามเมาส์ (delegation) ---------- */
  var grid = document.getElementById('album-grid');
  if (grid && !reduce && canHover) {
    var current = null;
    var MAX = 7; // องศาการเอียงสูงสุด

    grid.addEventListener('pointermove', function (e) {
      var card = e.target.closest ? e.target.closest('.album-card') : null;
      if (!card || card.classList.contains('skeleton')) {
        if (current) resetCard(current);
        current = null;
        return;
      }
      if (card !== current) {
        if (current) resetCard(current);
        current = card;
        card.classList.add('is-tilting');
      }
      var r = card.getBoundingClientRect();
      var cx = (e.clientX - r.left) / r.width - 0.5;
      var cy = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', (cx * MAX).toFixed(2) + 'deg');
      card.style.setProperty('--rx', (-cy * MAX).toFixed(2) + 'deg');
      card.style.setProperty('--mx', ((cx + 0.5) * 100).toFixed(1) + '%');
      card.style.setProperty('--my', ((cy + 0.5) * 100).toFixed(1) + '%');
    }, { passive: true });

    grid.addEventListener('pointerleave', function () {
      if (current) { resetCard(current); current = null; }
    });

    function resetCard(card) {
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    }
  }

  /* ---------- 3) หัวใจเด้ง + วงกระจายตอนกดถูกใจ ---------- */
  if (!reduce) {
    document.body.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-act="like"]') : null;
      if (!btn) return;
      btn.classList.remove('burst');
      void btn.offsetWidth; // รีสตาร์ต animation
      btn.classList.add('burst');
    }, true); // capture: ให้ทำงานก่อน/พร้อมกับ handler ของ app.js

    document.body.addEventListener('animationend', function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('burst')) t.classList.remove('burst');
    });
  }
})();
