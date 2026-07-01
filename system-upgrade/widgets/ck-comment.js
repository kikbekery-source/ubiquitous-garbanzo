/* ck-comment.js — ปุ่มคอมเมนต์ปักหมุดของโค้ช (ระบบหลังบ้านโค้ชกิ๊ก)
 * ใช้: <script src="/system/widgets/ck-comment.js" defer></script>
 * กติกา (ตาม standards/APPROVAL-STANDARD.md): widget นี้ต้องติดอยู่ทุกหน้า
 * จนกว่าโค้ชจะ Approve ว่าระบบ/หน้านั้นสำเร็จ 100%
 *
 * วิธีใช้: กดปุ่ม 💬 → แตะ/คลิกจุดที่ต้องการ → พิมพ์คอมเมนต์ → เกิดหมุดตัวเลข
 * ใช้ได้ทั้งเมาส์และนิ้ว (มือถือ) · หมุดเกาะกับ "องค์ประกอบ" ที่ถูกชี้
 * (ไม่ใช่ตำแหน่งตายตัวบนหน้า) จึงไม่เพี้ยนเมื่อสลับแท็บ/หมุนจอ/เนื้อหาเปลี่ยนความสูง
 * แท็บของ dashboard (?t / เมนูซ้าย) นับเป็นคนละหน้า — คอมเมนต์แยกชุดกัน
 */
(function () {
  var API = '/system/api/comments-api.php';
  var WHO = 'โค้ช';
  var PAGE = null;
  var comments = []; // {n, sel, ex, ey, x, y, text, who, d, done}
  var mode = false, layer, btn;

  var css = document.createElement('style');
  css.textContent =
    '#ckcbtn{position:fixed;bottom:16px;left:16px;z-index:9990;border:0;border-radius:24px;padding:10px 16px;font-size:13px;font-weight:800;cursor:pointer;background:#e2342f;color:#fff;box-shadow:0 6px 16px #e2342f55}' +
    '#ckcbtn.on{background:#1b8a4e}' +
    'body.ckc-mode{cursor:crosshair!important}' +
    '#ckclayer{position:absolute;top:0;left:0;width:100%;height:0;z-index:9989}' +
    '.ckcpin{position:absolute;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50% 50% 50% 4px;background:#e2342f;color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;cursor:grab;box-shadow:0 3px 10px #0004;border:2px solid #fff;user-select:none;-webkit-user-select:none;touch-action:none}' +
    '.ckcpin.done{background:#1b8a4e}' +
    '.ckcpop{position:absolute;min-width:220px;max-width:300px;background:#fff;border:1px solid #e4e8f1;border-radius:11px;box-shadow:0 10px 28px #1a223633;padding:11px 12px;font-size:13px;z-index:9991;margin-top:8px}' +
    '.ckcpop .m{font-size:10.5px;color:#76819b;margin-bottom:4px}.ckcpop .t{line-height:1.5;color:#1a2236;white-space:pre-wrap}' +
    '.ckcpop .a{display:flex;gap:6px;margin-top:9px}' +
    '.ckcpop .a button{border:1px solid #e4e8f1;background:#f4f6fb;border-radius:7px;padding:6px 10px;font-size:11px;cursor:pointer}';
  document.head.appendChild(css);

  layer = document.createElement('div'); layer.id = 'ckclayer'; document.body.appendChild(layer);
  btn = document.createElement('button'); btn.id = 'ckcbtn'; btn.textContent = '💬 คอมเมนต์';
  btn.onclick = function () { mode = !mode; btn.classList.toggle('on', mode); btn.textContent = mode ? '🎯 แตะจุดที่จะคอมเมนต์ (กดอีกทีเพื่อออก)' : '💬 คอมเมนต์'; document.body.classList.toggle('ckc-mode', mode); };
  document.body.appendChild(btn);

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  function docW() { return document.documentElement.scrollWidth; }
  function docH() { return document.documentElement.scrollHeight; }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  // แท็บของ dashboard เปลี่ยนโดยไม่เปลี่ยน URL — ใช้เมนูที่ active เป็นส่วนหนึ่งของ key หน้า
  function pageKey() {
    var on = document.querySelector('.nav li.on');
    return location.pathname + (on && on.dataset && on.dataset.id ? '#tab=' + on.dataset.id : location.search);
  }

  // หมุดเกาะกับ element: เก็บ CSS path + ตำแหน่ง % ภายใน element นั้น (fallback = % ของทั้งหน้า)
  function cssPath(el) {
    var path = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      var i = 1, s = el;
      while ((s = s.previousElementSibling)) i++;
      path.unshift(el.tagName.toLowerCase() + ':nth-child(' + i + ')');
      el = el.parentElement;
    }
    return 'body>' + path.join('>');
  }

  function setAnchor(c, el, clientX, clientY, pageX, pageY) {
    c.x = pageX / docW() * 100; c.y = pageY / docH() * 100;
    c.sel = null; c.ex = 0; c.ey = 0;
    if (el && el.nodeType === 1 && el !== document.documentElement && el !== document.body
        && !el.closest('#ckclayer') && !el.closest('#ckcbtn')) {
      var r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) {
        c.sel = cssPath(el);
        c.ex = (clientX - r.left) / r.width * 100;
        c.ey = (clientY - r.top) / r.height * 100;
      }
    }
  }

  function pinPos(c) {
    if (c.sel) {
      try {
        var el = document.querySelector(c.sel);
        if (el) {
          var r = el.getBoundingClientRect();
          if (r.width > 0 || r.height > 0) {
            return { left: r.left + window.scrollX + r.width * (c.ex || 0) / 100,
                     top: r.top + window.scrollY + r.height * (c.ey || 0) / 100 };
          }
        }
      } catch (e) { /* selector พัง → ใช้ fallback */ }
    }
    return { left: (c.x || 0) * docW() / 100, top: (c.y || 0) * docH() / 100 };
  }

  function save() {
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: PAGE, comments: comments }) })
      .catch(function () { localStorage.setItem('ckc:' + PAGE, JSON.stringify(comments)); });
  }

  function closePop() { var p = document.querySelector('.ckcpop'); if (p) p.remove(); }

  function openPop(c) {
    closePop();
    var pos = pinPos(c);
    var p = document.createElement('div');
    p.className = 'ckcpop';
    p.style.left = Math.min(pos.left, docW() - 320) + 'px';
    p.style.top = (pos.top + 14) + 'px';
    p.innerHTML = '<div class="m">#' + esc(c.n) + ' · ' + esc(c.who) + ' · ' + esc(c.d) + (c.done ? ' · ✅ เสร็จแล้ว' : '') + '</div>' +
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
      var pos = pinPos(c);
      pin.style.left = pos.left + 'px';
      pin.style.top = pos.top + 'px';
      // Pointer Events = เมาส์+นิ้วมือถือ ทางเดียวกัน · ลาก=ย้าย แตะเฉยๆ=เปิดอ่าน
      pin.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        pin.setPointerCapture(e.pointerId);
        var moved = false, sx = e.clientX, sy = e.clientY;
        function mv(ev) {
          if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 8) moved = true;
          if (!moved) return;
          pin.style.left = ev.pageX + 'px';
          pin.style.top = ev.pageY + 'px';
        }
        function up(ev) {
          pin.removeEventListener('pointermove', mv);
          pin.removeEventListener('pointerup', up);
          pin.removeEventListener('pointercancel', up);
          if (moved) {
            pin.style.pointerEvents = 'none';
            var el = document.elementFromPoint(ev.clientX, ev.clientY);
            pin.style.pointerEvents = '';
            setAnchor(c, el, ev.clientX, ev.clientY, ev.pageX, ev.pageY);
            save(); render();
          } else {
            openPop(c);
          }
        }
        pin.addEventListener('pointermove', mv);
        pin.addEventListener('pointerup', up);
        pin.addEventListener('pointercancel', up);
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
    var c = {
      n: comments.reduce(function (m, o) { return Math.max(m, o.n || 0); }, 0) + 1,
      text: text, who: WHO, done: false,
      d: d.getDate() + '/' + (d.getMonth() + 1) + '/' + (d.getFullYear() + 543) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
    };
    setAnchor(c, e.target, e.clientX, e.clientY, e.pageX, e.pageY);
    comments.push(c);
    save(); render();
  }, true);

  function loadFor(key) {
    PAGE = key;
    fetch(API + '?page=' + encodeURIComponent(key) + '&t=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (d) { if (PAGE !== key) return; comments = d.comments || []; render(); })
      .catch(function () {
        if (PAGE !== key) return;
        try { comments = JSON.parse(localStorage.getItem('ckc:' + key) || '[]'); } catch (e) { comments = []; }
        render();
      });
  }

  // สลับแท็บ (SPA ไม่เปลี่ยน URL) → โหลดคอมเมนต์ชุดของแท็บนั้น · เนื้อหาขยับ → วาดหมุดใหม่
  var onDomChange = debounce(function () {
    var k = pageKey();
    if (k !== PAGE) loadFor(k); else render();
  }, 300);
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      if (!(t.nodeType === 1 && (t.closest && (t.closest('#ckclayer') || t.closest('#ckcbtn'))))) {
        onDomChange();
        return;
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', debounce(render, 250));

  loadFor(pageKey());
})();
