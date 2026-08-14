/**
 * Pinterest Dynamic New Tab - Background Service Worker (Manifest V3)
 * Handles privileged network requests, multi-page bookmark pagination, search queries, and CORS bypass.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_RSS' || message.type === 'FETCH_URL') {
    fetch(message.url, {
      method: 'GET',
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml, text/html, application/json, */*'
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          sendResponse({
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`
          });
          return;
        }
        const text = await response.text();
        sendResponse({
          success: true,
          data: text
        });
      })
      .catch((err) => {
        sendResponse({
          success: false,
          error: err.message || 'Failed to fetch content'
        });
      });

    return true; // Keep message port open for async sendResponse
  }

  if (message.type === 'FETCH_ALL_USER_PINS' && message.username) {
    fetchAllUserPins(message.username, message.maxPages || 12)
      .then((pins) => {
        sendResponse({
          success: true,
          data: pins
        });
      })
      .catch((err) => {
        sendResponse({
          success: false,
          error: err.message || 'Failed to fetch user pins'
        });
      });

    return true;
  }

  if (message.type === 'FETCH_PINTEREST_SEARCH' && message.query) {
    fetchPinterestSearch(message.query, message.maxPages || 3)
      .then((pins) => {
        sendResponse({
          success: true,
          data: pins
        });
      })
      .catch((err) => {
        sendResponse({
          success: false,
          error: err.message || 'Failed to search Pinterest'
        });
      });

    return true;
  }
});

/**
 * Multi-page bookmark pagination for all user saved pins
 */
async function fetchAllUserPins(username, maxPages = 12) {
  const homeRes = await fetch(`https://www.pinterest.com/${encodeURIComponent(username)}/`);
  const cookies = homeRes.headers.get('set-cookie') || '';
  const csrfMatch = cookies.match(/csrftoken=([^;]+)/);
  const csrf = csrfMatch ? csrfMatch[1] : '';

  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRFToken': csrf,
    'X-Pinterest-AppState': 'active',
    'X-Pinterest-PWS-Handler': 'www/[username]',
    'Cookie': cookies,
    'Accept': 'application/json, text/javascript, */*, q=0.01',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  };

  const allPins = [];
  const seenUrls = new Set();
  let bookmark = null;
  let page = 1;

  while (page <= maxPages) {
    const options = {
      username: username,
      field_set_key: 'grid_item'
    };
    if (bookmark) {
      options.bookmarks = [bookmark];
    }

    const data = JSON.stringify({ options, context: {} });
    const res = await fetch('https://www.pinterest.com/resource/UserPinsResource/get/?data=' + encodeURIComponent(data), { headers });
    
    if (!res.ok) {
      break;
    }

    const json = await res.json().catch(() => null);
    const dataList = json?.resource_response?.data || [];
    
    if (!dataList || dataList.length === 0) {
      break;
    }

    dataList.forEach(item => {
      const origUrl = item.images?.orig?.url || item.images?.['736x']?.url || item.images?.['474x']?.url;
      const fallbackUrl = item.images?.['736x']?.url || origUrl;
      const title = (item.title || item.grid_title || item.description || '').trim() || `@${username} Pin`;
      const link = item.id ? `https://www.pinterest.com/pin/${item.id}/` : `https://www.pinterest.com/${username}/`;

      if (origUrl && !seenUrls.has(origUrl)) {
        seenUrls.add(origUrl);
        allPins.push({
          title,
          url: origUrl,
          fallbackUrl,
          link
        });
      }
    });

    bookmark = json?.resource_response?.bookmark;
    if (!bookmark || bookmark === '-end-') {
      break;
    }

    page++;
  }

  return allPins;
}

/**
 * Searches Pinterest keywords and returns high-resolution wallpaper pins
 */
async function fetchPinterestSearch(query, maxPages = 3) {
  const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;
  const searchRes = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  const cookies = searchRes.headers.get('set-cookie') || '';
  const csrfMatch = cookies.match(/csrftoken=([^;]+)/);
  const csrf = csrfMatch ? csrfMatch[1] : '';

  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRFToken': csrf,
    'X-Pinterest-AppState': 'active',
    'X-Pinterest-PWS-Handler': 'www/search/pins',
    'Cookie': cookies,
    'Accept': 'application/json, text/javascript, */*, q=0.01',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  };

  const allPins = [];
  const seenUrls = new Set();
  let bookmark = null;
  let page = 1;

  while (page <= maxPages) {
    const options = {
      query: query,
      scope: 'pins',
      field_set_key: 'grid_item'
    };
    if (bookmark) {
      options.bookmarks = [bookmark];
    }

    const data = JSON.stringify({ options, context: {} });
    const resApi = await fetch('https://www.pinterest.com/resource/BaseSearchResource/get/?data=' + encodeURIComponent(data), { headers });
    
    if (!resApi.ok) {
      break;
    }

    const apiJson = await resApi.json().catch(() => null);
    const results = apiJson?.resource_response?.data?.results || apiJson?.resource_response?.data || [];
    
    if (!results || results.length === 0) {
      break;
    }

    results.forEach(item => {
      const orig = item.images?.orig?.url || item.images?.['736x']?.url || item.images?.['474x']?.url;
      const fallback = item.images?.['736x']?.url || orig;
      const title = (item.title || item.grid_title || item.description || `${query} Wallpaper`).trim();
      const link = item.id ? `https://www.pinterest.com/pin/${item.id}/` : `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;

      if (orig && !seenUrls.has(orig)) {
        seenUrls.add(orig);
        allPins.push({
          title,
          url: orig,
          fallbackUrl: fallback,
          link
        });
      }
    });

    bookmark = apiJson?.resource_response?.bookmark;
    if (!bookmark || bookmark === '-end-') {
      break;
    }

    page++;
  }

  // Fallback: If BaseSearchResource returned 0, search HTML response for pin images
  if (allPins.length === 0) {
    const html = await searchRes.text().catch(() => '');
    const pinRegex = /https:\/\/i\.pinimg\.com\/(?:236x|474x|564x|736x|originals)\/([a-f0-9\/]+)\.(jpg|png|webp)/gi;
    let match;
    while ((match = pinRegex.exec(html)) !== null) {
      const hash = match[1];
      const ext = match[2];
      if (hash.includes('75x75') || hash.includes('150x150') || hash.includes('user/')) continue;
      const orig = `https://i.pinimg.com/originals/${hash}.${ext}`;
      if (!seenUrls.has(orig)) {
        seenUrls.add(orig);
        allPins.push({
          title: `${query} Wallpaper`,
          url: orig,
          fallbackUrl: `https://i.pinimg.com/736x/${hash}.${ext}`,
          link: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`
        });
      }
    }
  }

  if (allPins.length === 0) {
    throw new Error(`No wallpapers found matching "${query}". Try another keyword.`);
  }

  return allPins;
}
