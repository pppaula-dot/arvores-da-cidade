/* Árvores Urbanas — app.js
   Núcleo: dados em memória, rotas, tela inicial, cidade, detalhe da árvore e visualizador de fotos. */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const { esc, icon, starIcon, toast, sheet, confirmBox, urlOf } = AC.ui;
  const G = AC.geo;
  const VERSION = '1.0.17 (teste)';
  AC.VERSION = VERSION;

  const S = (AC.S = {
    trees: [], photos: new Map(), cleanup: null, deferredPrompt: null,
    city: { key: '', tab: 'lista', q: '', bairro: '', species: '', flags: new Set() },
    homeQ: '', homeMode: 'cidades', homeSel: '', homeFlag: '',
  });

  const HEALTH = ['Boa', 'Regular', 'Ruim', 'Seca ou morta', 'Podada em excesso', 'Com praga ou doença'];
  const PLACE_TYPES = ['Calçada', 'Praça', 'Parque', 'Canteiro central', 'Quintal ou jardim', 'Margem de rio ou lago', 'Mata', 'Outro'];
  AC.HEALTH = HEALTH; AC.PLACE_TYPES = PLACE_TYPES;
  AC.RISKS = ['Risco de queda', 'Doente ou com pragas', 'Precisa de poda', 'Atrapalha a fiação', 'Raízes danificam a calçada', 'Oca ou apodrecida'];

  // ---------- dados ----------
  async function refresh() {
    S.trees = await AC.db.allTrees();
    const ps = await AC.db.allPhotos();
    S.photos = new Map();
    ps.forEach((p) => { if (!S.photos.has(p.treeId)) S.photos.set(p.treeId, []); S.photos.get(p.treeId).push(p); });
    S.photos.forEach((a) => a.sort((x, y) => (x.takenAt || 0) - (y.takenAt || 0) || (x.order || 0) - (y.order || 0)));
  }
  const done = () => S.trees.filter((t) => !t.draft);
  const drafts = () => S.trees.filter((t) => t.draft).sort((a, b) => b.updatedAt - a.updatedAt);
  const treeById = (id) => S.trees.find((t) => t.id === id);
  const photosOf = (id) => S.photos.get(id) || [];
  const cityKey = (t) => AC.exp.cityKey(t);
  const nameOf = (t) => t.species || 'Não identificada';
  const hasCoord = (t) => G.validCoord(t.lat, t.lng);

  function cover(t) {
    const ps = photosOf(t.id);
    const p = [...ps].reverse().find((x) => x.type === 'inteira') || ps[0];
    return p ? p.thumb : null;
  }
  function thumbHTML(t) {
    const b = cover(t);
    return '<span class="thumb">' + (b ? '<img alt="" src="' + urlOf(b) + '">' : icon('leaf')) + '</span>';
  }
  function badgesHTML(t) {
    let b = '';
    if (t.origin === 'N') b += '<span class="badge nat' + (t.originConfirm ? ' cf' : '') + '">Nativa</span>';
    else if (t.origin === 'E') b += '<span class="badge exo' + (t.originConfirm ? ' cf' : '') + '">Exótica</span>';
    if (t.fruit === 'S') b += '<span class="badge fru">Frutífera</span>';
    if (!t.species) b += '<span class="badge warn">Não identificada</span>';
    if ((t.risks || []).length) b += '<span class="badge warn">Atenção</span>';
    if (!hasCoord(t)) b += '<span class="badge warn">Sem coordenada</span>';
    if (t.placePending) b += '<span class="badge warn">Local pendente</span>';
    const n = (t.visits || []).length;
    if (n > 1) b += '<span class="badge">' + n + ' visitas</span>';
    return b ? '<div class="badges">' + b + '</div>' : '';
  }
  function treeItemHTML(t, extra) {
    const sub = [t.street, t.neighborhood].filter(Boolean).join(' · ') || (t.city ? cityKey(t) : 'Local ainda não informado');
    return '<button class="titem" data-go="/a/' + t.id + '">' + thumbHTML(t) +
      '<span class="t-main"><span class="t-name"><span class="nm">' + esc(nameOf(t)) + '</span>' + (t.favorite ? '<span class="st">' + starIcon(true) + '</span>' : '') + '</span>' +
      (extra ? '<span class="t-sub" style="display:block"><b>' + esc(extra) + '</b></span>' : '') + '<span class="t-sub">' + esc(sub) + '</span>' + badgesHTML(t) + '</span></button>';
  }
  const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);

  // ---------- rotas ----------
  const view = () => document.getElementById('app');
  function go(path) { if (location.hash === '#' + path) render(); else location.hash = path; }
  AC.go = go;
  function back(fallback) { if (history.length > 1 && !AC.noBack) history.back(); else go(fallback || '/'); }

  let lastPath = null, lastFirst = '';
  async function render() {
    if (S.cleanup) { try { S.cleanup(); } catch (e) { /* ok */ } S.cleanup = null; }
    const raw = decodeURIComponent((location.hash || '#/').slice(1)) || '/';
    const parts = raw.split('/').filter(Boolean);
    const first = parts[0] || '';
    const el = view();
    el.className = '';
    try {
      if (first === '') await renderHome();
      else if (first === 'c') { if (!['c', 'a'].includes(lastFirst)) S.city.key = ''; await renderCity(parts.slice(1).join('/')); }
      else if (first === 'a') await renderDetail(parts[1]);
      else if (first === 'editar') await AC.form.open(parts[1], 'tree');
      else if (first === 'visita') await AC.form.open(parts[1], 'visit');
      else if (first === 'numeros') await AC.more.renderStats(parts.slice(1).join('/'));
      else if (first === 'perto') await renderNearby();
      else if (first === 'mais') await AC.more.renderSettings();
      else await renderHome();
    } catch (e) {
      console.error(e);
      el.innerHTML = '<div class="page"><div class="card"><h2>Algo deu errado</h2><p class="note">' + esc(e && e.message) + '</p><button class="btn" data-go="/">Voltar ao início</button></div></div>';
    }
    if (lastPath !== raw && !(lastPath && lastPath.split('/')[1] === raw.split('/')[1] && first === 'c')) window.scrollTo(0, 0);
    lastPath = raw; lastFirst = first;
  }
  AC.render = render;

  // ---------- tela inicial ----------
  function topBar(title, sub, opts) {
    opts = opts || {};
    return '<header class="top">' + (opts.back ? '<button class="ibtn" data-act="back" aria-label="Voltar">' + icon('back') + '</button>' : '<span style="width:6px"></span>') +
      '<h1' + (String(title).length > 17 ? ' class="long"' : '') + '>' + esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</h1>' + (opts.right || '') + '</header>';
  }
  AC.topBar = topBar;

  async function backupBanner() {
    const n = done().length;
    if (!n) return '';
    const last = await AC.db.getMeta('lastBackup', 0);
    const changed = last ? done().filter((t) => (t.updatedAt || 0) > last).length : n;
    const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
    const when = last ? (days === 0 ? 'hoje ' : days === 1 ? 'ontem ' : 'há ' + days + ' dias, ') + G.fmtTime(last) : 'nunca';
    const precisa = last ? (changed >= 5 || (days >= 7 && changed >= 1)) : n >= 3;
    if (precisa) {
      const txt = last ? 'Você tem ' + changed + (changed === 1 ? ' árvore nova ou alterada' : ' árvores novas ou alteradas') + ' desde o último backup (' + when + '). Se o celular se perder, elas se perdem.' : 'Você ainda não fez backup. Se o celular for trocado, perdido ou o app apagado, os registros se perdem.';
      return '<div class="banner warn"><span>' + icon('save') + '</span><div class="b-txt">' + txt + '<div class="b-act"><button class="btn sm" data-act="backup-now">Fazer backup agora</button></div></div></div>';
    }
    return '<button class="bk-line" data-act="backup-now">' + icon('save') + '<span>Último backup: ' + when + '</span><b>Fazer agora</b></button>';
  }

  async function renderHome() {
    await refresh();
    // cadastros vazios (abriu "Nova árvore" e voltou sem preencher nada) não ficam sobrando
    const vazios = drafts().filter((t) => !photosOf(t.id).length && !t.species && !t.notes && !hasCoord(t) && !t.street && !t.neighborhood);
    if (vazios.length) { for (const t of vazios) await AC.db.deleteTree(t.id); await refresh(); }
    const items = done(), dr = drafts();
    const groups = new Map();
    items.forEach((t) => { const k = cityKey(t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); });
    const keys = [...groups.keys()].sort((a, b) => (a === 'Local pendente') - (b === 'Local pendente') || a.localeCompare(b));
    const speciesN = new Set(items.filter((t) => t.species).map((t) => t.species.toLowerCase())).size;
    const sub = items.length ? plural(items.length, 'árvore', 'árvores') + ' · ' + plural(groups.size - (groups.has('Local pendente') ? 1 : 0), 'cidade', 'cidades') + ' · ' + plural(speciesN, 'espécie', 'espécies') : 'Seu caderno de árvores';
    let h = topBar('Árvores Urbanas', sub, { right: '<button class="ibtn" data-act="menu" aria-label="Menu">' + icon('more') + '</button>' });
    h += '<main class="page">';
    dr.forEach((t) => {
      h += '<div class="banner leafy"><span>' + icon('pencil') + '</span><div class="b-txt"><b>Cadastro em andamento</b><br>' + esc(t.species || 'Árvore sem nome ainda') + ' · ' + photosOf(t.id).length + ' foto(s)' +
        '<div class="b-act"><button class="btn sm" data-go="/editar/' + t.id + '">Continuar</button><button class="btn sm sec" data-act="discard" data-id="' + t.id + '">Descartar</button></div></div></div>';
    });
    h += await backupBanner();
    const pend = items.filter((t) => t.placePending && hasCoord(t)).length;
    if (pend) h += '<div class="banner"><span>' + icon('pin') + '</span><div class="b-txt">' + plural(pend, 'árvore está', 'árvores estão') + ' esperando internet para descobrir a cidade e o bairro. Isso acontece sozinho quando o celular conectar.' +
      '<div class="b-act"><button class="btn sm sec" data-act="resolve-places">Tentar agora</button></div></div></div>';
    if (items.length) {
      h += '<label class="searchbox">' + icon('search') + '<input id="homeSearch" type="search" placeholder="Buscar espécie, rua, bairro…" value="' + esc(S.homeQ) + '" autocomplete="off"></label>';
      h += homeControls();
      h += '<div id="homeBody">' + homeBody(groups, keys) + '</div>';
    } else if (!dr.length) {
      h += '<div class="empty">' + icon('leaf') + '<div class="big">Seu caderno está vazio</div><p>Toque em <b>Nova árvore</b>, tire uma foto ou escolha uma do celular. O app descobre sozinho a cidade e o bairro pelo GPS.</p></div>';
    }
    if (S.deferredPrompt) h += '<div class="card"><h3>Instalar na tela inicial</h3><p class="note">Abre como um aplicativo, sem barra do navegador, e funciona sem internet.</p><button class="btn block" data-act="install">Instalar o app</button></div>';
    else if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone) h += '<div class="card"><h3>Instalar no iPhone</h3><p class="note">Toque em <b>Compartilhar</b> (quadrado com seta) e depois em <b>Adicionar à Tela de Início</b>.</p></div>';
    h += '<p class="credit">Criado por @paulapmiranda · © ' + new Date().getFullYear() + '</p></main><button class="btn fab" data-act="new-tree">' + icon('plus') + ' Nova árvore</button>';
    view().innerHTML = h;
    const inp = document.getElementById('homeSearch');
    if (inp) inp.addEventListener('input', () => {
      S.homeQ = inp.value;
      const body = document.getElementById('homeBody');
      const gs = new Map(); done().forEach((t) => { const k = cityKey(t); if (!gs.has(k)) gs.set(k, []); gs.get(k).push(t); });
      body.innerHTML = homeBody(gs, [...gs.keys()].sort((a, b) => (a === 'Local pendente') - (b === 'Local pendente') || a.localeCompare(b)));
    });
  }

  const norm = (s) => AC.species.norm(s);
  function matchTree(t, q) {
    const n = norm(q); if (!n) return true;
    const hay = norm([t.species, t.scientific, t.street, t.neighborhood, t.city, t.code, t.notes, t.health, (t.risks || []).join(' '), t.placeType].join(' '));
    return n.split(' ').every((w) => hay.includes(w));
  }

  const HFLAGS = [['fav', 'Favoritas', 'star'], ['flor', 'Com flores'], ['fruto', 'Com frutos']];
  function homeControls() {
    let h = '<div class="seg">';
    [['cidades', 'Cidades', 'map'], ['especies', 'Espécies', 'leaf'], ['bairros', 'Bairros', 'pin']].forEach((m) => {
      h += '<button data-act="home-mode" data-v="' + m[0] + '" class="' + (S.homeMode === m[0] && !S.homeFlag ? 'on' : '') + '">' + (m[2] ? icon(m[2]) : '') + ' ' + m[1] + '</button>';
    });
    h += '</div><div class="chips wrap">';
    HFLAGS.forEach((f) => { h += '<button class="chip' + (S.homeFlag === f[0] ? ' on' : '') + '" data-act="home-flag" data-v="' + f[0] + '">' + (f[2] ? icon(f[2]) : '') + f[1] + (S.homeFlag === f[0] ? ' ✕' : '') + '</button>'; });
    h += '<button class="chip" data-go="/perto">' + icon('pin') + 'Perto de mim</button></div>';
    return h;
  }
  function homeGroupKey(t, mode) {
    if (mode === 'especies') return t.species || 'Não identificada';
    return (t.neighborhood || 'Sem bairro') + ' · ' + cityKey(t);
  }
  const homeFlagOk = (t, f) => (f === 'fav' ? t.favorite : f === 'flor' ? t.flowering : f === 'fruto' ? t.fruiting : f === 'risco' ? (t.risks || []).length : f === 'unk' ? !t.species : true);

  function homeBody(groups, keys) {
    const q = S.homeQ.trim();
    const list = (res, title) => '<p class="count-line">' + title + '</p><div class="trees">' + res.map((t) => treeItemHTML(t)).join('') + '</div>';
    if (q) {
      const res = done().filter((t) => matchTree(t, q)).sort((a, b) => b.updatedAt - a.updatedAt);
      if (!res.length) return '<p class="note">Nada encontrado para “' + esc(q) + '”.</p>';
      return list(res, plural(res.length, 'árvore encontrada', 'árvores encontradas'));
    }
    if (S.homeFlag) {
      const name = (HFLAGS.find((f) => f[0] === S.homeFlag) || [0, ''])[1];
      const res = done().filter((t) => homeFlagOk(t, S.homeFlag)).sort((a, b) => b.updatedAt - a.updatedAt);
      if (!res.length) return '<p class="note">Nenhuma árvore em “' + esc(name) + '” por enquanto.</p>';
      return list(res, plural(res.length, 'árvore', 'árvores') + ' · ' + esc(name));
    }
    if (S.homeMode !== 'cidades') {
      const all = done();
      if (S.homeSel) {
        const res = all.filter((t) => homeGroupKey(t, S.homeMode) === S.homeSel).sort((a, b) => b.updatedAt - a.updatedAt);
        return '<button class="btn sm sec" data-act="home-sel" data-v="">← ' + (S.homeMode === 'especies' ? 'Todas as espécies' : 'Todos os bairros') + '</button>' +
          list(res, '<b>' + esc(S.homeSel) + '</b> · ' + plural(res.length, 'árvore', 'árvores'));
      }
      const g = new Map();
      all.forEach((t) => { const k = homeGroupKey(t, S.homeMode); if (!g.has(k)) g.set(k, []); g.get(k).push(t); });
      const ks = [...g.keys()].sort((a, b) => (/^(Não identificada|Sem bairro)/.test(a) ? 1 : 0) - (/^(Não identificada|Sem bairro)/.test(b) ? 1 : 0) || a.localeCompare(b));
      return '<div class="cities">' + ks.map((k) => {
        const ts = g.get(k);
        const small = S.homeMode === 'especies'
          ? plural(new Set(ts.map((t) => cityKey(t))).size, 'cidade', 'cidades')
          : plural(new Set(ts.map((t) => (t.species || '').toLowerCase()).filter(Boolean)).size, 'espécie', 'espécies');
        return '<button class="city" data-act="home-sel" data-v="' + esc(k) + '"><span class="c-name">' + esc(k) + '<small>' + small + '</small></span><span class="c-n">' + ts.length + '</span></button>';
      }).join('') + '</div>';
    }
    return '<div class="cities">' + keys.map((k) => {
      const ts = groups.get(k), pend = k === 'Local pendente';
      const sp = new Set(ts.filter((t) => t.species).map((t) => t.species.toLowerCase())).size;
      return '<button class="city' + (pend ? ' pend' : '') + '" data-go="/c/' + encodeURIComponent(k) + '"><span class="c-name">' + esc(k) + '<small>' +
        (pend ? 'aguardando internet ou cidade' : plural(sp, 'espécie', 'espécies')) + '</small></span><span class="c-n">' + ts.length + '</span></button>';
    }).join('') + '</div>';
  }

  // ---------- cidade ----------
  function filterTrees(ts, st) {
    return ts.filter((t) => {
      if (st.q && !matchTree(t, st.q)) return false;
      if (st.bairro && (t.neighborhood || 'Sem bairro') !== st.bairro) return false;
      if (st.species && (t.species || 'Não identificada') !== st.species) return false;
      for (const f of st.flags) {
        if (f === 'fav' && !t.favorite) return false;
        if (f === 'unk' && t.species) return false;
        if (f === 'flor' && !t.flowering) return false;
        if (f === 'fruto' && !t.fruiting) return false;
        if (f === 'risco' && !(t.risks || []).length) return false;
        if (f === 'nocoord' && hasCoord(t)) return false;
      }
      return true;
    });
  }


  // ---------- árvores perto de mim ----------
  function getPos() {
    return new Promise((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), () => res(null), { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 });
    });
  }
  const fmtDist = (m) => (m < 1000 ? Math.round(m / 5) * 5 + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',') + ' km');
  async function renderNearby() {
    await refresh();
    const head = topBar('Perto de mim', 'As árvores mais próximas', { back: true });
    view().innerHTML = head + '<main class="page"><p class="note" id="nearMsg">Pegando a sua posição… (precisa do GPS ligado)</p><div id="nearBody"></div></main>';
    const pos = await getPos();
    const msg = document.getElementById('nearMsg'), body = document.getElementById('nearBody');
    if (!msg || !body) return;
    if (!pos) { msg.innerHTML = 'Não consegui o GPS. Ligue a localização do celular e permita o acesso para este app, depois volte aqui.'; return; }
    const list = done().filter(hasCoord).map((t) => ({ t, d: AC.geo.haversine(pos.lat, pos.lng, t.lat, t.lng) })).sort((a, b) => a.d - b.d).slice(0, 40);
    if (!list.length) { msg.textContent = 'Ainda não há árvores com coordenada.'; return; }
    msg.textContent = 'Mostrando as ' + list.length + ' mais próximas, da mais perto para a mais longe. Precisão do GPS: ±' + Math.round(pos.acc) + ' m.';
    body.innerHTML = '<div class="trees">' + list.map((x) => treeItemHTML(x.t, 'a ' + fmtDist(x.d))).join('') + '</div>';
  }

  async function renderCity(key) {
    await refresh();
    if (S.city.key !== key) S.city = { key, tab: 'lista', q: '', bairro: '', species: '', flags: new Set() };
    const all = done().filter((t) => cityKey(t) === key).sort((a, b) => b.updatedAt - a.updatedAt);
    const st = S.city;
    let h = topBar(key, plural(all.length, 'árvore', 'árvores'), {
      back: true,
      right: '<button class="ibtn" data-act="city-export" aria-label="Exportar">' + icon('download') + '</button>',
    });
    h += '<main class="page">';
    if (!all.length) { h += '<div class="empty">' + icon('leaf') + '<div class="big">Nenhuma árvore aqui</div></div></main>'; view().innerHTML = h; return; }
    h += '<div class="seg"><button data-tab="lista" class="' + (st.tab === 'lista' ? 'on' : '') + '">' + icon('list') + ' Lista</button>' +
      '<button data-tab="mapa" class="' + (st.tab === 'mapa' ? 'on' : '') + '">' + icon('map') + ' Mapa</button>' +
      '<button data-tab="numeros" class="' + (st.tab === 'numeros' ? 'on' : '') + '">' + icon('chart') + ' Números</button></div>';
    if (st.tab === 'numeros') {
      h += '<div id="statsBox"></div></main>';
      view().innerHTML = h;
      document.getElementById('statsBox').innerHTML = AC.more.statsHTML(all) + AC.more.reportCardHTML(all);
      return;
    }
    const bairros = [...new Set(all.map((t) => t.neighborhood || 'Sem bairro'))].sort((a, b) => a.localeCompare(b));
    const specs = [...new Set(all.map((t) => t.species || 'Não identificada'))].sort((a, b) => a.localeCompare(b));
    h += '<label class="searchbox">' + icon('search') + '<input id="cityQ" type="search" placeholder="Buscar nesta cidade…" value="' + esc(st.q) + '" autocomplete="off"></label>';
    const chip = (f, label, ic) => '<button class="chip' + (st.flags.has(f) ? ' on' : '') + '" data-flag="' + f + '">' + (ic ? icon(ic) : '') + label + '</button>';
    h += '<div class="chips">' + chip('fav', 'Favoritas', 'star') + chip('unk', 'Não identificadas') + chip('flor', 'Com flores') + chip('fruto', 'Com frutos') + chip('risco', 'Com atenção') + chip('nocoord', 'Sem coordenada') + '</div>';
    h += '<div class="filters-row"><select class="sel" id="fBairro"><option value="">Todos os bairros</option>' + bairros.map((b) => '<option' + (st.bairro === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select>' +
      '<select class="sel" id="fSpecies"><option value="">Todas as espécies</option>' + specs.map((b) => '<option' + (st.species === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select></div>';
    h += '<div id="cityBody"></div></main><button class="btn fab" data-act="new-tree">' + icon('plus') + ' Nova árvore</button>';
    view().innerHTML = h;
    paintCityBody(all);
    const q = document.getElementById('cityQ');
    q.addEventListener('input', () => { st.q = q.value; paintCityBody(all); });
    document.getElementById('fBairro').addEventListener('change', (e) => { st.bairro = e.target.value; paintCityBody(all); });
    document.getElementById('fSpecies').addEventListener('change', (e) => { st.species = e.target.value; paintCityBody(all); });
  }

  function paintCityBody(all) {
    const st = S.city, body = document.getElementById('cityBody');
    if (!body) return;
    if (S.cleanup) { S.cleanup(); S.cleanup = null; }
    const list = filterTrees(all, st);
    if (st.tab === 'mapa') {
      const pts = list.filter(hasCoord);
      body.innerHTML = '<p class="count-line">' + plural(pts.length, 'ponto', 'pontos') + ' no mapa' + (list.length > pts.length ? ' · ' + (list.length - pts.length) + ' sem coordenada' : '') + '</p><div class="mapbox" id="cityMap"></div><div id="mapCard" class="mapcard"></div>';
      const m = new AC.SimpleMap(document.getElementById('cityMap'), {
        onMarkerClick: (mk) => {
          const t = treeById(mk.id); if (!t) return;
          document.getElementById('mapCard').innerHTML = treeItemHTML(t);
        },
      });
      m.setMarkers(pts.map((t) => ({ id: t.id, lat: t.lat, lng: t.lng, fav: t.favorite, unknown: !t.species, label: nameOf(t) })));
      if (pts.length) m.fitBounds(pts.map((t) => ({ lat: t.lat, lng: t.lng })));
      S.cleanup = () => m.destroy();
      return;
    }
    body.innerHTML = '<p class="count-line">' + (list.length === all.length ? plural(list.length, 'árvore', 'árvores') : list.length + ' de ' + all.length + ' árvores') + '</p>' +
      (list.length ? '<div class="trees">' + list.map(treeItemHTML).join('') + '</div>' : '<p class="note">Nenhuma árvore com esses filtros.</p>');
  }

  // ---------- detalhe ----------
  function kv(k, v) { return v === '' || v == null || v === false ? '' : '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>'; }

  async function renderDetail(id) {
    await refresh();
    const t = treeById(id);
    if (!t) { go('/'); return; }
    if (t.draft) { go('/editar/' + t.id); return; }
    const ps = photosOf(t.id);
    const latest = [...ps].reverse().find((p) => p.type === 'inteira') || ps[ps.length - 1];
    let h = topBar(nameOf(t), t.code || '', {
      back: true,
      right: '<button class="ibtn' + (t.favorite ? ' on' : '') + '" data-act="fav" data-id="' + t.id + '" aria-label="Favorita">' + starIcon(t.favorite) + '</button>' +
        '<button class="ibtn" data-go="/editar/' + t.id + '" aria-label="Editar">' + icon('pencil') + '</button>',
    });
    h += '<main class="page">';
    if (latest) h += '<button class="hero" data-view="' + latest.id + '"><img alt="Foto da árvore" src="' + urlOf(latest.thumb) + '" data-full="' + latest.id + '"><span class="cnt">' + ps.length + ' foto' + (ps.length === 1 ? '' : 's') + '</span></button><div style="height:12px"></div>';
    h += '<div class="actions"><button class="btn" data-go="/visita/' + t.id + '">' + icon('camera') + ' Nova visita</button><button class="btn sec" data-act="card" data-id="' + t.id + '">' + icon('share') + ' Cartão</button>' +
      '<button class="btn sec" data-act="tree-pdf" data-id="' + t.id + '">' + icon('printer') + ' Ficha em PDF</button>' +
      '<button class="btn sec" data-act="tree-send" data-id="' + t.id + '">' + icon('upload') + ' Enviar a outra pessoa</button>' +
      (hasCoord(t) ? '<button class="btn sec" data-act="open-map" data-id="' + t.id + '">' + icon('map') + ' Abrir no mapa</button>' : '<button class="btn sec" data-go="/editar/' + t.id + '">' + icon('pin') + ' Informar local</button>') + '</div>';

    h += '<section class="card tape"><h2>' + esc(nameOf(t)) + '</h2>' + (t.scientific ? '<div class="sci">' + esc(t.scientific) + '</div>' : '') + badgesHTML(t);
    h += '<dl class="kv" style="margin-top:10px">';
    h += kv('Origem', t.origin ? (AC.exp.ORIGIN_LABEL[t.origin] + (t.originConfirm ? ' <span class="note">(confirmar)</span>' : '')) : '');
    h += kv('Frutífera', t.fruit ? (AC.exp.FRUIT_LABEL[t.fruit] + (t.fruitConfirm ? ' <span class="note">(confirmar)</span>' : '')) : '');
    h += kv('Medicinal', t.medicinal ? 'Sim' : '') + kv('Ameaçada', t.threatened ? 'Sim' : '');
    h += kv('Altura', t.height ? esc(t.height) + ' m' : '') + kv('Tronco (diâmetro)', t.trunk ? esc(t.trunk) + ' cm' : '') + kv('Copa', t.crown ? esc(t.crown) + ' m' : '');
    h += kv('Flores', t.flowering ? 'Sim' + (t.flowerColor ? ' (' + esc(t.flowerColor) + ')' : '') : '') + kv('Frutos', t.fruiting ? 'Sim' : '');
    h += kv('Estado', esc(t.health)) + kv('Atenção e manejo', esc((t.risks || []).join(' · '))) + kv('Tipo de local', esc(t.placeType)) + kv('Observações', esc(t.notes).replace(/\n/g, '<br>'));
    h += '</dl></section>';

    h += '<section class="card"><h3>Onde fica</h3><dl class="kv">';
    h += kv('Cidade', t.city ? esc(cityKey(t)) : '<span class="note">Local pendente</span>') + kv('Bairro', esc(t.neighborhood)) + kv('Rua', esc(t.street));
    if (hasCoord(t)) {
      h += kv('Lat / Long', '<span class="mono">' + G.fmtLatLon(t.lat, t.lng) + '</span> <button class="ibtn" style="width:34px;height:34px;display:inline-grid" data-copy="' + G.fmtLatLon(t.lat, t.lng) + '" aria-label="Copiar">' + icon('copy') + '</button>');
      h += kv('UTM', '<span class="mono">' + esc(AC.stamp.utmText(t.lat, t.lng)) + '</span><div class="note">SIRGAS 2000' + (t.accuracy ? ' · precisão ±' + Math.round(t.accuracy) + ' m' : '') + '</div>');
    } else h += kv('Coordenada', '<span class="note">Sem coordenada</span>');
    h += '</dl></section>';

    // histórico
    const visits = [...(t.visits || [])].sort((a, b) => b.date - a.date);
    h += '<section class="card"><h3>Histórico de fotos</h3>';
    visits.forEach((v, i) => {
      const vp = ps.filter((p) => p.visitId === v.id);
      const first = i === visits.length - 1;
      h += '<div class="visit"><h4>' + G.fmtDate(v.date) + ' · ' + G.fmtTime(v.date) + '<span class="note"> ' + (first ? '· primeira visita' : '· visita') + '</span></h4>';
      if (v.notes) h += '<p class="note" style="margin-top:0">' + esc(v.notes) + '</p>';
      h += vp.length ? '<div class="pgrid">' + vp.map((p) => '<button class="p" data-view="' + p.id + '"><img alt="" src="' + urlOf(p.thumb) + '"><span>' + esc(AC.exp.photoTypeLabel(p.type)) + '</span></button>').join('') + '</div>' : '<p class="note">Sem fotos nesta visita.</p>';
      h += '</div>';
    });
    h += '<p class="note">Registrada em ' + G.fmtDateTime(t.createdAt) + '</p></section>';
    h += '</main>';
    view().innerHTML = h;
    if (latest) AC.db.getBlobs(latest.id).then((b) => {
      const img = document.querySelector('.hero img');
      if (b && b.stamped && img) { const u = URL.createObjectURL(b.stamped); img.onload = () => {}; img.src = u; S.cleanup = () => URL.revokeObjectURL(u); }
    });
  }

  // ---------- visualizador de fotos ----------
  async function openViewer(photoId) {
    const meta = [...S.photos.values()].flat().find((p) => p.id === photoId);
    if (!meta) return;
    const list = photosOf(meta.treeId);
    let idx = list.findIndex((p) => p.id === photoId), showOrig = false, curUrl = null;
    const wrap = document.createElement('div');
    wrap.className = 'viewer';
    wrap.innerHTML = '<div class="v-top"><button class="ibtn" data-v="close" aria-label="Fechar">' + icon('x') + '</button><div class="v-t"></div><button class="ibtn" data-v="prev" aria-label="Anterior">' + icon('back') + '</button><button class="ibtn" data-v="next" aria-label="Próxima" style="transform:scaleX(-1)">' + icon('back') + '</button></div>' +
      '<div class="v-img"><img alt=""></div><div class="v-bot"><button class="btn sec" data-v="orig">Ver original</button><button class="btn sec" data-v="share">' + icon('share') + ' Compartilhar</button><button class="btn danger" data-v="del">' + icon('trash') + ' Excluir</button></div>';
    document.body.appendChild(wrap);
    document.body.classList.add('noscroll');
    const imgEl = wrap.querySelector('img');
    async function show() {
      const p = list[idx];
      const b = await AC.db.getBlobs(p.id);
      if (curUrl) URL.revokeObjectURL(curUrl);
      const blob = showOrig ? b.orig : b.stamped;
      curUrl = URL.createObjectURL(blob);
      imgEl.src = curUrl;
      wrap.querySelector('.v-t').textContent = AC.exp.photoTypeLabel(p.type) + ' · ' + G.fmtDateTime(p.takenAt) + ' · ' + (idx + 1) + '/' + list.length;
      wrap.querySelector('[data-v=orig]').textContent = showOrig ? 'Ver com carimbo' : 'Ver original';
    }
    function close() { if (curUrl) URL.revokeObjectURL(curUrl); wrap.remove(); if (!document.querySelector('.sheet-wrap')) document.body.classList.remove('noscroll'); }
    wrap.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      const a = b.dataset.v;
      if (a === 'close') close();
      else if (a === 'prev') { idx = (idx - 1 + list.length) % list.length; showOrig = false; show(); }
      else if (a === 'next') { idx = (idx + 1) % list.length; showOrig = false; show(); }
      else if (a === 'orig') { showOrig = !showOrig; show(); }
      else if (a === 'share') {
        const p = list[idx], bl = await AC.db.getBlobs(p.id), t = treeById(p.treeId);
        await AC.exp.shareBlob(showOrig ? bl.orig : bl.stamped, (t.code || 'ARV') + '_' + G.isoDate(p.takenAt) + '.jpg', nameOf(t));
      } else if (a === 'del') {
        if (await confirmBox('Excluir esta foto?', 'A foto original e a carimbada serão apagadas deste aparelho.', 'Excluir', { danger: true })) {
          const p = list[idx];
          await AC.db.deletePhoto(p.id);
          close();
          await render();
          toast('Foto excluída');
        }
      }
    });
    show();
  }
  AC.openViewer = openViewer;

  // ---------- ações (cliques) ----------
  const actions = {
    back: () => back('/'),
    menu: () => {
      const s = sheet('<h3>Menu</h3><div class="menu">' +
        '<button class="btn sec" data-m="/perto">' + icon('locate') + '<span class="m-t">Árvores perto de mim<small>Das mais próximas às mais longe</small></span></button>' +
        '<button class="btn sec" data-m="/numeros">' + icon('chart') + '<span class="m-t">Números de tudo<small>Espécies, bairros, ruas</small></span></button>' +
        '<button class="btn sec" data-m="export">' + icon('download') + '<span class="m-t">Exportar tudo<small>Google Earth, planilha, fotos</small></span></button>' +
        '<button class="btn sec" data-m="/mais">' + icon('stamp') + '<span class="m-t">Carimbo, backup e sobre</span></button></div>');
      s.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        s.close();
        if (b.dataset.m === 'export') AC.more.exportSheet({ title: 'Todas as árvores', slug: 'todas', filter: null });
        else go(b.dataset.m);
      });
    },
    'new-tree': async () => {
      const t = AC.db.newTree();
      await AC.db.saveTree(t);
      go('/editar/' + t.id);
    },
    discard: async (el) => {
      if (await confirmBox('Descartar este cadastro?', 'As fotos e dados deste cadastro em andamento serão apagados.', 'Descartar', { danger: true })) {
        await AC.db.deleteTree(el.dataset.id); render();
      }
    },
    fav: async (el) => {
      const t = treeById(el.dataset.id); if (!t) return;
      t.favorite = !t.favorite; await AC.db.saveTree(t); await render();
      toast(t.favorite ? 'Marcada como favorita' : 'Removida das favoritas');
    },
    card: async (el) => {
      const t = treeById(el.dataset.id);
      toast('Montando o cartão…');
      try {
        const blob = await AC.exp.makeCard(t);
        const s = sheet('<h3>Cartão pronto</h3><img alt="Cartão" style="width:100%;border-radius:12px;border:1.5px solid var(--line)" src="' + URL.createObjectURL(blob) + '"><div class="row-btns"><button class="btn" data-r="share">' + icon('share') + ' Compartilhar</button><button class="btn sec" data-r="save">' + icon('download') + ' Salvar</button></div>');
        const fname = (t.code || 'arvore') + '_cartao.jpg';
        s.el.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-r]'); if (!b) return;
          if (b.dataset.r === 'share') await AC.exp.shareBlob(blob, fname, nameOf(t)); else AC.exp.saveBlob(blob, fname);
        });
      } catch (e) { toast('Não consegui montar o cartão: ' + e.message); }
    },
    'open-map': (el) => {
      const t = treeById(el.dataset.id); if (!t) return;
      const ll = t.lat + ',' + t.lng, label = encodeURIComponent(t.species || 'Não identificada');
      const row = (href, label2, sub) => '<a class="btn sec" style="display:block;margin:8px 0;text-align:left" target="_blank" rel="noopener" href="' + href + '"><b>' + label2 + '</b><br><small>' + sub + '</small></a>';
      const sh = sheet('<h3>Abrir em…</h3>' +
        '<button class="btn sec" style="display:block;width:100%;margin:8px 0;text-align:left" data-earth="1"><b>Google Earth, com nome e fotos</b><br><small>Gera o ponto com o nome da árvore e escolhe o app</small></button>' +
        row('https://earth.google.com/web/search/' + ll, 'Google Earth no navegador', 'Só a posição, sem nome') +
        row('https://www.google.com/maps?q=' + ll + '(' + label + ')', 'Google Maps', 'Mapa e rotas, com o nome da árvore') +
        row('https://waze.com/ul?ll=' + ll + '&navigate=yes', 'Waze', 'Rotas até a árvore') +
        row('geo:' + ll + '?q=' + ll + '(' + label + ')', 'Outro aplicativo do celular', 'O Android mostra a lista de apps de mapa instalados') +
        '<p class="note">Para ver todas as árvores juntas no Google Earth, use Exportar › KMZ.</p><button class="btn ghost" data-close>Fechar</button>');
      sh.el.querySelector('[data-earth]').addEventListener('click', () => { sh.close(); actions['open-earth']({ dataset: { id: t.id } }); });
    },
    'open-earth': async (el) => {
      const t = treeById(el.dataset.id); if (!t) return;
      try {
        toast('Preparando o ponto…', 4000);
        const { trees, by } = await AC.exp.loadAll((x) => x.id === t.id);
        const r = await AC.exp.buildKMZ(trees, by, t.species || 'Não identificada');
        const fname = (t.code || 'arvore') + '_' + (t.species || 'nao-identificada').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() + '.kmz';
        const s = sheet('<h3>Pronto</h3><p><b>' + esc(t.species || 'Não identificada') + '</b><br><span class="note">Toque em Abrir e escolha o <b>Google Earth</b> na lista de aplicativos.</span></p>' +
          '<div class="row-btns"><button class="btn" data-r="share">' + icon('map') + ' Abrir no Earth</button><button class="btn sec" data-r="save">' + icon('download') + ' Baixar</button></div><button class="btn ghost" data-close>Fechar</button>');
        s.el.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-r]'); if (!b) return;
          if (b.dataset.r === 'share') await AC.exp.shareBlob(r.blob, fname, t.species || 'Árvore'); else { AC.exp.saveBlob(r.blob, fname); toast('Arquivo baixado. Toque nele para abrir no Google Earth.'); }
        });
      } catch (e) { toast('Não consegui preparar o ponto: ' + e.message); }
    },
    'tree-pdf': (el) => AC.more.printTree(treeById(el.dataset.id)),
    'tree-send': async (el) => {
      const t = treeById(el.dataset.id); if (!t) return;
      const prog = AC.ui.progress('Preparando a árvore…');
      try {
        const blob = await AC.exp.buildBackup((n, tot) => prog.set(n, tot, 'Foto ' + n + ' de ' + tot), [t.id]);
        prog.close();
        const nome = 'arvore-' + (t.species || 'nao-identificada').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() + '-' + (t.code || '') + '.zip';
        AC.more.deliverSheet(blob, nome, 'Este arquivo leva a árvore com fotos e coordenadas.', 'A outra pessoa, no app dela, abre <b>Carimbo, backup e sobre</b>, toca em <b>Restaurar</b> e escolhe este arquivo. A árvore entra na lista dela e aparece em <b>Árvores perto de mim</b>.');
      } catch (e) { try { prog.close(); } catch (_) { /* ok */ } toast('Não consegui preparar a árvore: ' + e.message); }
    },
    'city-report': () => {
      const sel = document.getElementById('repB'); const b = sel ? sel.value : '';
      const ts = done().filter((t) => cityKey(t) === S.city.key && (!b || (t.neighborhood || 'Sem bairro') === b));
      AC.more.printReport(ts, (b ? b + ' · ' : '') + S.city.key);
    },
    'city-export': () => {
      const key = S.city.key;
      AC.more.exportSheet({ title: key, slug: AC.exp.slug(key), filter: (t) => cityKey(t) === key });
    },
    install: async () => {
      if (!S.deferredPrompt) return;
      S.deferredPrompt.prompt();
      try { await S.deferredPrompt.userChoice; } catch (e) { /* ok */ }
      S.deferredPrompt = null; render();
    },
    'home-mode': (el) => { S.homeMode = el.dataset.v; S.homeSel = ''; S.homeFlag = ''; S.homeQ = ''; render(); },
    'home-sel': (el) => { S.homeSel = el.dataset.v; render(); window.scrollTo(0, 0); },
    'home-flag': (el) => { S.homeFlag = S.homeFlag === el.dataset.v ? '' : el.dataset.v; S.homeSel = ''; render(); },
    'backup-now': () => AC.more.backupFlow(),
    'resolve-places': async () => {
      if (navigator.onLine === false) { toast('Sem internet agora. Tente de novo quando conectar.'); return; }
      toast('Buscando os locais…');
      const n = await AC.place.processPending();
      toast(n ? n + ' árvore(s) atualizada(s)' : 'Nada novo para atualizar');
      render();
    },
  };

  function onClick(e) {
    const el = e.target.closest('[data-go],[data-act],[data-tab],[data-flag],[data-view],[data-copy]');
    if (!el || !view().contains(el)) return;
    if (el.dataset.go) { go(el.dataset.go); return; }
    if (el.dataset.view) { openViewer(el.dataset.view); return; }
    if (el.dataset.copy) { navigator.clipboard && navigator.clipboard.writeText(el.dataset.copy).then(() => toast('Coordenada copiada'), () => toast('Não consegui copiar')); return; }
    if (el.dataset.tab) { S.city.tab = el.dataset.tab; render(); return; }
    if (el.dataset.flag) { const f = el.dataset.flag; S.city.flags.has(f) ? S.city.flags.delete(f) : S.city.flags.add(f); el.classList.toggle('on'); paintCityBody(done().filter((t) => cityKey(t) === S.city.key).sort((a, b) => b.updatedAt - a.updatedAt)); return; }
    const a = el.dataset.act;
    if (actions[a]) actions[a](el, e);
    else if (AC.more && AC.more.actions[a]) AC.more.actions[a](el, e);
    else if (AC.form && AC.form.actions[a]) AC.form.actions[a](el, e);
  }

  // ---------- início ----------
  async function init() {
    document.getElementById('app').addEventListener('click', onClick);
    window.addEventListener('hashchange', render);
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.deferredPrompt = e; if (!location.hash || location.hash === '#/') render(); });
    window.addEventListener('online', () => { AC.place.processPending(() => {}).then((n) => { if (n) { toast(n + ' árvore(s) com local atualizado'); render(); } }); });
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ok */ }
    await AC.db.open();
    await render();
    if (AC.hideSplash) AC.hideSplash();
    if (navigator.onLine !== false) AC.place.processPending().then((n) => { if (n) { toast(n + ' árvore(s) com local atualizado'); render(); } });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').catch(() => {});
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) toast('App atualizado. Feche e abra de novo para ver as novidades.', 5000); });
    }
  }
  AC.app = { init, refresh, done, drafts, treeById, photosOf, hasCoord, nameOf, cityKey, treeItemHTML, badgesHTML, filterTrees, back, go, actions };
  document.addEventListener('DOMContentLoaded', () => { if (!AC.noAutoInit) init(); });
})(typeof window !== 'undefined' ? window : globalThis);
