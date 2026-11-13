(function () {
  'use strict';

  const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'ico']);
  const VIDEO_EXT = new Set(['mp4', 'm4v', 'webm', 'ogv', 'ogg', 'mov', 'mkv']);

  function extOf(name) {
    const clean = String(name || '').split(/[?#]/)[0];
    const idx = clean.lastIndexOf('.');
    return idx >= 0 ? clean.slice(idx + 1).toLowerCase() : '';
  }

  function kindFromExt(name) {
    const ext = extOf(name);
    if (IMAGE_EXT.has(ext)) return 'image';
    if (VIDEO_EXT.has(ext)) return 'video';
    return null;
  }

  function basename(p) {
    if (!p) return '';
    const parts = String(p).replace(/[\\/]+$/, '').split(/[\\/]/);
    return parts[parts.length - 1] || p;
  }

  function dirname(p) {
    if (!p) return '';
    const parts = String(p).replace(/[\\/]+$/, '').split(/[\\/]/);
    parts.pop();
    if (!parts.length) return '';
    const joined = parts.join('\\');
    return /^[A-Za-z]:$/.test(joined) ? `${joined}\\` : joined;
  }

  function fmtTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function fmtSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i += 1;
    }
    const digits = value >= 100 || i === 0 ? 0 : 1;
    return `${value.toFixed(digits)} ${units[i]}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function shuffleArray(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  window.MV = window.MV || {};
  window.MV.util = {
    IMAGE_EXT,
    VIDEO_EXT,
    extOf,
    kindFromExt,
    basename,
    dirname,
    fmtTime,
    fmtSize,
    clamp,
    round1,
    shuffleArray,
    escapeHtml,
    debounce
  };
})();
