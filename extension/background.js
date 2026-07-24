const NATIVE_HOST = "org.fdm.videopicker";

/** @type {Map<number, Map<string, object>>} */
const tabMedia = new Map();
/** @type {Map<number, string>} */
const tabTitles = new Map();

const VIDEO_EXT_RE = /\.(m3u8|mpd|mp4|webm|mkv|m4v|mov|ts)(?:$|\?|#)/i;
const VIDEO_MIME_RE =
  /^(video\/|audio\/|application\/(vnd\.apple\.mpegurl|x-mpegURL|dash\+xml)|application\/octet-stream)/i;

function ensureTabMap(tabId) {
  if (!tabMedia.has(tabId)) tabMedia.set(tabId, new Map());
  return tabMedia.get(tabId);
}

function youtubeVideoId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "");
    if (host === "youtu.be") return u.pathname.replace(/^\//, "").split("/")[0] || "";
    if (/youtube\.com|youtube-nocookie\.com/i.test(host)) {
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || "";
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || "";
      return u.searchParams.get("v") || "";
    }
  } catch {
    /* ignore */
  }
  return "";
}

function canonicalMediaUrl(url) {
  try {
    const u = new URL(url);
    const yid = youtubeVideoId(url);
    if (yid) return "https://www.youtube.com/watch?v=" + yid;
    u.hash = "";
    // Drop tracking params for cleaner dedupe
    ["si", "feature", "pp", "t"].forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return url;
  }
}

function mediaKey(item) {
  if (item.site === "youtube" || youtubeVideoId(item.url)) {
    const yid = youtubeVideoId(item.url);
    if (yid) return "youtube:" + yid;
  }
  if (item.dedupeKey && !String(item.dedupeKey).includes("googlevideo") && !/videoplayback/i.test(String(item.dedupeKey))) {
    // Prefer canonical page keys; ignore per-stream CDN keys
    if (String(item.dedupeKey).startsWith("youtube:")) return item.dedupeKey;
  }
  return canonicalMediaUrl(item.url);
}

function cleanTabTitle(title) {
  return (title || "")
    .replace(/\s+/g, " ")
    .replace(/\s*[-–|]\s*YouTube\s*$/i, "")
    .replace(/\s*[-–|]\s*Instagram\s*$/i, "")
    .replace(/\s*[-–|]\s*Facebook\s*$/i, "")
    .replace(/\s*\(\d+\)\s*/g, " ")
    .trim();
}

function upsertMedia(tabId, item) {
  if (!tabId || tabId < 0 || !item || !item.url) return;
  if (item.url.startsWith("blob:") || item.url.startsWith("chrome-extension:")) return;

  // Merge YouTube CDN hits into the single watch-page entry
  if (/googlevideo\.com|\/videoplayback/i.test(item.url) || /googlevideo\.com|\/videoplayback/i.test(item.streamUrl || "")) {
    const page = item.pageUrl || item.url;
    const yid = youtubeVideoId(page) || youtubeVideoId(item.url);
    if (yid) {
      item = {
        ...item,
        url: "https://www.youtube.com/watch?v=" + yid,
        site: "youtube",
        type: "page",
        label: item.label && !/^itag/i.test(item.label) ? item.label : "YouTube",
        listInDetected: true
      };
    }
  }

  const map = ensureTabMap(tabId);
  const key = mediaKey(item);
  const prev = map.get(key) || {};
  const fallbackTitle = tabTitles.get(tabId) || "";
  const nextTitle = item.title || prev.title || fallbackTitle || "";

  map.set(key, {
    ...prev,
    ...item,
    url: canonicalMediaUrl(item.url) || item.url,
    title: nextTitle,
    detectedAt: Date.now(),
    source: item.source || prev.source || "network",
    preferred: !!(item.preferred || prev.preferred),
    listInDetected: true
  });
  updateBadge(tabId);
}

function listMedia(tabId) {
  const map = tabMedia.get(tabId);
  if (!map) return [];
  return Array.from(map.values()).sort((a, b) => {
    const ap = a.preferred ? 1 : 0;
    const bp = b.preferred ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return (b.detectedAt || 0) - (a.detectedAt || 0);
  });
}

function clearMedia(tabId) {
  tabMedia.delete(tabId);
  updateBadge(tabId);
}

async function updateBadge(tabId) {
  const count = listMedia(tabId).filter((i) => i.listInDetected !== false).length;
  try {
    await chrome.action.setBadgeText({
      tabId,
      text: count > 0 ? String(Math.min(count, 99)) : ""
    });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#1a6cff" });
  } catch {
    /* tab may be gone */
  }
}

function looksLikeVideo(url, contentType) {
  if (/googlevideo\.com/i.test(url) && /videoplayback/i.test(url)) return true;
  if (/\/videoplayback/i.test(url)) return true;
  if (/video\.twimg\.com/i.test(url)) return true;
  if (contentType && VIDEO_MIME_RE.test(contentType) && VIDEO_EXT_RE.test(url)) return true;
  if (contentType && /^video\//i.test(contentType)) return true;
  if (url && VIDEO_EXT_RE.test(url)) return true;
  return false;
}

function guessLabel(url, contentType) {
  try {
    const u = new URL(url);
    if (/googlevideo\.com|\/videoplayback/i.test(url)) {
      const q = u.searchParams.get("q") || u.searchParams.get("quality_label");
      const itag = u.searchParams.get("itag");
      if (q) return q;
      if (itag) return "itag " + itag;
      return "YouTube stream";
    }
    const path = u.pathname.toLowerCase();
    if (path.includes(".m3u8") || (contentType || "").includes("mpegurl")) return "HLS stream";
    if (path.includes(".mpd") || (contentType || "").includes("dash")) return "DASH stream";
    const m = path.match(/\.(mp4|webm|mkv|m4v|mov|ts)/);
    if (m) return m[1].toUpperCase();
  } catch {
    /* ignore */
  }
  return contentType ? contentType.split(";")[0] : "Media";
}

function rememberTabTitle(tabId, title) {
  const cleaned = cleanTabTitle(title);
  if (cleaned) tabTitles.set(tabId, cleaned);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.title) rememberTabTitle(tabId, changeInfo.title);
  else if (tab && tab.title) rememberTabTitle(tabId, tab.title);

  if (changeInfo.status === "loading" && changeInfo.url) {
    clearMedia(tabId);
  }
});

chrome.tabs.query({}, (tabs) => {
  for (const t of tabs) {
    if (t.id != null && t.title) rememberTabTitle(t.id, t.title);
  }
});

// Network sniffing
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const headers = details.responseHeaders || [];
    let contentType = "";
    let contentLength = null;
    for (const h of headers) {
      const n = (h.name || "").toLowerCase();
      if (n === "content-type") contentType = h.value || "";
      if (n === "content-length") contentLength = Number(h.value) || null;
    }
    if (!looksLikeVideo(details.url, contentType)) return;

    // Skip tiny progressive JPEGs mislabeled; keep small mp4 previews but title them
    const label = guessLabel(details.url, contentType);
    const pageHint = details.originUrl || details.documentUrl || "";
    let sendUrl = details.url;
    let title = tabTitles.get(details.tabId) || "";

    // YouTube CDN URLs expire — merge into a single watch-page row
    if (/googlevideo\.com|\/videoplayback/i.test(details.url)) {
      if (/youtube\.com|youtu\.be/i.test(pageHint)) {
        try {
          sendUrl = pageHint.split("#")[0];
        } catch {
          /* keep */
        }
      }
      // Don't invent "title · itag" duplicates — keep clean page title
      title = tabTitles.get(details.tabId) || title || "YouTube video";
      upsertMedia(details.tabId, {
        url: sendUrl,
        streamUrl: details.url,
        type: "page",
        label: "YouTube",
        size: contentLength,
        source: "network",
        title: title.replace(/\s*·\s*itag.*$/i, "").trim(),
        pageUrl: pageHint,
        site: "youtube",
        listInDetected: true
      });
      return;
    }

    upsertMedia(details.tabId, {
      url: sendUrl,
      type: contentType || label,
      label: label,
      size: contentLength,
      source: "network",
      title: title || label,
      pageUrl: pageHint,
      listInDetected: true
    });
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.tabs.onRemoved.addListener((tabId) => {
  clearMedia(tabId);
  tabTitles.delete(tabId);
});

async function sendToFdm(url, extras = {}) {
  if (!url) throw new Error("Missing URL");

  const payload = {
    action: "download",
    url,
    referrer: extras.referrer || "",
    silent: !!extras.silent
  };

  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST, payload, (response) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(
            new Error(
              err.message +
                " — Run bridge\\install.cmd, reload extension, restart browser."
            )
          );
          return;
        }
        if (!response || response.ok === false) {
          reject(new Error((response && response.error) || "FDM bridge failed"));
          return;
        }
        resolve(response);
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function pingBridge() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST, { action: "ping" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, error: "No response" });
      });
    } catch (e) {
      resolve({ ok: false, error: String(e) });
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : msg.tabId;

  if (msg.type === "media-found") {
    if (sender.tab && sender.tab.title) rememberTabTitle(tabId, sender.tab.title);
    upsertMedia(tabId, msg.item);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "get-media") {
    sendResponse({ items: listMedia(msg.tabId) });
    return false;
  }

  if (msg.type === "clear-media") {
    clearMedia(msg.tabId);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "send-to-fdm") {
    sendToFdm(msg.url, msg)
      .then((r) => sendResponse({ ok: true, result: r }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === "ping-bridge") {
    pingBridge().then((r) => sendResponse(r));
    return true;
  }

  if (msg.type === "rescan") {
    const id = msg.tabId;
    chrome.tabs.sendMessage(id, { type: "rescan" }).catch(() => {});
    sendResponse({ ok: true, items: listMedia(id) });
    return false;
  }

  return false;
});
