/* Árvores da Cidade — geo.js
   Coordenadas, UTM (SIRGAS 2000), distâncias, leitura de EXIF e geometria simples. */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});

  // ---------- UTM (elipsoide GRS80 = SIRGAS 2000; diferença para o WGS84 é submilimétrica) ----------
  const A = 6378137.0;
  const F = 1 / 298.257222101;
  const K0 = 0.9996;
  const E2 = F * (2 - F);
  const EP2 = E2 / (1 - E2);
  const BANDS = 'CDEFGHJKLMNPQRSTUVWX';

  function toUTM(lat, lon) {
    const zone = Math.floor((lon + 180) / 6) + 1;
    const lon0 = (zone - 1) * 6 - 180 + 3;
    const phi = (lat * Math.PI) / 180;
    const lam = ((lon - lon0) * Math.PI) / 180;
    const sin = Math.sin(phi), cos = Math.cos(phi), tan = Math.tan(phi);
    const N = A / Math.sqrt(1 - E2 * sin * sin);
    const T = tan * tan;
    const C = EP2 * cos * cos;
    const Aa = lam * cos;
    const e4 = E2 * E2, e6 = e4 * E2;
    const M =
      A *
      ((1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
        ((3 * E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
        ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
        ((35 * e6) / 3072) * Math.sin(6 * phi));
    const E =
      K0 * N * (Aa + ((1 - T + C) * Math.pow(Aa, 3)) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * EP2) * Math.pow(Aa, 5)) / 120) + 500000;
    let Nn =
      K0 * (M + N * tan * ((Aa * Aa) / 2 +
        ((5 - T + 9 * C + 4 * C * C) * Math.pow(Aa, 4)) / 24 +
        ((61 - 58 * T + T * T + 600 * C - 330 * EP2) * Math.pow(Aa, 6)) / 720));
    const south = lat < 0;
    if (south) Nn += 10000000;
    const bi = Math.max(0, Math.min(19, Math.floor((lat + 80) / 8)));
    return { zone, band: BANDS[bi], hemi: south ? 'S' : 'N', e: E, n: Nn };
  }

  function validCoord(lat, lon) {
    return typeof lat === 'number' && typeof lon === 'number' && isFinite(lat) && isFinite(lon) &&
      Math.abs(lat) <= 84 && Math.abs(lon) <= 180;
  }

  function fmtUTM(u) {
    if (!u) return '';
    return u.zone + u.band + '  E ' + Math.round(u.e) + '  N ' + Math.round(u.n);
  }
  function fmtLat(v) { return v.toFixed(6); }
  function fmtLatLon(lat, lon) { return fmtLat(lat) + ', ' + fmtLat(lon); }

  // Converte "-20,8467", "-20.8467" ou "20°50'48\"S" em número decimal
  function parseCoordNumber(s) {
    if (typeof s === 'number') return s;
    s = String(s || '').trim().toUpperCase();
    if (!s) return NaN;
    const dms = s.match(/^(-?\d+(?:[.,]\d+)?)\s*[°º\s]\s*(\d+(?:[.,]\d+)?)?\s*['′]?\s*(\d+(?:[.,]\d+)?)?\s*["″]?\s*([NSEWLO])?$/);
    if (dms && (dms[2] !== undefined || dms[4])) {
      let d = parseFloat(dms[1].replace(',', '.'));
      const m = dms[2] ? parseFloat(dms[2].replace(',', '.')) : 0;
      const sec = dms[3] ? parseFloat(dms[3].replace(',', '.')) : 0;
      let v = Math.abs(d) + m / 60 + sec / 3600;
      if (d < 0 || dms[4] === 'S' || dms[4] === 'W' || dms[4] === 'O') v = -v;
      return v;
    }
    return parseFloat(s.replace(',', '.'));
  }

  // ---------- Distâncias ----------
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371008.8;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // Projeção local simples (metros) em torno de um ponto — suficiente para áreas de cidade
  function projectLocal(points, lat0, lon0) {
    const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110574;
    return points.map((p) => [(p.lon - lon0) * kx, (p.lat - lat0) * ky]);
  }

  function convexHull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (pts.length < 3) return pts;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }
  function polygonArea(poly) {
    let s = 0;
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(s) / 2;
  }
  // Área aproximada (m²) do envoltório convexo dos pontos
  function hullAreaM2(points) {
    if (points.length < 3) return 0;
    const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lon0 = points.reduce((s, p) => s + p.lon, 0) / points.length;
    return polygonArea(convexHull(projectLocal(points, lat0, lon0)));
  }
  // Maior distância entre dois pontos (m) — usada como "extensão" aproximada de uma rua
  function spanM(points) {
    let best = 0;
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++)
        best = Math.max(best, haversine(points[i].lat, points[i].lon, points[j].lat, points[j].lon));
    return best;
  }

  // ---------- EXIF (JPEG) ----------
  function readExif(buf) {
    try {
      const v = new DataView(buf);
      if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return {};
      let off = 2;
      while (off + 4 < v.byteLength) {
        const marker = v.getUint16(off); off += 2;
        if (marker === 0xffda) break; // início dos dados da imagem
        const len = v.getUint16(off);
        if (marker === 0xffe1 && v.getUint32(off + 2) === 0x45786966) return parseTiff(v, off + 8);
        off += len;
      }
    } catch (e) { /* arquivo sem EXIF legível */ }
    return {};
  }

  function parseTiff(v, start) {
    const little = v.getUint16(start) === 0x4949;
    const g16 = (o) => v.getUint16(o, little);
    const g32 = (o) => v.getUint32(o, little);
    if (g16(start + 2) !== 42) return {};
    const readIFD = (ptr) => {
      const n = g16(ptr), tags = {};
      for (let i = 0; i < n && i < 500; i++) {
        const e = ptr + 2 + i * 12;
        tags[g16(e)] = { type: g16(e + 2), count: g32(e + 4), off: e + 8 };
      }
      return tags;
    };
    const ascii = (t) => {
      const o = t.count <= 4 ? t.off : start + g32(t.off);
      let s = '';
      for (let i = 0; i < t.count - 1; i++) s += String.fromCharCode(v.getUint8(o + i));
      return s;
    };
    const rationals = (t, n) => {
      const base = start + g32(t.off), out = [];
      for (let i = 0; i < n; i++) { const den = g32(base + i * 8 + 4); out.push(den ? g32(base + i * 8) / den : 0); }
      return out;
    };
    const ifd0 = readIFD(start + g32(start + 4));
    const out = {};
    if (ifd0[0x8769]) {
      const exif = readIFD(start + g32(ifd0[0x8769].off));
      const dt = exif[0x9003] || exif[0x9004] || ifd0[0x0132];
      if (dt) out.dateStr = ascii(dt);
    } else if (ifd0[0x0132]) out.dateStr = ascii(ifd0[0x0132]);
    if (out.dateStr) {
      const m = out.dateStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
      if (m) out.date = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
    }
    if (ifd0[0x8825]) {
      const gps = readIFD(start + g32(ifd0[0x8825].off));
      if (gps[1] && gps[2] && gps[3] && gps[4]) {
        const toDeg = (r) => r[0] + r[1] / 60 + r[2] / 3600;
        let lat = toDeg(rationals(gps[2], 3)), lon = toDeg(rationals(gps[4], 3));
        if (ascii(gps[1]).toUpperCase().startsWith('S')) lat = -lat;
        if (ascii(gps[3]).toUpperCase().startsWith('W')) lon = -lon;
        if (validCoord(lat, lon) && !(lat === 0 && lon === 0)) { out.lat = lat; out.lon = lon; }
      }
    }
    return out;
  }

  // ---------- Datas ----------
  const pad = (n) => String(n).padStart(2, '0');
  function fmtDate(ms) { const d = new Date(ms); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function fmtTime(ms) { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fmtDateTime(ms) { return fmtDate(ms) + ' ' + fmtTime(ms); }
  function isoDate(ms) { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function toLocalInput(ms) { const d = new Date(ms); return isoDate(ms) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  AC.geo = {
    toUTM, fmtUTM, fmtLat, fmtLatLon, validCoord, parseCoordNumber, haversine,
    hullAreaM2, spanM, readExif, fmtDate, fmtTime, fmtDateTime, isoDate, toLocalInput,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = AC.geo;
})(typeof window !== 'undefined' ? window : globalThis);
