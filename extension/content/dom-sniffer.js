(function () {
  "use strict";

  const seen = new Set();

  function pageTitle() {
    if (window.__vpKnownSites && window.__vpKnownSites.pageTitle) {
      return window.__vpKnownSites.pageTitle();
    }
    const og =
      document.querySelector('meta[property="og:title"]') ||
      document.querySelector('meta[name="twitter:title"]');
    if (og && og.content) return og.content.trim();
    return (document.title || "").replace(/\s+/g, " ").trim();
  }

  function isMediaUrl(url) {
    if (!url || url.startsWith("blob:") || url.startsWith("data:")) return false;
    if (/googlevideo\.com/i.test(url) && /videoplayback/i.test(url)) return true;
    if (/\/videoplayback/i.test(url)) return true;
    if (/fbcdn\.net|cdninstagram\.com|twimg\.com|video\.twimg\.com/i.test(url)) {
      if (/\.(mp4|m3u8|webm)(?:$|\?|#)/i.test(url) || /[?&](bytestart|oe=)/i.test(url)) {
        return true;
      }
    }
    return /\.(m3u8|mpd|mp4|webm|mkv|m4v|mov|ts)(?:$|\?|#)/i.test(url);
  }

  function labelFor(url) {
    if (/googlevideo\.com|\/videoplayback/i.test(url)) {
      try {
        const u = new URL(url);
        const q = u.searchParams.get("q") || u.searchParams.get("quality_label");
        const itag = u.searchParams.get("itag");
        if (q) return q;
        if (itag) return "itag " + itag;
        return "YouTube stream";
      } catch {
        return "YouTube stream";
      }
    }
    const m = url.match(/\.(m3u8|mpd|mp4|webm|mkv|m4v|mov|ts)/i);
    if (!m) return "Media";
    const ext = m[1].toLowerCase();
    if (ext === "m3u8") return "HLS stream";
    if (ext === "mpd") return "DASH stream";
    return ext.toUpperCase();
  }

  function report(url, extra) {
    if (!url || seen.has(url)) return;
    if (!isMediaUrl(url) && !(extra && extra.force)) return;
    seen.add(url);

    const title =
      (extra && extra.title) ||
      pageTitle() ||
      labelFor(url);

    // On YouTube, prefer sending watch page URL to FDM (streams expire)
    let sendUrl = url;
    let pageUrl = location.href.split("#")[0];
    if (/googlevideo\.com|\/videoplayback/i.test(url) && /youtube\.com|youtu\.be/i.test(location.hostname)) {
      sendUrl = pageUrl;
    }

    chrome.runtime.sendMessage({
      type: "media-found",
      item: {
        url: sendUrl,
        streamUrl: url !== sendUrl ? url : undefined,
        label: (extra && extra.label) || labelFor(url),
        type: (extra && extra.type) || labelFor(url),
        source: (extra && extra.source) || "dom",
        title: title,
        pageUrl: pageUrl,
        listInDetected: true,
        dedupeKey: (extra && extra.dedupeKey) || url
      }
    });
  }

  function scanVideoElements() {
    const title = pageTitle();
    document.querySelectorAll("video").forEach((video, i) => {
      const t = title || "HTML5 video " + (i + 1);
      if (video.currentSrc) report(video.currentSrc, { label: "HTML5 video", title: t });
      if (video.src) report(video.src, { label: "HTML5 video", title: t });
      video.querySelectorAll("source").forEach((s) => {
        if (s.src) report(s.src, { label: s.type || "HTML5 source", title: t });
      });
    });

    document.querySelectorAll("audio").forEach((audio) => {
      if (audio.currentSrc && isMediaUrl(audio.currentSrc)) {
        report(audio.currentSrc, { label: "Audio", title: title || "Audio" });
      }
    });

    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.href;
      if (isMediaUrl(href)) {
        const linkTitle = (a.textContent || "").trim().slice(0, 80);
        report(href, {
          label: labelFor(href),
          title: linkTitle || title || labelFor(href)
        });
      }
    });

    document.querySelectorAll("[data-video-url], [data-src], [data-mp4]").forEach((el) => {
      ["data-video-url", "data-src", "data-mp4"].forEach((attr) => {
        const v = el.getAttribute(attr);
        if (v && isMediaUrl(v)) report(v, { title: title });
      });
    });
  }

  function watchPerformance() {
    try {
      const title = pageTitle();
      const entries = performance.getEntriesByType("resource");
      for (const e of entries) {
        if (e.name && isMediaUrl(e.name)) {
          report(e.name, { label: labelFor(e.name), title: title, source: "performance" });
        }
      }
    } catch {
      /* ignore */
    }
  }

  function injectNetworkHooks() {
    const script = document.createElement("script");
    script.textContent = "(" + function () {
      const notify = (url) => {
        try {
          window.postMessage({ source: "videopicker-hook", url: String(url) }, "*");
        } catch (e) {}
      };
      const re =
        /(\.m3u8|\.mpd|\.mp4|\.webm|\.mkv|\.m4v|\.mov|\.ts)(?:$|\?|#)|googlevideo\.com|\/videoplayback|fbcdn\.net.*\.mp4|video\.twimg\.com/i;
      const wrap = (orig) =>
        function (...args) {
          try {
            const u = args[0] && args[0].url ? args[0].url : args[0];
            if (typeof u === "string" && re.test(u)) notify(u);
          } catch (e) {}
          return orig.apply(this, args);
        };
      try {
        if (window.fetch) window.fetch = wrap(window.fetch.bind(window));
      } catch (e) {}
      try {
        const open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
          try {
            if (typeof url === "string" && re.test(url)) notify(url);
          } catch (e) {}
          return open.call(this, method, url, ...rest);
        };
      } catch (e) {}
    } + ")();";
    (document.documentElement || document.head).appendChild(script);
    script.remove();
  }

  window.addEventListener("message", (ev) => {
    if (!ev.data || ev.data.source !== "videopicker-hook") return;
    if (ev.data.url) report(ev.data.url, { title: pageTitle(), source: "hook" });
  });

  function fullScan() {
    scanVideoElements();
    watchPerformance();
    if (window.__vpKnownSites) window.__vpKnownSites.reportPageTarget();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "rescan") {
      seen.clear();
      fullScan();
    }
  });

  const mo = new MutationObserver(() => {
    scanVideoElements();
  });

  function start() {
    try {
      injectNetworkHooks();
    } catch {
      /* CSP may block */
    }
    fullScan();
    mo.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "href", "data-src", "data-video-url"]
    });
    setInterval(watchPerformance, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
