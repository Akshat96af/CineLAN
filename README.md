<p align="center">
  <img src="assets/banners/hero.svg" alt="Cinelan: your movies, music, photos and files on every screen at home" width="100%">
</p>

<p align="center">
  Cinelan turns the PC that holds your library into a private streaming room for every screen on your wifi: phones, TVs, tablets and other computers.<br>
  One Python file. No accounts, no cloud, nothing to install on the other devices.
</p>

<p align="center">
  <img src="assets/screenshots/landing.png" alt="The Cinelan home screen: a greeting, the latest movie, and five rooms for Movies, Videos, Music, Images and Files" width="100%">
</p>

<h2><img src="assets/banners/h-start.svg" alt="Start" width="100%"></h2>

You need two things on the PC that holds your files:

- **Python 3.8 or newer.** The folder picker uses Tk, which comes with the Windows installer.
- **ffmpeg.** It makes thumbnails, plays MKV files, reads subtitles and converts the few formats a browser can't play. Install it with `winget install Gyan.FFmpeg` on Windows, `brew install ffmpeg` on macOS, or `sudo apt install ffmpeg` on Linux.

Then:

1. Download or clone this repository.
2. Run `python start.py`. On Windows you can double-click `start.py`.
3. Pick the folder that holds your movies, music and photos.
4. Open the link it prints, on any device on the same wifi.

<p align="center">
  <img src="assets/banners/terminal.svg" alt="The console after running start.py: it prints the address to open, for example http://192.168.29.117:6767" width="100%">
</p>

The address is found for you. Cinelan uses port **6767** when it is free and picks a random free port when it is not, and the link on screen always has the right one.

| Command | What it does |
| --- | --- |
| `python start.py` | Opens a window to pick the folder |
| `python start.py "D:\Movies"` | Serves that folder straight away |
| `python start.py "D:\Movies" 8080` | Asks for port 8080 (falls back to a free one if it is taken) |

Press Ctrl+C or close the window to stop it. Cinelan only works while that window is open and the PC is on.

> **Good to know:** anyone on your wifi who has the link can see the folder you picked. There is no login, so use it on a network you trust.

<h2><img src="assets/banners/h-screens.svg" alt="What you get" width="100%"></h2>

Five rooms, sorted for you from the file types in your folder:

| Room | What lands there |
| --- | --- |
| **Movies** | Every `.mkv` file |
| **Videos** | MP4, M4V, MOV, WEBM, AVI, WMV, FLV, MPG, M2TS, 3GP and OGV |
| **Music** | MP3, FLAC, WAV, M4A, AAC, OGG, Opus, WMA, AIFF, APE, ALAC and WavPack, grouped into albums by folder |
| **Images** | JPG, PNG, GIF, WEBP, BMP, AVIF, SVG, HEIC and TIFF, with a full-screen viewer |
| **Files** | Everything, in a folder browser. Tap any file to download it straight to the device |

The home screen also remembers where you stopped: **Resume** picks the film up where you left it, and **Continue watching** appears at the top of the Movies and Videos pages.

<h2><img src="assets/banners/h-music.svg" alt="Music" width="100%"></h2>

Music keeps playing while you move around the app, so you can browse photos or pick a film while a record runs. A dock stays at the bottom of every page.

<table>
  <tr>
    <td width="50%"><img src="assets/screenshots/music.png" alt="The Music page with albums, a playing track with moving equalizer bars, and the dock at the bottom"></td>
    <td width="50%"><img src="assets/screenshots/now-playing.png" alt="The Now Playing sheet with artwork, scrubber, controls and the Up next queue"></td>
  </tr>
</table>

- **Plays natively, at full quality:** MP3, FLAC, WAV, M4A, AAC, OGG and Opus. Seeking is instant.
- **Converted on the fly by your PC:** WMA, AIFF, APE, ALAC and WavPack, as 320 kbps MP3. A file with a familiar extension but a codec the browser lacks switches to conversion by itself.
- **Artwork and tags:** cover art is read from the file, or from `cover.jpg`, `folder.jpg` or `front.png` next to the songs. Title, artist and album come from the file's tags.
- **Now Playing:** tap the dock for large artwork, a scrubber, shuffle, repeat (off, all, one), volume and the Up next queue. Swipe down, press Esc or use Back to put it away.
- **Remembers:** your queue, position, shuffle and repeat survive a reload.
- **Background and lock screen:** on Android it keeps playing with the screen off, with play, pause, next and previous on the lock screen.
- **Movies take over:** starting a film pauses the music, and it waits in the dock until you are done.

<h2><img src="assets/banners/h-player.svg" alt="The player" width="100%"></h2>

<p align="center">
  <img src="assets/screenshots/player.png" alt="The player: title, timeline with time remaining, the main controls and a grouped set of options. Ambient light spills from the picture into the bars above and below it" width="100%">
</p>

**Audio and subtitles**

- Pick any audio track of a film. The choice is remembered by language.
- Subtitles come from three places: tracks inside the file, `.srt`, `.vtt` and `.ass` files that share the film's name, and any `.srt` or `.vtt` you load from the device. Adjust delay and size from the subtitle menu.
- Image subtitles (the kind on Blu-ray discs) are burned into the picture, which makes your PC re-encode the video while they are on.
- Chapters, when the file has them, are listed in their own menu.

**Zoom**

Most widescreen films have black bars on a 16:9 screen. The Zoom button offers **Fit** (the whole picture), **Immersive** (bars halved, a gentle crop), **Fill screen** (no bars, edges cropped) and **Stretch**. On a phone, pinch to zoom and let go to settle back.

**Ambient light**

The film lights the room around it. Open the Zoom button, then **Ambient light**.

| Preset | Look |
| --- | --- |
| Spill | The whole frame, softened, spilling past the picture (default) |
| Mirror | The picture's edges reflected into the black bars |
| Edge | Only the colours along the edges, like a backlit TV |
| Theatre | A dim, wide wash, closest to a real cinema |
| Vivid | Bold colour with a tight spill |
| Custom | Your own settings, saved on that device |

Custom lets you set the style, intensity, softness, colour, size and how quickly the light follows the picture. Changing any setting while on a preset turns it into Custom. Ambient light is switched off on TVs to keep them fast.

**Also in the player:** seek-bar frame previews, playback speed from 0.5x to 2x, A-B loop, picture in picture, automatic next episode, and resume from where you stopped.

<h2><img src="assets/banners/h-tv.svg" alt="TV and phones" width="100%"></h2>

Open the same link in the TV's browser and Cinelan adapts: larger text, safe margins, a clear focus ring and no effects that slow a TV down. TVs are detected automatically. If yours is not, open the link once with `?tv=1` on the end (`?tv=0` turns it off again).

- **Remote control:** the arrow keys move between cards and buttons, OK selects, Back goes back. Play, pause, fast-forward and rewind keys work in the player and for music.
- **Android:** double-tap the left or right side of the picture to skip 10 seconds (tap again to keep going), tap once to show or hide the controls, pinch to zoom, and swipe photos sideways to browse or down to close.
- **iPhone and iPad:** open the link in Safari and use Share, then Add to Home Screen, to get an app icon.
- **Cinelan is not tied to one address.** A link can carry the PC's address with `?server=http://192.168.29.117:6767`, and the gear button on the home screen lets you change it by hand.

<h2><img src="assets/banners/h-help.svg" alt="If something is off" width="100%"></h2>

| Problem | Fix |
| --- | --- |
| The TV or phone cannot open the link | Both must be on the same wifi as the PC. On Windows, allow Python through the firewall for **private networks** when it asks (Windows Security, Firewall, Allow an app). |
| The link stopped working after a restart | The PC's address can change. Use the link `start.py` prints each time, or reserve the PC's address in your router. |
| Thumbnails, MKV or subtitles do not work | ffmpeg is missing. Install it and restart `start.py`. |
| The picture is black but there is sound | The film is HEVC or 10-bit. Turn on the lightning button (compatibility mode) in the player. |
| The page says it cannot find its files | Keep `index.html`, `app.css`, `app.js`, `start.py` and the `assets` folder together. |
| Nothing animates | Windows has "Animation effects" switched off, which browsers report as reduced motion. Add `?motion=1` to the link, or turn the setting on. |
| The page is hosted on GitHub Pages and shows "Open your library" | Browsers do not let an `https` site read from your PC over `http`. The page opens your PC's own link instead. Use that link directly. |

**Limits worth knowing**

- Seeking in converted files (AVI, MKV audio, WMA and similar) restarts the conversion, so it takes a moment instead of being instant.
- Songs do not play gaplessly, so albums that flow from track to track may have a short gap.
- Edge ambient light needs the page to be opened from the PC's own link. Spill and Mirror work everywhere.
- Cinelan has been designed for Chromium-based TV browsers and modern phones. It has not been tested on specific TV models.

## Folder layout

```
start.py          the server: finds your address, picks a port, prints the link
index.html        the page
app.css
app.js            plain JavaScript, no build step
assets/
  fonts/          Geist, Geist Mono and Archivo (SIL Open Font License, licences included)
  screenshots/    the pictures in this README, from a generated demo library
  banners/        the animated text banners in this README
```

The screenshots show a demo library of generated films, songs and photos, not real media.

Fonts: [Geist](https://github.com/vercel/geist-font) and [Archivo](https://github.com/Omnibus-Type/Archivo) are used under the SIL Open Font License 1.1.
