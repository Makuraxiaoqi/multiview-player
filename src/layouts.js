(function () {
  'use strict';

  const PRESETS = [
    { id: 'single', name: '单窗口', cols: '1fr', rows: '1fr', areas: '"a"' },
    { id: 'duo-h', name: '左右双窗', cols: '1fr 1fr', rows: '1fr', areas: '"a b"' },
    { id: 'duo-v', name: '上下双窗', cols: '1fr', rows: '1fr 1fr', areas: '"a" "b"' },
    { id: 'tri-main', name: '主窗 + 双副窗', cols: '2fr 1fr', rows: '1fr 1fr', areas: '"a b" "a c"' },
    { id: 'tri-cols', name: '三联横排', cols: '1fr 1fr 1fr', rows: '1fr', areas: '"a b c"' },
    { id: 'quad', name: '四宫格', cols: '1fr 1fr', rows: '1fr 1fr', areas: '"a b" "c d"' },
    { id: 'five', name: '主窗 + 四宫格', cols: '2fr 1fr 1fr', rows: '1fr 1fr', areas: '"a b c" "a d e"' },
    { id: 'six', name: '六宫格', cols: '1fr 1fr 1fr', rows: '1fr 1fr', areas: '"a b c" "d e f"' },
    { id: 'eight', name: '八宫格', cols: 'repeat(4, 1fr)', rows: '1fr 1fr', areas: '"a b c d" "e f g h"' },
    { id: 'nine', name: '九宫格', cols: 'repeat(3, 1fr)', rows: 'repeat(3, 1fr)', areas: '"a b c" "d e f" "g h i"' }
  ];

  function cells(preset) {
    return [...new Set(preset.areas.replace(/["\s]/g, '').split(''))];
  }

  function byId(id) {
    return PRESETS.find((p) => p.id === id) || PRESETS[0];
  }

  window.MV = window.MV || {};
  window.MV.PRESETS = PRESETS;
  window.MV.presetCells = cells;
  window.MV.presetById = byId;
})();
