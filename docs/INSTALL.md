# Install guide (Windows, macOS, Linux)

Video Picker **1.0.0**  
Author: Sofiqul Islam · https://github.com/sofiquldev · https://sofiqul.dev

You need three pieces working together: the FDM add-on, the browser extension, and the native bridge.

---

## 1. Free Download Manager

Install FDM 6.32+ from https://www.freedownloadmanager.org/ for your OS.

Python 3.10+ is required for the add-on. FDM can install Python when you add the `.fda` file.

---

## 2. Build packages (optional if you already have `dist/`)

### Windows (PowerShell)

```powershell
cd path\to\fdm
.\scripts\build-addon.ps1
.\scripts\build-extension.ps1
```

### macOS / Linux

```bash
cd path/to/fdm
chmod +x scripts/*.sh bridge/install-unix.sh
./scripts/build-addon.sh
./scripts/build-extension.sh
```

Outputs:

- `dist/VideoPicker.fda`
- `dist/videopicker-extension.zip`

---

## 3. Install the FDM add-on

Same on all platforms:

1. Open Free Download Manager
2. Menu → **Add-ons**
3. Install add-on from file → select `VideoPicker.fda`
4. Allow Python if asked
5. For private / logged-in videos, enable **Allow add-ons to use web browser cookies** in add-on settings

Test: **Add URL**, paste a YouTube link, confirm formats show up.

---

## 4. Load the browser extension

### Chrome / Edge / Brave (all OS)

1. Open `chrome://extensions` or `edge://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → choose the `extension` folder  
   (or unpack `videopicker-extension.zip` first)
4. Extension ID should be: `cecbjfflmkdkpejjjbmpmlppgbpgmanm`

### Firefox (all OS)

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → select `extension/manifest.json`
3. Firefox ID: `videopicker@fdm.local`

Note: temporary add-ons in Firefox are removed when Firefox quits. For daily use, keep the folder and load again, or package for AMO later.

---

## 5. Install the native bridge

The bridge registers a native messaging host named `org.fdm.videopicker` so the extension can start FDM with a URL.

### Windows

```powershell
.\bridge\install.cmd
```

or:

```powershell
.\bridge\install-windows.ps1
```

Then fully quit the browser and open it again.

Uninstall:

```powershell
.\bridge\uninstall-windows.ps1
```

### macOS

```bash
./bridge/install-unix.sh
```

This writes:

- Chrome: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/org.fdm.videopicker.json`
- Edge: `~/Library/Application Support/Microsoft Edge/NativeMessagingHosts/`
- Brave: `~/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/`
- Firefox: `~/Library/Application Support/Mozilla/NativeMessagingHosts/`

Restart the browser after install.

### Linux

```bash
./bridge/install-unix.sh
```

Typical paths:

- Chrome: `~/.config/google-chrome/NativeMessagingHosts/`
- Chromium: `~/.config/chromium/NativeMessagingHosts/`
- Edge: `~/.config/microsoft-edge/NativeMessagingHosts/`
- Brave: `~/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/`
- Firefox: `~/.mozilla/native-messaging-hosts/`

If FDM isn’t found automatically, set:

```bash
export FDM_PATH=/path/to/fdm
```

before using the extension, or put that in your shell profile.

---

## 6. Quick check

1. Open a YouTube video
2. Click the download overlay on the player, or open the extension popup → Download
3. FDM should open with the URL / format list

If the extension says the native host is missing or forbidden, re-run the bridge installer and restart the browser.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `FDM_PATH` | Full path to the FDM executable (`fdm.exe` / `fdm`) |
| `VIDEO_PICKER_PYTHON` | Optional Python path (used only if you extend the bridge) |

---

## Support

Issues and updates: https://github.com/sofiquldev  
Site: https://sofiqul.dev
