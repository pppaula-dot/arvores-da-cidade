/* Árvores Urbanas — export.js
   KMZ (Google Earth, com fotos), KML, planilha Excel (.xlsx) e CSV, pacote de fotos, cartão para compartilhar,
   backup e restauração. */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const G = () => AC.geo;

  const PHOTO_TYPES = [
    ['inteira', 'Árvore inteira'], ['folha', 'Folha'], ['flor', 'Flor'], ['fruto', 'Fruto'], ['tronco', 'Tronco / casca'], ['outra', 'Outra'],
  ];
  const photoTypeLabel = (k) => (PHOTO_TYPES.find((p) => p[0] === k) || [0, 'Foto'])[1];
  const ORIGIN_LABEL = { N: 'Nativa do Brasil', E: 'Exótica', C: 'Confirmar', '': 'Não informada' };
  const FRUIT_LABEL = { S: 'Sim', N: 'Não', '': 'Não informado' };
  const treeName = (t) => t.species || 'Árvore não identificada';
  const cityKey = (t) => (t.city ? t.city + (t.state ? ' - ' + t.state : '') : 'Local pendente');

  const xmlEsc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sem-nome';
  const safeFolder = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Sem nome';

  async function loadAll(treeFilter) {
    let trees = (await AC.db.allTrees()).filter((t) => !t.draft);
    if (treeFilter) trees = trees.filter(treeFilter);
    const photos = await AC.db.allPhotos();
    const by = new Map();
    photos.forEach((p) => { if (!by.has(p.treeId)) by.set(p.treeId, []); by.get(p.treeId).push(p); });
    by.forEach((arr) => arr.sort((a, b) => (a.takenAt || 0) - (b.takenAt || 0) || (a.order || 0) - (b.order || 0)));
    trees.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    return { trees, by };
  }

  function lastVisit(t) { return Math.max(...(t.visits || []).map((v) => v.date || 0), t.createdAt || 0); }

  function photoFile(t, p, idx, ext) {
    return G().isoDate(p.takenAt || Date.now()) + '_' + String(idx + 1).padStart(2, '0') + '_' + slug(photoTypeLabel(p.type)) + (ext || '.jpg');
  }
  function treeFolder(t) {
    return safeFolder(cityKey(t)) + '/' + safeFolder(t.neighborhood || 'Sem bairro') + '/' + (t.code || 'ARV') + '_' + slug(treeName(t));
  }

  // ---------- KML / KMZ ----------
  function describeTree(t, photoRefs) {
    const rows = [];
    const add = (k, v) => { if (v !== '' && v != null && v !== false) rows.push('<tr><td style="padding:2px 8px 2px 0;color:#666"><b>' + xmlEsc(k) + '</b></td><td>' + xmlEsc(v) + '</td></tr>'); };
    add('Código', t.code);
    if (t.scientific) add('Nome científico', t.scientific);
    add('Origem', ORIGIN_LABEL[t.origin || ''] + (t.originConfirm ? ' (confirmar)' : ''));
    add('Frutífera', FRUIT_LABEL[t.fruit || ''] + (t.fruitConfirm && t.fruit ? ' (confirmar)' : ''));
    if (t.medicinal) add('Medicinal', 'Sim');
    if (t.threatened) add('Ameaçada de extinção', 'Sim');
    add('Local', [t.street, t.neighborhood, cityKey(t)].filter(Boolean).join(', '));
    if (G().validCoord(t.lat, t.lng)) {
      add('Latitude / Longitude', G().fmtLatLon(t.lat, t.lng));
      add('UTM (SIRGAS 2000)', G().fmtUTM(G().toUTM(t.lat, t.lng)));
    }
    if (t.height) add('Altura', t.height + ' m');
    if (t.trunk) add('Diâmetro do tronco', t.trunk + ' cm');
    if (t.crown) add('Copa', t.crown + ' m');
    if (t.flowering) add('Flores', 'Sim' + (t.flowerColor ? ' (' + t.flowerColor + ')' : ''));
    if (t.fruiting) add('Frutos', 'Sim');
    add('Estado', t.health);
    add('Atenção e manejo', (t.risks || []).join('; '));
    add('Tipo de local', t.placeType);
    add('Observações', t.notes);
    add('Primeiro registro', G().fmtDateTime(t.createdAt));
    if ((t.visits || []).length > 1) add('Visitas', t.visits.length + ' (última em ' + G().fmtDate(lastVisit(t)) + ')');
    let html = '<table style="font-family:sans-serif;font-size:13px">' + rows.join('') + '</table>';
    if (photoRefs && photoRefs.length) {
      html += '<div style="margin-top:8px">' + photoRefs.map((r) =>
        '<div style="margin:6px 0"><img src="' + xmlEsc(r.path) + '" width="420"/><br/><small>' + xmlEsc(r.caption) + '</small></div>').join('') + '</div>';
    }
    return html.replace(/\]\]>/g, ']]&gt;');
  }

  function buildKML(trees, refsByTree, docName) {
    const groups = new Map();
    let skipped = 0;
    trees.forEach((t) => {
      if (!G().validCoord(t.lat, t.lng)) { skipped++; return; }
      const c = cityKey(t), b = t.neighborhood || 'Sem bairro';
      if (!groups.has(c)) groups.set(c, new Map());
      const bm = groups.get(c);
      if (!bm.has(b)) bm.set(b, []);
      bm.get(b).push(t);
    });
    let k = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>\n';
    k += '<name>' + xmlEsc(docName || 'Árvores Urbanas') + '</name>\n';
    k += '<description>Criado com Árvores Urbanas · @paulapmiranda</description>\n';
    k += '<Style id="arv"><IconStyle><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href></Icon></IconStyle><LabelStyle><scale>0.8</scale></LabelStyle></Style>\n';
    k += '<Style id="fav"><IconStyle><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-stars.png</href></Icon></IconStyle><LabelStyle><scale>0.8</scale></LabelStyle></Style>\n';
    [...groups.keys()].sort((a, b) => a.localeCompare(b)).forEach((city) => {
      k += '<Folder><name>' + xmlEsc(city) + '</name>\n';
      const bm = groups.get(city);
      [...bm.keys()].sort((a, b) => a.localeCompare(b)).forEach((bairro) => {
        k += '<Folder><name>' + xmlEsc(bairro) + '</name>\n';
        bm.get(bairro).forEach((t) => {
          const u = G().toUTM(t.lat, t.lng);
          k += '<Placemark><name>' + xmlEsc((t.code ? t.code + ' · ' : '') + treeName(t)) + '</name>';
          k += '<description><![CDATA[' + describeTree(t, refsByTree && refsByTree.get(t.id)) + ']]></description>';
          k += '<styleUrl>#' + (t.favorite ? 'fav' : 'arv') + '</styleUrl>';
          k += '<ExtendedData><Data name="codigo"><value>' + xmlEsc(t.code) + '</value></Data><Data name="especie"><value>' + xmlEsc(treeName(t)) + '</value></Data>' +
            '<Data name="utm"><value>' + xmlEsc(G().fmtUTM(u)) + '</value></Data></ExtendedData>';
          k += '<Point><coordinates>' + t.lng.toFixed(7) + ',' + t.lat.toFixed(7) + ',0</coordinates></Point></Placemark>\n';
        });
        k += '</Folder>\n';
      });
      k += '</Folder>\n';
    });
    k += '</Document></kml>\n';
    return { kml: k, skipped };
  }

  async function buildKMZ(trees, by, docName, onProgress) {
    const zip = new AC.zip.ZipWriter();
    const refs = new Map();
    let n = 0, total = 0;
    trees.forEach((t) => { if (G().validCoord(t.lat, t.lng)) total += (by.get(t.id) || []).length; });
    for (const t of trees) {
      if (!G().validCoord(t.lat, t.lng)) continue;
      const list = by.get(t.id) || [];
      const rr = [];
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const b = await AC.db.getBlobs(p.id);
        if (b && b.stamped) {
          const path = 'fotos/' + (t.code || 'ARV') + '_' + String(i + 1).padStart(2, '0') + '_' + slug(photoTypeLabel(p.type)) + '.jpg';
          await zip.addFile(path, b.stamped);
          rr.push({ path, caption: photoTypeLabel(p.type) + ' · ' + G().fmtDateTime(p.takenAt || t.createdAt) });
        }
        n++; if (onProgress) onProgress(n, total);
      }
      refs.set(t.id, rr);
    }
    const { kml, skipped } = buildKML(trees, refs, docName);
    await zip.addFile('doc.kml', kml);
    return { blob: zip.finish(), skipped };
  }

  // ---------- Planilha ----------
  const COLS = [
    ['Código', (t) => t.code, 's', 11], ['Cidade', (t) => t.city, 's', 24], ['UF', (t) => t.state, 's', 5], ['Bairro', (t) => t.neighborhood, 's', 22], ['Rua', (t) => t.street, 's', 28],
    ['Espécie (nome popular)', (t) => treeName(t), 's', 26], ['Nome científico', (t) => t.scientific, 's', 28], ['Identificada', (t) => (t.identified === false || !t.species ? 'Não' : 'Sim'), 's', 12],
    ['Origem', (t) => ORIGIN_LABEL[t.origin || ''] + (t.originConfirm ? ' (confirmar)' : ''), 's', 20], ['Frutífera', (t) => FRUIT_LABEL[t.fruit || ''], 's', 11],
    ['Medicinal', (t) => (t.medicinal ? 'Sim' : ''), 's', 10], ['Ameaçada', (t) => (t.threatened ? 'Sim' : ''), 's', 10],
    ['Altura (m)', (t) => num(t.height), 'n', 10], ['Diâmetro do tronco (cm)', (t) => num(t.trunk), 'n', 14], ['Copa (m)', (t) => num(t.crown), 'n', 10],
    ['Flores', (t) => (t.flowering ? 'Sim' : 'Não'), 's', 8], ['Cor da flor', (t) => t.flowerColor, 's', 12], ['Frutos', (t) => (t.fruiting ? 'Sim' : 'Não'), 's', 8],
    ['Estado', (t) => t.health, 's', 18], ['Atenção e manejo', (t) => (t.risks || []).join('; '), 's', 34], ['Tipo de local', (t) => t.placeType, 's', 18],
    ['Latitude', (t) => (G().validCoord(t.lat, t.lng) ? Math.round(t.lat * 1e7) / 1e7 : ''), 'n', 13], ['Longitude', (t) => (G().validCoord(t.lat, t.lng) ? Math.round(t.lng * 1e7) / 1e7 : ''), 'n', 13],
    ['UTM zona', (t) => (G().validCoord(t.lat, t.lng) ? (u(t).zone + u(t).band) : ''), 's', 10], ['UTM Leste (m)', (t) => (G().validCoord(t.lat, t.lng) ? Math.round(u(t).e) : ''), 'n', 13], ['UTM Norte (m)', (t) => (G().validCoord(t.lat, t.lng) ? Math.round(u(t).n) : ''), 'n', 13],
    ['Primeiro registro', (t) => G().fmtDateTime(t.createdAt), 's', 17], ['Última visita', (t) => G().fmtDateTime(lastVisit(t)), 's', 17], ['Nº de visitas', (t) => (t.visits || []).length, 'n', 10],
    ['Nº de fotos', (t, by) => (by.get(t.id) || []).length, 'n', 10], ['Favorita', (t) => (t.favorite ? 'Sim' : ''), 's', 9], ['Observações', (t) => t.notes, 's', 40],
  ];
  function num(v) { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : ''; }
  function u(t) { return G().toUTM(t.lat, t.lng); }

  function colName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  async function buildXLSX(trees, by) {
    const zip = new AC.zip.ZipWriter();
    let rows = '<row r="1">' + COLS.map((c, i) => '<c r="' + colName(i) + '1" t="inlineStr" s="1"><is><t>' + xmlEsc(c[0]) + '</t></is></c>').join('') + '</row>';
    trees.forEach((t, r) => {
      rows += '<row r="' + (r + 2) + '">';
      COLS.forEach((c, i) => {
        const v = c[1](t, by);
        const ref = colName(i) + (r + 2);
        if (v === '' || v == null) return;
        if (c[2] === 'n' && typeof v === 'number') rows += '<c r="' + ref + '"><v>' + v + '</v></c>';
        else rows += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>';
      });
      rows += '</row>';
    });
    const cols = COLS.map((c, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + c[3] + '" customWidth="1"/>').join('');
    const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<cols>' + cols + '</cols><sheetData>' + rows + '</sheetData><autoFilter ref="A1:' + colName(COLS.length - 1) + (trees.length + 1) + '"/></worksheet>';
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF3F6B3A"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    await zip.addFile('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
    await zip.addFile('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    await zip.addFile('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Árvores" sheetId="1" r:id="rId1"/></sheets></workbook>');
    await zip.addFile('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    await zip.addFile('xl/styles.xml', styles);
    await zip.addFile('xl/worksheets/sheet1.xml', sheet);
    const blob = zip.finish();
    return new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function buildCSV(trees, by) {
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const fmt = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : v);
    let out = COLS.map((c) => q(c[0])).join(';') + '\r\n';
    trees.forEach((t) => { out += COLS.map((c) => q(fmt(c[1](t, by)))).join(';') + '\r\n'; });
    return new Blob(['﻿' + out], { type: 'text/csv;charset=utf-8' });
  }

  // ---------- Pacote de fotos ----------
  async function buildPhotoPack(trees, by, includeOriginals, onProgress) {
    const zip = new AC.zip.ZipWriter();
    let n = 0, total = 0;
    trees.forEach((t) => (total += (by.get(t.id) || []).length));
    for (const t of trees) {
      const list = by.get(t.id) || [];
      const folder = treeFolder(t);
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const b = await AC.db.getBlobs(p.id);
        if (b) {
          if (b.stamped) await zip.addFile(folder + '/' + photoFile(t, p, i), b.stamped, p.takenAt);
          if (includeOriginals && b.orig) await zip.addFile(folder + '/originais/' + photoFile(t, p, i, extFor(b.orig)), b.orig, p.takenAt);
        }
        n++; if (onProgress) onProgress(n, total);
      }
    }
    return zip.finish();
  }
  const extFor = (blob) => (/png/.test(blob.type) ? '.png' : /webp/.test(blob.type) ? '.webp' : /hei[cf]/.test(blob.type) ? '.heic' : '.jpg');

  // ---------- Cartão para compartilhar ----------
  async function makeCard(tree) {
    const photos = (await AC.db.photosOfTree(tree.id)).sort((a, b) => (b.takenAt || 0) - (a.takenAt || 0));
    const pick = photos.find((p) => p.type === 'inteira') || photos[0];
    const W = 1080, H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#f4ecd8'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(80,110,130,0.18)'; x.lineWidth = 2;
    for (let y = 120; y < H; y += 54) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
    x.strokeStyle = 'rgba(190,70,55,0.45)'; x.beginPath(); x.moveTo(78, 0); x.lineTo(78, H); x.stroke();

    // foto (sem cortar, para o carimbo aparecer inteiro)
    const maxW = 880, maxH = 700;
    let pw = maxW, ph = 600, im = null;
    if (pick) {
      const b = await AC.db.getBlobs(pick.id);
      im = await AC.stamp.loadImage(b.stamped);
      const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
      const k = Math.min(maxW / iw, maxH / ih);
      pw = Math.round(iw * k); ph = Math.round(ih * k);
    }
    const fx = Math.round((W - pw) / 2), fy = 100;
    x.save();
    x.translate(fx + pw / 2, fy + ph / 2); x.rotate(-0.012);
    x.shadowColor = 'rgba(0,0,0,0.28)'; x.shadowBlur = 24; x.shadowOffsetY = 8;
    x.fillStyle = '#fffdf6'; x.fillRect(-pw / 2 - 18, -ph / 2 - 18, pw + 36, ph + 36);
    x.shadowColor = 'transparent';
    if (im) { x.drawImage(im, -pw / 2, -ph / 2, pw, ph); if (im.close) im.close(); }
    else { x.fillStyle = '#d9e3d2'; x.fillRect(-pw / 2, -ph / 2, pw, ph); }
    x.restore();
    // fita
    x.save(); x.translate(W / 2, fy - 10); x.rotate(0.03); x.fillStyle = 'rgba(243,211,107,0.78)'; x.fillRect(-90, -24, 180, 48); x.restore();
    const textTop = fy + ph + 110;

    const ink = '#2f4a3a', sepia = '#6b4f2a';
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    const fit = (txt, font, max) => { let s = parseInt(font.match(/(\d+)px/)[1], 10); x.font = font; while (s > 20) { x.font = font.replace(/\d+px/, s + 'px'); if (x.measureText(txt).width <= max) break; s -= 2; } };
    let y = textTop;
    x.fillStyle = ink; fit(treeName(tree), 'bold 70px Georgia, serif', 880); x.fillText(treeName(tree), 110, y);
    y += 56;
    if (tree.scientific) { x.fillStyle = sepia; fit(tree.scientific, 'italic 40px Georgia, serif', 880); x.fillText(tree.scientific, 110, y); y += 52; }
    const tags = [];
    if (tree.origin === 'N') tags.push('Nativa do Brasil'); else if (tree.origin === 'E') tags.push('Exótica');
    if (tree.fruit === 'S') tags.push('Frutífera');
    if (tree.flowering) tags.push('Florida'); if (tree.fruiting) tags.push('Com frutos');
    if (tags.length) { x.fillStyle = '#4f7a3b'; fit(tags.join('  ·  '), '600 34px Georgia, serif', 880); x.fillText(tags.join('  ·  '), 110, y); y += 52; }
    x.fillStyle = ink;
    const place = [tree.street, tree.neighborhood].filter(Boolean).join(', ');
    if (place) { fit(place, '36px Georgia, serif', 880); x.fillText(place, 110, y); y += 46; }
    fit(cityKey(tree), '36px Georgia, serif', 880); x.fillText(tree.city ? cityKey(tree) : '', 110, y); if (tree.city) y += 46;
    x.fillStyle = sepia;
    if (G().validCoord(tree.lat, tree.lng)) {
      const s1 = G().fmtLatLon(tree.lat, tree.lng), s2 = 'UTM ' + AC.stamp.utmText(tree.lat, tree.lng);
      fit(s1, '31px "Courier New", monospace', 880); x.fillText(s1, 110, y); y += 42;
      fit(s2, '31px "Courier New", monospace', 880); x.fillText(s2, 110, y); y += 42;
    }
    x.fillText(G().fmtDate(tree.createdAt), 110, y);
    if (tree.favorite) { x.fillStyle = '#e0a800'; x.font = '60px Georgia, serif'; x.textAlign = 'right'; x.fillText('★', 990, textTop); x.textAlign = 'left'; }
    x.fillStyle = 'rgba(47,74,58,0.7)'; x.font = '27px Georgia, serif'; x.textAlign = 'center';
    x.fillText('Árvores Urbanas  ·  @paulapmiranda', W / 2, H - 40);
    return AC.stamp.canvasToBlob(c, 0.9);
  }

  // ---------- Backup ----------
  async function buildBackup(onProgress) {
    const trees = await AC.db.allTrees();
    const photos = await AC.db.allPhotos();
    const zip = new AC.zip.ZipWriter();
    const meta = { seq: await AC.db.getMeta('seq', 0), stampOpts: await AC.db.getMeta('stampOpts', null) };
    const photoMeta = photos.map((p) => { const q = Object.assign({}, p); delete q.thumb; return q; });
    let n = 0;
    for (const p of photos) {
      const b = await AC.db.getBlobs(p.id);
      if (b && b.orig) { const ext = extFor(b.orig); p.file = 'fotos/' + p.id + ext; photoMeta.find((q) => q.id === p.id).file = p.file; await zip.addFile(p.file, b.orig, p.takenAt); }
      n++; if (onProgress) onProgress(n, photos.length);
    }
    await zip.addFile('dados.json', JSON.stringify({ app: 'arvores-da-cidade', version: 1, exportedAt: Date.now(), meta, trees, photos: photoMeta }));
    return zip.finish();
  }

  async function restoreBackup(file, onProgress) {
    const entries = await AC.zip.readZip(file);
    const dados = entries.find((e) => e.name === 'dados.json');
    if (!dados) throw new Error('Este arquivo não parece um backup do Árvores Urbanas.');
    const data = JSON.parse(await dados.text());
    if (data.app !== 'arvores-da-cidade') throw new Error('Este arquivo não parece um backup do Árvores Urbanas.');
    const byName = new Map(entries.map((e) => [e.name, e]));
    const existing = new Map((await AC.db.allTrees()).map((t) => [t.id, t]));
    let nt = 0, np = 0, i = 0;
    const total = data.photos.length;
    for (const t of data.trees) {
      const cur = existing.get(t.id);
      if (!cur || (t.updatedAt || 0) > (cur.updatedAt || 0)) { await AC.db.put('trees', t); nt++; }
    }
    const treeMap = new Map(data.trees.map((t) => [t.id, t]));
    const havePhotos = new Set((await AC.db.allPhotos()).map((p) => p.id));
    for (const p of data.photos) {
      i++; if (onProgress) onProgress(i, total);
      if (havePhotos.has(p.id)) continue;
      const entry = byName.get(p.file);
      const tree = treeMap.get(p.treeId) || (await AC.db.getTree(p.treeId));
      if (!entry || !tree) continue;
      const orig = await entry.blob(p.mime || 'image/jpeg');
      let r;
      try { r = await AC.stamp.process(orig, AC.stamp.infoFor(tree, p)); } catch (e) { continue; }
      const meta = Object.assign({}, p, { thumb: r.thumb, w: r.w, h: r.h }); delete meta.file;
      await AC.db.savePhoto(meta, { orig, stamped: r.stamped });
      np++;
    }
    if (data.meta) {
      if (data.meta.seq > (await AC.db.getMeta('seq', 0))) await AC.db.setMeta('seq', data.meta.seq);
      if (data.meta.stampOpts && !(await AC.db.getMeta('stampOpts', null))) await AC.db.setMeta('stampOpts', data.meta.stampOpts);
    }
    return { trees: nt, photos: np };
  }

  // ---------- Entrega ----------
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }
  async function shareBlob(blob, name, title) {
    const f = new File([blob], name, { type: blob.type || 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: title || name }); return 'shared'; }
      catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    saveBlob(blob, name);
    return 'saved';
  }
  const canShareFiles = () => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.txt', { type: 'text/plain' })] })); } catch (e) { return false; } };

  AC.exp = {
    PHOTO_TYPES, photoTypeLabel, ORIGIN_LABEL, FRUIT_LABEL, treeName, cityKey, slug, loadAll, lastVisit,
    buildKML, buildKMZ, buildXLSX, buildCSV, buildPhotoPack, makeCard, buildBackup, restoreBackup,
    saveBlob, shareBlob, canShareFiles, COLS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
