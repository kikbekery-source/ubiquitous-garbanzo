/* ck-notify.js — ป๊อปอัพแจ้งเตือนความคืบหน้าห้องงาน (ระบบหลังบ้านโค้ชกิ๊ก)
 * ใช้: <script src="/system/widgets/ck-notify.js" defer></script>
 * อ่านห้องจาก rooms-api.php → เด้ง toast เฉพาะห้องที่มีอัปเดตใหม่และไม่ถูกปิดเสียง
 * ปุ่มบน toast: 📄 รายงานเต็ม (modal+กากบาท) · 🔕 ปิดแจ้งเตือนห้องนี้ (ถาวรฝั่งเซิร์ฟเวอร์) · ✕ ปิดครั้งนี้
 */
(function () {
  var API = '/system/api/rooms-api.php';
  var SEEN_KEY = 'ckNotifySeen'; // {roomId: updated} — จำว่าเห็นอัปเดตรอบไหนแล้ว (ต่อเบราว์เซอร์)

  var css = document.createElement('style');
  css.textContent =
    '#cknbox{position:fixed;bottom:16px;right:16px;z-index:9990;display:flex;flex-direction:column;gap:10px;max-width:340px;font-family:inherit}' +
    '.cknt{background:#fff;border:1px solid #e4e8f1;border-left:4px solid #2563c9;border-radius:12px;box-shadow:0 8px 24px #1a223629;padding:12px 13px;display:flex;gap:11px;animation:cknin .25s}' +
    '@keyframes cknin{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}' +
    '.cknt .hero{width:44px;height:44px;border-radius:50%;flex-shrink:0;object-fit:cover;background:#eef2fb;display:flex;align-items:center;justify-content:center;font-size:24px}' +
    '.cknt .bd{flex:1;min-width:0}.cknt .nm{font-size:13px;font-weight:800;color:#16213f}' +
    '.cknt .st{font-size:11px;color:#2563c9;font-weight:700;margin:1px 0 3px}' +
    '.cknt .ms{font-size:12px;color:#5a6580;line-height:1.45}' +
    '.cknt .acts{display:flex;gap:6px;margin-top:8px}' +
    '.cknt .acts button{border:1px solid #e4e8f1;background:#f4f6fb;border-radius:7px;padding:4px 9px;font-size:11px;cursor:pointer;color:#1a2236}' +
    '.cknt .acts button:hover{background:#eef2fb}' +
    '.cknt .x{border:0;background:none;font-size:15px;cursor:pointer;color:#76819b;height:20px;flex-shrink:0}' +
    '#cknmodal{position:fixed;inset:0;background:#0e1d40cc;z-index:9995;display:flex;align-items:center;justify-content:center;padding:20px}' +
    '#cknmodal .win{background:#fff;border-radius:14px;width:min(860px,100%);height:min(85vh,700px);display:flex;flex-direction:column;overflow:hidden}' +
    '#cknmodal .hd{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #e4e8f1;font-weight:800;font-size:14px;color:#16213f}' +
    '#cknmodal .hd button{margin-left:auto;border:0;background:#f4f6fb;border-radius:8px;width:30px;height:30px;font-size:16px;cursor:pointer}' +
    '#cknmodal iframe{flex:1;border:0;width:100%}';
  document.head.appendChild(css);

  var box = document.createElement('div');
  box.id = 'cknbox';
  document.body.appendChild(box);

  function seen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (e) { return {}; } }
  function markSeen(id, upd) { var s = seen(); s[id] = upd; localStorage.setItem(SEEN_KEY, JSON.stringify(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }

  function openReport(room) {
    var old = document.getElementById('cknmodal');
    if (old) old.remove();
    var m = document.createElement('div');
    m.id = 'cknmodal';
    m.innerHTML = '<div class="win"><div class="hd">' +
      (room.heroImg ? '<img class="hero" style="width:30px;height:30px;border-radius:50%" src="' + esc(room.heroImg) + '">' : '<span>' + esc(room.heroEmoji || '🦸') + '</span>') +
      '<span>' + esc(room.hero || '') + ' — รายงาน: ' + esc(room.name) + '</span>' +
      '<button aria-label="ปิด">✕</button></div>' +
      '<iframe src="' + esc(room.report || 'about:blank') + '"></iframe></div>';
    m.querySelector('button').onclick = function () { m.remove(); };
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    document.body.appendChild(m);
  }

  function toast(room) {
    var t = document.createElement('div');
    t.className = 'cknt';
    if (room.color) t.style.borderLeftColor = room.color;
    t.innerHTML =
      (room.heroImg ? '<img class="hero" src="' + esc(room.heroImg) + '" alt="">' : '<div class="hero">' + esc(room.heroEmoji || '🦸') + '</div>') +
      '<div class="bd"><div class="nm">' + esc(room.hero || 'ทีม') + ' · ' + esc(room.name) + '</div>' +
      '<div class="st">' + esc(room.stage || '') + '</div>' +
      '<div class="ms">' + esc(room.message || room.goal || '') + '</div>' +
      '<div class="acts"><button data-a="report">📄 รายงานเต็ม</button><button data-a="mute">🔕 ปิดแจ้งเตือนห้องนี้</button></div></div>' +
      '<button class="x" aria-label="ปิด">✕</button>';
    t.querySelector('[data-a=report]').onclick = function () { openReport(room); };
    t.querySelector('[data-a=mute]').onclick = function () {
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mute', id: room.id }) });
      markSeen(room.id, room.updated); t.remove();
    };
    t.querySelector('.x').onclick = function () { markSeen(room.id, room.updated); t.remove(); };
    box.appendChild(t);
  }

  fetch(API + '?t=' + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var s = seen();
      (d.rooms || []).forEach(function (room) {
        if (room.muted) return;
        if (s[room.id] === room.updated) return; // เห็นอัปเดตรอบนี้แล้ว
        toast(room);
      });
      window.ckRooms = d.rooms || []; // ให้หน้า dashboard เอาไปวาดตารางห้องได้
      document.dispatchEvent(new CustomEvent('ck-rooms-loaded'));
    })
    .catch(function () { /* โหลดไม่ได้ = ไม่เด้งอะไร */ });
})();
