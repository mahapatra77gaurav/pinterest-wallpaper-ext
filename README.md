# Pinterest Dynamic New Tab (Chrome Extension)

A Chrome extension (Manifest V3) that transforms your default new tab page into a dynamic, aesthetic Pinterest wallpaper cycler with native Chrome shortcut tiles, real-time clock, quick web search, and a glassmorphic settings modal.

![New Tab Preview](assets/icon-128.png)

## ✨ Features

- **Dynamic Wallpaper Cycler**: Stream and cycle through any public Pinterest board.
- **Dual-Layer Crossfading**: Seamless transitions between wallpapers without white flashes.
- **High-Resolution Upgrader**: Automatically resolves Pinterest thumbnails to high-definition original resolution (`/originals/`).
- **Native Chrome Shortcuts**: Displays top visited sites with Google S2 favicons in a frosted glass dock.
- **Minimalist Clock & Date**: Live clock with support for 12-hour and 24-hour formats.
- **Integrated Web Search**: Sleek, non-intrusive Google search bar.
- **Glassmorphic Settings Modal**:
  - Configure Pinterest Username & Board Slug.
  - Customize cycle interval (in seconds).
  - Adjust background overlay dimming and blur.
  - Quick-select aesthetic presets (Architecture, Space, Nature, Minimalist, Concept Art).
- **Keyboard Shortcuts**:
  - `→` (Right Arrow): Next wallpaper
  - `←` (Left Arrow): Previous wallpaper
  - `Space`: Pause / Resume cycling

## 🚀 Installation

1. Clone or download this repository:
   ```bash
   git clone <REPO_URL>
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (top-left corner).
5. Select this project directory (`pinterest-wallpaper-ext`).
6. Open a new tab (`Ctrl + T` / `Cmd + T`).

## 📁 Project Structure

```text
├── manifest.json       # Manifest V3 extension configuration
├── newtab.html         # New tab layout & modal dialogs
├── style.css           # Glassmorphism design system & animations
├── newtab.js           # Clock, RSS parser, cycler & storage engine
├── assets/             # Extension icons (16px, 48px, 128px)
├── generate_icons.js   # Script for generating PNG icon assets
└── server.js           # Local HTTP server for development/preview
```

## 🛠️ Permissions

- `topSites`: Reads top visited sites for shortcut tiles.
- `storage`: Persists custom board preferences, intervals, and display formats.
- `host_permissions`: Access to `https://www.pinterest.com/*` and `https://*.pinimg.com/*` for fetching RSS feeds and loading wallpapers.

## 📄 License

MIT License
