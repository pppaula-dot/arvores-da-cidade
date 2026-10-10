/* Árvores Urbanas — species.js
   Lista de árvores comuns em ruas, praças e quintais do Brasil, com origem (nativa do Brasil ou exótica)
   e se é frutífera. Funciona sem internet. Para espécies fora da lista, o app tenta buscar na internet
   (GBIF + Wikipédia) quando houver sinal e marca o resultado como "confirmar".
   Origem: N = nativa do Brasil · E = exótica (veio de fora) · C = confirmar. Fruto: S = frutífera · N = não. */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});

  // [nome popular, nome científico, origem, frutífera, outros nomes, observação]
  const L = [
    // ---- Nativas ----
    ['Ipê-amarelo', 'Handroanthus chrysotrichus', 'N', 'N', 'ipê-amarelo-cascudo, handroanthus albus, handroanthus serratifolius, tabebuia chrysotricha', 'Várias espécies de ipê-amarelo; confira a espécie se precisar do nome exato'],
    ['Ipê-roxo', 'Handroanthus impetiginosus', 'N', 'N', 'ipê-roxo-de-bola, ipê-rosa-escuro, tabebuia impetiginosa'],
    ['Ipê-rosa', 'Handroanthus heptaphyllus', 'N', 'N', 'ipê-roxo-sete-folhas, tabebuia heptaphylla'],
    ['Ipê-branco', 'Tabebuia roseoalba', 'N', 'N', 'ipê-branco-da-serra'],
    ['Ipê-verde', 'Cybistax antisyphilitica', 'N', 'N', 'ipê-de-flor-verde'],
    ['Pau-brasil', 'Paubrasilia echinata', 'N', 'N', 'caesalpinia echinata', 'Ameaçada de extinção'],
    ['Pau-ferro', 'Libidibia ferrea', 'N', 'N', 'jucá, caesalpinia ferrea'],
    ['Sibipiruna', 'Cenostigma pluviosum', 'N', 'N', 'caesalpinia peltophoroides, caesalpinia pluviosa'],
    ['Oiti', 'Licania tomentosa', 'N', 'S', '', 'Fruto comestível, muito procurado por aves e morcegos'],
    ['Quaresmeira', 'Tibouchina granulosa', 'N', 'N', 'tibouchina'],
    ['Manacá-da-serra', 'Tibouchina mutabilis', 'N', 'N', ''],
    ['Pata-de-vaca-nativa', 'Bauhinia forficata', 'N', 'N', 'unha-de-vaca, pata-de-vaca', 'Folhas usadas em chás populares'],
    ['Embaúba', 'Cecropia pachystachya', 'N', 'N', 'imbaúba, cecropia', 'Árvore pioneira; frutos atraem muitas aves'],
    ['Ingá-feijão', 'Inga edulis', 'N', 'S', 'ingá, ingá-de-metro', 'Polpa branca doce ao redor das sementes'],
    ['Ingá', 'Inga marginata', 'N', 'S', 'ingá-feijão-pequeno'],
    ['Paineira', 'Ceiba speciosa', 'N', 'N', 'paineira-rosa, barriguda, chorisia speciosa'],
    ['Mulungu', 'Erythrina speciosa', 'N', 'N', 'eritrina, suinã, erythrina verna, corticeira'],
    ['Jatobá', 'Hymenaea courbaril', 'N', 'S', 'jataí', 'Vagem com polpa farinácea comestível'],
    ['Cedro-rosa', 'Cedrela fissilis', 'N', 'N', 'cedro', 'Vulnerável à extinção'],
    ['Jequitibá-rosa', 'Cariniana legalis', 'N', 'N', 'jequitibá', 'Uma das maiores árvores da Mata Atlântica'],
    ['Aroeira-pimenteira', 'Schinus terebinthifolia', 'N', 'S', 'aroeira-vermelha, pimenta-rosa, aroeira', 'O fruto é a "pimenta-rosa"; pode causar alergia em algumas pessoas'],
    ['Guapuruvu', 'Schizolobium parahyba', 'N', 'N', 'guapuruvu-da-mata'],
    ['Tamboril', 'Enterolobium contortisiliquum', 'N', 'N', 'orelha-de-macaco, timburi'],
    ['Canafístula', 'Peltophorum dubium', 'N', 'N', 'farinha-seca, angico-amarelo'],
    ['Angico-branco', 'Anadenanthera colubrina', 'N', 'N', 'angico'],
    ['Pau-formiga', 'Triplaris americana', 'N', 'N', 'novateiro, triplaris'],
    ['Mutamba', 'Guazuma ulmifolia', 'N', 'S', 'embira, fruta-de-macaco', 'Fruto procurado pela fauna'],
    ['Sombreiro', 'Clitoria fairchildiana', 'N', 'N', 'palheteira, sombreiro-da-amazônia'],
    ['Cássia-rosa', 'Cassia grandis', 'N', 'N', 'cássia-grande, cássia-rosa-do-brasil'],
    ['Cássia-verrugosa', 'Senna spectabilis', 'N', 'N', 'cássia-do-nordeste, canudo-de-pito'],
    ['Louro-pardo', 'Cordia trichotoma', 'N', 'N', 'louro'],
    ['Seringueira', 'Hevea brasiliensis', 'N', 'N', 'seringa, árvore-da-borracha'],
    ['Pitangueira', 'Eugenia uniflora', 'N', 'S', 'pitanga'],
    ['Jabuticabeira', 'Plinia cauliflora', 'N', 'S', 'jabuticaba'],
    ['Araçazeiro', 'Psidium cattleyanum', 'N', 'S', 'araçá, araçá-de-praia'],
    ['Goiabeira', 'Psidium guajava', 'N', 'S', 'goiaba', 'Nativa das Américas tropicais'],
    ['Grumixameira', 'Eugenia brasiliensis', 'N', 'S', 'grumixama'],
    ['Uvaieira', 'Eugenia pyriformis', 'N', 'S', 'uvaia'],
    ['Cambucizeiro', 'Campomanesia phaea', 'N', 'S', 'cambuci'],
    ['Guabirobeira', 'Campomanesia xanthocarpa', 'N', 'S', 'guabiroba, gabiroba'],
    ['Cajueiro', 'Anacardium occidentale', 'N', 'S', 'caju'],
    ['Cajazeira', 'Spondias mombin', 'N', 'S', 'cajá, taperebá'],
    ['Jenipapeiro', 'Genipa americana', 'N', 'S', 'jenipapo'],
    ['Pitombeira', 'Talisia esculenta', 'N', 'S', 'pitomba'],
    ['Abieiro', 'Pouteria caimito', 'N', 'S', 'abiu'],
    ['Pequizeiro', 'Caryocar brasiliense', 'N', 'S', 'pequi'],
    ['Mangabeira', 'Hancornia speciosa', 'N', 'S', 'mangaba'],
    ['Sapucaia', 'Lecythis pisonis', 'N', 'S', 'sapucaia-vermelha', 'Semente comestível (castanha-sapucaia)'],
    ['Castanheira-do-pará', 'Bertholletia excelsa', 'N', 'S', 'castanha-do-brasil'],
    ['Cacaueiro', 'Theobroma cacao', 'N', 'S', 'cacau'],
    ['Cupuaçuzeiro', 'Theobroma grandiflorum', 'N', 'S', 'cupuaçu'],
    ['Palmeira-juçara', 'Euterpe edulis', 'N', 'S', 'juçara, palmito-juçara, içara', 'Ameaçada de extinção'],
    ['Açaizeiro', 'Euterpe oleracea', 'N', 'S', 'açaí'],
    ['Jerivá', 'Syagrus romanzoffiana', 'N', 'S', 'coqueiro-jerivá, jeribá, gerivá', 'Coquinho comestível, procurado pela fauna'],
    ['Macaúba', 'Acrocomia aculeata', 'N', 'S', 'bocaiuva, macaíba, coco-de-espinho'],
    ['Buriti', 'Mauritia flexuosa', 'N', 'S', 'miriti'],
    ['Carnaúba', 'Copernicia prunifera', 'N', 'N', ''],
    ['Babaçu', 'Attalea speciosa', 'N', 'S', 'babaçu-palmeira'],
    ['Araucária', 'Araucaria angustifolia', 'N', 'S', 'pinheiro-do-paraná, pinheiro-brasileiro, pinhão', 'O fruto é o pinhão; ameaçada de extinção'],

    // ---- Exóticas ----
    ['Mangueira', 'Mangifera indica', 'E', 'S', 'manga', 'Originária da Índia'],
    ['Jaqueira', 'Artocarpus heterophyllus', 'E', 'S', 'jaca', 'Originária da Índia'],
    ['Fruta-pão', 'Artocarpus altilis', 'E', 'S', 'árvore-do-pão'],
    ['Abacateiro', 'Persea americana', 'E', 'S', 'abacate', 'Originário da América Central'],
    ['Limoeiro', 'Citrus limon', 'E', 'S', 'limão, limoeiro-siciliano, limão-tahiti, citrus latifolia'],
    ['Laranjeira', 'Citrus sinensis', 'E', 'S', 'laranja'],
    ['Tangerineira', 'Citrus reticulata', 'E', 'S', 'mexerica, ponkan, bergamota, tangerina'],
    ['Mamoeiro', 'Carica papaya', 'E', 'S', 'mamão, papaia', 'Originário da América Central'],
    ['Coqueiro', 'Cocos nucifera', 'E', 'S', 'coco, coqueiro-da-praia, coco-da-baía'],
    ['Aceroleira', 'Malpighia emarginata', 'E', 'S', 'acerola', 'Originária do Caribe e América Central'],
    ['Amoreira', 'Morus nigra', 'E', 'S', 'amora, amoreira-preta'],
    ['Jambeiro', 'Syzygium malaccense', 'E', 'S', 'jambo, jambo-vermelho'],
    ['Jambo-amarelo', 'Syzygium jambos', 'E', 'S', 'jambo-rosa'],
    ['Jambolão', 'Syzygium cumini', 'E', 'S', 'azeitona-preta, jamelão, jalão'],
    ['Amendoeira-da-praia', 'Terminalia catappa', 'E', 'S', 'sete-copas, chapéu-de-sol, castanhola, amendoeira', 'Semente comestível'],
    ['Caramboleira', 'Averrhoa carambola', 'E', 'S', 'carambola'],
    ['Gravioleira', 'Annona muricata', 'E', 'S', 'graviola'],
    ['Pinheira', 'Annona squamosa', 'E', 'S', 'pinha, fruta-do-conde, ata'],
    ['Cajá-manga', 'Spondias dulcis', 'E', 'S', 'cajamanga, cajá-manga'],
    ['Tamarindeiro', 'Tamarindus indica', 'E', 'S', 'tamarindo'],
    ['Sapotizeiro', 'Manilkara zapota', 'E', 'S', 'sapoti, sapota'],
    ['Nespereira', 'Eriobotrya japonica', 'E', 'S', 'nêspera, ameixa-amarela'],
    ['Oliveira', 'Olea europaea', 'E', 'S', 'azeitona, oliveira-europeia'],
    ['Romãzeira', 'Punica granatum', 'E', 'S', 'romã'],
    ['Lichieira', 'Litchi chinensis', 'E', 'S', 'lichia, lixia'],
    ['Figueira-comum', 'Ficus carica', 'E', 'S', 'figo, figueira'],
    ['Cafeeiro', 'Coffea arabica', 'E', 'S', 'café', 'Originário da Etiópia'],
    ['Bananeira', 'Musa spp.', 'E', 'S', 'banana, bananeira', 'Planta herbácea de porte arbóreo'],
    ['Tamareira', 'Phoenix dactylifera', 'E', 'S', 'tâmara'],
    ['Flamboyant', 'Delonix regia', 'E', 'N', 'flamboiã, flamboyant-vermelho', 'Originário de Madagascar'],
    ['Jacarandá-mimoso', 'Jacaranda mimosifolia', 'E', 'N', 'jacarandá', 'Originário da Argentina e Bolívia'],
    ['Pata-de-vaca-asiática', 'Bauhinia variegata', 'E', 'N', 'casco-de-vaca, bauínia, pata-de-vaca-roxa'],
    ['Cássia-imperial', 'Cassia fistula', 'E', 'N', 'chuva-de-ouro, cássia-imperial-amarela'],
    ['Cássia-javanesa', 'Cassia javanica', 'E', 'N', 'cássia-rosa-javanesa'],
    ['Cássia-de-sião', 'Senna siamea', 'E', 'N', 'cássia-siamea, cássia-amarela'],
    ['Espatódea', 'Spathodea campanulata', 'E', 'N', 'tulipeira-africana, tulipa-africana'],
    ['Ipê-de-jardim', 'Tecoma stans', 'E', 'N', 'sinos-amarelos, ipê-mirim, ipezinho', 'Nativa da América Central; no Brasil é cultivada/naturalizada'],
    ['Tipuana', 'Tipuana tipu', 'E', 'N', 'tipuana-tipu', 'Originária da Bolívia e Argentina'],
    ['Resedá', 'Lagerstroemia indica', 'E', 'N', 'extremosa, escumilha, crepe-myrtle'],
    ['Ligustro', 'Ligustrum lucidum', 'E', 'N', 'alfeneiro, ligustro-arbóreo', 'Pode ser invasora'],
    ['Murta-de-cheiro', 'Murraya paniculata', 'E', 'N', 'falsa-murta, jasmim-laranja, murta'],
    ['Cinamomo', 'Melia azedarach', 'E', 'N', 'santa-bárbara, paraíso', 'Frutos tóxicos'],
    ['Aroeira-salsa', 'Schinus molle', 'E', 'N', 'aroeira-periquita, falsa-pimenta', 'Originária do Peru'],
    ['Eucalipto', 'Eucalyptus spp.', 'E', 'N', 'eucalipto-limão, eucalyptus citriodora, corymbia citriodora', 'Originário da Austrália'],
    ['Pinus', 'Pinus spp.', 'E', 'N', 'pinheiro, pinus-elliottii', 'Pode ser invasora'],
    ['Casuarina', 'Casuarina equisetifolia', 'E', 'N', 'casuarina-da-praia, pinheiro-australiano'],
    ['Grevílea', 'Grevillea robusta', 'E', 'N', 'grevílea-gigante, carvalho-australiano'],
    ['Escova-de-garrafa', 'Callistemon viminalis', 'E', 'N', 'calistemo, callistemon'],
    ['Figueira-benjamim', 'Ficus benjamina', 'E', 'N', 'ficus, benjamina'],
    ['Figueira-lira', 'Ficus lyrata', 'E', 'N', 'ficus-lira'],
    ['Falsa-seringueira', 'Ficus elastica', 'E', 'N', 'ficus-elástica, árvore-da-borracha-indiana'],
    ['Ficus-microcarpa', 'Ficus microcarpa', 'E', 'N', 'figueira-de-folha-miúda, laurel-da-índia'],
    ['Magnólia', 'Magnolia grandiflora', 'E', 'N', 'magnólia-branca'],
    ['Magnólia-amarela', 'Magnolia champaca', 'E', 'N', 'michelia-champaca, champaca'],
    ['Jasmim-manga', 'Plumeria rubra', 'E', 'N', 'frangipani, plumeria, jasmim-do-caribe', 'Látex pode irritar a pele'],
    ['Palmeira-imperial', 'Roystonea oleracea', 'E', 'N', 'palmeira-real, roystonea'],
    ['Palmeira-real-de-cuba', 'Roystonea regia', 'E', 'N', 'palmeira-real'],
    ['Areca-bambu', 'Dypsis lutescens', 'E', 'N', 'palmeira-areca, areca'],
    ['Palmeira-leque-chinesa', 'Livistona chinensis', 'E', 'N', 'livistona, palmeira-leque'],
    ['Palmeira-fênix', 'Phoenix canariensis', 'E', 'N', 'fênix, tamareira-das-canárias'],
    ['Palmeira-rabo-de-raposa', 'Wodyetia bifurcata', 'E', 'N', 'rabo-de-raposa, wodyetia'],
    ['Washingtônia', 'Washingtonia robusta', 'E', 'N', 'palmeira-leque-mexicana, palmeira-washington'],
    ['Moringa', 'Moringa oleifera', 'E', 'N', 'moringa-oleífera, quiabo-de-quina'],
    ['Nim', 'Azadirachta indica', 'E', 'N', 'neem'],
    ['Espirradeira', 'Nerium oleander', 'E', 'N', 'oleandro, loendro', 'Todas as partes são tóxicas'],
    ['Chapéu-de-napoleão', 'Cascabela thevetia', 'E', 'N', 'thevetia, amarelinho, chapéu-de-napoleão', 'Toda a planta é tóxica'],
    ['Acácia-mimosa', 'Acacia podalyriifolia', 'E', 'N', 'acácia-prateada, mimosa'],
    ['Leucena', 'Leucaena leucocephala', 'E', 'N', 'leucena, linhaça-de-pau', 'Pode ser invasora'],
    ['Araucária-de-norfolk', 'Araucaria heterophylla', 'E', 'N', 'pinheiro-de-norfolk, araucária-ornamental'],

    // ---- Para confirmar ----
    ['Árvore-da-chuva', 'Samanea saman', 'C', 'N', 'chuva, saman, samaneia', 'Origem neotropical; confirme se é nativa na sua região'],
  ];

  const list = L.map((r) => ({ name: r[0], sci: r[1], origin: r[2], fruit: r[3], alias: r[4] || '', note: r[5] || '' }));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  list.forEach((s) => { s._n = norm(s.name); s._s = norm(s.sci); s._a = norm(s.alias); });

  function search(q, limit) {
    const n = norm(q);
    if (!n) return [];
    const out = [];
    for (const s of list) {
      let score = 0;
      if (s._n === n) score = 100;
      else if (s._n.startsWith(n)) score = 80;
      else if (s._n.split(' ').some((w) => w.startsWith(n))) score = 70;
      else if (s._a.split(' ').some((w) => w.startsWith(n)) || s._a.includes(n)) score = 55;
      else if (s._s.startsWith(n) || s._s.includes(n)) score = 50;
      else if (s._n.includes(n)) score = 40;
      if (score) out.push({ s, score });
    }
    out.sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name));
    return out.slice(0, limit || 8).map((o) => o.s);
  }

  function exact(q) {
    const n = norm(q);
    if (!n) return null;
    return list.find((s) => s._n === n) || list.find((s) => s._s === n) || null;
  }

  const ORIGIN = { N: 'Nativa do Brasil', E: 'Exótica', C: 'Confirmar' };
  const FRUIT = { S: 'Sim', N: 'Não' };

  // ---------- Busca na internet (só quando há sinal) ----------
  async function getJSON(url, ms) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), ms || 9000);
    try {
      const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(to); }
  }

  async function lookupOnline(name) {
    name = String(name || '').trim();
    if (!name) return null;
    const res = { query: name, scientific: '', family: '', origin: 'C', originNote: '', info: '', link: '' };
    const looksSci = /^[A-Z][a-z]+ [a-z-]+/.test(name);
    let key = null, canonical = '';
    try {
      if (looksSci) {
        const m = await getJSON('https://api.gbif.org/v1/species/match?kingdom=Plantae&name=' + encodeURIComponent(name));
        if (m && m.usageKey && m.matchType !== 'NONE') { key = m.acceptedUsageKey || m.usageKey; canonical = m.canonicalName || m.scientificName || ''; res.family = m.family || ''; }
      }
      if (!key) {
        const s = await getJSON('https://api.gbif.org/v1/species/search?rank=SPECIES&highertaxonKey=6&limit=6&q=' + encodeURIComponent(name));
        const hit = ((s && s.results) || []).find((r) => r.canonicalName && (r.taxonomicStatus === 'ACCEPTED' || !r.taxonomicStatus));
        if (hit) { key = hit.nubKey || hit.key; canonical = hit.canonicalName; res.family = hit.family || ''; }
      }
      if (key) {
        res.scientific = canonical;
        try {
          const d = await getJSON('https://api.gbif.org/v1/species/' + key + '/distributions?limit=200');
          const br = ((d && d.results) || []).filter((x) => (x.countryCode === 'BR' || /brazil|brasil/i.test(x.country || x.locality || '')) && x.establishmentMeans);
          if (br.some((x) => /^NATIVE$/i.test(x.establishmentMeans))) { res.origin = 'N'; res.originNote = 'Registrada como nativa no Brasil (GBIF)'; }
          else if (br.some((x) => /INTRODUCED|NATURALISED|NATURALIZED|INVASIVE/i.test(x.establishmentMeans))) { res.origin = 'E'; res.originNote = 'Registrada como introduzida no Brasil (GBIF)'; }
        } catch (e) { /* sem dados de distribuição */ }
      }
    } catch (e) { res.error = 'gbif'; }
    try {
      const title = res.scientific || name;
      const w = await getJSON('https://pt.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&redirects=1&origin=*&titles=' + encodeURIComponent(title));
      const pages = w && w.query && w.query.pages;
      const page = pages && Object.values(pages)[0];
      if (page && page.extract) res.info = page.extract.replace(/\s+/g, ' ').slice(0, 320).replace(/\s\S*$/, '') + '…';
      if (page && page.title) res.link = 'https://pt.wikipedia.org/wiki/' + encodeURIComponent(page.title.replace(/ /g, '_'));
    } catch (e) { /* sem texto */ }
    if (!res.scientific && !res.info) return null;
    return res;
  }

  AC.species = { list, search, exact, norm, ORIGIN, FRUIT, lookupOnline };
  if (typeof module !== 'undefined' && module.exports) module.exports = AC.species;
})(typeof window !== 'undefined' ? window : globalThis);
