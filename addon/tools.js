// Shared helpers for the FDM Video Picker add-on
// Author: Sofiqul Islam — https://sofiqul.dev

// Convert FDM cookie objects to Netscape format (for yt-dlp --cookies)
function cookiesToNetscapeText(cookies) {
  let r = "# Netscape HTTP Cookie File\n";

  for (let i = 0; i < cookies.length; ++i) {
    let c = cookies[i];
    let domain = c.domain || "";
    let path = c.path || "/";
    let secure = c.isSecure ? "TRUE" : "FALSE";
    let expires = 0;
    if (c.expirationDate) {
      let t = c.expirationDate.getTime
        ? c.expirationDate.getTime()
        : Number(c.expirationDate);
      expires = t ? Math.floor(t / 1000) : 0;
    }
    r +=
      domain +
      "\t" +
      (domain.charAt(0) === "." ? "TRUE" : "FALSE") +
      "\t" +
      path +
      "\t" +
      secure +
      "\t" +
      expires +
      "\t" +
      c.name +
      "\t" +
      c.value +
      "\n";
  }

  return r;
}

function logPythonResult(obj) {
  if (obj.output) console.log("Python result: ", obj.output);
  if (obj.errorOutput) console.log("Python errors: ", obj.errorOutput);
}

// Keep titles short — FDM file names struggle with very long titles
var TITLE_MAX_LEN = 60;

function truncateTitle(text, maxLen) {
  maxLen = maxLen || TITLE_MAX_LEN;
  if (text === null || text === undefined) return text;
  let s = String(text).replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  let cut = s.slice(0, maxLen);
  let sp = cut.lastIndexOf(" ");
  if (sp >= Math.floor(maxLen * 0.6)) cut = cut.slice(0, sp);
  return cut.replace(/[\s._-]+$/g, "").trim();
}

function sanitizeMediaInfo(info) {
  if (!info || typeof info !== "object") return info;

  if (typeof info.title === "string") info.title = truncateTitle(info.title);
  if (typeof info.fulltitle === "string") info.fulltitle = truncateTitle(info.fulltitle);
  if (typeof info.playlist_title === "string") {
    info.playlist_title = truncateTitle(info.playlist_title);
  }

  if (Array.isArray(info.entries)) {
    for (let i = 0; i < info.entries.length; ++i) {
      if (info.entries[i]) sanitizeMediaInfo(info.entries[i]);
    }
  }

  if (Array.isArray(info.requested_downloads)) {
    for (let i = 0; i < info.requested_downloads.length; ++i) {
      if (info.requested_downloads[i]) sanitizeMediaInfo(info.requested_downloads[i]);
    }
  }

  return info;
}

// launchPythonScript(...) is provided by Free Download Manager
