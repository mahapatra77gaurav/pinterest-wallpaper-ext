/**
 * Pinterest Dynamic New Tab (Manifest V3)
 * High-performance, multi-source wallpaper cycler and editable Chrome shortcuts.
 */

// =============================================================================
// State & Configuration Defaults
// =============================================================================

const DEFAULT_CONFIG = {
  sourceMode: 'pinterest-search', // 'pinterest-search' | 'pinterest-both' | 'pinterest-saved' | 'pinterest-feed' | 'pinterest-board' | 'direct-url' | 'local-upload'
  searchQuery: '4k dark cyberpunk wallpaper',
  username: 'pinterest',
  board: 'wallpapers',
  directUrl: '',
  localImageBase64: '',
  localImageName: '',
  interval: 30, // seconds
  timeFormat: '12h',
  fitMode: 'cover', // 'cover' | 'contain' | 'auto'
  autoRotate: true, // Auto-Rotate portrait to landscape (enabled by default)
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
  wallpaperQueue: [],       // Lightweight queue of wallpaper metadata
  wallpapers: [],           // Active streaming rotation array
  seenUrls: new Set(),      // De-duplication set for continuous batching
  rotations: {},            // Persistent image URL -> degrees rotation mapping
  paginationBookmark: null, // Cursor bookmark for Pinterest pagination
  isFetchingNextBatch: false,
  currentIndex: 0,
  activeLayer: 1,           // 1 for #bg-1, 2 for #bg-2
  cycleTimer: null,
  preloadTimer: null,
  preloadedCache: new Map(), // In-memory image objects cache (current + next only)
  isPaused: false,
  isLoadingFeed: false,
  pendingLocalBase64: null,
  pendingLocalName: null
};

// =============================================================================
// DOM Elements
// =============================================================================

const elements = {
  bgAmbient: document.getElementById('bg-ambient'),
  bg1: document.getElementById('bg-1'),
  bg2: document.getElementById('bg-2'),
  time: document.getElementById('time'),
  date: document.getElementById('date'),
  shortcuts: document.getElementById('shortcuts'),
  pinLink: document.getElementById('pin-link'),
  pinTitle: document.getElementById('pin-title'),
  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),
  rotateBtn: document.getElementById('rotate-btn'),
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
  selectFitMode: document.getElementById('select-fit-mode'),
  inputAutoRotate: document.getElementById('input-auto-rotate'),
  groupPinterestSearch: document.getElementById('group-pinterest-search'),
  inputSearchQuery: document.getElementById('input-search-query'),
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
  searchChips: document.querySelectorAll('.search-chip'),
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
// Instant First-Paint (Cold-Start Cache Engine)
// =============================================================================

/**
 * Synchronously renders the last active wallpaper from local cache for 0ms cold-start
 */
function applyColdStartWallpaper() {
  try {
    const raw = localStorage.getItem('last_active_wallpaper');
    const rotRaw = localStorage.getItem('wallpaper_rotations');
    const rotations = rotRaw ? JSON.parse(rotRaw) : {};
    if (rotations) {
      appState.rotations = { ...appState.rotations, ...rotations };
    }

    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && cached.url) {
        const savedRot = (appState.rotations && appState.rotations[cached.url] !== undefined)
          ? appState.rotations[cached.url]
          : (cached.rotation || 0);

        if (elements.bg1) {
          elements.bg1.style.backgroundImage = `url("${cached.url}")`;
          elements.bg1.classList.add('active');
          setLayerRotation(elements.bg1, savedRot);
        }
        if (elements.bgAmbient) {
          elements.bgAmbient.style.backgroundImage = `url("${cached.url}")`;
          setLayerRotation(elements.bgAmbient, savedRot);
        }
        if (elements.pinTitle && cached.title) elements.pinTitle.textContent = cached.title;
        if (elements.pinLink && cached.link) {
          elements.pinLink.href = cached.link;
          elements.pinLink.title = `View Source: ${cached.title}`;
        }
      }
    }
  } catch (e) {}

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['last_active_wallpaper', 'wallpaper_rotations'], (res) => {
      if (res && res.wallpaper_rotations) {
        appState.rotations = { ...appState.rotations, ...res.wallpaper_rotations };
      }
      if (res && res.last_active_wallpaper) {
        const cached = res.last_active_wallpaper;
        try {
          localStorage.setItem('last_active_wallpaper', JSON.stringify(cached));
        } catch (e) {}

        const savedRot = (appState.rotations && appState.rotations[cached.url] !== undefined)
          ? appState.rotations[cached.url]
          : (cached.rotation || 0);

        if (elements.bg1 && !elements.bg1.style.backgroundImage) {
          elements.bg1.style.backgroundImage = `url("${cached.url}")`;
          elements.bg1.classList.add('active');
          setLayerRotation(elements.bg1, savedRot);
        }
        if (elements.bgAmbient && !elements.bgAmbient.style.backgroundImage) {
          elements.bgAmbient.style.backgroundImage = `url("${cached.url}")`;
          setLayerRotation(elements.bgAmbient, savedRot);
        }
      }
    });
  }
}

/**
 * Saves current active wallpaper metadata to cold-start storage
 */
function saveActiveWallpaperToColdStart(wallpaper) {
  if (!wallpaper || !wallpaper.url) return;
  const rotation = (appState.rotations && appState.rotations[wallpaper.url] !== undefined)
    ? appState.rotations[wallpaper.url]
    : (wallpaper.rotation || 0);

  const payload = {
    title: wallpaper.title || 'Wallpaper',
    url: wallpaper.url,
    fallbackUrl: wallpaper.fallbackUrl || wallpaper.url,
    link: wallpaper.link || '#',
    rotation: rotation
  };

  try {
    localStorage.setItem('last_active_wallpaper', JSON.stringify(payload));
  } catch (e) {}

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ last_active_wallpaper: payload });
  }
}

/**
 * Persists orientation angle mapped to a specific image URL
 */
function saveRotationForUrl(url, degrees) {
  if (!url) return;
  appState.rotations[url] = degrees;
  try {
    localStorage.setItem('wallpaper_rotations', JSON.stringify(appState.rotations));
  } catch (e) {}
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ wallpaper_rotations: appState.rotations });
  }
}

/**
 * Loads persistent rotation mappings from storage
 */
function loadRotations() {
  try {
    const raw = localStorage.getItem('wallpaper_rotations');
    if (raw) {
      appState.rotations = { ...appState.rotations, ...(JSON.parse(raw) || {}) };
    }
  } catch (e) {}

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['wallpaper_rotations'], (res) => {
      if (res && res.wallpaper_rotations) {
        appState.rotations = { ...appState.rotations, ...res.wallpaper_rotations };
      }
    });
  }
}

/**
 * Saves active wallpaper queue snapshot to storage for fast session restoration
 */
function saveQueueToStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const queueSlice = appState.wallpapers.slice(appState.currentIndex, appState.currentIndex + 25);
    chrome.storage.local.set({
      cached_wallpaper_queue: queueSlice,
      pagination_bookmark: appState.paginationBookmark
    });
  }
}

// =============================================================================
// Storage Layer (chrome.storage.local with LocalStorage fallback)
// =============================================================================

async function loadConfig() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['pinterestConfig', 'search_query'], (result) => {
        let loaded = { ...DEFAULT_CONFIG };
        if (result && result.pinterestConfig) {
          loaded = { ...loaded, ...result.pinterestConfig };
        }
        if (result && result.search_query) {
          loaded.searchQuery = result.search_query;
        }
        resolve(loaded);
      });
    } else {
      try {
        const saved = localStorage.getItem('pinterestConfig');
        const savedSearch = localStorage.getItem('search_query');
        let loaded = { ...DEFAULT_CONFIG };
        if (saved) loaded = { ...loaded, ...JSON.parse(saved) };
        if (savedSearch) loaded.searchQuery = savedSearch;
        resolve(loaded);
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
      chrome.storage.local.set({ 
        pinterestConfig: appState.config,
        search_query: appState.config.searchQuery || ''
      }, () => resolve());
    } else {
      try {
        localStorage.setItem('pinterestConfig', JSON.stringify(appState.config));
        if (appState.config.searchQuery) {
          localStorage.setItem('search_query', appState.config.searchQuery);
        }
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
// Editable Shortcuts Dock
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
// Privileged RSS Fetcher (Bypasses CORS via background service worker)
// =============================================================================

async function fetchRssContent(url) {
  // 1. First attempt: Send request to background service worker (Bypasses CORS in MV3)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'FETCH_RSS', url: url }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { success: false, error: 'No response from background worker' });
          }
        });
      });

      if (response && response.success && response.data) {
        return response.data;
      }
      if (response && response.error) {
        console.warn('Background worker RSS error:', response.error);
      }
    } catch (msgErr) {
      console.warn('Background messaging exception:', msgErr);
    }
  }

  // 2. Direct fetch fallback
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  return await res.text();
}

// =============================================================================
// Comprehensive Pinterest Multi-Source Extraction & Aggregator Engine
// =============================================================================

function sanitizeHandle(str) {
  if (!str) return '';
  let clean = str.trim();
  
  try {
    if (/^https?:\/\//i.test(clean)) {
      const parsed = new URL(clean);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        clean = parts[0];
      }
    }
  } catch (e) {}

  return clean.replace(/^@+/, '').replace(/\/feed\.rss$/i, '').replace(/^\/+|\/+$/g, '');
}

function sanitizeBoard(str) {
  if (!str) return '';
  let clean = str.trim();

  try {
    if (/^https?:\/\//i.test(clean)) {
      const parsed = new URL(clean);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length > 1) {
        clean = parts[1];
      } else if (parts.length === 1) {
        clean = parts[0];
      }
    }
  } catch (e) {}

  return clean.replace(/\.rss$/i, '').replace(/^\/+|\/+$/g, '');
}

function upgradePinterestImageUrl(rawUrl) {
  if (!rawUrl) return null;
  return rawUrl.replace(/\/(?:[0-9]+x[0-9]*|[0-9]+x)\//i, '/originals/');
}

/**
 * Extracts unique high-resolution pin wallpapers directly from HTML page content
 */
function extractPinsFromHtml(html, defaultTitle, defaultLink) {
  if (!html) return [];
  const pinRegex = /https:\/\/i\.pinimg\.com\/(?:236x|474x|564x|736x|originals)\/([a-f0-9\/]+)\.(jpg|png|webp)/gi;
  const pins = [];
  const seen = new Set();
  let match;

  while ((match = pinRegex.exec(html)) !== null) {
    const hash = match[1];
    const ext = match[2];
    
    // Filter out UI avatars or micro-thumbnails
    if (hash.includes('75x75') || hash.includes('150x150') || hash.includes('user/')) {
      continue;
    }
    
    const originalUrl = `https://i.pinimg.com/originals/${hash}.${ext}`;
    const fallbackUrl = `https://i.pinimg.com/736x/${hash}.${ext}`;
    
    if (!seen.has(hash)) {
      seen.add(hash);
      pins.push({
        title: defaultTitle || 'Pinterest Wallpaper',
        url: originalUrl,
        fallbackUrl: fallbackUrl,
        link: defaultLink || 'https://www.pinterest.com'
      });
    }
  }

  return pins;
}

/**
 * Extracts pins from a Pinterest RSS XML document
 */
function extractPinsFromRssXml(xmlText, fallbackTitle, fallbackLink) {
  if (!xmlText) return [];
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  if (xmlDoc.querySelector('parsererror')) {
    return [];
  }

  const items = xmlDoc.querySelectorAll('item');
  if (!items || items.length === 0) {
    return [];
  }

  const pins = [];
  const seen = new Set();

  items.forEach((item) => {
    let rawTitle = item.querySelector('title')?.textContent || '';
    rawTitle = rawTitle.trim();
    const title = rawTitle || fallbackTitle || 'Pinterest Wallpaper';
    const link = item.querySelector('link')?.textContent || fallbackLink || 'https://www.pinterest.com';
    
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
      if (!seen.has(highResUrl)) {
        seen.add(highResUrl);
        pins.push({
          title: title.replace(/&amp;/g, '&'),
          url: highResUrl,
          fallbackUrl: rawImgUrl,
          link: link
        });
      }
    }
  });

  return pins;
}

/**
 * Discovers user board slugs from user profile HTML
 */
function findBoardSlugsFromHtml(html, user) {
  if (!html || !user) return [];
  const regex = new RegExp(`href=["']\\/${user}\\/([^\\/"'?]+)\\/?["']`, 'gi');
  const boards = new Set();
  let m;
  while ((m = regex.exec(html)) !== null) {
    const slug = m[1].toLowerCase();
    if (!['saved', '_saved', 'created', '_created', 'pins', '_pins', 'followers', 'following', 'repins'].includes(slug)) {
      boards.add(slug);
    }
  }
  return [...boards];
}

/**
 * Fetches all user saved pins with deep multi-page pagination via background worker
 */
async function fetchUserPinsViaBackground(username, maxPages = 15) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'FETCH_ALL_USER_PINS', username, maxPages }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { success: false, error: 'No response from worker' });
          }
        });
      });

      if (response && response.success && Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }
    } catch (e) {
      console.warn('fetchUserPinsViaBackground exception:', e);
    }
  }
  return null;
}

/**
 * Fetches feed.rss for a user
 */
async function fetchFeedPins(user) {
  const rssUrl = `https://www.pinterest.com/${encodeURIComponent(user)}/feed.rss`;
  const xml = await fetchRssContent(rssUrl);
  return extractPinsFromRssXml(xml, `@${user} Feed Pin`, `https://www.pinterest.com/${user}/`);
}

/**
 * Aggregates all saved pins across paginated UserPinsResource, profile, and all detected boards
 */
async function fetchAllSavedPins(user) {
  const allPins = [];
  const seenUrls = new Set();

  function addPins(list) {
    if (!Array.isArray(list)) return;
    list.forEach(p => {
      if (p && p.url && !seenUrls.has(p.url)) {
        seenUrls.add(p.url);
        allPins.push(p);
      }
    });
  }

  // 1. Fetch paginated UserPinsResource via background worker (Gets 200+ pins!)
  const bgPins = await fetchUserPinsViaBackground(user, 15);
  if (bgPins && bgPins.length > 0) {
    addPins(bgPins);
  }

  // 2. Fetch Profile HTML and crawl discovered boards
  try {
    const profileHtml = await fetchRssContent(`https://www.pinterest.com/${encodeURIComponent(user)}/`);
    const profilePins = extractPinsFromHtml(profileHtml, `@${user} Pin`, `https://www.pinterest.com/${user}/`);
    addPins(profilePins);

    const boards = findBoardSlugsFromHtml(profileHtml, user);
    if (boards.length > 0) {
      const boardFetches = boards.slice(0, 8).map(async (boardSlug) => {
        try {
          const boardRssUrl = `https://www.pinterest.com/${encodeURIComponent(user)}/${encodeURIComponent(boardSlug)}.rss`;
          const boardXml = await fetchRssContent(boardRssUrl);
          return extractPinsFromRssXml(boardXml, `@${user}/${boardSlug}`, `https://www.pinterest.com/${user}/${boardSlug}`);
        } catch (e) {
          return [];
        }
      });

      const boardResults = await Promise.allSettled(boardFetches);
      boardResults.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          addPins(res.value);
        }
      });
    }
  } catch (e) {
    console.warn('Profile crawl notice:', e);
  }

  // 3. Fetch _saved/ tab HTML
  try {
    const savedHtml = await fetchRssContent(`https://www.pinterest.com/${encodeURIComponent(user)}/_saved/`);
    const savedPins = extractPinsFromHtml(savedHtml, `@${user} Saved Pin`, `https://www.pinterest.com/${user}/_saved/`);
    addPins(savedPins);
  } catch (e) {}

  return allPins;
}

/**
 * Combines both all saved pins and live user feed for maximum collection size
 */
async function fetchBothPins(user) {
  const allPins = [];
  const seenUrls = new Set();

  function addPins(list) {
    if (!Array.isArray(list)) return;
    list.forEach(p => {
      if (p && p.url && !seenUrls.has(p.url)) {
        seenUrls.add(p.url);
        allPins.push(p);
      }
    });
  }

  const [feedRes, savedRes] = await Promise.allSettled([
    fetchFeedPins(user),
    fetchAllSavedPins(user)
  ]);

  if (feedRes.status === 'fulfilled' && Array.isArray(feedRes.value)) {
    addPins(feedRes.value);
  }
  if (savedRes.status === 'fulfilled' && Array.isArray(savedRes.value)) {
    addPins(savedRes.value);
  }

  if (allPins.length === 0) {
    throw new Error(`No pins found for @${user}. The account might be private or empty.`);
  }

  return allPins;
}

/**
 * Fetches pins from one or multiple comma-separated boards
 */
async function fetchBoardPins(user, boardString) {
  const allPins = [];
  const seenUrls = new Set();

  function addPins(list) {
    if (!Array.isArray(list)) return;
    list.forEach(p => {
      if (p && p.url && !seenUrls.has(p.url)) {
        seenUrls.add(p.url);
        allPins.push(p);
      }
    });
  }

  const boards = boardString.split(',').map(b => sanitizeBoard(b)).filter(Boolean);
  if (boards.length === 0) boards.push('wallpapers');

  const fetches = boards.map(async (b) => {
    const boardPins = [];
    
    // 1. Fetch Board RSS
    try {
      const rssUrl = `https://www.pinterest.com/${encodeURIComponent(user)}/${encodeURIComponent(b)}.rss`;
      const xml = await fetchRssContent(rssUrl);
      const rssPins = extractPinsFromRssXml(xml, `@${user}/${b}`, `https://www.pinterest.com/${user}/${b}`);
      rssPins.forEach(p => boardPins.push(p));
    } catch (e) {}

    // 2. Fetch Board HTML page to extract extra pins
    try {
      const htmlUrl = `https://www.pinterest.com/${encodeURIComponent(user)}/${encodeURIComponent(b)}/`;
      const html = await fetchRssContent(htmlUrl);
      const htmlPins = extractPinsFromHtml(html, `@${user}/${b}`, `https://www.pinterest.com/${user}/${b}`);
      htmlPins.forEach(p => boardPins.push(p));
    } catch (e) {}

    return boardPins;
  });

  const results = await Promise.allSettled(fetches);
  results.forEach(res => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      addPins(res.value);
    }
  });

  if (allPins.length === 0) {
    throw new Error(`No pins found in board(s) for @${user}. Check the board slug.`);
  }

  return allPins;
}

/**
 * Searches Pinterest keywords and returns high-resolution wallpaper pins
 */
async function fetchPinterestSearch(query) {
  if (!query || !query.trim()) {
    throw new Error('Please enter a search query (e.g., 4k dark cyberpunk wallpaper).');
  }

  const cleanQuery = query.trim();

  // 1. Try fetching via background worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'FETCH_PINTEREST_SEARCH', query: cleanQuery, maxPages: 3 }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { success: false, error: 'No response from worker' });
          }
        });
      });

      if (response && response.success && Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }
    } catch (e) {
      console.warn('fetchPinterestSearch background worker error:', e);
    }
  }

  // 2. Direct HTML search fallback
  try {
    const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(cleanQuery)}&rs=typed`;
    const html = await fetchRssContent(searchUrl);
    const pins = extractPinsFromHtml(html, `${cleanQuery} Wallpaper`, `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(cleanQuery)}`);
    if (pins && pins.length > 0) {
      return pins;
    }
  } catch (e) {}

  throw new Error(`No wallpapers found for "${cleanQuery}". Try another keyword.`);
}

/**
 * Fetches 1 page/batch of search pins using cursor bookmark for endless streaming
 */
async function fetchPinterestSearchBatch(query, bookmark = null) {
  if (!query || !query.trim()) {
    throw new Error('Please enter a search query.');
  }

  const cleanQuery = query.trim();

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          type: 'FETCH_PINTEREST_SEARCH_PAGE', 
          query: cleanQuery, 
          bookmark: bookmark 
        }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { success: false, error: 'No response from worker' });
          }
        });
      });

      if (response && response.success && response.data) {
        return response.data; // { pins: [...], bookmark: '...', end: false }
      }
    } catch (e) {
      console.warn('fetchPinterestSearchBatch error:', e);
    }
  }

  // Fallback to full search
  const fallbackPins = await fetchPinterestSearch(cleanQuery);
  return { pins: fallbackPins, bookmark: null, end: true };
}

/**
 * Fetches 1 page/batch of user saved pins using cursor bookmark
 */
async function fetchUserPinsBatch(username, bookmark = null) {
  if (!username) return { pins: [], bookmark: null, end: true };

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          type: 'FETCH_USER_PINS_PAGE', 
          username: username, 
          bookmark: bookmark 
        }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { success: false, error: 'No response from worker' });
          }
        });
      });

      if (response && response.success && response.data) {
        return response.data; // { pins: [...], bookmark: '...', end: false }
      }
    } catch (e) {
      console.warn('fetchUserPinsBatch error:', e);
    }
  }

  const fallbackPins = await fetchAllSavedPins(username);
  return { pins: fallbackPins, bookmark: null, end: true };
}

/**
 * Automatically triggers background fetch for the next page of pins
 * when fewer than 6 unviewed images remain in the active queue
 */
async function fetchNextBatch() {
  if (appState.isFetchingNextBatch || appState.isLoadingFeed) return;
  const mode = appState.config.sourceMode;
  if (!['pinterest-search', 'pinterest-both', 'pinterest-saved'].includes(mode)) return;

  appState.isFetchingNextBatch = true;
  try {
    let result = null;
    if (mode === 'pinterest-search') {
      const query = appState.config.searchQuery || '4k dark cyberpunk wallpaper';
      result = await fetchPinterestSearchBatch(query, appState.paginationBookmark);
    } else if (mode === 'pinterest-saved' || mode === 'pinterest-both') {
      const user = sanitizeHandle(appState.config.username) || 'pinterest';
      result = await fetchUserPinsBatch(user, appState.paginationBookmark);
    }

    if (result && Array.isArray(result.pins) && result.pins.length > 0) {
      let addedCount = 0;
      result.pins.forEach(pin => {
        if (!appState.seenUrls.has(pin.url)) {
          appState.seenUrls.add(pin.url);
          appState.wallpaperQueue.push(pin);
          appState.wallpapers.push(pin);
          addedCount++;
        }
      });

      // Update bookmark cursor or reset if at end of stream to loop continuously
      if (result.end || !result.bookmark || result.bookmark === '-end-') {
        appState.paginationBookmark = null;
      } else {
        appState.paginationBookmark = result.bookmark;
      }

      // Save updated queue to chrome.storage.local
      saveQueueToStorage();
      updateActiveStatusLabel();
    } else {
      appState.paginationBookmark = null;
    }
  } catch (e) {
    console.warn('fetchNextBatch background error:', e);
  } finally {
    appState.isFetchingNextBatch = false;
  }
}

// =============================================================================
// Lazy Wallpaper Preloader & Sliding Window Buffer Engine
// =============================================================================

/**
 * Applies full-bleed orientation rotation classes to layer elements
 */
function setLayerRotation(el, rotation) {
  if (!el) return;
  el.classList.remove('rotate-0', 'rotate-90', 'rotate-180', 'rotate-270');
  const safeRot = [0, 90, 180, 270].includes(rotation) ? rotation : 0;
  el.classList.add(`rotate-${safeRot}`);
}

/**
 * Manually rotates the currently active wallpaper clockwise by 90°
 */
function rotateActiveWallpaper() {
  if (appState.wallpapers.length === 0) return;
  const currentItem = appState.wallpapers[appState.currentIndex];
  if (!currentItem) return;

  const currentRot = currentItem.rotation || 0;
  const nextRot = (currentRot + 90) % 360;
  currentItem.manualRotation = nextRot;
  currentItem.rotation = nextRot;

  // Persist rotation mapped to this specific image URL
  saveRotationForUrl(currentItem.url, nextRot);
  if (currentItem.fallbackUrl) {
    saveRotationForUrl(currentItem.fallbackUrl, nextRot);
  }

  const activeLayerEl = appState.activeLayer === 1 ? elements.bg1 : elements.bg2;
  setLayerRotation(activeLayerEl, nextRot);
  if (elements.bgAmbient) {
    setLayerRotation(elements.bgAmbient, nextRot);
  }

  saveActiveWallpaperToColdStart(currentItem);
  showToast(`Rotated wallpaper to ${nextRot}°`);
}

/**
 * Preloads a single image and inspects natural dimensions for portrait auto-rotation
 */
function preloadImage(wallpaper) {
  if (!wallpaper || !wallpaper.url) {
    return Promise.resolve({ success: false });
  }

  // Priority 1: Check persistent rotation mapping for this specific URL
  const savedRot = appState.rotations[wallpaper.url] !== undefined 
    ? appState.rotations[wallpaper.url] 
    : (wallpaper.fallbackUrl ? appState.rotations[wallpaper.fallbackUrl] : undefined);

  if (appState.preloadedCache.has(wallpaper.url)) {
    const cachedImg = appState.preloadedCache.get(wallpaper.url);
    const width = cachedImg.naturalWidth || cachedImg.width || 1920;
    const height = cachedImg.naturalHeight || cachedImg.height || 1080;
    const isPortrait = height > width;

    if (savedRot !== undefined) {
      wallpaper.manualRotation = savedRot;
      wallpaper.rotation = savedRot;
    } else if (wallpaper.manualRotation !== undefined) {
      wallpaper.rotation = wallpaper.manualRotation;
    } else {
      let baseRotation = (appState.config.autoRotate && isPortrait) ? 270 : 0;
      wallpaper.rotation = baseRotation;
    }
    return Promise.resolve({ success: true, src: wallpaper.url, rotation: wallpaper.rotation });
  }

  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      // Natural dimension inspection for automatic portrait-to-landscape reorientation (270° CCW)
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      const isPortrait = height > width;

      wallpaper.naturalWidth = width;
      wallpaper.naturalHeight = height;
      wallpaper.isPortrait = isPortrait;

      if (savedRot !== undefined) {
        wallpaper.manualRotation = savedRot;
        wallpaper.rotation = savedRot;
      } else if (wallpaper.manualRotation !== undefined) {
        wallpaper.rotation = wallpaper.manualRotation;
      } else {
        let baseRotation = (appState.config.autoRotate && isPortrait) ? 270 : 0;
        wallpaper.rotation = baseRotation;
      }

      // Decode immediately to ensure GPU rasterization is ready
      if (img.decode) {
        img.decode().catch(() => {});
      }

      // Keep cache size bounded to maximum 4 active images to prevent RAM buildup
      if (appState.preloadedCache.size >= 4) {
        const oldestKey = appState.preloadedCache.keys().next().value;
        appState.preloadedCache.delete(oldestKey);
      }
      appState.preloadedCache.set(wallpaper.url, img);
      resolve({ success: true, src: wallpaper.url, rotation: wallpaper.rotation });
    };

    img.onerror = () => {
      // If /originals/ resolution fails, fallback to 736x
      if (wallpaper.fallbackUrl && wallpaper.fallbackUrl !== wallpaper.url) {
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          const width = fallbackImg.naturalWidth || fallbackImg.width;
          const height = fallbackImg.naturalHeight || fallbackImg.height;
          const isPortrait = height > width;

          if (savedRot !== undefined) {
            wallpaper.manualRotation = savedRot;
            wallpaper.rotation = savedRot;
          } else if (wallpaper.manualRotation !== undefined) {
            wallpaper.rotation = wallpaper.manualRotation;
          } else {
            let baseRotation = (appState.config.autoRotate && isPortrait) ? 270 : 0;
            wallpaper.rotation = baseRotation;
          }

          if (fallbackImg.decode) fallbackImg.decode().catch(() => {});
          appState.preloadedCache.set(wallpaper.fallbackUrl, fallbackImg);
          resolve({ success: true, src: wallpaper.fallbackUrl, rotation: wallpaper.rotation });
        };
        fallbackImg.onerror = () => resolve({ success: false });
        fallbackImg.src = wallpaper.fallbackUrl;
      } else {
        resolve({ success: false });
      }
    };

    img.src = wallpaper.url;
  });
}

/**
 * Lazy loads and decodes the NEXT upcoming image into memory buffer 3-5 seconds ahead
 */
function preloadNextImmediateImage() {
  if (appState.wallpapers.length <= 1) return;
  const nextIdx = (appState.currentIndex + 1) % appState.wallpapers.length;
  const nextItem = appState.wallpapers[nextIdx];
  if (nextItem && !appState.preloadedCache.has(nextItem.url)) {
    preloadImage(nextItem);
  }
}

async function displayWallpaper(index, manual = false) {
  if (appState.wallpapers.length === 0) return;

  // Infinite wrap-around & reshuffle on cycle wrap
  let nextIndex = index;
  if (nextIndex >= appState.wallpapers.length) {
    nextIndex = 0;
    // Reshuffle wallpapers for endless non-repetitive variety
    if (appState.wallpapers.length > 2) {
      const current = appState.wallpapers[appState.currentIndex];
      appState.wallpapers = shuffleArray([...appState.wallpapers]);
      // Ensure we don't pick the same wallpaper immediately
      if (appState.wallpapers[0].url === current?.url && appState.wallpapers.length > 1) {
        const temp = appState.wallpapers[0];
        appState.wallpapers[0] = appState.wallpapers[1];
        appState.wallpapers[1] = temp;
      }
    }
  } else if (nextIndex < 0) {
    nextIndex = appState.wallpapers.length - 1;
  }

  appState.currentIndex = nextIndex;
  const currentItem = appState.wallpapers[nextIndex];

  // Preload current before crossfading
  const result = await preloadImage(currentItem);
  const imageSrc = result.success ? (result.src || currentItem.url) : (currentItem.fallbackUrl || currentItem.url);

  const nextLayerNum = appState.activeLayer === 1 ? 2 : 1;
  const activeLayerEl = appState.activeLayer === 1 ? elements.bg1 : elements.bg2;
  const nextLayerEl = nextLayerNum === 1 ? elements.bg1 : elements.bg2;

  // Check persistent rotation map
  const rotation = (appState.rotations && appState.rotations[currentItem.url] !== undefined)
    ? appState.rotations[currentItem.url]
    : (currentItem.rotation || 0);
  currentItem.rotation = rotation;

  // 1. Prepare inactive layer instantaneously while hidden (opacity 0)
  setLayerRotation(nextLayerEl, rotation);
  if (elements.bgAmbient) {
    setLayerRotation(elements.bgAmbient, rotation);
  }

  nextLayerEl.style.backgroundImage = `url("${imageSrc}")`;
  if (elements.bgAmbient) {
    elements.bgAmbient.style.backgroundImage = `url("${imageSrc}")`;
  }

  // Force reflow/style flush so rotation and dimensions are applied instantaneously before opacity crossfade
  void nextLayerEl.offsetHeight;

  // 2. Trigger pure opacity crossfade (0 -> 1 and 1 -> 0)
  nextLayerEl.classList.add('active');
  activeLayerEl.classList.remove('active');

  appState.activeLayer = nextLayerNum;

  elements.pinTitle.textContent = currentItem.title || 'Wallpaper';
  elements.pinLink.href = currentItem.link || '#';
  elements.pinLink.title = `View Source: ${currentItem.title}`;

  // Persist current wallpaper with rotation to cold-start cache immediately for 0ms next tab load
  saveActiveWallpaperToColdStart(currentItem);

  // Update Settings Active Status with lazy count
  updateActiveStatusLabel();

  // Threshold monitor: if fewer than 6 unviewed images remain in queue, fetch next page in background!
  const unviewedRemaining = appState.wallpapers.length - (appState.currentIndex + 1);
  if (unviewedRemaining <= 6) {
    fetchNextBatch();
  }

  // Lazy Preload NEXT image into memory for zero-flash transition
  preloadNextImmediateImage();

  if (manual) {
    resetCycleTimer();
  }
}

function updateActiveStatusLabel() {
  const mode = appState.config.sourceMode || 'pinterest-search';
  const total = appState.wallpapers.length;
  const current = total > 0 ? (appState.currentIndex + 1) : 0;

  let modeName = 'Pinterest';
  if (mode === 'pinterest-search') {
    modeName = `Search: "${appState.config.searchQuery || 'aesthetic'}"`;
  } else if (mode === 'pinterest-both') {
    modeName = `@${sanitizeHandle(appState.config.username) || 'pinterest'} (Saved + Feed)`;
  } else if (mode === 'pinterest-saved') {
    modeName = `@${sanitizeHandle(appState.config.username) || 'pinterest'} Saved Pins`;
  } else if (mode === 'pinterest-feed') {
    modeName = `@${sanitizeHandle(appState.config.username) || 'pinterest'} Feed`;
  } else if (mode === 'pinterest-board') {
    modeName = `@${sanitizeHandle(appState.config.username) || 'pinterest'}/${sanitizeBoard(appState.config.board) || 'wallpapers'}`;
  } else if (mode === 'direct-url') {
    modeName = 'Direct Image URL';
  } else if (mode === 'local-upload') {
    modeName = 'Local Image File';
  }

  updateStatus('ready', `Active: ${modeName} (Loaded ${current} of ${total} wallpapers)`);
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
  
  // Preload next image 3.5 seconds before next cycle
  const preloadAdvanceMs = Math.max(1000, intervalMs - 3500);
  appState.preloadTimer = setTimeout(() => {
    preloadNextImmediateImage();
  }, preloadAdvanceMs);

  appState.cycleTimer = setInterval(() => {
    nextWallpaper(false);
  }, intervalMs);
}

function stopCycleTimer() {
  if (appState.cycleTimer) {
    clearInterval(appState.cycleTimer);
    appState.cycleTimer = null;
  }
  if (appState.preloadTimer) {
    clearTimeout(appState.preloadTimer);
    appState.preloadTimer = null;
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

  const mode = appState.config.sourceMode || 'pinterest-search';
  const user = sanitizeHandle(appState.config.username) || 'pinterest';

  try {
    if (mode === 'pinterest-search') {
      const query = (appState.config.searchQuery || '4k dark cyberpunk wallpaper').trim();
      updateStatus('loading', `Searching Pinterest for "${query}"...`);
      
      // Fetch initial batch with pagination cursor
      const batch = await fetchPinterestSearchBatch(query, null);
      const pins = batch.pins || [];

      if (pins.length === 0) {
        throw new Error(`No wallpapers found matching "${query}".`);
      }

      appState.seenUrls.clear();
      pins.forEach(p => appState.seenUrls.add(p.url));
      appState.wallpaperQueue = [...pins];
      appState.wallpapers = shuffleArray([...pins]);
      appState.paginationBookmark = batch.bookmark || null;

      saveQueueToStorage();
      updateActiveStatusLabel();
      if (notify) showToast(`Streaming wallpapers for "${query}"`);

    } else if (mode === 'pinterest-both') {
      updateStatus('loading', `Aggregating all saved pins & feed for @${user}...`);
      const pins = await fetchBothPins(user);
      
      appState.seenUrls.clear();
      pins.forEach(p => appState.seenUrls.add(p.url));
      appState.wallpaperQueue = [...pins];
      appState.wallpapers = shuffleArray([...pins]);
      saveQueueToStorage();
      updateActiveStatusLabel();
      if (notify) showToast(`Loaded ${pins.length} wallpapers from @${user}`);

    } else if (mode === 'pinterest-saved') {
      updateStatus('loading', `Fetching all saved pins & boards for @${user}...`);
      const batch = await fetchUserPinsBatch(user, null);
      const pins = batch.pins || [];
      if (pins.length === 0) {
        throw new Error(`No saved pins found on profile for @${user}.`);
      }

      appState.seenUrls.clear();
      pins.forEach(p => appState.seenUrls.add(p.url));
      appState.wallpaperQueue = [...pins];
      appState.wallpapers = shuffleArray([...pins]);
      appState.paginationBookmark = batch.bookmark || null;

      saveQueueToStorage();
      updateActiveStatusLabel();
      if (notify) showToast(`Loaded ${pins.length} saved pins from @${user}`);

    } else if (mode === 'pinterest-feed') {
      updateStatus('loading', `Fetching latest feed stream for @${user}...`);
      const pins = await fetchFeedPins(user);
      if (pins.length === 0) {
        throw new Error(`No pins found in RSS feed for @${user}.`);
      }

      appState.seenUrls.clear();
      pins.forEach(p => appState.seenUrls.add(p.url));
      appState.wallpaperQueue = [...pins];
      appState.wallpapers = shuffleArray([...pins]);
      saveQueueToStorage();
      updateActiveStatusLabel();
      if (notify) showToast(`Loaded ${pins.length} wallpapers from @${user} Feed`);

    } else if (mode === 'pinterest-board') {
      const board = sanitizeBoard(appState.config.board) || 'wallpapers';
      updateStatus('loading', `Fetching board(s) "${board}" for @${user}...`);
      const pins = await fetchBoardPins(user, board);

      appState.seenUrls.clear();
      pins.forEach(p => appState.seenUrls.add(p.url));
      appState.wallpaperQueue = [...pins];
      appState.wallpapers = shuffleArray([...pins]);
      saveQueueToStorage();
      updateActiveStatusLabel();
      if (notify) showToast(`Loaded ${pins.length} wallpapers from board(s)`);

    } else if (mode === 'direct-url') {
      const url = (appState.config.directUrl || '').trim();
      if (!url) {
        throw new Error('Please enter a valid Direct Image URL in settings.');
      }
      appState.wallpaperQueue = [{
        title: 'Custom Direct Wallpaper',
        url: url,
        fallbackUrl: url,
        link: url
      }];
      appState.wallpapers = [...appState.wallpaperQueue];
      updateActiveStatusLabel();
      if (notify) showToast('Direct image wallpaper applied');

    } else if (mode === 'local-upload') {
      const base64 = appState.config.localImageBase64;
      if (!base64) {
        throw new Error('No local image uploaded yet. Upload an image in settings.');
      }
      appState.wallpaperQueue = [{
        title: appState.config.localImageName || 'Local File Wallpaper',
        url: base64,
        fallbackUrl: base64,
        link: '#'
      }];
      appState.wallpapers = [...appState.wallpaperQueue];
      updateActiveStatusLabel();
      if (notify) showToast('Local image wallpaper applied');
    }

    // Pick a random starting wallpaper so every new tab starts non-deterministically
    const randomIndex = Math.floor(Math.random() * appState.wallpapers.length);
    appState.currentIndex = randomIndex;
    await displayWallpaper(randomIndex);
    startCycleTimer();

  } catch (err) {
    console.warn('Wallpaper source error, falling back to curated wallpapers:', err);
    updateStatus('error', err.message || 'Error loading wallpaper');
    
    if (notify) {
      showToast(`${err.message}. Using aesthetic fallbacks.`);
    }

    appState.wallpaperQueue = [...FALLBACK_WALLPAPERS];
    appState.wallpapers = shuffleArray([...FALLBACK_WALLPAPERS]);
    const randomIndex = Math.floor(Math.random() * appState.wallpapers.length);
    appState.currentIndex = randomIndex;
    await displayWallpaper(randomIndex);
    startCycleTimer();
  } finally {
    appState.isLoadingFeed = false;
  }
}

// =============================================================================
// Settings Modal & Conditional Form UI
// =============================================================================

function updateFormVisibility(mode) {
  if (elements.groupPinterestSearch) elements.groupPinterestSearch.classList.add('hidden');
  elements.groupPresets.classList.add('hidden');
  elements.groupPinterestUser.classList.add('hidden');
  elements.groupPinterestBoard.classList.add('hidden');
  elements.groupDirectUrl.classList.add('hidden');
  elements.groupLocalUpload.classList.add('hidden');
  elements.groupInterval.classList.add('hidden');

  if (mode === 'pinterest-search') {
    if (elements.groupPinterestSearch) elements.groupPinterestSearch.classList.remove('hidden');
    elements.groupInterval.classList.remove('hidden');
  } else if (mode === 'pinterest-both' || mode === 'pinterest-saved' || mode === 'pinterest-feed') {
    elements.groupPinterestUser.classList.remove('hidden');
    elements.groupInterval.classList.remove('hidden');
  } else if (mode === 'pinterest-board') {
    elements.groupPresets.classList.remove('hidden');
    elements.groupPinterestUser.classList.remove('hidden');
    elements.groupPinterestBoard.classList.remove('hidden');
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
  const fitMode = appState.config.fitMode || 'cover';

  document.documentElement.style.setProperty('--dim-overlay', `rgba(0, 0, 0, ${dim / 100})`);
  document.documentElement.style.setProperty('--bg-blur-amount', `${blur}px`);
  document.documentElement.style.setProperty('--bg-size', fitMode);

  document.body.classList.remove('fit-cover', 'fit-contain', 'fit-auto');
  document.body.classList.add(`fit-${fitMode}`);
  
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
  const mode = appState.config.sourceMode || 'pinterest-search';
  elements.selectSourceMode.value = mode;
  updateFormVisibility(mode);

  if (elements.selectFitMode) {
    elements.selectFitMode.value = appState.config.fitMode || 'cover';
  }

  if (elements.inputAutoRotate) {
    elements.inputAutoRotate.checked = appState.config.autoRotate ?? true;
  }

  if (elements.inputSearchQuery) {
    elements.inputSearchQuery.value = appState.config.searchQuery || '4k dark cyberpunk wallpaper';
  }

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

  // Manual Orientation Rotate Button
  if (elements.rotateBtn) {
    elements.rotateBtn.addEventListener('click', rotateActiveWallpaper);
  }

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

  // Board Preset Chips
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

  // Search Suggestion Chips
  elements.searchChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      elements.searchChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const query = chip.dataset.query;
      if (query && elements.inputSearchQuery) {
        elements.inputSearchQuery.value = query;
        elements.inputSearchQuery.focus();
      }
    });
  });

  // Settings Form Submit
  elements.settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const mode = elements.selectSourceMode.value;
    const newSearchQuery = (elements.inputSearchQuery?.value || '4k dark cyberpunk wallpaper').trim();
    const newUsername = sanitizeHandle(elements.inputUsername.value) || 'pinterest';
    const newBoard = sanitizeBoard(elements.inputBoard.value) || 'wallpapers';
    const newDirectUrl = elements.inputDirectUrl.value.trim();
    const newFitMode = elements.selectFitMode?.value || 'cover';
    const newAutoRotate = elements.inputAutoRotate ? elements.inputAutoRotate.checked : true;
    const newInterval = Math.max(5, parseInt(elements.inputInterval.value, 10) || 30);
    const newTimeFormat = elements.inputTimeFormat.value || '12h';
    const newDim = parseInt(elements.inputDim.value, 10) || 25;
    const newBlur = parseInt(elements.inputBlur.value, 10) || 0;

    const updatedConfig = {
      sourceMode: mode,
      searchQuery: newSearchQuery,
      username: newUsername,
      board: newBoard,
      directUrl: newDirectUrl,
      fitMode: newFitMode,
      autoRotate: newAutoRotate,
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

    if (elements.selectFitMode) {
      elements.selectFitMode.value = DEFAULT_CONFIG.fitMode;
    }

    if (elements.inputAutoRotate) {
      elements.inputAutoRotate.checked = DEFAULT_CONFIG.autoRotate;
    }

    if (elements.inputSearchQuery) {
      elements.inputSearchQuery.value = DEFAULT_CONFIG.searchQuery;
    }

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
    elements.searchChips.forEach(c => c.classList.remove('active'));
    elements.localPreviewContainer.classList.add('hidden');
    appState.pendingLocalBase64 = null;
    appState.pendingLocalName = null;
  });

  // Keyboard Shortcuts (ArrowLeft = Prev, ArrowRight = Next, Space = Pause/Resume, R = Rotate 90°)
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
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      rotateActiveWallpaper();
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
  // 1. Instant First-Paint: Load rotations and apply last active wallpaper synchronously from cold-start cache
  loadRotations();
  applyColdStartWallpaper();

  // 2. Load persistent config & user shortcuts
  appState.config = await loadConfig();
  appState.userShortcuts = await loadUserShortcuts();

  applyVisualSettings();
  initClock();
  renderShortcuts();
  setupEventListeners();

  // 3. Restore cached queue from previous session so initial clicks work instantly
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['cached_wallpaper_queue', 'pagination_bookmark', 'wallpaper_rotations'], (res) => {
      if (res && res.wallpaper_rotations) {
        appState.rotations = { ...appState.rotations, ...res.wallpaper_rotations };
      }
      if (res && Array.isArray(res.cached_wallpaper_queue) && res.cached_wallpaper_queue.length > 0) {
        const shuffledCached = shuffleArray([...res.cached_wallpaper_queue]);
        shuffledCached.forEach(p => {
          if (!appState.seenUrls.has(p.url)) {
            appState.seenUrls.add(p.url);
            appState.wallpaperQueue.push(p);
            appState.wallpapers.push(p);
          }
        });
        if (res.pagination_bookmark) {
          appState.paginationBookmark = res.pagination_bookmark;
        }
      }
      
      // 4. Stream wallpapers in background & initialize live cycle
      loadWallpapersByMode(false);
    });
  } else {
    loadWallpapersByMode(false);
  }
}

// Immediately attempt cold-start on script execution before DOMContentLoaded
loadRotations();
applyColdStartWallpaper();

// Start on DOM Ready
document.addEventListener('DOMContentLoaded', initApp);
