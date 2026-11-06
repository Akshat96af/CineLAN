"""Cinelan: your movies, music, photos and files on every screen at home.

    python start.py                  pick a folder in a window, then it prints the link to open
    python start.py <folder>         serve that folder
    python start.py <folder> <port>  ask for a specific port

Port: 6767 when it is free, otherwise a random free one. The link printed on start uses this PC's own address on the
wifi, so you can open it from a phone, a TV or another computer. The page files (index.html, app.css, app.js and the
assets/ folder) sit next to this script. Optional HTTPS: put cert.pem and key.pem next to this script.
"""
import json, math, os, socket, ssl, subprocess, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote, unquote, urlparse, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PORT = 6767
ROOT = None  # the folder being served; chosen in main()
IMGEXT = {".jpg", ".jpeg", ".jfif", ".png", ".gif", ".webp", ".bmp", ".avif", ".svg", ".heic", ".heif", ".tif", ".tiff"}
AUDIOEXT = {".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".wma", ".aiff", ".aif", ".ape", ".alac", ".wv"}
SKIP_DIRS = {"$recycle.bin", "system volume information", "node_modules", "__pycache__"}
# where index.html, app.css, app.js and assets/ may live: beside this script (normal), or in a folder next to it
UI_DIRS = [HERE, os.path.join(HERE, "cinelan"), os.path.join(HERE, "MoviesServer")]
FONTS = "assets/fonts/"
WEB = {"/": ("index.html", "text/html; charset=utf-8"), "/index.html": ("index.html", "text/html; charset=utf-8"),
       "/app.js": ("app.js", "text/javascript"), "/app.css": ("app.css", "text/css"),
       "/" + FONTS + "geist-latin-wght-normal.woff2": (FONTS + "geist-latin-wght-normal.woff2", "font/woff2"),
       "/" + FONTS + "geist-mono-latin-wght-normal.woff2": (FONTS + "geist-mono-latin-wght-normal.woff2", "font/woff2"),
       "/" + FONTS + "archivo-latin-wdth-normal.woff2": (FONTS + "archivo-latin-wdth-normal.woff2", "font/woff2")}
THUMBS = {}                       # (path, mtime, width, second) -> jpeg bytes; in-memory, lost on restart
IMAGE_SUBS = {"hdmv_pgs_subtitle", "dvd_subtitle", "dvb_subtitle", "xsub"}  # bitmaps: can't become text
SUBEXT = {".srt", ".vtt", ".ass", ".ssa"}
SUBS = {}                         # (path, mtime, map) -> webvtt bytes; extraction reads the whole file, so cache it
THUMB_SLOTS = threading.Semaphore(2)  # a full grid would otherwise spawn dozens of ffmpegs at once


def ui_file(name):
    for d in UI_DIRS:
        if os.path.isfile(os.path.join(d, "index.html")) and os.path.isfile(os.path.join(d, name)):
            return os.path.join(d, name)
    return None


def num(q, k, default=0.0):
    """Non-negative finite number from the query string, else default (keeps junk out of ffmpeg args)."""
    try:
        v = float(q.get(k, [default])[0])
    except ValueError:
        return default
    return v if math.isfinite(v) and v >= 0 else default


def list_files():
    """Every file under ROOT as [relative path, bytes, mtime]; hidden and system folders are skipped."""
    out = []
    for d, dirs, fs in os.walk(ROOT):
        dirs[:] = [x for x in dirs if not x.startswith(".") and x.lower() not in SKIP_DIRS]
        for f in fs:
            if f.startswith("."):
                continue
            p = os.path.join(d, f)
            try:
                st = os.stat(p)
            except OSError:
                continue
            out.append([os.path.relpath(p, ROOT).replace("\\", "/"), st.st_size, int(st.st_mtime)])
    return out


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):  # a quiet console: the link stays visible instead of scrolling away under request logs
        pass

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")  # the UI may live on another origin
        self.send_header("Access-Control-Allow-Private-Network", "true")  # public site -> LAN server (Chrome)
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Range")
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        if u.path in WEB:
            name, ctype = WEB[u.path]
            p = ui_file(name)
            if p is None:  # say exactly what is wrong instead of a bare 404
                where = "".join(f"<li>{d}</li>" for d in UI_DIRS)
                page = (f"<!doctype html><meta charset=utf-8><body style='font:16px system-ui;background:#060607;color:#eee;padding:32px;line-height:1.6'>"
                        f"<h2>Cinelan can't find its page files</h2><p>The server is running, but <b>{name}</b> was not found next to <code>start.py</code>. "
                        f"Keep <code>index.html</code>, <code>app.css</code>, <code>app.js</code> and the <code>assets</code> folder together with start.py. Looked in:</p><ul>{where}</ul>")
                return self.send_bytes(page.encode(), "text/html; charset=utf-8")
            with open(p, "rb") as f:   # no-cache: after an update, a refresh must show the new page, never a stale copy
                return self.send_bytes(f.read(), ctype, cache=True if name.startswith(FONTS) else "no-cache")
        if u.path.startswith("/api/thumb/"):
            return self.thumb(self.translate_path(unquote(u.path[10:])), parse_qs(u.query))
        if u.path == "/api/files":
            return self.send_bytes(json.dumps(list_files()).encode(), "application/json")
        q = parse_qs(u.query)
        if u.path.startswith("/api/tracks/"):
            return self.tracks(self.translate_path(unquote(u.path[11:])))
        if u.path.startswith("/api/sub/"):
            return self.sub(self.translate_path(unquote(u.path[8:])), q)
        if u.path.startswith("/stream/"):
            return self.stream(self.translate_path(unquote(u.path[7:])), q)
        if u.path.startswith("/audio/"):
            return self.audio(self.translate_path(unquote(u.path[6:])), q)
        return self.serve_file(self.translate_path(unquote(u.path)), "dl" in q)

    do_HEAD = do_GET

    def send_bytes(self, b, ctype, cache=False):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        if cache:
            self.send_header("Cache-Control", "public, max-age=86400" if cache is True else cache)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(b)

    def thumb(self, path, q):
        """JPEG preview, w px wide: a video frame (at 10s, else the first frame) or a downscaled image."""
        if not os.path.isfile(path):
            return self.send_error(404)
        w = min(max(int(num(q, "w", 480)), 120), 4096)
        at = str(int(num(q, "t"))) if "t" in q else None  # seek-bar previews ask for a specific second
        key = (path, os.path.getmtime(path), w, at)
        if key not in THUMBS:
            ext = os.path.splitext(path)[1].lower()
            image = ext in IMGEXT or ext in AUDIOEXT  # single frame: a picture, or a song's embedded cover art
            with THUMB_SLOTS:
                # clips shorter than 10s have no frame at 10s, so fall back to the first frame
                for ss in ((None,) if image else (at,) if at else ("10", "0")):
                    r = subprocess.run(["ffmpeg", "-v", "error", *(["-ss", ss] if ss else []), "-i", path, "-frames:v", "1",
                                        "-vf", f"scale='min({w},iw)':-2", "-pix_fmt", "yuvj420p", "-c:v", "mjpeg", "-f", "image2pipe", "pipe:1"],
                                       capture_output=True, stdin=subprocess.DEVNULL)
                    if r.stdout:
                        THUMBS[key] = r.stdout
                        break
                else:
                    THUMBS[key] = b""  # remember "no picture" so a song without artwork doesn't re-run ffmpeg on every request
        if not THUMBS[key]:
            return self.send_error(404)
        self.send_bytes(THUMBS[key], "image/jpeg", cache=True)

    def tracks(self, path):
        """Duration, audio/subtitle tracks (i = index within its type, as ffmpeg's -map 0:a:i / 0:s:i), sidecar subs, chapters, tags."""
        if not os.path.isfile(path):
            return self.send_error(404)
        r = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_chapters", "-show_format", "-of", "json", path],
                           capture_output=True, text=True, stdin=subprocess.DEVNULL)
        try:
            j = json.loads(r.stdout)
        except ValueError:
            j = {}
        out = {"duration": 0.0, "audio": [], "subs": [], "side": [], "chapters": [], "tags": {}}
        tags = {k.lower(): v for k, v in j.get("format", {}).get("tags", {}).items()}
        for s in j.get("streams", []):  # Ogg/Opus keep their tags on the audio stream instead
            if s.get("codec_type") == "audio":
                for k, v in s.get("tags", {}).items():
                    tags.setdefault(k.lower(), v)
                break
        out["tags"] = {k: str(tags.get(k, "")) for k in ("title", "artist", "album_artist", "album", "track", "date", "genre")}
        try:
            out["duration"] = float(j.get("format", {}).get("duration", 0))
        except ValueError:
            pass
        for s in j.get("streams", []):
            tags, disp = s.get("tags", {}), s.get("disposition", {})
            info = {"lang": tags.get("language", ""), "title": tags.get("title", ""), "codec": s.get("codec_name", ""),
                    "default": bool(disp.get("default"))}
            if s.get("codec_type") == "audio":
                out["audio"].append({**info, "i": len(out["audio"]), "ch": s.get("channels", 0)})
            elif s.get("codec_type") == "subtitle":
                out["subs"].append({**info, "i": len(out["subs"]), "image": info["codec"] in IMAGE_SUBS})
        for c in j.get("chapters", []):
            try:
                out["chapters"].append({"start": float(c.get("start_time", 0)), "title": c.get("tags", {}).get("title", "")})
            except ValueError:
                pass
        d, base = os.path.dirname(path), os.path.splitext(os.path.basename(path))[0].lower()
        for f in sorted(os.listdir(d)):
            if os.path.splitext(f)[1].lower() in SUBEXT and f.lower().startswith(base):
                out["side"].append(os.path.relpath(os.path.join(d, f), ROOT).replace("\\", "/"))
        self.send_bytes(json.dumps(out).encode(), "application/json")

    def sub(self, path, q):
        """WebVTT for an embedded text track (?s=N on the video) or a sidecar subtitle file."""
        if not os.path.isfile(path):
            return self.send_error(404)
        if "s" in q:
            sel = ["-map", f"0:s:{int(num(q, 's'))}"]
        elif os.path.splitext(path)[1].lower() in SUBEXT:
            sel = []
        else:
            return self.send_error(400)
        key = (path, os.path.getmtime(path), tuple(sel))
        if key not in SUBS:
            r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, *sel, "-f", "webvtt", "pipe:1"],
                               capture_output=True, stdin=subprocess.DEVNULL)
            if not r.stdout:
                return self.send_error(404)
            SUBS[key] = r.stdout
        self.send_bytes(SUBS[key], "text/vtt; charset=utf-8")

    def serve_file(self, path, download=False):
        # python's stock handler ignores Range, which breaks seeking
        if not os.path.isfile(path):
            return self.send_error(404)
        size, start, end, code = os.path.getsize(path), 0, None, 200
        r = self.headers.get("Range", "")
        if r.startswith("bytes="):
            a, _, b = r[6:].partition("-")
            start = int(a) if a else max(size - int(b), 0)
            end = int(b) if (a and b) else size - 1
            end, code = min(end, size - 1), 206
            if start > end:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
        end = size - 1 if end is None else end
        self.send_response(code)
        self.send_header("Content-Type", self.guess_type(path))
        if download:  # ?dl=1 makes the browser save the file instead of opening it
            name = os.path.basename(path)
            plain = name.encode("ascii", "replace").decode().replace('"', "_").replace("?", "_")
            self.send_header("Content-Disposition", f"attachment; filename=\"{plain}\"; filename*=UTF-8''{quote(name)}")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if code == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        if self.command == "HEAD":
            return
        try:
            with open(path, "rb") as f:
                f.seek(start)
                left = end - start + 1
                while left > 0:
                    chunk = f.read(min(1 << 20, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def stream(self, path, q):
        # t = start offset (seeking = restart ffmpeg; with video copy it lands on the previous keyframe)
        # a = audio track, bs = image-subtitle track to burn into the picture (forces a video re-encode), v = force re-encode
        if not os.path.isfile(path):
            return self.send_error(404)
        t, a = num(q, "t"), int(num(q, "a"))
        bs = int(num(q, "bs")) if "bs" in q else None
        vin = ["-map", "0:v:0"] if bs is None else ["-filter_complex", f"[0:v:0][0:s:{bs}]overlay[v]", "-map", "[v]"]
        reencode = "v" in q or bs is not None
        vcodec = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p"] if reencode else ["-c:v", "copy"]
        cmd = ["ffmpeg", "-v", "error", "-ss", str(t), "-i", path, *vin, "-map", f"0:a:{a}?", *vcodec,
               "-c:a", "aac", "-ac", "2", "-b:a", "192k", "-movflags", "frag_keyframe+empty_moov+default_base_moof",
               "-f", "mp4", "pipe:1"]
        return self.pipe(cmd, "video/mp4")

    def audio(self, path, q):
        """Songs the browser can't decode (WMA, AIFF, APE, ALAC...) as 320k MP3; t = start offset, so seeking restarts here too."""
        if not os.path.isfile(path):
            return self.send_error(404)
        cmd = ["ffmpeg", "-v", "error", "-ss", str(num(q, "t")), "-i", path, "-vn", "-map", "0:a:0",
               "-c:a", "libmp3lame", "-b:a", "320k", "-f", "mp3", "pipe:1"]
        return self.pipe(cmd, "audio/mpeg")

    def pipe(self, cmd, ctype):
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stdin=subprocess.DEVNULL)
        try:
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            while chunk := p.stdout.read(1 << 16):
                self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            p.kill()


# ---- startup: folder, port, address, link -------------------------------------------------------------------------

def pick_folder():
    try:
        import tkinter
        from tkinter import filedialog
        tk = tkinter.Tk()
        tk.withdraw()
        tk.attributes("-topmost", True)  # otherwise the dialog can open behind other windows
        folder = filedialog.askdirectory(title="Select the folder to serve")
        tk.destroy()
        return folder
    except ImportError:  # Python without Tk: ask in the console instead
        return input("Folder to serve: ").strip().strip('"')


def lan_ip():
    """This PC's address on the wifi/LAN. The UDP connect sends no traffic; it only makes the OS pick the outgoing interface."""
    for target in ("10.255.255.255", "192.168.255.255", "8.8.8.8"):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect((target, 1))
            ip = s.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
        except OSError:
            pass
        finally:
            s.close()
    try:
        ip = socket.gethostbyname(socket.gethostname())
        if not ip.startswith("127."):
            return ip
    except OSError:
        pass
    return "127.0.0.1"


def in_use(port):
    """True when something is already listening there. Connecting is the reliable test: on Windows a plain bind can succeed twice."""
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.3):
            return True
    except OSError:
        return False


def open_server(preferred):
    """Bind the preferred port if free, else let the OS hand out a random free one. Returns (server, port, wanted_port_was_busy)."""
    if os.name == "nt":
        ThreadingHTTPServer.allow_reuse_address = False  # on Windows SO_REUSEADDR lets two servers share one port
    busy = in_use(preferred)
    for port in (() if busy else (preferred,)) + (0,):
        try:
            srv = ThreadingHTTPServer(("0.0.0.0", port), H)
            return srv, srv.server_address[1], busy
        except OSError:
            busy = True
    sys.exit("Could not open any port.")


def banner(scheme, lan, port, busy, wanted):
    on = sys.stdout.isatty()
    if on and os.name == "nt":
        os.system("")  # switches the Windows console to understand colour codes
    gold = lambda s: f"\033[38;2;242;201;138m{s}\033[0m" if on else s
    dim = lambda s: f"\033[2m{s}\033[0m" if on else s
    bold = lambda s: f"\033[1m{s}\033[0m" if on else s
    print()
    print("  " + bold("C I N E L A N"))
    print("  " + dim("your movies, music, photos and files on every screen at home"))
    print()
    print("  Open this on any phone, TV or computer on your wifi:")
    print()
    print("      " + gold(bold(f"{scheme}://{lan}:{port}")))
    print()
    if busy:
        print("  " + dim(f"Port {wanted} was busy, so a free one was picked instead."))
    print("  " + dim(f"On this PC     {scheme}://localhost:{port}"))
    print("  " + dim(f"Your library   {ROOT}"))
    if not ui_file("index.html"):
        print("\n  Page files not found next to start.py: the page will say what is missing.")
    print("  " + dim("Stop           press Ctrl+C or close this window"))
    print()


def main():
    global ROOT
    try:
        sys.stdout.reconfigure(errors="replace")  # an odd character in a folder name must never crash the banner
    except (AttributeError, ValueError):
        pass
    folder = sys.argv[1] if len(sys.argv) > 1 else pick_folder()
    if not folder or not os.path.isdir(folder):
        sys.exit("No folder selected." if not folder else f"Not a folder: {folder}")
    ROOT = os.path.abspath(folder)
    try:
        wanted = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_PORT
    except ValueError:
        wanted = DEFAULT_PORT
    srv, port, busy = open_server(wanted)
    scheme = "http"
    cert, key = os.path.join(HERE, "cert.pem"), os.path.join(HERE, "key.pem")
    if os.path.exists(cert) and os.path.exists(key):
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(cert, key)
        srv.socket, scheme = ctx.wrap_socket(srv.socket, server_side=True), "https"
    banner(scheme, lan_ip(), port, busy, wanted)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.\n")


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        if e.code not in (None, 0):  # a double-clicked window would vanish before the message could be read
            print(f"\n  {e.code}\n")
            if sys.stdin and sys.stdin.isatty():
                input("  Press Enter to close...")
    except Exception as e:  # same: show what went wrong and keep the window open
        print(f"\n  Something went wrong: {e}\n")
        if sys.stdin and sys.stdin.isatty():
            input("  Press Enter to close...")
