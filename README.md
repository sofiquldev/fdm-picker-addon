# Video Picker for Free Download Manager

Version **1.0.0**

Download videos from YouTube, Facebook, Instagram, X (Twitter), and many other sites using Free Download Manager 6.

## What’s included

1. **FDM add-on** (`VideoPicker.fda`) – resolves video URLs with [yt-dlp](https://github.com/yt-dlp/yt-dlp)
2. **Browser extension** – detect the current video, copy the link, or send it to FDM
3. **Native bridge** – lets the extension talk to Free Download Manager on your computer

```
Browser → Bridge → Free Download Manager → Video Picker add-on → yt-dlp → file
```

## Author

**Sofiqul Islam**  
GitHub: [sofiquldev](https://github.com/sofiquldev)  
Website: [sofiqul.dev](https://sofiqul.dev)

## Requirements

- Free Download Manager 6.32 or newer  
  https://www.freedownloadmanager.org/
- Python 3.10+ (FDM can install it when you add the add-on)
- A modern browser: Chrome, Edge, Brave, or Firefox
- Optional: Node.js on your PATH (helps with some YouTube pages)

Works on **Windows**, **macOS**, and **Linux** (FDM + Python). The browser bridge installer below covers each platform.

## Install

Full steps for every OS: [docs/INSTALL.md](docs/INSTALL.md)

### Short version (Windows)

```powershell
.\scripts\build-addon.ps1
.\scripts\build-extension.ps1
.\bridge\install.cmd
```

1. In FDM: **Add-ons → Install from file** → `dist\VideoPicker.fda`
2. Load the `extension` folder as an unpacked extension
3. Restart the browser after installing the bridge

### Short version (macOS / Linux)

```bash
./scripts/build-addon.sh
./scripts/build-extension.sh
./bridge/install-unix.sh
```

Then install `dist/VideoPicker.fda` in FDM and load the extension the same way.

## Usage

- Open a video page (YouTube, Instagram, etc.)
- Use the **download** button on the player overlay, or open the toolbar popup
- Choose **Download** (sends to FDM) or **Copy link**
- In FDM, pick the quality and save

Video titles from the add-on are trimmed to **60 characters** so long names don’t break FDM’s file name field.

## Build

| Script | Output |
|--------|--------|
| `scripts/build-addon.ps1` / `.sh` | `dist/VideoPicker.fda` |
| `scripts/build-extension.ps1` / `.sh` | `dist/videopicker-extension.zip` |

Update yt-dlp when sites change:

```powershell
.\scripts\build-addon.ps1 -YtDlpVersion 2026.07.04
```

```bash
./scripts/build-addon.sh 2026.07.04
```

## Project layout

```
addon/       FDM add-on source
extension/   Browser extension (Manifest V3)
bridge/      Native messaging host + installers
scripts/     Build scripts
docs/        Install notes
dist/        Built packages
```

## Supported sites

- YouTube
- Facebook
- Instagram
- X (Twitter)

Other sites often work through yt-dlp or by detecting media on the page (mp4, m3u8, webm, …).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Extension can’t reach FDM | Re-run the bridge installer, reload the extension, restart the browser |
| FDM not found | Install FDM 6, or set `FDM_PATH` to the FDM binary |
| YouTube fails to parse | Rebuild the add-on with a newer yt-dlp; turn on browser cookies in FDM add-on settings; install Node.js if needed |
| Empty popup | Play the video once, then open the popup again |
| DRM / Netflix-style | Not supported |

## License

MIT – see [LICENSE](LICENSE)

Use only for content you’re allowed to download. Site terms may restrict downloading.
