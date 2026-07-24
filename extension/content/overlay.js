(function () {
  "use strict";

  const BTN_CLASS = "vp-fdm-overlay-btn";
  const WRAP_ATTR = "data-vp-overlay";

  function pageUrl() {
    try {
      return location.href.split("#")[0];
    } catch {
      return "";
    }
  }

  function makeButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = BTN_CLASS;
    btn.title = "Download with Video Picker (FDM)";
    btn.setAttribute("aria-label", "Download with Video Picker for FDM");
    btn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 4v10m0 0l4-4m-4 4l-4-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M5 19h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
      "</svg>";

    btn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = pageUrl();
        if (!url) return;
        btn.classList.add("vp-busy");
        chrome.runtime.sendMessage({ type: "send-to-fdm", url }, (res) => {
          btn.classList.remove("vp-busy");
          if (chrome.runtime.lastError || !res || !res.ok) {
            btn.classList.add("vp-err");
            setTimeout(() => btn.classList.remove("vp-err"), 1400);
            return;
          }
          btn.classList.add("vp-ok");
          setTimeout(() => btn.classList.remove("vp-ok"), 1400);
        });
      },
      true
    );

    return btn;
  }

  function ensureOverlay(host) {
    if (!host || host.nodeType !== 1) return;
    if (host.tagName === "VIDEO" || host.tagName === "IFRAME") {
      host = host.parentElement;
    }
    if (!host || host.getAttribute(WRAP_ATTR) === "1") return;

    const cs = window.getComputedStyle(host);
    if (cs.position === "static") {
      host.style.position = "relative";
    }
    host.setAttribute(WRAP_ATTR, "1");
    host.appendChild(makeButton());
  }

  function scan() {
    const yt =
      document.querySelector("#movie_player") ||
      document.querySelector(".html5-video-player");
    if (yt) ensureOverlay(yt);

    document.querySelectorAll("video").forEach((v) => {
      // Prefer closest sized player container
      const host =
        v.closest("#movie_player, .html5-video-player, ytd-player, article, [data-testid='videoPlayer']") ||
        v.parentElement;
      ensureOverlay(host || v);
    });
  }

  const mo = new MutationObserver(() => scan());

  function start() {
    scan();
    mo.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });
    setInterval(scan, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
