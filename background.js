/**
 * Pinterest Dynamic New Tab - Background Service Worker (Manifest V3)
 * Handles privileged network requests, multi-page bookmark pagination, and CORS bypass.
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
});

/**
 * Deep multi-page bookmark pagination for all user saved pins
 */
async function fetchAllUserPins(username, maxPages = 12) {
  // 1. Initial request to obtain CSRF and session cookies
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
