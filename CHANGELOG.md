# Changelog

All notable changes to Video Picker for Free Download Manager are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-07-24

### Added

- FDM add-on (`VideoPicker.fda`) that resolves video URLs with yt-dlp
- Browser extension (Manifest V3) with player overlay and toolbar popup
- Download or copy link for the current video
- Native messaging bridge for Windows, macOS, and Linux
- Support for YouTube, Facebook, Instagram, X (Twitter), and other yt-dlp sites
- Page media detection for mp4, m3u8, webm, and similar formats
- Build scripts for the add-on and extension (PowerShell and bash)
- GitHub Actions workflows for CI builds and releases
- `CHANGELOG.md` as the source of GitHub Release notes

### Notes

- Requires Free Download Manager 6.32 or newer and Python 3.10+
- Video titles from the add-on are trimmed to 60 characters for FDM file names
- DRM / Netflix-style streams are not supported
