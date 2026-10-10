/* Árvores Urbanas — more.js
   Números (estatísticas), exportação, ficha em PDF (impressão), carimbo, backup e sobre. */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const { esc, icon, toast, sheet, confirmBox, urlOf } = AC.ui;
  const G = AC.geo;
  const S = AC.S;
  const hasCoord = (t) => G.validCoord(t.lat, t.lng);
  const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
  const fmtN = (n, d) => n.toFixed(d == null ? 1 : d).replace('.', ',');

  // ======================= NÚMEROS =======================
  function barsHTML(rows, max, color) {
    return '<div class="bars">' + rows.map((r) => '<div class="bar"><div class="b-h"><span>' + esc(r.label) + '</span><b>' + r.value + '</b></div><div class="b-t"><i style="width:' + Math.max(3, Math.round((r.value / max) * 100)) + '%' + (color ? ';background:' + color : '') + '"></i></div>' + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</div>').join('') + '</div>';
  }

  function statsHTML(trees) {
    const n = trees.length;
    if (!n) return '<div class="empty"><div class="big">Sem dados ainda</div></div>';
    const sp = new Map();
    let unk = 0, nat = 0, exo = 0, noOrig = 0, fruit = 0, fav = 0, flo = 0, fru = 0, multi = 0;
    const risks = new Map(), health = new Map(), bairros = new Map(), ruas = new Map();
    trees.forEach((t) => {
      if (t.species) { const k = t.species; sp.set(k, (sp.get(k) || 0) + 1); } else unk++;
      if (t.origin === 'N') nat++; else if (t.origin === 'E') exo++; else noOrig++;
      if (t.fruit === 'S') fruit++;
      if (t.favorite) fav++; if (t.flowering) flo++; if (t.fruiting) fru++;
      if ((t.visits || []).length > 1) multi++;
      if (t.health) health.set(t.health, (health.get(t.health) || 0) + 1);
      (t.risks || []).forEach((r) => risks.set(r, (risks.get(r) || 0) + 1));
      const b = t.neighborhood || 'Sem bairro';
      if (!bairros.has(b)) bairros.set(b, []);
      bairros.get(b).push(t);
      if (t.street) { const k = t.street + '|' + (t.neighborhood || ''); if (!ruas.has(k)) ruas.set(k, { street: t.street, bairro: t.neighborhood || '', ts: [] }); ruas.get(k).ts.push(t); }
    });
    const idn = n - unk;
    let h = '<div class="tiles">' +
      '<div class="tile"><div class="n">' + n + '</div><div class="l">árvores registradas</div></div>' +
      '<div class="tile"><div class="n">' + sp.size + '</div><div class="l">espécies diferentes</div></div>' +
      '<div class="tile"><div class="n">' + Math.round((idn / n) * 100) + '%</div><div class="l">identificadas (' + unk + ' faltam)</div></div>' +
      '<div class="tile"><div class="n">' + fruit + '</div><div class="l">frutíferas</div></div>' +
      '<div class="tile"><div class="n">' + fav + '</div><div class="l">favoritas</div></div>' +
      '<div class="tile"><div class="n">' + multi + '</div><div class="l">com várias visitas</div></div></div>';

    const seg = (v, c) => (v ? '<i style="width:' + (v / n) * 100 + '%;background:' + c + '"></i>' : '');
    h += '<section class="card"><h3>Nativas e exóticas</h3><div class="stack">' + seg(nat, '#4f7a3b') + seg(exo, '#c47a2a') + seg(noOrig, '#bdb596') + '</div><div class="legend">' +
      '<span><i style="background:#4f7a3b"></i>Nativas ' + nat + ' (' + Math.round((nat / n) * 100) + '%)</span><span><i style="background:#c47a2a"></i>Exóticas ' + exo + ' (' + Math.round((exo / n) * 100) + '%)</span><span><i style="background:#bdb596"></i>Sem informação ' + noOrig + '</span></div></section>';

    const top = [...sp.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
    if (top.length) h += '<section class="card"><h3>Espécies mais comuns</h3>' + barsHTML(top.map(([k, v]) => ({ label: k, value: v })), top[0][1]) + '</section>';

    const bl = [...bairros.entries()].map(([k, ts]) => {
      const pts = ts.filter(hasCoord).map((t) => ({ lat: t.lat, lng: t.lng, lon: t.lng }));
      let sub = '';
      if (pts.length >= 3) { const area = G.hullAreaM2(pts); if (area > 3000) sub = '≈ ' + fmtN(ts.length / (area / 10000)) + ' árvores por hectare (área estimada pelos pontos)'; }
      return { label: k, value: ts.length, sub };
    }).sort((a, b) => b.value - a.value).slice(0, 12);
    if (bl.length > 0 && !(bl.length === 1 && bl[0].label === 'Sem bairro')) h += '<section class="card"><h3>Árvores por bairro</h3>' + barsHTML(bl, bl[0].value, '#3f6f8a') + '</section>';

    const rl = [...ruas.values()].map((r) => {
      const pts = r.ts.filter(hasCoord).map((t) => ({ lat: t.lat, lon: t.lng }));
      let sub = r.bairro;
      if (pts.length >= 3) { const span = G.spanM(pts); if (span >= 30) sub = (r.bairro ? r.bairro + ' · ' : '') + '≈ ' + fmtN((r.ts.length / span) * 100) + ' árvores a cada 100 m'; }
      return { label: r.street, value: r.ts.length, sub };
    }).sort((a, b) => b.value - a.value).slice(0, 12);
    if (rl.length) h += '<section class="card"><h3>Árvores por rua</h3>' + barsHTML(rl, rl[0].value, '#8a5a2b') + '<p class="note">Para comparar ruas ou bairros de verdade, o ideal é ter registrado todas as árvores do trecho. Os valores “por 100 m” e “por hectare” são estimativas feitas com os pontos que você marcou.</p></section>';

    if (health.size) { const hl = [...health.entries()].sort((a, b) => b[1] - a[1]); h += '<section class="card"><h3>Estado das árvores</h3>' + barsHTML(hl.map(([k, v]) => ({ label: k, value: v })), hl[0][1], '#b5412f') + '</section>'; }
    if (risks.size) { const rl = [...risks.entries()].sort((a, b) => b[1] - a[1]); h += '<section class="card"><h3>Atenção e manejo</h3>' + barsHTML(rl.map(([k, v]) => ({ label: k, value: v })), rl[0][1], '#d9a400') + '<p class="note">' + plural(trees.filter((t) => (t.risks || []).length).length, 'árvore pede', 'árvores pedem') + ' atenção. Use o filtro “Com atenção” na lista para vê-las.</p></section>'; }
    h += calendarHTML(trees);
    h += '<section class="card"><h3>Agora</h3><p style="margin:0">' + plural(flo, 'árvore com flores', 'árvores com flores') + ' · ' + plural(fru, 'com frutos', 'com frutos') + '</p></section>';
    return h;
  }

  async function renderStats(cityParam) {
    await AC.app.refresh();
    const all = AC.app.done();
    const trees = cityParam ? all.filter((t) => AC.exp.cityKey(t) === cityParam) : all;
    document.getElementById('app').innerHTML = AC.topBar('Números', cityParam || 'Todas as cidades', { back: true }) +
      '<main class="page">' + statsHTML(trees) + '</main>';
  }


  // ======================= CALENDÁRIO DE FLORAÇÃO =======================
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  function calendarHTML(trees) {
    const fl = Array(12).fill(0), fr = Array(12).fill(0);
    trees.forEach((t) => {
      const vs = t.visits || [], sf = new Set(), sr = new Set();
      vs.forEach((v) => {
        const m = new Date(v.date).getMonth();
        const f = v.flowering !== undefined ? v.flowering : (vs.length === 1 ? t.flowering : false);
        const r = v.fruiting !== undefined ? v.fruiting : (vs.length === 1 ? t.fruiting : false);
        if (f) sf.add(m); if (r) sr.add(m);
      });
      sf.forEach((m) => fl[m]++); sr.forEach((m) => fr[m]++);
    });
    const rows = (arr) => arr.map((v, i) => ({ label: MESES[i], value: v })).filter((r) => r.value > 0);
    const a = rows(fl), b = rows(fr);
    if (!a.length && !b.length) return '';
    let h = '<section class="card"><h3>Calendário de floração</h3>';
    if (a.length) h += '<p class="note" style="margin:0 0 4px">Árvores vistas <b>com flores</b>, por mês</p>' + barsHTML(a, Math.max(...a.map((r) => r.value)), '#d9a400');
    if (b.length) h += '<p class="note" style="margin:10px 0 4px">Árvores vistas <b>com frutos</b>, por mês</p>' + barsHTML(b, Math.max(...b.map((r) => r.value)), '#8a5a2b');
    return h + '<p class="note">Vai se completando conforme você volta às árvores (use “Nova visita”) ao longo do ano.</p></section>';
  }

  // ======================= RELATÓRIO DO BAIRRO =======================
  function reportCardHTML(trees) {
    const bairros = [...new Set(trees.map((t) => t.neighborhood || 'Sem bairro'))].sort((a, b) => a.localeCompare(b));
    return '<section class="card"><h3>Relatório em PDF</h3><p class="note" style="margin-top:0">Uma folha resumo para mostrar ou entregar: números, espécies, árvores que pedem atenção, croqui de onde ficam e fotos.</p>' +
      '<select class="inp" id="repB"><option value="">Cidade inteira</option>' + bairros.map((b) => '<option>' + esc(b) + '</option>').join('') + '</select>' +
      '<button class="btn block" style="margin-top:8px" data-act="city-report">' + icon('printer') + ' Gerar relatório</button></section>';
  }

  function croquiSVG(trees) {
    const pts = trees.filter(hasCoord);
    if (pts.length < 2) return '';
    const lat0 = pts.reduce((s, t) => s + t.lat, 0) / pts.length, k = Math.cos(lat0 * Math.PI / 180);
    const xs = pts.map((t) => t.lng * k), ys = pts.map((t) => t.lat);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const W = 560, H = 360, pad = 24;
    const sc = Math.min((W - 2 * pad) / Math.max(x1 - x0, 1e-9), (H - 2 * pad) / Math.max(y1 - y0, 1e-9));
    const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
    const dots = pts.map((t) => {
      const x = ox + (t.lng * k - x0) * sc, y = H - (oy + (t.lat - y0) * sc);
      const warn = (t.risks || []).length;
      return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5.5" fill="' + (warn ? '#d9a400' : '#4f7a3a') + '" stroke="#fff" stroke-width="1.5"/>';
    }).join('');
    const spanM = Math.round(Math.max(x1 - x0, 0) * 111320), spanN = Math.round((y1 - y0) * 110574);
    return '<svg class="croqui" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg"><rect width="' + W + '" height="' + H + '" fill="#f7f3e6"/>' + dots +
      '<text x="' + (W - 18) + '" y="26" font-size="16" text-anchor="end" fill="#555">N ↑</text>' +
      '<text x="14" y="' + (H - 10) + '" font-size="12" fill="#555">Área ≈ ' + spanM + ' m (leste-oeste) × ' + spanN + ' m (norte-sul) · amarelo = pede atenção</text></svg>';
  }

  async function printReport(trees, title) {
    if (!trees.length) { toast('Nenhuma árvore para o relatório'); return; }
    const n = trees.length;
    const sp = new Map(); trees.forEach((t) => { const k = t.species || 'Não identificada'; sp.set(k, (sp.get(k) || 0) + 1); });
    const nat = trees.filter((t) => t.origin === 'N').length, exo = trees.filter((t) => t.origin === 'E').length, fru = trees.filter((t) => t.fruit === 'S').length;
    const warn = trees.filter((t) => (t.risks || []).length);
    let h = '<h1>' + esc(title) + '</h1><p class="sub">Levantamento de árvores · ' + plural(n, 'árvore', 'árvores') + ' · ' + plural(sp.size, 'espécie', 'espécies') + ' · gerado em ' + G.fmtDate(Date.now()) + '</p>';
    h += '<h2>Resumo</h2><table><tr><td>Nativas do Brasil</td><td>' + nat + '</td><td>Exóticas</td><td>' + exo + '</td></tr><tr><td>Frutíferas</td><td>' + fru + '</td><td>Pedem atenção</td><td>' + warn.length + '</td></tr></table>';
    const top = [...sp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    h += '<h2>Espécies mais comuns</h2><table>' + top.map(([k, v]) => '<tr><td>' + esc(k) + '</td><td style="width:40pt">' + v + '</td></tr>').join('') + '</table>';
    const cq = croquiSVG(trees);
    if (cq) h += '<h2>Onde ficam</h2>' + cq;
    if (warn.length) {
      h += '<h2>Árvores que pedem atenção</h2><table><thead><tr><th>Código</th><th>Árvore</th><th>Local</th><th>Atenção</th></tr></thead><tbody>' +
        warn.map((t) => '<tr><td>' + esc(t.code || '') + '</td><td>' + esc(t.species || 'Não identificada') + '</td><td>' + esc([t.street, t.neighborhood].filter(Boolean).join(', ')) + '</td><td>' + esc(t.risks.join('; ')) + '</td></tr>').join('') + '</tbody></table>';
    }
    const withPh = trees.map((t) => { const ph = AC.app.photosOf(t.id); return { t, p: [...ph].reverse().find((p) => p.type === 'inteira') || ph[0] }; }).filter((x) => x.p)
      .sort((a, b) => (b.t.favorite ? 1 : 0) - (a.t.favorite ? 1 : 0)).slice(0, 8);
    if (withPh.length) h += '<h2>Algumas árvores</h2><div class="pp">' + withPh.map((x) => '<figure><img alt="" src="' + urlOf(x.p.thumb) + '"><figcaption>' + esc(x.t.species || 'Não identificada') + (x.t.street ? ' · ' + esc(x.t.street) : '') + '</figcaption></figure>').join('') + '</div>';
    h += '<div class="foot">Árvores Urbanas · @paulapmiranda · coordenadas SIRGAS 2000</div>';
    await printHTML(h);
  }

  // ======================= ENTREGA =======================
  function deliverSheet(blob, name, note, tip) {
    const mb = blob.size / 1048576;
    let podeCompartilhar = false;
    // o Chrome do celular não abre a lista de compartilhar para .zip/.kmz (cai num segundo download): para esses, mostramos o caminho pelo Meus Arquivos
    if (!/\.(zip|kmz)$/i.test(name)) { try { podeCompartilhar = !!(navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: blob.type || 'application/octet-stream' })] })); } catch (e) { podeCompartilhar = false; } }
    const passos = podeCompartilhar ? '' : '<p class="note"><b>Para guardar fora do celular (Drive, OneDrive ou WhatsApp):</b> toque em <b>Baixar</b>. Depois abra <b>Meus Arquivos</b> › <b>Downloads</b>, toque e segure este arquivo e escolha <b>Compartilhar</b>.</p>';
    const s = sheet('<h3>Pronto!</h3><p><b>' + esc(name) + '</b><br><span class="note">' + (mb >= 0.1 ? fmtN(mb) + ' MB' : Math.max(1, Math.round(blob.size / 1024)) + ' KB') + '</span></p>' +
      (note ? '<p class="note">' + note + '</p>' : '') + (tip ? '<p class="note">' + tip + '</p>' : '') + passos +
      '<div class="row-btns"><button class="btn" data-d="save">' + icon('download') + ' Baixar</button>' + (podeCompartilhar ? '<button class="btn sec" data-d="share">' + icon('share') + ' Compartilhar</button>' : '') + '</div>');
    s.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-d]'); if (!b) return;
      if (b.dataset.d === 'save') { AC.exp.saveBlob(blob, name); toast(podeCompartilhar ? 'Arquivo baixado. Veja em Downloads.' : 'Baixado. Para guardar fora do celular: Meus Arquivos > Downloads > Compartilhar.', 6500); }
      else await AC.exp.shareBlob(blob, name, name);
    });
  }

  function exportSheet(scope) {
    const trees = AC.app.done().filter(scope.filter || (() => true));
    if (!trees.length) { toast('Nenhuma árvore para exportar'); return; }
    const noCoord = trees.filter((t) => !hasCoord(t)).length;
    const s = sheet('<h3>Exportar</h3><p class="note">' + esc(scope.title) + ' · ' + plural(trees.length, 'árvore', 'árvores') + (noCoord ? ' · ' + noCoord + ' sem coordenada (ficam fora do mapa)' : '') + '</p><div class="menu">' +
      '<button class="btn" data-x="kmz">' + icon('map') + '<span class="m-t">Mapa com fotos (KMZ)<small>Abre no Google Earth, com a foto de cada árvore</small></span></button>' +
      '<button class="btn sec" data-x="kml">' + icon('pin') + '<span class="m-t">Só os pontos (KML)<small>Arquivo leve, sem as fotos</small></span></button>' +
      '<button class="btn sec" data-x="xlsx">' + icon('list') + '<span class="m-t">Planilha (Excel)<small>Todos os dados, com latitude, longitude e UTM</small></span></button>' +
      '<button class="btn sec" data-x="csv">' + icon('list') + '<span class="m-t">Planilha simples (CSV)</span></button>' +
      '<button class="btn sec" data-x="fotos">' + icon('image') + '<span class="m-t">Pacote de fotos<small>Fotos com carimbo, em pastas por cidade e bairro</small></span></button>' +
      '<button class="btn sec" data-x="pdf">' + icon('printer') + '<span class="m-t">Relatório em PDF<small>Lista com fotos pequenas, para imprimir ou salvar</small></span></button></div>' +
      '<div class="togrow"><div class="tg-t">Pacote de fotos: incluir também as originais<small>Sem carimbo, em boa qualidade (arquivo bem maior)</small></div><button class="sw" data-orig role="switch" aria-checked="false" aria-label="Incluir originais"></button></div>');
    let orig = false;
    s.el.addEventListener('click', async (e) => {
      const o = e.target.closest('[data-orig]');
      if (o) { orig = !orig; o.classList.toggle('on', orig); o.setAttribute('aria-checked', String(orig)); return; }
      const b = e.target.closest('[data-x]'); if (!b) return;
      s.close();
      await runExport(b.dataset.x, scope, orig);
    });
  }

  async function runExport(kind, scope, includeOrig) {
    const { trees, by } = await AC.exp.loadAll(scope.filter);
    const base = 'arvores_' + scope.slug + '_' + G.isoDate(Date.now());
    if (kind === 'pdf') { await printCity(trees, scope.title); return; }
    const prog = AC.ui.progress('Preparando o arquivo…');
    try {
      if (kind === 'kmz') {
        const r = await AC.exp.buildKMZ(trees, by, scope.title, (n, t) => prog.set(n, t, 'Foto ' + n + ' de ' + t));
        prog.close();
        deliverSheet(r.blob, base + '.kmz', r.skipped ? r.skipped + ' árvore(s) sem coordenada ficaram fora do mapa.' : '', 'Para abrir: toque no arquivo baixado e escolha o Google Earth. No computador, dê dois cliques no arquivo.');
      } else if (kind === 'kml') {
        const r = AC.exp.buildKML(trees, null, scope.title);
        prog.close();
        deliverSheet(new Blob([r.kml], { type: 'application/vnd.google-earth.kml+xml' }), base + '.kml', r.skipped ? r.skipped + ' árvore(s) sem coordenada ficaram fora do mapa.' : '');
      } else if (kind === 'xlsx') {
        const blob = await AC.exp.buildXLSX(trees, by); prog.close(); deliverSheet(blob, base + '.xlsx');
      } else if (kind === 'csv') {
        const blob = AC.exp.buildCSV(trees, by); prog.close(); deliverSheet(blob, base + '.csv', 'Separado por ponto e vírgula, abre direto no Excel em português.');
      } else if (kind === 'fotos') {
        const blob = await AC.exp.buildPhotoPack(trees, by, includeOrig, (n, t) => prog.set(n, t, 'Foto ' + n + ' de ' + t));
        prog.close(); deliverSheet(blob, base + '_fotos.zip', includeOrig ? 'Cada árvore tem uma pasta “originais” com as fotos sem carimbo.' : '');
      }
    } catch (e) { console.error(e); try { prog.close(); } catch (_) { /* ok */ } toast('Não consegui gerar o arquivo: ' + (e && e.message), 5000); }
  }

  // ======================= PDF (impressão) =======================
  function row(k, v) { return v === '' || v == null ? '' : '<tr><th style="width:34%">' + esc(k) + '</th><td>' + v + '</td></tr>'; }
  async function waitImages(el) { await Promise.all([...el.querySelectorAll('img')].map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()))); }

  async function printHTML(html) {
    let pa = document.getElementById('printArea');
    if (!pa) { pa = document.createElement('div'); pa.id = 'printArea'; document.body.appendChild(pa); }
    pa.innerHTML = html;
    await waitImages(pa);
    const after = () => { pa.innerHTML = ''; window.removeEventListener('afterprint', after); };
    window.addEventListener('afterprint', after);
    toast('Na tela que abrir, escolha “Salvar como PDF”.', 5000);
    setTimeout(() => window.print(), 250);
  }

  async function printTree(t) {
    const ps = [...AC.app.photosOf(t.id)];
    const visits = [...(t.visits || [])].sort((a, b) => a.date - b.date);
    let h = '<h1>' + esc(t.species || 'Árvore não identificada') + '</h1><p class="sub">' + esc([t.scientific, t.code].filter(Boolean).join(' · ')) + '</p>';
    h += '<h2>Onde fica</h2><table>' + row('Cidade', esc(AC.exp.cityKey(t))) + row('Bairro', esc(t.neighborhood)) + row('Rua', esc(t.street)) +
      (hasCoord(t) ? row('Latitude / Longitude', G.fmtLatLon(t.lat, t.lng)) + row('UTM (SIRGAS 2000)', esc(AC.stamp.utmText(t.lat, t.lng))) : row('Coordenada', 'Sem coordenada')) + '</table>';
    h += '<h2>Características</h2><table>' + row('Origem', t.origin ? esc(AC.exp.ORIGIN_LABEL[t.origin]) + (t.originConfirm ? ' (confirmar)' : '') : '') + row('Frutífera', t.fruit ? esc(AC.exp.FRUIT_LABEL[t.fruit]) : '') +
      row('Medicinal', t.medicinal ? 'Sim' : '') + row('Ameaçada de extinção', t.threatened ? 'Sim' : '') + row('Altura', t.height ? esc(t.height) + ' m' : '') + row('Diâmetro do tronco', t.trunk ? esc(t.trunk) + ' cm' : '') + row('Copa', t.crown ? esc(t.crown) + ' m' : '') +
      row('Flores', t.flowering ? 'Sim' + (t.flowerColor ? ' (' + esc(t.flowerColor) + ')' : '') : '') + row('Frutos', t.fruiting ? 'Sim' : '') + row('Estado', esc(t.health)) + row('Atenção e manejo', esc((t.risks || []).join('; '))) + row('Tipo de local', esc(t.placeType)) + row('Observações', esc(t.notes).replace(/\n/g, '<br>')) + row('Primeiro registro', G.fmtDateTime(t.createdAt)) + '</table>';
    h += '<h2>Histórico de fotos</h2>';
    const urls = [];
    for (const v of visits.reverse()) {
      const vp = ps.filter((p) => p.visitId === v.id);
      h += '<div class="tree"><p style="margin:4pt 0"><b>' + G.fmtDate(v.date) + ' ' + G.fmtTime(v.date) + '</b>' + (v.notes ? ' — ' + esc(v.notes) : '') + '</p>';
      if (vp.length) {
        h += '<div class="pp">';
        for (const p of vp) { const b = await AC.db.getBlobs(p.id); const u = URL.createObjectURL(b.stamped); urls.push(u); h += '<figure><img alt="" src="' + u + '"><figcaption>' + esc(AC.exp.photoTypeLabel(p.type)) + '</figcaption></figure>'; }
        h += '</div>';
      }
      h += '</div>';
    }
    h += '<div class="foot">Árvores Urbanas · @paulapmiranda · gerado em ' + G.fmtDateTime(Date.now()) + '</div>';
    await printHTML(h);
    setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 120000);
  }

  async function printCity(trees, title) {
    const by = await AC.exp.loadAll((t) => trees.some((x) => x.id === t.id));
    const n = trees.length, sp = new Set(trees.filter((t) => t.species).map((t) => t.species)).size;
    let h = '<h1>' + esc(title) + '</h1><p class="sub">' + plural(n, 'árvore', 'árvores') + ' · ' + plural(sp, 'espécie', 'espécies') + ' · gerado em ' + G.fmtDate(Date.now()) + '</p>';
    h += '<table><thead><tr><th></th><th>Árvore</th><th>Local</th><th>Coordenadas</th><th>Registro</th></tr></thead><tbody>';
    [...trees].sort((a, b) => (a.neighborhood || '').localeCompare(b.neighborhood || '') || (a.code || '').localeCompare(b.code || '')).forEach((t) => {
      const ph = AC.app.photosOf(t.id), pick = [...ph].reverse().find((p) => p.type === 'inteira') || ph[0];
      h += '<tr><td style="width:50pt">' + (pick ? '<img class="th" alt="" src="' + urlOf(pick.thumb) + '">' : '') + '</td><td><b>' + esc(t.species || 'Não identificada') + '</b>' + (t.scientific ? '<br><i>' + esc(t.scientific) + '</i>' : '') + '<br>' + esc(t.code || '') +
        '</td><td>' + esc([t.street, t.neighborhood].filter(Boolean).join(', ')) + '</td><td>' + (hasCoord(t) ? G.fmtLatLon(t.lat, t.lng) + '<br>' + esc(AC.stamp.utmText(t.lat, t.lng)) : '—') + '</td><td>' + G.fmtDate(t.createdAt) + '</td></tr>';
    });
    h += '</tbody></table><div class="foot">Árvores Urbanas · @paulapmiranda</div>';
    await printHTML(h);
  }

  // ======================= AJUSTES =======================
  async function renderSettings() {
    await AC.app.refresh();
    const o = await AC.stamp.getOpts();
    const last = await AC.db.getMeta('lastBackup', 0);
    const pend = AC.app.done().filter((t) => t.placePending && hasCoord(t)).length;
    const row2 = (k, label, sub) => '<div class="togrow"><div class="tg-t">' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div><button class="sw' + (o[k] ? ' on' : '') + '"' + (k !== 'on' && !o.on ? ' disabled' : '') + ' data-act="st-tog" data-k="' + k + '" role="switch" aria-checked="' + !!o[k] + '" aria-label="' + esc(label) + '"></button></div>';
    let h = AC.topBar('Carimbo, backup e sobre', '', { back: true }) + '<main class="page">';
    h += '<section class="card tape"><h3>Carimbo nas fotos</h3><p class="note">' + (o.on ? 'Ligado. As próximas fotos saem com a faixa escura no rodapé.' : 'Desligado. As próximas fotos saem sem carimbo.') + ' A foto original é sempre guardada sem carimbo.</p>' +
      row2('on', 'Carimbo nas fotos') + row2('dt', 'Data e hora') + row2('utm', 'UTM', 'SIRGAS 2000, com a precisão do GPS') + row2('ll', 'Latitude e longitude') + row2('place', 'Local', 'Rua, bairro e cidade') +
      '<button class="btn sec block" style="margin-top:8px" data-act="st-restamp">Aplicar às fotos já tiradas</button></section>';
    h += '<section class="card"><h3>Backup</h3><p class="note">' + (last ? 'Último backup: ' + G.fmtDateTime(last) + '.' : 'Você ainda não fez backup.') + ' O arquivo guarda todas as árvores e fotos originais. Guarde no Drive ou mande para você mesma no WhatsApp.</p>' +
      '<div class="row-btns" style="margin-top:6px"><button class="btn" data-act="backup-now">' + icon('save') + ' Salvar backup</button><label class="btn sec" style="cursor:pointer">' + icon('upload') + ' Restaurar<input id="restoreIn" type="file" accept=".zip,application/zip" hidden></label></div></section>';
    if (pend) h += '<section class="card"><h3>Local pendente</h3><p class="note">' + plural(pend, 'árvore espera', 'árvores esperam') + ' internet para descobrir cidade e bairro.</p><button class="btn sec block" data-act="resolve-places">Buscar agora</button></section>';
    h += '<section class="card"><h3>Sobre</h3><p style="margin:0 0 6px"><b>Árvores Urbanas</b> · versão ' + esc(AC.VERSION) + '</p><p class="note" style="margin-top:0">Criado por @paulapmiranda.</p>' +
      '<p class="note">Seus registros e fotos ficam só neste aparelho. O app usa a internet apenas para o fundo do mapa e para descobrir o nome do lugar e informações da espécie.</p></section>';
    h += '</main>';
    document.getElementById('app').innerHTML = h;
    const inp = document.getElementById('restoreIn');
    if (inp) inp.addEventListener('change', () => { if (inp.files[0]) restoreFlow(inp.files[0]); inp.value = ''; });
  }

  async function backupFlow() {
    const prog = AC.ui.progress('Montando o backup…');
    try {
      const blob = await AC.exp.buildBackup((n, t) => prog.set(n, t, 'Foto ' + n + ' de ' + t));
      await AC.db.setMeta('lastBackup', Date.now());
      prog.close();
      deliverSheet(blob, 'backup-arvores-' + G.isoDate(Date.now()) + '.zip', '', 'Guarde este arquivo em lugar seguro, como o Google Drive.');
      if (/mais$|\/mais/.test(location.hash) || location.hash === '#/' || !location.hash) AC.render();
    } catch (e) { console.error(e); try { prog.close(); } catch (_) { /* ok */ } toast('Não consegui fazer o backup: ' + (e && e.message), 5000); }
  }

  async function restoreFlow(file) {
    if (!(await confirmBox('Restaurar este backup?', 'As árvores e fotos do arquivo serão somadas ao que já existe neste aparelho. Nada do que existe é apagado.', 'Restaurar'))) return;
    const prog = AC.ui.progress('Restaurando…');
    try {
      const r = await AC.exp.restoreBackup(file, (n, t) => prog.set(n, t, 'Foto ' + n + ' de ' + t));
      prog.close();
      toast('Pronto: ' + r.trees + ' árvore(s) e ' + r.photos + ' foto(s) restauradas', 5000);
      AC.go('/');
    } catch (e) { console.error(e); try { prog.close(); } catch (_) { /* ok */ } toast(e && e.message ? e.message : 'Não consegui restaurar este arquivo.', 6000); }
  }

  async function restampAll() {
    const trees = AC.app.done();
    const total = trees.reduce((s, t) => s + AC.app.photosOf(t.id).length, 0);
    if (!total) { toast('Ainda não há fotos'); return; }
    if (!(await confirmBox('Refazer o carimbo?', 'As ' + total + ' fotos já tiradas serão carimbadas de novo com as opções atuais. As originais não mudam.', 'Refazer'))) return;
    const prog = AC.ui.progress('Refazendo o carimbo…');
    const opts = await AC.stamp.getOpts();
    let n = 0;
    try {
      for (const t of trees) for (const p of AC.app.photosOf(t.id)) { try { await AC.stamp.restampPhoto(t, p, opts); } catch (e) { /* segue */ } n++; prog.set(n, total, 'Foto ' + n + ' de ' + total); }
      prog.close(); toast('Carimbo refeito em ' + n + ' fotos');
    } catch (e) { try { prog.close(); } catch (_) { /* ok */ } toast('Algo deu errado: ' + e.message); }
  }

  const actions = {
    'st-tog': async (el) => {
      const o = await AC.stamp.getOpts(); const k = el.dataset.k;
      o[k] = !o[k]; await AC.stamp.setOpts(o); await renderSettings();
    },
    'st-restamp': restampAll,
  };

  AC.more = { printHTML, deliverSheet, statsHTML, renderStats, reportCardHTML, printReport, exportSheet, printTree, printCity, renderSettings, backupFlow, actions };
})(typeof window !== 'undefined' ? window : globalThis);
