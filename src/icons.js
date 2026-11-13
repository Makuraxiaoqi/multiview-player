(function () {
  'use strict';

  const paths = {
    play: '<path d="M8 5.4v13.2L19 12z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="7" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
    volume: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4.2 4.2 0 010 6"/><path d="M18 6.5a8 8 0 010 11"/>',
    mute: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" stroke="none"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    sliders: '<path d="M4 7h8M17 7h3M4 17h3M12 17h8"/><circle cx="14.5" cy="7" r="2"/><circle cx="9.5" cy="17" r="2"/>',
    folder: '<path d="M3.5 7.5a2 2 0 012-2h3.6l2 2h7.4a2 2 0 012 2v7.5a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.4"/><path d="M20 15.5l-4.5-4.5-5 5-3-3-4 4"/>',
    film: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/>',
    chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
    chevronRight: '<path d="M9 5l7 7-7 7"/>',
    chevronUp: '<path d="M5 15l7-7 7 7"/>',
    chevronDown: '<path d="M5 9l7 7 7-7"/>',
    refresh: '<path d="M20.5 12a8.5 8.5 0 11-2.6-6.1"/><path d="M20.5 4.5V10H15"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    expand: '<path d="M9 3.5H3.5V9M15 3.5h5.5V9M9 20.5H3.5V15M15 20.5h5.5V15"/>',
    collapse: '<path d="M3.5 8.5H8V4M20.5 8.5H16V4M3.5 15.5H8V20M20.5 15.5H16V20"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    trash: '<path d="M4 7h16M9.5 7V5h5v2M6.5 7l.9 13h9.2l.9-13M10 11v5M14 11v5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    shuffle: '<path d="M16 3.5h4.5V8M4 20L20.5 3.5M20.5 16v4.5H16M15 15l5.5 5.5M4 4l5 5"/>',
    repeat: '<path d="M17 2.5l3.5 3.5L17 9.5"/><path d="M3.5 11.5V10a4 4 0 014-4h13"/><path d="M7 21.5L3.5 18 7 14.5"/><path d="M20.5 12.5V14a4 4 0 01-4 4h-13"/>',
    presentation: '<rect x="3" y="4" width="18" height="12.5" rx="1.5"/><path d="M12 16.5V20M8 22h8M9.5 9l2.5 2 3-3"/>',
    home: '<path d="M3.5 11L12 3.5 20.5 11"/><path d="M5.5 9.5V20h13V9.5"/>',
    desktop: '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M9 20.5h6M12 16.5v4"/>',
    download: '<path d="M12 3.5v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4 20.5h16"/>',
    check: '<path d="M4.5 12.5l5 5L20 6.5"/>',
    alert: '<path d="M12 3.5l9 16H3z"/><path d="M12 9v5M12 17.2v.1"/>',
    help: '<circle cx="12" cy="12" r="8.8"/><path d="M9.6 9.2a2.5 2.5 0 114 2c-.9.7-1.6 1.2-1.6 2.5"/><path d="M12 17.2v.1"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
    layers: '<path d="M12 3.5l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 16.5l9 5 9-5"/>',
    external: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v4.5a2 2 0 01-2 2H5.5a2 2 0 01-2-2V8a2 2 0 012-2H10"/>',
    clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 7v5.4l3.5 2"/>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>',
    info: '<circle cx="12" cy="12" r="8.8"/><path d="M12 11v5.5M12 7.5v.1"/>'
  };

  function icon(name, size) {
    const s = size || 18;
    const body = paths[name] || '';
    return `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  window.MV = window.MV || {};
  window.MV.icon = icon;
})();
