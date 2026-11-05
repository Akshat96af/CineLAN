// Cinema. Plain JS, no build step. Edit and refresh.
(() => {
  "use strict";
  const HOST = "192.168.29.117:6789";
  const SVGNS = "http://www.w3.org/2000/svg";

  const $ = id => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode / blocked */ } },
  };
  // Served by server.py itself -> same origin. Anywhere else (GitHub Pages, file://) -> the PC, over the page's own scheme
  // (an https page may only call https; see server.py cert.pem).
  let BASE = store.get("server") || `${location.protocol === "https:" ? "https" : "http"}://${HOST}`;

  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const enc = p => p.split("/").map(encodeURIComponent).join("/");
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fmt = s => {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  };
  const fmtSize = b => {
    if (b < 1024) return b + " B";
    const u = ["KB", "MB", "GB", "TB"]; let i = -1;
    do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
    return b.toFixed(b < 10 ? 1 : 0) + " " + u[i];
  };
  const el = (tag, cls = "", text = "") => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  let langNames = null;
  try { langNames = new Intl.DisplayNames(["en"], { type: "language" }); } catch { /* old browser: show raw code */ }
  const langName = c => { if (!c || c === "und") return ""; try { return langNames?.of(c) || c; } catch { return c; } };

  // ---- icons: one family, 24px grid, 1.75 stroke ----------------------------
  const ICONS = {
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
  };
  const ic = name => {
    const s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "ic"); s.setAttribute("aria-hidden", "true");
    s.innerHTML = ICONS[name] || "";
    return s;
  };
  const setIc = (node, name) => node.replaceChildren(ic(name));
  for (const n of document.querySelectorAll("[data-ic]")) n.replaceWith(ic(n.dataset.ic));

  // ---- library --------------------------------------------------------------
  const VIDEO_EXT = new Set(["mp4", "m4v", "mov", "webm", "avi", "wmv", "flv", "mpg", "mpeg", "m2ts", "mts", "3gp", "ogv"]);   // mkv is "Movies"
  const NATIVE_VIDEO = new Set(["mp4", "m4v", "mov", "webm", "ogv"]);   // everything else plays through the ffmpeg stream
  const IMG_EXT = new Set(["jpg", "jpeg", "jfif", "png", "gif", "webp", "bmp", "avif", "svg", "heic", "heif", "tif", "tiff"]);
  const IMG_NATIVE = new Set(["jpg", "jpeg", "jfif", "png", "gif", "webp", "bmp", "avif", "svg"]);

  let files = [], movies = [], videos = [], images = [], libError = "";
  const natural = (a, b) => a.path.localeCompare(b.path, undefined, { numeric: true });
  const extOf = n => { const i = n.lastIndexOf("."); return i < 0 ? "" : n.slice(i + 1).toLowerCase(); };
  const thumb = (m, w) => `${BASE}/api/thumb/${enc(m.path)}${w ? "?w=" + w : ""}`;
  const dlUrl = m => `${BASE}/${enc(m.path)}?dl=1`;

  function toEntry([path, size, mtime]) {
    const i = path.lastIndexOf("/"), name = path.slice(i + 1);
    return { path, name, ext: extOf(name), size, mtime, folder: i < 0 ? "" : path.slice(0, i),
      title: name.replace(/\.[^.]+$/, "").replace(/[._]+/g, " ").trim() || name };
  }
  async function loadLibrary() {
    if (!store.get("server") && location.protocol.startsWith("http")) {   // served by server.py itself (any port)? use its own origin
      try { if ((await fetch("/api/files", { method: "HEAD" })).ok) BASE = ""; } catch { /* keep the default address */ }
    }
    try {
      const r = await fetch(`${BASE}/api/files`);
      if (!r.ok) throw new Error("HTTP " + r.status);
      files = (await r.json()).map(toEntry).sort(natural);
      movies = []; videos = []; images = [];
      for (const f of files) {
        if (f.ext === "mkv") { f.cat = "movies"; movies.push(f); }
        else if (VIDEO_EXT.has(f.ext)) { f.cat = "videos"; videos.push(f); }
        else if (IMG_EXT.has(f.ext)) { f.cat = "images"; images.push(f); }
      }
      libError = "";
    } catch {
      libError = `Check that the PC is on and server.py is running at ${BASE || location.origin}.` +
        (location.protocol === "https:" ? " This page is https, so the server must be https too." : "");
    }
  }

  const SECTIONS = {
    movies: { title: "Movies", icon: "film", unit: ["title", "titles"], list: () => movies, empty: "No MKV movies in this folder." },
    videos: { title: "Videos", icon: "video", unit: ["video", "videos"], list: () => videos, empty: "No videos in this folder." },
    images: { title: "Images", icon: "image", unit: ["photo", "photos"], list: () => images, empty: "No images in this folder." },
    files: { title: "Files", icon: "folder", unit: ["file", "files"], list: () => files, empty: "This folder is empty." },
  };
  const ORDER = ["movies", "videos", "images", "files"];

  const getProg = p => { try { const s = store.get("pos:" + p); return s ? JSON.parse(s) : null; } catch { return null; } };
  const resumable = g => !!g && g.t > 10 && g.t < g.d * 0.95;

  // ---- toast ----------------------------------------------------------------
  let toastTimer = 0;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => t.classList.remove("show"), 3500);
  }

  // ---- overlays share the history stack: the phone/TV back button closes them ----
  let overlay = null, pushed = false;
  function pushOverlay(kind) { overlay = kind; try { history.pushState({ ov: kind }, ""); pushed = true; } catch { pushed = false; } }
  function requestClose() { if (pushed) history.back(); else forceClose(); }
  function forceClose() {
    const k = overlay; overlay = null; pushed = false;
    if (k === "player") doClosePlayer(); else if (k === "lb") doCloseLb();
  }
  // popstate: back/forward and overlays. hashchange: some browsers only fire this for #links. route() skips a hash it already shows.
  const onNav = () => { if (overlay) { pushed = false; forceClose(); } else if (location.hash !== routed) route(); };
  addEventListener("popstate", onNav);
  addEventListener("hashchange", onNav);

  // spatial continuity: an element grows from where it was clicked, and shrinks back
  function expandFrom(node, from) {
    if (!from || reduced()) return;
    const r = from.getBoundingClientRect();
    node.style.transition = "none";
    node.style.clipPath = `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 20px)`;
    node.getBoundingClientRect();
    node.style.transition = "clip-path .9s var(--ease)";
    node.style.clipPath = "inset(0px 0px 0px 0px round 0px)";
    setTimeout(() => { node.style.transition = ""; node.style.clipPath = ""; }, 950);
  }
  function collapseTo(node, to, done) {
    if (!to || !to.isConnected || reduced()) return done();
    const r = to.getBoundingClientRect();
    node.style.transition = "clip-path .6s var(--ease-io)";
    node.style.clipPath = `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 20px)`;
    setTimeout(() => { done(); node.style.transition = ""; node.style.clipPath = ""; }, 620);
  }

  // ===========================================================================
  // PLAYER
  // ===========================================================================
  const EMPTY = { duration: 0, audio: [], subs: [], side: [], chapters: [] };
  const video = $("video"), playerEl = $("player"), seekEl = $("seek"), cap = $("cap"), menuEl = $("menu");
  let cur = null;
  let playerFrom = null;
  let tr = EMPTY;          // tracks of the current movie
  let conv = false;        // playing through /stream (non-native format, multi-audio, burned subs)
  let off = 0;             // stream start offset: converted streams restart at an offset to seek
  let compat = false;      // also re-encode video (HEVC / 10-bit)
  let audioSel = 0;
  let burn = null;         // image-subtitle track burned into the picture
  let sub = { kind: "off" };
  let cues = [], subDelay = 0, subSize = 1, subToken = 0;
  let loopA = null, loopB = null, loopHold = 0;
  let dragging = false, lastSave = 0;

  const extConv = m => !NATIVE_VIDEO.has(m.ext);
  const needConv = () => !!cur && (extConv(cur) || tr.audio.length > 1 || burn !== null);
  const duration = () => conv ? tr.duration : (isFinite(video.duration) ? video.duration : 0);
  const now = () => off + video.currentTime;

  function load(t) {
    if (!cur) return;
    conv = needConv();
    off = conv ? t : 0;
    const p = enc(cur.path);
    let url = `${BASE}/${p}`;
    if (conv) {
      url = `${BASE}/stream/${p}?t=${t}&a=${audioSel}`;
      if (compat) url += "&v=1";
      if (burn !== null) url += `&bs=${burn}`;
    }
    video.src = url;
    video.playbackRate = video.defaultPlaybackRate;   // a new src would otherwise reset the speed
    if (!conv && t > 0) video.addEventListener("loadedmetadata", () => { video.currentTime = t; }, { once: true });
    $("spinner").hidden = false;
    $("compat").hidden = !conv;
    void video.play().catch(() => { /* autoplay blocked: user presses play */ });
  }

  function seekTo(t) {
    if (!cur) return;
    const d = duration();
    t = Math.max(0, d ? Math.min(t, d) : t);
    if (!conv) { video.currentTime = t; return; }
    const r = t - off;   // inside what's already downloaded? seek natively, else restart the stream there
    for (let i = 0; i < video.buffered.length; i++) {
      if (r >= video.buffered.start(i) && r < video.buffered.end(i) - 1) { video.currentTime = r; return; }
    }
    load(t);
  }

  async function openMovie(m, from) {
    if (!overlay) {
      pushOverlay("player");
      playerFrom = from || null;
      playerEl.hidden = false;
      document.body.classList.add("noscroll");
      expandFrom(playerEl, playerFrom);
    }
    cur = m; tr = EMPTY; compat = false; burn = null; off = 0; cues = []; sub = { kind: "off" }; loopA = loopB = null;
    $("ptitle").textContent = m.title;
    $("compat").classList.remove("on");
    hideMenu(); renderCue(true);
    $("next").hidden = !nextOf(m);
    try { const r = await fetch(`${BASE}/api/tracks/${enc(m.path)}`); if (r.ok) tr = await r.json(); }
    catch { /* no ffprobe / server hiccup: play with defaults */ }
    if (cur !== m) return;   // user picked something else meanwhile
    $("audio").hidden = tr.audio.length < 2;
    $("chap").hidden = !tr.chapters.length;
    audioSel = pickAudio();
    const g = getProg(m.path);
    selectSub(autoSub(), false);   // sets `burn` synchronously, so the first load already has it
    load(resumable(g) ? g.t : 0);
    wake();
  }

  function doClosePlayer() {
    save(true);
    video.pause();
    cur = null; cues = []; renderCue(true); hideMenu();
    if (document.fullscreenElement) void document.exitFullscreen();
    document.body.classList.remove("noscroll");
    collapseTo(playerEl, playerFrom, () => { playerEl.hidden = true; video.removeAttribute("src"); video.load(); });
    refreshSection();
  }

  function nextOf(m) {
    const sib = (m.cat === "movies" ? movies : videos).filter(x => x.folder === m.folder);
    return sib[sib.indexOf(m) + 1];
  }
  function playNext() { const n = cur && nextOf(cur); if (n) { save(true); void openMovie(n); toast("Now playing: " + n.title); } }

  function save(force = false) {
    if (!cur) return;
    const d = duration();
    if (!d || (!force && Date.now() - lastSave < 5000)) return;
    lastSave = Date.now();
    store.set("pos:" + cur.path, JSON.stringify({ t: now(), d, at: Date.now() }));
  }

  // ---- audio ----------------------------------------------------------------
  const audioParts = a => {
    const ch = a.ch === 6 ? "5.1" : a.ch === 8 ? "7.1" : a.ch === 2 ? "stereo" : a.ch === 1 ? "mono" : "";
    return [[langName(a.lang) || `Track ${a.i + 1}`, a.title].filter(Boolean).join(", "), [a.codec.toUpperCase(), ch].filter(Boolean).join(" ")];
  };
  function pickAudio() {
    const pref = store.get("alang");
    let i = tr.audio.findIndex(a => pref && a.lang === pref);
    if (i < 0) i = tr.audio.findIndex(a => a.default);
    return Math.max(0, i);
  }
  function setAudio(a) {
    audioSel = a.i; store.set("alang", a.lang);
    toast("Audio: " + audioParts(a)[0]);
    load(now());   // the stream restarts at the current position with the new track
    refreshMenu();
  }
  function cycleAudio() {
    if (tr.audio.length < 2) return toast("Only one audio track");
    setAudio(tr.audio[(audioSel + 1) % tr.audio.length]);
  }

  // ---- subtitles (own renderer: cues are in movie time, so delay + stream offsets just work) ----
  const subLabel = s => [langName(s.lang) || `Track ${s.i + 1}`, s.title].filter(Boolean).join(", ");
  const TIME = "(?:(\\d+):)?(\\d+):(\\d+)[.,](\\d+)";
  const TIMING = new RegExp(`^\\s*${TIME}\\s*-->\\s*${TIME}`);
  const secs = (h, m, s, ms) => (+h || 0) * 3600 + +m * 60 + +s + +ms.padEnd(3, "0").slice(0, 3) / 1000;

  function cueHtml(text) {
    return esc(text.replace(/\{\\[^}]*\}/g, ""))                 // ASS override blocks
      .replace(/&lt;(\/?)(i|b|u)&gt;/gi, "<$1$2>")              // keep only these tags
      .replace(/&lt;\/?[\w.:\-\s]*&gt;/g, "")                   // drop <c.x>, <00:01.000>, <font ...>
      .replace(/\n/g, "<br>");
  }
  function parseCues(text) {
    const out = [];
    for (const block of text.replace(/\r/g, "").split(/\n{2,}/)) {
      const lines = block.split("\n");
      const k = lines.findIndex((l, i) => i < 2 && TIMING.test(l));
      if (k < 0) continue;
      const m = TIMING.exec(lines[k]);
      const body = lines.slice(k + 1).join("\n").trim();
      if (body) out.push({ s: secs(m[1], m[2], m[3], m[4]), e: secs(m[5], m[6], m[7], m[8]), html: cueHtml(body) });
    }
    return out.sort((a, b) => a.s - b.s);
  }

  let capKey = "";
  function renderCue(force) {
    const t = now() - subDelay, act = [];
    if (cur) for (const c of cues) if (c.s <= t && t < c.e) act.push(c.html);
    const key = act.join("<br>");
    if (key === capKey && !force) return;
    capKey = key;
    cap.innerHTML = key;   // every piece went through cueHtml, which escapes everything but i/b/u
    cap.hidden = !act.length;
  }
  const textSubs = () => [{ kind: "off" },
    ...tr.subs.filter(s => !s.image).map(s => ({ kind: "emb", i: s.i, lang: s.lang, label: subLabel(s) })),
    ...tr.side.map(p => ({ kind: "side", path: p, label: p.split("/").pop() }))];
  const sameSub = (a, b) => a.kind === b.kind && a.i === b.i && a.path === b.path && a.name === b.name;

  function autoSub() {
    const pref = store.get("slang");
    if (!pref || pref === "off") return { kind: "off" };
    return textSubs().find(s => s.lang === pref) || { kind: "off" };
  }

  async function selectSub(s, reload = true) {
    const tok = ++subToken;
    sub = s; cues = []; renderCue(true);
    const prevBurn = burn;
    burn = s.kind === "emb" && s.image ? s.i : null;
    if (reload && cur && burn !== prevBurn) load(now());   // burning in / out restarts the stream
    if (reload) store.set("slang", s.kind === "off" ? "off" : (s.lang || ""));
    if (s.kind === "off") { if (reload) toast("Subtitles off"); }
    else if (burn !== null) { if (reload) toast("Image subtitles: re-encoding video"); }
    else if (s.kind === "file") { cues = parseCues(s.text); if (reload) toast(`Subtitles: ${s.label}`); }
    else {
      const url = s.kind === "emb" ? `${BASE}/api/sub/${enc(cur.path)}?s=${s.i}` : `${BASE}/api/sub/${enc(s.path)}`;
      if (reload) toast("Loading subtitles…");
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const c = parseCues(await r.text());
        if (tok !== subToken) return;   // user already picked another track
        cues = c;
        if (reload) toast(c.length ? `Subtitles: ${s.label}` : "No readable subtitles in that track");
      } catch { if (tok === subToken) toast("Could not load subtitles"); }
    }
    refreshMenu();
  }
  function cycleSub() {
    const l = textSubs();
    selectSub(l[(l.findIndex(s => sameSub(s, sub)) + 1) % l.length]);
  }
  function setDelay(d) { subDelay = Math.round(d * 100) / 100; renderCue(true); }
  const delayText = () => `${subDelay >= 0 ? "+" : ""}${subDelay.toFixed(2)} s`;
  function setSize(z) { subSize = clamp(Math.round(z * 10) / 10, 0.5, 3); cap.style.setProperty("--sz", subSize); }

  $("subfile").onchange = async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (f) void selectSub({ kind: "file", name: f.name, label: f.name, text: await f.text() });
  };

  // ---- player menus -----------------------------------------------------------
  const item = (label, on, fn, note) => {
    const b = el("button", "mi" + (on ? " on" : ""));
    b.append(el("span", "ck", on ? "✓" : ""), el("span", "lbl", label));
    if (note) b.append(el("small", "", note));
    b.onclick = fn;
    return b;
  };
  const head = t => el("div", "mh", t);
  const adj = (label, get, dec, inc) => {
    const row = el("div", "adj"), v = el("span", "val", get());
    const mk = (t, f) => { const b = el("button", "", t); b.onclick = () => { f(); v.textContent = get(); }; return b; };
    row.append(el("span", "lbl", label), mk("−", dec), v, mk("+", inc));
    return row;
  };
  const ASPECTS = [["contain", "Fit"], ["cover", "Fill (crop)"], ["fill", "Stretch"]];
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const MENUS = {
    audio: () => [head("Audio track"),
      ...tr.audio.map(a => { const [l, n] = audioParts(a); return item(l, a.i === audioSel, () => setAudio(a), n); })],
    subs: () => [head("Subtitles"),
      item("Off", sub.kind === "off", () => selectSub({ kind: "off" })),
      ...tr.subs.map(s => {
        const o = { kind: "emb", i: s.i, image: s.image, lang: s.lang, label: subLabel(s) };
        return item(subLabel(s), sub.kind === "emb" && sub.i === s.i, () => selectSub(o), s.image ? "image, re-encodes video" : s.codec);
      }),
      ...tr.side.map(p => item(p.split("/").pop(), sub.kind === "side" && sub.path === p, () => selectSub({ kind: "side", path: p, label: p.split("/").pop() }))),
      item("Load from this device", false, () => $("subfile").click(), ".srt .vtt"),
      adj("Delay", delayText, () => setDelay(subDelay - 0.1), () => setDelay(subDelay + 0.1)),
      adj("Size", () => Math.round(subSize * 100) + "%", () => setSize(subSize - 0.1), () => setSize(subSize + 0.1))],
    chap: () => {
      const t = now(), idx = tr.chapters.reduce((a, c, i) => c.start <= t + 0.5 ? i : a, 0);
      return [head("Chapters"), ...tr.chapters.map((c, i) => item(c.title || `Chapter ${i + 1}`, i === idx, () => { seekTo(c.start); hideMenu(); }, fmt(c.start)))];
    },
    more: () => [head("Aspect ratio"),
      ...ASPECTS.map(([v, n]) => item(n, (video.style.objectFit || "contain") === v, () => { video.style.objectFit = v; refreshMenu(); })),
      head("Speed"),
      ...SPEEDS.map(s => item(s + "×", video.playbackRate === s, () => { setSpeed(s); refreshMenu(); })),
      head("A-B loop"),
      item(loopA === null ? "Set A (start)" : loopB === null ? "Set B (end)" : "Clear loop", loopA !== null, () => { cycleLoop(); refreshMenu(); },
        loopA === null ? "" : `${fmt(loopA)}${loopB === null ? "" : " to " + fmt(loopB)}`)],
  };
  let menuKind = null;
  function hideMenu() { menuKind = null; menuEl.hidden = true; }
  function openMenu(kind, refresh = false) {
    if (!refresh && menuKind === kind) return hideMenu();
    menuKind = kind;
    menuEl.replaceChildren(...MENUS[kind]());
    menuEl.hidden = false;
  }
  function refreshMenu() { if (menuKind) openMenu(menuKind, true); }
  for (const k of ["audio", "subs", "chap", "more"]) $(k).onclick = () => openMenu(k);
  document.addEventListener("pointerdown", e => {
    if (menuKind && !menuEl.contains(e.target) && !e.target.closest(".mbtn")) hideMenu();
  });

  // ---- misc controls --------------------------------------------------------
  function setSpeed(n) { video.defaultPlaybackRate = n; video.playbackRate = n; $("speed").textContent = n + "×"; }
  function stepSpeed(d) {
    const i = clamp(SPEEDS.indexOf(video.playbackRate) + d, 0, SPEEDS.length - 1);
    setSpeed(SPEEDS[i]); toast("Speed " + SPEEDS[i] + "×");
  }
  function cycleLoop() {
    if (loopA === null) { loopA = now(); toast("Loop start set. Press O again for the end."); }
    else if (loopB === null) {
      if (now() - loopA < 1) return toast("Pick an end point later than the start");
      loopB = now(); toast("Looping A-B"); loopHold = 0;
    } else { loopA = loopB = null; toast("Loop cleared"); }
  }
  function cycleAspect() {
    const i = ASPECTS.findIndex(a => a[0] === (video.style.objectFit || "contain"));
    const n = ASPECTS[(i + 1) % ASPECTS.length];
    video.style.objectFit = n[0]; toast("Aspect: " + n[1]);
  }

  function paint(t) {
    const d = duration();
    $("played").style.width = (d ? (t / d) * 100 : 0) + "%";
    $("time").textContent = `${fmt(t)} / ${fmt(d)}`;
  }
  function tick() {
    if (dragging) return;
    const d = duration();
    paint(now());
    let be = 0;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.currentTime >= video.buffered.start(i) - 0.1 && video.currentTime <= video.buffered.end(i) + 0.5) be = video.buffered.end(i);
    }
    $("buf").style.width = (d ? ((off + be) / d) * 100 : 0) + "%";
    save();
  }
  // per-frame: subtitles and the A-B loop need finer timing than timeupdate's ~4 Hz
  function frame() {
    if (cur) {
      renderCue(false);
      if (loopB !== null && performance.now() > loopHold && now() >= loopB) { loopHold = performance.now() + 800; seekTo(loopA); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const setPlayIcon = () => { setIc($("play"), video.paused ? "play" : "pause"); $("play").setAttribute("aria-label", video.paused ? "Play" : "Pause"); };
  const toggle = () => { void (video.paused ? video.play().catch(() => undefined) : video.pause()); };

  video.addEventListener("timeupdate", tick);
  video.addEventListener("progress", tick);
  video.addEventListener("play", () => { setPlayIcon(); wake(); });
  video.addEventListener("pause", () => { setPlayIcon(); wake(); save(true); });
  video.addEventListener("waiting", () => { $("spinner").hidden = false; });
  video.addEventListener("playing", () => { $("spinner").hidden = true; });
  video.addEventListener("canplay", () => { $("spinner").hidden = true; });
  video.addEventListener("ended", () => { save(true); if (cur && nextOf(cur)) playNext(); });
  video.addEventListener("error", () => {
    $("spinner").hidden = true;
    if (cur) toast(conv && !compat ? "Playback failed. Try the compatibility button (re-encodes video)." : "Playback failed. Is the PC server still running?");
  });

  // seek bar: pointer events cover mouse, touch and pen
  const ratio = e => {
    const r = seekEl.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width, 0, 1);
  };
  seekEl.addEventListener("pointerdown", e => { dragging = true; seekEl.setPointerCapture(e.pointerId); paint(ratio(e) * duration()); });
  seekEl.addEventListener("pointermove", e => {
    const tip = $("tip"), r = ratio(e);
    tip.textContent = fmt(r * duration()); tip.style.left = r * 100 + "%";
    if (dragging) paint(r * duration());
  });
  seekEl.addEventListener("pointerup", e => { if (!dragging) return; dragging = false; seekTo(ratio(e) * duration()); });
  seekEl.addEventListener("pointercancel", () => { dragging = false; });

  $("play").onclick = toggle;
  video.addEventListener("click", () => { if (menuKind) hideMenu(); else toggle(); });
  video.addEventListener("dblclick", () => $("fs").click());
  $("b10").onclick = () => seekTo(now() - 10);
  $("f10").onclick = () => seekTo(now() + 10);
  $("back").onclick = requestClose;
  $("next").onclick = playNext;

  const vol = $("vol");
  const savedVol = parseFloat(store.get("vol") ?? "1");
  video.volume = isNaN(savedVol) ? 1 : savedVol; vol.value = String(video.volume);
  const setMuteIcon = () => setIc($("mute"), video.muted || video.volume === 0 ? "mute" : "vol");
  vol.oninput = () => { video.volume = +vol.value; video.muted = false; store.set("vol", vol.value); setMuteIcon(); };
  $("mute").onclick = () => { video.muted = !video.muted; setMuteIcon(); };
  setMuteIcon();

  $("speed").onclick = () => setSpeed(SPEEDS[(SPEEDS.indexOf(video.playbackRate) + 1) % SPEEDS.length]);
  $("compat").onclick = () => { compat = !compat; $("compat").classList.toggle("on", compat); toast(compat ? "Compatibility on: re-encoding video" : "Compatibility off"); load(now()); };
  if (document.pictureInPictureEnabled) {
    $("pip").onclick = () => void (document.pictureInPictureElement ? document.exitPictureInPicture() : video.requestPictureInPicture()).catch(() => undefined);
  } else $("pip").hidden = true;
  $("fs").onclick = () => void (document.fullscreenElement ? document.exitFullscreen() : playerEl.requestFullscreen()).catch(() => undefined);

  // auto-hide controls while playing
  let idleTimer = 0;
  function wake() {
    playerEl.classList.remove("idle");
    clearTimeout(idleTimer);
    if (!video.paused && !menuKind) idleTimer = window.setTimeout(() => playerEl.classList.add("idle"), 2800);
  }
  for (const ev of ["pointermove", "pointerdown", "keydown"]) document.addEventListener(ev, () => { if (cur) wake(); });

  // ===========================================================================
  // IMAGE VIEWER
  // ===========================================================================
  const lb = { el: $("lb"), stage: $("lb-stage"), list: [], i: 0, z: 1, tx: 0, ty: 0, slot: null, card: null, ratio: 1.5, open: false };
  const tileFor = new WeakMap();
  const lbUrl = m => IMG_NATIVE.has(m.ext) ? `${BASE}/${enc(m.path)}` : thumb(m, 2400);   // heic/tiff go through the server
  const stageBox = () => lb.stage.getBoundingClientRect();
  function fitBox(ratio) {
    const r = stageBox();
    let w = r.width, h = w / ratio;
    if (h > r.height) { h = r.height; w = h * ratio; }
    return [w, h];
  }
  function sizeCard() { const [w, h] = fitBox(lb.ratio); lb.card.style.width = w + "px"; lb.card.style.height = h + "px"; }
  function lbApply(anim) {
    lb.card.style.transition = anim ? "transform .5s var(--ease)" : "none";
    lb.card.style.transform = `translate(${lb.tx}px,${lb.ty}px) scale(${lb.z})`;
    lb.stage.classList.toggle("zoomed", lb.z > 1);
  }
  function lbZoom(z, cx, cy, anim = true) {   // cx, cy: point to keep fixed, relative to the stage centre
    z = clamp(z, 1, 5);
    const k = z / lb.z;
    lb.tx = cx - (cx - lb.tx) * k; lb.ty = cy - (cy - lb.ty) * k; lb.z = z;
    if (z === 1) lb.tx = lb.ty = 0;
    lbApply(anim);
  }

  function lbMake(m, from, dir) {
    const slot = el("div", "lb-slot"), card = el("div", "lb-card"), img = new Image();
    img.alt = m.name; img.decoding = "async"; card.append(img); slot.append(card);
    const tImg = tileFor.get(m)?.querySelector("img");
    const haveThumb = !!(tImg && tImg.complete && tImg.naturalWidth);
    const ratio = haveThumb ? tImg.naturalWidth / tImg.naturalHeight : lb.ratio;
    if (haveThumb) {   // show the already-loaded thumbnail soft, then pull focus to the full image
      img.classList.add("soft"); img.src = tImg.currentSrc;
      const full = new Image();
      full.onload = () => { img.src = full.src; img.classList.remove("soft"); };
      full.src = lbUrl(m);
    } else img.src = lbUrl(m);
    img.onload = () => { if (!haveThumb && img.naturalWidth && lb.card === card) { lb.ratio = img.naturalWidth / img.naturalHeight; sizeCard(); } };
    return { slot, card, ratio, haveThumb };
  }

  function lbShow(i, dir, from) {
    const m = lb.list[i], made = lbMake(m, from, dir), old = lb.slot;
    lb.i = i; lb.slot = made.slot; lb.card = made.card; lb.z = 1; lb.tx = lb.ty = 0; lb.ratio = made.ratio;
    lb.stage.append(made.slot);
    sizeCard(); lbApply(false);
    const slot = made.slot;
    if (!reduced()) {
      if (from && made.haveThumb) {   // grow out of the grid tile
        const fr = from.getBoundingClientRect(), sr = stageBox(), [w, h] = fitBox(made.ratio);
        const s = Math.max(fr.width / w, fr.height / h);
        slot.style.transition = "none";
        slot.style.transform = `translate(${fr.left + fr.width / 2 - (sr.left + sr.width / 2)}px,${fr.top + fr.height / 2 - (sr.top + sr.height / 2)}px) scale(${s})`;
        slot.getBoundingClientRect();
        slot.style.transition = "transform .9s var(--ease)";
        slot.style.transform = "none";
      } else if (dir) {               // slide in from the side we are navigating towards
        slot.style.transition = "none"; slot.style.opacity = "0"; slot.style.transform = `translateX(${dir * 90}px)`;
        slot.getBoundingClientRect();
        slot.style.transition = "transform .8s var(--ease), opacity .6s var(--ease)";
        slot.style.opacity = "1"; slot.style.transform = "none";
      }
    }
    if (old) {
      old.style.transition = "transform .8s var(--ease), opacity .5s";
      old.style.transform = `translateX(${-dir * 90}px)`; old.style.opacity = "0";
      setTimeout(() => old.remove(), 800);
    }
    $("lb-name").textContent = m.name;
    $("lb-count").textContent = `${i + 1} of ${lb.list.length}`;
    const dl = $("lb-dl"); dl.href = dlUrl(m); dl.setAttribute("download", m.name);
    $("lb-prev").disabled = i === 0; $("lb-next").disabled = i === lb.list.length - 1;
    for (const k of [i - 1, i + 1]) if (lb.list[k]) new Image().src = lbUrl(lb.list[k]);
    tileFor.get(m)?.scrollIntoView({ block: "nearest" });   // so closing flies back to the right tile
  }
  const lbGo = dir => { const n = lb.i + dir; if (n >= 0 && n < lb.list.length) lbShow(n, dir); };

  function openLightbox(list, i, from) {
    lb.list = list; lb.open = true;
    pushOverlay("lb");
    document.body.classList.add("noscroll");
    lb.el.hidden = false;
    lb.stage.replaceChildren(); lb.slot = null;
    lbShow(i, 0, from);
    lb.el.getBoundingClientRect();
    lb.el.classList.add("show");
  }
  function doCloseLb() {
    lb.open = false;
    document.body.classList.remove("noscroll");
    lb.el.classList.remove("show");
    const slot = lb.slot, tile = tileFor.get(lb.list[lb.i]);
    if (slot && tile && tile.isConnected && !reduced()) {
      const fr = tile.getBoundingClientRect(), sr = stageBox(), [w, h] = fitBox(lb.ratio);
      lb.card.style.transition = "none"; lb.card.style.transform = "none";
      slot.style.transition = "transform .7s var(--ease-io)";
      slot.style.transform = `translate(${fr.left + fr.width / 2 - (sr.left + sr.width / 2)}px,${fr.top + fr.height / 2 - (sr.top + sr.height / 2)}px) scale(${Math.max(fr.width / w, fr.height / h)})`;
    }
    setTimeout(() => { if (!lb.open) { lb.el.hidden = true; lb.stage.replaceChildren(); lb.slot = lb.card = null; } }, 720);
  }

  // pan when zoomed, swipe to navigate or dismiss otherwise, double tap to zoom
  let drag = null, lastTap = 0;
  lb.stage.addEventListener("pointerdown", e => {
    if (e.button) return;
    lb.stage.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, tx: lb.tx, ty: lb.ty, moved: 0 };
  });
  lb.stage.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
    if (lb.z > 1) { lb.tx = drag.tx + dx; lb.ty = drag.ty + dy; lbApply(false); }
  });
  lb.stage.addEventListener("pointerup", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y, d = drag;
    drag = null;
    const sr = stageBox(), cx = e.clientX - (sr.left + sr.width / 2), cy = e.clientY - (sr.top + sr.height / 2);
    if (lb.z === 1 && Math.abs(dx) > 60 && Math.abs(dy) < 90) return lbGo(dx < 0 ? 1 : -1);
    if (lb.z === 1 && dy > 130 && Math.abs(dx) < 90) return requestClose();
    if (d.moved < 6) {
      const t = performance.now();
      if (t - lastTap < 320) { lbZoom(lb.z > 1 ? 1 : 2.5, cx, cy); lastTap = 0; } else lastTap = t;
    }
  });
  lb.stage.addEventListener("pointercancel", () => { drag = null; });
  lb.stage.addEventListener("wheel", e => {
    e.preventDefault();
    const sr = stageBox();
    lbZoom(lb.z * Math.exp(-e.deltaY * 0.0018), e.clientX - (sr.left + sr.width / 2), e.clientY - (sr.top + sr.height / 2), false);
  }, { passive: false });
  addEventListener("resize", () => { if (lb.open && lb.card) sizeCard(); });
  $("lb-close").onclick = requestClose;
  $("lb-prev").onclick = () => lbGo(-1);
  $("lb-next").onclick = () => lbGo(1);
  $("lb-zoom").onclick = () => lbZoom(lb.z > 1 ? 1 : 2.5, 0, 0);

  // ===========================================================================
  // KEYS
  // ===========================================================================
  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (lb.open) {   // image viewer
      if (k === "arrowright") lbGo(1);
      else if (k === "arrowleft") lbGo(-1);
      else if (k === "escape") requestClose();
      else if (k === "+" || k === "=") lbZoom(lb.z * 1.4, 0, 0);
      else if (k === "-") lbZoom(lb.z / 1.4, 0, 0);
      else if (k === "0") lbZoom(1, 0, 0);
      else return;
      e.preventDefault(); return;
    }
    if (cur) {   // VLC-style player keys
      if (k === " " || k === "k") toggle();
      else if (k === "arrowright" || k === "l") seekTo(now() + 10);
      else if (k === "arrowleft" || k === "j") seekTo(now() - 10);
      else if (k === "arrowup") { vol.value = String(Math.min(1, +vol.value + 0.1)); vol.dispatchEvent(new Event("input")); }
      else if (k === "arrowdown") { vol.value = String(Math.max(0, +vol.value - 0.1)); vol.dispatchEvent(new Event("input")); }
      else if (k === "m") $("mute").click();
      else if (k === "f") $("fs").click();
      else if (k === "n") playNext();
      else if (k === "v") cycleSub();                                    // VLC: cycle subtitle track
      else if (k === "b") cycleAudio();                                  // VLC: cycle audio track
      else if (k === "g") { setDelay(subDelay - 0.05); toast("Subtitle delay " + delayText()); }
      else if (k === "h") { setDelay(subDelay + 0.05); toast("Subtitle delay " + delayText()); }
      else if (k === "a") cycleAspect();                                 // VLC: aspect ratio
      else if (k === "o") cycleLoop();                                   // A-B loop (VLC uses L, which stays seek here)
      else if (k === "[") stepSpeed(-1);                                 // VLC: slower / faster
      else if (k === "]") stepSpeed(1);
      else if (k === "escape") { if (menuKind) hideMenu(); else if (!document.fullscreenElement) requestClose(); }
      else if (/^[0-9]$/.test(k)) seekTo(duration() * (+k / 10));
      else return;
      e.preventDefault(); return;
    }
    if (document.body.dataset.view === "landing" && (k === "arrowright" || k === "arrowleft")) {   // TV remote friendly
      const ps = [...document.querySelectorAll(".portal")], i = ps.indexOf(document.activeElement);
      ps[(i + (k === "arrowright" ? 1 : -1) + ps.length) % ps.length]?.focus();
      e.preventDefault();
    }
  });

  // ===========================================================================
  // VIEWS
  // ===========================================================================
  let sect = null, lastSec = "";
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" })
    : null;
  const armReveal = root => root.querySelectorAll(".reveal").forEach(n => (io ? io.observe(n) : n.classList.add("on")));
  const imgIn = (img, m, fallbackNative) => {   // blur-up reveal; SVG and friends fall back to the original file
    img.onload = () => img.classList.add("ok");
    img.onerror = () => { if (fallbackNative && IMG_NATIVE.has(m.ext) && !img.dataset.fb) { img.dataset.fb = 1; img.src = `${BASE}/${enc(m.path)}`; } else img.remove(); };
  };

  const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 22 ? "Good evening" : "Good night"; };
  const parseHash = () => {
    const h = location.hash.replace(/^#\/?/, ""), i = h.indexOf("/");
    let path = i < 0 ? "" : h.slice(i + 1);
    try { path = decodeURIComponent(path); } catch { /* keep raw */ }
    return { sec: i < 0 ? h : h.slice(0, i), path };
  };

  let routed = null;
  function route(first) {
    routed = location.hash;
    const { sec, path } = parseHash();
    let ran = false;
    const build = () => { if (ran) return; ran = true; if (SECTIONS[sec]) showSection(sec, path); else showLanding(); window.scrollTo(0, 0); };
    if (first || reduced() || !document.startViewTransition) { build(); if (!first) $("view").firstElementChild?.classList.add("enter"); return; }
    const vt = document.startViewTransition(build);
    vt.ready.catch(() => { /* skipped or aborted: harmless */ }); vt.finished.catch(() => { });
    setTimeout(build, 1200);   // the callback waits for a painted frame; never leave the page on the old view if none comes
  }

  function errorPanel() {
    const d = el("div", "panel"), row = el("div", "row");
    const retry = el("button", "pill", "Try again"), srv = el("button", "pill", "Change server address");
    retry.onclick = async () => { await loadLibrary(); route(true); };
    srv.onclick = changeServer;
    row.append(retry, srv);
    d.append(el("h2", "", "Can't reach your PC"), el("p", "", libError), row);
    return d;
  }
  const emptyPanel = text => { const d = el("div", "panel"); d.append(el("h2", "", "Nothing here"), el("p", "", text)); return d; };

  function changeServer() {
    const v = prompt("Server address (blank = default)", BASE || location.origin);
    if (v === null) return;
    store.set("server", v.trim().replace(/\/$/, ""));
    location.reload();
  }
  $("server-btn").onclick = changeServer;
  $("search").addEventListener("input", () => refreshSection());

  // ---- landing ----
  function pick(list, n) {
    if (list.length <= n) return list;
    return [0, Math.floor((list.length - 1) / 2), list.length - 1].slice(0, n).map(i => list[i]);
  }
  function pickFiles() {   // three files with different extensions
    const seen = new Set(), out = [];
    for (const f of files.slice(0, 5000)) { if (!seen.has(f.ext)) { seen.add(f.ext); out.push(f); if (out.length === 3) break; } }
    return out;
  }
  function countUp(node, n, unit) {
    const done = () => { node.textContent = `${n.toLocaleString()} ${n === 1 ? unit[0] : unit[1]}`; };
    if (!n) { node.textContent = "Nothing here yet"; return; }
    if (reduced()) return done();
    const t0 = performance.now() + 700, dur = 1200;
    const step = t => {
      if (!node.isConnected) return;
      const k = clamp((t - t0) / dur, 0, 1);
      node.textContent = `${Math.round(n * (1 - Math.pow(1 - k, 4))).toLocaleString()} ${unit[1]}`;
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  }

  function portal(sec, i) {
    const S = SECTIONS[sec], list = S.list();
    const a = el("a", "portal rise"); a.href = `#/${sec}`; a.dataset.sec = sec; a.style.setProperty("--i", i + 5);
    a.setAttribute("aria-label", `${S.title}, ${list.length} items`);
    const fan = el("div", "fan");
    for (const m of sec === "files" ? pickFiles() : pick(list, 3)) {
      if (sec === "files") {
        const d = el("div", "doc"); d.append(ic("file"), el("span", "", (m.ext || "file").toUpperCase().slice(0, 5)));
        fan.append(d);
      } else {
        const img = el("img"); img.alt = ""; img.src = thumb(m, 480); img.onerror = () => img.remove();
        fan.append(img);
      }
    }
    const icb = el("span", "p-ic"); icb.append(ic(S.icon));
    const arrow = el("span", "p-arrow"); arrow.append(ic("fwd"));
    const meta = el("div", "p-meta"), count = el("div", "p-count");
    meta.append(el("div", "p-title", S.title), count);
    a.append(fan, el("div", "shade"), el("div", "spot"), icb, arrow, meta);
    countUp(count, list.length, S.unit);
    a.addEventListener("click", () => { a.style.viewTransitionName = "portal"; });
    a.addEventListener("pointermove", e => {
      const r = a.getBoundingClientRect();
      a.style.setProperty("--mx", e.clientX - r.left + "px"); a.style.setProperty("--my", e.clientY - r.top + "px");
      a.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5) * 2); a.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5) * 2);
    });
    a.addEventListener("pointerleave", () => { a.style.setProperty("--px", 0); a.style.setProperty("--py", 0); });
    return a;
  }

  function showLanding() {
    sect = null;
    document.body.dataset.view = "landing";
    $("top").hidden = true;
    const root = el("section", "landing");
    const brand = el("div", "brand rise"), gear = el("button", "icon-btn");
    gear.setAttribute("aria-label", "Server address"); gear.append(ic("gear")); gear.onclick = changeServer;
    brand.append(el("span", "mark", "Cinema"), gear);
    const hero = el("div", "hero"), h1 = el("h1");
    greeting().split(" ").forEach((w, i) => {
      const s = el("span", "w"), t = el("span", "", w);
      t.style.setProperty("--i", i); s.append(t); h1.append(s, document.createTextNode(" "));
    });
    const p = el("p", "rise", "Movies, videos, photos and files from your PC, on any screen at home.");
    p.style.setProperty("--i", 3);
    hero.append(h1, p);
    root.append(brand, hero);
    if (libError) root.append(errorPanel());
    else {
      const nav = el("nav", "portals"); nav.setAttribute("aria-label", "Library sections");
      ORDER.forEach((sec, i) => nav.append(portal(sec, i)));
      root.append(nav);
      const back = nav.querySelector(`.portal[data-sec="${lastSec}"]`);   // coming back: the section morphs into its portal
      if (back) back.style.viewTransitionName = "portal";
    }
    $("view").replaceChildren(root);
  }

  // ---- section pages ----
  function showSection(sec, path) {
    lastSec = sec;
    document.body.dataset.view = "section";
    $("top").hidden = false;
    $("search").value = ""; $("search").placeholder = `Search ${SECTIONS[sec].title.toLowerCase()}`;
    const S = SECTIONS[sec], wrap = el("section", "sect"), head = el("div", "sect-head"), body = el("div", "sect-body");
    const n = S.list().length;
    head.append(el("h1", "", S.title), el("p", "", libError ? "Offline" : `${n.toLocaleString()} ${n === 1 ? S.unit[0] : S.unit[1]}`));
    head.style.viewTransitionName = "portal";
    wrap.append(head, body);
    $("view").replaceChildren(wrap);
    sect = { sec, path, body };
    renderBody();
  }
  function refreshSection() { if (sect) renderBody(); }

  function renderBody() {
    const { sec, path, body } = sect, q = $("search").value.trim().toLowerCase();
    body.replaceChildren();
    if (libError) return void body.append(errorPanel());
    if (sec === "files") return renderFiles(body, path, q);
    const list = SECTIONS[sec].list(), items = q ? list.filter(m => m.path.toLowerCase().includes(q)) : list;
    if (!items.length) return void body.append(emptyPanel(q ? "Nothing matches your search." : SECTIONS[sec].empty));
    if (sec === "images") renderImages(body, items); else renderVideos(body, items, !q);
  }

  function byFolder(items) {
    const g = new Map();
    for (const m of items) g.set(m.folder, [...(g.get(m.folder) ?? []), m]);
    return g;
  }

  function videoCard(m, i) {
    const b = el("button", "card reveal"); b.style.setProperty("--d", (i % 8) * 60 + "ms");
    b.setAttribute("aria-label", "Play " + m.title);
    const th = el("div", "thumb"), img = el("img");
    img.loading = "lazy"; img.alt = ""; img.src = thumb(m); imgIn(img, m, false);
    const pg = el("div", "pg"), disc = el("span"); disc.append(ic("play")); pg.append(disc);
    th.append(el("span", "initial", m.title.charAt(0).toUpperCase()), img, pg, el("span", "badge", m.ext.toUpperCase()));
    const g = getProg(m.path);
    if (g && g.t > 10) { const bar = el("div", "prog"), fill = el("i"); fill.style.width = Math.min(100, (g.t / g.d) * 100) + "%"; bar.append(fill); th.append(bar); }
    b.append(th, el("div", "ctitle", m.title), el("div", "cmeta", fmtSize(m.size)));
    b.onclick = () => void openMovie(m, th);
    return b;
  }
  function group(title, items) {
    const s = el("section"), grid = el("div", "vgrid");
    grid.append(...items.map(videoCard));
    s.append(el("h2", "", title), grid);
    return s;
  }
  function renderVideos(body, items, withContinue) {
    if (withContinue) {
      const cont = items.map(m => ({ m, g: getProg(m.path) })).filter(x => resumable(x.g)).sort((a, b) => b.g.at - a.g.at).slice(0, 8);
      if (cont.length) body.append(group("Continue watching", cont.map(x => x.m)));
    }
    for (const [folder, ms] of byFolder(items)) body.append(group(folder || "Library", ms));
    armReveal(body);
  }

  function renderImages(body, items) {
    let n = 0;
    for (const [folder, ms] of byFolder(items)) {
      const s = el("section"), grid = el("div", "igrid");
      for (const m of ms) {
        const idx = n++, t = el("button", "tile reveal" + (idx % 9 === 4 ? " wide" : "")), img = el("img");
        t.style.setProperty("--d", (idx % 10) * 45 + "ms"); t.setAttribute("aria-label", "Open " + m.title);
        img.loading = "lazy"; img.alt = m.title; img.src = thumb(m); imgIn(img, m, true);
        t.append(img); tileFor.set(m, t);
        t.onclick = () => openLightbox(items, idx, t);
        grid.append(t);
      }
      s.append(el("h2", "", folder || "Library"), grid);
      body.append(s);
    }
    armReveal(body);
  }

  function renderFiles(body, path, q) {
    const crumbs = el("nav", "crumbs"); crumbs.setAttribute("aria-label", "Folder path");
    const root = el("a", "", "All files"); root.href = "#/files"; crumbs.append(root);
    let acc = "";
    for (const seg of path ? path.split("/") : []) {
      acc += (acc ? "/" : "") + seg;
      const a = el("a", "", seg); a.href = "#/files/" + enc(acc);
      crumbs.append(el("span", "sep", "/"), a);
    }
    body.append(crumbs);

    let rows;
    if (q) rows = files.filter(f => f.path.toLowerCase().includes(q)).slice(0, 400).map(f => ({ kind: "file", f }));
    else {
      const prefix = path ? path + "/" : "", dirs = new Map(), fl = [];
      for (const f of files) {
        if (!f.path.startsWith(prefix)) continue;
        const rest = f.path.slice(prefix.length), j = rest.indexOf("/");
        if (j < 0) fl.push(f); else { const d = rest.slice(0, j); dirs.set(d, (dirs.get(d) || 0) + 1); }
      }
      rows = [...[...dirs].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([name, count]) => ({ kind: "dir", name, count })),
        ...fl.map(f => ({ kind: "file", f }))];
    }
    if (!rows.length) return void body.append(emptyPanel(q ? "Nothing matches your search." : SECTIONS.files.empty));

    const list = el("div", "flist"), more = el("button", "pill more");
    let shown = 0;
    const draw = () => {
      const end = Math.min(rows.length, shown + 200);
      for (let i = shown; i < end; i++) list.append(fileRow(rows[i], path, i - shown, !!q));
      shown = end; more.hidden = shown >= rows.length; more.textContent = `Show more (${rows.length - shown})`;
      armReveal(list);
    };
    more.onclick = draw;
    body.append(list, more); draw();
  }
  function fileRow(r, path, i, flat) {
    const dir = r.kind === "dir", a = el("a", "frow reveal" + (dir ? " dir" : ""));
    a.style.setProperty("--d", Math.min(i, 10) * 40 + "ms");
    if (dir) a.href = "#/files/" + enc(path ? path + "/" + r.name : r.name);
    else { a.href = dlUrl(r.f); a.setAttribute("download", r.f.name); }
    const fi = el("span", "fi"); fi.append(ic(dir ? "folder" : r.f.cat === "images" ? "image" : r.f.cat ? "video" : "file"));
    const nm = el("span", "fname"); nm.append(el("b", "", dir ? r.name : r.f.name));
    if (flat && !dir && r.f.folder) nm.append(el("small", "", r.f.folder));
    const go = el("span", "fgo"); go.append(ic(dir ? "fwd" : "download"));
    a.append(fi, nm,
      el("span", "fsize", dir ? `${r.count.toLocaleString()} items` : fmtSize(r.f.size)),
      el("span", "fdate", dir ? "" : new Date(r.f.mtime * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })), go);
    return a;
  }

  // light follows the pointer over any card, tile or portal
  $("view").addEventListener("pointermove", e => {
    const c = e.target.closest(".card,.tile");
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px");
  });

  async function init() {
    const boot = el("div", "boot"); boot.append(el("span", "", "Cinema"));
    $("view").replaceChildren(boot);
    await loadLibrary();
    route(true);
  }
  void init();
})();
