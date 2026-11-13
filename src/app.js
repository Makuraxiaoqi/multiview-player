(function () {
  'use strict';

  const { icon, PRESETS, presetCells, presetById, util: U } = window.MV;
  const api = window.api;

  const MODES = new Set(['empty', 'image', 'video', 'slideshow']);

  function makePaneState() {
    return {
      mode: 'empty',
      path: null,
      name: '',
      volume: 0.8,
      muted: false,
      fit: 'contain',
      loop: true,
      slideshow: {
        folder: null,
        seconds: 3,
        shuffle: false,
        loop: true,
        recursive: false,
        pos: 0,
        images: [],
        order: [],
        playing: false
      }
    };
  }

  function makeInitialState() {
    return {
      version: 1,
      layout: 'quad',
      activePane: 0,
      masterVolume: 0.8,
      masterMuted: false,
      slideSeconds: 3,
      sidebarCollapsed: false,
      browserCwd: null,
      workspacePresets: [],
      panes: Array.from({ length: 9 }, makePaneState)
    };
  }

  function sanitizePaneState(source) {
    const pane = makePaneState();
    if (!source || typeof source !== 'object') return pane;

    let mode = MODES.has(source.mode) ? source.mode : 'empty';
    let path = typeof source.path === 'string' ? source.path : null;
    if ((mode === 'image' || mode === 'video') && !path) mode = 'empty';
    if (mode === 'empty') path = null;
    pane.mode = mode;
    pane.path = path;
    pane.name = typeof source.name === 'string' ? source.name : (path ? U.basename(path) : '');
    pane.volume = Number.isFinite(Number(source.volume)) ? U.clamp(Number(source.volume), 0, 1) : 0.8;
    pane.muted = !!source.muted;
    pane.fit = source.fit === 'cover' ? 'cover' : 'contain';
    pane.loop = source.loop !== false;

    const ss = source.slideshow && typeof source.slideshow === 'object' ? source.slideshow : {};
    pane.slideshow.folder = typeof ss.folder === 'string' && ss.folder ? ss.folder : null;
    pane.slideshow.seconds = Number.isFinite(Number(ss.seconds)) ? U.clamp(U.round1(Number(ss.seconds)), 0.1, 60) : 3;
    pane.slideshow.shuffle = !!ss.shuffle;
    pane.slideshow.loop = ss.loop !== false;
    pane.slideshow.recursive = !!ss.recursive;
    pane.slideshow.pos = Number.isFinite(Number(ss.pos)) ? Math.max(0, Math.floor(Number(ss.pos))) : 0;
    if (mode === 'slideshow' && !pane.slideshow.folder) mode = 'empty';
    pane.mode = mode;
    if (mode === 'empty') {
      pane.path = null;
      pane.name = '';
    }
    return pane;
  }

  const LAYOUT_IDS = new Set(PRESETS.map((preset) => preset.id));

  function sanitizeWorkspacePreset(source, index) {
    if (!source || typeof source !== 'object') return null;
    const name = typeof source.name === 'string' ? source.name.trim().slice(0, 40) : '';
    if (!name) return null;
    return {
      id: typeof source.id === 'string' && source.id ? source.id.slice(0, 80) : `ws-${index}-${Date.now().toString(36)}`,
      name,
      layout: LAYOUT_IDS.has(source.layout) ? source.layout : 'quad',
      createdAt: Number.isFinite(Number(source.createdAt)) ? Number(source.createdAt) : Date.now(),
      masterVolume: Number.isFinite(Number(source.masterVolume)) ? U.clamp(Number(source.masterVolume), 0, 1) : 0.8,
      masterMuted: !!source.masterMuted,
      slideSeconds: Number.isFinite(Number(source.slideSeconds)) ? U.clamp(U.round1(Number(source.slideSeconds)), 0.1, 60) : 3,
      panes: Array.isArray(source.panes) ? source.panes.slice(0, 9).map(sanitizePaneState) : []
    };
  }

  function mergeSavedState(saved) {
    const state = makeInitialState();
    if (!saved || typeof saved !== 'object') return state;

    if (PRESETS.some((p) => p.id === saved.layout)) state.layout = saved.layout;
    if (Number.isFinite(Number(saved.activePane))) {
      state.activePane = U.clamp(Math.floor(Number(saved.activePane)), 0, 8);
    }
    if (Number.isFinite(Number(saved.masterVolume))) {
      state.masterVolume = U.clamp(Number(saved.masterVolume), 0, 1);
    }
    state.masterMuted = !!saved.masterMuted;
    if (Number.isFinite(Number(saved.slideSeconds))) {
      state.slideSeconds = U.clamp(U.round1(Number(saved.slideSeconds)), 0.1, 60);
    }
    state.sidebarCollapsed = !!saved.sidebarCollapsed;
    if (typeof saved.browserCwd === 'string' && saved.browserCwd) state.browserCwd = saved.browserCwd;
    if (Array.isArray(saved.workspacePresets)) {
      state.workspacePresets = saved.workspacePresets
        .map((item, index) => sanitizeWorkspacePreset(item, index))
        .filter(Boolean)
        .slice(0, 30);
    }

    if (Array.isArray(saved.panes)) {
      saved.panes.slice(0, 9).forEach((source, index) => {
        state.panes[index] = sanitizePaneState(source);
      });
    }

    return state;
  }

  const app = {
    api,
    state: makeInitialState(),
    panes: [],
    browser: null,
    _popover: null,
    _popoverAnchor: null,
    _fullscreenPane: null,
    _masterSeeking: false,
    ready: false
  };

  const $ = (id) => document.getElementById(id);

  function hydrateStaticIcons() {
    document.querySelectorAll('[data-icon]').forEach((el) => {
      if (el.querySelector('.ic')) return;
      const size = Number(el.dataset.size) || 16;
      el.innerHTML = icon(el.dataset.icon, size);
    });
  }

  function saveSoon() {
    if (!app.ready) return;
    saveDebounced();
  }

  const saveDebounced = U.debounce(() => {
    if (!api) return;
    api.saveState(buildPersist()).catch((error) => console.error('保存失败', error));
  }, 350);

  function buildPersist() {
    return {
      version: 1,
      layout: app.state.layout,
      activePane: app.state.activePane,
      masterVolume: app.state.masterVolume,
      masterMuted: app.state.masterMuted,
      slideSeconds: app.state.slideSeconds,
      sidebarCollapsed: app.state.sidebarCollapsed,
      browserCwd: app.state.browserCwd,
      workspacePresets: app.state.workspacePresets,
      panes: app.state.panes.map((pane) => ({
        mode: pane.mode,
        path: pane.path,
        name: pane.name,
        volume: pane.volume,
        muted: pane.muted,
        fit: pane.fit,
        loop: pane.loop,
        slideshow: {
          folder: pane.slideshow.folder,
          seconds: pane.slideshow.seconds,
          shuffle: pane.slideshow.shuffle,
          loop: pane.slideshow.loop,
          recursive: pane.slideshow.recursive,
          pos: pane.slideshow.pos
        }
      }))
    };
  }

  function paneChanged() {
    refreshMaster();
    updateStatus();
    saveSoon();
  }

  function setActive(index, options = {}) {
    const count = presetCells(presetById(app.state.layout)).length;
    const target = U.clamp(Number(index) || 0, 0, count - 1);
    app.state.activePane = target;
    app.panes.forEach((pane) => {
      pane.el.classList.toggle('active', pane.index === target);
    });
    if (!options.silent) {
      refreshMaster();
      saveSoon();
    }
    updateStatus();
  }

  function cyclePane(direction) {
    const count = presetCells(presetById(app.state.layout)).length;
    const next = (app.state.activePane + direction + count) % count;
    setActive(next);
  }

  function activePane() {
    return app.panes[app.state.activePane] || app.panes[0];
  }

  function isTimeBased(pane) {
    if (!pane) return false;
    if (pane.state.mode === 'video') return true;
    return pane.state.mode === 'slideshow' && pane.state.slideshow.images.length > 0;
  }

  function getReferencePane() {
    const active = activePane();
    if (isTimeBased(active)) return active;
    return app.panes.find((pane) => isTimeBased(pane)) || null;
  }

  function buildPresets() {
    const strip = $('presetStrip');
    strip.innerHTML = '';
    PRESETS.forEach((preset) => {
      const button = document.createElement('button');
      button.className = 'preset-btn';
      button.dataset.preset = preset.id;
      button.title = preset.name;
      button.setAttribute('aria-label', preset.name);

      const mini = document.createElement('span');
      mini.className = 'preset-mini';
      mini.style.gridTemplateColumns = preset.cols;
      mini.style.gridTemplateRows = preset.rows;
      mini.style.gridTemplateAreas = preset.areas;
      presetCells(preset).forEach((cell) => {
        const cellEl = document.createElement('i');
        cellEl.style.gridArea = cell;
        mini.appendChild(cellEl);
      });

      const label = document.createElement('span');
      label.className = 'preset-label';
      label.textContent = preset.name;
      button.appendChild(mini);
      button.appendChild(label);
      strip.appendChild(button);
    });

    strip.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-preset]');
      if (btn) applyLayout(btn.dataset.preset);
    });
  }

  function updatePresetButtons() {
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === app.state.layout);
    });
  }

  function applyLayout(id, options = {}) {
    const preset = presetById(id);
    if (!preset) return;
    if (app._fullscreenPane) exitFullscreen();
    closePopover();

    app.state.layout = preset.id;
    const grid = $('grid');
    grid.style.gridTemplateColumns = preset.cols;
    grid.style.gridTemplateRows = preset.rows;
    grid.style.gridTemplateAreas = preset.areas;
    grid.innerHTML = '';

    const cells = presetCells(preset);
    app.panes.forEach((pane) => pane.setVisible(false));
    cells.forEach((cell, index) => {
      const pane = app.panes[index];
      pane.el.style.gridArea = cell;
      grid.appendChild(pane.el);
      pane.setVisible(true);
    });

    if (app.state.activePane >= cells.length) {
      app.state.activePane = 0;
    }
    app.panes.forEach((pane) => {
      pane.el.classList.toggle('active', pane.index === app.state.activePane);
    });

    updatePresetButtons();
    refreshMaster();
    updateStatus();
    if (!options.silent) saveSoon();
  }

  function refreshMaster() {
    const seek = $('masterSeek');
    const time = $('masterTime');
    const playAllBtn = $('playAllBtn');
    const ref = getReferencePane();
    const snap = ref ? ref.snapshot() : { kind: null, playing: false, current: 0, duration: 0, fraction: 0 };

    if (!app._masterSeeking) {
      seek.value = String(Math.round(snap.fraction * 1000));
    }
    seek.disabled = !snap.kind;

    if (snap.kind === 'video') {
      time.textContent = `${U.fmtTime(snap.current)} / ${U.fmtTime(snap.duration)}`;
    } else if (snap.kind === 'slideshow') {
      time.textContent = `${snap.current} / ${snap.duration} 张`;
    } else {
      time.textContent = '--:-- / --:--';
    }

    const playing = app.panes.filter((pane) => pane.isPlaying()).length;
    playAllBtn.innerHTML = `${icon(playing > 0 ? 'pause' : 'play', 15)}<span>${playing > 0 ? '全部暂停' : '全部播放'}</span>`;
    playAllBtn.classList.toggle('is-playing', playing > 0);
    playAllBtn.title = playing > 0 ? '暂停所有窗口（空格）' : '播放所有窗口（空格）';
  }

  function toggleAll() {
    const anyPlaying = app.panes.some((pane) => pane.isPlaying());
    if (anyPlaying) {
      app.panes.forEach((pane) => {
        if (pane.state.mode === 'video' || pane.state.mode === 'slideshow') pane.pause();
      });
    } else {
      app.panes.forEach((pane) => {
        if (pane.state.mode === 'video' || pane.state.mode === 'slideshow') pane.play();
      });
    }
    refreshMaster();
    saveSoon();
  }

  function seekAll(fraction) {
    app.panes.forEach((pane) => {
      if (pane.state.mode === 'video' || pane.state.mode === 'slideshow') pane.seekFraction(fraction);
    });
    refreshMaster();
  }

  function seekReference(seconds) {
    const ref = getReferencePane();
    if (!ref) return;
    const snap = ref.snapshot();
    if (snap.kind === 'video' && Number.isFinite(ref.video.duration)) {
      ref.video.currentTime = U.clamp(ref.video.currentTime + seconds, 0, ref.video.duration);
      ref.updatePlaybackUI();
      refreshMaster();
    } else if (snap.kind === 'slideshow') {
      ref.nextSlide(seconds > 0 ? 1 : -1);
    }
  }

  function applyMasterVolume() {
    $('masterVolume').value = String(Math.round(app.state.masterVolume * 100));
    $('masterVolLabel').textContent = `${Math.round(app.state.masterVolume * 100)}%`;
    $('masterMuteBtn').innerHTML = icon(app.state.masterMuted ? 'mute' : 'volume', 16);
    $('masterMuteBtn').classList.toggle('is-active', app.state.masterMuted);
    app.panes.forEach((pane) => pane.onMasterVolumeChanged());
  }

  function setGlobalSeconds(value, options = {}) {
    const seconds = U.clamp(U.round1(Number(value) || 3), 0.1, 60);
    app.state.slideSeconds = seconds;
    const input = $('slideSeconds');
    input.value = seconds.toFixed(1);
    if (options.apply !== false) {
      app.panes.forEach((pane) => {
        if (pane.state.mode === 'slideshow') pane.setSeconds(seconds);
      });
    }
    updateStatus();
    saveSoon();
  }

  function updateStatus() {
    const cells = presetCells(presetById(app.state.layout));
    const videos = app.panes.filter((pane) => pane.state.mode === 'video').length;
    const slides = app.panes.filter((pane) => pane.state.mode === 'slideshow').length;
    const images = app.panes.filter((pane) => pane.state.mode === 'image').length;
    $('statusCounts').textContent = `${cells.length} 窗口 · ${videos} 视频 · ${slides} 幻灯片 · ${images} 图片`;

    const active = activePane();
    if (!active || !active.hasMedia()) {
      $('statusText').textContent = `窗口 ${app.state.activePane + 1} · 空闲`;
    } else if (active.state.mode === 'slideshow') {
      const ss = active.state.slideshow;
      $('statusText').textContent = `窗口 ${app.state.activePane + 1} · 幻灯片 ${U.basename(ss.folder)} · 第 ${ss.images.length ? ss.pos + 1 : 0} / ${ss.images.length} 张`;
    } else {
      $('statusText').textContent = `窗口 ${app.state.activePane + 1} · ${active.state.mode === 'video' ? '视频' : '图片'} ${active.state.name || ''}`;
    }
  }

  function toast(message, type = 'info') {
    const layer = $('toastLayer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icon(type === 'error' ? 'alert' : 'info', 14)}<span>${U.escapeHtml(message)}</span>`;
    layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 260);
    }, 3400);
  }

  function closePopover() {
    app._popover = null;
    app._popoverAnchor = null;
    const layer = $('popoverLayer');
    if (layer) layer.innerHTML = '';
  }

  function positionPopover(pop, anchor) {
    const margin = 12;
    const rect = anchor.getBoundingClientRect();
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;
    let left = rect.right - width;
    left = Math.min(left, window.innerWidth - width - margin);
    left = Math.max(margin, left);
    let top = rect.bottom + 8;
    if (top + height > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - height - 8);
    }
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
  }

  function openPopover(html, anchor, className = '') {
    closePopover();
    const layer = $('popoverLayer');
    const pop = document.createElement('div');
    pop.className = `popover ${className}`.trim();
    pop.innerHTML = html;
    pop.style.visibility = 'hidden';
    layer.appendChild(pop);
    app._popover = pop;
    app._popoverAnchor = anchor;
    positionPopover(pop, anchor);
    pop.style.visibility = 'visible';
    return pop;
  }

  function settingsHTML(pane) {
    const p = pane.state;
    const ss = p.slideshow;
    const modeLabel = { empty: '空闲', image: '图片', video: '视频', slideshow: '幻灯片' }[p.mode] || '空闲';
    const head = `<div class="pop-head">
      <div class="pop-title">窗口 ${pane.index + 1}</div>
      <div class="pop-sub">${modeLabel}</div>
    </div>`;

    const fitRow = `<div class="pop-row">
      <span class="pop-label">画面</span>
      <div class="seg pop-seg">
        <button data-fit="contain" class="${p.fit !== 'cover' ? 'active' : ''}">适应</button>
        <button data-fit="cover" class="${p.fit === 'cover' ? 'active' : ''}">铺满</button>
      </div>
    </div>`;

    if (p.mode === 'empty') {
      return `${head}
        <div class="pop-empty">选择一个文件，或把整个图片文件夹变成幻灯片。</div>
        <button class="btn wide" data-action="pick-file">${icon('image', 14)} 选择文件…</button>
        <button class="btn wide ghost" data-action="pick-folder">${icon('folder', 14)} 选择图片文件夹…</button>`;
    }

    if (p.mode === 'video') {
      return `${head}
        <div class="pop-path" title="${U.escapeHtml(p.path || '')}">${U.escapeHtml(p.path || '')}</div>
        <div class="pop-inline">
          <button class="btn mini" data-action="pick-file">更换视频</button>
          <button class="btn mini ghost" data-action="reveal">打开位置</button>
        </div>
        <label class="check"><input type="checkbox" data-field="videoLoop" ${p.loop ? 'checked' : ''}> <span>循环播放</span></label>
        ${fitRow}
        <div class="pop-sep"></div>
        <button class="btn danger wide" data-action="clear">${icon('trash', 14)} 清空窗口</button>`;
    }

    if (p.mode === 'image') {
      return `${head}
        <div class="pop-path" title="${U.escapeHtml(p.path || '')}">${U.escapeHtml(p.path || '')}</div>
        <div class="pop-inline">
          <button class="btn mini" data-action="pick-file">更换图片</button>
          <button class="btn mini ghost" data-action="reveal">打开位置</button>
        </div>
        <button class="btn wide ghost" data-action="folder-of-file">${icon('presentation', 14)} 用所在文件夹做幻灯片</button>
        ${fitRow}
        <div class="pop-sep"></div>
        <button class="btn danger wide" data-action="clear">${icon('trash', 14)} 清空窗口</button>`;
    }

    const presets = [0.5, 1, 2, 3, 5, 10];
    return `${head}
      <div class="pop-path" title="${U.escapeHtml(ss.folder || '')}">${U.escapeHtml(ss.folder || '未选择文件夹')}</div>
      <button class="btn wide" data-action="pick-folder">${icon('folder', 14)} 更换图片文件夹…</button>
      <div class="pop-row">
        <span class="pop-label">每张时长</span>
        <div class="stepper compact">
          <button class="step-btn" data-step="-0.1" title="减少 0.1 秒">${icon('minus', 12)}</button>
          <input type="number" data-role="popSeconds" min="0.1" max="60" step="0.1" value="${ss.seconds.toFixed(1)}">
          <span class="unit">秒</span>
          <button class="step-btn" data-step="0.1" title="增加 0.1 秒">${icon('plus', 12)}</button>
        </div>
      </div>
      <div class="pop-chips">
        ${presets.map((value) => `<button class="chip ${Math.abs(ss.seconds - value) < 0.001 ? 'active' : ''}" data-seconds="${value}">${value}s</button>`).join('')}
      </div>
      <div class="pop-row">
        <span class="pop-label">播放顺序</span>
        <div class="seg pop-seg">
          <button data-order="sequence" class="${ss.shuffle ? '' : 'active'}">顺序</button>
          <button data-order="random" class="${ss.shuffle ? 'active' : ''}">随机</button>
        </div>
      </div>
      <label class="check"><input type="checkbox" data-field="recursive" ${ss.recursive ? 'checked' : ''}> <span>包含子文件夹</span></label>
      <label class="check"><input type="checkbox" data-field="slideshowLoop" ${ss.loop ? 'checked' : ''}> <span>循环播放</span></label>
      ${fitRow}
      <div class="pop-tip">顺序按文件名排列；随机每轮重新洗牌。时长可精确到 0.1 秒，顶部统一速度会覆盖所有幻灯片。</div>
      <div class="pop-sep"></div>
      <button class="btn danger wide" data-action="clear">${icon('trash', 14)} 清空窗口</button>`;
  }

  function showPaneSettings(pane, anchor) {
    const pop = openPopover(settingsHTML(pane), anchor, 'settings-pop');
    const secondsInput = pop.querySelector('[data-role="popSeconds"]');

    const updateSeconds = (value) => {
      const seconds = U.clamp(U.round1(Number(value) || 3), 0.1, 60);
      pane.setSeconds(seconds);
      if (secondsInput) secondsInput.value = seconds.toFixed(1);
      pop.querySelectorAll('[data-seconds]').forEach((chip) => {
        chip.classList.toggle('active', Math.abs(Number(chip.dataset.seconds) - seconds) < 0.001);
      });
    };

    pop.addEventListener('click', async (event) => {
      const stepBtn = event.target.closest('[data-step]');
      if (stepBtn) {
        const current = Number(secondsInput ? secondsInput.value : pane.state.slideshow.seconds);
        const delta = Number(stepBtn.dataset.step) * (event.shiftKey ? 10 : 1);
        updateSeconds(current + delta);
        return;
      }
      const chip = event.target.closest('[data-seconds]');
      if (chip) {
        updateSeconds(Number(chip.dataset.seconds));
        return;
      }
      const orderBtn = event.target.closest('[data-order]');
      if (orderBtn) {
        const random = orderBtn.dataset.order === 'random';
        pane.setShuffle(random);
        pop.querySelectorAll('[data-order]').forEach((btn) => {
          btn.classList.toggle('active', (btn.dataset.order === 'random') === random);
        });
        return;
      }
      const fitBtn = event.target.closest('[data-fit]');
      if (fitBtn) {
        pane.setFit(fitBtn.dataset.fit);
        pop.querySelectorAll('[data-fit]').forEach((btn) => btn.classList.toggle('active', btn === fitBtn));
        return;
      }
      const actionBtn = event.target.closest('[data-action]');
      if (!actionBtn) return;
      const action = actionBtn.dataset.action;
      if (action === 'pick-file') {
        closePopover();
        await pane.pickFile();
      } else if (action === 'pick-folder') {
        const folder = await api.chooseFolder();
        if (!folder) return;
        closePopover();
        await pane.startSlideshow(folder, {
          autoplay: true,
          seconds: pane.state.slideshow.seconds,
          shuffle: pane.state.slideshow.shuffle,
          loop: pane.state.slideshow.loop,
          recursive: pane.state.slideshow.recursive
        });
        setActive(pane.index);
      } else if (action === 'reveal') {
        api.reveal(pane.state.path);
      } else if (action === 'folder-of-file') {
        closePopover();
        await pane.startSlideshow(U.dirname(pane.state.path), { autoplay: true, seconds: app.state.slideSeconds });
        setActive(pane.index);
      } else if (action === 'clear') {
        closePopover();
        pane.clear();
      }
    });

    pop.addEventListener('change', async (event) => {
      const field = event.target.closest('[data-field]');
      if (!field) return;
      if (field.dataset.field === 'videoLoop') pane.setVideoLoop(field.checked);
      else if (field.dataset.field === 'slideshowLoop') pane.setSlideshowLoop(field.checked);
      else if (field.dataset.field === 'recursive') {
        closePopover();
        await pane.setRecursive(field.checked);
      }
    });

    if (secondsInput) {
      secondsInput.addEventListener('change', () => updateSeconds(secondsInput.value));
      secondsInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          secondsInput.blur();
        }
      });
    }
  }

  function captureWorkspacePreset(name) {
    const cells = presetCells(presetById(app.state.layout));
    return {
      id: `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      layout: app.state.layout,
      createdAt: Date.now(),
      masterVolume: app.state.masterVolume,
      masterMuted: app.state.masterMuted,
      slideSeconds: app.state.slideSeconds,
      panes: cells.map((cell, index) => {
        const p = app.state.panes[index];
        return {
          mode: p.mode,
          path: p.path,
          name: p.name,
          volume: p.volume,
          muted: p.muted,
          fit: p.fit,
          loop: p.loop,
          slideshow: {
            folder: p.slideshow.folder,
            seconds: p.slideshow.seconds,
            shuffle: p.slideshow.shuffle,
            loop: p.slideshow.loop,
            recursive: p.slideshow.recursive,
            pos: p.slideshow.pos
          }
        };
      })
    };
  }

  function overwritePaneState(target, source) {
    target.mode = source.mode;
    target.path = source.path;
    target.name = source.name;
    target.volume = source.volume;
    target.muted = source.muted;
    target.fit = source.fit;
    target.loop = source.loop;
    target.slideshow = {
      folder: source.slideshow.folder,
      seconds: source.slideshow.seconds,
      shuffle: source.slideshow.shuffle,
      loop: source.slideshow.loop,
      recursive: source.slideshow.recursive,
      pos: source.slideshow.pos,
      images: [],
      order: [],
      playing: false
    };
  }

  function workspaceSummary(preset) {
    const counts = { video: 0, slideshow: 0, image: 0 };
    preset.panes.forEach((p) => {
      if (counts[p.mode] != null) counts[p.mode] += 1;
    });
    const layout = presetById(preset.layout);
    const bits = [layout ? layout.name : '布局'];
    if (counts.video) bits.push(`${counts.video} 视频`);
    if (counts.slideshow) bits.push(`${counts.slideshow} 幻灯片`);
    if (counts.image) bits.push(`${counts.image} 图片`);
    return bits.join(' · ');
  }

  function workspaceHTML() {
    const list = app.state.workspacePresets;
    const items = list.map((preset) => `<div class="ws-item" data-id="${U.escapeHtml(preset.id)}">
        <div class="ws-info">
          <div class="ws-name" title="${U.escapeHtml(preset.name)}">${U.escapeHtml(preset.name)}</div>
          <div class="ws-meta">${U.escapeHtml(workspaceSummary(preset))}</div>
        </div>
        <div class="ws-actions">
          <button class="btn mini" data-action="ws-load">载入</button>
          <button class="icon-btn sm" data-action="ws-delete" title="删除这个预设" aria-label="删除预设">${icon('trash', 13)}</button>
        </div>
      </div>`).join('');

    return `<div class="pop-head">
        <div class="pop-title">工作区预设</div>
        <div class="pop-sub">${list.length ? `${list.length} 个` : '布局 + 媒体'}</div>
      </div>
      <div class="ws-save">
        <input class="text-input" data-role="wsName" maxlength="40" placeholder="预设名称，如 新闻与背景" spellcheck="false" autocomplete="off">
        <button class="btn mini" data-action="ws-save">${icon('check', 13)} 保存当前</button>
      </div>
      <div class="ws-tip">记录当前布局，以及每个窗口的视频 / 图片 / 幻灯片目录、音量、循环与幻灯片速度。同名保存会覆盖旧预设。</div>
      <div class="ws-list">${items || '<div class="ws-empty">还没有预设。输入名称后点击“保存当前”。</div>'}</div>`;
  }

  function updateWorkspaceButton() {
    const btn = $('workspacePresetBtn');
    if (!btn) return;
    const count = app.state.workspacePresets.length;
    btn.innerHTML = `${icon('layers', 15)}<span class="ws-label">工作区</span>${count ? `<span class="ws-count">${count}</span>` : ''}`;
    btn.title = count
      ? `工作区预设（${count} 个）：保存 / 载入布局与媒体`
      : '工作区预设：保存 / 载入布局与媒体';
  }

  function saveWorkspaceFromPopover(pop, anchor) {
    const input = pop.querySelector('[data-role="wsName"]');
    const typed = input ? input.value.trim().slice(0, 40) : '';
    const name = typed || `工作区 ${app.state.workspacePresets.length + 1}`;
    const snapshot = captureWorkspacePreset(name);
    const existingIndex = app.state.workspacePresets.findIndex((item) => item.name === name);

    if (existingIndex >= 0) {
      snapshot.id = app.state.workspacePresets[existingIndex].id;
      app.state.workspacePresets.splice(existingIndex, 1, snapshot);
      toast(`已更新工作区「${name}」`, 'info');
    } else {
      app.state.workspacePresets.unshift(snapshot);
      if (app.state.workspacePresets.length > 30) {
        app.state.workspacePresets.length = 30;
      }
      toast(`已保存工作区「${name}」`, 'info');
    }

    saveSoon();
    updateWorkspaceButton();
    showWorkspacePopover(anchor);
  }

  async function loadWorkspacePreset(preset) {
    closePopover();
    const cells = presetCells(presetById(preset.layout));
    applyLayout(preset.layout, { silent: true });

    app.state.panes.forEach((paneState, index) => {
      const pane = app.panes[index];
      pane.clear();
      overwritePaneState(paneState, sanitizePaneState(index < cells.length ? preset.panes[index] : null));
      pane.syncUI();
      pane.applyVolume();
    });

    app.state.masterVolume = preset.masterVolume;
    app.state.masterMuted = preset.masterMuted;
    applyMasterVolume();
    setGlobalSeconds(preset.slideSeconds, { apply: false });
    setActive(0, { silent: true });

    try {
      await Promise.all(app.panes.slice(0, cells.length).map((pane) => pane.restore({ autoplay: true })));
      toast(`已载入工作区「${preset.name}」`, 'info');
    } catch (error) {
      toast(`载入工作区失败：${error.message || error}`, 'error');
    }

    refreshMaster();
    updateStatus();
    saveSoon();
  }

  function showWorkspacePopover(anchor) {
    const pop = openPopover(workspaceHTML(), anchor, 'workspace-pop');
    const input = pop.querySelector('[data-role="wsName"]');
    if (input) {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveWorkspaceFromPopover(pop, anchor);
        }
      });
    }

    pop.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const item = btn.closest('[data-id]');
      const id = item ? item.dataset.id : '';

      if (action === 'ws-save') {
        saveWorkspaceFromPopover(pop, anchor);
      } else if (action === 'ws-load') {
        const preset = app.state.workspacePresets.find((entry) => entry.id === id);
        if (preset) loadWorkspacePreset(preset);
      } else if (action === 'ws-delete') {
        const index = app.state.workspacePresets.findIndex((entry) => entry.id === id);
        if (index < 0) return;
        const [removed] = app.state.workspacePresets.splice(index, 1);
        saveSoon();
        updateWorkspaceButton();
        toast(`已删除工作区「${removed.name}」`, 'info');
        showWorkspacePopover(anchor);
      }
    });
  }

  function helpHTML() {
    return `<div class="pop-head">
        <div class="pop-title">快捷键与用法</div>
        <div class="pop-sub">Multiview 多窗播放器</div>
      </div>
      <div class="help-list">
        <div><kbd>空格</kbd><span>所有窗口统一播放 / 暂停</span></div>
        <div><kbd>Ctrl</kbd><kbd>Tab</kbd><span>切换当前窗口</span></div>
        <div><kbd>←</kbd><kbd>→</kbd><span>当前窗口后退 / 前进 5 秒</span></div>
        <div><kbd>F</kbd><span>当前窗口全屏 / 退出</span></div>
        <div><kbd>M</kbd><span>总音量静音</span></div>
        <div><kbd>Del</kbd><span>清空当前窗口</span></div>
        <div><kbd>Esc</kbd><span>关闭菜单 / 退出全屏</span></div>
      </div>
      <div class="help-note">
        左侧浏览文件夹，双击媒体载入当前窗口；也可以直接把文件或文件夹拖进任意窗口。
        每个窗口右上角设置里可以单独调整该窗口的音量、时长、循环与随机。
        顶部“工作区”可把当前布局与所有窗口的媒体存成预设，下次一键恢复。
      </div>
      <div class="help-note subtle">
        支持常见图片（JPG / PNG / GIF / WebP / AVIF / BMP / SVG）和视频（MP4 / WebM / MOV / OGV）。
        视频能否播放取决于系统内置解码器，H.264 MP4 兼容性最好。
      </div>`;
  }

  function toggleFullscreen(pane) {
    if (!pane) return;
    if (app._fullscreenPane === pane) {
      exitFullscreen();
      return;
    }
    if (app._fullscreenPane) app._fullscreenPane.el.classList.remove('fullscreen-pane');
    app._fullscreenPane = pane;
    pane.el.classList.add('fullscreen-pane');
    document.body.classList.add('pane-fs-mode');
    setActive(pane.index);
  }

  function exitFullscreen() {
    if (!app._fullscreenPane) return;
    app._fullscreenPane.el.classList.remove('fullscreen-pane');
    app._fullscreenPane = null;
    document.body.classList.remove('pane-fs-mode');
  }

  function bindToolbar() {
    $('playAllBtn').addEventListener('click', toggleAll);
    $('helpBtn').addEventListener('click', (event) => {
      openPopover(helpHTML(), event.currentTarget, 'help-pop');
    });
    $('workspacePresetBtn').addEventListener('click', (event) => {
      showWorkspacePopover(event.currentTarget);
    });

    $('masterSeek').addEventListener('pointerdown', () => {
      app._masterSeeking = true;
    });
    $('masterSeek').addEventListener('input', () => {
      app._masterSeeking = true;
      seekAll(Number($('masterSeek').value) / 1000);
    });
    $('masterSeek').addEventListener('change', () => {
      app._masterSeeking = false;
      refreshMaster();
      saveSoon();
    });
    $('masterSeek').addEventListener('pointerup', () => {
      app._masterSeeking = false;
      saveSoon();
    });

    $('masterVolume').addEventListener('input', () => {
      app.state.masterVolume = U.clamp(Number($('masterVolume').value) / 100, 0, 1);
      $('masterVolLabel').textContent = `${Math.round(app.state.masterVolume * 100)}%`;
      app.panes.forEach((pane) => pane.onMasterVolumeChanged());
      saveSoon();
    });

    $('masterMuteBtn').addEventListener('click', () => {
      app.state.masterMuted = !app.state.masterMuted;
      applyMasterVolume();
      saveSoon();
    });

    $('slideSeconds').addEventListener('change', () => {
      setGlobalSeconds($('slideSeconds').value);
    });
    $('slideSeconds').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') event.currentTarget.blur();
    });

    const stepGlobal = (delta, shift) => {
      const current = Number($('slideSeconds').value) || app.state.slideSeconds;
      setGlobalSeconds(current + delta * (shift ? 10 : 1));
    };
    $('slideMinus').addEventListener('click', (event) => stepGlobal(-0.1, event.shiftKey));
    $('slidePlus').addEventListener('click', (event) => stepGlobal(0.1, event.shiftKey));
    $('slideMinus').title = '减少 0.1 秒（Shift 为 1 秒）';
    $('slidePlus').title = '增加 0.1 秒（Shift 为 1 秒）';

    const toggleSidebar = () => {
      app.state.sidebarCollapsed = !app.state.sidebarCollapsed;
      document.getElementById('app').classList.toggle('sidebar-collapsed', app.state.sidebarCollapsed);
      saveSoon();
    };
    $('collapseBtn').addEventListener('click', toggleSidebar);
    $('expandBtn').addEventListener('click', toggleSidebar);
  }

  function bindKeyboard() {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (app._popover) {
          closePopover();
          return;
        }
        exitFullscreen();
        return;
      }
      const target = event.target;
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      if (event.code === 'Space' && !inField) {
        event.preventDefault();
        toggleAll();
        return;
      }
      if (event.key === 'Tab' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        cyclePane(event.shiftKey ? -1 : 1);
        return;
      }
      if (inField) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        seekReference(5);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seekReference(-5);
      } else if (event.key.toLowerCase() === 'f') {
        toggleFullscreen(activePane());
      } else if (event.key.toLowerCase() === 'm') {
        app.state.masterMuted = !app.state.masterMuted;
        applyMasterVolume();
        saveSoon();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        activePane().clear();
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (!app._popover) return;
      if (app._popover.contains(event.target)) return;
      if (app._popoverAnchor && app._popoverAnchor.contains(event.target)) return;
      closePopover();
    }, true);
  }

  app.setActive = setActive;
  app.toast = toast;
  app.saveSoon = saveSoon;
  app.paneChanged = paneChanged;
  app.refreshMaster = refreshMaster;
  app.showPaneSettings = showPaneSettings;
  app.toggleFullscreen = toggleFullscreen;
  app.openFileInPane = (path, kind, paneIndex) => {
    const count = presetCells(presetById(app.state.layout)).length;
    const index = Number.isFinite(paneIndex) ? U.clamp(paneIndex, 0, count - 1) : app.state.activePane;
    const pane = app.panes[index];
    if (!pane) return;
    pane.setMedia(path, kind, { autoplay: true });
    setActive(index);
  };
  app.startSlideshowInPane = (folder, paneIndex, options = {}) => {
    const count = presetCells(presetById(app.state.layout)).length;
    const index = Number.isFinite(paneIndex) ? U.clamp(paneIndex, 0, count - 1) : app.state.activePane;
    const pane = app.panes[index];
    if (!pane) return;
    pane.startSlideshow(folder, {
      autoplay: true,
      seconds: app.state.slideSeconds,
      ...options
    });
    setActive(index);
  };
  app.assignFiles = async (paths, startIndex) => {
    const count = presetCells(presetById(app.state.layout)).length;
    let index = Number.isFinite(startIndex) ? U.clamp(startIndex, 0, count - 1) : app.state.activePane;
    let assigned = 0;
    for (const filePath of paths) {
      let kind = U.kindFromExt(filePath);
      let isDir = false;
      if (!kind) {
        try {
          const stat = await api.stat(filePath);
          isDir = stat.isDir;
        } catch {
          /* ignore */
        }
      }
      if (!kind && !isDir) continue;
      const pane = app.panes[index % count];
      if (isDir) {
        await pane.startSlideshow(filePath, { autoplay: true, seconds: app.state.slideSeconds });
      } else {
        await pane.setMedia(filePath, kind, { autoplay: true });
      }
      index += 1;
      assigned += 1;
    }
    if (assigned) {
      setActive((Number.isFinite(startIndex) ? startIndex : app.state.activePane) % count);
      toast(`已载入 ${assigned} 个媒体`, 'info');
    }
    return assigned;
  };
  app.onBrowserNavigate = (cwd) => {
    app.state.browserCwd = cwd;
    saveSoon();
  };

  async function init() {
    if (!api) {
      document.body.innerHTML = `<div class="fatal">
        <h1>无法连接本地文件系统</h1>
        <p>请通过 Electron 启动本应用：在项目目录运行 <code>npm start</code>。</p>
      </div>`;
      return;
    }

    hydrateStaticIcons();

    try {
      const saved = await api.loadState();
      app.state = mergeSavedState(saved);
    } catch (error) {
      console.warn('读取上次状态失败', error);
    }
    updateWorkspaceButton();

    buildPresets();
    app.panes = Array.from({ length: 9 }, (_, index) => new window.MV.MediaPane(app, index));
    app.browser = new window.MV.FileBrowser(app, api);

    bindToolbar();
    bindKeyboard();

    document.getElementById('app').classList.toggle('sidebar-collapsed', app.state.sidebarCollapsed);
    $('masterVolume').value = String(Math.round(app.state.masterVolume * 100));
    $('masterVolLabel').textContent = `${Math.round(app.state.masterVolume * 100)}%`;
    $('slideSeconds').value = app.state.slideSeconds.toFixed(1);
    applyMasterVolume();

    applyLayout(app.state.layout, { silent: true });
    setActive(app.state.activePane, { silent: true });
    refreshMaster();
    updateStatus();

    app.ready = true;

    app.browser.init();
    Promise.all(app.panes.map((pane) => pane.restore())).catch((error) => {
      console.error('恢复窗口失败', error);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
