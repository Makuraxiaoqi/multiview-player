(function () {
  'use strict';

  const { icon } = window.MV;
  const U = window.MV.util;

  class MediaPane {
    constructor(app, index) {
      this.app = app;
      this.index = index;
      this.state = app.state.panes[index];
      this.el = null;
      this.video = null;
      this.imgSingle = null;
      this.slideImgs = [];
      this._timer = null;
      this._loadToken = 0;
      this._slideFront = 0;
      this._hasShownSlide = false;
      this._seeking = false;
      this._visible = true;
      this._resumeVideo = false;
      this._resumeSlide = false;

      this.build();
      this.bind();
      this.el.dataset.fit = this.state.fit || 'contain';
      this.syncUI();
      this.applyVolume();
    }

    build() {
      const el = document.createElement('article');
      el.className = 'pane is-empty';
      el.dataset.index = String(this.index);
      el.dataset.mode = 'empty';
      el.innerHTML = `
        <div class="pane-media">
          <video class="video" playsinline preload="metadata"></video>
          <div class="slides">
            <img class="slide-img" alt="">
            <img class="slide-img" alt="">
          </div>
          <img class="single-img" alt="">
          <div class="empty-state">
            <div class="empty-index">${String(this.index + 1).padStart(2, '0')}</div>
            <div class="empty-icon">${icon('layers', 26)}</div>
            <div class="empty-title">窗口 ${this.index + 1}</div>
            <div class="empty-hint">从左侧双击媒体，或将文件拖到这里</div>
            <div class="empty-actions">
              <button class="btn mini" data-act="pick-file">选择文件</button>
              <button class="btn mini ghost" data-act="pick-folder">图片文件夹</button>
            </div>
          </div>
          <div class="pane-loading hidden"><span class="spinner"></span><span>正在读取文件夹…</span></div>
          <div class="pane-error hidden">
            <div class="err-icon">${icon('alert', 24)}</div>
            <div class="err-title">无法载入</div>
            <div class="err-msg"></div>
            <div class="err-actions">
              <button class="btn mini" data-act="pick-file">重新选择</button>
              <button class="btn mini ghost" data-act="pick-folder">选择文件夹</button>
            </div>
          </div>
        </div>

        <div class="pane-top">
          <div class="pane-heading">
            <span class="pane-badge"></span>
            <span class="pane-name">空闲窗口</span>
          </div>
          <div class="pane-tools">
            <button class="icon-btn sm" data-act="settings" title="窗口设置">${icon('sliders', 15)}</button>
            <button class="icon-btn sm" data-act="fullscreen" title="全屏（F）">${icon('expand', 15)}</button>
            <button class="icon-btn sm" data-act="close" title="清空窗口（Delete）">${icon('x', 15)}</button>
          </div>
        </div>

        <div class="pane-bottom">
          <button class="icon-btn sm pane-play" data-act="play" title="播放 / 暂停">${icon('play', 15)}</button>
          <div class="slide-nav">
            <button class="icon-btn sm" data-act="prev" title="上一张">${icon('chevronLeft', 15)}</button>
            <button class="icon-btn sm" data-act="next" title="下一张">${icon('chevronRight', 15)}</button>
            <button class="icon-btn sm pane-shuffle" data-act="shuffle" title="顺序播放">${icon('shuffle', 15)}</button>
          </div>
          <input class="range pane-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="窗口进度">
          <span class="pane-time mono">--:--</span>
          <div class="pane-vol">
            <button class="icon-btn sm" data-act="mute" title="静音此窗口">${icon('volume', 15)}</button>
            <input class="range pane-volume" type="range" min="0" max="100" value="80" step="1" aria-label="窗口音量">
          </div>
          <button class="fit-btn" data-act="fit" title="切换适应 / 铺满">适应</button>
        </div>
        <div class="pane-progress-line"><span></span></div>
      `;

      this.el = el;
      this.video = el.querySelector('.video');
      this.imgSingle = el.querySelector('.single-img');
      this.slideImgs = [...el.querySelectorAll('.slide-img')];
      this.shuffleBtn = el.querySelector('.pane-shuffle');
      this.badgeEl = el.querySelector('.pane-badge');
      this.nameEl = el.querySelector('.pane-name');
      this.playBtn = el.querySelector('.pane-play');
      this.seekInput = el.querySelector('.pane-seek');
      this.timeEl = el.querySelector('.pane-time');
      this.volInput = el.querySelector('.pane-volume');
      this.muteBtn = el.querySelector('[data-act="mute"]');
      this.fitBtn = el.querySelector('.fit-btn');
      this.progressFill = el.querySelector('.pane-progress-line span');
      this.loadingEl = el.querySelector('.pane-loading');
      this.errorEl = el.querySelector('.pane-error');
      this.errorMsg = el.querySelector('.err-msg');
    }

    bind() {
      const el = this.el;

      el.addEventListener('pointerdown', () => this.app.setActive(this.index));

      el.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-act]');
        if (!btn) return;
        event.stopPropagation();
        const act = btn.dataset.act;
        if (act === 'play') this.toggle();
        else if (act === 'prev') this.nextSlide(-1);
        else if (act === 'next') this.nextSlide(1);
        else if (act === 'shuffle') this.toggleShuffle();
        else if (act === 'mute') this.toggleMute();
        else if (act === 'fit') this.toggleFit();
        else if (act === 'settings') this.app.showPaneSettings(this, btn);
        else if (act === 'fullscreen') this.app.toggleFullscreen(this);
        else if (act === 'close') this.clear();
        else if (act === 'pick-file') this.pickFile();
        else if (act === 'pick-folder') this.pickFolder();
      });

      el.querySelector('.pane-media').addEventListener('dblclick', (event) => {
        if (event.target.closest('input')) return;
        this.app.toggleFullscreen(this);
      });

      this.seekInput.addEventListener('pointerdown', () => {
        this._seeking = true;
      });
      this.seekInput.addEventListener('input', () => {
        this._seeking = true;
        this.seekToUiValue(Number(this.seekInput.value));
      });
      this.seekInput.addEventListener('change', () => {
        this._seeking = false;
        this.app.saveSoon();
      });
      this.seekInput.addEventListener('pointerup', () => {
        this._seeking = false;
      });

      this.volInput.addEventListener('input', () => {
        this.state.volume = U.clamp(Number(this.volInput.value) / 100, 0, 1);
        this.applyVolume();
        this.syncVolumeUI();
        this.app.saveSoon();
      });

      const v = this.video;
      v.addEventListener('timeupdate', () => {
        this.updatePlaybackUI();
        this.app.refreshMaster();
      });
      v.addEventListener('loadedmetadata', () => {
        this.updatePlaybackUI();
        this.app.refreshMaster();
      });
      v.addEventListener('durationchange', () => this.updatePlaybackUI());
      v.addEventListener('play', () => {
        this.el.classList.add('is-playing');
        this.updatePlaybackUI();
        this.app.refreshMaster();
      });
      v.addEventListener('pause', () => {
        this.el.classList.remove('is-playing');
        this.updatePlaybackUI();
        this.app.refreshMaster();
      });
      v.addEventListener('ended', () => {
        this.el.classList.remove('is-playing');
        this.updatePlaybackUI();
        this.app.refreshMaster();
      });
      v.addEventListener('error', () => {
        if (this.state.mode !== 'video' || !v.getAttribute('src')) return;
        this.showError('这个视频无法播放，可能是编码不受支持。');
      });

      ['dragenter', 'dragover'].forEach((type) => {
        el.addEventListener(type, (event) => {
          if (!event.dataTransfer) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          el.classList.add('drag-over');
        });
      });
      el.addEventListener('dragleave', (event) => {
        if (!el.contains(event.relatedTarget)) el.classList.remove('drag-over');
      });
      el.addEventListener('drop', (event) => {
        event.preventDefault();
        el.classList.remove('drag-over');
        this.handleDrop(event);
      });
    }

    syncUI() {
      const p = this.state;
      const mode = p.mode || 'empty';
      const ss = p.slideshow;

      this.el.dataset.mode = mode;
      this.el.dataset.fit = p.fit || 'contain';
      this.el.classList.toggle('is-empty', mode === 'empty');

      const badgeMap = {
        empty: ['eye', '空闲'],
        image: ['image', '图片'],
        video: ['film', '视频'],
        slideshow: ['presentation', '幻灯片']
      };
      const [badgeIcon, badgeText] = badgeMap[mode] || badgeMap.empty;
      this.badgeEl.innerHTML = `${icon(badgeIcon, 12)}<span>${badgeText}</span>`;

      let title = `窗口 ${this.index + 1}`;
      let titleAttr = '';
      if (mode === 'slideshow') {
        title = U.basename(ss.folder) || `窗口 ${this.index + 1}`;
        titleAttr = ss.folder || '';
      } else if (mode === 'image' || mode === 'video') {
        title = p.name || U.basename(p.path) || `窗口 ${this.index + 1}`;
        titleAttr = p.path || '';
      }
      this.nameEl.textContent = title;
      this.nameEl.title = titleAttr;

      this.fitBtn.textContent = p.fit === 'cover' ? '铺满' : '适应';
      this.volInput.value = String(Math.round(p.volume * 100));
      this.muteBtn.innerHTML = icon(p.muted ? 'mute' : 'volume', 15);
      this.muteBtn.classList.toggle('is-active', !!p.muted);

      this.shuffleBtn.classList.toggle('is-active', !!ss.shuffle);
      this.shuffleBtn.title = ss.shuffle ? '随机播放中，点击改为顺序' : '顺序播放，点击改为随机';

      if (mode === 'slideshow' && !this._hasShownSlide) {
        this.slideImgs.forEach((img) => img.classList.remove('active'));
      }
      if (mode !== 'slideshow') this._hasShownSlide = false;

      this.updatePlaybackUI();
      this.syncVolumeUI();
    }

    syncVolumeUI() {
      this.volInput.value = String(Math.round(this.state.volume * 100));
      this.muteBtn.innerHTML = icon(this.state.muted ? 'mute' : 'volume', 15);
      this.muteBtn.classList.toggle('is-active', !!this.state.muted);
    }

    updatePlaybackUI() {
      const p = this.state;
      const mode = p.mode;
      const playing = this.isPlaying();
      this.el.classList.toggle('is-playing', playing);
      if (mode === 'video' || mode === 'image' || mode === 'empty') {
        this.playBtn.innerHTML = icon(playing ? 'pause' : 'play', 15);
      } else if (mode === 'slideshow') {
        this.playBtn.innerHTML = icon(playing ? 'pause' : 'play', 15);
      }

      if (mode === 'video') {
        const duration = this.video.duration;
        const current = this.video.currentTime;
        const valid = Number.isFinite(duration) && duration > 0;
        if (!this._seeking && valid) {
          this.seekInput.value = String(Math.round((current / duration) * 1000));
        }
        this.seekInput.disabled = !valid;
        this.timeEl.textContent = valid ? `${U.fmtTime(current)} / ${U.fmtTime(duration)}` : '--:-- / --:--';
        this.timeEl.title = '';
        const pct = valid ? (current / duration) * 100 : 0;
        this.progressFill.style.width = `${U.clamp(pct, 0, 100)}%`;
      } else if (mode === 'slideshow') {
        const ss = p.slideshow;
        const n = ss.images.length;
        this.seekInput.max = String(Math.max(0, n - 1));
        if (!this._seeking) this.seekInput.value = String(n ? ss.pos : 0);
        this.seekInput.disabled = n < 2;
        this.timeEl.textContent = n ? `${ss.pos + 1} / ${n} 张` : '0 张';
        const currentPath = n ? ss.images[ss.order[ss.pos]] : '';
        this.timeEl.title = currentPath ? U.basename(currentPath) : '';
        const pct = n > 1 ? (ss.pos / (n - 1)) * 100 : 0;
        this.progressFill.style.width = `${U.clamp(pct, 0, 100)}%`;
      } else {
        this.seekInput.disabled = true;
        this.seekInput.value = '0';
        this.timeEl.textContent = '—';
        this.progressFill.style.width = '0%';
      }
    }

    isPlaying() {
      if (this.state.mode === 'video') return !this.video.paused && !this.video.ended;
      if (this.state.mode === 'slideshow') return !!this.state.slideshow.playing;
      return false;
    }

    hasMedia() {
      return this.state.mode !== 'empty';
    }

    applyVolume() {
      const p = this.state;
      const master = this.app.state;
      const effective = U.clamp(p.volume * master.masterVolume * (master.masterMuted ? 0 : 1), 0, 1);
      this.video.volume = effective;
      this.video.muted = !!p.muted;
    }

    onMasterVolumeChanged() {
      this.applyVolume();
      this.syncVolumeUI();
    }

    toggleMute() {
      if (this.state.mode !== 'video') return;
      this.state.muted = !this.state.muted;
      this.applyVolume();
      this.syncVolumeUI();
      this.app.saveSoon();
    }

    toggleFit() {
      this.state.fit = this.state.fit === 'cover' ? 'contain' : 'cover';
      this.el.dataset.fit = this.state.fit;
      this.fitBtn.textContent = this.state.fit === 'cover' ? '铺满' : '适应';
      this.app.saveSoon();
    }

    setFit(fit) {
      this.state.fit = fit === 'cover' ? 'cover' : 'contain';
      this.el.dataset.fit = this.state.fit;
      this.fitBtn.textContent = this.state.fit === 'cover' ? '铺满' : '适应';
      this.app.saveSoon();
    }

    async setMedia(path, kind, options = {}) {
      const type = kind || U.kindFromExt(path);
      if (!type) {
        this.app.toast('不支持的文件类型', 'error');
        return;
      }
      if (type === 'image') this.loadImage(path, options);
      else this.loadVideo(path, options);
      this.app.setActive(this.index);
    }

    loadImage(path, options = {}) {
      this._loadToken += 1;
      this.stopSlideshow();
      this.clearVideo();
      this.hideError();
      this.setLoading(false);

      const p = this.state;
      p.mode = 'image';
      p.path = path;
      p.name = U.basename(path);
      p.slideshow.playing = false;
      this._hasShownSlide = false;
      this.slideImgs.forEach((img) => img.classList.remove('active'));
      this.video.classList.remove('active');

      this.imgSingle.onerror = () => {
        if (this.state.mode === 'image' && this.state.path === path) {
          this.showError('这个图片无法显示。');
        }
      };
      this.imgSingle.onload = () => this.hideError();
      this.imgSingle.src = this.app.api.fileUrl(path);
      this.imgSingle.classList.add('active');

      this.syncUI();
      this.app.paneChanged();
    }

    loadVideo(path, options = {}) {
      this._loadToken += 1;
      this.stopSlideshow();
      this.clearSingle();
      this.clearSlideImages();
      this.hideError();
      this.setLoading(false);

      const p = this.state;
      p.mode = 'video';
      p.path = path;
      p.name = U.basename(path);
      p.slideshow.playing = false;
      this._hasShownSlide = false;

      const v = this.video;
      v.loop = !!p.loop;
      v.classList.add('active');
      v.src = this.app.api.fileUrl(path);
      v.load();
      this.applyVolume();

      this.syncUI();
      this.app.paneChanged();

      if (options.autoplay !== false) {
        v.play().catch(() => {
          /* 等待用户手势时静默失败 */
        });
      }
    }

    async startSlideshow(folder, options = {}) {
      if (!folder) return;
      const token = ++this._loadToken;
      const p = this.state;
      const ss = p.slideshow;

      this.stopSlideshow();
      this.clearVideo();
      this.clearSingle();
      this.slideImgs.forEach((img) => img.classList.remove('active'));
      this._hasShownSlide = false;

      p.mode = 'slideshow';
      p.path = folder;
      p.name = U.basename(folder);
      ss.folder = folder;
      ss.seconds = options.seconds != null ? U.clamp(U.round1(options.seconds), 0.1, 60) : ss.seconds;
      ss.loop = options.loop !== undefined ? !!options.loop : ss.loop;
      ss.shuffle = options.shuffle !== undefined ? !!options.shuffle : ss.shuffle;
      ss.recursive = options.recursive !== undefined ? !!options.recursive : ss.recursive;
      ss.images = [];
      ss.order = [];
      ss.pos = 0;
      ss.playing = false;

      this.hideError();
      this.setLoading(true);
      this.syncUI();
      this.app.paneChanged();

      try {
        const res = await this.app.api.listImages(folder, ss.recursive);
        if (token !== this._loadToken) return;
        this.setLoading(false);
        if (!res.images.length) {
          this.showError('这个文件夹中没有可播放的图片。');
          this.app.paneChanged();
          return;
        }
        ss.images = res.images.map((item) => item.path);
        const startPos = U.clamp(options.pos || 0, 0, ss.images.length - 1);
        this.rebuildOrder(startPos);
        this.showSlide(ss.pos, { immediate: true });
        ss.playing = options.autoplay !== false;
        if (ss.playing) this.schedule();
        this.syncUI();
        this.app.paneChanged();
        if (res.truncated) this.app.toast('图片数量很多，仅载入了前 4000 张', 'info');
      } catch (error) {
        if (token !== this._loadToken) return;
        this.setLoading(false);
        this.showError(`无法读取文件夹：${error.message || error}`);
        this.app.paneChanged();
      }
    }

    rebuildOrder(preferredPos) {
      const ss = this.state.slideshow;
      const n = ss.images.length;
      if (!n) {
        ss.order = [];
        ss.pos = 0;
        return;
      }
      const pos = U.clamp(preferredPos || 0, 0, n - 1);
      if (ss.shuffle) {
        const currentImageIndex = pos;
        const rest = U.shuffleArray([...Array(n).keys()].filter((i) => i !== currentImageIndex));
        ss.order = [currentImageIndex, ...rest];
        ss.pos = 0;
      } else {
        ss.order = Array.from({ length: n }, (_, i) => i);
        ss.pos = pos;
      }
    }

    showSlide(pos, options = {}) {
      const ss = this.state.slideshow;
      const n = ss.images.length;
      if (!n) return;
      ss.pos = ((pos % n) + n) % n;
      const imageIndex = ss.order[ss.pos] != null ? ss.order[ss.pos] : ss.pos;
      const url = this.app.api.fileUrl(ss.images[imageIndex]);
      if (!url) return;

      if (options.immediate || !this._hasShownSlide) {
        const front = this.slideImgs[this._slideFront];
        const back = this.slideImgs[1 - this._slideFront];
        back.classList.remove('active');
        front.classList.add('active');
        front.onload = () => this.hideError();
        front.onerror = () => this.showError('有一张图片无法显示，已跳过。');
        front.src = url;
        this._hasShownSlide = true;
      } else {
        const next = this.slideImgs[1 - this._slideFront];
        const prev = this.slideImgs[this._slideFront];
        let committed = false;
        const commit = () => {
          if (committed) return;
          committed = true;
          next.classList.add('active');
          prev.classList.remove('active');
          this._slideFront = 1 - this._slideFront;
          this.hideError();
          next.onload = null;
          next.onerror = null;
        };
        next.onload = commit;
        next.onerror = () => {
          next.onload = null;
          next.onerror = null;
          this.commitNextSlideAfterError();
        };
        next.src = url;
        if (next.complete && next.naturalWidth) commit();
      }

      this.updatePlaybackUI();
      this.app.refreshMaster();
    }

    commitNextSlideAfterError() {
      this.app.toast('有图片无法显示，已跳过', 'error');
    }

    schedule() {
      clearTimeout(this._timer);
      const ss = this.state.slideshow;
      if (!ss.playing || !ss.images.length) return;
      const delay = Math.max(100, ss.seconds * 1000);
      this._timer = setTimeout(() => this.advance(1, true), delay);
    }

    advance(delta, auto) {
      const ss = this.state.slideshow;
      const n = ss.images.length;
      if (!n) return;
      let next = ss.pos + delta;
      if (next >= n) {
        if (!ss.loop) {
          ss.playing = false;
          clearTimeout(this._timer);
          this.syncUI();
          this.app.refreshMaster();
          return;
        }
        if (ss.shuffle) {
          ss.order = U.shuffleArray([...Array(n).keys()]);
          ss.pos = 0;
          this.showSlide(0);
          this.schedule();
          return;
        }
        next = 0;
      } else if (next < 0) {
        if (!ss.loop) {
          next = 0;
        } else {
          next = n - 1;
        }
      }
      this.showSlide(next);
      if (ss.playing) this.schedule();
      if (!auto) this.syncUI();
    }

    nextSlide(delta) {
      if (this.state.mode !== 'slideshow') return;
      this.advance(delta, false);
      this.app.saveSoon();
      this.updatePlaybackUI();
    }

    play() {
      const p = this.state;
      if (p.mode === 'video') {
        this.video.play().catch(() => {});
      } else if (p.mode === 'slideshow') {
        if (!p.slideshow.images.length) return;
        p.slideshow.playing = true;
        this.schedule();
        this.syncUI();
        this.app.refreshMaster();
      } else if (p.mode === 'image') {
        this.pickFile();
      }
    }

    pause() {
      const p = this.state;
      if (p.mode === 'video') {
        this.video.pause();
      } else if (p.mode === 'slideshow') {
        p.slideshow.playing = false;
        clearTimeout(this._timer);
        this.syncUI();
        this.app.refreshMaster();
      }
    }

    toggle() {
      const p = this.state;
      if (!p.mode || p.mode === 'empty' || p.mode === 'image') {
        this.pickFile();
        return;
      }
      if (p.mode === 'slideshow') {
        if (p.slideshow.playing) this.pause();
        else this.play();
        this.app.saveSoon();
        return;
      }
      if (this.video.paused) this.video.play().catch(() => {});
      else this.video.pause();
    }

    stopSlideshow() {
      clearTimeout(this._timer);
      this._timer = null;
      if (this.state.mode === 'slideshow') this.state.slideshow.playing = false;
    }

    clearVideo() {
      const v = this.video;
      v.pause();
      v.classList.remove('active');
      v.removeAttribute('src');
      v.load();
    }

    clearSingle() {
      this.imgSingle.classList.remove('active');
      this.imgSingle.removeAttribute('src');
    }

    clearSlideImages() {
      this.slideImgs.forEach((img) => {
        img.classList.remove('active');
        img.removeAttribute('src');
        img.onload = null;
        img.onerror = null;
      });
      this._hasShownSlide = false;
      this._slideFront = 0;
    }

    clear() {
      this._loadToken += 1;
      this.stopSlideshow();
      this.clearVideo();
      this.clearSingle();
      this.clearSlideImages();
      this.hideError();
      this.setLoading(false);

      const p = this.state;
      p.mode = 'empty';
      p.path = null;
      p.name = '';
      p.slideshow.images = [];
      p.slideshow.order = [];
      p.slideshow.pos = 0;
      p.slideshow.playing = false;
      p.slideshow.folder = null;

      this.syncUI();
      this.app.paneChanged();
    }

    seekFraction(fraction) {
      const f = U.clamp(Number(fraction) || 0, 0, 1);
      const p = this.state;
      if (p.mode === 'video') {
        const d = this.video.duration;
        if (Number.isFinite(d) && d > 0) this.video.currentTime = f * d;
      } else if (p.mode === 'slideshow') {
        const n = p.slideshow.images.length;
        if (n > 1) {
          const pos = Math.round(f * (n - 1));
          this.showSlide(pos, { immediate: true });
          if (p.slideshow.playing) this.schedule();
        }
      }
      this.updatePlaybackUI();
      this.app.refreshMaster();
    }

    seekToUiValue(value) {
      const p = this.state;
      if (p.mode === 'video') {
        const d = this.video.duration;
        if (Number.isFinite(d) && d > 0) this.video.currentTime = (value / 1000) * d;
        this.updatePlaybackUI();
      } else if (p.mode === 'slideshow') {
        this.showSlide(value, { immediate: true });
        if (p.slideshow.playing) this.schedule();
      }
    }

    snapshot() {
      const p = this.state;
      if (p.mode === 'video') {
        const d = this.video.duration;
        const c = this.video.currentTime;
        const valid = Number.isFinite(d) && d > 0;
        return {
          kind: 'video',
          playing: !this.video.paused && !this.video.ended,
          current: valid ? c : 0,
          duration: valid ? d : 0,
          fraction: valid ? U.clamp(c / d, 0, 1) : 0
        };
      }
      if (p.mode === 'slideshow') {
        const n = p.slideshow.images.length;
        return {
          kind: 'slideshow',
          playing: !!p.slideshow.playing,
          current: n ? p.slideshow.pos + 1 : 0,
          duration: n,
          fraction: n > 1 ? p.slideshow.pos / (n - 1) : 0
        };
      }
      return { kind: null, playing: false, current: 0, duration: 0, fraction: 0 };
    }

    setSeconds(value) {
      const seconds = U.clamp(U.round1(Number(value) || 3), 0.1, 60);
      this.state.slideshow.seconds = seconds;
      if (this.state.mode === 'slideshow' && this.state.slideshow.playing) this.schedule();
      this.syncUI();
      this.app.paneChanged();
    }

    toggleShuffle() {
      if (this.state.mode !== 'slideshow') return;
      this.setShuffle(!this.state.slideshow.shuffle);
      this.app.toast(this.state.slideshow.shuffle ? '幻灯片：随机播放' : '幻灯片：顺序播放', 'info');
    }

    setShuffle(enabled) {
      const ss = this.state.slideshow;
      const wasPlaying = ss.playing;
      const n = ss.images.length;
      let current = 0;
      if (n) current = ss.order[ss.pos] != null ? ss.order[ss.pos] : ss.pos;
      ss.shuffle = !!enabled;
      if (!n) {
        this.app.saveSoon();
        return;
      }
      ss.order = Array.from({ length: n }, (_, i) => i);
      ss.pos = ss.shuffle ? 0 : current;
      if (ss.shuffle) {
        const rest = U.shuffleArray([...Array(n).keys()].filter((i) => i !== current));
        ss.order = [current, ...rest];
      }
      this.showSlide(ss.pos, { immediate: true });
      ss.playing = wasPlaying;
      if (wasPlaying) this.schedule();
      this.syncUI();
      this.app.paneChanged();
    }

    setSlideshowLoop(enabled) {
      this.state.slideshow.loop = !!enabled;
      this.app.saveSoon();
    }

    setVideoLoop(enabled) {
      this.state.loop = !!enabled;
      this.video.loop = !!enabled;
      this.app.saveSoon();
    }

    async setRecursive(enabled) {
      const ss = this.state.slideshow;
      if (ss.recursive === !!enabled) return;
      ss.recursive = !!enabled;
      this.app.saveSoon();
      if (this.state.mode === 'slideshow' && ss.folder) {
        await this.startSlideshow(ss.folder, {
          autoplay: true,
          seconds: ss.seconds,
          shuffle: ss.shuffle,
          loop: ss.loop,
          recursive: ss.recursive,
          pos: 0
        });
      }
    }

    setVisible(visible) {
      if (this._visible === visible) return;
      this._visible = visible;
      if (!visible) {
        if (this.state.mode === 'video' && !this.video.paused) {
          this._resumeVideo = true;
          this.video.pause();
        }
        if (this.state.mode === 'slideshow' && this.state.slideshow.playing) {
          this._resumeSlide = true;
          this.pause();
        }
      } else {
        if (this._resumeVideo) {
          this._resumeVideo = false;
          this.video.play().catch(() => {});
        }
        if (this._resumeSlide) {
          this._resumeSlide = false;
          this.play();
        }
      }
    }

    async restore(options = {}) {
      const autoplay = options.autoplay === true;
      const p = this.state;
      if (p.mode === 'video' && p.path) {
        const st = await this.app.api.stat(p.path);
        if (st.exists) this.loadVideo(p.path, { autoplay });
        else this.missingFile(p.path);
      } else if (p.mode === 'image' && p.path) {
        const st = await this.app.api.stat(p.path);
        if (st.exists) this.loadImage(p.path, { autoplay });
        else this.missingFile(p.path);
      } else if (p.mode === 'slideshow' && p.slideshow.folder) {
        const st = await this.app.api.stat(p.slideshow.folder);
        if (st.exists) {
          await this.startSlideshow(p.slideshow.folder, {
            autoplay,
            seconds: p.slideshow.seconds,
            shuffle: p.slideshow.shuffle,
            loop: p.slideshow.loop,
            recursive: p.slideshow.recursive,
            pos: p.slideshow.pos
          });
        } else {
          this.clear();
          this.app.toast('上次的幻灯片文件夹已不存在', 'error');
        }
      }
    }

    missingFile(path) {
      this.state.mode = 'empty';
      this.state.path = null;
      this.state.name = '';
      this.syncUI();
      this.app.toast(`文件不存在：${U.basename(path)}`, 'error');
    }

    setLoading(loading) {
      this.loadingEl.classList.toggle('hidden', !loading);
    }

    showError(message) {
      this.errorMsg.textContent = message || '未知错误';
      this.errorEl.classList.remove('hidden');
    }

    hideError() {
      this.errorEl.classList.add('hidden');
    }

    async pickFile() {
      const files = await this.app.api.chooseFiles();
      if (!files || !files.length) return;
      if (files.length === 1) {
        const kind = U.kindFromExt(files[0]);
        if (kind) await this.setMedia(files[0], kind);
        else this.app.toast('不支持的文件类型', 'error');
      } else {
        await this.app.assignFiles(files, this.index);
      }
    }

    async pickFolder() {
      const folder = await this.app.api.chooseFolder();
      if (!folder) return;
      await this.startSlideshow(folder, { autoplay: true });
      this.app.setActive(this.index);
    }

    async handleDrop(event) {
      const dt = event.dataTransfer;
      if (!dt) return;
      const internalPath = dt.getData('application/x-mv-path');
      if (internalPath) {
        const kind = dt.getData('application/x-mv-kind');
        if (kind === 'folder') await this.startSlideshow(internalPath, { autoplay: true });
        else await this.setMedia(internalPath, kind || U.kindFromExt(internalPath));
        this.app.setActive(this.index);
        return;
      }
      const files = [...(dt.files || [])];
      if (!files.length) return;
      let paths = files.map((file) => {
        try {
          return this.app.api.getPathForFile ? this.app.api.getPathForFile(file) : file.path;
        } catch {
          return file.path;
        }
      }).filter(Boolean);
      if (!paths.length) return;
      if (paths.length === 1) {
        const stat = await this.app.api.stat(paths[0]);
        if (stat.isDir) {
          await this.startSlideshow(paths[0], { autoplay: true });
        } else {
          const kind = U.kindFromExt(paths[0]);
          if (kind) await this.setMedia(paths[0], kind);
          else this.app.toast('不支持的文件类型', 'error');
        }
        this.app.setActive(this.index);
      } else {
        await this.app.assignFiles(paths, this.index);
      }
    }
  }

  window.MV.MediaPane = MediaPane;
})();
