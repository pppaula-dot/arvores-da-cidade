/* Árvores Urbanas — stamp.js
   Carimbo nas fotos, no mesmo molde do app Ficha Campo – Acompanhamento:
   faixa escura translúcida na base, texto branco alinhado à direita, fonte sem negrito;
   linhas: data/hora, UTM (SIRGAS 2000) com precisão, latitude/longitude e local.
   A foto original nunca é alterada: o carimbo vai numa cópia. */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const G = () => AC.geo;

  const DEFAULT_OPTS = { on: true, dt: true, utm: true, ll: true, place: true };
  const MAX_STAMPED = 1600; // maior lado da foto carimbada
  const MAX_THUMB = 360;
  const FONT = 'Roboto, "Helvetica Neue", Arial, "Liberation Sans", sans-serif';

  async function getOpts() {
    const o = await AC.db.getMeta('stampOpts', null);
    return Object.assign({}, DEFAULT_OPTS, o || {});
  }
  const setOpts = (o) => AC.db.setMeta('stampOpts', o);

  function thousandsBR(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function utmText(lat, lng) {
    const u = G().toUTM(lat, lng);
    return u.zone + u.band + '  E ' + thousandsBR(u.e) + '  N ' + thousandsBR(u.n);
  }

  function placeText(t) {
    const city = t.city ? t.city + (t.state ? ' - ' + t.state : '') : '';
    return [t.street, t.neighborhood, city].filter(Boolean).join(', ');
  }

  // Monta as linhas do carimbo conforme as opções escolhidas
  function stampLines(opts, info) {
    const lines = []; // { text, size } — size: 'big' | 'mid' | 'small'
    if (!opts.on) return lines;
    const hasCoord = G().validCoord(info.lat, info.lng);
    const showDt = opts.dt, showUtm = opts.utm && hasCoord, showLl = opts.ll && hasCoord;
    const place = opts.place ? info.place || '' : '';
    if (showDt) lines.push({ text: G().fmtDate(info.takenAt) + '   ' + G().fmtTime(info.takenAt), size: 'big' });
    const acc = info.accuracy != null && isFinite(info.accuracy) ? '  (±' + Math.round(info.accuracy) + ' m)' : '';
    if (showUtm) lines.push({ text: 'UTM ' + utmText(info.lat, info.lng) + acc, size: showDt ? 'mid' : 'big' });
    if (showLl) lines.push({ text: G().fmtLatLon(info.lat, info.lng) + (!showUtm ? acc : ''), size: 'small' });
    if (place) lines.push({ text: place, size: 'mid' });
    else if (!hasCoord && (opts.utm || opts.ll || opts.place)) lines.push({ text: 'Localização indisponível', size: 'mid' });
    return lines;
  }

  // ---------- Imagens ----------
  async function loadImage(blob) {
    if (root.createImageBitmap) {
      try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { /* tenta o outro jeito */ }
      try { return await createImageBitmap(blob); } catch (e) { /* idem */ }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui abrir a imagem')); };
      img.src = url;
    });
  }
  const imgSize = (im) => ({ w: im.naturalWidth || im.width, h: im.naturalHeight || im.height });
  function canvasToBlob(c, q) {
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar imagem'))), 'image/jpeg', q));
  }
  function fitSize(w, h, max) {
    const k = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }

  function drawStamp(ctx, w, h, lines) {
    if (!lines.length) return;
    const base = Math.min(w, h);
    const big = Math.max(18, base * 0.034);
    const pad = big * 0.62;
    const sizes = { big, mid: big * 0.82, small: big * 0.72 };
    let contentH = 0;
    lines.forEach((l) => (contentH += sizes[l.size] * 1.3));
    const boxH = contentH + pad * 1.6;
    const top = Math.max(0, h - boxH);
    const fade = boxH * 0.55;
    const grad = ctx.createLinearGradient(0, Math.max(0, top - fade), 0, top);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.59)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, Math.max(0, top - fade), w, Math.min(fade, top));
    ctx.fillStyle = 'rgba(0,0,0,0.59)';
    ctx.fillRect(0, top, w, h - top);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.78)';
    ctx.shadowBlur = Math.max(2, big / 14);
    ctx.shadowOffsetY = Math.max(1, big / 30);
    let y = top + pad * 0.8;
    const maxText = w - pad * 2;
    lines.forEach((l) => {
      let size = sizes[l.size];
      ctx.font = size + 'px ' + FONT;
      const tw = ctx.measureText(l.text).width;
      if (tw > maxText) { size = Math.max(10, (size * maxText) / tw); ctx.font = size + 'px ' + FONT; }
      ctx.fillStyle = l.size === 'big' ? '#fff' : 'rgba(255,255,255,0.94)';
      y += size;
      ctx.fillText(l.text, w - pad, y - size * 0.2);
      y += sizes[l.size] * 1.3 - size;
    });
    ctx.shadowColor = 'transparent';
  }

  // Gera a foto carimbada (cópia reduzida) e a miniatura. `info`: { lat,lng,accuracy,takenAt,place }
  async function process(blob, info, opts) {
    opts = opts || (await getOpts());
    const im = await loadImage(blob);
    const { w: iw, h: ih } = imgSize(im);
    const { w, h } = fitSize(iw, ih, MAX_STAMPED);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, 0, 0, w, h);

    const t = fitSize(w, h, MAX_THUMB);
    const tc = document.createElement('canvas');
    tc.width = t.w; tc.height = t.h;
    tc.getContext('2d').drawImage(c, 0, 0, t.w, t.h);
    const thumb = await canvasToBlob(tc, 0.78);

    drawStamp(ctx, w, h, stampLines(opts, info));
    const stamped = await canvasToBlob(c, 0.86);
    if (im.close) im.close();
    return { stamped, thumb, w: iw, h: ih };
  }

  // Dados do carimbo de uma foto, a partir da árvore
  function infoFor(tree, photoMeta) {
    return {
      lat: tree.lat, lng: tree.lng, accuracy: tree.accuracy,
      takenAt: photoMeta.takenAt || Date.now(), place: placeText(tree),
    };
  }

  async function restampPhoto(tree, photoMeta, opts) {
    const b = await AC.db.getBlobs(photoMeta.id);
    if (!b || !b.orig) return false;
    const r = await process(b.orig, infoFor(tree, photoMeta), opts);
    await AC.db.setStamped(photoMeta.id, r.stamped, r.thumb);
    return true;
  }
  async function restampTree(tree, opts) {
    const photos = await AC.db.photosOfTree(tree.id);
    for (const p of photos) { try { await restampPhoto(tree, p, opts); } catch (e) { console.warn('restamp', e); } }
  }

  AC.stamp = { DEFAULT_OPTS, getOpts, setOpts, stampLines, placeText, utmText, thousandsBR, loadImage, process, infoFor, restampPhoto, restampTree, canvasToBlob };
})(typeof window !== 'undefined' ? window : globalThis);
