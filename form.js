/* Árvores Urbanas — form.js
   Cadastro e edição de árvore, nova visita, fotos (câmera ou galeria), GPS, local automático,
   salvamento automático e aviso de árvore repetida. */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const { esc, icon, starIcon, toast, sheet, confirmBox, urlOf, debounce } = AC.ui;
  const G = AC.geo;
  const S = AC.S;
  const TYPES = AC.exp.PHOTO_TYPES;

  const F = { tree: null, kind: 'tree', visit: null, visitPersisted: false, photos: [], gps: { last: null, watch: null, err: null }, queue: Promise.resolve(), busy: 0 };
  let bound = false;

  const hasCoord = (t) => G.validCoord(t.lat, t.lng);
  const $id = (id) => document.getElementById(id);

  // ---------- salvar ----------
  async function saveNow() {
    if (!F.tree) return;
    const t0 = F.tree;
    if (F.kind === 'visit' && F.visit) { F.visit.flowering = !!t0.flowering; F.visit.fruiting = !!t0.fruiting; }
    else if (t0.visits && t0.visits.length === 1) { t0.visits[0].flowering = !!t0.flowering; t0.visits[0].fruiting = !!t0.fruiting; }
    await AC.db.saveTree(F.tree);
    const el = $id('saveState');
    if (el) el.innerHTML = icon('check') + ' Salvo às ' + G.fmtTime(Date.now());
  }
  const saveSoon = debounce(() => { saveNow().catch((e) => console.warn(e)); }, 450);
  function touch() {
    const el = $id('saveState');
    if (el) el.textContent = 'Salvando…';
    saveSoon();
  }
  const restampSoon = debounce(() => {
    if (F.tree && F.photos.length) AC.stamp.restampTree(F.tree).catch(() => {});
  }, 1600);

  function flushNow() { try { saveSoon.flush(); } catch (e) { /* ok */ } }

  // ---------- GPS ----------
  function startGps() {
    if (!navigator.geolocation || F.gps.watch != null) return;
    try {
      F.gps.watch = navigator.geolocation.watchPosition(
        (p) => { F.gps.last = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, ts: Date.now() }; F.gps.err = null; paintGps(); },
        (e) => { F.gps.err = e; paintGps(); },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
      );
    } catch (e) { /* sem GPS */ }
  }
  function stopGps() { if (F.gps.watch != null && navigator.geolocation) { try { navigator.geolocation.clearWatch(F.gps.watch); } catch (e) { /* ok */ } } F.gps.watch = null; }
  function paintGps() {
    const el = $id('gpsBadge'); if (!el) return;
    const g = F.gps.last;
    if (g) { el.className = 'accpill' + (g.acc > 50 ? ' bad' : ''); el.textContent = 'GPS ±' + Math.round(g.acc) + ' m'; }
    else if (F.gps.err) { el.className = 'accpill bad'; el.textContent = F.gps.err.code === 1 ? 'GPS sem permissão' : 'GPS indisponível'; }
    else { el.className = 'accpill'; el.textContent = 'Buscando GPS…'; }
  }
  function getFix(maxAge) {
    return new Promise((resolve) => {
      const g = F.gps.last;
      if (g && Date.now() - g.ts <= (maxAge == null ? 60000 : maxAge)) return resolve(g);
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => { F.gps.last = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, ts: Date.now() }; resolve(F.gps.last); },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
      );
    });
  }

  // ---------- local ----------
  async function locationAndPlace() {
    const t = F.tree;
    if (!t.placeManual) t.placePending = true; else t.placePending = !t.city;
    const el = $id('placeStatus'); if (el) el.textContent = 'Descobrindo o local…';
    await AC.place.resolveTree(t);
    await saveNow();
    if (F.photos.length) await AC.stamp.restampTree(t);
    renderLoc();
  }
  async function setCoord(lat, lng, acc, source) {
    const t = F.tree;
    t.lat = lat; t.lng = lng; t.accuracy = acc != null ? acc : null; t.coordSource = source;
    await saveNow();
    await locationAndPlace();
  }

  function nearbyTrees(t) {
    if (!hasCoord(t)) return [];
    return S.trees.filter((o) => o.id !== t.id && !o.draft && hasCoord(o) && !(t.ignoreNearby || []).includes(o.id))
      .map((o) => ({ o, d: G.haversine(t.lat, t.lng, o.lat, o.lng) })).filter((x) => x.d <= 15).sort((a, b) => a.d - b.d);
  }

  async function checkDuplicates() {
    const t = F.tree;
    if (!t || !t.draft || F.kind !== 'tree') return;
    S.trees = await AC.db.allTrees();
    const near = nearbyTrees(t);
    if (!near.length) return;
    const { o, d } = near[0];
    const ph = AC.app.photosOf(o.id);
    const th = ph.length ? ph[ph.length - 1].thumb : null;
    const s = sheet('<h3>Já existe uma árvore aqui</h3><div class="titem" style="margin:8px 0"><span class="thumb">' + (th ? '<img alt="" src="' + urlOf(th) + '">' : icon('leaf')) + '</span><span class="t-main"><span class="t-name"><span class="nm">' + esc(o.species || 'Não identificada') + '</span></span><span class="t-sub">' + esc(o.code || '') + ' · a ' + Math.round(d) + ' m daqui</span></span></div>' +
      '<p class="note">É a mesma árvore? Se for, as fotos entram como uma <b>nova visita</b> no histórico dela.</p>' +
      '<div class="row-btns"><button class="btn" data-d="same">É a mesma árvore</button><button class="btn sec" data-d="other">É outra árvore</button></div>', { locked: true });
    s.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-d]'); if (!b) return;
      s.close();
      if (b.dataset.d === 'other') { t.ignoreNearby = [...(t.ignoreNearby || []), ...near.map((x) => x.o.id)]; await saveNow(); }
      else await mergeInto(o);
    });
  }

  async function mergeInto(target) {
    const t = F.tree;
    const ps = F.photos;
    const v = { id: AC.db.uid(), date: ps.length ? Math.min(...ps.map((p) => p.takenAt || Date.now())) : Date.now(), notes: t.notes || '' };
    target.visits = target.visits || [];
    target.visits.push(v);
    for (const p of ps) { p.treeId = target.id; p.visitId = v.id; await AC.db.updatePhotoMeta(p); }
    await AC.db.saveTree(target);
    for (const p of ps) { try { await AC.stamp.restampPhoto(target, p); } catch (e) { /* segue */ } }
    await AC.db.del('trees', t.id);
    F.tree = null;
    toast('Fotos adicionadas ao histórico de ' + (target.species || target.code));
    AC.go('/a/' + target.id);
  }

  // ---------- fotos ----------
  function currentVisitId() {
    if (F.kind === 'visit') return F.visit.id;
    const vs = [...(F.tree.visits || [])].sort((a, b) => a.date - b.date);
    return vs.length ? vs[vs.length - 1].id : null;
  }
  function nextType() {
    const vid = currentVisitId();
    const used = new Set(F.photos.filter((p) => p.visitId === vid).map((p) => p.type));
    const t = TYPES.find((x) => x[0] !== 'outra' && !used.has(x[0]));
    return t ? t[0] : 'outra';
  }

  function addFiles(files, source) {
    files = [...files].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
    if (!files.length) return;
    F.queue = F.queue.then(() => processFiles(files, source)).catch((e) => { console.error(e); toast('Algo deu errado com a foto: ' + (e && e.message)); });
  }

  async function processFiles(files, source) {
    const t = F.tree;
    if (!t) return;
    F.busy++;
    setBusy(true);
    let added = 0, gotCoord = false, noGps = false;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (files.length > 1) toast('Processando foto ' + (i + 1) + ' de ' + files.length + '…', 60000);
        let exif = {};
        try { exif = G.readExif(await file.slice(0, 262144).arrayBuffer()); } catch (e) { /* sem EXIF */ }
        const takenAt = exif.date || (source === 'camera' ? Date.now() : file.lastModified || Date.now());
        if (!hasCoord(t) && F.kind === 'tree') {
          if (exif.lat != null) { await setCoord(exif.lat, exif.lon, null, 'exif'); gotCoord = true; }
          else if (source === 'camera') {
            toast('Pegando a posição do GPS…', 12000);
            const fix = await getFix(90000);
            if (fix) { await setCoord(fix.lat, fix.lng, fix.acc, 'gps'); gotCoord = true; }
            else noGps = true;
          } else noGps = true;
        }
        let r;
        try { r = await AC.stamp.process(file, { lat: t.lat, lng: t.lng, accuracy: t.accuracy, takenAt, place: AC.stamp.placeText(t) }); }
        catch (e) { toast('Não consegui abrir esta foto. Formato não suportado?'); continue; }
        if (F.kind === 'visit' && !F.visitPersisted) { t.visits.push(F.visit); F.visitPersisted = true; await saveNow(); }
        const meta = { id: AC.db.uid(), treeId: t.id, visitId: currentVisitId(), type: nextType(), takenAt, w: r.w, h: r.h, thumb: r.thumb, mime: file.type || 'image/jpeg', order: Date.now() + i, source };
        await AC.db.savePhoto(meta, { orig: file, stamped: r.stamped });
        F.photos.push(meta);
        S.photos.set(t.id, F.photos);
        added++;
        renderPhotos();
      }
    } finally { F.busy--; if (!F.busy) setBusy(false); }
    if (added) toast(added === 1 ? 'Foto adicionada' : added + ' fotos adicionadas');
    if (noGps && !hasCoord(t)) toast('Sem GPS nesta foto. Toque em “Atualizar GPS” ou “Marcar no mapa”.', 5200);
    if (gotCoord) await checkDuplicates();
    touch();
  }
  function setBusy(on) { document.querySelectorAll('[data-needidle]').forEach((b) => (b.disabled = on)); }

  // ---------- HTML ----------
  function sw(name, on, label, sub) {
    return '<div class="togrow"><div class="tg-t">' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div><button type="button" class="sw' + (on ? ' on' : '') + '" data-tog="' + name + '" role="switch" aria-checked="' + (!!on) + '" aria-label="' + esc(label) + '"></button></div>';
  }
  const opt = (v, cur, label) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label == null ? v : label) + '</option>';

  function photosHTML() {
    const ps = F.photos.filter((p) => F.kind === 'tree' || p.visitId === F.visit.id);
    let h = '<div class="row-btns" style="margin-top:0"><button class="btn" data-act="f-cam" data-needidle>' + icon('camera') + ' Tirar foto</button><button class="btn sec" data-act="f-gal" data-needidle>' + icon('image') + ' Escolher do celular</button></div>';
    h += '<p class="note">' + (F.kind === 'tree' ? 'Dica: tire uma da árvore inteira, depois folha, flor, fruto e tronco. A foto ganha o carimbo com data, UTM e local.' : 'A foto ganha o carimbo com a data e hora de agora.') + '</p>';
    if (ps.length) {
      h += '<div class="ph-edit">' + ps.map((p) => '<div class="pe"><img alt="" src="' + urlOf(p.thumb) + '"><button class="zoom" data-view="' + p.id + '" aria-label="Ver foto"></button><button class="rm" data-act="f-phdel" data-id="' + p.id + '" aria-label="Excluir foto">' + icon('x') + '</button>' +
        '<select data-ph="' + p.id + '" aria-label="Tipo da foto">' + TYPES.map((x) => opt(x[0], p.type, x[1])).join('') + '</select></div>').join('') + '</div>';
    }
    return h;
  }
  function renderPhotos() { const el = $id('photoSec'); if (el) el.innerHTML = photosHTML(); }

  function locHTML() {
    const t = F.tree;
    let h = '';
    if (hasCoord(t)) {
      h += '<div class="loc-line">' + icon('pin') + '<div><div class="mono">' + G.fmtLatLon(t.lat, t.lng) + '</div><div class="mono">UTM ' + esc(AC.stamp.utmText(t.lat, t.lng)) + '</div>' +
        '<div class="note" style="margin:2px 0 0">' + ({ gps: 'pelo GPS', exif: 'lida da foto', mapa: 'marcada no mapa', manual: 'digitada' }[t.coordSource] || '') + (t.accuracy ? ' · precisão ±' + Math.round(t.accuracy) + ' m' : '') + '</div></div></div>';
    } else h += '<div class="loc-line">' + icon('pin') + '<div>Sem coordenada ainda.<div class="note" style="margin:2px 0 0">Sem ela a árvore fica só na lista (não vai para o mapa nem para o Google Earth).</div></div></div>';
    h += '<div style="margin:6px 0"><span id="gpsBadge" class="accpill">Buscando GPS…</span></div>';
    h += '<div class="row-btns" style="margin-top:6px"><button class="btn sm" data-act="f-gps">' + icon('locate') + ' Atualizar GPS</button><button class="btn sm sec" data-act="f-map">' + icon('map') + ' Marcar no mapa</button>' +
      '<button class="btn sm sec" data-act="f-typecoord">' + icon('pencil') + ' Digitar</button>' + (hasCoord(t) ? '<button class="btn sm sec" data-act="f-nocoord">Sem coordenada</button>' : '') + '</div>';
    const cities = [...new Set(S.trees.map((x) => x.city).filter(Boolean))].sort();
    h += '<label class="lbl" for="fCity">Cidade</label><div class="grid2" style="grid-template-columns:1fr 92px"><input class="inp" id="fCity" data-f="city" data-place="1" list="cityList" autocomplete="off" value="' + esc(t.city) + '" placeholder="Ex.: Cachoeiro de Itapemirim"><select class="inp" data-f="state" data-place="1" aria-label="Estado"><option value="">UF</option>' + AC.place.UF_LIST.map((u) => opt(u, t.state)).join('') + '</select></div>';
    h += '<datalist id="cityList">' + cities.map((c) => '<option value="' + esc(c) + '">').join('') + '</datalist>';
    h += '<div class="grid2"><div><label class="lbl" for="fBairro">Bairro</label><input class="inp" id="fBairro" data-f="neighborhood" data-place="1" value="' + esc(t.neighborhood) + '" autocomplete="off"></div><div><label class="lbl" for="fRua">Rua</label><input class="inp" id="fRua" data-f="street" data-place="1" value="' + esc(t.street) + '" autocomplete="off"></div></div>';
    let st = '';
    if (hasCoord(t) && t.placePending) st = 'Cidade e bairro serão preenchidos sozinhos quando houver internet. Você também pode digitar.';
    else if (hasCoord(t) && !t.placeManual && (t.city || t.neighborhood)) st = 'Local descoberto pelo GPS. Corrija se precisar.';
    h += '<p class="note" id="placeStatus">' + st + '</p>';
    return h;
  }
  function renderLoc() { const el = $id('locSec'); if (el) { el.innerHTML = locHTML(); paintGps(); } }

  function speciesHTML() {
    const t = F.tree;
    let h = '<label class="lbl" for="fSpecies">Nome da árvore</label><input class="inp" id="fSpecies" data-f="species" value="' + esc(t.species) + '" autocomplete="off" placeholder="Comece a digitar: ipê, mangueira, oiti…"><div id="suggBox"></div>';
    h += sw('unid', t.identified === false, 'Ainda não sei qual é', 'Fica marcada para você identificar depois');
    if (t.species) h += '<label class="lbl" for="fSci">Nome científico</label><input class="inp" id="fSci" data-f="scientific" value="' + esc(t.scientific) + '" autocomplete="off">';
    if (t.speciesNote) h += '<p class="note">' + esc(t.speciesNote) + '</p>';
    if (t.species && !t.speciesFromList) h += '<button class="btn sm sec" style="margin-top:8px" data-act="f-lookup">' + icon('search') + ' Buscar informações na internet</button>';
    h += '<div class="grid2"><div><label class="lbl" for="fOrigin">Origem</label><select class="inp" id="fOrigin" data-f="origin" data-conf="originConfirm">' + opt('', t.origin, 'Não sei') + opt('N', t.origin, 'Nativa do Brasil') + opt('E', t.origin, 'Exótica') + '</select></div>' +
      '<div><label class="lbl" for="fFruit">Frutífera</label><select class="inp" id="fFruit" data-f="fruit" data-conf="fruitConfirm">' + opt('', t.fruit, 'Não sei') + opt('S', t.fruit, 'Sim') + opt('N', t.fruit, 'Não') + '</select></div></div>';
    if (t.originConfirm || (t.fruitConfirm && t.fruit)) h += '<p class="note warn">Informação vinda de busca ou com dúvida: vale confirmar.</p>';
    h += sw('medicinal', t.medicinal, 'Medicinal') + sw('threatened', t.threatened, 'Ameaçada de extinção');
    return h;
  }
  function renderSpecies() { const el = $id('spSec'); if (el) el.innerHTML = speciesHTML(); }

  function bloomHTML() {
    const t = F.tree;
    let h = sw('flowering', t.flowering, 'Com flores agora');
    if (t.flowering) h += '<label class="lbl" for="fFlorC">Cor da flor</label><input class="inp" id="fFlorC" data-f="flowerColor" value="' + esc(t.flowerColor) + '" placeholder="Ex.: amarela" autocomplete="off">';
    h += sw('fruiting', t.fruiting, 'Com frutos agora');
    return h;
  }
  function riskHTML() {
    const cur = F.tree.risks || [];
    return AC.RISKS.map((r, i) => '<button type="button" class="chip' + (cur.includes(r) ? ' on' : '') + '" data-act="f-risk" data-i="' + i + '">' + esc(r) + '</button>').join('');
  }
  function renderBloom() { const el = $id('bloomSec'); if (el) el.innerHTML = bloomHTML(); }

  function formHTML() {
    const t = F.tree;
    const isVisit = F.kind === 'visit';
    const title = isVisit ? 'Nova visita' : t.draft ? 'Nova árvore' : 'Editar árvore';
    let h = AC.topBar(title, isVisit ? (t.species || t.code || '') : (t.code || 'Salvamento automático'), {
      back: true,
      right: isVisit ? '' : '<button class="ibtn' + (t.favorite ? ' on' : '') + '" data-act="f-fav" aria-label="Favorita">' + starIcon(t.favorite) + '</button>',
    });
    h += '<main class="page">';
    h += '<input id="inCam" type="file" accept="image/*" capture="environment" hidden><input id="inGal" type="file" accept="image/*" multiple hidden>';
    if (isVisit) {
      h += '<section class="card tape"><h3>Quando</h3><label class="lbl" for="fVDate">Data e hora da visita</label><input class="inp" id="fVDate" type="datetime-local" data-f="visitDate" value="' + G.toLocalInput(F.visit.date) + '"></section>';
      h += '<section class="card"><h3>Fotos desta visita</h3><div id="photoSec">' + photosHTML() + '</div></section>';
      h += '<section class="card"><h3>Como está hoje</h3><div id="bloomSec">' + bloomHTML() + '</div><label class="lbl" for="fVNotes">Anotação da visita</label><textarea class="inp" id="fVNotes" data-f="visitNotes" placeholder="O que mudou desde a última vez?">' + esc(F.visit.notes) + '</textarea></section>';
    } else {
      h += '<section class="card tape"><h3>Fotos</h3><div id="photoSec">' + photosHTML() + '</div></section>';
      h += '<section class="card"><h3>Onde está</h3><div id="locSec">' + locHTML() + '</div></section>';
      h += '<section class="card"><h3>Qual árvore é</h3><div id="spSec">' + speciesHTML() + '</div></section>';
      h += '<section class="card"><h3>Porte</h3><div class="grid3"><div><label class="lbl" for="fH">Altura (m)</label><input class="inp" id="fH" data-f="height" inputmode="decimal" value="' + esc(t.height) + '" placeholder="8"></div>' +
        '<div><label class="lbl" for="fT">Tronco (cm)</label><input class="inp" id="fT" data-f="trunk" inputmode="decimal" value="' + esc(t.trunk) + '" placeholder="40"></div>' +
        '<div><label class="lbl" for="fC">Copa (m)</label><input class="inp" id="fC" data-f="crown" inputmode="decimal" value="' + esc(t.crown) + '" placeholder="5"></div></div><p class="note">Medidas aproximadas servem. Tronco = diâmetro à altura do peito.</p></section>';
      h += '<section class="card"><h3>Flores e frutos</h3><div id="bloomSec">' + bloomHTML() + '</div></section>';
      h += '<section class="card"><h3>Estado e local</h3><label class="lbl" for="fHealth">Estado da árvore</label><select class="inp" id="fHealth" data-f="health">' + opt('', t.health, 'Não informado') + AC.HEALTH.map((x) => opt(x, t.health)).join('') + '</select>' +
        '<label class="lbl">Atenção e manejo <small>(marque o que se aplica)</small></label><div class="chips wrap" id="riskSec">' + riskHTML() + '</div>' +
        '<label class="lbl" for="fPT">Tipo de local</label><select class="inp" id="fPT" data-f="placeType">' + opt('', t.placeType, 'Não informado') + AC.PLACE_TYPES.map((x) => opt(x, t.placeType)).join('') + '</select>' +
        '<label class="lbl" for="fNotes">Observações</label><textarea class="inp" id="fNotes" data-f="notes" placeholder="O que chamou sua atenção nesta árvore?">' + esc(t.notes) + '</textarea></section>';
      h += '<button class="btn danger block" style="margin-top:6px" data-act="f-del">' + icon('trash') + (t.draft ? ' Descartar este cadastro' : ' Excluir esta árvore') + '</button>';
    }
    h += '<div class="savebar"><span class="saved" id="saveState">' + icon('check') + ' Salva sozinho</span><button class="btn" data-act="f-finish" data-needidle>' + icon('check') + ' ' + (isVisit ? 'Concluir visita' : t.draft ? 'Concluir cadastro' : 'Pronto') + '</button></div>';
    h += '</main>';
    return h;
  }

  // ---------- abrir ----------
  async function open(id, kind) {
    bind();
    await AC.app.refresh();
    const t = AC.app.treeById(id);
    if (!t) { AC.go('/'); return; }
    F.tree = t; F.kind = kind; F.queue = Promise.resolve(); F.busy = 0; F.gps.last = F.gps.last && Date.now() - F.gps.last.ts < 120000 ? F.gps.last : null;
    F.photos = [...AC.app.photosOf(t.id)];
    S.photos.set(t.id, F.photos);
    F.visit = null; F.visitPersisted = false;
    if (kind === 'visit') F.visit = { id: AC.db.uid(), date: Date.now(), notes: '' };
    if (kind === 'tree' && !t.visits.length) t.visits.push({ id: AC.db.uid(), date: t.createdAt, notes: '' });
    document.getElementById('app').innerHTML = formHTML();
    if (kind === 'tree' && !hasCoord(t)) startGps();
    paintGps();
    S.cleanup = () => { stopGps(); flushNow(); if (F.tree) AC.db.saveTree(F.tree).catch(() => {}); F.tree = null; };
  }

  function bind() {
    if (bound) return; bound = true;
    const app = document.getElementById('app');
    app.addEventListener('input', onInput);
    app.addEventListener('change', onChange);
    document.addEventListener('visibilitychange', () => { if (document.hidden && F.tree) { saveSoon.flush(); } });
    window.addEventListener('pagehide', () => { if (F.tree) saveSoon.flush(); });
  }

  // ---------- eventos ----------
  function suggestions(q) {
    const box = $id('suggBox'); if (!box) return;
    const list = q.trim().length >= 1 && !F.tree.speciesFromList ? AC.species.search(q, 6) : [];
    box.innerHTML = list.length ? '<div class="sugg">' + list.map((s, i) => '<button type="button" data-act="f-pick" data-i="' + AC.species.list.indexOf(s) + '">' + esc(s.name) + '<small>' + esc(s.sci) + ' · ' + esc(AC.species.ORIGIN[s.origin]) + '</small></button>').join('') + '</div>' : '';
  }

  function applySpecies(sp) {
    const t = F.tree;
    t.species = sp.name; t.scientific = sp.sci; t.speciesFromList = true; t.identified = true;
    t.origin = sp.origin === 'C' ? '' : sp.origin; t.originConfirm = sp.origin === 'C';
    t.fruit = sp.fruit; t.fruitConfirm = false; t.speciesNote = sp.note || '';
    if (/ameaçada|vulnerável/i.test(sp.note || '')) t.threatened = true;
    touch(); renderSpecies();
  }

  function onInput(e) {
    if (!F.tree) return;
    const el = e.target, f = el.dataset && el.dataset.f;
    if (!f) return;
    const t = F.tree;
    if (f === 'visitDate') { const ms = new Date(el.value).getTime(); if (isFinite(ms)) F.visit.date = ms; if (F.visitPersisted) { const v = t.visits.find((x) => x.id === F.visit.id); if (v) v.date = F.visit.date; touch(); } return; }
    if (f === 'visitNotes') { F.visit.notes = el.value; if (!F.visitPersisted && el.value.trim()) { t.visits.push(F.visit); F.visitPersisted = true; } touch(); return; }
    if (el.dataset.place) {
      t[f] = el.value; t.placeManual = true; t.placePending = !t.city;
      restampSoon(); touch(); return;
    }
    t[f] = el.value;
    if (f === 'species') {
      const ex = AC.species.exact(el.value);
      if (ex && ex._n === AC.species.norm(el.value)) { /* sugestão exata: aplicar só ao tocar */ }
      if (t.speciesFromList) { t.speciesFromList = false; t.speciesNote = ''; }
      suggestions(el.value);
      if (el.value.trim()) t.identified = true;
    }
    touch();
  }

  function onChange(e) {
    if (!F.tree) return;
    const el = e.target;
    if (el.id === 'inCam') { addFiles(el.files, 'camera'); el.value = ''; return; }
    if (el.id === 'inGal') { addFiles(el.files, 'galeria'); el.value = ''; return; }
    if (el.dataset && el.dataset.ph) {
      const p = F.photos.find((x) => x.id === el.dataset.ph);
      if (p) { p.type = el.value; AC.db.updatePhotoMeta(p); touch(); }
      return;
    }
    const f = el.dataset && el.dataset.f;
    if (!f) return;
    const t = F.tree;
    if (el.dataset.place) { t[f] = el.value; t.placeManual = true; t.placePending = !t.city; restampSoon(); touch(); return; }
    if (el.dataset.conf) { t[f] = el.value; t[el.dataset.conf] = false; touch(); renderSpecies(); return; }
    if (f === 'species') {
      const ex = AC.species.exact(el.value);
      if (ex && !t.speciesFromList && AC.species.norm(el.value) === ex._n) applySpecies(ex);
    }
  }

  // ---------- ações ----------
  async function pickOnMap() {
    const t = F.tree;
    const s = sheet('<h3>Marcar no mapa</h3><p class="note">Arraste o mapa até a cruz vermelha ficar sobre a árvore. Use + e − para aproximar.</p><div class="mapbox" id="pickMap" style="height:52vh"></div><div class="row-btns"><button class="btn ghost" data-close>Cancelar</button><button class="btn" data-use>Usar este ponto</button></div>', { locked: true });
    const el = s.el.querySelector('#pickMap');
    const m = new AC.SimpleMap(el, { crosshair: true });
    let lat = -15.78, lng = -47.93, zoom = 4;
    const sameCity = S.trees.filter((x) => x.id !== t.id && x.city && x.city === t.city && hasCoord(x));
    if (hasCoord(t)) { lat = t.lat; lng = t.lng; zoom = 18; }
    else if (F.gps.last) { lat = F.gps.last.lat; lng = F.gps.last.lng; zoom = 17; }
    else if (sameCity.length) { lat = sameCity[0].lat; lng = sameCity[0].lng; zoom = 14; }
    m.setView(lat, lng, zoom);
    if (F.gps.last) m.setMe(F.gps.last.lat, F.gps.last.lng);
    s.el.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-use]')) return;
      const c = m.getCenter();
      m.destroy(); s.close();
      await setCoord(c.lat, c.lng, null, 'mapa');
      await checkDuplicates();
    });
  }

  function typeCoord() {
    const t = F.tree;
    const s = sheet('<h3>Digitar coordenada</h3><p class="note">Aceita graus decimais (-20,8467) ou graus, minutos e segundos (20°50\'48"S).</p>' +
      '<label class="lbl" for="cLat">Latitude</label><input class="inp" id="cLat" inputmode="text" autocomplete="off" placeholder="-20,846700" value="' + (hasCoord(t) ? t.lat.toFixed(6) : '') + '">' +
      '<label class="lbl" for="cLng">Longitude</label><input class="inp" id="cLng" inputmode="text" autocomplete="off" placeholder="-41,112800" value="' + (hasCoord(t) ? t.lng.toFixed(6) : '') + '">' +
      '<p class="note warn" id="cErr"></p><div class="row-btns"><button class="btn ghost" data-close>Cancelar</button><button class="btn" data-ok>Usar</button></div>');
    s.el.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-ok]')) return;
      const lat = G.parseCoordNumber(s.el.querySelector('#cLat').value), lng = G.parseCoordNumber(s.el.querySelector('#cLng').value);
      if (!G.validCoord(lat, lng) || (lat === 0 && lng === 0)) { s.el.querySelector('#cErr').textContent = 'Não entendi essa coordenada. Confira os números.'; return; }
      s.close();
      await setCoord(lat, lng, null, 'manual');
      await checkDuplicates();
    });
  }

  async function lookup() {
    const t = F.tree;
    if (navigator.onLine === false) { toast('Sem internet agora. Preencha na mão ou tente depois.'); return; }
    toast('Buscando na internet…', 15000);
    let r = null;
    try { r = await AC.species.lookupOnline(t.species); } catch (e) { /* sem resposta */ }
    if (!r) { toast('Não encontrei informações. Você pode preencher na mão.', 4500); return; }
    toast('Encontrei algo', 1200);
    const s = sheet('<h3>' + esc(t.species) + '</h3>' + (r.scientific ? '<div class="sci">' + esc(r.scientific) + (r.family ? ' · ' + esc(r.family) : '') + '</div>' : '') +
      '<p><b>Origem:</b> ' + (r.origin === 'N' ? 'Nativa do Brasil' : r.origin === 'E' ? 'Exótica' : 'Não consegui confirmar') + (r.originNote ? '<br><span class="note">' + esc(r.originNote) + '</span>' : '') + '</p>' +
      (r.info ? '<p class="note">' + esc(r.info) + '</p>' : '') + (r.link ? '<p><a href="' + esc(r.link) + '" target="_blank" rel="noopener">Ler mais na Wikipédia</a></p>' : '') +
      '<p class="note warn">Busca automática nem sempre acerta. Marcamos como “confirmar”.</p><div class="row-btns"><button class="btn ghost" data-close>Fechar</button><button class="btn" data-use>Usar estas informações</button></div>');
    s.el.addEventListener('click', (e) => {
      if (!e.target.closest('[data-use]')) return;
      if (r.scientific) t.scientific = r.scientific;
      if (r.origin === 'N' || r.origin === 'E') { t.origin = r.origin; t.originConfirm = true; }
      t.speciesNote = r.originNote || t.speciesNote || '';
      touch(); renderSpecies(); s.close();
    });
  }

  async function finish() {
    const t = F.tree;
    if (!t) return;
    if (F.busy) { toast('Aguarde a foto terminar de processar'); return; }
    saveSoon.flush();
    if (F.kind === 'visit') {
      if (!F.visitPersisted) { AC.go('/a/' + t.id); return; }
      t.flowering = !!t.flowering; t.fruiting = !!t.fruiting;
      await AC.db.saveTree(t);
      toast('Visita registrada');
      AC.go('/a/' + t.id); return;
    }
    if (t.draft) {
      if (!F.photos.length && !t.species && !(t.notes || '').trim()) {
        if (!(await confirmBox('Cadastro vazio', 'Sem fotos, nome ou anotações. Concluir mesmo assim?', 'Concluir'))) return;
      }
      if (!hasCoord(t) && !t.city) {
        if (!(await confirmBox('Sem coordenada e sem cidade', 'A árvore ficará em “Local pendente” até você informar a cidade. Concluir mesmo assim?', 'Concluir'))) return;
      }
      t.draft = false;
      t.code = await AC.db.nextCode();
      if (F.photos.length) t.visits[0].date = Math.min(...F.photos.map((p) => p.takenAt || t.createdAt));
      if (hasCoord(t) && !t.city) t.placePending = true;
    }
    await AC.db.saveTree(t);
    if (t.placePending && navigator.onLine !== false) AC.place.processPending().catch(() => {});
    toast(t.code ? 'Árvore ' + t.code + ' salva' : 'Salvo');
    AC.go('/a/' + t.id);
  }

  const actions = {
    'f-cam': () => $id('inCam') && $id('inCam').click(),
    'f-gal': () => $id('inGal') && $id('inGal').click(),
    'f-gps': async () => {
      toast('Pegando a posição do GPS…', 12000);
      const fix = await getFix(0);
      if (!fix) { toast('Não consegui o GPS. Verifique a permissão de localização.', 4500); return; }
      await setCoord(fix.lat, fix.lng, fix.acc, 'gps');
      toast('Posição atualizada');
      await checkDuplicates();
    },
    'f-risk': (el) => {
      const t = F.tree; if (!t) return; t.risks = t.risks || [];
      const r = AC.RISKS[+el.dataset.i], k = t.risks.indexOf(r);
      if (k >= 0) t.risks.splice(k, 1); else t.risks.push(r);
      el.classList.toggle('on'); touch();
    },
    'f-map': pickOnMap,
    'f-typecoord': typeCoord,
    'f-nocoord': async () => {
      if (!(await confirmBox('Remover a coordenada?', 'A árvore continua na cidade que você informar, mas some do mapa e do Google Earth.', 'Remover', { danger: true }))) return;
      const t = F.tree; t.lat = null; t.lng = null; t.accuracy = null; t.coordSource = '';
      t.placeManual = true; t.placePending = !t.city;
      await saveNow(); if (F.photos.length) AC.stamp.restampTree(t).catch(() => {}); renderLoc();
    },
    'f-lookup': lookup,
    'f-pick': (el) => applySpecies(AC.species.list[parseInt(el.dataset.i, 10)]),
    'f-phdel': async (el) => {
      if (!(await confirmBox('Excluir esta foto?', 'A foto original e a carimbada serão apagadas.', 'Excluir', { danger: true }))) return;
      await AC.db.deletePhoto(el.dataset.id);
      F.photos = F.photos.filter((p) => p.id !== el.dataset.id);
      S.photos.set(F.tree.id, F.photos);
      renderPhotos();
    },
    'f-fav': (el) => { F.tree.favorite = !F.tree.favorite; el.classList.toggle('on', F.tree.favorite); el.innerHTML = starIcon(F.tree.favorite); touch(); },
    'f-finish': finish,
    'f-del': async () => {
      const t = F.tree;
      if (!(await confirmBox(t.draft ? 'Descartar este cadastro?' : 'Excluir esta árvore?', 'Todas as fotos e dados dela serão apagados deste aparelho. Não dá para desfazer.', t.draft ? 'Descartar' : 'Excluir', { danger: true }))) return;
      const id = t.id; F.tree = null; S.cleanup = () => stopGps();
      await AC.db.deleteTree(id);
      AC.go('/');
    },
  };

  // interruptores (delegados)
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.sw[data-tog]');
    if (!b || !F.tree || !document.getElementById('app').contains(b)) return;
    const k = b.dataset.tog, t = F.tree;
    if (k === 'unid') { t.identified = t.identified === false; b.classList.toggle('on', t.identified === false); touch(); return; }
    t[k] = !t[k]; b.classList.toggle('on', !!t[k]); b.setAttribute('aria-checked', String(!!t[k]));
    if (k === 'flowering') renderBloom();
    touch();
  });

  AC.form = { open, actions, _F: F };
})(typeof window !== 'undefined' ? window : globalThis);
