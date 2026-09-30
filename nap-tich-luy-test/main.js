/* Sự kiện Nạp Tích Lũy — layout landscape-only + state */
(function () {
  "use strict";

  var STAGE_W = 2000, STAGE_H = 1000;
  var viewport = document.getElementById("viewport");
  var stage = document.getElementById("stage");

  /* ------------------------------------------------------------------
     1. Luôn landscape
     - Máy đang cầm dọc → xoay cả #viewport 90° để người chơi xoay ngang máy.
     - Stage 2000×1000 scale "contain" + căn giữa; phần dư dùng lớp .bleed.
     - Android/WebView: thử khoá orientation khi có fullscreen (iOS bỏ qua).
     ------------------------------------------------------------------ */
  function layout() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    if (window.visualViewport) { vw = window.visualViewport.width; vh = window.visualViewport.height; }

    var portrait = vh > vw;
    var W = portrait ? vh : vw;   // chiều ngang "logic" của màn chơi
    var H = portrait ? vw : vh;

    viewport.style.width = W + "px";
    viewport.style.height = H + "px";
    viewport.style.transform = portrait ? "translateX(" + vw + "px) rotate(90deg)" : "none";

    var s = Math.min(W / STAGE_W, H / STAGE_H);
    var x = (W - STAGE_W * s) / 2;
    var y = (H - STAGE_H * s) / 2;
    stage.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
    // nền: vị trí design (-20,0) 2088×1044 theo stage, scale thêm quanh tâm stage nếu chưa phủ kín
    var bw = 2088 * s, bh = 1044 * s, bx = x - 20 * s, by = y;
    var k = Math.max(1, W / bw, H / bh, (W - bx) / bw, (H - by) / bh);
    if (k > 1) {
      var cx = x + STAGE_W * s / 2, cy = y + STAGE_H * s / 2;
      bx = cx - (cx - bx) * k; by = cy - (cy - by) * k;
      bx = Math.min(0, Math.max(W - bw * k, bx)); by = Math.min(0, Math.max(H - bh * k, by));
    }
    bleed.style.transform = "translate(" + bx + "px," + by + "px) scale(" + s * k + ")";

    // Màn còn dư chỗ (rộng hơn / cao hơn 2:1): đẩy 4 nhân vật ra phía góc của chúng,
    // dùng ~70% khoảng dư, tối đa 240px (đơn vị stage) — để UI giữa thoáng hơn
    var ex = Math.min(240, (x / s) * 0.7), ey = Math.min(240, (y / s) * 0.7);
    for (var i = 0; i < CHARS.length; i++) {
      CHARS[i].el.style.transform = "translate(" + CHARS[i].dx * ex + "px," + CHARS[i].dy * ey + "px)";
    }
    // 2 nút góc phải: dạt lên + sang phải theo chỗ dư (80%, tối đa 160px stage)
    var bxOff = Math.min(160, (x / s) * 0.8), byOff = Math.min(160, (y / s) * 0.8);
    btnGroup.style.transform = "translate(" + bxOff + "px," + -byOff + "px)";
  }
  var bleed = document.querySelector(".bleed");
  var btnGroup = document.querySelector(".btn-group");
  var CHARS = [
    { el: document.querySelector(".char-fruitpunch"),   dx: -1, dy: -1 },  // trên-trái
    { el: document.querySelector(".char-baconroll"),    dx:  1, dy: -1 },  // trên-phải
    { el: document.querySelector(".char-icepop"),       dx: -1, dy:  1 },  // dưới-trái
    { el: document.querySelector(".char-blackpudding"), dx:  1, dy:  1 }   // dưới-phải
  ];

  var raf = 0;
  function onResize() { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", function () { setTimeout(layout, 120); });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", onResize);
  layout();

  function tryLockLandscape() {
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req || document.fullscreenElement || document.webkitFullscreenElement) return;
    try {
      var p = req.call(el, { navigationUI: "hide" });
      if (p && p.then) {
        p.then(function () {
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(function () {});
        }).catch(function () {});
      }
    } catch (e) { /* iOS Safari: không hỗ trợ, đã có fallback xoay CSS */ }
  }
  if (/Android/i.test(navigator.userAgent)) {
    document.addEventListener("pointerup", tryLockLandscape, { once: true });
  }

  /* ------------------------------------------------------------------
     2. State — nối API thật vào đây
     ------------------------------------------------------------------ */
  var LEVELS = [0, 20000, 100000, 180000, 250000];
  var state = {
    total: 100000,          // tổng đã nạp (VND)
    claimed: [0, 1],        // các level đã nhận
    endsAt: Date.now() + (8 * 24 + 22) * 3600 * 1000 + 59 * 60 * 1000
  };

  // Level đạt mốc & chưa nhận → hiện nút "Mở khóa" (vị trí nút cố định theo design, cho level 2)
  function render() {
    for (var i = 0; i < LEVELS.length; i++) {
      var reached = state.total >= LEVELS[i];
      var claimed = state.claimed.indexOf(i) !== -1;
      var cls = claimed ? "is-claimed" : (!reached ? "is-locked" : "");
      var nodes = document.querySelectorAll('.level-' + i + ' .status, .progress .node[data-node="' + i + '"]');
      for (var n = 0; n < nodes.length; n++) {
        nodes[n].classList.remove("is-claimed", "is-locked");
        if (cls) nodes[n].classList.add(cls);
      }
    }
    var btn = document.querySelector(".btn-claim");
    var lv = +btn.getAttribute("data-claim");
    var claimable = state.total >= LEVELS[lv] && state.claimed.indexOf(lv) === -1;
    btn.classList.toggle("is-pulse", claimable);
    document.querySelector(".progress").setAttribute("aria-valuenow", state.total);
  }

  // Demo: bấm chỉ có hiệu ứng nhấn, nút giữ nguyên.
  // TODO (bản thật): gọi API nhận quà → state.claimed.push(lv); render();
  document.querySelector(".btn-claim").addEventListener("click", function () {});
  document.getElementById("btn-rules").addEventListener("click", function () { /* TODO: mở popup Thể lệ */ });
  document.getElementById("btn-history").addEventListener("click", function () { /* TODO: mở popup Lịch sử */ });

  /* countdown "Còn 8d 22h" */
  var cdEl = document.getElementById("countdown-value");
  function tick() {
    var ms = Math.max(0, state.endsAt - Date.now());
    var h = Math.floor(ms / 3600000);
    var d = Math.floor(h / 24);
    cdEl.textContent = d > 0 ? d + "d " + (h % 24) + "h" : h + "h " + Math.floor(ms / 60000) % 60 + "m";
  }

  render();
  tick();
  setInterval(tick, 30000);
})();
