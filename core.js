/* crash(500) — core.js : logique pure de réservation mémoire (testable hors navigateur) */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.MemoryLock = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MIB = 1024 * 1024;
  const PATTERN = 0x2a; // '*' — motif écrit dans chaque octet
  const DEFAULT_CHUNK = 16 * MIB;

  /**
   * Alloue EXACTEMENT `totalBytes` octets de mémoire, répartis en blocs de
   * `chunkSize` (au maximum), et écrit chaque octet (memset) pour que la
   * mémoire soit réellement consommée par le processus.
   * Renvoie le tableau des ArrayBuffer — le garder en référence globale.
   */
  function allocateExactly(totalBytes, opts) {
    const options = opts || {};
    const total = Math.floor(totalBytes);
    if (!Number.isFinite(total) || total <= 0) {
      throw new TypeError("totalBytes doit être un entier strictement positif");
    }
    const chunkSize = Math.min(
      Number.isFinite(options.chunkSize) && options.chunkSize > 0
        ? Math.floor(options.chunkSize)
        : DEFAULT_CHUNK,
      total
    );
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;

    const chunks = [];
    let done = 0;

    while (done < total) {
      const size = Math.min(chunkSize, total - done);
      const buf = new ArrayBuffer(size);
      // Memset : chaque page est écrite => réellement résidente en RAM.
      new Uint8Array(buf).fill(PATTERN);
      chunks.push(buf);
      done += size;
      if (onProgress) onProgress(done, total);
    }
    return chunks;
  }

  /** Total exact d'octets réservés. */
  function totalBytes(chunks) {
    return chunks.reduce(function (sum, buf) { return sum + buf.byteLength; }, 0);
  }

  /**
   * Relecture d'échantillons : vérifie que la mémoire est bien écrite/résidente.
   * Renvoie { ok, samplesRead, mismatches }.
   */
  function sampleVerify(chunks, samples) {
    const count = Number.isFinite(samples) && samples > 0 ? Math.floor(samples) : 128;
    if (!Array.isArray(chunks) || chunks.length === 0) {
      return { ok: false, samplesRead: 0, mismatches: 0 };
    }
    let mismatches = 0;
    for (let i = 0; i < count; i++) {
      const buf = chunks[i % chunks.length];
      const view = new Uint8Array(buf);
      const pos = Math.floor(Math.random() * buf.byteLength);
      if (view[pos] !== PATTERN) mismatches++;
    }
    return { ok: mismatches === 0, samplesRead: count, mismatches: mismatches };
  }

  /** Formatage fr-FR : 524 288 000 */
  function formatFr(n) {
    try {
      return new Intl.NumberFormat("fr-FR").format(n);
    } catch (e) {
      return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
    }
  }

  function toHex(n) {
    return "0x" + Math.floor(n).toString(16).toUpperCase();
  }

  return {
    MIB: MIB,
    PATTERN: PATTERN,
    allocateExactly: allocateExactly,
    totalBytes: totalBytes,
    sampleVerify: sampleVerify,
    formatFr: formatFr,
    toHex: toHex
  };
});
