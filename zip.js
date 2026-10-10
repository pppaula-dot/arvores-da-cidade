/* Árvores da Cidade — zip.js
   Escrita (sem compressão — fotos JPEG já são comprimidas) e leitura de arquivos .zip. */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(u8) {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  const enc = new TextEncoder();

  async function toBytes(data) {
    if (typeof data === 'string') return enc.encode(data);
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    return new Uint8Array(await data.arrayBuffer()); // Blob
  }

  class ZipWriter {
    constructor() { this.parts = []; this.central = []; this.offset = 0; this.count = 0; this.names = new Set(); }

    async addFile(name, data, dateMs) {
      name = String(name).replace(/\\/g, '/').replace(/^\/+/, '');
      // evita nomes repetidos dentro do zip
      if (this.names.has(name)) {
        const dot = name.lastIndexOf('.');
        const base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
        let i = 2;
        while (this.names.has(base + '_' + i + ext)) i++;
        name = base + '_' + i + ext;
      }
      this.names.add(name);
      const bytes = await toBytes(data);
      const nameBytes = enc.encode(name);
      const crc = crc32(bytes);
      const d = new Date(dateMs || Date.now());
      const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
      const dosDate = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true); // nomes em UTF-8
      lh.setUint16(8, 0, true); // sem compressão
      lh.setUint16(10, dosTime, true);
      lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, bytes.length, true);
      lh.setUint32(22, bytes.length, true);
      lh.setUint16(26, nameBytes.length, true);
      lh.setUint16(28, 0, true);
      this.parts.push(new Uint8Array(lh.buffer), nameBytes, bytes);

      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, bytes.length, true);
      ch.setUint32(24, bytes.length, true);
      ch.setUint16(28, nameBytes.length, true);
      ch.setUint32(42, this.offset, true);
      this.central.push(new Uint8Array(ch.buffer), nameBytes);

      this.offset += 30 + nameBytes.length + bytes.length;
      this.count++;
    }

    finish() {
      let centralSize = 0;
      for (const p of this.central) centralSize += p.length;
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true);
      end.setUint16(8, this.count, true);
      end.setUint16(10, this.count, true);
      end.setUint32(12, centralSize, true);
      end.setUint32(16, this.offset, true);
      return new Blob([...this.parts, ...this.central, new Uint8Array(end.buffer)], { type: 'application/zip' });
    }
  }

  // ---------- Leitura ----------
  async function inflateRaw(u8) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([u8]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readZip(blob) {
    const size = blob.size;
    const tailLen = Math.min(size, 65557);
    const tail = new DataView(await blob.slice(size - tailLen, size).arrayBuffer());
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Arquivo zip inválido');
    const total = tail.getUint16(eocd + 10, true);
    const cdSize = tail.getUint32(eocd + 12, true);
    const cdOff = tail.getUint32(eocd + 16, true);
    const cd = new DataView(await blob.slice(cdOff, cdOff + cdSize).arrayBuffer());
    const dec = new TextDecoder();
    const entries = [];
    let p = 0;
    for (let i = 0; i < total; i++) {
      if (cd.getUint32(p, true) !== 0x02014b50) throw new Error('Diretório do zip corrompido');
      const method = cd.getUint16(p + 10, true);
      const compSize = cd.getUint32(p + 20, true);
      const uncompSize = cd.getUint32(p + 24, true);
      const nameLen = cd.getUint16(p + 28, true);
      const extraLen = cd.getUint16(p + 30, true);
      const commentLen = cd.getUint16(p + 32, true);
      const localOff = cd.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      entries.push({
        name, method, size: uncompSize,
        async bytes() {
          const lh = new DataView(await blob.slice(localOff, localOff + 30).arrayBuffer());
          const start = localOff + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
          const raw = new Uint8Array(await blob.slice(start, start + compSize).arrayBuffer());
          return method === 0 ? raw : inflateRaw(raw);
        },
        async blob(type) { return new Blob([await this.bytes()], { type: type || '' }); },
        async text() { return dec.decode(await this.bytes()); },
      });
    }
    return entries;
  }

  AC.zip = { ZipWriter, readZip, crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = AC.zip;
})(typeof window !== 'undefined' ? window : globalThis);
