(function () {
  "use strict";

  const KNOWN = [
    {
      id: "youtube",
      name: "YouTube",
      test: /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/i
    },
    {
      id: "facebook",
      name: "Facebook",
      test: /(?:^|\.)(?:facebook\.com|fb\.watch|fb\.com)$/i
    },
    {
      id: "instagram",
      name: "Instagram",
      test: /(?:^|\.)instagram\.com$/i
    },
    {
      id: "x",
      name: "X (Twitter)",
      test: /(?:^|\.)(?:x\.com|twitter\.com|t\.co)$/i
    }
  ];

  function hostOf(href) {
    try {
      return new URL(href).hostname.replace(/^www\./i, "");
    } catch {
      return "";
    }
  }

  function matchKnown(href) {
    const host = hostOf(href);
    return KNOWN.find((k) => k.test.test(host)) || null;
  }

  function cleanTitle(t) {
    return (t || "")
      .replace(/\s+/g, " ")
      .replace(/\s*[-–|]\s*YouTube\s*$/i, "")
      .replace(/\s*[-–|]\s*Instagram\s*$/i, "")
      .replace(/\s*[-–|]\s*Facebook\s*$/i, "")
      .replace(/\s*[-–|]\s*X\s*$/i, "")
      .replace(/\s*[-–|]\s*Twitter\s*$/i, "")
      .trim();
  }

  function pageTitle() {
    // YouTube watch title
    const yt =
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
      document.querySelector("h1.ytd-video-primary-info-renderer") ||
      document.querySelector("#title h1") ||
      document.querySelector("ytd-watch-metadata #title");
    if (yt && yt.textContent) return cleanTitle(yt.textContent);

    // Instagram / generic players
    const ig =
      document.querySelector("h1") ||
      document.querySelector('[data-testid="post-title"]');
    if (ig && ig.textContent && ig.textContent.trim().length > 2) {
      const t = cleanTitle(ig.textContent);
      if (t.length < 120) return t;
    }

    const og =
      document.querySelector('meta[property="og:title"]') ||
      document.querySelector('meta[name="twitter:title"]');
    if (og && og.content) return cleanTitle(og.content);

    return cleanTitle(document.title) || "Page video";
  }

  function pageThumb() {
    const og =
      document.querySelector('meta[property="og:image"]') ||
      document.querySelector('meta[name="twitter:image"]');
    return og && og.content ? og.content : "";
  }

  function reportPageTarget() {
    if (window !== window.top) return;
    const known = matchKnown(location.href);
    if (!known) return;

    // Only treat real video/watch/reel/post pages as download targets
    const path = location.pathname || "";
    const isVideoPage =
      known.id !== "youtube" ||
      /\/watch/.test(path) ||
      /\/shorts\//.test(path) ||
      /youtu\.be\//i.test(location.href);

    if (known.id === "youtube" && !isVideoPage) return;

    const title = pageTitle();
    let dedupeKey = known.id + ":" + location.href.split("#")[0];
    if (known.id === "youtube") {
      try {
        const u = new URL(location.href);
        const id = u.searchParams.get("v") || (u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : "");
        if (id) dedupeKey = "youtube:" + id;
      } catch (e) {}
    }

    chrome.runtime.sendMessage({
      type: "media-found",
      item: {
        url: location.href.split("#")[0],
        label: known.name,
        type: "page",
        source: "known-site",
        site: known.id,
        siteName: known.name,
        title: title,
        thumbnail: pageThumb(),
        preferred: true,
        listInDetected: true,
        dedupeKey: dedupeKey
      }
    });
  }

  function reportYouTubeFormats(payload) {
    if (!payload || !payload.title) return;
    const pageUrl = location.href.split("#")[0];
    const title = cleanTitle(payload.title);
    const duration = Number(payload.duration) || 0;

    // One list entry only — FDM picks quality. Avoid duplicate rows.
    chrome.runtime.sendMessage({
      type: "media-found",
      item: {
        url: pageUrl,
        label: "YouTube",
        type: "page",
        source: "youtube-player",
        site: "youtube",
        siteName: "YouTube",
        title: title,
        thumbnail: payload.thumbnail || pageThumb(),
        preferred: true,
        listInDetected: true,
        duration: duration,
        dedupeKey: "youtube:" + (payload.videoId || pageUrl)
      }
    });
  }

  function scrapeYouTubeFromDom() {
    if (!/(?:youtube\.com|youtu\.be)/i.test(location.hostname)) return;
    if (!/\/watch|\/shorts\//.test(location.pathname) && !/youtu\.be\//i.test(location.href)) {
      return;
    }

    const scripts = document.getElementsByTagName("script");
    for (let i = 0; i < scripts.length; i++) {
      const t = scripts[i].textContent || "";
      const marker = "ytInitialPlayerResponse";
      const idx = t.indexOf(marker);
      if (idx < 0) continue;
      const eq = t.indexOf("=", idx);
      if (eq < 0) continue;
      const jsonStart = t.indexOf("{", eq);
      if (jsonStart < 0) continue;
      let depth = 0;
      for (let j = jsonStart; j < Math.min(t.length, jsonStart + 2500000); j++) {
        const ch = t[j];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            try {
              const pr = JSON.parse(t.slice(jsonStart, j + 1));
              const vd = pr.videoDetails || {};
              reportYouTubeFormats({
                title: vd.title || pageTitle(),
                videoId: vd.videoId || "",
                duration: Number(vd.lengthSeconds) || 0,
                thumbnail:
                  vd.thumbnail &&
                  vd.thumbnail.thumbnails &&
                  vd.thumbnail.thumbnails.length
                    ? vd.thumbnail.thumbnails[vd.thumbnail.thumbnails.length - 1].url
                    : ""
              });
            } catch (e) {}
            return;
          }
        }
      }
    }

    // At least report the page with the visible title
    reportPageTarget();
  }

  function injectYouTubeScraper() {
    scrapeYouTubeFromDom();
    // Page-context hook (ignored if the site CSP blocks it)
    if (!/(?:youtube\.com|youtu\.be)/i.test(location.hostname)) return;
    try {
      const script = document.createElement("script");
      script.textContent = "(" + function () {
        function pickFormats(pr) {
          try {
            var vd = pr.videoDetails || {};
            window.postMessage(
              {
                source: "videopicker-youtube",
                title: vd.title || "",
                videoId: vd.videoId || "",
                duration: Number(vd.lengthSeconds) || 0,
                thumbnail:
                  vd.thumbnail && vd.thumbnail.thumbnails && vd.thumbnail.thumbnails.length
                    ? vd.thumbnail.thumbnails[vd.thumbnail.thumbnails.length - 1].url
                    : ""
              },
              "*"
            );
          } catch (e) {}
        }
        if (window.ytInitialPlayerResponse) pickFormats(window.ytInitialPlayerResponse);
      } + ")();";
      (document.documentElement || document.head).appendChild(script);
      script.remove();
    } catch (e) {}
  }

  window.addEventListener("message", (ev) => {
    if (!ev.data || ev.data.source !== "videopicker-youtube") return;
    reportYouTubeFormats(ev.data);
  });

  window.__vpKnownSites = {
    matchKnown,
    reportPageTarget,
    pageTitle,
    cleanTitle,
    KNOWN
  };

  reportPageTarget();
  try {
    injectYouTubeScraper();
  } catch (e) {}

  document.addEventListener("yt-navigate-finish", () => {
    reportPageTarget();
    try {
      injectYouTubeScraper();
    } catch (e) {}
  });

  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      reportPageTarget();
      try {
        injectYouTubeScraper();
      } catch (e) {}
    }
  }, 1500);
})();
