/* ck-comment.js — ปุ่มคอมเมนต์ปักหมุดของโค้ช (ระบบหลังบ้านโค้ชกิ๊ก)
 * ใช้: <script src="/system/widgets/ck-comment.js" defer></script>
 * กติกา (ตาม standards/APPROVAL-STANDARD.md): widget นี้ต้องติดอยู่ทุกหน้า
 * จนกว่าโค้ชจะ Approve ว่าระบบ/หน้านั้นสำเร็จ 100%
 *
 * วิธีใช้: กดปุ่ม 💬 → ชี้แล้วคลิกจุดที่ต้องการ → พิมพ์คอมเมนต์ → เกิดหมุดตัวเลข
 * หมุดลากย้ายตำแหน่งได้ · คลิกหมุดเพื่ออ่าน/ติ๊กเสร็จ/ลบ · เก็บฝั่งเซิร์ฟเวอร์ ทีมเห็นร่วมกัน
 */
(function () {
  var API = '/system/api/comments-api.php';
  var PAGE = location.pathname + location.search;
  var WHO = 'โค้ช';
  var comments = []; // {n,x,y,text,who,d,done}  x,y = เปอร์เซ็นต์ของขนาดเอกสาร (ทนต่อจอไม่เท่ากัน)
  var mode = false, layer, btn;

  var css = document.createElement('style');
  css.textContent =
    '#ckcbtn{position:fixed;bottom:16px;left:16px;z-index:9990;border:0;border-radius:24px;padding:10px 16px;font-size:13px;font-weight:800;cursor:pointer;background:#e2342f;color:#fff;box-shadow:0 6px 16px #e2342f55}' +
    '#ckcbtn.on{background:#1b8a4e}' +
    'body.ckc-mode{cursor:crosshair!important}' +
    '#ckclayer{position:absolute;top:0;left:0;width:100%;height:0;z-index:9989}' +
    '.ckcpin{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50% 50% 50% 4px;background:#e2342f;color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;cursor:grab;box-shadow:0 3px 10px #0004;border:2px solid #fff;user-select:none}' +
    '.ckcpin.done{background:#1b8a4e}' +
    '.ckcpop{position:absolute;min-width:220px;max-width:300px;background:#fff;border:1px solid #e4e8f1;border-radius:11px;box-shadow:0 10px 28px #1a223633;padding:11px 12px;font-size:13px;z-index:9991;margin-top:8px}' +
    '.ckcpop .m{font-size:10.5px;color:#76819b;margin-bottom:4px}.ckcpop .t{line-height:1.5;color:#1a2236;white-space:pre-wrap}' +
    '.ckcpop .a{display:flex;gap:6px;margin-top:9px}' +
    '.ckcpop .a button{border:1px solid #e4e8f1;background:#f4f6fb;border-radius:7px;padding:4px 9px;font-size:11px;cursor:pointer}';
  document.head.appendChild(css);

  layer = document.createElement('div'); layer.id = 'ckclayer'; document.body.appendChild(layer);
  btn = document.createElement('button'); btn.id = 'ckcbtn'; btn.textContent = '💬 คอมเมนต์';
  btn.onclick = function () { mode = !mode; btn.classList.toggle('on', mode); btn.textContent = mode ? '🎯 คลิกจุดที่จะคอมเมนต์ (กดอีกทีเพื่อออก)' : '💬 คอมเมนต์'; document.body.classList.toggle('ckc-mode', mode); };
  document.body.appendChild(btn);

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  function docW() { return document.documentElement.scrollWidth; }
  function docH() { return document.documentElement.scrollHeight; }

  function save() {
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: PAGE, comments: comments }) })
      .catch(function () { localStorage.setItem('ckc:' + PAGE, JSON.stringify(comments)); });
  }

  function closePop() { var p = document.querySelector('.ckcpop'); if (p) p.remove(); }

  function openPop(c, pin) {
    closePop();
    var p = document.createElement('div');
    p.className = 'ckcpop';
    p.style.left = (c.x * docW() / 100) + 'px';
    p.style.top = (c.y * docH() / 100 + 14) + 'px';
    p.innerHTML = '<div class="m">#' + c.n + ' · ' + esc(c.who) + ' · ' + esc(c.d) + (c.done ? ' · ✅ เสร็จแล้ว' : '') + '</div>' +
      '<div class="t">' + esc(c.text) + '</div>' +
      '<div class="a"><button data-a="done">' + (c.done ? '↩️ ยังไม่เสร็จ' : '✅ ทำเสร็จแล้ว') + '</button><button data-a="del">🗑️ ลบ</button><button data-a="x">ปิด</button></div>';
    p.querySelector('[data-a=done]').onclick = function () { c.done = !c.done; save(); render(); };
    p.querySelector('[data-a=del]').onclick = function () { comments = comments.filter(function (o) { return o !== c; }); save(); render(); };
    p.querySelector('[data-a=x]').onclick = closePop;
    layer.appendChild(p);
  }

  function render() {
    closePop();
    layer.querySelectorAll('.ckcpin').forEach(function (el) { el.remove(); });
    comments.forEach(function (c) {
      var pin = document.createElement('div');
      pin.className = 'ckcpin' + (c.done ? ' done' : '');
      pin.textContent = c.n;
      pin.style.left = (c.x * docW() / 100) + 'px';
      pin.style.top = (c.y * docH() / 100) + 'px';
      // ลากย้ายหมุดได้ · ถ้าแค่คลิก (ไม่ลาก) = เปิดอ่าน
      var drag = null;
      pin.addEventListener('mousedown', function (e) {
        e.preventDefault();
        drag = { moved: false };
        function mv(ev) {
          drag.moved = true;
          c.x = Math.min(100, Math.max(0, ev.pageX / docW() * 100));
          c.y = Math.min(100, Math.max(0, ev.pageY / docH() * 100));
          pin.style.left = (c.x * docW() / 100) + 'px';
          pin.style.top = (c.y * docH() / 100) + 'px';
        }
        function up() {
          document.removeEventListener('mousemove', mv);
          document.removeEventListener('mouseup', up);
          if (drag.moved) save(); else openPop(c, pin);
          drag = null;
        }
        document.addEventListener('mousemove', mv);
        document.addEventListener('mouseup', up);
      });
      layer.appendChild(pin);
    });
  }

  document.addEventListener('click', function (e) {
    if (!mode) return;
    if (e.target.closest('#ckcbtn') || e.target.closest('.ckcpin') || e.target.closest('.ckcpop')) return;
    e.preventDefault(); e.stopPropagation();
    var text = prompt('💬 คอมเมนต์จุดนี้ว่าอะไร?');
    if (!text) return;
    var d = new Date();
    comments.push({
      n: comments.reduce(function (m, c) { return Math.max(m, c.n); }, 0) + 1,
      x: e.pageX / docW() * 100, y: e.pageY / docH() * 100,
      text: text, who: WHO,
      d: d.getDate() + '/' + (d.getMonth() + 1) + '/' + (d.getFullYear() + 543) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
      done: false
    });
    save(); render();
  }, true);

  fetch(API + '?page=' + encodeURIComponent(PAGE) + '&t=' + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (d) { comments = d.comments || []; render(); })
    .catch(function () {
      try { comments = JSON.parse(localStorage.getItem('ckc:' + PAGE) || '[]'); } catch (e) { comments = []; }
      render();
    });
})();
