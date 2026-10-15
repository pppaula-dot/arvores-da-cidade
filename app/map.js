/* Árvores Urbanas — map.js
   Mapa simples (arrastar, pinça, toque duplo, botões + e −) com fundo do OpenStreetMap.
   Funciona sem internet: o fundo não carrega, mas os pontos continuam aparecendo. */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const MIN_Z = 3, MAX_Z = 19;

  const worldPx = (z) => Math.pow(2, z) * 256;
  const lonToX = (lon, z) => ((lon + 180) / 360) * worldPx(z);
  const latToY = (lat, z) => {
    const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldPx(z);
  };
  const xToLon = (x, z) => (x / worldPx(z)) * 360 - 180;
  const yToLat = (y, z) => {
    const n = Math.PI - (2 * Math.PI * y) / worldPx(z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  };

  class SimpleMap {
    constructor(el, opts) {
      opts = opts || {};
      this.el = el;
      this.center = { lat: opts.lat != null ? opts.lat : -15.78, lng: opts.lng != null ? opts.lng : -47.93 };
      this.zoom = opts.zoom || 5;
      this.markers = [];
      this.me = null;
      this.onMarkerClick = opts.onMarkerClick || null;
      this.tiles = new Map();
      this.errCount = 0; this.okCount = 0;
      this.pointers = new Map();
      this.moved = false;
      this._raf = 0;

      el.classList.add('smap');
      el.innerHTML = '<div class="sm-tiles"></div><div class="sm-marks"></div>' +
        (opts.crosshair ? '<div class="sm-cross" aria-hidden="true"></div>' : '') +
        '<div class="sm-ctl"><button type="button" data-z="1" aria-label="Aproximar">+</button><button type="button" data-z="-1" aria-label="Afastar">−</button></div>' +
        '<div class="sm-attr">© OpenStreetMap</div><div class="sm-off" hidden>Sem internet: o fundo do mapa não carrega, mas seus pontos aparecem.</div>';
      this.tilesEl = el.querySelector('.sm-tiles');
      this.marksEl = el.querySelector('.sm-marks');
      this.offEl = el.querySelector('.sm-off');

      el.querySelector('.sm-ctl').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        this.zoomBy(parseInt(b.dataset.z, 10));
      });
      el.addEventListener('pointerdown', (e) => this._down(e));
      el.addEventListener('pointermove', (e) => this._move(e));
      el.addEventListener('pointerup', (e) => this._up(e));
      el.addEventListener('pointercancel', (e) => this._up(e));
      el.addEventListener('dblclick', (e) => { if (!e.target.closest('.sm-ctl,.sm-mk')) this.zoomBy(1, e.clientX, e.clientY); });
      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        const now = Date.now();
        if (now - (this._wheelAt || 0) < 250) return;
        this._wheelAt = now;
        this.zoomBy(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
      }, { passive: false });
      this.ro = root.ResizeObserver ? new ResizeObserver(() => this.render()) : null;
      if (this.ro) this.ro.observe(el);
      this.render();
    }

    size() { const r = this.el.getBoundingClientRect(); return { w: r.width || 300, h: r.height || 300, left: r.left, top: r.top }; }

    // ----- gestos -----
    _down(e) {
      if (e.target.closest('.sm-ctl')) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.moved = false;
      if (this.pointers.size === 2) this._startPinch();
    }
    _move(e) {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (this.pointers.size === 1) {
        if (!this.moved && Math.hypot(dx, dy) < 5) return;
        if (!this.moved) { this.moved = true; try { this.el.setPointerCapture(e.pointerId); } catch (_) { /* ok */ } }
        p.x = e.clientX; p.y = e.clientY;
        const cx = lonToX(this.center.lng, this.zoom) - dx, cy = latToY(this.center.lat, this.zoom) - dy;
        this.center = { lat: yToLat(cy, this.zoom), lng: xToLon(cx, this.zoom) };
        this._schedule();
      } else if (this.pointers.size === 2 && this.pinch) {
        p.x = e.clientX; p.y = e.clientY;
        this.moved = true;
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const s = Math.max(0.3, Math.min(6, d / this.pinch.d0));
        this.pinch.s = s;
        const t = 'translate(' + (this.pinch.mx - this.pinch.mx * s) + 'px,' + (this.pinch.my - this.pinch.my * s) + 'px) scale(' + s + ')';
        this.tilesEl.style.transform = t; this.marksEl.style.transform = t;
        this.tilesEl.style.transformOrigin = this.marksEl.style.transformOrigin = '0 0';
      }
    }
    _up(e) {
      const had = this.pointers.has(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (!had) return;
      if (this.pinch && this.pointers.size < 2) this._endPinch();
    }
    _startPinch() {
      const [a, b] = [...this.pointers.values()];
      const sz = this.size();
      const mx = (a.x + b.x) / 2 - sz.left, my = (a.y + b.y) / 2 - sz.top;
      this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: 1, mx, my, geo: this.pointToGeo(mx, my) };
    }
    _endPinch() {
      const p = this.pinch; this.pinch = null;
      this.tilesEl.style.transform = this.marksEl.style.transform = '';
      if (!p) return;
      const dz = Math.round(Math.log2(p.s));
      if (dz) this._setZoomKeeping(Math.max(MIN_Z, Math.min(MAX_Z, this.zoom + dz)), p.geo, p.mx, p.my);
      else this.render();
      this.pointers.clear();
    }

    pointToGeo(px, py) {
      const sz = this.size();
      const x = lonToX(this.center.lng, this.zoom) - sz.w / 2 + px, y = latToY(this.center.lat, this.zoom) - sz.h / 2 + py;
      return { lat: yToLat(y, this.zoom), lng: xToLon(x, this.zoom) };
    }
    _setZoomKeeping(z, geo, px, py) {
      const sz = this.size();
      this.zoom = z;
      const cx = lonToX(geo.lng, z) - (px - sz.w / 2), cy = latToY(geo.lat, z) - (py - sz.h / 2);
      this.center = { lat: yToLat(cy, z), lng: xToLon(cx, z) };
      this.render();
    }
    zoomBy(dz, clientX, clientY) {
      const z = Math.max(MIN_Z, Math.min(MAX_Z, this.zoom + dz));
      if (z === this.zoom) return;
      const sz = this.size();
      const px = clientX != null ? clientX - sz.left : sz.w / 2, py = clientY != null ? clientY - sz.top : sz.h / 2;
      this._setZoomKeeping(z, this.pointToGeo(px, py), px, py);
    }

    // ----- API -----
    getCenter() { return { lat: this.center.lat, lng: this.center.lng }; }
    setView(lat, lng, zoom) { this.center = { lat, lng }; if (zoom) this.zoom = Math.max(MIN_Z, Math.min(MAX_Z, zoom)); this.render(); }
    setMe(lat, lng) { this.me = lat == null ? null : { lat, lng }; this.render(); }
    setMarkers(list) { this.markers = list || []; this.marksEl.innerHTML = ''; this._mk = new Map(); this.render(); }
    fitBounds(points) {
      const pts = (points || []).filter((p) => AC.geo.validCoord(p.lat, p.lng));
      if (!pts.length) return;
      const sz = this.size();
      let lat0 = Math.min(...pts.map((p) => p.lat)), lat1 = Math.max(...pts.map((p) => p.lat));
      let lng0 = Math.min(...pts.map((p) => p.lng)), lng1 = Math.max(...pts.map((p) => p.lng));
      let z = 17;
      for (; z > MIN_Z; z--) {
        const w = Math.abs(lonToX(lng1, z) - lonToX(lng0, z)), h = Math.abs(latToY(lat0, z) - latToY(lat1, z));
        if (w <= sz.w - 80 && h <= sz.h - 80) break;
      }
      const cx = (lonToX(lng0, z) + lonToX(lng1, z)) / 2, cy = (latToY(lat0, z) + latToY(lat1, z)) / 2;
      this.zoom = z; this.center = { lat: yToLat(cy, z), lng: xToLon(cx, z) };
      this.render();
    }
    destroy() { if (this.ro) this.ro.disconnect(); cancelAnimationFrame(this._raf); this.el.innerHTML = ''; }

    _schedule() { if (this._raf) return; this._raf = requestAnimationFrame(() => { this._raf = 0; this.render(); }); }

    render() {
      const sz = this.size(), z = this.zoom;
      const tlx = lonToX(this.center.lng, z) - sz.w / 2, tly = latToY(this.center.lat, z) - sz.h / 2;
      const n = Math.pow(2, z);
      const x0 = Math.floor(tlx / 256), x1 = Math.floor((tlx + sz.w) / 256);
      const y0 = Math.max(0, Math.floor(tly / 256)), y1 = Math.min(n - 1, Math.floor((tly + sz.h) / 256));
      const need = new Set();
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const wx = ((x % n) + n) % n, key = z + '/' + wx + '/' + y + '@' + x;
        need.add(key);
        let img = this.tiles.get(key);
        if (!img) {
          img = new Image(); img.alt = ''; img.draggable = false; img.className = 'sm-tile';
          img.onload = () => { this.okCount++; img.classList.add('ok'); this.offEl.hidden = true; };
          img.onerror = () => { this.errCount++; if (this.errCount >= 3 && !this.okCount) this.offEl.hidden = false; };
          img.src = TILE_URL.replace('{z}', z).replace('{x}', wx).replace('{y}', y);
          this.tilesEl.appendChild(img);
          this.tiles.set(key, img);
        }
        img.style.transform = 'translate3d(' + Math.round(x * 256 - tlx) + 'px,' + Math.round(y * 256 - tly) + 'px,0)';
      }
      for (const [k, img] of this.tiles) if (!need.has(k)) { img.remove(); this.tiles.delete(k); }

      // marcadores
      if (!this._mk) this._mk = new Map();
      const live = new Set();
      this.markers.forEach((m, i) => {
        const id = m.id != null ? m.id : i;
        live.add(id);
        let d = this._mk.get(id);
        if (!d) {
          d = document.createElement('button');
          d.type = 'button'; d.className = 'sm-mk' + (m.fav ? ' fav' : '') + (m.unknown ? ' unk' : '');
          d.setAttribute('aria-label', m.label || 'Árvore');
          d.addEventListener('click', (ev) => { ev.stopPropagation(); if (this.moved) return; if (this.onMarkerClick) this.onMarkerClick(m); });
          this.marksEl.appendChild(d); this._mk.set(id, d);
        }
        const px = lonToX(m.lng, z) - tlx, py = latToY(m.lat, z) - tly;
        const vis = px > -30 && px < sz.w + 30 && py > -30 && py < sz.h + 30;
        d.style.display = vis ? '' : 'none';
        if (vis) d.style.transform = 'translate3d(' + Math.round(px) + 'px,' + Math.round(py) + 'px,0)';
      });
      for (const [id, d] of this._mk) if (!live.has(id)) { d.remove(); this._mk.delete(id); }
      // minha posição
      let me = this.marksEl.querySelector('.sm-me');
      if (this.me) {
        if (!me) { me = document.createElement('div'); me.className = 'sm-me'; this.marksEl.appendChild(me); }
        me.style.transform = 'translate3d(' + Math.round(lonToX(this.me.lng, z) - tlx) + 'px,' + Math.round(latToY(this.me.lat, z) - tly) + 'px,0)';
      } else if (me) me.remove();
    }
  }

  AC.SimpleMap = SimpleMap;
  AC.mapMath = { lonToX, latToY, xToLon, yToLat };
})(typeof window !== 'undefined' ? window : globalThis);
