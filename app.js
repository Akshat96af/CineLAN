// Cinema. Plain JS, no build step. Edit and refresh.
// Written without optional chaining, ?? or catch-without-binding so older TV browsers (Chromium 6x) can run it.
(function () {
  "use strict";
  var HOST = "192.168.29.117:6789";
  var SVGNS = "http://www.w3.org/2000/svg";

  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode / blocked */ } },
  };
  // Default: the PC over the page's own scheme. If this page is served by server.py itself, loadLibrary() switches to its own origin.
  var BASE = store.get("server") || (location.protocol === "https:" ? "https" : "http") + "://" + HOST;

  // ---- device profile ---------------------------------------------------------
  if (/[?&]tv=1\b/.test(location.search)) store.set("tv", "1");
  if (/[?&]tv=0\b/.test(location.search)) store.set("tv", "0");
  var TV = store.get("tv") === "1" || (store.get("tv") !== "0" &&
    /SMART-TV|SmartTV|Tizen|Web0S|webOS|Android TV|AndroidTV|\bAFT|BRAVIA|CrKey|GoogleTV|HbbTV|NetCast|Roku|Viera|AppleTV|Xbox/i.test(navigator.userAgent));
  var mq = function (q) { return !!(window.matchMedia && matchMedia(q).matches); };
  var FINE = !TV && mq("(hover: hover) and (pointer: fine)");
  var TOUCH = mq("(pointer: coarse)");
  var DPR = Math.min(window.devicePixelRatio || 1, 3);
  var CARD_W = Math.min(960, Math.max(320, Math.ceil(Math.min(innerWidth, 440) * DPR / 160) * 160));   // sharp on phones, small on desktop
  var TILE_W = Math.min(640, Math.max(240, Math.ceil(180 * DPR / 80) * 80));
  document.documentElement.classList.toggle("tv", TV);

  // Windows "Animation effects: off" (and battery saver) report reduced motion, which switches animation off on purpose.
  // Add ?motion=1 to the address to override that once; ?motion=0 restores the default.
  if (/[?&]motion=1\b/.test(location.search)) store.set("motion", "1");
  if (/[?&]motion=0\b/.test(location.search)) store.set("motion", "0");
  var OS_REDUCED = mq("(prefers-reduced-motion: reduce)");
  var REDUCED = OS_REDUCED && store.get("motion") !== "1";
  document.documentElement.classList.toggle("rm", REDUCED);
  var reduced = function () { return REDUCED; };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var enc = function (p) { return p.split("/").map(encodeURIComponent).join("/"); };
  var esc = function (s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var fmt = function (s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, "0");
    return h ? h + ":" + String(m).padStart(2, "0") + ":" + sec : m + ":" + sec;
  };
  var fmtSize = function (b) {
    if (b < 1024) return b + " B";
    var u = ["KB", "MB", "GB", "TB"], i = -1;
    do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
    return b.toFixed(b < 10 ? 1 : 0) + " " + u[i];
  };
  var el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  var setKids = function (node, kids) { node.textContent = ""; for (var i = 0; i < kids.length; i++) node.appendChild(kids[i]); };
  var buzz = function (ms) { if (TOUCH && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* not allowed */ } } };   // light haptic tick on Android
  var langNames = null;
  try { langNames = new Intl.DisplayNames(["en"], { type: "language" }); } catch (e) { /* old browser: show raw code */ }
  var langName = function (c) { if (!c || c === "und") return ""; try { return (langNames && langNames.of(c)) || c; } catch (e) { return c; } };

  // a damped spring for interactive motion (finger-following, flick, settle): calls onUpdate(x) per frame
  function spring(from, to, v0, onUpdate, done) {
    var x = from, v = v0 || 0, last = 0, id = 0, stopped = false, k = 320, c = 30;
    var step = function (t) {
      if (stopped) return;
      var dt = last ? Math.min(0.032, (t - last) / 1000) : 1 / 60; last = t;
      v += (-k * (x - to) - c * v) * dt; x += v * dt;
      if (Math.abs(v) < 4 && Math.abs(x - to) < 0.4) { onUpdate(to); if (done) done(); return; }
      onUpdate(x); id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return function () { stopped = true; cancelAnimationFrame(id); };
  }

  // ---- icons: one family, 24px grid, light stroke ------------------------------
  var ICONS = {
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    fwd: '<path d="M9 5l7 7-7 7"/>',
    back10: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/><text x="12" y="15.3" font-size="7.5" text-anchor="middle" fill="currentColor" stroke="none" font-weight="700">10</text>',
    fwd10: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/><text x="12" y="15.3" font-size="7.5" text-anchor="middle" fill="currentColor" stroke="none" font-weight="700">10</text>',
    vol: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    audio: '<path d="M5 10v4M9 6v12M13 9v6M17 4v16M21 11v2"/>',
    cc: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.2 10.3a2.2 2.2 0 1 0 0 3.4M17 10.3a2.2 2.2 0 1 0 0 3.4"/>',
    chapters: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="3"/>',
    more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    pip: '<rect x="3" y="5" width="18" height="14" rx="3"/><rect x="12" y="11" width="6" height="5" rx="1" fill="currentColor" stroke="none"/>',
    fs: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    next: '<path d="M6 5.5v13l9-6.5z" fill="currentColor" stroke="none"/><path d="M18.5 5v14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    download: '<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 20h14"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
    film: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    zoom: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M11 8.5v5M8.5 11h5"/>',
    restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>',
    home: '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z"/>',
    check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="8.5" y="8.5" width="7" height="7" rx="1.5"/>',
  };
  var ic = function (name) {
    var s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "ic"); s.setAttribute("aria-hidden", "true");
    s.innerHTML = ICONS[name] || "";
    return s;
  };
  var setIc = function (node, name) { setKids(node, [ic(name)]); };
  Array.prototype.slice.call(document.querySelectorAll("[data-ic]")).forEach(function (n) { n.parentNode.replaceChild(ic(n.getAttribute("data-ic")), n); });

  // ---- library --------------------------------------------------------------
  var VIDEO_EXT = ["mp4", "m4v", "mov", "webm", "avi", "wmv", "flv", "mpg", "mpeg", "m2ts", "mts", "3gp", "ogv"];   // mkv is "Movies"
  var NATIVE_VIDEO = ["mp4", "m4v", "mov", "webm", "ogv"];   // everything else plays through the ffmpeg stream
  var IMG_EXT = ["jpg", "jpeg", "jfif", "png", "gif", "webp", "bmp", "avif", "svg", "heic", "heif", "tif", "tiff"];
  var IMG_NATIVE = ["jpg", "jpeg", "jfif", "png", "gif", "webp", "bmp", "avif", "svg"];
  var has = function (list, x) { return list.indexOf(x) >= 0; };

  var files = [], movies = [], videos = [], images = [];
  var libError = "";   // "", "launcher" (https page, plain-http PC), or a message
  var natural = function (a, b) { return a.path.localeCompare(b.path, undefined, { numeric: true }); };
  var extOf = function (n) { var i = n.lastIndexOf("."); return i < 0 ? "" : n.slice(i + 1).toLowerCase(); };
  var thumb = function (m, w) { return BASE + "/api/thumb/" + enc(m.path) + (w ? "?w=" + w : ""); };
  var dlUrl = function (m) { return BASE + "/" + enc(m.path) + "?dl=1"; };

  function toEntry(row) {
    var path = row[0], i = path.lastIndexOf("/"), name = path.slice(i + 1);
    return { path: path, name: name, ext: extOf(name), size: row[1], mtime: row[2], folder: i < 0 ? "" : path.slice(0, i),
      title: name.replace(/\.[^.]+$/, "").replace(/[._]+/g, " ").trim() || name };
  }
  function loadLibrary() {
    var probe = Promise.resolve();
    if (!store.get("server") && location.protocol.indexOf("http") === 0) {   // served by server.py itself (any port)? use its own origin
      probe = fetch("/api/files", { method: "HEAD" }).then(function (r) { if (r.ok) BASE = ""; }, function () { /* keep the default */ });
    }
    return probe.then(function () {
      if (location.protocol === "https:" && BASE.indexOf("http://") === 0) { libError = "launcher"; return; }   // mixed content: browsers block this
      return fetch(BASE + "/api/files").then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).then(function (rows) {
        files = rows.map(toEntry).sort(natural);
        movies = []; videos = []; images = [];
        files.forEach(function (f) {
          if (f.ext === "mkv") { f.cat = "movies"; movies.push(f); }
          else if (has(VIDEO_EXT, f.ext)) { f.cat = "videos"; videos.push(f); }
          else if (has(IMG_EXT, f.ext)) { f.cat = "images"; images.push(f); }
        });
        libError = "";
      }).catch(function () {
        libError = "Check that the PC is on and server.py is running at " + (BASE || location.origin) + ".";
      });
    });
  }

  var SECTIONS = {
    movies: { title: "Movies", icon: "film", unit: ["title", "titles"], list: function () { return movies; }, empty: "No MKV movies in this folder." },
    videos: { title: "Videos", icon: "video", unit: ["video", "videos"], list: function () { return videos; }, empty: "No videos in this folder." },
    images: { title: "Images", icon: "image", unit: ["photo", "photos"], list: function () { return images; }, empty: "No images in this folder." },
    files: { title: "Files", icon: "folder", unit: ["file", "files"], list: function () { return files; }, empty: "This folder is empty." },
  };
  var ORDER = ["movies", "videos", "images", "files"];

  var getProg = function (p) { try { var s = store.get("pos:" + p); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  var resumable = function (g) { return !!g && g.t > 10 && g.t < g.d * 0.95; };

  // ---- toast ----------------------------------------------------------------
  var toastTimer = 0;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3500);
  }

  // ---- ambient light: the room takes on the colour of whatever you point at ---------
  // Two full-screen gradient layers cross-fade by opacity, so this costs the GPU almost nothing.
  var ambLayers = Array.prototype.slice.call(document.querySelectorAll("#amb i"));
  var ambOn = 0, ambKey = "", AMB_DEFAULT = "206 168 112", ambBase = AMB_DEFAULT;
  var ambCache = typeof WeakMap === "function" ? new WeakMap() : null;
  function setAmbient(rgb) {
    rgb = rgb || ambBase;
    if (rgb === ambKey) return;
    ambKey = rgb;
    var next = ambLayers[1 - ambOn], prev = ambLayers[ambOn];
    next.style.setProperty("--c", rgb); next.classList.add("on"); prev.classList.remove("on");
    ambOn = 1 - ambOn;
  }
  function dominant(img) {
    if (ambCache && ambCache.has(img)) return ambCache.get(img);
    var out = null;
    try {
      var c = document.createElement("canvas"); c.width = 16; c.height = 9;
      var g = c.getContext("2d");
      g.drawImage(img, 0, 0, 16, 9);
      var d = g.getImageData(0, 0, 16, 9).data, r = 0, gr = 0, b = 0, w = 0;
      for (var i = 0; i < d.length; i += 4) {   // saturated, brighter pixels count more than flat shadows
        var R = d[i], G = d[i + 1], B = d[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B), sat = mx ? (mx - mn) / mx : 0;
        var wt = 0.1 + sat * sat * 3 + (mx / 255) * 0.4;
        r += R * wt; gr += G * wt; b += B * wt; w += wt;
      }
      r /= w; gr /= w; b /= w;
      var k = clamp(190 / Math.max(r, gr, b, 1), 0.8, 2.2);   // lift dark artwork so the glow is visible
      out = [r, gr, b].map(function (v) { return Math.round(clamp(v * k, 0, 255)); }).join(" ");
    } catch (e) { out = null; /* tainted canvas: stay on the default light */ }
    if (ambCache) ambCache.set(img, out);
    return out;
  }
  function ambientOf(node) {
    var imgs = Array.prototype.slice.call(node.querySelectorAll("img")).filter(function (i) { return i.complete && i.naturalWidth; });
    var img = imgs[Math.min(1, imgs.length - 1)];
    return img ? dominant(img) : null;
  }
  var ambPoint = function (e) { var n = e.target && e.target.closest ? e.target.closest("[data-amb]") : null; setAmbient(n ? ambientOf(n) : null); };
  document.addEventListener("pointerover", ambPoint);
  document.addEventListener("focusin", ambPoint);
  document.documentElement.addEventListener("pointerleave", function () { setAmbient(null); });
  setAmbient(null);

  // ---- overlays share the history stack: phone/TV back buttons close them ----
  var overlay = null, pushed = false;
  function pushOverlay(kind) { overlay = kind; try { history.pushState({ ov: kind }, ""); pushed = true; } catch (e) { pushed = false; } }
  function requestClose() { if (pushed) history.back(); else forceClose(); }
  function forceClose() {
    var k = overlay; overlay = null; pushed = false;
    if (k === "player") doClosePlayer(); else if (k === "lb") doCloseLb();
  }
  // popstate: back/forward and overlays. hashchange: some browsers only fire this for #links. route() skips a hash it already shows.
  var onNav = function () { if (overlay) { pushed = false; forceClose(); } else if (location.hash !== routed) route(); };
  addEventListener("popstate", onNav);
  addEventListener("hashchange", onNav);

  // opening: the poster flies out of its card into the film's frame, holds (with the loader) while the stream starts,
  // then dissolves into the picture. Closing: the current frame shrinks back into the card. Transform + opacity only.
  var liftTimer = 0;
  function videoBox() {   // where the picture sits on screen at "Fit"
    var vEl = $("video"), va = vEl.videoWidth && vEl.videoHeight ? vEl.videoWidth / vEl.videoHeight : 16 / 9, vw = innerWidth, vh = innerHeight, w = vw, h = vw / va;
    if (h > vh) { h = vh; w = vh * va; }
    return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
  }
  function placeLaunch(box) {
    var L = $("launch");
    L.style.left = box.left + "px"; L.style.top = box.top + "px"; L.style.width = box.width + "px"; L.style.height = box.height + "px";
    return L;
  }
  function flipTo(box, r) {   // uniform scale + translate that lays the box over rect r
    var s = Math.max(r.width / box.width, r.height / box.height);
    return { t: "translate3d(" + (r.left + r.width / 2 - (box.left + box.width / 2)) + "px," + (r.top + r.height / 2 - (box.top + box.height / 2)) + "px,0) scale(" + s + ")", s: s };
  }
  function resetLaunch() { var L = $("launch"); clearTimeout(liftTimer); setKids(L, []); L.style.cssText = ""; }
  function launchIn(from) {
    resetLaunch();
    var src = from && from.querySelector ? from.querySelector("img.ok") : null;
    if (!src || reduced() || TV) return;
    var L = placeLaunch(videoBox()), img = new Image(), f = flipTo(videoBox(), from.getBoundingClientRect());
    img.alt = ""; img.src = src.currentSrc || src.src; L.appendChild(img);
    L.style.transition = "none"; L.style.opacity = "1"; L.style.transform = f.t; L.style.borderRadius = (22 / f.s) + "px";
    L.getBoundingClientRect();
    L.style.transition = "transform .95s var(--spring), border-radius .95s var(--spring)";
    L.style.transform = "none"; L.style.borderRadius = "0px";
    liftTimer = setTimeout(launchDone, 8000);   // never hold the poster forever
  }
  function launchDone() {
    var L = $("launch");
    if (!L.firstChild) return;
    clearTimeout(liftTimer);
    L.style.transition = (L.style.transition ? L.style.transition + ", " : "") + "opacity .9s var(--ease) .15s";
    L.style.opacity = "0";
    liftTimer = setTimeout(function () { setKids(L, []); }, 1100);
  }
  function launchOut(to, done) {
    resetLaunch();
    if (!to || !to.isConnected || reduced() || TV) return done();
    var box = videoBox(), c = document.createElement("canvas");
    c.width = 640; c.height = Math.round(640 * box.height / box.width);
    try { c.getContext("2d").drawImage(video, 0, 0, c.width, c.height); } catch (e) { /* no frame yet: a dark plate shrinks instead */ }
    var L = placeLaunch(box);
    L.appendChild(c);
    L.style.transition = "none"; L.style.opacity = "1";
    playerEl.classList.add("closing");   // picture and controls fade, the lights come back up
    L.getBoundingClientRect();
    var f = flipTo(box, to.getBoundingClientRect());
    L.style.transition = "transform .7s var(--ease-ios), border-radius .7s var(--ease-ios), opacity .35s var(--ease) .5s";
    L.style.transform = f.t; L.style.borderRadius = (22 / f.s) + "px"; L.style.opacity = "0";
    setTimeout(done, 860);
  }

  // ===========================================================================
  // PLAYER
  // ===========================================================================
  var EMPTY = { duration: 0, audio: [], subs: [], side: [], chapters: [] };
  var video = $("video"), playerEl = $("player"), seekEl = $("seek"), cap = $("cap"), menuEl = $("menu");
  var cur = null, playerFrom = null;
  var tr = EMPTY;          // tracks of the current movie
  var conv = false;        // playing through /stream (non-native format, multi-audio, burned subs)
  var off = 0;             // stream start offset: converted streams restart at an offset to seek
  var compat = false;      // also re-encode video (HEVC / 10-bit)
  var audioSel = 0;
  var burn = null;         // image-subtitle track burned into the picture
  var sub = { kind: "off" };
  var cues = [], subDelay = 0, subSize = 1, subToken = 0;
  var loopA = null, loopB = null, loopHold = 0;
  var dragging = false, lastSave = 0, lastPos = 0;

  var extConv = function (m) { return !has(NATIVE_VIDEO, m.ext); };
  var needConv = function () { return !!cur && (extConv(cur) || tr.audio.length > 1 || burn !== null); };
  var duration = function () { return conv ? tr.duration : (isFinite(video.duration) ? video.duration : 0); };
  var now = function () { return off + video.currentTime; };

  function load(t) {
    if (!cur) return;
    conv = needConv();
    off = conv ? t : 0;
    var p = enc(cur.path), url = BASE + "/" + p;
    if (conv) {
      url = BASE + "/stream/" + p + "?t=" + t + "&a=" + audioSel;
      if (compat) url += "&v=1";
      if (burn !== null) url += "&bs=" + burn;
    }
    video.src = url;
    video.playbackRate = video.defaultPlaybackRate;   // a new src would otherwise reset the speed
    if (!conv && t > 0) {   // removes itself: older TV browsers ignore { once: true }
      var resumeAt = function () { video.removeEventListener("loadedmetadata", resumeAt); video.currentTime = t; };
      video.addEventListener("loadedmetadata", resumeAt);
    }
    $("spinner").hidden = false;
    $("compat").hidden = !conv;
    var pr = video.play();
    if (pr && pr.catch) pr.catch(function () { /* autoplay blocked: user presses play */ });
  }

  function seekTo(t) {
    if (!cur) return;
    var d = duration();
    t = Math.max(0, d ? Math.min(t, d) : t);
    if (!conv) { video.currentTime = t; return; }
    var r = t - off;   // inside what's already downloaded? seek natively, else restart the stream there
    for (var i = 0; i < video.buffered.length; i++) {
      if (r >= video.buffered.start(i) && r < video.buffered.end(i) - 1) { video.currentTime = r; return; }
    }
    load(t);
  }
  // repeated nudges (held arrow keys, double taps) collapse into one seek, so a converted stream restarts once
  var nudgeTo = null, nudgeTimer = 0;
  function nudge(sec) {
    if (!cur) return;
    var d = duration();
    nudgeTo = clamp((nudgeTo === null ? now() : nudgeTo) + sec, 0, d || Infinity);
    paint(nudgeTo);
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(function () { var t = nudgeTo; nudgeTo = null; seekTo(t); }, 320);
  }

  function openMovie(m, from) {
    if (!overlay) {
      pushOverlay("player");
      playerFrom = from || null;
      playerEl.classList.remove("live", "closing", "open");
      playerEl.hidden = false;
      document.body.classList.add("noscroll");
      void playerEl.offsetWidth; playerEl.classList.add("open");
      pinchK = 1;
      launchIn(playerFrom);
    }
    cur = m; tr = EMPTY; compat = false; burn = null; off = 0; cues = []; sub = { kind: "off" }; loopA = loopB = null;
    $("ptitle").textContent = m.title;
    var tc = $("tcard");   // title card: fades up over the picture, then lifts away
    tc.firstElementChild.textContent = m.title; tc.classList.remove("play"); void tc.offsetWidth;
    if (!reduced()) tc.classList.add("play");
    $("compat").classList.remove("on");
    hideMenu(); renderCue(true);
    $("next").hidden = !nextOf(m);
    mediaSession(m);
    chips();
    return fetch(BASE + "/api/tracks/" + enc(m.path)).then(function (r) { return r.ok ? r.json() : EMPTY; }, function () { return EMPTY; })
      .then(function (t) {
        if (cur !== m) return;   // user picked something else meanwhile
        tr = t || EMPTY;
        $("audio").hidden = tr.audio.length < 2;
        $("chap").hidden = !tr.chapters.length;
        audioSel = pickAudio();
        var g = getProg(m.path);
        selectSub(autoSub(), false);   // sets `burn` synchronously, so the first load already has it
        chips();
        load(resumable(g) ? g.t : 0);
        wake();
        if (TV) setTimeout(function () { if (cur === m) $("play").focus(); }, 400);   // remote users land on the controls
      });
  }

  function doClosePlayer() {
    save(true);
    video.pause();
    cur = null; cues = []; renderCue(true); hideMenu(); glow(false);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () { /* ignore */ });
    document.body.classList.remove("noscroll");
    launchOut(playerFrom, function () {
      playerEl.hidden = true; playerEl.classList.remove("closing", "live", "open"); resetLaunch();
      video.removeAttribute("src"); video.load(); refreshSection();
      if (playerFrom && playerFrom.isConnected && TV) { var c = playerFrom.closest(".card, a, button"); if (c) c.focus(); }
    });
  }

  function nextOf(m) {
    var sib = (m.cat === "movies" ? movies : videos).filter(function (x) { return x.folder === m.folder; });
    return sib[sib.indexOf(m) + 1];
  }
  function playNext() { var n = cur && nextOf(cur); if (n) { save(true); openMovie(n); toast("Now playing: " + n.title); } }

  function save(force) {
    if (!cur) return;
    var d = duration();
    if (!d || (!force && Date.now() - lastSave < 5000)) return;
    lastSave = Date.now();
    store.set("pos:" + cur.path, JSON.stringify({ t: now(), d: d, at: Date.now() }));
  }

  // lock-screen / notification controls on Android, media keys on desktop
  function mediaSession(m) {
    if (!("mediaSession" in navigator)) return;
    var ms = navigator.mediaSession;
    try { ms.metadata = new MediaMetadata({ title: m.title, artist: "Cinema", artwork: [{ src: new URL(thumb(m, 512), location.href).href, sizes: "512x288", type: "image/jpeg" }] }); }
    catch (e) { /* MediaMetadata missing */ }
    var set = function (a, f) { try { ms.setActionHandler(a, f); } catch (e) { /* action not supported */ } };
    set("play", function () { video.play(); });
    set("pause", function () { video.pause(); });
    set("seekbackward", function (d) { nudge(-(d && d.seekOffset || 10)); });
    set("seekforward", function (d) { nudge(d && d.seekOffset || 10); });
    set("seekto", function (d) { if (d && d.seekTime != null) seekTo(d.seekTime); });
    set("nexttrack", nextOf(m) ? playNext : null);
  }

  // ---- audio ----------------------------------------------------------------
  var audioParts = function (a) {
    var ch = a.ch === 6 ? "5.1" : a.ch === 8 ? "7.1" : a.ch === 2 ? "stereo" : a.ch === 1 ? "mono" : "";
    return [[langName(a.lang) || "Track " + (a.i + 1), a.title].filter(Boolean).join(", "), [a.codec.toUpperCase(), ch].filter(Boolean).join(" ")];
  };
  function pickAudio() {
    var pref = store.get("alang"), i = -1;
    tr.audio.forEach(function (a, j) { if (i < 0 && pref && a.lang === pref) i = j; });
    if (i < 0) tr.audio.forEach(function (a, j) { if (i < 0 && a.default) i = j; });
    return Math.max(0, i);
  }
  function setAudio(a) {
    audioSel = a.i; store.set("alang", a.lang);
    toast("Audio: " + audioParts(a)[0]);
    load(now());   // the stream restarts at the current position with the new track
    refreshMenu(); chips();
  }
  function cycleAudio() {
    if (tr.audio.length < 2) return toast("Only one audio track");
    setAudio(tr.audio[(audioSel + 1) % tr.audio.length]);
  }

  // ---- subtitles (own renderer: cues are in movie time, so delay + stream offsets just work) ----
  var subLabel = function (s) { return [langName(s.lang) || "Track " + (s.i + 1), s.title].filter(Boolean).join(", "); };
  var TIME = "(?:(\\d+):)?(\\d+):(\\d+)[.,](\\d+)";
  var TIMING = new RegExp("^\\s*" + TIME + "\\s*-->\\s*" + TIME);
  var secs = function (h, m, s, ms) { return (+h || 0) * 3600 + +m * 60 + +s + +ms.padEnd(3, "0").slice(0, 3) / 1000; };

  function cueHtml(text) {
    return esc(text.replace(/\{\\[^}]*\}/g, ""))                 // ASS override blocks
      .replace(/&lt;(\/?)(i|b|u)&gt;/gi, "<$1$2>")              // keep only these tags
      .replace(/&lt;\/?[\w.:\-\s]*&gt;/g, "")                   // drop <c.x>, <00:01.000>, <font ...>
      .replace(/\n/g, "<br>");
  }
  function parseCues(text) {
    var out = [];
    text.replace(/\r/g, "").split(/\n{2,}/).forEach(function (block) {
      var lines = block.split("\n"), k = -1;
      for (var i = 0; i < Math.min(2, lines.length); i++) if (TIMING.test(lines[i])) { k = i; break; }
      if (k < 0) return;
      var m = TIMING.exec(lines[k]), body = lines.slice(k + 1).join("\n").trim();
      if (body) out.push({ s: secs(m[1], m[2], m[3], m[4]), e: secs(m[5], m[6], m[7], m[8]), html: cueHtml(body) });
    });
    return out.sort(function (a, b) { return a.s - b.s; });
  }

  var capKey = "";
  function renderCue(force) {
    var t = now() - subDelay, act = [];
    if (cur) for (var i = 0; i < cues.length; i++) if (cues[i].s <= t && t < cues[i].e) act.push(cues[i].html);
    var key = act.join("<br>");
    if (key === capKey && !force) return;
    capKey = key;
    cap.innerHTML = key;   // every piece went through cueHtml, which escapes everything but i/b/u
    cap.hidden = !act.length;
  }
  var textSubs = function () {
    return [{ kind: "off" }]
      .concat(tr.subs.filter(function (s) { return !s.image; }).map(function (s) { return { kind: "emb", i: s.i, lang: s.lang, label: subLabel(s) }; }))
      .concat(tr.side.map(function (p) { return { kind: "side", path: p, label: p.split("/").pop() }; }));
  };
  var sameSub = function (a, b) { return a.kind === b.kind && a.i === b.i && a.path === b.path && a.name === b.name; };

  function autoSub() {
    var pref = store.get("slang");
    if (!pref || pref === "off") return { kind: "off" };
    var hit = textSubs().filter(function (s) { return s.lang === pref; })[0];
    return hit || { kind: "off" };
  }

  function selectSub(s, reload) {
    if (reload === undefined) reload = true;
    var tok = ++subToken;
    sub = s; cues = []; renderCue(true);
    var prevBurn = burn;
    burn = s.kind === "emb" && s.image ? s.i : null;
    if (reload && cur && burn !== prevBurn) load(now());   // burning in / out restarts the stream
    if (reload) store.set("slang", s.kind === "off" ? "off" : (s.lang || ""));
    if (s.kind === "off") { if (reload) toast("Subtitles off"); }
    else if (burn !== null) { if (reload) toast("Image subtitles: re-encoding video"); }
    else if (s.kind === "file") { cues = parseCues(s.text); if (reload) toast("Subtitles: " + s.label); }
    else {
      var url = s.kind === "emb" ? BASE + "/api/sub/" + enc(cur.path) + "?s=" + s.i : BASE + "/api/sub/" + enc(s.path);
      if (reload) toast("Loading subtitles…");
      fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
        .then(function (text) {
          if (tok !== subToken) return;   // user already picked another track
          cues = parseCues(text);
          if (reload) toast(cues.length ? "Subtitles: " + s.label : "No readable subtitles in that track");
          refreshMenu();
        })
        .catch(function () { if (tok === subToken) toast("Could not load subtitles"); });
    }
    refreshMenu(); chips();
  }
  function cycleSub() {
    var l = textSubs(), i = 0;
    l.forEach(function (s, j) { if (sameSub(s, sub)) i = j; });
    selectSub(l[(i + 1) % l.length]);
  }
  function setDelay(d) { subDelay = Math.round(d * 100) / 100; renderCue(true); }
  var delayText = function () { return (subDelay >= 0 ? "+" : "") + subDelay.toFixed(2) + " s"; };
  function setSize(z) { subSize = clamp(Math.round(z * 10) / 10, 0.5, 3); cap.style.setProperty("--sz", subSize); }

  $("subfile").onchange = function (e) {
    var f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { selectSub({ kind: "file", name: f.name, label: f.name, text: String(rd.result) }); };
    rd.readAsText(f);
  };

  // ---- player menus -----------------------------------------------------------
  var item = function (label, on, fn, note) {
    var b = el("button", "mi" + (on ? " on" : ""));
    var ck = el("span", "ck");
    if (on) ck.appendChild(ic("check"));   // drawn on with a stroke animation
    b.appendChild(ck); b.appendChild(el("span", "lbl", label));
    if (note) b.appendChild(el("small", "", note));
    b.onclick = fn;
    return b;
  };
  var head = function (t) { return el("div", "mh", t); };
  var adj = function (label, get, dec, inc) {
    var row = el("div", "adj"), v = el("span", "val", get());
    var mk = function (t, f) { var b = el("button", "", t); b.onclick = function () { f(); v.textContent = get(); }; return b; };
    row.appendChild(el("span", "lbl", label)); row.appendChild(mk("−", dec)); row.appendChild(v); row.appendChild(mk("+", inc));
    return row;
  };
  var ZOOMS = [["fit", "Fit", "whole picture"], ["immersive", "Immersive", "bars halved"], ["fill", "Fill screen", "no bars, edges cropped"], ["stretch", "Stretch", "distorts"]];
  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  var MENUS = {
    audio: function () {
      return [head("Audio track")].concat(tr.audio.map(function (a) { var p = audioParts(a); return item(p[0], a.i === audioSel, function () { setAudio(a); }, p[1]); }));
    },
    subs: function () {
      return [head("Subtitles"), item("Off", sub.kind === "off", function () { selectSub({ kind: "off" }); })]
        .concat(tr.subs.map(function (s) {
          var o = { kind: "emb", i: s.i, image: s.image, lang: s.lang, label: subLabel(s) };
          return item(subLabel(s), sub.kind === "emb" && sub.i === s.i, function () { selectSub(o); }, s.image ? "image, re-encodes video" : s.codec);
        }))
        .concat(tr.side.map(function (p) {
          var name = p.split("/").pop();
          return item(name, sub.kind === "side" && sub.path === p, function () { selectSub({ kind: "side", path: p, label: name }); });
        }))
        .concat([item("Load from this device", false, function () { $("subfile").click(); }, ".srt .vtt"),
          adj("Delay", delayText, function () { setDelay(subDelay - 0.1); }, function () { setDelay(subDelay + 0.1); }),
          adj("Size", function () { return Math.round(subSize * 100) + "%"; }, function () { setSize(subSize - 0.1); }, function () { setSize(subSize + 0.1); })]);
    },
    chap: function () {
      var t = now(), idx = 0;
      tr.chapters.forEach(function (c, i) { if (c.start <= t + 0.5) idx = i; });
      return [head("Chapters")].concat(tr.chapters.map(function (c, i) {
        return item(c.title || "Chapter " + (i + 1), i === idx, function () { seekTo(c.start); hideMenu(); }, fmt(c.start));
      }));
    },
    zoom: function () {
      return [head("Zoom")]
        .concat(ZOOMS.map(function (z) { return item(z[1], zoomMode === z[0], function () { setZoom(z[0]); refreshMenu(); }, z[2]); }))
        .concat([head("Ambient light"), item(ambLabel(), false, function () { openMenu("amb"); }, "styles, presets, custom")]);
    },
    amb: function () {
      var rows = [head("Ambient light")], pct = function (v) { return Math.round(v * 100) + "%"; };
      AMB_ORDER.forEach(function (p) {
        var P = p === "off" ? { label: "Off", note: "" } : p === "custom" ? { label: "Custom", note: "your own settings" } : AMB[p];
        rows.push(item(P.label, ambPreset === p, function () { setAmbPreset(p); refreshMenu(); }, P.note));
      });
      if (ambCfg()) {
        var row = function (label, key, show) { return adj(label, function () { return show(ambCfg()[key]); }, function () { tweak(key, -1); }, function () { tweak(key, 1); }); };
        rows.push(head("Customize"));
        rows.push(item("Style", false, function () {
          var ks = Object.keys(MODES), i = ks.indexOf(ambCfg().mode);
          tweak("mode", ks[(i + 1) % ks.length]); refreshMenu();
        }, MODES[ambCfg().mode]));
        rows.push(row("Intensity", "k", pct));
        rows.push(row("Softness", "blur", function (v) { return v + "px"; }));
        rows.push(row("Colour", "sat", pct));
        if (ambCfg().mode === "glow") rows.push(row("Size", "size", pct));
        rows.push(row("Follow speed", "follow", pct));
      }
      rows.push(item("Back to zoom", false, function () { openMenu("zoom"); }));
      return rows;
    },
    more: function () {
      return [head("Speed")]
        .concat(SPEEDS.map(function (s) { return item(s + "×", video.playbackRate === s, function () { setSpeed(s); refreshMenu(); }); }))
        .concat([head("A-B loop"), item(loopA === null ? "Set A (start)" : loopB === null ? "Set B (end)" : "Clear loop", loopA !== null,
          function () { cycleLoop(); refreshMenu(); }, loopA === null ? "" : fmt(loopA) + (loopB === null ? "" : " to " + fmt(loopB)))]);
    },
  };
  var menuKind = null;
  function hideMenu() { menuKind = null; menuEl.hidden = true; }
  function openMenu(kind, refresh) {
    if (!refresh && menuKind === kind) return hideMenu();
    menuKind = kind;
    setKids(menuEl, MENUS[kind]());
    menuEl.hidden = false;
    if (!refresh && (TV || !FINE)) { var first = menuEl.querySelector(".mi.on") || menuEl.querySelector("button"); if (first) first.focus({ preventScroll: true }); }
  }
  function refreshMenu() {
    if (!menuKind) return;
    var focusedIdx = Array.prototype.indexOf.call(menuEl.querySelectorAll("button"), document.activeElement);
    openMenu(menuKind, true);
    var btns = menuEl.querySelectorAll("button");
    if (focusedIdx >= 0 && btns[focusedIdx]) btns[focusedIdx].focus({ preventScroll: true });   // keep the remote's place
  }
  ["audio", "subs", "chap", "zoom", "more"].forEach(function (k) { $(k).onclick = function () { openMenu(k); }; });
  document.addEventListener("pointerdown", function (e) {
    if (menuKind && !menuEl.contains(e.target) && !e.target.closest(".mbtn")) hideMenu();
  });

  // ---- misc controls --------------------------------------------------------
  function setSpeed(n) { video.defaultPlaybackRate = n; video.playbackRate = n; $("speed").textContent = n + "×"; }
  function stepSpeed(d) {
    var i = clamp(SPEEDS.indexOf(video.playbackRate) + d, 0, SPEEDS.length - 1);
    setSpeed(SPEEDS[i]); toast("Speed " + SPEEDS[i] + "×");
  }
  function cycleLoop() {
    if (loopA === null) { loopA = now(); toast("Loop start set. Press O again for the end."); }
    else if (loopB === null) {
      if (now() - loopA < 1) return toast("Pick an end point later than the start");
      loopB = now(); toast("Looping A-B"); loopHold = 0;
    } else { loopA = loopB = null; toast("Loop cleared"); }
  }
  // zoom: Immersive halves the black bars of a non-IMAX film, Fill removes them; pinch adds a free zoom on top
  var zoomMode = store.get("zoom") || "fit", pinchK = 1;
  function zoomScale() {
    var va = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9, sa = innerWidth / innerHeight;
    var fill = va > sa ? va / sa : sa / va;
    return zoomMode === "fill" ? fill : zoomMode === "immersive" ? 1 + (fill - 1) * 0.5 : 1;
  }
  function applyZoom() {
    video.style.objectFit = zoomMode === "stretch" ? "fill" : "contain";
    var k = (zoomMode === "stretch" ? 1 : zoomScale()) * pinchK;
    video.style.transform = k > 1.001 ? "scale(" + k.toFixed(4) + ")" : "";
  }
  function setZoom(mode) {
    zoomMode = mode; pinchK = 1; store.set("zoom", mode); applyZoom();
    var z = ZOOMS.filter(function (x) { return x[0] === mode; })[0];
    toast("Zoom: " + (z ? z[1] : mode));
  }
  function cycleAspect() {
    var i = 0;
    ZOOMS.forEach(function (z, j) { if (z[0] === zoomMode) i = j; });
    setZoom(ZOOMS[(i + 1) % ZOOMS.length][0]);
  }
  video.addEventListener("loadedmetadata", applyZoom);
  addEventListener("resize", function () { if (cur) applyZoom(); });

  var ratioOf = function (t, d) { return d ? clamp(t / d, 0, 1) : 0; };
  function paint(t) {
    var d = duration(), r = ratioOf(t, d);
    $("played").style.transform = "scaleX(" + r + ")";   // scale, never width: stays on the compositor
    $("knob").style.setProperty("--kx", r * seekEl.clientWidth + "px");
    $("tcur").textContent = fmt(t);
    $("tleft").textContent = d ? "−" + fmt(Math.max(0, d - t)) : "0:00";
  }
  function tick() {
    if (dragging || nudgeTo !== null) return;
    var d = duration(), be = 0;
    paint(now());
    for (var i = 0; i < video.buffered.length; i++) {
      if (video.currentTime >= video.buffered.start(i) - 0.1 && video.currentTime <= video.buffered.end(i) + 0.5) be = video.buffered.end(i);
    }
    $("buf").style.transform = "scaleX(" + ratioOf(off + be, d) + ")";
    save();
    if (d && "mediaSession" in navigator && navigator.mediaSession.setPositionState && Date.now() - lastPos > 1000) {
      lastPos = Date.now();
      try { navigator.mediaSession.setPositionState({ duration: d, position: clamp(now(), 0, d), playbackRate: video.playbackRate || 1 }); } catch (e) { /* ignore */ }
    }
  }
  // per-frame: subtitles and the A-B loop need finer timing than timeupdate's ~4 Hz (only does work while a movie is open)
  function frame() {
    if (cur) {
      renderCue(false);
      if (loopB !== null && performance.now() > loopHold && now() >= loopB) { loopHold = performance.now() + 800; seekTo(loopA); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ambient light: the film lights the room around it. Three styles, presets on top, and a Custom set you tune yourself.
  //   glow   - the whole frame, tiny and heavily blurred, spills past the picture
  //   mirror - the frame's edges reflected into the black bars, softened and fading toward the screen edge
  //   edge   - only the colours along the edges, like a backlit TV (calm, no picture detail)
  // Each new frame is blended over the last ("follow"), so the light moves smoothly instead of flickering.
  var glowEl = $("glow"), glowCtx = glowEl.getContext ? glowEl.getContext("2d") : null, glowRun = false, glowLast = 0, glowTok = 0;
  var mirA = $("mirA"), mirB = $("mirB"), mcA = mirA.firstElementChild, mcB = mirB.firstElementChild;
  var mxA = mcA.getContext ? mcA.getContext("2d") : null, mxB = mcB.getContext ? mcB.getContext("2d") : null;
  var sampler = document.createElement("canvas"); sampler.width = 24; sampler.height = 14;
  var sx = sampler.getContext ? sampler.getContext("2d") : null;
  var AMB = {
    spill: { label: "Spill", note: "the film's light fills the room", mode: "glow", k: 0.9, blur: 56, sat: 1.45, size: 1.24, follow: 0.35 },
    mirror: { label: "Mirror", note: "edges reflected into the bars", mode: "mirror", k: 0.85, blur: 24, sat: 1.2, size: 1, follow: 0.6 },
    edge: { label: "Edge", note: "edge colours, like a backlit TV", mode: "edge", k: 0.9, blur: 40, sat: 1.5, size: 1, follow: 0.25 },
    theatre: { label: "Theatre", note: "a dim, wide wash", mode: "glow", k: 0.5, blur: 96, sat: 1.05, size: 1.32, follow: 0.2 },
    vivid: { label: "Vivid", note: "bold colour, tight spill", mode: "glow", k: 1, blur: 40, sat: 1.9, size: 1.16, follow: 0.5 },
  };
  var AMB_ORDER = ["off", "spill", "mirror", "edge", "theatre", "vivid", "custom"];
  var MODES = { glow: "Glow", mirror: "Mirror", edge: "Edge" };
  var LIM = { k: [0.1, 1, 0.1], blur: [0, 140, 8], sat: [0.5, 2.5, 0.1], size: [1, 1.5, 0.04], follow: [0.1, 1, 0.1] };   // min, max, step
  function copyCfg(c) { return { mode: c.mode, k: c.k, blur: c.blur, sat: c.sat, size: c.size, follow: c.follow }; }
  var ambPreset = store.get("ambp") || (store.get("ambient") === "0" ? "off" : "spill");
  if (ambPreset !== "off" && ambPreset !== "custom" && !AMB[ambPreset]) ambPreset = "spill";
  var ambCustom = null;
  try { ambCustom = JSON.parse(store.get("ambc") || "null"); } catch (e) { ambCustom = null; }
  if (!ambCustom || !MODES[ambCustom.mode]) ambCustom = copyCfg(AMB.spill);
  var GLOW_OK = false, ambLay = null, edgeA = null, edgeB = null;

  function ambCfg() { return ambPreset === "off" ? null : ambPreset === "custom" ? ambCustom : AMB[ambPreset]; }
  var ambLabel = function () { return ambPreset === "off" ? "Off" : ambPreset === "custom" ? "Custom" : AMB[ambPreset].label; };

  function layoutAmb() {   // where the black bars are, after zoom: top/bottom for wide films, left/right for narrow ones
    var b = videoBox(), k = zoomMode === "stretch" ? 0 : zoomScale() * pinchK;
    if (!k) { ambLay = { axis: null }; return; }
    var w = b.width * k, h = b.height * k, L = (innerWidth - w) / 2, T = (innerHeight - h) / 2;
    var axis = T > 6 ? "y" : L > 6 ? "x" : null, prev = ambLay && ambLay.axis;
    ambLay = { axis: axis, T: T, L: L, w: w, h: h };
    if (!axis) return;
    var place = function (n, x, y, ww, hh, side) { n.style.left = x + "px"; n.style.top = y + "px"; n.style.width = ww + "px"; n.style.height = hh + "px"; n.setAttribute("data-side", side); };
    if (axis === "y") { place(mirA, L, 0, w, T + 2, "t"); place(mirB, L, T + h - 2, w, T + 2, "b"); }
    else { place(mirA, 0, T, L + 2, h, "l"); place(mirB, L + w - 2, T, L + 2, h, "r"); }
    if (axis !== prev) { var y = axis === "y"; mcA.width = mcB.width = y ? 160 : 48; mcA.height = mcB.height = y ? 48 : 90; }   // fixed resolution, CSS scales it
  }
  function syncMir() {
    var c = ambCfg(), m = GLOW_OK ? c.mode : "", show = (m === "mirror" || m === "edge") && !!(ambLay && ambLay.axis);
    [mirA, mirB].forEach(function (n) { n.classList.toggle("on", show); n.classList.toggle("edge", m === "edge"); if (m !== "edge") n.style.background = ""; });
  }
  function applyAmb() {
    var c = ambCfg();
    GLOW_OK = !!c && !!glowCtx && !TV;
    if (GLOW_OK) {
      playerEl.style.setProperty("--ak", c.k); playerEl.style.setProperty("--ab", c.blur + "px");
      playerEl.style.setProperty("--as", c.sat); playerEl.style.setProperty("--asz", c.size);
    }
    glowEl.classList.toggle("on", GLOW_OK && c.mode === "glow");
    layoutAmb(); syncMir();
    edgeA = edgeB = null;
    if (!GLOW_OK) glowRun = false;
    else if (cur && !video.paused) glow(true);
  }
  function setAmbPreset(p) { ambPreset = p; store.set("ambp", p); applyAmb(); toast("Ambient light: " + ambLabel()); }
  function tweak(key, d) {   // any change turns the current preset into your Custom set
    var was = ambPreset;
    if (ambPreset !== "custom") { ambCustom = copyCfg(ambCfg() || AMB.spill); ambPreset = "custom"; store.set("ambp", "custom"); }
    if (key === "mode") ambCustom.mode = d;
    else { var L = LIM[key]; ambCustom[key] = Math.round(clamp(ambCustom[key] + d * L[2], L[0], L[1]) * 100) / 100; }
    store.set("ambc", JSON.stringify(ambCustom));
    applyAmb();
    if (was !== "custom") setTimeout(refreshMenu, 0);   // the checkmark moves to Custom
  }

  function flip(ctx, cv, vertical, draw) {   // mirror a slice so the edge touching the picture stays next to it
    ctx.save();
    if (vertical) { ctx.translate(0, cv.height); ctx.scale(1, -1); } else { ctx.translate(cv.width, 0); ctx.scale(-1, 1); }
    try { draw(); } catch (e) { /* frame not ready */ }
    ctx.restore();
  }
  function drawMirror(c) {
    var a = ambLay, vw = video.videoWidth, vh = video.videoHeight;
    if (!a || !a.axis || !vw || !mxA) return;
    mxA.globalAlpha = mxB.globalAlpha = c.follow;
    if (a.axis === "y") {
      var sh = Math.max(2, Math.min(vh * 0.4, vh * a.T / a.h));   // as many source rows as the bar is tall
      flip(mxA, mcA, true, function () { mxA.drawImage(video, 0, 0, vw, sh, 0, 0, mcA.width, mcA.height); });
      flip(mxB, mcB, true, function () { mxB.drawImage(video, 0, vh - sh, vw, sh, 0, 0, mcB.width, mcB.height); });
    } else {
      var sw = Math.max(2, Math.min(vw * 0.4, vw * a.L / a.w));
      flip(mxA, mcA, false, function () { mxA.drawImage(video, 0, 0, sw, vh, 0, 0, mcA.width, mcA.height); });
      flip(mxB, mcB, false, function () { mxB.drawImage(video, vw - sw, 0, sw, vh, 0, 0, mcB.width, mcB.height); });
    }
  }
  var mixC = function (prev, next, f) {
    if (!prev || prev.length !== next.length) return next;
    return prev.map(function (p, i) { return [p[0] + (next[i][0] - p[0]) * f, p[1] + (next[i][1] - p[1]) * f, p[2] + (next[i][2] - p[2]) * f]; });
  };
  var grad = function (cols, dir) {
    return "linear-gradient(" + dir + "," + cols.map(function (c) { return "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")"; }).join(",") + ")";
  };
  function drawEdge(c) {
    var a = ambLay, d;
    if (!a || !a.axis || !sx) return;
    try { sx.drawImage(video, 0, 0, 24, 14); d = sx.getImageData(0, 0, 24, 14).data; } catch (e) { return; }   // cross-origin frame: no colours to read
    var px = function (x, y) { var i = (y * 24 + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    var avg = function (p, q) { return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]; };
    var A = [], B = [], i;
    if (a.axis === "y") for (i = 0; i < 24; i++) { A.push(avg(px(i, 0), px(i, 1))); B.push(avg(px(i, 13), px(i, 12))); }
    else for (i = 0; i < 14; i++) { A.push(avg(px(0, i), px(1, i))); B.push(avg(px(23, i), px(22, i))); }
    edgeA = mixC(edgeA, A, c.follow); edgeB = mixC(edgeB, B, c.follow);
    var dir = a.axis === "y" ? "90deg" : "180deg";
    mirA.style.background = grad(edgeA, dir); mirB.style.background = grad(edgeB, dir);
  }
  function glowFrame(t, tok) {
    if (!glowRun || tok !== glowTok) return;   // one render chain at a time
    var c = ambCfg();
    if (!c) { glowRun = false; return; }
    var gap = c.mode === "edge" ? 80 : TOUCH ? 66 : 33;   // ~30 fps on desktop, ~15 on phones, edge colours ~12 fps
    if (!t || t - glowLast > gap) {
      glowLast = t || 0;
      if (video.readyState >= 2) {
        if (c.mode === "glow") { try { glowCtx.globalAlpha = c.follow; glowCtx.drawImage(video, 0, 0, glowEl.width, glowEl.height); } catch (e) { /* not drawable yet */ } }
        else if (c.mode === "mirror") drawMirror(c);
        else drawEdge(c);
      }
    }
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(function (now) { glowFrame(now, tok); });
    else requestAnimationFrame(function (now) { glowFrame(now, tok); });
  }
  function glow(run) {
    if (run === false) { glowRun = false; glowEl.classList.remove("on"); mirA.classList.remove("on"); mirB.classList.remove("on"); return; }
    if (run === "pause") { glowRun = false; return; }   // keep the last light up while paused
    if (!GLOW_OK || glowRun) return;
    glowRun = true; glowTok++; glowFrame(0, glowTok);
  }
  applyAmb();

  // play / pause is one shape that morphs (two quads each, so the CSS `d` transition can interpolate)
  var PLAY_D = "M8 5.5L13.5 8.75L13.5 15.25L8 18.5Z M13.5 8.75L19 12L19 12L13.5 15.25Z";
  var PAUSE_D = "M6.5 5L10.5 5L10.5 19L6.5 19Z M13.5 5L17.5 5L17.5 19L13.5 19Z";
  var ppIcon = ic(""), ppPath = document.createElementNS(SVGNS, "path");
  ppPath.setAttribute("class", "pp"); ppPath.setAttribute("d", PLAY_D); ppIcon.appendChild(ppPath);
  setKids($("play"), [ppIcon]); $("play").classList.add("is-paused");
  var setPlayIcon = function () {
    var p = video.paused;
    ppPath.setAttribute("d", p ? PLAY_D : PAUSE_D);   // fallback where CSS `d` is unsupported
    $("play").classList.toggle("is-paused", p);
    $("play").setAttribute("aria-label", p ? "Play" : "Pause");
  };
  var bezelEl = $("bezel");
  function bezel(name) {   // a brief confirmation in the middle of the picture
    if (reduced()) return;
    setKids(bezelEl.firstElementChild, [ic(name)]);
    bezelEl.classList.remove("go"); void bezelEl.offsetWidth; bezelEl.classList.add("go");
  }
  var toggle = function () {
    if (video.paused) { var p = video.play(); if (p && p.catch) p.catch(function () {}); bezel("play"); }
    else { video.pause(); bezel("pause"); }
  };
  function chips() {   // what's playing, at a glance: format, audio language, subtitles
    var c = $("pchips");
    if (!cur) return setKids(c, []);
    var list = [cur.ext.toUpperCase()];
    if (tr.audio.length > 1 && tr.audio[audioSel]) list.push(langName(tr.audio[audioSel].lang) || "Track " + (audioSel + 1));
    if (sub.kind !== "off") list.push("CC");
    setKids(c, list.map(function (t) { return el("span", "chip", t); }));
  }

  video.addEventListener("timeupdate", tick);
  video.addEventListener("progress", tick);
  video.addEventListener("play", function () { setPlayIcon(); wake(); });
  video.addEventListener("playing", function () { $("spinner").hidden = true; playerEl.classList.add("live"); launchDone(); glow(true); });
  video.addEventListener("pause", function () { setPlayIcon(); wake(); save(true); glow("pause"); });
  video.addEventListener("waiting", function () { $("spinner").hidden = false; });
  video.addEventListener("canplay", function () { $("spinner").hidden = true; });
  video.addEventListener("loadeddata", function () { playerEl.classList.add("live"); launchDone(); });   // first frame: hand over from the poster even if autoplay was blocked
  video.addEventListener("ended", function () { save(true); if (cur && nextOf(cur)) playNext(); });
  video.addEventListener("error", function () {
    $("spinner").hidden = true;
    if (cur) toast(conv && !compat ? "Playback failed. Try the compatibility button (re-encodes video)." : "Playback failed. Is the PC server still running?");
  });

  // seek bar with frame previews: pointer events cover mouse, touch and pen
  var ratio = function (e) { var r = seekEl.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1); };
  var pvKey = "", pvTimer = 0;
  function preview(r) {
    var tip = $("tip"), d = duration(), t = r * d, w = seekEl.getBoundingClientRect().width;
    tip.lastElementChild.textContent = fmt(t);
    tip.style.setProperty("--x", clamp(r * w, 100, w - 100) + "px");
    if (!cur || !d || TV) return;
    var step = d > 3600 ? 20 : 10, b = Math.floor(t / step) * step, key = cur.path + "|" + b;
    if (key === pvKey) return;
    pvKey = key;
    clearTimeout(pvTimer);
    pvTimer = setTimeout(function () {   // a frame for every 10 s bucket, fetched only once the pointer pauses
      var img = tip.firstElementChild;
      img.onload = function () { if (pvKey === key) img.classList.add("ok"); };
      img.onerror = function () { img.classList.remove("ok"); };
      img.src = BASE + "/api/thumb/" + enc(cur.path) + "?w=320&t=" + b;
    }, 90);
  }
  seekEl.addEventListener("pointerenter", function () { seekEl.classList.add("show"); });
  seekEl.addEventListener("pointerleave", function () { if (!dragging) seekEl.classList.remove("show"); });
  seekEl.addEventListener("pointerdown", function (e) { dragging = true; seekEl.classList.add("show"); seekEl.setPointerCapture(e.pointerId); paint(ratio(e) * duration()); preview(ratio(e)); });
  seekEl.addEventListener("pointermove", function (e) { var r = ratio(e); preview(r); if (dragging) paint(r * duration()); });
  seekEl.addEventListener("pointerup", function (e) {
    if (!dragging) return;
    dragging = false; seekTo(ratio(e) * duration());
    if (e.pointerType !== "mouse") seekEl.classList.remove("show");
  });
  seekEl.addEventListener("pointercancel", function () { dragging = false; seekEl.classList.remove("show"); });

  // touch: single tap shows/hides controls, double tap on the left/right third seeks with a ripple
  var lastPtr = "mouse", tapAt = 0, tapSide = 0, tapTimer = 0, fxSum = 0, fxTimer = 0;
  function seekFx(side) {
    var fx = $("seekfx");
    if (fx.getAttribute("data-side") !== String(side)) fxSum = 0;
    fxSum += 10; fx.setAttribute("data-side", side);
    fx.className = side < 0 ? "l" : "r";
    fx.firstElementChild.textContent = (side < 0 ? "−" : "+") + fxSum + " s";
    void fx.offsetWidth; fx.classList.add("go");
    nudge(side * 10); buzz(8);
    clearTimeout(fxTimer); fxTimer = setTimeout(function () { fxSum = 0; }, 900);
  }
  function toggleChrome() {
    if (playerEl.classList.contains("idle")) wake();
    else if (!video.paused) { clearTimeout(idleTimer); playerEl.classList.add("idle"); }
  }
  // two-finger pinch zooms the picture; on release it settles on a spring (and snaps back to fit when barely zoomed)
  var pts = {}, pinch = null, pinched = false;
  var span = function () { var ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]]; return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
  video.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "touch") return;
    pts[e.pointerId] = [e.clientX, e.clientY];
    if (Object.keys(pts).length === 2) { pinch = { d: span(), k: pinchK }; pinched = true; video.style.transition = "none"; }
  });
  video.addEventListener("pointermove", function (e) {
    if (!pts[e.pointerId]) return;
    pts[e.pointerId] = [e.clientX, e.clientY];
    if (pinch && Object.keys(pts).length >= 2) { pinchK = clamp(pinch.k * span() / pinch.d, 1, 3); applyZoom(); }
  });
  var endPt = function (e) {
    delete pts[e.pointerId];
    if (pinch && Object.keys(pts).length < 2) {
      pinch = null; video.style.transition = "";
      if (pinchK < 1.05) { pinchK = 1; applyZoom(); }
    }
    if (!Object.keys(pts).length) setTimeout(function () { pinched = false; }, 60);
  };
  video.addEventListener("pointercancel", endPt);
  video.addEventListener("pointerup", function (e) {
    lastPtr = e.pointerType;
    if (e.pointerType !== "touch" || pinched) return;
    var x = e.clientX / innerWidth, side = x < 0.38 ? -1 : x > 0.62 ? 1 : 0, t = Date.now();
    if (side && side === tapSide && t - tapAt < 320) { clearTimeout(tapTimer); tapAt = t; seekFx(side); return; }
    tapAt = t; tapSide = side;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(function () { if (menuKind) hideMenu(); else toggleChrome(); }, 300);
  });
  video.addEventListener("pointerup", endPt);   // after the tap handler, so a pinch's last finger is still marked as a pinch
  video.addEventListener("click", function () { if (lastPtr === "touch") return; if (menuKind) hideMenu(); else toggle(); });
  video.addEventListener("dblclick", function () { if (lastPtr !== "touch") $("fs").click(); });

  $("play").onclick = toggle;
  $("b10").onclick = function () { nudge(-10); };
  $("f10").onclick = function () { nudge(10); };
  $("back").onclick = requestClose;
  $("next").onclick = playNext;

  var vol = $("vol");
  var savedVol = parseFloat(store.get("vol") || "1");
  video.volume = isNaN(savedVol) ? 1 : savedVol; vol.value = String(video.volume);
  if (TV) vol.tabIndex = -1;   // TVs have their own volume; keep the slider out of D-pad focus
  var setMuteIcon = function () { setIc($("mute"), video.muted || video.volume === 0 ? "mute" : "vol"); };
  vol.oninput = function () { video.volume = +vol.value; video.muted = false; store.set("vol", vol.value); setMuteIcon(); };
  $("mute").onclick = function () { video.muted = !video.muted; setMuteIcon(); };
  setMuteIcon();

  $("speed").onclick = function () { setSpeed(SPEEDS[(SPEEDS.indexOf(video.playbackRate) + 1) % SPEEDS.length]); };
  $("compat").onclick = function () { compat = !compat; $("compat").classList.toggle("on", compat); toast(compat ? "Compatibility on: re-encoding video" : "Compatibility off"); load(now()); };
  if (document.pictureInPictureEnabled) {
    $("pip").onclick = function () { (document.pictureInPictureElement ? document.exitPictureInPicture() : video.requestPictureInPicture()).catch(function () {}); };
  } else $("pip").hidden = true;
  $("fs").onclick = function () {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(function () {});
      try { screen.orientation.unlock(); } catch (e) { /* ignore */ }
      return;
    }
    if (!playerEl.requestFullscreen) { if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); return; }   // iPhone: native player
    playerEl.requestFullscreen().then(function () {   // phones: go landscape for the film
      if (TOUCH && screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(function () {});
    }).catch(function () {});
  };

  // auto-hide controls while playing
  var idleTimer = 0;
  function wake() {
    playerEl.classList.remove("idle");
    clearTimeout(idleTimer);
    if (!video.paused && !menuKind) idleTimer = setTimeout(function () { playerEl.classList.add("idle"); }, TV ? 4000 : 2800);
  }
  ["pointermove", "pointerdown", "keydown"].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (!cur) return;
      if (e.pointerType === "touch" && e.target === video) return;   // taps on the picture toggle the controls themselves
      wake();
    });
  });

  // ===========================================================================
  // IMAGE VIEWER
  // ===========================================================================
  var lb = { el: $("lb"), stage: $("lb-stage"), list: [], i: 0, z: 1, tx: 0, ty: 0, slot: null, card: null, ratio: 1.5, open: false };
  var tileFor = typeof WeakMap === "function" ? new WeakMap() : { get: function () { return null; }, set: function () {} };
  var lbUrl = function (m) { return has(IMG_NATIVE, m.ext) ? BASE + "/" + enc(m.path) : thumb(m, 2400); };   // heic/tiff go through the server
  var stageBox = function () { return lb.stage.getBoundingClientRect(); };
  function fitBox(r0) {
    var r = stageBox(), w = r.width, h = w / r0;
    if (h > r.height) { h = r.height; w = h * r0; }
    return [w, h];
  }
  function sizeCard() { var s = fitBox(lb.ratio); lb.card.style.width = s[0] + "px"; lb.card.style.height = s[1] + "px"; }
  function lbApply(anim) {
    lb.card.style.transition = anim ? "transform .6s var(--spring)" : "none";
    lb.card.style.transform = "translate(" + lb.tx + "px," + lb.ty + "px) scale(" + lb.z + ")";
    lb.stage.classList.toggle("zoomed", lb.z > 1);
  }
  function lbZoom(z, cx, cy, anim) {   // cx, cy: point to keep fixed, relative to the stage centre
    z = clamp(z, 1, 5);
    var k = z / lb.z;
    lb.tx = cx - (cx - lb.tx) * k; lb.ty = cy - (cy - lb.ty) * k; lb.z = z;
    if (z === 1) lb.tx = lb.ty = 0;
    lbApply(anim !== false);
  }
  var centreDelta = function (fr) {
    var sr = stageBox();
    return [fr.left + fr.width / 2 - (sr.left + sr.width / 2), fr.top + fr.height / 2 - (sr.top + sr.height / 2)];
  };

  function lbMake(m) {
    var slot = el("div", "lb-slot"), card = el("div", "lb-card"), img = new Image();
    img.alt = m.name; card.appendChild(img); slot.appendChild(card);
    var tile = tileFor.get(m), tImg = tile ? tile.querySelector("img") : null;
    var haveThumb = !!(tImg && tImg.complete && tImg.naturalWidth);
    var r0 = haveThumb ? tImg.naturalWidth / tImg.naturalHeight : lb.ratio;
    if (haveThumb) {   // show the already-loaded thumbnail instantly, swap to the full image when it arrives
      img.src = tImg.currentSrc || tImg.src;
      var full = new Image();
      full.onload = function () { img.src = full.src; };
      full.src = lbUrl(m);
    } else img.src = lbUrl(m);
    img.onload = function () { if (!haveThumb && img.naturalWidth && lb.card === card) { lb.ratio = img.naturalWidth / img.naturalHeight; sizeCard(); } };
    return { slot: slot, card: card, ratio: r0, haveThumb: haveThumb };
  }

  function lbShow(i, dir, from) {
    var m = lb.list[i], made = lbMake(m), old = lb.slot, slot = made.slot;
    lb.i = i; lb.slot = slot; lb.card = made.card; lb.z = 1; lb.tx = lb.ty = 0; lb.ratio = made.ratio;
    lb.stage.appendChild(slot);
    sizeCard(); lbApply(false);
    if (!reduced()) {
      if (from && made.haveThumb && !TV) {   // grow out of the grid tile
        var s = fitBox(made.ratio), fr = from.getBoundingClientRect(), dd = centreDelta(fr);
        slot.style.transition = "none";
        slot.style.transform = "translate3d(" + dd[0] + "px," + dd[1] + "px,0) scale(" + Math.max(fr.width / s[0], fr.height / s[1]) + ")";
        slot.getBoundingClientRect();
        slot.style.transition = "transform .85s var(--spring)";
        slot.style.transform = "none";
      } else if (dir) {               // slide in from the side we are moving towards
        slot.style.transition = "none"; slot.style.opacity = "0"; slot.style.transform = "translate3d(" + dir * 90 + "px,0,0)";
        slot.getBoundingClientRect();
        slot.style.transition = "transform .8s var(--spring), opacity .45s var(--ease)";
        slot.style.opacity = "1"; slot.style.transform = "none";
      }
    }
    if (old) {   // the previous photo keeps moving the way your finger threw it
      old.style.transition = "transform .7s var(--ease-ios), opacity .45s var(--ease)";
      old.style.transform = "translate3d(" + (-dir * stageBox().width * 0.4) + "px,0,0) scale(.94)"; old.style.opacity = "0";
      setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 750);
    }
    $("lb-name").textContent = m.name;
    $("lb-count").textContent = (i + 1) + " / " + lb.list.length;
    var dl = $("lb-dl"); dl.href = dlUrl(m); dl.setAttribute("download", m.name);
    $("lb-prev").disabled = i === 0; $("lb-next").disabled = i === lb.list.length - 1;
    [i - 1, i + 1].forEach(function (k) { if (lb.list[k]) new Image().src = lbUrl(lb.list[k]); });
    var t = tileFor.get(m);
    if (t) t.scrollIntoView({ block: "nearest" });   // so closing flies back to the right tile
  }
  var lbGo = function (dir) { var n = lb.i + dir; if (n >= 0 && n < lb.list.length) { lbShow(n, dir); return true; } return false; };

  function openLightbox(list, i, from) {
    lb.list = list; lb.open = true;
    pushOverlay("lb");
    document.body.classList.add("noscroll");
    lb.el.hidden = false;
    setKids(lb.stage, []); lb.slot = null;
    $("lb-bg").style.opacity = "";
    lbShow(i, 0, from);
    lb.el.getBoundingClientRect();
    lb.el.classList.add("show");
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // remote: left/right change photo, up reaches the buttons
  }
  function doCloseLb() {
    lb.open = false;
    document.body.classList.remove("noscroll");
    lb.el.classList.remove("show");
    var slot = lb.slot, tile = tileFor.get(lb.list[lb.i]);
    if (slot && tile && tile.isConnected && !reduced() && !TV) {
      var s = fitBox(lb.ratio), fr = tile.getBoundingClientRect(), dd = centreDelta(fr);
      lb.card.style.transition = "none"; lb.card.style.transform = "none";
      slot.style.transition = "transform .6s var(--ease-ios)";
      slot.style.transform = "translate3d(" + dd[0] + "px," + dd[1] + "px,0) scale(" + Math.max(fr.width / s[0], fr.height / s[1]) + ")";
    }
    setTimeout(function () {
      if (lb.open) return;
      lb.el.hidden = true; setKids(lb.stage, []); lb.slot = lb.card = null; $("lb-bg").style.opacity = "";
      if (tile && tile.isConnected && (TV || !FINE)) tile.focus({ preventScroll: true });
    }, 620);
  }

  // finger-following: drag sideways to change photo, down to dismiss, pan when zoomed; flicks count, everything settles on a spring
  var drag = null, lastTap = 0, settle = null;
  var rubber = function (dx) {
    var atEdge = (dx > 0 && lb.i === 0) || (dx < 0 && lb.i === lb.list.length - 1);
    return atEdge ? dx * 0.3 : dx;   // resistance past the first / last photo
  };
  function dragPaint(mode, dx, dy) {
    if (!lb.slot) return;
    lb.slot.style.transition = "none";
    if (mode === "x") lb.slot.style.transform = "translate3d(" + rubber(dx) + "px,0,0)";
    else {
      var k = Math.max(0, dy);
      lb.slot.style.transform = "translate3d(" + dx * 0.6 + "px," + k + "px,0) scale(" + (1 - Math.min(k / 1500, 0.22)) + ")";
      $("lb-bg").style.opacity = String(1 - Math.min(k / 520, 0.85));
    }
  }
  lb.stage.addEventListener("pointerdown", function (e) {
    if (e.button) return;
    if (settle) { settle(); settle = null; }
    lb.stage.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, tx: lb.tx, ty: lb.ty, moved: 0, mode: null, lx: e.clientX, ly: e.clientY, lt: Date.now(), vx: 0, vy: 0 };
  });
  lb.stage.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y, t = Date.now(), dt = Math.max(1, t - drag.lt);
    drag.vx = (e.clientX - drag.lx) / dt; drag.vy = (e.clientY - drag.ly) / dt; drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = t;
    drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
    if (lb.z > 1) { lb.tx = drag.tx + dx; lb.ty = drag.ty + dy; lbApply(false); return; }
    if (!drag.mode && drag.moved > 8) drag.mode = Math.abs(dx) > Math.abs(dy) ? "x" : dy > 0 ? "y" : "none";
    if (drag.mode === "x" || drag.mode === "y") dragPaint(drag.mode, dx, dy);
  });
  lb.stage.addEventListener("pointerup", function (e) {
    if (!drag) return;
    var d = drag, dx = e.clientX - d.x, dy = e.clientY - d.y, w = stageBox().width;
    drag = null;
    if (d.mode === "x") {
      if ((dx < -w * 0.18 || d.vx < -0.5) && lbGo(1)) return buzz(6);
      if ((dx > w * 0.18 || d.vx > 0.5) && lbGo(-1)) return buzz(6);
      var sx = rubber(dx);   // not far enough: spring back with the release velocity
      settle = spring(sx, 0, d.vx * 1000, function (x) { if (lb.slot) lb.slot.style.transform = "translate3d(" + x + "px,0,0)"; });
      return;
    }
    if (d.mode === "y") {
      if (dy > 140 || d.vy > 0.6) { buzz(6); return requestClose(); }
      var ratioX = dy ? dx / dy : 0;
      settle = spring(Math.max(0, dy), 0, d.vy * 1000, function (y) { dragPaint("y", y * ratioX, y); }, function () { $("lb-bg").style.opacity = ""; });
      return;
    }
    if (d.moved < 6) {   // tap: double tap zooms to where you tapped
      var dd = centreDelta({ left: e.clientX, top: e.clientY, width: 0, height: 0 }), t = Date.now();
      if (t - lastTap < 320) { lbZoom(lb.z > 1 ? 1 : 2.5, dd[0], dd[1]); lastTap = 0; } else lastTap = t;
    }
  });
  lb.stage.addEventListener("pointercancel", function () { drag = null; if (lb.slot) { lb.slot.style.transform = ""; $("lb-bg").style.opacity = ""; } });
  lb.stage.addEventListener("wheel", function (e) {
    e.preventDefault();
    var dd = centreDelta({ left: e.clientX, top: e.clientY, width: 0, height: 0 });
    lbZoom(lb.z * Math.exp(-e.deltaY * 0.0018), dd[0], dd[1], false);
  }, { passive: false });
  addEventListener("resize", function () { if (lb.open && lb.card) sizeCard(); });
  $("lb-close").onclick = requestClose;
  $("lb-prev").onclick = function () { lbGo(-1); };
  $("lb-next").onclick = function () { lbGo(1); };
  $("lb-zoom").onclick = function () { lbZoom(lb.z > 1 ? 1 : 2.5, 0, 0); };

  // ===========================================================================
  // D-PAD / KEYBOARD: spatial navigation for TV remotes, VLC-style player keys
  // ===========================================================================
  var FOCUSABLE = 'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([type="hidden"]):not([tabindex="-1"])';
  var visible = function (n) { var r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  function focusEl(n) {
    try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); }
    try { n.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced() ? "auto" : "smooth" }); } catch (e) { n.scrollIntoView(false); }
  }
  function spatial(dir) {   // move focus to the nearest element in that direction (edges first, then alignment)
    var scope = lb.open ? lb.el : cur ? playerEl : $("app");
    var all = Array.prototype.slice.call(scope.querySelectorAll(FOCUSABLE)).filter(visible);
    if (!all.length) return false;
    var a = document.activeElement;
    if (!a || a === document.body || all.indexOf(a) < 0) {
      var first = all.filter(function (n) { var r = n.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })[0] || all[0];
      focusEl(first); return true;
    }
    var r = a.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, best = null, bestS = Infinity;
    all.forEach(function (n) {
      if (n === a) return;
      var b = n.getBoundingClientRect(), bx = (b.left + b.right) / 2, by = (b.top + b.bottom) / 2, main, cross, overlap;
      if (dir === "right" || dir === "left") {
        if (dir === "right" ? bx <= cx + 1 : bx >= cx - 1) return;
        main = dir === "right" ? Math.max(0, b.left - r.right) : Math.max(0, r.left - b.right);
        overlap = b.top < r.bottom && b.bottom > r.top;
        cross = overlap ? 0 : Math.abs(by - cy);
      } else {
        if (dir === "down" ? by <= cy + 1 : by >= cy - 1) return;
        main = dir === "down" ? Math.max(0, b.top - r.bottom) : Math.max(0, r.top - b.bottom);
        overlap = b.left < r.right && b.right > r.left;
        cross = overlap ? Math.abs(bx - cx) * 0.1 : Math.abs(bx - cx);
      }
      var s = main + cross * 2.2;
      if (s < bestS) { bestS = s; best = n; }
    });
    if (best) { focusEl(best); return true; }
    return false;
  }

  var KEYNAMES = { 37: "arrowleft", 38: "arrowup", 39: "arrowright", 40: "arrowdown", 13: "enter", 27: "escape", 8: "backspace",
    461: "goback", 10009: "goback", 415: "mediaplay", 19: "mediapause", 417: "mediafastforward", 412: "mediarewind", 413: "mediastop", 179: "mediaplaypause" };
  var DIRS = { arrowright: "right", arrowleft: "left", arrowup: "up", arrowdown: "down", right: "right", left: "left", up: "up", down: "down" };
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = KEYNAMES[e.keyCode] && (e.keyCode > 400 || !e.key || e.key === "Unidentified") ? KEYNAMES[e.keyCode] : String(e.key || KEYNAMES[e.keyCode] || "").toLowerCase();
    var t = e.target, typing = t && ((t.tagName === "INPUT" && t.type !== "range" && t.type !== "file") || t.tagName === "TEXTAREA");
    var dir = DIRS[k], inBar = t && t.closest ? t.closest(".bar, #menu") : null;
    var done = function () { e.preventDefault(); };

    // remote media keys work anywhere while something plays
    if (cur) {
      if (k === "mediaplaypause") return done(), toggle();
      if (k === "mediaplay") return done(), video.play();
      if (k === "mediapause") return done(), video.pause();
      if (k === "mediafastforward") return done(), nudge(30);
      if (k === "mediarewind") return done(), nudge(-30);
      if (k === "mediatracknext") return done(), playNext();
      if (k === "mediastop") return done(), requestClose();
    }
    // Back: TV remotes, Escape, Backspace outside text fields
    if (k === "goback" || k === "browserback" || (k === "backspace" && !typing) || k === "escape") {
      if (typing) { t.blur(); return done(); }
      if (menuKind) { hideMenu(); if (cur) $("more").focus(); return done(); }
      if (k === "escape" && document.fullscreenElement) return;   // let the browser leave fullscreen
      if (overlay) { requestClose(); return done(); }
      if (k !== "escape" && document.body.getAttribute("data-view") !== "landing") { history.back(); return done(); }
      return;
    }
    if (typing) return;

    if (lb.open) {   // image viewer: left/right change photo, up/down reach the buttons (then left/right move between them)
      var inLbBar = t && t.closest ? t.closest(".lb-top") : null;
      if (k === "arrowright" && !inLbBar) return done(), lbGo(1);
      if (k === "arrowleft" && !inLbBar) return done(), lbGo(-1);
      if (k === "+" || k === "=") return done(), lbZoom(lb.z * 1.4, 0, 0);
      if (k === "-") return done(), lbZoom(lb.z / 1.4, 0, 0);
      if (k === "0") return done(), lbZoom(1, 0, 0);
      if (dir && spatial(dir)) return done();
      return;
    }
    if (cur) {   // player
      if (dir && inBar) { wake(); if (spatial(dir)) return done(); if (dir === "up" || dir === "down") { t.blur(); return done(); } return done(); }
      if (dir === "right") return done(), nudge(10);
      if (dir === "left") return done(), nudge(-10);
      if (dir === "up" || dir === "down") { wake(); $("play").focus({ preventScroll: true }); return done(); }
      if (k === "enter" && !inBar) return done(), toggle();
      if (k === " " && inBar) return;   // a focused button handles its own press
      if (k === " " || k === "k") return done(), toggle();
      if (k === "l") return done(), nudge(10);
      if (k === "j") return done(), nudge(-10);
      if (k === "m") return done(), $("mute").click();
      if (k === "f") return done(), $("fs").click();
      if (k === "n") return done(), playNext();
      if (k === "v") return done(), cycleSub();                                    // VLC: cycle subtitle track
      if (k === "b") return done(), cycleAudio();                                  // VLC: cycle audio track
      if (k === "g") { setDelay(subDelay - 0.05); toast("Subtitle delay " + delayText()); return done(); }
      if (k === "h") { setDelay(subDelay + 0.05); toast("Subtitle delay " + delayText()); return done(); }
      if (k === "a" || k === "z") return done(), cycleAspect();                    // VLC: aspect ratio; Z: zoom
      if (k === "o") return done(), cycleLoop();                                   // A-B loop (VLC uses L, which stays seek here)
      if (k === "[") return done(), stepSpeed(-1);                                 // VLC: slower / faster
      if (k === "]") return done(), stepSpeed(1);
      if (/^[0-9]$/.test(k)) return done(), seekTo(duration() * (+k / 10));
      return;
    }
    if (dir && spatial(dir)) done();   // pages: the remote moves between cards, rows and buttons
  });

  // ===========================================================================
  // VIEWS
  // ===========================================================================
  var sect = null, titleIO = null;
  var io = "IntersectionObserver" in window
    ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -6% 0px" })
    : null;
  var armReveal = function (root) { Array.prototype.forEach.call(root.querySelectorAll(".reveal"), function (n) { if (io) io.observe(n); else n.classList.add("on"); }); };

  function mkImg(m, w, fallbackNative) {   // CORS-enabled so the ambient colour can be read; SVG and friends fall back to the original file
    var img = el("img");
    img.alt = ""; img.crossOrigin = "anonymous"; img.decoding = "async";
    img.onload = function () { img.classList.add("ok"); if (img.parentNode && img.parentNode.classList) img.parentNode.classList.add("ready"); };   // ready: stop the breathing placeholder
    img.onerror = function () {
      if (fallbackNative && has(IMG_NATIVE, m.ext) && !img.getAttribute("data-fb")) { img.setAttribute("data-fb", "1"); img.src = BASE + "/" + enc(m.path); }
      else if (img.parentNode) img.parentNode.removeChild(img);
    };
    img.src = thumb(m, w);
    return img;
  }

  function letters(text, start) {   // every word masked, every letter rising on its own beat (screen readers get the h1 label)
    var frag = document.createDocumentFragment(), i = start || 0;
    text.split(" ").forEach(function (w, wi) {
      var s = el("span", "w");
      s.setAttribute("aria-hidden", "true");
      w.split("").forEach(function (ch) { var c = el("span", "", ch); c.style.setProperty("--i", i++); s.appendChild(c); });
      if (wi) frag.appendChild(document.createTextNode(" "));
      frag.appendChild(s);
    });
    return frag;
  }
  // the island's sliding thumb: glides to the current section (instant when the bar first appears)
  var thumbLive = false;
  function placeThumb(sec) {
    var th = $("segThumb"), a = null;
    Array.prototype.forEach.call($("seg").querySelectorAll("a"), function (x) { var on = x.getAttribute("data-sec") === sec; x.classList.toggle("on", on); if (on) a = x; });
    if (!a) { th.style.opacity = "0"; thumbLive = false; return; }
    if (!thumbLive) th.style.transition = "none";
    th.style.width = a.offsetWidth + "px"; th.style.transform = "translate3d(" + a.offsetLeft + "px,0,0)"; th.style.opacity = "1";
    if (!thumbLive) { th.getBoundingClientRect(); th.style.transition = ""; thumbLive = true; }
  }
  addEventListener("resize", function () { if (sect) placeThumb(sect.sec); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (sect) placeThumb(sect.sec); });
  var searchBox = $("searchBox"), island = document.querySelector(".island");
  function syncSearch() {   // the search grows out of its icon and stays open while it holds text
    var has = !!$("search").value;
    searchBox.classList.toggle("has", has);
    island.classList.toggle("searching", has || document.activeElement === $("search"));
  }
  $("search").addEventListener("focus", syncSearch);
  $("search").addEventListener("blur", syncSearch);
  var greeting = function () { var h = new Date().getHours(); return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 22 ? "Good evening" : "Good night"; };
  var parseHash = function () {
    var h = location.hash.replace(/^#\/?/, ""), i = h.indexOf("/"), path = i < 0 ? "" : h.slice(i + 1);
    try { path = decodeURIComponent(path); } catch (e) { /* keep raw */ }
    return { sec: i < 0 ? h : h.slice(0, i), path: path };
  };

  // route changes are a slow camera dolly: deeper = push in, shallower = pull back (CSS does the motion)
  var routed = null, prevDepth = 0;
  var depthOf = function (sec, path) { return SECTIONS[sec] ? 1 + (sec === "files" ? path.split("/").filter(Boolean).length : 0) : 0; };
  function route(first) {
    routed = location.hash;
    var h = parseHash(), sec = h.sec, path = h.path;
    var depth = depthOf(sec, path), nav = depth < prevDepth ? "back" : "fwd";
    prevDepth = depth;
    var ran = false;
    var build = function () {
      if (ran) return; ran = true;
      if (SECTIONS[sec]) showSection(sec, path); else showLanding();
      window.scrollTo(0, 0);
      if (TV) setTimeout(function () { spatial("down"); }, 60);   // remote users always have something focused
    };
    if (first || reduced()) return build();
    document.documentElement.setAttribute("data-nav", nav);
    if (document.startViewTransition && !TV) {
      var vt = document.startViewTransition(build);
      vt.ready.catch(function () { /* skipped or aborted: harmless */ }); vt.finished.catch(function () {});
      setTimeout(build, 1500);   // the callback waits for a painted frame; never leave the page on the old view if none comes
      return;
    }
    var view = $("view");   // no View Transitions (older browsers, TVs): the same dolly with plain CSS animations
    view.className = "leaving-" + nav;
    setTimeout(function () { build(); view.className = "entering-" + nav; setTimeout(function () { view.className = ""; }, 850); }, 380);
  }

  function changeServer() {
    var v = prompt("Server address (blank = default)", BASE || location.origin);
    if (v === null) return;
    store.set("server", v.trim().replace(/\/$/, ""));
    location.reload();
  }
  $("server-btn").onclick = changeServer;
  $("search").addEventListener("input", function () { syncSearch(); refreshSection(); });

  // ---- problem states ----
  var launchTimer = 0;
  function launcherPanel() {
    var d = el("div", "panel"), row = el("div", "row");
    var go = el("a", "pill primary", "Open " + BASE.replace(/^https?:\/\//, "")); go.href = BASE;
    var srv = el("button", "pill", "Change address"); srv.onclick = changeServer;
    var stay = el("button", "pill", "Stay here"); stay.onclick = function () { clearTimeout(launchTimer); store.set("noauto", "1"); toast("Auto-open is off"); };
    row.appendChild(go); row.appendChild(srv); row.appendChild(stay);
    d.appendChild(el("h2", "", "Open your library"));
    d.appendChild(el("p", "", "This page is hosted online, and browsers will not let it read files from your PC over plain http. Your PC's own address works on every device on this network, so this page opens it for you."));
    d.appendChild(row);
    var seen = false;
    try { seen = !!sessionStorage.getItem("launched"); } catch (e) { /* ignore */ }
    if (!seen && !store.get("noauto")) {   // once per tab, and replace() so Back never traps you here
      try { sessionStorage.setItem("launched", "1"); } catch (e) { /* ignore */ }
      launchTimer = setTimeout(function () { if (document.body.getAttribute("data-view") === "landing") location.replace(BASE); }, 1800);
    }
    return d;
  }
  function errorPanel() {
    var d = el("div", "panel"), row = el("div", "row");
    var retry = el("button", "pill", "Try again"), srv = el("button", "pill", "Change server address");
    retry.onclick = function () { loadLibrary().then(function () { route(true); }); };
    srv.onclick = changeServer;
    row.appendChild(retry); row.appendChild(srv);
    d.appendChild(el("h2", "", "Can't reach your PC")); d.appendChild(el("p", "", libError)); d.appendChild(row);
    return d;
  }
  var problemPanel = function () { return libError === "launcher" ? launcherPanel() : errorPanel(); };
  var emptyPanel = function (text) { var d = el("div", "panel"); d.appendChild(el("h2", "", "Nothing here")); d.appendChild(el("p", "", text)); return d; };

  // ---- landing ----
  function pick(list, n) {
    if (list.length <= n) return list;
    return [0, Math.floor((list.length - 1) / 2), list.length - 1].slice(0, n).map(function (i) { return list[i]; });
  }
  function pickFiles() {   // three files with different extensions
    var seen = {}, out = [];
    for (var i = 0; i < Math.min(files.length, 5000) && out.length < 3; i++) { var f = files[i]; if (!seen[f.ext]) { seen[f.ext] = 1; out.push(f); } }
    return out;
  }
  function countUp(node, n, unit) {
    var done = function () { node.textContent = n.toLocaleString() + " " + (n === 1 ? unit[0] : unit[1]); };
    if (!n) { node.textContent = "Nothing here yet"; return; }
    if (reduced() || TV) return done();
    var t0 = performance.now() + 500, dur = 900;
    var step = function (t) {
      if (!node.isConnected) return;
      var k = clamp((t - t0) / dur, 0, 1), v = Math.round(n * (1 - Math.pow(1 - k, 4)));
      node.textContent = v.toLocaleString() + " " + (v === 1 ? unit[0] : unit[1]);
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  }
  function featured() {   // what you were last watching, else the newest movie, else the newest video
    var best = null, at = 0;
    movies.concat(videos).forEach(function (m) { var g = getProg(m.path); if (resumable(g) && g.at > at) { best = m; at = g.at; } });
    if (best) return { m: best, resume: true };
    var pool = movies.length ? movies : videos;
    if (!pool.length) return null;
    return { m: pool.reduce(function (a, b) { return b.mtime > a.mtime ? b : a; }), resume: false };
  }
  function featureBlock(f, root) {
    var bg = el("div", "feature"), kb = el("div", "kb"), img = mkImg(f.m, Math.min(1920, Math.ceil(innerWidth * DPR / 320) * 320), false);
    img.alt = "";
    img.addEventListener("load", function () {   // the room takes the colour of the featured film
      var c = dominant(img);
      if (c && document.body.getAttribute("data-view") === "landing") { ambBase = c; setAmbient(null); }
    });
    kb.appendChild(img); bg.appendChild(kb); root.appendChild(bg);

    var box = el("div", "next rise"), g = getProg(f.m.path), row = el("div", "row");
    box.style.setProperty("--i", 4);
    box.appendChild(el("div", "lbl", f.resume ? "Continue watching" : "Latest"));
    box.appendChild(el("h2", "", f.m.title));
    box.appendChild(el("div", "meta", f.resume ? fmt(g.t) + " of " + fmt(g.d) : fmtSize(f.m.size)));
    if (f.resume) { var nb = el("div", "nbar"), fill = el("i"); fill.style.setProperty("--p", Math.min(1, g.t / g.d)); nb.appendChild(fill); box.appendChild(nb); }
    var play = el("button", "pill primary"), bi = el("span", "bi");   // button-in-button: the icon rides in its own circle
    bi.appendChild(ic("play"));
    play.appendChild(document.createTextNode(f.resume ? "Resume" : "Play")); play.appendChild(bi);
    play.onclick = function () { openMovie(f.m, bg); };
    row.appendChild(play);
    if (f.resume) {
      var over = el("button", "pill"); over.appendChild(ic("restart")); over.appendChild(document.createTextNode("Start over"));
      over.onclick = function () { store.set("pos:" + f.m.path, ""); openMovie(f.m, bg); };
      row.appendChild(over);
    }
    box.appendChild(row);
    return box;
  }

  function portal(sec, i) {
    var S = SECTIONS[sec], list = S.list();
    var a = el("a", "portal rise"); a.href = "#/" + sec; a.setAttribute("data-sec", sec); a.setAttribute("data-amb", "1"); a.style.setProperty("--i", i + 6);
    a.setAttribute("aria-label", S.title + ", " + list.length + " items");
    var fan = el("div", "fan");
    (sec === "files" ? pickFiles() : pick(list, 3)).forEach(function (m) {
      if (sec === "files") {
        var d = el("div", "doc"); d.appendChild(ic("file")); d.appendChild(el("span", "", (m.ext || "file").toUpperCase().slice(0, 5)));
        fan.appendChild(d);
      } else fan.appendChild(mkImg(m, 480, false));
    });
    var icb = el("span", "p-ic"); icb.appendChild(ic(S.icon));
    var arrow = el("span", "p-arrow"); arrow.appendChild(ic("fwd"));
    var meta = el("div", "p-meta"), count = el("div", "p-count");
    meta.appendChild(el("div", "p-title", S.title)); meta.appendChild(count);
    var core = el("div", "core");   // double bezel: the link is the tray, .core the plate
    core.appendChild(fan); core.appendChild(el("div", "shade")); core.appendChild(icb); core.appendChild(arrow); core.appendChild(meta);
    a.appendChild(core);
    countUp(count, list.length, S.unit);
    return a;
  }

  function showLanding() {
    sect = null;
    if (titleIO) titleIO.disconnect();
    document.body.setAttribute("data-view", "landing");
    $("top").hidden = true;
    ambBase = AMB_DEFAULT; setAmbient(null);
    var root = el("section", "landing");
    var brand = el("div", "brand rise"), gear = el("button", "icon-btn");
    gear.setAttribute("aria-label", "Server address"); gear.appendChild(ic("gear")); gear.onclick = changeServer;
    brand.appendChild(el("span", "mark", "Cinema")); brand.appendChild(gear);
    var hero = el("div", "hero"), h1 = el("h1");
    h1.setAttribute("aria-label", greeting());
    h1.appendChild(letters(greeting(), 0));
    thumbLive = false;
    var p = el("p", "rise", "Movies, videos, photos and files from your PC, on any screen at home.");
    p.style.setProperty("--i", 3);
    hero.appendChild(h1); hero.appendChild(p);
    root.appendChild(brand); root.appendChild(hero);
    if (libError) root.appendChild(problemPanel());
    else {
      var f = featured();
      if (f) hero.appendChild(featureBlock(f, root));
      var nav = el("nav", "portals"); nav.setAttribute("aria-label", "Library sections");
      ORDER.forEach(function (sec, i) { nav.appendChild(portal(sec, i)); });
      root.appendChild(nav);
    }
    setKids($("view"), [root]);
  }

  // ---- section pages: an iOS-style large title that collapses into the bar ----
  function showSection(sec, path) {
    document.body.setAttribute("data-view", "section");
    var top = $("top");
    top.hidden = false; top.classList.remove("solid");
    $("search").value = ""; $("search").placeholder = "Search " + SECTIONS[sec].title.toLowerCase();
    ambBase = AMB_DEFAULT; setAmbient(null);
    var S = SECTIONS[sec], wrap = el("section", "sect"), headEl = el("div", "sect-head"), body = el("div", "sect-body");
    var n = S.list().length, h1 = el("h1");
    h1.setAttribute("aria-label", S.title);
    h1.appendChild(letters(S.title, 0));
    var subEl = el("p", "rise");
    if (libError) subEl.textContent = "Offline";
    else { subEl.appendChild(el("span", "count", n.toLocaleString())); subEl.appendChild(document.createTextNode(n === 1 ? S.unit[0] : S.unit[1])); }
    subEl.style.setProperty("--i", 4);
    headEl.appendChild(h1); headEl.appendChild(subEl);
    wrap.appendChild(headEl); wrap.appendChild(body);
    setKids($("view"), [wrap]);
    $("ttl").textContent = S.title;
    placeThumb(sec); syncSearch();
    if (titleIO) titleIO.disconnect();
    if ("IntersectionObserver" in window) {   // large title scrolled away -> the bar turns solid and shows the compact title
      titleIO = new IntersectionObserver(function (es) { top.classList.toggle("solid", !es[0].isIntersecting); }, { rootMargin: "-64px 0px 0px 0px" });
      titleIO.observe(h1);
    }
    sect = { sec: sec, path: path, body: body };
    renderBody();
  }
  function refreshSection() { if (sect) renderBody(); }

  function renderBody() {
    var sec = sect.sec, path = sect.path, body = sect.body, q = $("search").value.trim().toLowerCase();
    setKids(body, []);
    if (libError) return void body.appendChild(problemPanel());
    if (sec === "files") return renderFiles(body, path, q);
    var list = SECTIONS[sec].list(), items = q ? list.filter(function (m) { return m.path.toLowerCase().indexOf(q) >= 0; }) : list;
    if (!items.length) return void body.appendChild(emptyPanel(q ? "Nothing matches your search." : SECTIONS[sec].empty));
    if (sec === "images") renderImages(body, items); else renderVideos(body, items, !q);
  }

  function byFolder(items) {
    var order = [], groups = {};
    items.forEach(function (m) { if (!groups[m.folder]) { groups[m.folder] = []; order.push(m.folder); } groups[m.folder].push(m); });
    return order.map(function (f) { return [f, groups[f]]; });
  }

  function videoCard(m, i) {
    var b = el("button", "card reveal"); b.style.setProperty("--d", (i % 8) * 50 + "ms"); b.setAttribute("data-amb", "1");
    b.setAttribute("aria-label", "Play " + m.title);
    var th = el("div", "thumb"), img = mkImg(m, CARD_W, false);
    img.loading = "lazy";
    var pg = el("div", "pg"), disc = el("span"); disc.appendChild(ic("play")); pg.appendChild(disc);
    th.appendChild(el("span", "initial", m.title.charAt(0).toUpperCase())); th.appendChild(img); th.appendChild(pg); th.appendChild(el("span", "badge", m.ext.toUpperCase()));
    var g = getProg(m.path);
    if (g && g.t > 10) { var bar = el("div", "prog"), fill = el("i"); fill.style.setProperty("--p", Math.min(1, g.t / g.d)); bar.appendChild(fill); th.appendChild(bar); }
    b.appendChild(th); b.appendChild(el("div", "ctitle", m.title)); b.appendChild(el("div", "cmeta", fmtSize(m.size)));
    b.onclick = function () { openMovie(m, th); };
    return b;
  }
  function group(title, items) {
    var s = el("section"), grid = el("div", "vgrid");
    items.forEach(function (m, i) { grid.appendChild(videoCard(m, i)); });
    s.appendChild(el("h2", "", title)); s.appendChild(grid);
    return s;
  }
  function renderVideos(body, items, withContinue) {
    if (withContinue) {
      var cont = items.map(function (m) { return { m: m, g: getProg(m.path) }; }).filter(function (x) { return resumable(x.g); })
        .sort(function (a, b) { return b.g.at - a.g.at; }).slice(0, 8);
      if (cont.length) body.appendChild(group("Continue watching", cont.map(function (x) { return x.m; })));
    }
    byFolder(items).forEach(function (g) { body.appendChild(group(g[0] || "Library", g[1])); });
    armReveal(body);
  }

  function renderImages(body, items) {
    var n = 0;
    byFolder(items).forEach(function (g) {
      var s = el("section"), grid = el("div", "igrid");
      g[1].forEach(function (m) {
        var idx = n++, t = el("button", "tile reveal" + (idx % 9 === 4 ? " wide" : "")), img = mkImg(m, TILE_W, true);
        t.style.setProperty("--d", (idx % 10) * 40 + "ms"); t.setAttribute("data-amb", "1"); t.setAttribute("aria-label", "Open " + m.title);
        img.loading = "lazy"; img.alt = m.title;
        t.appendChild(img); tileFor.set(m, t);
        t.onclick = function () { openLightbox(items, idx, t); };
        grid.appendChild(t);
      });
      s.appendChild(el("h2", "", g[0] || "Library")); s.appendChild(grid);
      body.appendChild(s);
    });
    armReveal(body);
  }

  function renderFiles(body, path, q) {
    var crumbs = el("nav", "crumbs"); crumbs.setAttribute("aria-label", "Folder path");
    var root = el("a", "", "All files"); root.href = "#/files"; crumbs.appendChild(root);
    var acc = "";
    (path ? path.split("/") : []).forEach(function (seg) {
      acc += (acc ? "/" : "") + seg;
      var a = el("a", "", seg); a.href = "#/files/" + enc(acc);
      crumbs.appendChild(el("span", "sep", "/")); crumbs.appendChild(a);
    });
    body.appendChild(crumbs);

    var rows;
    if (q) rows = files.filter(function (f) { return f.path.toLowerCase().indexOf(q) >= 0; }).slice(0, 400).map(function (f) { return { kind: "file", f: f }; });
    else {
      var prefix = path ? path + "/" : "", dirs = {}, dirOrder = [], fl = [];
      files.forEach(function (f) {
        if (f.path.indexOf(prefix) !== 0) return;
        var rest = f.path.slice(prefix.length), j = rest.indexOf("/");
        if (j < 0) fl.push(f);
        else { var d = rest.slice(0, j); if (!dirs[d]) { dirs[d] = 0; dirOrder.push(d); } dirs[d]++; }
      });
      rows = dirOrder.sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); }).map(function (d) { return { kind: "dir", name: d, count: dirs[d] }; })
        .concat(fl.map(function (f) { return { kind: "file", f: f }; }));
    }
    if (!rows.length) return void body.appendChild(emptyPanel(q ? "Nothing matches your search." : SECTIONS.files.empty));

    var list = el("div", "flist"), more = el("button", "pill more"), shown = 0;
    var draw = function () {
      var end = Math.min(rows.length, shown + 200);
      for (var i = shown; i < end; i++) list.appendChild(fileRow(rows[i], path, i - shown, !!q));
      shown = end; more.hidden = shown >= rows.length; more.textContent = "Show more (" + (rows.length - shown) + ")";
      armReveal(list);
    };
    more.onclick = draw;
    body.appendChild(list); body.appendChild(more); draw();
  }
  function fileRow(r, path, i, flat) {
    var dir = r.kind === "dir", a = el("a", "frow reveal" + (dir ? " dir" : ""));
    a.style.setProperty("--d", Math.min(i, 10) * 35 + "ms");
    if (dir) a.href = "#/files/" + enc(path ? path + "/" + r.name : r.name);
    else { a.href = dlUrl(r.f); a.setAttribute("download", r.f.name); }
    var fi = el("span", "fi"); fi.appendChild(ic(dir ? "folder" : r.f.cat === "images" ? "image" : r.f.cat ? "video" : "file"));
    var nm = el("span", "fname"); nm.appendChild(el("b", "", dir ? r.name : r.f.name));
    if (flat && !dir && r.f.folder) nm.appendChild(el("small", "", r.f.folder));
    var go = el("span", "fgo"); go.appendChild(ic(dir ? "fwd" : "download"));
    a.appendChild(fi); a.appendChild(nm);
    a.appendChild(el("span", "fsize", dir ? r.count.toLocaleString() + " items" : fmtSize(r.f.size)));
    a.appendChild(el("span", "fdate", dir ? "" : new Date(r.f.mtime * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })));
    a.appendChild(go);
    return a;
  }

  // Apple TV-style parallax: a poster tilts toward a fine pointer and its artwork shifts inside it (no highlight, no sheen)
  if (FINE && !reduced()) {
    var tiltHost = null, tiltEv = null, tiltRaf = 0;
    var tiltTarget = function (host) { return host.classList.contains("card") ? host.querySelector(".thumb") : host; };
    var clearTilt = function (host) { var t = tiltTarget(host); ["--rx", "--ry", "--ix", "--iy"].forEach(function (p) { t.style.removeProperty(p); }); };
    var applyTilt = function () {
      tiltRaf = 0;
      var host = tiltEv && tiltEv.target.closest ? tiltEv.target.closest(".card, .portal") : null;
      if (tiltHost && tiltHost !== host) clearTilt(tiltHost);
      tiltHost = host;
      if (!host) return;
      var t = tiltTarget(host), r = t.getBoundingClientRect(), nx = (tiltEv.clientX - r.left) / r.width - 0.5, ny = (tiltEv.clientY - r.top) / r.height - 0.5;
      t.style.setProperty("--rx", (-ny * 6).toFixed(2) + "deg"); t.style.setProperty("--ry", (nx * 8).toFixed(2) + "deg");
      t.style.setProperty("--ix", (-nx * 10).toFixed(1) + "px"); t.style.setProperty("--iy", (-ny * 8).toFixed(1) + "px");
    };
    $("view").addEventListener("pointermove", function (e) { tiltEv = e; if (!tiltRaf) tiltRaf = requestAnimationFrame(applyTilt); });
    $("view").addEventListener("pointerleave", function () { if (tiltHost) clearTilt(tiltHost); tiltHost = null; });
  }

  // magnetic controls: a button leans toward a fine pointer and its icon leans further (CSS reads --mx / --my)
  if (FINE && !reduced()) {
    var magEl = null, magEv = null, magRaf = 0, MAG = ".pill, .icon-btn, .ib, .cb";
    var magClear = function (n) { n.style.removeProperty("--mx"); n.style.removeProperty("--my"); };
    var magApply = function () {
      magRaf = 0;
      var n = magEv && magEv.target && magEv.target.closest ? magEv.target.closest(MAG) : null;
      if (magEl && magEl !== n) magClear(magEl);
      magEl = n;
      if (!n) return;
      var r = n.getBoundingClientRect();
      n.style.setProperty("--mx", clamp((magEv.clientX - (r.left + r.width / 2)) * 0.22, -6, 6).toFixed(1) + "px");
      n.style.setProperty("--my", clamp((magEv.clientY - (r.top + r.height / 2)) * 0.3, -5, 5).toFixed(1) + "px");
    };
    document.addEventListener("pointermove", function (e) { magEv = e; if (!magRaf) magRaf = requestAnimationFrame(magApply); }, { passive: true });
  }

  // opening sequence: the gate line fills with real progress, then the frame parts from it and the page plays its entrance
  var T0 = Date.now();
  function openGate() {
    var b = $("boot");
    $("bootbar").style.transform = "scaleX(1)";
    var wait = reduced() || TV ? 0 : Math.max(420, 1150 - (Date.now() - T0));   // long enough to read, never a wait for its own sake
    setTimeout(function () {
      route(true);   // built behind the lids, so its letters and cards rise as they open
      if (!b) return;
      b.classList.add("open");
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 1300);
    }, wait);
  }
  function init() {
    setTimeout(function () { $("bootbar").style.transform = "scaleX(.35)"; }, 60);
    loadLibrary().then(function () {
      $("bootbar").style.transform = "scaleX(.8)";
      openGate();
      var told = false;
      try { told = !!sessionStorage.getItem("rm-told"); } catch (e) { /* ignore */ }
      if (REDUCED && !told) {   // explain why it looks static instead of leaving people guessing
        try { sessionStorage.setItem("rm-told", "1"); } catch (e) { /* ignore */ }
        setTimeout(function () { toast("Animations are off in your system settings. Add ?motion=1 to the address to see them."); }, 1200);
      }
    });
  }
  init();
})();
