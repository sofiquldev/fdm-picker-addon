var msBatchParser = (function () {
  function MsBatchParser() {}

  MsBatchParser.prototype = {
    parse: function (obj) {
      // Playlist / media-list parsing — allow yt-dlp to expand entries.
      return msAbstractParser.parse(obj, []);
    },

    isSupportedSource: msAbstractParser.isSupportedSource,

    supportedSourceCheckPriority: function () {
      return msAbstractParser.supportedSourceCheckPriority();
    },

    isPossiblySupportedSource: msAbstractParser.isPossiblySupportedSource,

    overrideUrlPolicy: msAbstractParser.overrideUrlPolicy,

    minIntevalBetweenQueryInfoDownloads:
      msAbstractParser.minIntevalBetweenQueryInfoDownloads
  };

  return new MsBatchParser();
})();

// Aliases for FDM media-list parser entry points across API revisions.
var mediaListParser = msBatchParser;
var msListParser = msBatchParser;
