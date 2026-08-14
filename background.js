/**
 * Pinterest Dynamic New Tab - Background Service Worker (Manifest V3)
 * Handles privileged background network requests to bypass CORS on Pinterest feeds.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_RSS' && message.url) {
    fetch(message.url, {
      method: 'GET',
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
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
          error: err.message || 'Failed to fetch RSS feed'
        });
      });

    return true; // Keep message port open for async sendResponse
  }
});
