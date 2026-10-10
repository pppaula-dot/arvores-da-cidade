/* Árvores da Cidade — db.js
   Armazenamento no próprio aparelho (IndexedDB). Tudo é salvo na hora, sem botão "salvar". */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const DB_NAME = 'arvores-da-cidade';
  const DB_VERSION = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('trees')) db.createObjectStore('trees', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('photos')) {
          const s = db.createObjectStore('photos', { keyPath: 'id' });
          s.createIndex('treeId', 'treeId', { unique: false });
        }
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function wrap(storeNames, mode, fn) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeNames, mode);
          let result;
          tx.oncomplete = () => resolve(result);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error('Transação cancelada'));
          result = fn(tx);
        })
    );
  }
  const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  async function put(store, value) { const db = await open(); const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value); return txDone(tx); }
  async function get(store, key) { const db = await open(); return req2p(db.transaction(store).objectStore(store).get(key)); }
  async function getAll(store) { const db = await open(); return req2p(db.transaction(store).objectStore(store).getAll()); }
  async function del(store, key) { const db = await open(); const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); return txDone(tx); }
  function txDone(tx) { return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); }
  async function photosOfTree(treeId) {
    const db = await open();
    return req2p(db.transaction('photos').objectStore('photos').index('treeId').getAll(treeId));
  }
  async function clearAll() {
    const db = await open();
    const tx = db.transaction(['trees', 'photos', 'blobs', 'meta'], 'readwrite');
    ['trees', 'photos', 'blobs', 'meta'].forEach((s) => tx.objectStore(s).clear());
    return txDone(tx);
  }

  // ---------- Ids e código sequencial ----------
  function uid() {
    if (root.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  async function nextCode() {
    const m = (await get('meta', 'seq')) || { key: 'seq', value: 0 };
    m.value += 1;
    await put('meta', m);
    return 'ARV-' + String(m.value).padStart(4, '0');
  }
  async function getMeta(key, dflt) { const m = await get('meta', key); return m ? m.value : dflt; }
  async function setMeta(key, value) { return put('meta', { key, value }); }

  // ---------- Árvores ----------
  function newTree() {
    const now = Date.now();
    return {
      id: uid(), code: null, draft: true, createdAt: now, updatedAt: now,
      city: '', state: '', neighborhood: '', street: '', placePending: false, placeManual: false,
      lat: null, lng: null, accuracy: null, coordSource: '', // gps | exif | mapa | manual
      species: '', scientific: '', identified: true, speciesFromList: false,
      origin: '', originConfirm: false, fruit: '', fruitConfirm: false, medicinal: false, threatened: false,
      height: '', trunk: '', crown: '',
      flowering: false, flowerColor: '', fruiting: false,
      health: '', placeType: '', notes: '',
      favorite: false, ignoreNearby: [],
      visits: [{ id: uid(), date: now, notes: '' }],
    };
  }
  const saveTree = (t) => { t.updatedAt = Date.now(); return put('trees', t); };
  const allTrees = () => getAll('trees');
  const getTree = (id) => get('trees', id);

  async function deleteTree(id) {
    const photos = await photosOfTree(id);
    const db = await open();
    const tx = db.transaction(['trees', 'photos', 'blobs'], 'readwrite');
    tx.objectStore('trees').delete(id);
    photos.forEach((p) => { tx.objectStore('photos').delete(p.id); tx.objectStore('blobs').delete(p.id); });
    return txDone(tx);
  }

  // ---------- Fotos ----------
  async function savePhoto(meta, blobs) {
    const db = await open();
    const tx = db.transaction(['photos', 'blobs'], 'readwrite');
    tx.objectStore('photos').put(meta);
    tx.objectStore('blobs').put({ id: meta.id, orig: blobs.orig, stamped: blobs.stamped });
    return txDone(tx);
  }
  async function updatePhotoMeta(meta) { return put('photos', meta); }
  async function getBlobs(id) { return get('blobs', id); }
  async function setStamped(id, stamped, thumb) {
    const db = await open();
    const tx = db.transaction(['photos', 'blobs'], 'readwrite');
    const bs = tx.objectStore('blobs'), ps = tx.objectStore('photos');
    const rb = bs.get(id);
    rb.onsuccess = () => { const b = rb.result; if (b) { b.stamped = stamped; bs.put(b); } };
    if (thumb) {
      const rp = ps.get(id);
      rp.onsuccess = () => { const p = rp.result; if (p) { p.thumb = thumb; ps.put(p); } };
    }
    return txDone(tx);
  }
  async function deletePhoto(id) {
    const db = await open();
    const tx = db.transaction(['photos', 'blobs'], 'readwrite');
    tx.objectStore('photos').delete(id); tx.objectStore('blobs').delete(id);
    return txDone(tx);
  }
  const allPhotos = () => getAll('photos');

  AC.db = {
    open, put, get, getAll, del, uid, nextCode, getMeta, setMeta, newTree, saveTree, allTrees, getTree,
    deleteTree, savePhoto, updatePhotoMeta, getBlobs, setStamped, deletePhoto, photosOfTree, allPhotos, clearAll,
  };
})(typeof window !== 'undefined' ? window : globalThis);
