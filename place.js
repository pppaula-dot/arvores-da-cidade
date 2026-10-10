/* Árvores Urbanas — place.js
   Descobre cidade, bairro e rua a partir da coordenada (OpenStreetMap/Nominatim) quando há internet.
   Sem internet, a árvore fica com "local pendente" e é completada sozinha quando o celular conectar. */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});

  const UF = {
    'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amazonas': 'AM', 'bahia': 'BA', 'ceará': 'CE', 'distrito federal': 'DF',
    'espírito santo': 'ES', 'goiás': 'GO', 'maranhão': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
    'minas gerais': 'MG', 'pará': 'PA', 'paraíba': 'PB', 'paraná': 'PR', 'pernambuco': 'PE', 'piauí': 'PI',
    'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', 'rondônia': 'RO', 'roraima': 'RR',
    'santa catarina': 'SC', 'são paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO',
  };
  const UF_LIST = Object.values(UF).sort();

  const cache = new Map();
  let lastCall = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function parse(j) {
    const a = (j && j.address) || {};
    const iso = a['ISO3166-2-lvl4'] || '';
    let state = /^BR-([A-Z]{2})$/.test(iso) ? iso.slice(3) : UF[String(a.state || '').toLowerCase()] || '';
    const city = a.city || a.town || a.village || a.municipality || a.county || '';
    const neighborhood = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.borough || a.residential || '';
    const street = a.road || a.pedestrian || a.footway || a.path || a.cycleway || '';
    return { city, state, neighborhood, street, country: a.country_code || '' };
  }

  // Nominatim pede no máximo 1 consulta por segundo
  async function reverse(lat, lng) {
    const key = lat.toFixed(4) + ',' + lng.toFixed(4);
    if (cache.has(key)) return cache.get(key);
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=pt-BR&lat=' +
      encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng);
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      const p = parse(j);
      cache.set(key, p);
      return p;
    } finally { clearTimeout(to); }
  }

  // Preenche o local da árvore, se possível. Retorna true se conseguiu.
  async function resolveTree(tree) {
    if (!AC.geo.validCoord(tree.lat, tree.lng)) return false;
    if (navigator.onLine === false) { tree.placePending = !tree.city; return false; }
    try {
      const p = await reverse(tree.lat, tree.lng);
      if (!p.city && !p.neighborhood && !p.street) { tree.placePending = !tree.city; return false; }
      if (!tree.placeManual) {
        tree.city = p.city || tree.city;
        tree.state = p.state || tree.state;
        tree.neighborhood = p.neighborhood;
        tree.street = p.street;
      }
      tree.placePending = false;
      return true;
    } catch (e) {
      tree.placePending = !tree.city;
      return false;
    }
  }

  let running = false;
  // Completa o local de todas as árvores pendentes (uma por vez)
  async function processPending(onResolved) {
    if (running || navigator.onLine === false) return 0;
    running = true;
    let n = 0;
    try {
      const trees = (await AC.db.allTrees()).filter((t) => t.placePending && !t.draft && AC.geo.validCoord(t.lat, t.lng));
      for (const t of trees) {
        const ok = await resolveTree(t);
        if (ok) {
          await AC.db.saveTree(t);
          try { await AC.stamp.restampTree(t); } catch (e) { /* segue */ }
          n++;
          if (onResolved) onResolved(t);
        } else if (navigator.onLine === false) break;
      }
    } finally { running = false; }
    return n;
  }

  AC.place = { UF_LIST, reverse, resolveTree, processPending, parse };
})(typeof window !== 'undefined' ? window : globalThis);
