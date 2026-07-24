const mediaList = document.getElementById("mediaList");
const empty = document.getElementById("empty");
const pageMeta = document.getElementById("pageMeta");

function shorten(url, max = 64) {
  if (!url) return "";
  return url.length <= max ? url : url.slice(0, max - 1) + "…";
}

function shortTitle(text, max = 60) {
  if (!text) return "Video";
  let s = String(text).replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  let cut = s.slice(0, max);
  let sp = cut.lastIndexOf(" ");
  if (sp >= Math.floor(max * 0.6)) cut = cut.slice(0, sp);
  return cut.replace(/[\s._-]+$/g, "").trim();
}

function toast(text, isError) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  if (isError) el.style.background = "#4a1f1f";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}

function youtubeId(url) {
  try {
    const u = new URL(url);
    if (/youtu\.be$/i.test(u.hostname.replace(/^www\./, ""))) {
      return u.pathname.replace(/^\//, "").split("/")[0];
    }
    if (/youtube\.com/i.test(u.hostname)) {
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2];
      return u.searchParams.get("v");
    }
  } catch {
    /* ignore */
  }
  return "";
}

function dedupeKey(item) {
  const yid = youtubeId(item.url || "");
  if (yid) return "youtube:" + yid;
  try {
    const u = new URL(item.url);
    u.hash = "";
    return u.toString();
  } catch {
    return item.url || item.title || Math.random().toString(36);
  }
}

async function download(url) {
  const res = await sendMessage({ type: "send-to-fdm", url });
  if (res && res.ok) toast("Sent to Free Download Manager");
  else toast((res && res.error) || "Download failed", true);
}

async function copy(url) {
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch {
    toast("Copy failed", true);
  }
}

function renderItems(items) {
  const best = new Map();
  for (const item of items || []) {
    if (!item || !item.url) continue;
    const key = dedupeKey(item);
    const prev = best.get(key);
    // Prefer entries with a real title / preferred flag
    if (!prev) {
      best.set(key, item);
      continue;
    }
    const score = (i) =>
      (i.preferred ? 2 : 0) +
      (i.title && i.title.length > 3 ? 1 : 0) +
      (i.source === "youtube-player" || i.source === "known-site" ? 1 : 0);
    if (score(item) >= score(prev)) best.set(key, { ...prev, ...item, title: item.title || prev.title });
  }

  const display = Array.from(best.values());

  mediaList.innerHTML = "";
  if (!display.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const item of display) {
    const li = document.createElement("li");

    const title = document.createElement("div");
    title.className = "item-title";
    title.textContent = shortTitle(item.title || item.label || "Video");

    const actions = document.createElement("div");
    actions.className = "actions";

    const dl = document.createElement("button");
    dl.type = "button";
    dl.className = "icon-btn download";
    dl.title = "Download with Free Download Manager";
    dl.textContent = "⬇";
    dl.addEventListener("click", () => download(item.url));

    const cp = document.createElement("button");
    cp.type = "button";
    cp.className = "icon-btn copy";
    cp.title = "Copy video link";
    cp.textContent = "⧉";
    cp.addEventListener("click", () => copy(item.url));

    actions.append(dl, cp);

    const sub = document.createElement("div");
    sub.className = "item-sub";
    sub.textContent = shorten(item.url);

    li.append(title, actions, sub);
    mediaList.appendChild(li);
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    pageMeta.textContent = "No tab";
    return;
  }
  pageMeta.textContent = tab.title || tab.url || "";

  await sendMessage({ type: "clear-media", tabId: tab.id });
  await sendMessage({ type: "rescan", tabId: tab.id });
  // Give content scripts a moment to report
  await new Promise((r) => setTimeout(r, 250));
  const res = await sendMessage({ type: "get-media", tabId: tab.id });
  let items = (res && res.items) || [];

  if (!items.length && tab.url && /^https?:/i.test(tab.url)) {
    items = [
      {
        url: tab.url.split("#")[0],
        title: (tab.title || "This page").replace(/\s*\(\d+\)\s*/g, " ").replace(/\s*-\s*YouTube\s*$/i, "").trim()
      }
    ];
  }

  renderItems(items);
}

init();
