/**
 * Pinterest Dynamic New Tab (Manifest V3)
 * High-performance, aesthetic wallpaper cycler and native Chrome shortcuts.
 */

// =============================================================================
// State & Configuration Defaults
// =============================================================================

const DEFAULT_CONFIG = {
  username: 'pinterest',
  board: 'wallpapers',
  interval: 30, // seconds
  timeFormat: '12h',
  dim: 25, // percentage
  blur: 0 // pixels
};

// Curated high-res aesthetic fallback wallpapers (Unsplash CDN) in case of network issues or empty boards
const FALLBACK_WALLPAPERS = [
  {
    title: 'Neon Cyberpunk Cityscape',
    url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?q=80&w=2560&auto=format&fit=crop',
    link: 'https://unsplash.com'
  },
  {
    title: 'Misty Alpine Mountain Ridge',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2560&auto=format&fit=crop',
    link: 'https://unsplash.com'
  },
  {
    title: 'Minimalist Architecture & Curves',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=2560&auto=format&fit=crop',
    link: 'https://unsplash.com'
  },
  {
    title: 'Deep Space Cosmic Nebula',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2560&auto=format&fit=crop',
    link: 'https://unsplash.com'
  },
  {
    title: 'Moody Autumn Forest Road',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=2560&auto=format&fit=crop',
    link: 'https://unsplash.com'
  }
];

let appState = {
  config: { ...DEFAULT_CONFIG },
  wallpapers: [],
  currentIndex: 0,
  activeLayer: 1, // 1 for #bg-1, 2 for #bg-2
  cycleTimer: null,
  isPaused: false,
  isLoadingFeed: false
};

// =============================================================================
// DOM Elements
// =============================================================================

const elements = {
  bg1: document.getElementById('bg-1'),
  bg2: document.getElementById('bg-2'),
  time: document.getElementById('time'),
  date: document.getElementById('date'),
  shortcuts: document.getElementById('shortcuts'),
  pinLink: document.getElementById('pin-link'),
  pinTitle: document.getElementById('pin-title'),
  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),
  pauseBtn: document.getElementById('pause-btn'),
  pauseIcon: document.getElementById('pause-icon'),
  playIcon: document.getElementById('play-icon'),
  settingsBtn: document.getElementById('settings-btn'),
  settingsDialog: document.getElementById('settings-dialog'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  cancelBtn: document.getElementById('cancel-btn'),
  resetBtn: document.getElementById('reset-btn'),
  settingsForm: document.getElementById('settings-form'),
  inputUsername: document.getElementById('input-username'),
  inputBoard: document.getElementById('input-board'),
  inputInterval: document.getElementById('input-interval'),
  inputTimeFormat: document.getElementById('input-timeformat'),
  inputDim: document.getElementById('input-dim'),
  inputBlur: document.getElementById('input-blur'),
  dimVal: document.getElementById('dim-val'),
  blurVal: document.getElementById('blur-val'),
  statusMsg: document.getElementById('status-msg'),
  statusIcon: document.getElementById('status-icon'),
  presetChips: document.querySelectorAll('.preset-chip'),
  toast: document.getElementById('toast'),
  searchForm: document.getElementById('search-form'),
  searchInput: document.getElementById('search-input')
};

// =============================================================================
// Storage Layer (Chrome Storage with LocalStorage fallback)
// =============================================================================

async function loadConfig() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['pinterestConfig'], (result) => {
        if (result && result.pinterestConfig) {
          resolve({ ...DEFAULT_CONFIG, ...result.pinterestConfig });
        } else {
          resolve({ ...DEFAULT_CONFIG });
        }
      });
    } else {
      try {
        const saved = localStorage.getItem('pinterestConfig');
        resolve(saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG });
      } catch (e) {
        resolve({ ...DEFAULT_CONFIG });
      }
    }
  });
}

async function saveConfig(newConfig) {
  appState.config = { ...appState.config, ...newConfig };
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ pinterestConfig: appState.config }, () => {
        resolve();
      });
    } else {
      try {
        localStorage.setItem('pinterestConfig', JSON.stringify(appState.config));
      } catch (e) {}
      resolve();
    }
  });
}

// =============================================================================
// Clock & Date System
// =============================================================================

function updateClock() {
  const now = new Date();
  
  // Format Time
  const is12h = appState.config.timeFormat === '12h';
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  if (is12h) {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    elements.time.textContent = `${hours}:${minutes} ${ampm}`;
  } else {
    const formattedHours = String(hours).padStart(2, '0');
    elements.time.textContent = `${formattedHours}:${minutes}`;
  }

  // Format Date (e.g. "Friday, August 14")
  const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  elements.date.textContent = now.toLocaleDateString(undefined, dateOptions);
}

function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

// =============================================================================
// Chrome Top Sites & Shortcuts Dock
// =============================================================================

function getDomain(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return urlStr;
  }
}

function renderShortcuts(sites) {
  elements.shortcuts.innerHTML = '';
  
  const siteList = (sites && sites.length > 0) ? sites.slice(0, 10) : [
    { title: 'Google', url: 'https://www.google.com' },
    { title: 'YouTube', url: 'https://www.youtube.com' },
    { title: 'GitHub', url: 'https://www.github.com' },
    { title: 'Pinterest', url: 'https://www.pinterest.com' },
    { title: 'Reddit', url: 'https://www.reddit.com' },
    { title: 'Twitter', url: 'https://www.x.com' },
    { title: 'Spotify', url: 'https://open.spotify.com' },
    { title: 'Netflix', url: 'https://www.netflix.com' }
  ];

  siteList.forEach((site) => {
    const domain = getDomain(site.url);
    const title = site.title || domain;
    const faviconUrl = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(site.url)}&sz=64`;
    const initial = (title || 'W').charAt(0).toUpperCase();

    const link = document.createElement('a');
    link.className = 'shortcut-card';
    link.href = site.url;
    link.title = `${title} (${site.url})`;

    const iconBox = document.createElement('div');
    iconBox.className = 'shortcut-icon-box';

    const img = document.createElement('img');
    img.className = 'shortcut-icon-img';
    img.src = faviconUrl;
    img.alt = title;
    img.loading = 'lazy';

    // Fallback letter avatar on error
    img.onerror = () => {
      img.remove();
      const letter = document.createElement('span');
      letter.className = 'shortcut-letter-avatar';
      letter.textContent = initial;
      iconBox.appendChild(letter);
    };

    iconBox.appendChild(img);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'shortcut-title';
    titleSpan.textContent = title;

    link.appendChild(iconBox);
    link.appendChild(titleSpan);
    elements.shortcuts.appendChild(link);
  });
}

function initShortcuts() {
  if (typeof chrome !== 'undefined' && chrome.topSites && chrome.topSites.get) {
    chrome.topSites.get((sites) => {
      if (chrome.runtime.lastError || !sites || sites.length === 0) {
        renderShortcuts([]);
      } else {
        renderShortcuts(sites);
      }
    });
  } else {
    // Fallback for previewing
    renderShortcuts([]);
  }
}

// =============================================================================
// Pinterest RSS Parser & High-Resolution Image Upgrade
// =============================================================================

function sanitizeString(str) {
  if (!str) return '';
  return str.trim().replace(/^@+/, '').replace(/^\/+|\/+$/g, '');
}

/**
 * Upgrades standard Pinterest thumbnails (/236x/, /474x/, /736x/, etc.) to /originals/
 */
function upgradePinterestImageUrl(rawUrl) {
  if (!rawUrl) return null;
  // Replace resolution path component e.g. /236x/, /474x/, /564x/, /736x/ or /1200x/ with /originals/
  return rawUrl.replace(/\/(?:[0-9]+x[0-9]*|[0-9]+x)\//i, '/originals/');
}

async function fetchPinterestRSS(username, board) {
  const cleanUser = sanitizeString(username);
  const cleanBoard = sanitizeString(board);

  if (!cleanUser || !cleanBoard) {
    throw new Error('Please specify both a Pinterest username and a board name.');
  }

  const rssUrl = `https://www.pinterest.com/${encodeURIComponent(cleanUser)}/${encodeURIComponent(cleanBoard)}.rss`;

  const response = await fetch(rssUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch RSS (${response.status}: ${response.statusText}). Check username/board.`);
  }

  const xmlText = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Check for XML parse errors
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML response received from Pinterest.');
  }

  const items = xmlDoc.querySelectorAll('item');
  if (!items || items.length === 0) {
    throw new Error('No pins found in this board. The board might be private or empty.');
  }

  const parsedWallpapers = [];

  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent || 'Pinterest Wallpaper';
    const link = item.querySelector('link')?.textContent || `https://www.pinterest.com/${cleanUser}/${cleanBoard}`;
    
    let rawImgUrl = null;

    // 1. Try enclosure tag
    const enclosure = item.querySelector('enclosure');
    if (enclosure && enclosure.getAttribute('url')) {
      rawImgUrl = enclosure.getAttribute('url');
    }

    // 2. Try media:content tag
    if (!rawImgUrl) {
      const mediaContent = item.getElementsByTagName('media:content')[0];
      if (mediaContent && mediaContent.getAttribute('url')) {
        rawImgUrl = mediaContent.getAttribute('url');
      }
    }

    // 3. Try description HTML content (<img> src)
    if (!rawImgUrl) {
      const description = item.querySelector('description')?.textContent || '';
      const match = description.match(/src=["'](https?:\/\/[^"']+\.pinimg\.com\/[^"']+)["']/i);
      if (match && match[1]) {
        rawImgUrl = match[1];
      }
    }

    if (rawImgUrl) {
      const highResUrl = upgradePinterestImageUrl(rawImgUrl);
      parsedWallpapers.push({
        title: title.replace(/&amp;/g, '&'),
        url: highResUrl,
        fallbackUrl: rawImgUrl,
        link: link
      });
    }
  });

  if (parsedWallpapers.length === 0) {
    throw new Error('No valid image URLs found in the Pinterest feed.');
  }

  return parsedWallpapers;
}

// =============================================================================
// Wallpaper Preloader & Dual-Layer Crossfade Engine
// =============================================================================

function preloadImage(wallpaper) {
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({ success: true, src: wallpaper.url });
    };

    img.onerror = () => {
      // If /originals/ failed (some pins only have 736x), try the fallback thumbnail URL
      if (wallpaper.fallbackUrl && wallpaper.fallbackUrl !== wallpaper.url) {
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve({ success: true, src: wallpaper.fallbackUrl });
        fallbackImg.onerror = () => resolve({ success: false });
        fallbackImg.src = wallpaper.fallbackUrl;
      } else {
        resolve({ success: false });
      }
    };

    img.src = wallpaper.url;
  });
}

async function displayWallpaper(index, manual = false) {
  if (appState.wallpapers.length === 0) return;

  // Wrap around index
  const safeIndex = (index + appState.wallpapers.length) % appState.wallpapers.length;
  appState.currentIndex = safeIndex;
  const currentItem = appState.wallpapers[safeIndex];

  // Preload image before switching layers to eliminate flicker
  const result = await preloadImage(currentItem);
  const imageSrc = result.success ? (result.src || currentItem.url) : currentItem.fallbackUrl || currentItem.url;

  // Determine active and inactive background layers
  const nextLayerNum = appState.activeLayer === 1 ? 2 : 1;
  const activeLayerEl = appState.activeLayer === 1 ? elements.bg1 : elements.bg2;
  const nextLayerEl = nextLayerNum === 1 ? elements.bg1 : elements.bg2;

  // Apply new background image to the inactive layer first
  nextLayerEl.style.backgroundImage = `url("${imageSrc}")`;

  // Crossfade: toggle active class
  nextLayerEl.classList.add('active');
  activeLayerEl.classList.remove('active');

  appState.activeLayer = nextLayerNum;

  // Update Pin title and link
  elements.pinTitle.textContent = currentItem.title || 'Pinterest Wallpaper';
  elements.pinLink.href = currentItem.link || 'https://www.pinterest.com';
  elements.pinLink.title = `View on Pinterest: ${currentItem.title}`;

  if (manual) {
    resetCycleTimer();
  }
}

function nextWallpaper(manual = true) {
  displayWallpaper(appState.currentIndex + 1, manual);
}

function prevWallpaper(manual = true) {
  displayWallpaper(appState.currentIndex - 1, manual);
}

// =============================================================================
// Wallpaper Cycler Timer
// =============================================================================

function startCycleTimer() {
  stopCycleTimer();
  if (appState.isPaused) return;

  const intervalMs = Math.max(5, appState.config.interval || 30) * 1000;
  appState.cycleTimer = setInterval(() => {
    nextWallpaper(false);
  }, intervalMs);
}

function stopCycleTimer() {
  if (appState.cycleTimer) {
    clearInterval(appState.cycleTimer);
    appState.cycleTimer = null;
  }
}

function resetCycleTimer() {
  stopCycleTimer();
  startCycleTimer();
}

function togglePause() {
  appState.isPaused = !appState.isPaused;
  if (appState.isPaused) {
    stopCycleTimer();
    elements.pauseIcon.classList.add('hidden');
    elements.playIcon.classList.remove('hidden');
    showToast('Wallpaper cycling paused');
  } else {
    elements.pauseIcon.classList.remove('hidden');
    elements.playIcon.classList.add('hidden');
    startCycleTimer();
    showToast('Wallpaper cycling resumed');
  }
}

// =============================================================================
// Feed Loader & Sync Engine
// =============================================================================

async function loadFeedAndCycle(notify = false) {
  if (appState.isLoadingFeed) return;
  appState.isLoadingFeed = true;

  updateStatus('loading', `Fetching @${appState.config.username}/${appState.config.board}...`);

  try {
    const pins = await fetchPinterestRSS(appState.config.username, appState.config.board);
    
    // Shuffle array slightly for dynamic variety on tab load
    appState.wallpapers = shuffleArray([...pins]);
    appState.currentIndex = 0;
    
    updateStatus('ready', `Active: @${appState.config.username}/${appState.config.board} (${pins.length} wallpapers)`);
    
    if (notify) {
      showToast(`Loaded ${pins.length} wallpapers from Pinterest`);
    }

    await displayWallpaper(0);
    startCycleTimer();
  } catch (err) {
    console.warn('Pinterest RSS Error, falling back to curated wallpapers:', err);
    updateStatus('error', err.message || 'Error fetching RSS');
    
    if (notify) {
      showToast(`Feed issue: ${err.message}. Using aesthetic fallbacks.`);
    }

    appState.wallpapers = [...FALLBACK_WALLPAPERS];
    appState.currentIndex = 0;
    await displayWallpaper(0);
    startCycleTimer();
  } finally {
    appState.isLoadingFeed = false;
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// =============================================================================
// Settings Modal & UI Customization
// =============================================================================

function applyVisualSettings() {
  const dim = appState.config.dim ?? 25;
  const blur = appState.config.blur ?? 0;

  document.documentElement.style.setProperty('--dim-overlay', `rgba(0, 0, 0, ${dim / 100})`);
  document.documentElement.style.setProperty('--bg-blur-amount', `${blur}px`);
  
  if (elements.dimVal) elements.dimVal.textContent = dim;
  if (elements.blurVal) elements.blurVal.textContent = blur;
}

function updateStatus(type, msg) {
  if (!elements.statusMsg || !elements.statusIcon) return;
  
  elements.statusMsg.textContent = msg;
  elements.statusIcon.className = 'status-indicator';
  
  if (type === 'loading') {
    elements.statusIcon.classList.add('loading');
  } else if (type === 'error') {
    elements.statusIcon.classList.add('error');
  }
}

function openSettingsModal() {
  elements.inputUsername.value = appState.config.username;
  elements.inputBoard.value = appState.config.board;
  elements.inputInterval.value = appState.config.interval;
  elements.inputTimeFormat.value = appState.config.timeFormat;
  elements.inputDim.value = appState.config.dim ?? 25;
  elements.inputBlur.value = appState.config.blur ?? 0;
  
  applyVisualSettings();
  elements.settingsDialog.showModal();
}

function closeSettingsModal() {
  elements.settingsDialog.close();
}

function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');

  clearTimeout(elements.toast._timeout);
  elements.toast._timeout = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3500);
}

// =============================================================================
// Event Listeners & Initialization
// =============================================================================

function setupEventListeners() {
  // Navigation Controls
  elements.prevBtn.addEventListener('click', () => prevWallpaper(true));
  elements.nextBtn.addEventListener('click', () => nextWallpaper(true));
  elements.pauseBtn.addEventListener('click', togglePause);

  // Settings Modal Open/Close
  elements.settingsBtn.addEventListener('click', openSettingsModal);
  elements.closeModalBtn.addEventListener('click', closeSettingsModal);
  elements.cancelBtn.addEventListener('click', closeSettingsModal);

  // Close dialog on clicking backdrop
  elements.settingsDialog.addEventListener('click', (e) => {
    const dialogDimensions = elements.settingsDialog.getBoundingClientRect();
    if (
      e.clientX < dialogDimensions.left ||
      e.clientX > dialogDimensions.right ||
      e.clientY < dialogDimensions.top ||
      e.clientY > dialogDimensions.bottom
    ) {
      closeSettingsModal();
    }
  });

  // Sliders Real-time input
  elements.inputDim.addEventListener('input', (e) => {
    const val = e.target.value;
    elements.dimVal.textContent = val;
    document.documentElement.style.setProperty('--dim-overlay', `rgba(0, 0, 0, ${val / 100})`);
  });

  elements.inputBlur.addEventListener('input', (e) => {
    const val = e.target.value;
    elements.blurVal.textContent = val;
    document.documentElement.style.setProperty('--bg-blur-amount', `${val}px`);
  });

  // Preset Chips
  elements.presetChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      elements.presetChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const user = chip.dataset.user;
      const board = chip.dataset.board;
      if (user) elements.inputUsername.value = user;
      if (board) elements.inputBoard.value = board;
    });
  });

  // Settings Form Submit
  elements.settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newUsername = sanitizeString(elements.inputUsername.value) || 'pinterest';
    const newBoard = sanitizeString(elements.inputBoard.value) || 'wallpapers';
    const newInterval = Math.max(5, parseInt(elements.inputInterval.value, 10) || 30);
    const newTimeFormat = elements.inputTimeFormat.value || '12h';
    const newDim = parseInt(elements.inputDim.value, 10) || 25;
    const newBlur = parseInt(elements.inputBlur.value, 10) || 0;

    await saveConfig({
      username: newUsername,
      board: newBoard,
      interval: newInterval,
      timeFormat: newTimeFormat,
      dim: newDim,
      blur: newBlur
    });

    applyVisualSettings();
    updateClock();
    closeSettingsModal();

    // Reload feed immediately with updated board
    loadFeedAndCycle(true);
  });

  // Reset Defaults Button
  elements.resetBtn.addEventListener('click', async () => {
    elements.inputUsername.value = DEFAULT_CONFIG.username;
    elements.inputBoard.value = DEFAULT_CONFIG.board;
    elements.inputInterval.value = DEFAULT_CONFIG.interval;
    elements.inputTimeFormat.value = DEFAULT_CONFIG.timeFormat;
    elements.inputDim.value = DEFAULT_CONFIG.dim;
    elements.inputBlur.value = DEFAULT_CONFIG.blur;
    
    elements.dimVal.textContent = DEFAULT_CONFIG.dim;
    elements.blurVal.textContent = DEFAULT_CONFIG.blur;

    elements.presetChips.forEach(c => c.classList.remove('active'));
  });

  // Keyboard Shortcuts (ArrowLeft = Prev, ArrowRight = Next, Space = Pause/Resume)
  window.addEventListener('keydown', (e) => {
    // Ignore key shortcuts if modal is open or user is typing in input
    if (elements.settingsDialog.open || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      return;
    }

    if (e.key === 'ArrowRight') {
      nextWallpaper(true);
    } else if (e.key === 'ArrowLeft') {
      prevWallpaper(true);
    } else if (e.code === 'Space') {
      e.preventDefault();
      togglePause();
    }
  });

  // Pause cycling when tab is hidden to save CPU/battery, resume when visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopCycleTimer();
    } else if (!appState.isPaused) {
      startCycleTimer();
    }
  });
}

// =============================================================================
// App Bootstrapper
// =============================================================================

async function initApp() {
  appState.config = await loadConfig();
  
  applyVisualSettings();
  initClock();
  initShortcuts();
  setupEventListeners();

  // Load Pinterest wallpapers & begin cycling
  loadFeedAndCycle(false);
}

// Start on DOM Ready
document.addEventListener('DOMContentLoaded', initApp);
