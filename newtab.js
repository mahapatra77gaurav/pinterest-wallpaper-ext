/**
 * Pinterest Dynamic New Tab (Manifest V3)
 * High-performance, multi-source wallpaper cycler and editable Chrome shortcuts.
 */

// =============================================================================
// State & Configuration Defaults
// =============================================================================

const DEFAULT_CONFIG = {
  displayName: '',
  uiScale: 100, // percentage (75% to 125%)
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
  wallpaperQueue: [],          // Lightweight queue of wallpaper metadata
  wallpapers: [],              // Active streaming rotation array
  seenUrls: new Set(),         // De-duplication set for continuous batching
  rotations: {},               // Merged image URL / ID -> degrees rotation mapping
  userImageRotations: {},      // Persistent user_image_rotations store
  paginationBookmark: null,    // Cursor bookmark for Pinterest pagination
  isFetchingNextBatch: false,
  currentIndex: 0,
  navToken: 0,                 // Monotonic navigation request token for cancellation-safety
  activeLayer: 1,              // 1 for #bg-1, 2 for #bg-2
  cycleTimer: null,
  preloadTimer: null,
  preloadedCache: new Map(),   // In-memory image objects cache (current + next only)
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
  timeDigits: document.getElementById('time-digits'),
  timeAmpm: document.getElementById('time-ampm'),
  date: document.getElementById('date'),
  greeting: document.getElementById('greeting'),
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
  refreshFeedBtn: document.getElementById('refresh-feed-btn'),
  saveBtn: document.getElementById('save-btn'),
  settingsForm: document.getElementById('settings-form'),
  
  // Settings Form Inputs
  inputDisplayName: document.getElementById('input-display-name'),
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
  inputScale: document.getElementById('input-scale'),
  scaleVal: document.getElementById('scale-val'),
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
  searchSuggestions: document.getElementById('search-suggestions'),

  // Add Shortcut Dialog
  addShortcutDialog: document.getElementById('add-shortcut-dialog'),
  addShortcutForm: document.getElementById('add-shortcut-form'),
  closeAddShortcutBtn: document.getElementById('close-add-shortcut-btn'),
  cancelAddShortcutBtn: document.getElementById('cancel-add-shortcut-btn'),
  inputShortcutTitle: document.getElementById('input-shortcut-title'),
  inputShortcutUrl: document.getElementById('input-shortcut-url')
};

// =============================================================================
// Instant First-Paint (Cold-Start Cache Engine & Persistent Rotation Store)
// =============================================================================

/**
 * Normalizes an image URL or wallpaper object into a stable unique key (extracts Pinterest image hash / Unsplash ID)
 */
function getImageKey(wallpaperOrUrl) {
  if (!wallpaperOrUrl) return '';
  const url = typeof wallpaperOrUrl === 'string' ? wallpaperOrUrl : (wallpaperOrUrl.url || wallpaperOrUrl.resolvedUrl || wallpaperOrUrl.fallbackUrl || '');
  if (!url) return '';
  
  // Pinterest image hash: match /originals/hash.ext or /736x/hash.ext
  const pinMatch = url.match(/pinimg\.com\/(?:originals|\d+x|\d+x\d*)\/([a-f0-9\/]+?)(?:\.[a-z0-9]+)?(?:$|\?)/i);
  if (pinMatch) {
    return `pin_${pinMatch[1]}`;
  }
  
  // Unsplash photo id
  const unsplashMatch = url.match(/unsplash\.com\/photo-([a-zA-Z0-9_-]+)/i);
  if (unsplashMatch) {
    return `unsplash_${unsplashMatch[1]}`;
  }

  // Base64 local image or direct URL
  if (url.startsWith('data:')) {
    return `local_${url.substring(0, 40)}`;
  }

  return url;
}

/**
 * Retrieves saved custom rotation angle for a wallpaper from persistent store
 */
function getSavedRotation(wallpaper) {
  if (!wallpaper) return undefined;
  const store = appState.userImageRotations || appState.rotations || {};
  
  // Direct object property priority
  if (typeof wallpaper.manualRotation === 'number') return wallpaper.manualRotation;
  
  const keys = [
    getImageKey(wallpaper),
    wallpaper.url,
    wallpaper.resolvedUrl,
    wallpaper.fallbackUrl,
    wallpaper.id,
    wallpaper.link,
    getImageKey(wallpaper.url),
    getImageKey(wallpaper.resolvedUrl),
    getImageKey(wallpaper.fallbackUrl)
  ];

  for (const k of keys) {
    if (k && store[k] !== undefined) {
      return store[k];
    }
  }

  return undefined;
}

/**
 * Synchronously renders the last active or next upcoming wallpaper from local cache for 0ms cold-start
 */
function applyColdStartWallpaper() {
  try {
    const raw = localStorage.getItem('next_cold_start_wallpaper') || localStorage.getItem('last_active_wallpaper');
    const rawUser = localStorage.getItem('user_image_rotations');
    const rawLegacy = localStorage.getItem('wallpaper_rotations');
    const userMap = rawUser ? JSON.parse(rawUser) : {};
    const legacyMap = rawLegacy ? JSON.parse(rawLegacy) : {};
    appState.userImageRotations = { ...legacyMap, ...userMap };
    appState.rotations = { ...appState.userImageRotations };

    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && cached.url) {
        const savedRot = getSavedRotation(cached) !== undefined
          ? getSavedRotation(cached)
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
    chrome.storage.local.get(['next_cold_start_wallpaper', 'last_active_wallpaper', 'user_image_rotations', 'wallpaper_rotations'], (res) => {
      if (res) {
        const userMap = res.user_image_rotations || {};
        const legacyMap = res.wallpaper_rotations || {};
        appState.userImageRotations = { ...appState.userImageRotations, ...legacyMap, ...userMap };
        appState.rotations = { ...appState.userImageRotations };
      }
      const cached = res ? (res.next_cold_start_wallpaper || res.last_active_wallpaper) : null;
      if (cached && cached.url) {
        try {
          localStorage.setItem('next_cold_start_wallpaper', JSON.stringify(cached));
        } catch (e) {}

        const savedRot = getSavedRotation(cached) !== undefined
          ? getSavedRotation(cached)
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
  const rotation = getSavedRotation(wallpaper) !== undefined
    ? getSavedRotation(wallpaper)
    : (wallpaper.rotation || 0);

  const payload = {
    id: wallpaper.id || null,
    title: wallpaper.title || 'Wallpaper',
    url: wallpaper.resolvedUrl || wallpaper.url,
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
 * Saves next sequential wallpaper metadata for instant cold start on subsequent new tabs
 */
function saveNextColdStartWallpaper(wallpaper) {
  if (!wallpaper || !wallpaper.url) return;
  const rotation = getSavedRotation(wallpaper) !== undefined
    ? getSavedRotation(wallpaper)
    : (wallpaper.rotation || 0);

  const payload = {
    id: wallpaper.id || null,
    title: wallpaper.title || 'Wallpaper',
    url: wallpaper.resolvedUrl || wallpaper.url,
    fallbackUrl: wallpaper.fallbackUrl || wallpaper.url,
    link: wallpaper.link || '#',
    rotation: rotation
  };

  try {
    localStorage.setItem('next_cold_start_wallpaper', JSON.stringify(payload));
  } catch (e) {}

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ next_cold_start_wallpaper: payload });
  }
}

/**
 * Persists custom rotation angle mapped to a specific image across all its URL aliases & hash
 */
function saveRotationForUrl(url, degrees, wallpaper = null) {
  if (!url && (!wallpaper || !wallpaper.url)) return;
  const targetUrl = url || wallpaper?.url;

  if (wallpaper) {
    wallpaper.manualRotation = degrees;
    wallpaper.rotation = degrees;
  }

  const keys = [
    targetUrl,
    wallpaper?.url,
    wallpaper?.resolvedUrl,
    wallpaper?.fallbackUrl,
    wallpaper?.id,
    wallpaper?.link,
    getImageKey(wallpaper || targetUrl),
    getImageKey(targetUrl),
    getImageKey(wallpaper?.url),
    getImageKey(wallpaper?.resolvedUrl),
    getImageKey(wallpaper?.fallbackUrl)
  ];

  keys.forEach(k => {
    if (k) {
      appState.rotations[k] = degrees;
      appState.userImageRotations[k] = degrees;
    }
  });

  try {
    localStorage.setItem('user_image_rotations', JSON.stringify(appState.userImageRotations));
    localStorage.setItem('wallpaper_rotations', JSON.stringify(appState.rotations));
  } catch (e) {}

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      user_image_rotations: appState.userImageRotations,
      wallpaper_rotations: appState.rotations
    });
  }
}

/**
 * Loads persistent rotation mappings from storage
 */
function loadRotations() {
  try {
    const rawUser = localStorage.getItem('user_image_rotations');
    const rawLegacy = localStorage.getItem('wallpaper_rotations');
    const userMap = rawUser ? JSON.parse(rawUser) : {};
    const legacyMap = rawLegacy ? JSON.parse(rawLegacy) : {};
    appState.userImageRotations = { ...legacyMap, ...userMap };
    appState.rotations = { ...appState.userImageRotations };
  } catch (e) {}

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['user_image_rotations', 'wallpaper_rotations'], (res) => {
      if (res) {
        const userMap = res.user_image_rotations || {};
        const legacyMap = res.wallpaper_rotations || {};
        appState.userImageRotations = { ...appState.userImageRotations, ...legacyMap, ...userMap };
        appState.rotations = { ...appState.userImageRotations };
      }
    });
  }
}

/**
 * Saves active wallpaper queue snapshot to storage for fast session restoration & cross-tab progression
 */
function saveQueueToStorage() {
  const queuePayload = {
    wallpaper_global_queue: appState.wallpapers,
    wallpaper_queue_index: appState.currentIndex,
    pagination_bookmark: appState.paginationBookmark,
    active_source_mode: appState.config.sourceMode,
    active_search_query: appState.config.searchQuery,
    active_username: appState.config.username,
    active_board: appState.config.board
  };

  try {
    localStorage.setItem('wallpaper_queue_index', appState.currentIndex);
  } catch (e) {}

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set(queuePayload);
  }
}

// =============================================================================
// Storage Layer (chrome.storage.local with LocalStorage fallback)
// =============================================================================

async function loadConfig() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['pinterestConfig', 'search_query', 'display_name', 'displayName', 'ui_scale', 'uiScale'], (result) => {
        let loaded = { ...DEFAULT_CONFIG };
        if (result && result.pinterestConfig) {
          loaded = { ...loaded, ...result.pinterestConfig };
        }
        if (result && result.search_query) {
          loaded.searchQuery = result.search_query;
        }
        if (result && (result.displayName || result.display_name)) {
          loaded.displayName = result.displayName || result.display_name;
        }
        if (result && (result.uiScale !== undefined || result.ui_scale !== undefined)) {
          loaded.uiScale = parseInt(result.uiScale ?? result.ui_scale, 10) || 100;
        }
        loaded.interval = Math.max(5, parseInt(loaded.interval, 10) || 30);
        resolve(loaded);
      });
    } else {
      try {
        const saved = localStorage.getItem('pinterestConfig');
        const savedSearch = localStorage.getItem('search_query');
        const savedName = localStorage.getItem('display_name') || localStorage.getItem('displayName');
        const savedScale = localStorage.getItem('ui_scale') || localStorage.getItem('uiScale');
        let loaded = { ...DEFAULT_CONFIG };
        if (saved) loaded = { ...loaded, ...JSON.parse(saved) };
        if (savedSearch) loaded.searchQuery = savedSearch;
        if (savedName) loaded.displayName = savedName;
        if (savedScale) loaded.uiScale = parseInt(savedScale, 10) || 100;
        loaded.interval = Math.max(5, parseInt(loaded.interval, 10) || 30);
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
        search_query: appState.config.searchQuery || '',
        display_name: appState.config.displayName || '',
        displayName: appState.config.displayName || '',
        ui_scale: appState.config.uiScale ?? 100,
        uiScale: appState.config.uiScale ?? 100
      }, () => resolve());
    } else {
      try {
        localStorage.setItem('pinterestConfig', JSON.stringify(appState.config));
        if (appState.config.searchQuery) {
          localStorage.setItem('search_query', appState.config.searchQuery);
        }
        if (appState.config.displayName !== undefined) {
          localStorage.setItem('display_name', appState.config.displayName);
        }
        if (appState.config.uiScale !== undefined) {
          localStorage.setItem('ui_scale', String(appState.config.uiScale));
        }
      } catch (e) {}
      resolve();
    }
  });
}

// =============================================================================
// Clock & Date System with Dynamic Greeting
// =============================================================================

function getGreeting(hour, name = '') {
  let baseGreeting = 'Good morning';
  if (hour >= 5 && hour < 12) {
    baseGreeting = 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    baseGreeting = 'Good afternoon';
  } else if (hour >= 17 && hour < 22) {
    baseGreeting = 'Good evening';
  } else {
    baseGreeting = 'Good night';
  }

  const trimmedName = (name || appState.config.displayName || '').trim();
  if (trimmedName) {
    return `${baseGreeting}, ${trimmedName}`;
  }
  return baseGreeting;
}

function updateClock() {
  const now = new Date();
  
  const is12h = appState.config.timeFormat === '12h';
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  if (is12h) {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    if (elements.timeDigits && elements.timeAmpm) {
      elements.timeDigits.textContent = `${hours}:${minutes}`;
      elements.timeAmpm.textContent = ` ${ampm}`;
    } else if (elements.time) {
      elements.time.textContent = `${hours}:${minutes} ${ampm}`;
    }
  } else {
    const formattedHours = String(hours).padStart(2, '0');
    if (elements.timeDigits && elements.timeAmpm) {
      elements.timeDigits.textContent = `${formattedHours}:${minutes}`;
      elements.timeAmpm.textContent = '';
    } else if (elements.time) {
      elements.time.textContent = `${formattedHours}:${minutes}`;
    }
  }

  // Spaced, clean uppercase date (e.g. "SATURDAY, AUGUST 15")
  if (elements.date) {
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    elements.date.textContent = now.toLocaleDateString('en-US', dateOptions).toUpperCase();
  }

  // Dynamic time-aware greeting with personalized display name
  if (elements.greeting) {
    elements.greeting.textContent = getGreeting(now.getHours(), appState.config.displayName);
  }
}

function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

// =============================================================================
// Editable Vertical Shortcuts Dock
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

let draggedShortcutIndex = null;
let isDraggingActive = false;

function clearAllDragIndicators() {
  if (elements.shortcuts) {
    elements.shortcuts.classList.remove('is-dragging');
    const cards = elements.shortcuts.querySelectorAll('.shortcut-card');
    cards.forEach(c => c.classList.remove('dragging', 'drag-over'));
  }
}

function setupShortcutDragAndDrop(link, index) {
  link.setAttribute('draggable', 'true');
  link.dataset.index = index;

  link.addEventListener('dragstart', (e) => {
    draggedShortcutIndex = index;
    isDraggingActive = true;
    link.classList.add('dragging');
    if (elements.shortcuts) elements.shortcuts.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  });

  link.addEventListener('dragend', () => {
    link.classList.remove('dragging');
    clearAllDragIndicators();
    setTimeout(() => {
      isDraggingActive = false;
      draggedShortcutIndex = null;
    }, 100);
  });

  link.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedShortcutIndex === null || draggedShortcutIndex === index) {
      link.classList.remove('drag-over');
      return;
    }

    link.classList.add('drag-over');
  });

  link.addEventListener('dragleave', (e) => {
    // Only remove if leaving the card entirely
    if (!link.contains(e.relatedTarget)) {
      link.classList.remove('drag-over');
    }
  });

  link.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const fromIdx = draggedShortcutIndex !== null ? draggedShortcutIndex : parseInt(e.dataTransfer.getData('text/plain'), 10);
    clearAllDragIndicators();

    if (isNaN(fromIdx) || fromIdx === index || fromIdx < 0 || fromIdx >= appState.userShortcuts.length) {
      return;
    }

    const list = [...appState.userShortcuts];
    const [item] = list.splice(fromIdx, 1);
    list.splice(index, 0, item);

    await saveUserShortcuts(list);
    renderShortcuts();
  });

  link.addEventListener('click', (e) => {
    if (isDraggingActive) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
}

function renderShortcuts() {
  if (!elements.shortcuts) return;
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
    link.setAttribute('aria-label', title);

    setupShortcutDragAndDrop(link, index);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'shortcut-delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.title = `Delete ${title}`;
    deleteBtn.setAttribute('aria-label', `Delete ${title}`);
    deleteBtn.setAttribute('draggable', 'false');
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
    img.setAttribute('draggable', 'false');

    img.onerror = () => {
      img.remove();
      const letter = document.createElement('span');
      letter.className = 'shortcut-letter-avatar';
      letter.textContent = initial;
      letter.setAttribute('draggable', 'false');
      iconBox.appendChild(letter);
    };

    iconBox.appendChild(img);
    link.appendChild(deleteBtn);
    link.appendChild(iconBox);
    elements.shortcuts.appendChild(link);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'shortcut-add-card';
  addBtn.type = 'button';
  addBtn.title = 'Add New Shortcut';
  addBtn.setAttribute('aria-label', 'Add New Shortcut');
  addBtn.innerHTML = `
    <div class="shortcut-add-icon-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </div>
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

/**
 * Aggressively rewrites downscaled Pinterest thumbnail URLs to /originals/ master files
 */
function upgradePinterestImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  return rawUrl.replace(/\/(?:236x|474x|564x|736x|1200x|\d+x\d*|\d+x)\//gi, '/originals/');
}

/**
 * Generates preferred high-res resolution candidates with prioritized working URLs
 */
function getCandidateUrls(wallpaper) {
  const candidates = [];
  if (!wallpaper || !wallpaper.url) return candidates;

  // 1. Prioritize already resolved working URL from past load
  if (wallpaper.resolvedUrl && !candidates.includes(wallpaper.resolvedUrl)) {
    candidates.push(wallpaper.resolvedUrl);
  }

  // 2. The primary URL assigned to wallpaper
  if (wallpaper.url && !candidates.includes(wallpaper.url)) {
    candidates.push(wallpaper.url);
  }

  // 3. If it's a Pinterest image, include alternatives
  if (wallpaper.url.includes('pinimg.com/')) {
    const orig = wallpaper.url.replace(/\/(?:236x|474x|564x|736x|1200x|\d+x)\//gi, '/originals/');
    const url1200 = wallpaper.url.replace(/\/(?:originals|236x|474x|564x|736x|\d+x)\//gi, '/1200x/');
    const url736 = wallpaper.url.replace(/\/(?:originals|236x|474x|564x|1200x|\d+x)\//gi, '/736x/');
    if (orig && !candidates.includes(orig)) candidates.push(orig);
    if (url1200 && !candidates.includes(url1200)) candidates.push(url1200);
    if (url736 && !candidates.includes(url736)) candidates.push(url736);
  }

  if (wallpaper.fallbackUrl && !candidates.includes(wallpaper.fallbackUrl)) {
    candidates.push(wallpaper.fallbackUrl);
  }

  return candidates;
}

/**
 * Dimension & Quality Gate: ensures crisp full-sized images and drops micro-thumbnails
 */
function isHighResWallpaper(width, height, isPortrait = false) {
  if (!width || !height || width <= 0 || height <= 0) return false;
  const totalPixels = width * height;
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);

  // Reject tiny icons, avatars, and low-res thumbnails (< 400px min dimension or < 350k total pixels)
  if (minDim < 400 || maxDim < 700 || totalPixels < 350000) {
    return false;
  }
  return true;
}

/**
 * Extracts unique high-resolution pin wallpapers directly from HTML page content
 */
function extractPinsFromHtml(html, defaultTitle, defaultLink) {
  if (!html) return [];
  const pinRegex = /https:\/\/i\.pinimg\.com\/(?:236x|474x|564x|736x|1200x|originals)\/([a-f0-9\/]+)\.(jpg|png|webp)/gi;
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
    const fallbackUrl = `https://i.pinimg.com/1200x/${hash}.${ext}`;
    
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
 * Fetches 1 page/batch of user feed pins with bookmark pagination
 */
async function fetchFeedPinsBatch(username, bookmark = null) {
  if (!username) return { pins: [], bookmark: null, end: true };

  if (!bookmark) {
    // Initial page: Combine RSS feed with initial UserPins page to get bookmark
    const [feedRes, userPinsRes] = await Promise.allSettled([
      fetchFeedPins(username),
      fetchUserPinsBatch(username, null)
    ]);

    const combined = [];
    const seen = new Set();

    if (feedRes.status === 'fulfilled' && Array.isArray(feedRes.value)) {
      feedRes.value.forEach(p => {
        if (p && p.url && !seen.has(p.url)) {
          seen.add(p.url);
          combined.push(p);
        }
      });
    }

    let nextBookmark = null;
    let isEnd = false;
    if (userPinsRes.status === 'fulfilled' && userPinsRes.value && Array.isArray(userPinsRes.value.pins)) {
      userPinsRes.value.pins.forEach(p => {
        if (p && p.url && !seen.has(p.url)) {
          seen.add(p.url);
          combined.push(p);
        }
      });
      nextBookmark = userPinsRes.value.bookmark || null;
      isEnd = userPinsRes.value.end || false;
    }

    return { pins: combined, bookmark: nextBookmark, end: isEnd };
  } else {
    // Subsequent pages: paginate via UserPinsResource
    return fetchUserPinsBatch(username, bookmark);
  }
}

/**
 * Fetches 1 page/batch combining saved pins and live feed with bookmark pagination
 */
async function fetchBothPinsBatch(username, bookmark = null) {
  if (!username) return { pins: [], bookmark: null, end: true };

  if (!bookmark) {
    const [feedRes, savedRes] = await Promise.allSettled([
      fetchFeedPins(username),
      fetchUserPinsBatch(username, null)
    ]);

    const combined = [];
    const seen = new Set();

    if (feedRes.status === 'fulfilled' && Array.isArray(feedRes.value)) {
      feedRes.value.forEach(p => {
        if (p && p.url && !seen.has(p.url)) {
          seen.add(p.url);
          combined.push(p);
        }
      });
    }

    let nextBookmark = null;
    let isEnd = false;
    if (savedRes.status === 'fulfilled' && savedRes.value && Array.isArray(savedRes.value.pins)) {
      savedRes.value.pins.forEach(p => {
        if (p && p.url && !seen.has(p.url)) {
          seen.add(p.url);
          combined.push(p);
        }
      });
      nextBookmark = savedRes.value.bookmark || null;
      isEnd = savedRes.value.end || false;
    }

    return { pins: combined, bookmark: nextBookmark, end: isEnd };
  } else {
    return fetchUserPinsBatch(username, bookmark);
  }
}

/**
 * Fetches 1 page/batch for Pinterest Boards with bookmark pagination
 */
async function fetchBoardPinsBatch(username, boardString, bookmark = null) {
  const board = sanitizeBoard(boardString) || 'wallpapers';
  const query = `${username} ${board}`;

  if (!bookmark) {
    // Initial page: Combine direct board RSS/HTML crawl with board search batch
    const [boardPinsRes, searchBatchRes] = await Promise.allSettled([
      fetchBoardPins(username, board),
      fetchPinterestSearchBatch(query, null)
    ]);

    const combined = [];
    const seen = new Set();

    if (boardPinsRes.status === 'fulfilled' && Array.isArray(boardPinsRes.value)) {
      boardPinsRes.value.forEach(p => {
        if (p && p.url && !seen.has(p.url)) {
          seen.add(p.url);
          combined.push(p);
        }
      });
    }

    let nextBookmark = null;
    let isEnd = false;
    if (searchBatchRes.status === 'fulfilled' && searchBatchRes.value && Array.isArray(searchBatchRes.value.pins)) {
      searchBatchRes.value.pins.forEach(p => {
        if (p && p.url && !seen.has(p.url)) {
          seen.add(p.url);
          combined.push(p);
        }
      });
      nextBookmark = searchBatchRes.value.bookmark || null;
      isEnd = searchBatchRes.value.end || false;
    }

    return { pins: combined, bookmark: nextBookmark, end: isEnd };
  } else {
    // Subsequent pages: paginate continuous board stream
    return fetchPinterestSearchBatch(query, bookmark);
  }
}

/**
 * Fetches 1 page/batch of algorithmic recommended pins from the user's logged-in Home Feed (in.pinterest.com)
 */
async function fetchPinterestHomefeedBatch(bookmark = null) {
  console.log('%c[Pinterest Home Feed]%c Requesting personalized stream... %cBookmark:', 'color: #e60023; font-weight: bold;', 'color: #ffffff;', 'color: #888888;', bookmark || 'initial');

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          type: 'FETCH_PINTEREST_HOMEFEED_PAGE', 
          bookmark: bookmark 
        }, (res) => {
          if (chrome.runtime.lastError) {
            console.error('[Pinterest Home Feed] Service worker communication error:', chrome.runtime.lastError.message);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { success: false, error: 'No response from service worker' });
          }
        });
      });

      if (response && response.success && response.data) {
        const pinCount = response.data.pins ? response.data.pins.length : 0;
        console.log(`%c[Pinterest Home Feed]%c Successfully received ${pinCount} recommended wallpapers. %cNext bookmark:`, 'color: #00d26a; font-weight: bold;', 'color: #ffffff;', 'color: #888888;', response.data.bookmark || 'none');
        return response.data; // { pins: [...], bookmark: '...', end: false }
      }

      if (response && response.error) {
        if (response.error.includes('NOT_LOGGED_IN')) {
          console.warn('%c[Pinterest Home Feed]%c Not logged into Pinterest in this browser. Please visit https://in.pinterest.com to log in.', 'color: #ff9800; font-weight: bold;', 'color: #ffcc80;');
          throw new Error('Please log in to Pinterest (in.pinterest.com) in your browser to view your personalized home feed.');
        }
        console.error('[Pinterest Home Feed] Background worker returned error:', response.error);
        throw new Error(response.error);
      }
    } catch (e) {
      if (e.message && e.message.includes('log in to Pinterest')) {
        throw e;
      }
      console.warn('[Pinterest Home Feed] Batch fetch exception:', e);
      throw e;
    }
  }

  throw new Error('Please log in to Pinterest (in.pinterest.com) in your browser to load your personalized home feed.');
}

/**
 * Automatically triggers background fetch for the next page of pins
 * when fewer than 6 unviewed images remain in the active queue (unified across all Pinterest modes)
 */
async function fetchNextBatch() {
  if (appState.isFetchingNextBatch || appState.isLoadingFeed) return;
  const mode = appState.config.sourceMode;
  if (!['pinterest-homefeed', 'pinterest-search', 'pinterest-both', 'pinterest-saved', 'pinterest-feed', 'pinterest-board'].includes(mode)) return;

  appState.isFetchingNextBatch = true;
  try {
    let result = null;
    const user = sanitizeHandle(appState.config.username) || 'pinterest';

    if (mode === 'pinterest-homefeed') {
      result = await fetchPinterestHomefeedBatch(appState.paginationBookmark);
    } else if (mode === 'pinterest-search') {
      const query = appState.config.searchQuery || '4k dark cyberpunk wallpaper';
      result = await fetchPinterestSearchBatch(query, appState.paginationBookmark);
    } else if (mode === 'pinterest-saved') {
      result = await fetchUserPinsBatch(user, appState.paginationBookmark);
    } else if (mode === 'pinterest-feed') {
      result = await fetchFeedPinsBatch(user, appState.paginationBookmark);
    } else if (mode === 'pinterest-both') {
      result = await fetchBothPinsBatch(user, appState.paginationBookmark);
    } else if (mode === 'pinterest-board') {
      const board = sanitizeBoard(appState.config.board) || 'wallpapers';
      result = await fetchBoardPinsBatch(user, board, appState.paginationBookmark);
    }

    if (result && Array.isArray(result.pins) && result.pins.length > 0) {
      let addedPins = [];
      result.pins.forEach(pin => {
        if (!appState.seenUrls.has(pin.url)) {
          appState.seenUrls.add(pin.url);
          appState.wallpaperQueue.push(pin);
          addedPins.push(pin);
        }
      });

      if (addedPins.length > 0) {
        const shuffledAdded = shuffleArray([...addedPins]);
        appState.wallpapers.push(...shuffledAdded);
      }

      // Update bookmark cursor or reset if at end of stream to loop continuously
      if (result.end || !result.bookmark || result.bookmark === '-end-') {
        appState.paginationBookmark = null;
      } else {
        appState.paginationBookmark = result.bookmark;
      }

      // Save updated queue snapshot to chrome.storage.local
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
 * Manually rotates the currently active wallpaper clockwise by 90° and persists in user_image_rotations
 */
function rotateActiveWallpaper() {
  if (appState.wallpapers.length === 0) return;
  const currentItem = appState.wallpapers[appState.currentIndex];
  if (!currentItem) return;

  const currentRot = (getSavedRotation(currentItem) !== undefined) ? getSavedRotation(currentItem) : (currentItem.rotation || 0);
  const nextRot = (currentRot + 90) % 360;
  currentItem.manualRotation = nextRot;
  currentItem.rotation = nextRot;

  // Persist rotation mapped to this specific image in user_image_rotations permanent store
  saveRotationForUrl(currentItem.url, nextRot, currentItem);

  const activeLayerEl = appState.activeLayer === 1 ? elements.bg1 : elements.bg2;
  setLayerRotation(activeLayerEl, nextRot);
  if (elements.bgAmbient) {
    setLayerRotation(elements.bgAmbient, nextRot);
  }

  saveActiveWallpaperToColdStart(currentItem);
  showToast(`Rotated wallpaper to ${nextRot}°`);
}

/**
 * Preloads candidate URLs with high-res quality gate and fast 1200ms timeout per candidate
 */
function preloadImage(wallpaper) {
  if (!wallpaper) {
    return Promise.resolve({ success: false });
  }

  // Priority 1: Check persistent custom rotation mapping (user_image_rotations)
  const savedRot = getSavedRotation(wallpaper);
  const candidates = getCandidateUrls(wallpaper);

  // Check cache for any already-cached candidate that meets quality standards
  for (const candidate of candidates) {
    if (appState.preloadedCache.has(candidate)) {
      const cachedImg = appState.preloadedCache.get(candidate);
      const width = cachedImg.naturalWidth || cachedImg.width || 1920;
      const height = cachedImg.naturalHeight || cachedImg.height || 1080;
      const isPortrait = height > width;

      if (!isHighResWallpaper(width, height, isPortrait)) {
        continue;
      }

      if (savedRot !== undefined) {
        wallpaper.manualRotation = savedRot;
        wallpaper.rotation = savedRot;
      } else if (typeof wallpaper.manualRotation === 'number') {
        wallpaper.rotation = wallpaper.manualRotation;
      } else {
        let baseRotation = (appState.config.autoRotate && isPortrait) ? 270 : 0;
        wallpaper.rotation = baseRotation;
      }

      wallpaper.resolvedUrl = candidate;
      return Promise.resolve({ success: true, src: candidate, rotation: wallpaper.rotation });
    }
  }

  // Sequentially attempt candidates with fast 1200ms timeout per candidate
  return new Promise(async (resolve) => {
    for (const url of candidates) {
      const candidateResult = await new Promise((resCandidate) => {
        let settled = false;
        const img = new Image();
        const timeoutId = setTimeout(() => {
          if (!settled) {
            settled = true;
            img.src = '';
            resCandidate(null);
          }
        }, 1200);

        img.onload = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);

          const width = img.naturalWidth || img.width || 0;
          const height = img.naturalHeight || img.height || 0;
          const isPortrait = height > width;

          // Quality Gate: verify resolution threshold
          if (!isHighResWallpaper(width, height, isPortrait)) {
            resCandidate(null);
            return;
          }

          wallpaper.naturalWidth = width;
          wallpaper.naturalHeight = height;
          wallpaper.isPortrait = isPortrait;
          wallpaper.resolvedUrl = url;

          const currentSavedRot = getSavedRotation(wallpaper);
          if (currentSavedRot !== undefined) {
            wallpaper.manualRotation = currentSavedRot;
            wallpaper.rotation = currentSavedRot;
          } else if (typeof wallpaper.manualRotation === 'number') {
            wallpaper.rotation = wallpaper.manualRotation;
          } else {
            let baseRotation = (appState.config.autoRotate && isPortrait) ? 270 : 0;
            wallpaper.rotation = baseRotation;
          }

          if (img.decode) {
            img.decode().catch(() => {});
          }

          // Keep cache bounded to 10 active images
          if (appState.preloadedCache.size >= 10) {
            const oldestKey = appState.preloadedCache.keys().next().value;
            appState.preloadedCache.delete(oldestKey);
          }
          appState.preloadedCache.set(url, img);

          resCandidate({ success: true, src: url, rotation: wallpaper.rotation });
        };

        img.onerror = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resCandidate(null);
        };

        img.src = url;
      });

      if (candidateResult && candidateResult.success) {
        return resolve(candidateResult);
      }
    }

    // All candidates failed to load or were below quality threshold
    resolve({ success: false, reason: 'low-res-or-load-error' });
  });
}

/**
 * Sliding-Window Buffer Preloader: Preloads next 3 images and previous 1 image into memory
 * so every arrow navigation click renders instantly with 0ms delay
 */
function preloadBufferWindow() {
  if (!appState.wallpapers || appState.wallpapers.length <= 1) return;
  const total = appState.wallpapers.length;

  const offsets = [1, 2, 3, -1];
  for (const offset of offsets) {
    const targetIdx = (((appState.currentIndex + offset) % total) + total) % total;
    const item = appState.wallpapers[targetIdx];
    if (item && !appState.preloadedCache.has(item.resolvedUrl || item.url)) {
      preloadImage(item).catch(() => {});
    }
  }
}

/**
 * Lazy loads and decodes the NEXT upcoming image into memory buffer 3-5 seconds ahead
 */
function preloadNextImmediateImage() {
  preloadBufferWindow();
}

/**
 * Self-healing display & navigation engine with monotonic cancellation token and continuous circular traversal
 */
async function displayWallpaper(startIndex, directionOrManual = 1, manual = false) {
  if (!appState.wallpapers || appState.wallpapers.length === 0) {
    appState.wallpapers = [...FALLBACK_WALLPAPERS];
  }

  let direction = 1;
  let isManual = false;
  if (typeof directionOrManual === 'boolean') {
    isManual = directionOrManual;
    direction = 1;
  } else if (typeof directionOrManual === 'number') {
    direction = directionOrManual;
    isManual = manual;
  }

  // Monotonic navigation token: supersedes in-flight requests and cancels stale transitions
  const currentNavToken = ++appState.navToken;

  let candidateIndex = startIndex;
  let attempts = 0;
  const maxAttempts = Math.min(30, appState.wallpapers.length + 10);

  while (attempts < maxAttempts && appState.wallpapers.length > 0) {
    // If a subsequent navigation click arrived, abort immediately
    if (currentNavToken !== appState.navToken) return;

    attempts++;

    // Continuous circular buffer wrap
    const total = appState.wallpapers.length;
    let wrappedIndex = ((candidateIndex % total) + total) % total;

    const candidateItem = appState.wallpapers[wrappedIndex];
    if (!candidateItem) {
      candidateIndex += (direction >= 0 ? 1 : -1);
      continue;
    }

    // Preload current candidate through quality gate and fallback URLs
    const result = await preloadImage(candidateItem);

    // Verify token after async preload
    if (currentNavToken !== appState.navToken) return;

    if (!result || !result.success) {
      console.warn(`[SelfHealing] Dropping failed/blurry wallpaper #${wrappedIndex} ("${candidateItem.title || candidateItem.url}") and seeking in direction ${direction >= 0 ? '+1' : '-1'}...`);
      // Remove bad candidate from active queue
      appState.wallpapers.splice(wrappedIndex, 1);
      if (appState.wallpapers.length === 0) {
        appState.wallpapers = [...FALLBACK_WALLPAPERS];
      }

      // If going backwards (-1), target the previous item before wrappedIndex
      // If going forwards (+1 or 0), the splice shifted the next item to wrappedIndex
      if (direction < 0) {
        candidateIndex = wrappedIndex - 1;
      } else {
        candidateIndex = wrappedIndex;
      }
      continue;
    }

    // Valid high-res wallpaper confirmed!
    appState.currentIndex = wrappedIndex;
    const currentItem = appState.wallpapers[wrappedIndex];
    const imageSrc = result.src || currentItem.resolvedUrl || currentItem.url;

    const nextLayerNum = appState.activeLayer === 1 ? 2 : 1;
    const activeLayerEl = appState.activeLayer === 1 ? elements.bg1 : elements.bg2;
    const nextLayerEl = nextLayerNum === 1 ? elements.bg1 : elements.bg2;

    // Check persistent rotation map (user_image_rotations store)
    const savedRot = getSavedRotation(currentItem);
    const rotation = savedRot !== undefined ? savedRot : (currentItem.rotation || 0);
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

    // Force reflow so rotation and dimensions are applied instantaneously before opacity crossfade
    void nextLayerEl.offsetHeight;

    // Verify token one last time before active layer transition
    if (currentNavToken !== appState.navToken) return;

    // 2. Trigger pure opacity crossfade (0 -> 1 and 1 -> 0)
    nextLayerEl.classList.add('active');
    activeLayerEl.classList.remove('active');

    appState.activeLayer = nextLayerNum;

    if (elements.pinTitle) {
      elements.pinTitle.textContent = currentItem.title || 'Wallpaper';
    }
    if (elements.pinLink) {
      elements.pinLink.href = currentItem.link || '#';
      elements.pinLink.title = `View Source: ${currentItem.title}`;
    }

    // Persist current wallpaper with rotation to cold-start cache immediately for 0ms next tab load
    saveActiveWallpaperToColdStart(currentItem);

    // Calculate next sequential wallpaper and persist as next cold-start target for future new tabs
    if (appState.wallpapers.length > 1) {
      const nextSequentialIdx = (wrappedIndex + 1) % appState.wallpapers.length;
      const nextSequentialItem = appState.wallpapers[nextSequentialIdx];
      if (nextSequentialItem) {
        saveNextColdStartWallpaper(nextSequentialItem);
      }
    }

    // Update global queue state and current pointer across tabs
    saveQueueToStorage();

    // Update Settings Active Status with lazy count
    updateActiveStatusLabel();

    // Threshold monitor: if fewer than 6 unviewed images remain in queue, fetch next page in background!
    const unviewedRemaining = appState.wallpapers.length - (appState.currentIndex + 1);
    if (unviewedRemaining <= 6) {
      fetchNextBatch();
    }

    // Sliding-Window Buffer Preload: buffer surrounding wallpapers for 0ms arrow clicks
    preloadBufferWindow();

    if (isManual) {
      resetCycleTimer();
    }

    return;
  }
}

function updateActiveStatusLabel() {
  const mode = appState.config.sourceMode || 'pinterest-search';
  const total = appState.wallpapers.length;
  const current = total > 0 ? (appState.currentIndex + 1) : 0;

  let modeName = 'Pinterest';
  if (mode === 'pinterest-homefeed') {
    modeName = 'Personalized Home Feed (in.pinterest.com)';
  } else if (mode === 'pinterest-search') {
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
  if (appState.wallpapers.length <= 5) {
    fetchNextBatch();
  }
  const nextIdx = appState.currentIndex + 1;
  displayWallpaper(nextIdx, 1, manual);
}

function prevWallpaper(manual = true) {
  if (appState.wallpapers.length <= 5) {
    fetchNextBatch();
  }
  const prevIdx = appState.currentIndex - 1;
  displayWallpaper(prevIdx, -1, manual);
}

function startCycleTimer() {
  stopCycleTimer();
  if (appState.isPaused || !appState.wallpapers || appState.wallpapers.length <= 1) return;

  const intervalSec = parseInt(appState.config.interval, 10) || 30;
  const intervalMs = Math.max(5, intervalSec) * 1000;
  
  // Preload next image before timer completes
  const preloadAdvanceMs = Math.max(1000, intervalMs - 3500);
  appState.preloadTimer = setTimeout(() => {
    preloadNextImmediateImage();
  }, preloadAdvanceMs);

  appState.cycleTimer = setTimeout(async () => {
    await nextWallpaper(false);
    if (!appState.isPaused) {
      startCycleTimer();
    }
  }, intervalMs);
}

function stopCycleTimer() {
  if (appState.cycleTimer) {
    clearTimeout(appState.cycleTimer);
    clearInterval(appState.cycleTimer);
    appState.cycleTimer = null;
  }
  if (appState.preloadTimer) {
    clearTimeout(appState.preloadTimer);
    clearInterval(appState.preloadTimer);
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
    if (mode === 'pinterest-homefeed') {
      updateStatus('loading', 'Fetching personalized home feed recommendations from in.pinterest.com...');
      
      const batch = await fetchPinterestHomefeedBatch(null);
      const pins = batch.pins || [];

      if (pins.length === 0) {
        throw new Error('No wallpapers found in home feed. Please log in to in.pinterest.com in your browser.');
      }

      appState.seenUrls.clear();
      pins.forEach(p => appState.seenUrls.add(p.url));
      appState.wallpaperQueue = [...pins];
      appState.wallpapers = shuffleArray([...pins]);
      appState.paginationBookmark = batch.bookmark || null;

      saveQueueToStorage();
      updateActiveStatusLabel();
      if (notify) showToast(`Loaded ${pins.length} personalized wallpapers from Home Feed`);

    } else if (mode === 'pinterest-search') {
      const query = (appState.config.searchQuery || '4k dark cyberpunk wallpaper').trim();
      updateStatus('loading', `Searching Pinterest for "${query}"...`);
      
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
      const batch = await fetchBothPinsBatch(user, null);
      const pins = batch.pins || [];

      if (pins.length === 0) {
        throw new Error(`No pins found for @${user}. The account might be private or empty.`);
      }
      
      appState.seenUrls.clear();
      pins.forEach(p => appState.seenUrls.add(p.url));
      appState.wallpaperQueue = [...pins];
      appState.wallpapers = shuffleArray([...pins]);
      appState.paginationBookmark = batch.bookmark || null;

      saveQueueToStorage();
      updateActiveStatusLabel();
      if (notify) showToast(`Loaded ${pins.length} wallpapers from @${user}`);

    } else if (mode === 'pinterest-saved') {
      updateStatus('loading', `Fetching all saved pins for @${user}...`);
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
      const batch = await fetchFeedPinsBatch(user, null);
      const pins = batch.pins || [];
      if (pins.length === 0) {
        throw new Error(`No pins found in feed for @${user}.`);
      }

      appState.seenUrls.clear();
      pins.forEach(p => appState.seenUrls.add(p.url));
      appState.wallpaperQueue = [...pins];
      appState.wallpapers = shuffleArray([...pins]);
      appState.paginationBookmark = batch.bookmark || null;

      saveQueueToStorage();
      updateActiveStatusLabel();
      if (notify) showToast(`Loaded ${pins.length} wallpapers from @${user} Feed`);

    } else if (mode === 'pinterest-board') {
      const board = sanitizeBoard(appState.config.board) || 'wallpapers';
      updateStatus('loading', `Fetching board(s) "${board}" for @${user}...`);
      const batch = await fetchBoardPinsBatch(user, board, null);
      const pins = batch.pins || [];
      if (pins.length === 0) {
        throw new Error(`No pins found in board(s) "${board}" for @${user}.`);
      }

      appState.seenUrls.clear();
      pins.forEach(p => appState.seenUrls.add(p.url));
      appState.wallpaperQueue = [...pins];
      appState.wallpapers = shuffleArray([...pins]);
      appState.paginationBookmark = batch.bookmark || null;

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

  if (mode === 'pinterest-homefeed') {
    elements.groupInterval.classList.remove('hidden');
  } else if (mode === 'pinterest-search') {
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
  const dim = 25;
  const blur = 0;
  const fitMode = appState.config.fitMode || 'cover';
  const uiScale = appState.config.uiScale ?? 100;
  const scaleFactor = uiScale / 100;

  document.documentElement.style.setProperty('--dim-overlay', `rgba(0, 0, 0, ${dim / 100})`);
  document.documentElement.style.setProperty('--bg-blur-amount', `${blur}px`);
  document.documentElement.style.setProperty('--bg-size', fitMode);
  document.documentElement.style.setProperty('--ui-scale', `${scaleFactor}`);

  document.body.classList.remove('fit-cover', 'fit-contain', 'fit-auto');
  document.body.classList.add(`fit-${fitMode}`);
  
  if (elements.scaleVal) elements.scaleVal.textContent = uiScale;
  if (elements.inputScale) elements.inputScale.value = uiScale;
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
  if (elements.inputDisplayName) {
    elements.inputDisplayName.value = appState.config.displayName || '';
  }

  const mode = appState.config.sourceMode || 'pinterest-search';
  if (elements.selectSourceMode) {
    elements.selectSourceMode.value = mode;
    updateFormVisibility(mode);
  }

  if (elements.selectFitMode) {
    elements.selectFitMode.value = appState.config.fitMode || 'cover';
  }

  if (elements.inputAutoRotate) {
    elements.inputAutoRotate.checked = appState.config.autoRotate ?? true;
  }

  if (elements.inputSearchQuery) {
    elements.inputSearchQuery.value = appState.config.searchQuery || '4k dark cyberpunk wallpaper';
  }

  if (elements.inputUsername) elements.inputUsername.value = appState.config.username || 'pinterest';
  if (elements.inputBoard) elements.inputBoard.value = appState.config.board || 'wallpapers';
  if (elements.inputDirectUrl) elements.inputDirectUrl.value = appState.config.directUrl || '';
  if (elements.inputInterval) elements.inputInterval.value = appState.config.interval || 30;
  if (elements.inputTimeFormat) elements.inputTimeFormat.value = appState.config.timeFormat || '12h';
  
  if (elements.inputScale) {
    elements.inputScale.value = appState.config.uiScale ?? 100;
  }
  if (elements.scaleVal) {
    elements.scaleVal.textContent = appState.config.uiScale ?? 100;
  }
  
  // Local preview
  if (elements.localPreviewImg && elements.localPreviewName && elements.localPreviewContainer) {
    if (appState.config.localImageBase64) {
      elements.localPreviewImg.src = appState.config.localImageBase64;
      elements.localPreviewName.textContent = appState.config.localImageName || 'Stored Image';
      elements.localPreviewContainer.classList.remove('hidden');
    } else {
      elements.localPreviewContainer.classList.add('hidden');
    }
  }

  appState.pendingLocalBase64 = null;
  appState.pendingLocalName = null;

  applyVisualSettings();
  elements.settingsDialog.showModal();
}

function closeSettingsModal() {
  if (elements.settingsDialog) {
    elements.settingsDialog.close();
  }
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

    if (elements.localPreviewImg) elements.localPreviewImg.src = base64;
    if (elements.localPreviewName) elements.localPreviewName.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    if (elements.localPreviewContainer) elements.localPreviewContainer.classList.remove('hidden');
    if (elements.fileUploadText) elements.fileUploadText.textContent = `Selected: ${file.name}`;
    showToast(`Loaded "${file.name}"`);
  };

  reader.onerror = () => {
    showToast('Failed to read local image file.');
  };

  reader.readAsDataURL(file);
}

// =============================================================================
// Search Bar Autofocus, Real-Time Google Autocomplete & URL Navigation
// =============================================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const searchAutocompleteState = {
  debounceTimer: null,
  abortController: null,
  originalInputQuery: '',
  suggestions: [],
  selectedIndex: -1,
  isOpen: false
};

function focusSearchInput(selectAll = false) {
  if (elements.searchInput && !elements.settingsDialog?.open && !elements.addShortcutDialog?.open) {
    elements.searchInput.focus();
    if (selectAll && elements.searchInput.value) {
      elements.searchInput.select();
    }
  }
}

function executeSearchOrNavigate(rawQuery) {
  const query = (rawQuery || '').trim();
  if (!query) return;

  hideSearchSuggestions();

  const isFullUrl = /^https?:\/\//i.test(query) || /^file:\/\//i.test(query);
  const isDomainLike = /^(?:localhost|\d{1,3}(?:\.\d{1,3}){3}|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(?::\d+)?(?:\/.*)?$/i.test(query);

  if (isFullUrl) {
    window.location.href = query;
  } else if (isDomainLike && !query.includes(' ')) {
    window.location.href = 'https://' + query;
  } else {
    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }
}

async function fetchGoogleSuggestions(query) {
  if (searchAutocompleteState.abortController) {
    searchAutocompleteState.abortController.abort();
  }
  searchAutocompleteState.abortController = new AbortController();

  // 1. Try Chrome background service worker if running as extension
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const resp = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'FETCH_GOOGLE_SUGGESTIONS', query }, (res) => {
          if (chrome.runtime.lastError || !res || !res.success) {
            resolve(null);
          } else {
            resolve(res.data);
          }
        });
      });
      if (Array.isArray(resp)) return resp;
    } catch (e) {
      // Fall through to HTTP fetch
    }
  }

  // 2. Try localhost proxy endpoint if running locally in dev mode
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    try {
      const response = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`, {
        signal: searchAutocompleteState.abortController.signal
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && Array.isArray(data[1])) {
          return data[1].slice(0, 6);
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') return null;
    }
  }

  // 3. Direct public endpoint (enabled by host_permissions in extension context)
  const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      signal: searchAutocompleteState.abortController.signal
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].slice(0, 6);
    }
    return [];
  } catch (err) {
    if (err.name === 'AbortError') return null;
    return [];
  }
}

function renderSearchSuggestions(suggestions, query) {
  if (!elements.searchSuggestions) return;

  if (!suggestions || suggestions.length === 0) {
    hideSearchSuggestions();
    return;
  }

  searchAutocompleteState.suggestions = suggestions;
  searchAutocompleteState.selectedIndex = -1;
  searchAutocompleteState.isOpen = true;

  elements.searchSuggestions.innerHTML = '';

  suggestions.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'suggestion-item';
    el.setAttribute('role', 'option');
    el.setAttribute('data-index', index);
    el.id = `suggestion-item-${index}`;

    // Bold highlight matching initial part
    const lowerQuery = query.toLowerCase();
    const lowerItem = item.toLowerCase();
    let textHtml = '';

    if (lowerItem.startsWith(lowerQuery)) {
      const matchPart = item.substring(0, query.length);
      const restPart = item.substring(query.length);
      textHtml = `<span class="suggestion-match">${escapeHtml(matchPart)}</span>${escapeHtml(restPart)}`;
    } else {
      textHtml = escapeHtml(item);
    }

    el.innerHTML = `
      <svg class="suggestion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <span class="suggestion-text">${textHtml}</span>
      <svg class="suggestion-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="7" y1="17" x2="17" y2="7"></line>
        <polyline points="7 7 17 7 17 17"></polyline>
      </svg>
    `;

    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      elements.searchInput.value = item;
      executeSearchOrNavigate(item);
    });

    el.addEventListener('mouseenter', () => {
      setHighlightedSuggestion(index, false);
    });

    elements.searchSuggestions.appendChild(el);
  });

  elements.searchSuggestions.classList.remove('hidden');
}

function hideSearchSuggestions() {
  if (elements.searchSuggestions) {
    elements.searchSuggestions.classList.add('hidden');
    elements.searchSuggestions.innerHTML = '';
  }
  searchAutocompleteState.suggestions = [];
  searchAutocompleteState.selectedIndex = -1;
  searchAutocompleteState.isOpen = false;
}

function setHighlightedSuggestion(index, updateInput = true) {
  if (!elements.searchSuggestions) return;
  const items = elements.searchSuggestions.querySelectorAll('.suggestion-item');
  items.forEach((item, i) => {
    if (i === index) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });

  searchAutocompleteState.selectedIndex = index;

  if (updateInput && elements.searchInput) {
    if (index >= 0 && index < searchAutocompleteState.suggestions.length) {
      elements.searchInput.value = searchAutocompleteState.suggestions[index];
    } else {
      elements.searchInput.value = searchAutocompleteState.originalInputQuery;
    }
  }
}

// =============================================================================
// Event Listeners & Bootstrapping
// =============================================================================

function setupEventListeners() {
  // Search Form Submit: Google Search or Direct URL Navigation
  if (elements.searchForm) {
    elements.searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      executeSearchOrNavigate(elements.searchInput?.value);
    });
  }

  // Real-Time Search Suggestions & Keyboard Traversal
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      searchAutocompleteState.originalInputQuery = query;

      clearTimeout(searchAutocompleteState.debounceTimer);

      if (!query.trim()) {
        hideSearchSuggestions();
        return;
      }

      searchAutocompleteState.debounceTimer = setTimeout(async () => {
        const results = await fetchGoogleSuggestions(query.trim());
        if (results !== null) {
          renderSearchSuggestions(results, query.trim());
        }
      }, 150);
    });

    elements.searchInput.addEventListener('keydown', (e) => {
      if (!searchAutocompleteState.isOpen || searchAutocompleteState.suggestions.length === 0) {
        if (e.key === 'Escape') {
          hideSearchSuggestions();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const total = searchAutocompleteState.suggestions.length;
        let nextIndex = searchAutocompleteState.selectedIndex + 1;
        if (nextIndex >= total) {
          nextIndex = -1;
        }
        setHighlightedSuggestion(nextIndex, true);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const total = searchAutocompleteState.suggestions.length;
        let prevIndex = searchAutocompleteState.selectedIndex - 1;
        if (prevIndex < -1) {
          prevIndex = total - 1;
        }
        setHighlightedSuggestion(prevIndex, true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideSearchSuggestions();
      }
    });

    elements.searchInput.addEventListener('blur', () => {
      setTimeout(() => {
        hideSearchSuggestions();
      }, 200);
    });

    elements.searchInput.addEventListener('focus', () => {
      const q = (elements.searchInput.value || '').trim();
      if (q && searchAutocompleteState.suggestions.length > 0) {
        elements.searchSuggestions?.classList.remove('hidden');
      }
    });
  }

  // Dismiss suggestions on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      hideSearchSuggestions();
    }
  });

  // Global typing autofocus: Route keystrokes directly to search input when idle
  window.addEventListener('keydown', (e) => {
    const isModalOpen = (elements.settingsDialog && elements.settingsDialog.open) ||
                        (elements.addShortcutDialog && elements.addShortcutDialog.open);
    if (isModalOpen) return;

    const isFormElement = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if (isFormElement) return;

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (['ArrowLeft', 'ArrowRight', 'Space', 'r', 'R'].includes(e.key) || e.code === 'Space') return;

    if (e.key && e.key.length === 1) {
      if (elements.searchInput) {
        elements.searchInput.focus();
      }
    }
  });

  // Navigation Controls
  if (elements.prevBtn) elements.prevBtn.addEventListener('click', () => prevWallpaper(true));
  if (elements.nextBtn) elements.nextBtn.addEventListener('click', () => nextWallpaper(true));
  if (elements.pauseBtn) elements.pauseBtn.addEventListener('click', togglePause);

  // Manual Orientation Rotate Button
  if (elements.rotateBtn) {
    elements.rotateBtn.addEventListener('click', rotateActiveWallpaper);
  }

  // Settings Modal Open/Close
  if (elements.settingsBtn) elements.settingsBtn.addEventListener('click', openSettingsModal);
  if (elements.closeModalBtn) elements.closeModalBtn.addEventListener('click', closeSettingsModal);
  if (elements.cancelBtn) elements.cancelBtn.addEventListener('click', closeSettingsModal);

  // Close Settings dialog on clicking backdrop
  if (elements.settingsDialog) {
    elements.settingsDialog.addEventListener('click', (e) => {
      const rect = elements.settingsDialog.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        closeSettingsModal();
      }
    });
  }

  // Add Shortcut Dialog Modal Open/Close
  if (elements.closeAddShortcutBtn) elements.closeAddShortcutBtn.addEventListener('click', closeAddShortcutModal);
  if (elements.cancelAddShortcutBtn) elements.cancelAddShortcutBtn.addEventListener('click', closeAddShortcutModal);
  if (elements.addShortcutDialog) {
    elements.addShortcutDialog.addEventListener('click', (e) => {
      const rect = elements.addShortcutDialog.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        closeAddShortcutModal();
      }
    });
  }

  // Add Shortcut Form Submit
  if (elements.addShortcutForm) {
    elements.addShortcutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = elements.inputShortcutTitle.value;
      const url = elements.inputShortcutUrl.value;
      if (url.trim()) {
        await addShortcut(title, url);
        closeAddShortcutModal();
      }
    });
  }

  // Source Mode Selector Change
  if (elements.selectSourceMode) {
    elements.selectSourceMode.addEventListener('change', (e) => {
      updateFormVisibility(e.target.value);
    });
  }

  // Local File Upload Input & Drag-and-Drop
  if (elements.inputLocalFile) {
    elements.inputLocalFile.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleLocalFileUpload(e.target.files[0]);
      }
    });
  }

  if (elements.fileDropzone) {
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
  }

  // UI Scale Slider Real-time input
  if (elements.inputScale) {
    elements.inputScale.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) || 100;
      if (elements.scaleVal) elements.scaleVal.textContent = val;
      document.documentElement.style.setProperty('--ui-scale', `${val / 100}`);
    });
  }

  // Board Preset Chips
  if (elements.presetChips) {
    elements.presetChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        elements.presetChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const user = chip.dataset.user;
        const board = chip.dataset.board;
        if (user && elements.inputUsername) elements.inputUsername.value = user;
        if (board && elements.inputBoard) elements.inputBoard.value = board;
      });
    });
  }

  // Search Suggestion Chips
  if (elements.searchChips) {
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
  }

  // Wallpaper Scaling & Fit Mode Change (Instant live preview)
  if (elements.selectFitMode) {
    elements.selectFitMode.addEventListener('change', (e) => {
      appState.config.fitMode = e.target.value;
      applyVisualSettings();
    });
  }

  // Settings Form Submit ("Save Settings" - Persists preferences immediately without reloading feed)
  if (elements.settingsForm) {
    elements.settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newDisplayName = (elements.inputDisplayName?.value || '').trim();
      const mode = elements.selectSourceMode?.value || 'pinterest-search';
      const newSearchQuery = (elements.inputSearchQuery?.value || '4k dark cyberpunk wallpaper').trim();
      const newUsername = sanitizeHandle(elements.inputUsername?.value) || 'pinterest';
      const newBoard = sanitizeBoard(elements.inputBoard?.value) || 'wallpapers';
      const newDirectUrl = (elements.inputDirectUrl?.value || '').trim();
      const newFitMode = elements.selectFitMode?.value || appState.config.fitMode || 'cover';
      const newAutoRotate = elements.inputAutoRotate ? elements.inputAutoRotate.checked : true;
      const newInterval = Math.max(5, parseInt(elements.inputInterval?.value, 10) || 30);
      const newTimeFormat = elements.inputTimeFormat?.value || '12h';
      const newUiScale = parseInt(elements.inputScale?.value, 10) || 100;

      const previousInterval = appState.config.interval;

      const updatedConfig = {
        displayName: newDisplayName,
        sourceMode: mode,
        searchQuery: newSearchQuery,
        username: newUsername,
        board: newBoard,
        directUrl: newDirectUrl,
        fitMode: newFitMode,
        autoRotate: newAutoRotate,
        interval: newInterval,
        timeFormat: newTimeFormat,
        uiScale: newUiScale
      };

      if (appState.pendingLocalBase64) {
        updatedConfig.localImageBase64 = appState.pendingLocalBase64;
        updatedConfig.localImageName = appState.pendingLocalName;
      }

      await saveConfig(updatedConfig);

      applyVisualSettings();
      updateClock();

      // Restart cycle timer if interval changed
      if (previousInterval !== newInterval && !appState.isPaused) {
        stopCycleTimer();
        startCycleTimer();
      }

      closeSettingsModal();
      showToast('Settings saved');
    });
  }

  // Refresh Feed Button (Flushes active queue and fetches fresh wallpaper stream)
  if (elements.refreshFeedBtn) {
    elements.refreshFeedBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const newDisplayName = (elements.inputDisplayName?.value || '').trim();
      const mode = elements.selectSourceMode?.value || 'pinterest-search';
      const newSearchQuery = (elements.inputSearchQuery?.value || '4k dark cyberpunk wallpaper').trim();
      const newUsername = sanitizeHandle(elements.inputUsername?.value) || 'pinterest';
      const newBoard = sanitizeBoard(elements.inputBoard?.value) || 'wallpapers';
      const newDirectUrl = (elements.inputDirectUrl?.value || '').trim();
      const newFitMode = elements.selectFitMode?.value || appState.config.fitMode || 'cover';
      const newAutoRotate = elements.inputAutoRotate ? elements.inputAutoRotate.checked : true;
      const newInterval = Math.max(5, parseInt(elements.inputInterval?.value, 10) || 30);
      const newTimeFormat = elements.inputTimeFormat?.value || '12h';
      const newUiScale = parseInt(elements.inputScale?.value, 10) || 100;

      const updatedConfig = {
        displayName: newDisplayName,
        sourceMode: mode,
        searchQuery: newSearchQuery,
        username: newUsername,
        board: newBoard,
        directUrl: newDirectUrl,
        fitMode: newFitMode,
        autoRotate: newAutoRotate,
        interval: newInterval,
        timeFormat: newTimeFormat,
        uiScale: newUiScale
      };

      if (appState.pendingLocalBase64) {
        updatedConfig.localImageBase64 = appState.pendingLocalBase64;
        updatedConfig.localImageName = appState.pendingLocalName;
      }

      await saveConfig(updatedConfig);
      applyVisualSettings();
      updateClock();

      // Clear in-memory queue & bookmark cache to force a fresh fetch
      appState.wallpaperQueue = [];
      appState.wallpapers = [];
      appState.seenUrls.clear();
      appState.preloadedCache.clear();
      appState.paginationBookmark = null;
      appState.currentIndex = 0;

      closeSettingsModal();
      showToast('Refreshing wallpaper feed...');

      // Load fresh batch immediately
      loadWallpapersByMode(true);
    });
  }

  // Reset Defaults Button
  if (elements.resetBtn) {
    elements.resetBtn.addEventListener('click', async () => {
      if (elements.inputDisplayName) {
        elements.inputDisplayName.value = DEFAULT_CONFIG.displayName || '';
      }

      if (elements.selectSourceMode) {
        elements.selectSourceMode.value = DEFAULT_CONFIG.sourceMode;
        updateFormVisibility(DEFAULT_CONFIG.sourceMode);
      }

      if (elements.selectFitMode) {
        elements.selectFitMode.value = DEFAULT_CONFIG.fitMode;
      }

      if (elements.inputAutoRotate) {
        elements.inputAutoRotate.checked = DEFAULT_CONFIG.autoRotate;
      }

      if (elements.inputSearchQuery) {
        elements.inputSearchQuery.value = DEFAULT_CONFIG.searchQuery;
      }

      if (elements.inputUsername) elements.inputUsername.value = DEFAULT_CONFIG.username;
      if (elements.inputBoard) elements.inputBoard.value = DEFAULT_CONFIG.board;
      if (elements.inputDirectUrl) elements.inputDirectUrl.value = DEFAULT_CONFIG.directUrl;
      if (elements.inputInterval) elements.inputInterval.value = DEFAULT_CONFIG.interval;
      if (elements.inputTimeFormat) elements.inputTimeFormat.value = DEFAULT_CONFIG.timeFormat;

      if (elements.inputScale) elements.inputScale.value = DEFAULT_CONFIG.uiScale;
      if (elements.scaleVal) elements.scaleVal.textContent = DEFAULT_CONFIG.uiScale;
      document.documentElement.style.setProperty('--ui-scale', `${DEFAULT_CONFIG.uiScale / 100}`);

      if (elements.presetChips) elements.presetChips.forEach(c => c.classList.remove('active'));
      if (elements.searchChips) elements.searchChips.forEach(c => c.classList.remove('active'));
      if (elements.localPreviewContainer) elements.localPreviewContainer.classList.add('hidden');
      appState.pendingLocalBase64 = null;
      appState.pendingLocalName = null;
    });
  }

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
// App Bootstrapper & Cross-Tab Queue Synchronization
// =============================================================================

function setupStorageSyncListener() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      if (changes.user_image_rotations && changes.user_image_rotations.newValue) {
        appState.userImageRotations = { ...appState.userImageRotations, ...changes.user_image_rotations.newValue };
        appState.rotations = { ...appState.rotations, ...appState.userImageRotations };

        // If currently displayed wallpaper's rotation changed in another tab, update active layer immediately
        if (appState.wallpapers.length > 0 && appState.currentIndex >= 0 && appState.currentIndex < appState.wallpapers.length) {
          const currentItem = appState.wallpapers[appState.currentIndex];
          const newRot = getSavedRotation(currentItem);
          if (newRot !== undefined && newRot !== currentItem.rotation) {
            currentItem.rotation = newRot;
            currentItem.manualRotation = newRot;
            const activeLayerEl = appState.activeLayer === 1 ? elements.bg1 : elements.bg2;
            setLayerRotation(activeLayerEl, newRot);
            if (elements.bgAmbient) {
              setLayerRotation(elements.bgAmbient, newRot);
            }
          }
        }
      } else if (changes.wallpaper_rotations && changes.wallpaper_rotations.newValue) {
        appState.rotations = { ...appState.rotations, ...changes.wallpaper_rotations.newValue };
      }

      // If another tab appended new wallpapers to global queue, merge them seamlessly into local queue
      if (changes.wallpaper_global_queue && Array.isArray(changes.wallpaper_global_queue.newValue)) {
        const incomingQueue = changes.wallpaper_global_queue.newValue;
        let addedCount = 0;
        incomingQueue.forEach(pin => {
          if (pin && pin.url && !appState.seenUrls.has(pin.url)) {
            appState.seenUrls.add(pin.url);
            appState.wallpaperQueue.push(pin);
            appState.wallpapers.push(pin);
            addedCount++;
          }
        });
        if (addedCount > 0) {
          updateActiveStatusLabel();
        }
      }

      if (changes.pagination_bookmark) {
        appState.paginationBookmark = changes.pagination_bookmark.newValue;
      }
    });
  }
}

async function initApp() {
  // 1. Instant First-Paint: Load rotations and apply next/last active wallpaper synchronously from cold-start cache
  loadRotations();
  applyColdStartWallpaper();

  // 2. Load persistent config & user shortcuts
  appState.config = await loadConfig();
  appState.userShortcuts = await loadUserShortcuts();

  applyVisualSettings();
  initClock();
  renderShortcuts();
  setupEventListeners();
  setupStorageSyncListener();

  // 3. Check persistent global queue from previous tab session for continuous progression
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([
      'wallpaper_global_queue',
      'wallpaper_queue_index',
      'pagination_bookmark',
      'user_image_rotations',
      'wallpaper_rotations',
      'active_source_mode',
      'active_search_query',
      'active_username',
      'active_board'
    ], async (res) => {
      if (res) {
        const userMap = res.user_image_rotations || {};
        const legacyMap = res.wallpaper_rotations || {};
        appState.userImageRotations = { ...appState.userImageRotations, ...legacyMap, ...userMap };
        appState.rotations = { ...appState.userImageRotations };
      }

      const isConfigMatch = res &&
        Array.isArray(res.wallpaper_global_queue) &&
        res.wallpaper_global_queue.length > 0 &&
        res.active_source_mode === appState.config.sourceMode &&
        (appState.config.sourceMode !== 'pinterest-search' || res.active_search_query === appState.config.searchQuery) &&
        (appState.config.sourceMode === 'pinterest-search' || appState.config.sourceMode === 'pinterest-homefeed' || res.active_username === appState.config.username) &&
        (appState.config.sourceMode !== 'pinterest-board' || res.active_board === appState.config.board);

      if (isConfigMatch) {
        // Restore active stream queue
        appState.seenUrls.clear();
        res.wallpaper_global_queue.forEach(p => {
          if (p && p.url) {
            appState.seenUrls.add(p.url);
            appState.wallpaperQueue.push(p);
            appState.wallpapers.push(p);
          }
        });
        appState.paginationBookmark = res.pagination_bookmark || null;

        // Resume progression: Advance to next sequential wallpaper from where previous tab left off
        const prevIndex = (typeof res.wallpaper_queue_index === 'number') ? res.wallpaper_queue_index : 0;
        const resumedIndex = (prevIndex + 1) % appState.wallpapers.length;
        appState.currentIndex = resumedIndex;

        await displayWallpaper(resumedIndex, false);
        startCycleTimer();

        // Check if queue needs buffer refill
        const unviewedRemaining = appState.wallpapers.length - (appState.currentIndex + 1);
        if (unviewedRemaining <= 6) {
          fetchNextBatch();
        }
      } else {
        // Mode changed or initial cold load: Fetch full batch stream
        loadWallpapersByMode(false);
      }
    });
  } else {
    loadWallpapersByMode(false);
  }

  // 4. Ensure immediate search input autofocus
  focusSearchInput();
  requestAnimationFrame(() => focusSearchInput());
  window.addEventListener('focus', () => focusSearchInput());
}

// Immediately attempt cold-start on script execution before DOMContentLoaded
loadRotations();
applyColdStartWallpaper();

// Start on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  focusSearchInput();
  requestAnimationFrame(() => focusSearchInput());
});
