var g_browsers = Object.create(null);

var KNOWN_HOST_RE =
  /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com|facebook\.com|fb\.watch|fb\.com|instagram\.com|x\.com|twitter\.com|t\.co)$/i;

var msAbstractParser = (function () {
  function MsAbstractParser() {}

  MsAbstractParser.prototype = {
    parse: function (obj, customArgs) {
      console.log("Video Picker: parsing", obj.url);

      let args = [];
      let tmpCookies;
      let systemUserAgent;
      let systemBrowser;
      let allowWbCookies = true;

      try {
        systemUserAgent = qtJsSystem.defaultUserAgent;
        systemBrowser = qtJsSystem.defaultWebBrowser;
        allowWbCookies = App.pluginsAllowWbCookies;
      } catch (e) {}

      try {
        let proxyUrl = qtJsNetworkProxyMgr.proxyForUrl(obj.url).url();
        if (proxyUrl) {
          // FDM may report https proxies; yt-dlp expects http scheme for some proxies.
          proxyUrl = proxyUrl.replace(/^https:\/\//i, "http://");
          args.push("--proxy", proxyUrl);
        }
      } catch (e) {}

      args.push(
        "-J",
        "--flat-playlist",
        "--no-warnings",
        "--compat-options",
        "no-youtube-unavailable-videos",
        // Prefer Node if present for YouTube JS challenges
        "--js-runtimes",
        "node"
      );

      if (allowWbCookies) {
        if (obj.cookies && obj.cookies.length) {
          tmpCookies = qtJsTools.createTmpFile(
            "request_" + obj.requestId + "_cookies"
          );
          if (tmpCookies && tmpCookies.writeText(cookiesToNetscapeText(obj.cookies))) {
            args.push("--cookies", tmpCookies.path);
          }
        } else {
          let browser = obj.browser || systemBrowser;
          if (browser) {
            if (!(browser in g_browsers)) {
              return this.checkBrowser(obj.requestId, obj.interactive, browser).then(
                () => this.parse(obj, customArgs)
              );
            }
            if (!g_browsers[browser] && browser !== "firefox") {
              browser = "firefox";
              if (!(browser in g_browsers)) {
                return this.checkBrowser(
                  obj.requestId,
                  obj.interactive,
                  browser
                ).then(() => this.parse(obj, customArgs));
              }
            }
            if (g_browsers[browser]) {
              args.push("--cookies-from-browser", browser);
            }
          }
        }
      }

      let userAgent = obj.userAgent || systemUserAgent;
      if (userAgent) args.push("--user-agent", userAgent);

      if (customArgs && customArgs.length) args = args.concat(customArgs);

      args.push(obj.url);

      return launchPythonScript(
        obj.requestId,
        obj.interactive,
        "yt-dlp/yt_dlp/__main__.py",
        args
      ).then(function (result) {
        logPythonResult(result);

        return new Promise(function (resolve, reject) {
          let output = (result.output || "").trim();
          if (!output || output[0] !== "{") {
            let isUnsupportedUrl =
              /ERROR:\s*(\[generic\])?\s*Unsupported URL:/.test(
                result.errorOutput || ""
              );
            reject({
              error: isUnsupportedUrl ? "Unsupported URL" : "Parse error",
              isParseError: !isUnsupportedUrl
            });
          } else {
            let info = JSON.parse(output);
            resolve(sanitizeMediaInfo(info));
          }
        });
      });
    },

    isSupportedSource: function (url) {
      try {
        let u = new URL(url);
        let host = u.hostname.replace(/^www\./i, "");
        return KNOWN_HOST_RE.test(host);
      } catch (e) {
        return false;
      }
    },

    supportedSourceCheckPriority: function () {
      // Higher than generic fallbacks so known sites prefer this add-on.
      return 1000;
    },

    isPossiblySupportedSource: function (obj) {
      if (obj.contentType && !/^text\/html(;.*)?$/i.test(obj.contentType)) {
        return false;
      }
      if (
        obj.resourceSize !== -1 &&
        (obj.resourceSize === 0 || obj.resourceSize > 3 * 1024 * 1024)
      ) {
        return false;
      }
      return /^https?:\/\//i.test(obj.url);
    },

    overrideUrlPolicy: function (url) {
      return true;
    },

    minIntevalBetweenQueryInfoDownloads: function () {
      return 300;
    },

    checkBrowser: function (requestId, interactive, browser) {
      console.log("Video Picker: checking browser cookie support (", browser, ")");

      return launchPythonScript(
        requestId,
        interactive,
        "yt-dlp/yt_dlp/__main__.py",
        [
          "--cookies-from-browser",
          browser,
          "e692ec362191442c960a761ac6b84878://test.test"
        ]
      ).then(function (result) {
        logPythonResult(result);
        let isSupported = /"e692ec362191442c960a761ac6b84878"/.test(
          result.errorOutput || ""
        );
        g_browsers[browser] = isSupported;
        console.log(browser, " supported: ", isSupported);
      });
    }
  };

  return new MsAbstractParser();
})();
