(function () {
  'use strict';

  const { icon } = window.MV;
  const U = window.MV.util;

  class FileBrowser {
    constructor(app, api) {
      this.app = app;
      this.api = api;
      this.cwd = null;
      this.data = null;
      this.history = [];
      this.hIndex = -1;
      this.selected = null;
      this.filter = 'all';
      this.search = '';
      this.drives = [];
      this.quick = [];
      this.loading = false;
      this._token = 0;

      this.el = {
        quick: document.getElementById('quickPlaces'),
        pathBar: document.getElementById('pathBar'),
        fileList: document.getElementById('fileList'),
        search: document.getElementById('searchInput'),
        typeFilter: document.getElementById('typeFilter'),
        loadBtn: document.getElementById('loadSelected'),
        slideshowBtn: document.getElementById('folderSlideshow'),
        meta: document.getElementById('browserMeta')
      };

      this.bind();
    }

    bind() {
      document.querySelectorAll('[data-nav]').forEach((btn) => {
        btn.addEventListener('click', () => this.navigateByButton(btn.dataset.nav));
      });

      document.getElementById('openLocation').addEventListener('click', async () => {
        const folder = await this.api.chooseFolder();
        if (folder) this.navigate(folder);
      });

      this.el.search.addEventListener('input', () => {
        this.search = this.el.search.value.trim().toLowerCase();
        this.renderFiles();
      });

      this.el.typeFilter.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-filter]');
        if (!btn) return;
        this.filter = btn.dataset.filter;
        [...this.el.typeFilter.querySelectorAll('button')].forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        this.renderFiles();
      });

      this.el.loadBtn.addEventListener('click', () => this.loadSelected());
      this.el.slideshowBtn.addEventListener('click', () => this.openFolderSlideshow());

      this.el.fileList.addEventListener('click', (event) => {
        const row = event.target.closest('.file-item');
        if (!row) return;
        const entry = this.entryOf(row.dataset.path, row.dataset.kind);
        if (!entry) return;
        this.select(entry, row);
        if (event.target.closest('.row-action')) this.openEntry(entry);
      });

      this.el.fileList.addEventListener('dblclick', (event) => {
        const row = event.target.closest('.file-item');
        if (!row) return;
        const entry = this.entryOf(row.dataset.path, row.dataset.kind);
        if (entry) this.openEntry(entry);
      });

      this.el.fileList.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        const row = event.target.closest('.file-item');
        if (!row) return;
        const entry = this.entryOf(row.dataset.path, row.dataset.kind);
        if (entry) this.openEntry(entry);
      });

      this.el.fileList.addEventListener('dragstart', (event) => {
        const row = event.target.closest('.file-item');
        if (!row) return;
        const entry = this.entryOf(row.dataset.path, row.dataset.kind);
        if (!entry) return;
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('application/x-mv-path', entry.path);
        event.dataTransfer.setData('application/x-mv-kind', entry.isDir ? 'folder' : entry.kind);
        event.dataTransfer.setData('text/plain', entry.path);
        row.classList.add('dragging');
      });

      this.el.fileList.addEventListener('dragend', () => {
        this.el.fileList.querySelectorAll('.dragging').forEach((row) => row.classList.remove('dragging'));
      });

      this.el.quick.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-path]');
        if (btn) this.navigate(btn.dataset.path);
      });
    }

    async init() {
      try {
        const info = await this.api.drives();
        this.drives = info.drives || [];
        this.quick = info.places || [];
        this.renderQuick();
        const start = this.app.state.browserCwd || info.home;
        await this.navigate(start, { push: false });
      } catch (error) {
        this.app.toast(`文件系统不可用：${error.message || error}`, 'error');
      }
    }

    renderQuick() {
      const parts = [];
      if (this.quick.length) {
        parts.push('<div class="quick-title">快速访问</div>');
        for (const place of this.quick) {
          parts.push(this.quickButton(place.name, place.path, place.icon || 'folder'));
        }
      }
      parts.push('<div class="quick-title">此电脑</div>');
      for (const drive of this.drives) {
        parts.push(this.quickButton(drive.name, drive.path, 'grid'));
      }
      this.el.quick.innerHTML = parts.join('');
    }

    quickButton(label, path, iconName) {
      return `<button class="quick-item" data-path="${U.escapeHtml(path)}" title="${U.escapeHtml(path)}">
        <span class="quick-ic">${icon(iconName, 14)}</span>
        <span class="quick-label">${U.escapeHtml(label)}</span>
      </button>`;
    }

    entryOf(path, kind) {
      if (!this.data) return null;
      if (kind === 'folder') {
        const dir = this.data.dirs.find((d) => d.path === path);
        return dir || null;
      }
      return this.data.files.find((f) => f.path === path) || null;
    }

    async navigateByButton(action) {
      if (action === 'back') {
        if (this.hIndex > 0) {
          this.hIndex -= 1;
          await this.navigate(this.history[this.hIndex], { push: false });
        }
      } else if (action === 'forward') {
        if (this.hIndex < this.history.length - 1) {
          this.hIndex += 1;
          await this.navigate(this.history[this.hIndex], { push: false });
        }
      } else if (action === 'up') {
        if (this.data && this.data.parent) this.navigate(this.data.parent);
      } else if (action === 'refresh') {
        if (this.cwd) this.navigate(this.cwd, { push: false });
      }
      this.updateNavButtons();
    }

    async navigate(target, options = {}) {
      if (!target) return;
      const token = ++this._token;
      this.setLoading(true);
      try {
        const data = await this.api.listDir(target);
        if (token !== this._token) return;
        this.cwd = data.dir;
        this.data = data;
        this.selected = null;
        this.search = '';
        this.el.search.value = '';
        if (options.push !== false) {
          this.history = this.history.slice(0, this.hIndex + 1);
          if (this.history[this.history.length - 1] !== data.dir) {
            this.history.push(data.dir);
            this.hIndex = this.history.length - 1;
          }
        } else if (this.hIndex < 0) {
          this.history = [data.dir];
          this.hIndex = 0;
        }
        this.renderPath();
        this.renderFiles();
        this.updateNavButtons();
        this.updateSelectionUI();
        this.app.onBrowserNavigate(data.dir);
      } catch (error) {
        if (token === this._token) {
          this.app.toast(`无法打开文件夹：${error.message || error}`, 'error');
        }
      } finally {
        if (token === this._token) this.setLoading(false);
      }
    }

    buildCrumbs(full) {
      const norm = String(full).replace(/\//g, '\\');
      const parts = norm.split('\\').filter(Boolean);
      const crumbs = [];
      let acc = '';

      if (/^[A-Za-z]:$/.test(parts[0] || '')) {
        acc = `${parts[0]}\\`;
        crumbs.push({ label: parts[0], path: acc });
      } else if (norm.startsWith('\\\\')) {
        acc = '\\\\';
      }

      const startIndex = /^[A-Za-z]:$/.test(parts[0] || '') ? 1 : 0;
      for (let i = startIndex; i < parts.length; i += 1) {
        acc = acc.endsWith('\\') ? `${acc}${parts[i]}` : `${acc}\\${parts[i]}`;
        crumbs.push({ label: parts[i], path: acc });
      }

      if (!crumbs.length) crumbs.push({ label: norm || '此电脑', path: norm });
      return crumbs;
    }

    renderPath() {
      if (!this.cwd) return;
      const crumbs = this.buildCrumbs(this.cwd);
      this.el.pathBar.innerHTML = crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return `<button class="crumb${isLast ? ' current' : ''}" data-path="${U.escapeHtml(crumb.path)}" title="${U.escapeHtml(crumb.path)}">${U.escapeHtml(crumb.label)}</button>`;
      }).join('<span class="crumb-sep">›</span>');

      this.el.pathBar.querySelectorAll('.crumb').forEach((btn) => {
        btn.addEventListener('click', () => this.navigate(btn.dataset.path));
      });
      this.el.pathBar.scrollLeft = this.el.pathBar.scrollWidth;
    }

    visibleEntries() {
      if (!this.data) return { dirs: [], files: [] };
      const needle = this.search;
      const dirs = this.data.dirs.filter((dir) => !needle || dir.name.toLowerCase().includes(needle));
      const files = this.data.files.filter((file) => {
        if (this.filter === 'image' && file.kind !== 'image') return false;
        if (this.filter === 'video' && file.kind !== 'video') return false;
        if (needle && !file.name.toLowerCase().includes(needle)) return false;
        return true;
      });
      return { dirs, files };
    }

    renderFiles() {
      if (!this.data) {
        this.el.fileList.innerHTML = '<div class="list-empty">正在载入…</div>';
        return;
      }
      const { dirs, files } = this.visibleEntries();
      const rows = [];

      for (const dir of dirs) {
        rows.push(`<div class="file-item folder" draggable="true" tabindex="0" data-path="${U.escapeHtml(dir.path)}" data-kind="folder" title="${U.escapeHtml(dir.path)}">
          <div class="thumb folder-thumb">${icon('folder', 20)}</div>
          <div class="file-meta">
            <div class="fname">${U.escapeHtml(dir.name)}</div>
            <div class="fsub">文件夹</div>
          </div>
          <span class="row-talk">${icon('chevronRight', 14)}</span>
        </div>`);
      }

      for (const file of files) {
        const isImage = file.kind === 'image';
        const thumb = isImage
          ? `<img class="thumb-img" loading="lazy" decoding="async" src="${U.escapeHtml(this.api.fileUrl(file.path))}" alt="">`
          : `<div class="thumb video-thumb">${icon('film', 18)}<span class="thumb-play">${icon('play', 10)}</span></div>`;
        const sub = `${file.ext.replace('.', '').toUpperCase()} · ${U.fmtSize(file.size)}`;
        rows.push(`<div class="file-item kind-${file.kind}" draggable="true" tabindex="0" data-path="${U.escapeHtml(file.path)}" data-kind="${file.kind}" title="${U.escapeHtml(file.path)}">
          <div class="thumb">${thumb}</div>
          <div class="file-meta">
            <div class="fname">${U.escapeHtml(file.name)}</div>
            <div class="fsub">${U.escapeHtml(sub)}</div>
          </div>
          <button class="row-action" title="载入当前窗口">${icon('play', 11)}</button>
        </div>`);
      }

      if (!rows.length) {
        const hint = this.search || this.filter !== 'all'
          ? '没有符合筛选条件的媒体'
          : '此文件夹没有图片或视频';
        this.el.fileList.innerHTML = `<div class="list-empty">${icon('eye', 22)}<span>${hint}</span></div>`;
      } else {
        this.el.fileList.innerHTML = rows.join('');
        this.el.fileList.querySelectorAll('.thumb-img').forEach((img) => {
          img.addEventListener('error', () => {
            img.replaceWith(Object.assign(document.createElement('div'), {
              className: 'thumb broken-thumb',
              innerHTML: icon('image', 16)
            }));
          });
        });
      }

      this.el.fileList.scrollTop = 0;
      this.el.meta.textContent = `${dirs.length} 个文件夹 · ${files.length} 个媒体`;
      this.updateSelectionUI();
    }

    select(entry, row) {
      this.selected = entry;
      this.el.fileList.querySelectorAll('.file-item.selected').forEach((el) => el.classList.remove('selected'));
      if (row) row.classList.add('selected');
      this.updateSelectionUI();
    }

    updateSelectionUI() {
      const selected = this.selected;
      const loadBtn = this.el.loadBtn;
      if (selected) {
        loadBtn.disabled = false;
        loadBtn.textContent = selected.isDir ? '文件夹设为幻灯片' : (selected.kind === 'image' ? '图片载入当前窗口' : '视频载入当前窗口');
      } else {
        loadBtn.disabled = true;
        loadBtn.textContent = '载入到当前窗口';
      }
      const hasImages = this.data && this.data.imageCount > 0;
      this.el.slideshowBtn.disabled = !hasImages;
      this.el.slideshowBtn.title = hasImages ? `用 ${this.data.imageCount} 张图片创建幻灯片` : '当前文件夹没有图片';
    }

    openEntry(entry) {
      if (!entry) return;
      if (entry.isDir) {
        this.navigate(entry.path);
      } else {
        this.app.openFileInPane(entry.path, entry.kind);
      }
    }

    loadSelected() {
      if (!this.selected) return;
      if (this.selected.isDir) {
        this.app.startSlideshowInPane(this.selected.path);
      } else {
        this.app.openFileInPane(this.selected.path, this.selected.kind);
      }
    }

    openFolderSlideshow() {
      if (!this.cwd) return;
      this.app.startSlideshowInPane(this.cwd);
    }

    setLoading(loading) {
      this.loading = loading;
      this.el.fileList.classList.toggle('is-loading', loading);
      if (loading) {
        this.el.fileList.innerHTML = '<div class="list-loading"><span class="spinner"></span><span>读取目录…</span></div>';
      }
    }

    updateNavButtons() {
      const back = document.querySelector('[data-nav="back"]');
      const forward = document.querySelector('[data-nav="forward"]');
      const up = document.querySelector('[data-nav="up"]');
      if (back) back.disabled = this.hIndex <= 0;
      if (forward) forward.disabled = this.hIndex >= this.history.length - 1;
      if (up) up.disabled = !(this.data && this.data.parent);
    }
  }

  window.MV.FileBrowser = FileBrowser;
})();
