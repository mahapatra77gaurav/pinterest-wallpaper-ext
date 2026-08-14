/**
 * Pinterest Dynamic New Tab (Manifest V3)
 * High-performance, multi-source wallpaper cycler and editable Chrome shortcuts.
 */

// =============================================================================
// State & Configuration Defaults
// =============================================================================

const DEFAULT_CONFIG = {
  sourceMode: 'pinterest-board', // 'pinterest-board' | 'pinterest-feed' | 'direct-url' | 'local-upload'
  username: 'pinterest',
  board: 'wallpapers',
  directUrl: '',
  localImageBase64: '',
  localImageName: '',
  interval: 30, // seconds
  timeFormat: '12h',
  dim: 25, // percentage
  blur: 0 // pixels
};

// Curated high-res aesthetic fallback wallpapers (Unsplash CDN)
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
  userShortcuts: [],
  wallpapers: [],
  currentIndex: 0,
  activeLayer: 1, // 1 for #bg-1, 2 for #bg-2
  cycleTimer: null,
  isPaused: false,
  isLoadingFeed: false,
  pendingLocalBase64: null,
  pendingLocalName: null
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
  
  // Settings Form Inputs
  selectSourceMode: document.getElementById('select-source-mode'),
  groupPresets: document.getElementById('group-presets'),
  groupPinterestUser: document.getElementById('group-pinterest-user'),
  groupPinterestBoard: document.getElementById('group-pinterest-board'),
  groupDirectUrl: document.getElementById('group-direct-url'),
  groupLocalUpload: document.getElementById('group-local-upload'),
  groupInterval: document.getElementById('group-interval'),
  
  inputUsername: document.getElementById('input-username'),
  inputBoard: document.getElementById('input-board'),
  inputDirectUrl: document.getElementById('input-direct-url'),
  inputLocalFile: document.getElementById('input-local-file'),
  fileDropzone: document.getElementById('file-dropzone'),
  fileUploadText: document.getElementById('file-upload-text'),
  localPreviewContainer: document.getElementById('local-preview-container'),
  localPreviewImg: document.getElementById('local-preview-img'),
  localPreviewName: document.getElementById('local-preview-name'),
  
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
  searchInput: document.getElementById('search-input'),

  // Add Shortcut Dialog
  addShortcutDialog: document.getElementById('add-shortcut-dialog'),
  addShortcutForm: document.getElementById('add-shortcut-form'),
  closeAddShortcutBtn: document.getElementById('close-add-shortcut-btn'),
  cancelAddShortcutBtn: document.getElementById('cancel-add-shortcut-btn'),
  inputShortcutTitle: document.getElementById('input-shortcut-title'),
  inputShortcutUrl: document.getElementById('input-shortcut-url')
};

// =============================================================================
// Storage Layer (chrome.storage.local with LocalStorage fallback)
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

  const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  elements.date.textContent = now.toLocaleDateString(undefined, dateOptions);
}

function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

// =============================================================================
// Editable Shortcuts Dock (chrome.storage.local seeded from topSites)
// =============================================================================

function getCleanDomain(urlStr) {
  try {
    let formatted = urlStr.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = 'https://' + formatted;
    }
    const parsed = new URL(formatted);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return urlStr;
  }
}

function formatUrl(urlStr) {
  let formatted = urlStr.trim();
  if (!/^https?:\/\//i.test(formatted)) {
    formatted = 'https://' + formatted;
  }
  return formatted;
}

async function loadUserShortcuts() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['user_shortcuts'], (result) => {
        if (result && Array.isArray(result.user_shortcuts)) {
          resolve(result.user_shortcuts);
        } else {
          // Seed from chrome.topSites.get() on first run
          seedFromTopSites().then((seeded) => {
            saveUserShortcuts(seeded);
            resolve(seeded);
          });
        }
      });
    } else {
      try {
        const saved = localStorage.getItem('user_shortcuts');
        if (saved) {
          resolve(JSON.parse(saved));
        } else {
          const defaultSites = getDefaultShortcuts();
          localStorage.setItem('user_shortcuts', JSON.stringify(defaultSites));
          resolve(defaultSites);
        }
      } catch (e) {
        resolve(getDefaultShortcuts());
      }
    }
  });
}

function getDefaultShortcuts() {
  return [
    { title: 'Google', url: 'https://www.google.com' },
    { title: 'YouTube', url: 'https://www.youtube.com' },
    { title: 'GitHub', url: 'https://www.github.com' },
    { title: 'Pinterest', url: 'https://www.pinterest.com' },
    { title: 'Reddit', url: 'https://www.reddit.com' },
    { title: 'Twitter', url: 'https://www.x.com' },
    { title: 'Spotify', url: 'https://open.spotify.com' },
    { title: 'Netflix', url: 'https://www.netflix.com' }
  ];
}

async function seedFromTopSites() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.topSites && chrome.topSites.get) {
      chrome.topSites.get((sites) => {
        if (chrome.runtime.lastError || !sites || sites.length === 0) {
          resolve(getDefaultShortcuts());
        } else {
          const formatted = sites.slice(0, 10).map(s => ({
            title: s.title || getCleanDomain(s.url),
            url: s.url
          }));
          resolve(formatted.length > 0 ? formatted : getDefaultShortcuts());
        }
      });
    } else {
      resolve(getDefaultShortcuts());
    }
  });
}

async function saveUserShortcuts(shortcutsList) {
  appState.userShortcuts = shortcutsList;
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ user_shortcuts: shortcutsList }, () => resolve());
    } else {
      try {
        localStorage.setItem('user_shortcuts', JSON.stringify(shortcutsList));
      } catch (e) {}
      resolve();
    }
  });
}

function renderShortcuts() {
  elements.shortcuts.innerHTML = '';
  
  const list = appState.userShortcuts || [];

  list.forEach((site, index) => {
    const domain = getCleanDomain(site.url);
    const title = site.title || domain;
    const faviconUrl = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(site.url)}&sz=64`;
    const initial = (title || 'W').charAt(0).toUpperCase();

    const link = document.createElement('a');
    link.className = 'shortcut-card';
    link.href = formatUrl(site.url);
    link.title = `${title} (${site.url})`;

    // Delete Button (✕)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'shortcut-delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.title = `Delete ${title}`;
    deleteBtn.setAttribute('aria-label', `Delete ${title}`);
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteShortcut(index);
    });

    const iconBox = document.createElement('div');
    iconBox.className = 'shortcut-icon-box';

    const img = document.createElement('img');
    img.className = 'shortcut-icon-img';
    img.src = faviconUrl;
    img.alt = title;
    img.loading = 'lazy';

    // Letter avatar fallback
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

    link.appendChild(deleteBtn);
    link.appendChild(iconBox);
    link.appendChild(titleSpan);
    elements.shortcuts.appendChild(link);
  });

  // "+ Add" Tile Button
  const addBtn = document.createElement('button');
  addBtn.className = 'shortcut-add-card';
  addBtn.type = 'button';
  addBtn.title = 'Add New Shortcut';
  addBtn.setAttribute('aria-label', 'Add New Shortcut');
  addBtn.innerHTML = `
    <div class="shortcut-add-icon-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </div>
    <span class="shortcut-title">+ Add</span>
  `;
  addBtn.addEventListener('click', openAddShortcutModal);
  elements.shortcuts.appendChild(addBtn);
}

async function deleteShortcut(index) {
  const list = [...appState.userShortcuts];
  if (index >= 0 && index < list.length) {
    const deleted = list.splice(index, 1);
    await saveUserShortcuts(list);
    renderShortcuts();
    showToast(`Removed shortcut: ${deleted[0]?.title || 'Item'}`);
  }
}

async function addShortcut(title, url) {
  const cleanUrl = formatUrl(url);
  const cleanTitle = title.trim() || getCleanDomain(cleanUrl);
  
  const list = [...appState.userShortcuts, { title: cleanTitle, url: cleanUrl }];
  await saveUserShortcuts(list);
  renderShortcuts();
  showToast(`Added shortcut: ${cleanTitle}`);
}

function openAddShortcutModal() {
  elements.inputShortcutTitle.value = '';
  elements.inputShortcutUrl.value = '';
  elements.addShortcutDialog.showModal();
  elements.inputShortcutUrl.focus();
}

function closeAddShortcutModal() {
  elements.addShortcutDialog.close();
}

// =============================================================================
// Pinterest RSS Parser & High-Resolution Image Upgrade Engine
// =============================================================================

function sanitizeString(str) {
  if (!str) return '';
  return str.trim().replace(/^@+/, '').replace(/^\/+|\/+$/g, '');
}

/**
 * Upgrades Pinterest thumbnail image URLs to /originals/
 */
function upgradePinterestImageUrl(rawUrl) {
  if (!rawUrl) return null;
  return rawUrl.replace(/\/(?:[0-9]+x[0-9]*|[0-9]+x)\//i, '/originals/');
}

async function fetchPinterestRSS(rssUrl, fallbackTitle) {
  const response = await fetch(rssUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch RSS (${response.status}: ${response.statusText}). Check username or board.`);
  }

  const xmlText = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  if (xmlDoc.querySelector('parsererror')) {
    throw new Error('Invalid XML response received from Pinterest.');
  }

  const items = xmlDoc.querySelectorAll('item');
  if (!items || items.length === 0) {
    throw new Error('No pins found in this feed or board.');
  }

  const parsedWallpapers = [];

  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent || fallbackTitle || 'Pinterest Wallpaper';
    const link = item.querySelector('link')?.textContent || 'https://www.pinterest.com';
    
    let rawImgUrl = null;

    // 1. Check description <img> tag
    const description = item.querySelector('description')?.textContent || '';
    const match = description.match(/src=["'](https?:\/\/[^"']+\.pinimg\.com\/[^"']+)["']/i);
    if (match && match[1]) {
      rawImgUrl = match[1];
    }

    // 2. Check enclosure
    if (!rawImgUrl) {
      const enclosure = item.querySelector('enclosure');
      if (enclosure && enclosure.getAttribute('url')) {
        rawImgUrl = enclosure.getAttribute('url');
      }
    }

    // 3. Check media:content
    if (!rawImgUrl) {
      const mediaContent = item.getElementsByTagName('media:content')[0];
      if (mediaContent && mediaContent.getAttribute('url')) {
        rawImgUrl = mediaContent.getAttribute('url');
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
    throw new Error('No valid images found in the RSS feed.');
  }

  return parsedWallpapers;
}

// =============================================================================
// Wallpaper Preloader & Dual-Layer Crossfade Cycler
// =============================================================================

function preloadImage(wallpaper) {
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({ success: true, src: wallpaper.url });
    };

    img.onerror = () => {
      // If /originals/ resolution is unavailable for older pins, fallback to thumbnail/736x
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

  const safeIndex = (index + appState.wallpapers.length) % appState.wallpapers.length;
  appState.currentIndex = safeIndex;
  const currentItem = appState.wallpapers[safeIndex];

  // Preload before crossfading
  const result = await preloadImage(currentItem);
  const imageSrc = result.success ? (result.src || currentItem.url) : (currentItem.fallbackUrl || currentItem.url);

  const nextLayerNum = appState.activeLayer === 1 ? 2 : 1;
  const activeLayerEl = appState.activeLayer === 1 ? elements.bg1 : elements.bg2;
  const nextLayerEl = nextLayerNum === 1 ? elements.bg1 : elements.bg2;

  nextLayerEl.style.backgroundImage = `url("${imageSrc}")`;

  nextLayerEl.classList.add('active');
  activeLayerEl.classList.remove('active');

  appState.activeLayer = nextLayerNum;

  elements.pinTitle.textContent = currentItem.title || 'Wallpaper';
  elements.pinLink.href = currentItem.link || '#';
  elements.pinLink.title = `View Source: ${currentItem.title}`;

  if (manual) {
    resetCycleTimer();
  }
}

function nextWallpaper(manual = true) {
  if (appState.wallpapers.length > 1) {
    displayWallpaper(appState.currentIndex + 1, manual);
  }
}

function prevWallpaper(manual = true) {
  if (appState.wallpapers.length > 1) {
    displayWallpaper(appState.currentIndex - 1, manual);
  }
}

function startCycleTimer() {
  stopCycleTimer();
  if (appState.isPaused || appState.wallpapers.length <= 1) return;

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
  if (appState.wallpapers.length <= 1) return;

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

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// =============================================================================
// Wallpaper Sourcing Loader
// =============================================================================

async function loadWallpapersByMode(notify = false) {
  if (appState.isLoadingFeed) return;
  appState.isLoadingFeed = true;

  const mode = appState.config.sourceMode || 'pinterest-board';

  try {
    if (mode === 'pinterest-board') {
      const user = sanitizeString(appState.config.username) || 'pinterest';
      const board = sanitizeString(appState.config.board) || 'wallpapers';
      const rssUrl = `https://www.pinterest.com/${encodeURIComponent(user)}/${encodeURIComponent(board)}.rss`;
      
      updateStatus('loading', `Fetching @${user}/${board}...`);
      const pins = await fetchPinterestRSS(rssUrl, `Pinterest: @${user}/${board}`);
      
      appState.wallpapers = shuffleArray([...pins]);
      updateStatus('ready', `Active: @${user}/${board} (${pins.length} wallpapers)`);
      if (notify) showToast(`Loaded ${pins.length} wallpapers from Pinterest Board`);

    } else if (mode === 'pinterest-feed') {
      const user = sanitizeString(appState.config.username) || 'pinterest';
      const rssUrl = `https://www.pinterest.com/${encodeURIComponent(user)}/feed.rss`;
      
      updateStatus('loading', `Fetching user feed for @${user}...`);
      const pins = await fetchPinterestRSS(rssUrl, `Pinterest: @${user} Feed`);
      
      appState.wallpapers = shuffleArray([...pins]);
      updateStatus('ready', `Active: @${user} Feed (${pins.length} wallpapers)`);
      if (notify) showToast(`Loaded ${pins.length} wallpapers from @${user} Feed`);

    } else if (mode === 'direct-url') {
      const url = (appState.config.directUrl || '').trim();
      if (!url) {
        throw new Error('Please enter a valid Direct Image URL in settings.');
      }
      appState.wallpapers = [{
        title: 'Custom Direct Wallpaper',
        url: url,
        fallbackUrl: url,
        link: url
      }];
      updateStatus('ready', 'Active: Direct Image URL');
      if (notify) showToast('Direct image wallpaper applied');

    } else if (mode === 'local-upload') {
      const base64 = appState.config.localImageBase64;
      if (!base64) {
        throw new Error('No local image uploaded yet. Upload an image in settings.');
      }
      appState.wallpapers = [{
        title: appState.config.localImageName || 'Local File Wallpaper',
        url: base64,
        fallbackUrl: base64,
        link: '#'
      }];
      updateStatus('ready', 'Active: Local Image File');
      if (notify) showToast('Local image wallpaper applied');
    }

    appState.currentIndex = 0;
    await displayWallpaper(0);
    startCycleTimer();

  } catch (err) {
    console.warn('Wallpaper source error, falling back to curated wallpapers:', err);
    updateStatus('error', err.message || 'Error loading wallpaper');
    
    if (notify) {
      showToast(`${err.message}. Using aesthetic fallbacks.`);
    }

    appState.wallpapers = [...FALLBACK_WALLPAPERS];
    appState.currentIndex = 0;
    await displayWallpaper(0);
    startCycleTimer();
  } finally {
    appState.isLoadingFeed = false;
  }
}

// =============================================================================
// Settings Modal & Conditional Form UI
// =============================================================================

function updateFormVisibility(mode) {
  // Hide all conditional groups first
  elements.groupPresets.classList.add('hidden');
  elements.groupPinterestUser.classList.add('hidden');
  elements.groupPinterestBoard.classList.add('hidden');
  elements.groupDirectUrl.classList.add('hidden');
  elements.groupLocalUpload.classList.add('hidden');
  elements.groupInterval.classList.add('hidden');

  if (mode === 'pinterest-board') {
    elements.groupPresets.classList.remove('hidden');
    elements.groupPinterestUser.classList.remove('hidden');
    elements.groupPinterestBoard.classList.remove('hidden');
    elements.groupInterval.classList.remove('hidden');
  } else if (mode === 'pinterest-feed') {
    elements.groupPinterestUser.classList.remove('hidden');
    elements.groupInterval.classList.remove('hidden');
  } else if (mode === 'direct-url') {
    elements.groupDirectUrl.classList.remove('hidden');
  } else if (mode === 'local-upload') {
    elements.groupLocalUpload.classList.remove('hidden');
  }
}

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
  const mode = appState.config.sourceMode || 'pinterest-board';
  elements.selectSourceMode.value = mode;
  updateFormVisibility(mode);

  elements.inputUsername.value = appState.config.username || 'pinterest';
  elements.inputBoard.value = appState.config.board || 'wallpapers';
  elements.inputDirectUrl.value = appState.config.directUrl || '';
  elements.inputInterval.value = appState.config.interval || 30;
  elements.inputTimeFormat.value = appState.config.timeFormat || '12h';
  elements.inputDim.value = appState.config.dim ?? 25;
  elements.inputBlur.value = appState.config.blur ?? 0;
  
  // Local preview
  if (appState.config.localImageBase64) {
    elements.localPreviewImg.src = appState.config.localImageBase64;
    elements.localPreviewName.textContent = appState.config.localImageName || 'Stored Image';
    elements.localPreviewContainer.classList.remove('hidden');
  } else {
    elements.localPreviewContainer.classList.add('hidden');
  }

  appState.pendingLocalBase64 = null;
  appState.pendingLocalName = null;

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
// File Upload Handler (FileReader -> Base64)
// =============================================================================

function handleLocalFileUpload(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please select a valid image file (PNG, JPG, WebP).');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    appState.pendingLocalBase64 = base64;
    appState.pendingLocalName = file.name;

    elements.localPreviewImg.src = base64;
    elements.localPreviewName.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    elements.localPreviewContainer.classList.remove('hidden');
    elements.fileUploadText.textContent = `Selected: ${file.name}`;
    showToast(`Loaded "${file.name}"`);
  };

  reader.onerror = () => {
    showToast('Failed to read local image file.');
  };

  reader.readAsDataURL(file);
}

// =============================================================================
// Event Listeners & Bootstrapping
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

  // Close Settings dialog on clicking backdrop
  elements.settingsDialog.addEventListener('click', (e) => {
    const rect = elements.settingsDialog.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      closeSettingsModal();
    }
  });

  // Add Shortcut Dialog Modal Open/Close
  elements.closeAddShortcutBtn.addEventListener('click', closeAddShortcutModal);
  elements.cancelAddShortcutBtn.addEventListener('click', closeAddShortcutModal);
  elements.addShortcutDialog.addEventListener('click', (e) => {
    const rect = elements.addShortcutDialog.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      closeAddShortcutModal();
    }
  });

  // Add Shortcut Form Submit
  elements.addShortcutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = elements.inputShortcutTitle.value;
    const url = elements.inputShortcutUrl.value;
    if (url.trim()) {
      await addShortcut(title, url);
      closeAddShortcutModal();
    }
  });

  // Source Mode Selector Change
  elements.selectSourceMode.addEventListener('change', (e) => {
    updateFormVisibility(e.target.value);
  });

  // Local File Upload Input & Drag-and-Drop
  elements.inputLocalFile.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleLocalFileUpload(e.target.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    elements.fileDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.fileDropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    elements.fileDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.fileDropzone.classList.remove('dragover');
    });
  });

  elements.fileDropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLocalFileUpload(e.dataTransfer.files[0]);
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
    
    const mode = elements.selectSourceMode.value;
    const newUsername = sanitizeString(elements.inputUsername.value) || 'pinterest';
    const newBoard = sanitizeString(elements.inputBoard.value) || 'wallpapers';
    const newDirectUrl = elements.inputDirectUrl.value.trim();
    const newInterval = Math.max(5, parseInt(elements.inputInterval.value, 10) || 30);
    const newTimeFormat = elements.inputTimeFormat.value || '12h';
    const newDim = parseInt(elements.inputDim.value, 10) || 25;
    const newBlur = parseInt(elements.inputBlur.value, 10) || 0;

    const updatedConfig = {
      sourceMode: mode,
      username: newUsername,
      board: newBoard,
      directUrl: newDirectUrl,
      interval: newInterval,
      timeFormat: newTimeFormat,
      dim: newDim,
      blur: newBlur
    };

    if (appState.pendingLocalBase64) {
      updatedConfig.localImageBase64 = appState.pendingLocalBase64;
      updatedConfig.localImageName = appState.pendingLocalName;
    }

    await saveConfig(updatedConfig);

    applyVisualSettings();
    updateClock();
    closeSettingsModal();

    // Reload wallpaper stream immediately
    loadWallpapersByMode(true);
  });

  // Reset Defaults Button
  elements.resetBtn.addEventListener('click', async () => {
    elements.selectSourceMode.value = DEFAULT_CONFIG.sourceMode;
    updateFormVisibility(DEFAULT_CONFIG.sourceMode);

    elements.inputUsername.value = DEFAULT_CONFIG.username;
    elements.inputBoard.value = DEFAULT_CONFIG.board;
    elements.inputDirectUrl.value = DEFAULT_CONFIG.directUrl;
    elements.inputInterval.value = DEFAULT_CONFIG.interval;
    elements.inputTimeFormat.value = DEFAULT_CONFIG.timeFormat;
    elements.inputDim.value = DEFAULT_CONFIG.dim;
    elements.inputBlur.value = DEFAULT_CONFIG.blur;
    
    elements.dimVal.textContent = DEFAULT_CONFIG.dim;
    elements.blurVal.textContent = DEFAULT_CONFIG.blur;

    elements.presetChips.forEach(c => c.classList.remove('active'));
    elements.localPreviewContainer.classList.add('hidden');
    appState.pendingLocalBase64 = null;
    appState.pendingLocalName = null;
  });

  // Keyboard Shortcuts (ArrowLeft = Prev, ArrowRight = Next, Space = Pause/Resume)
  window.addEventListener('keydown', (e) => {
    if (elements.settingsDialog.open || elements.addShortcutDialog.open || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
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
  appState.userShortcuts = await loadUserShortcuts();

  applyVisualSettings();
  initClock();
  renderShortcuts();
  setupEventListeners();

  // Load active wallpaper stream & cycle
  loadWallpapersByMode(false);
}

// Start on DOM Ready
document.addEventListener('DOMContentLoaded', initApp);
