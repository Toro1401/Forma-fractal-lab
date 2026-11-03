/* Geometry is independent of the DOM and is also used inside the worker. */
(function (root) {
  'use strict';
  const MAX_SEGMENTS = 131072;
  function generate(folds, requestedIterations, mirror, limit = 131072) {
    if (!Array.isArray(folds) || folds.length < 1 || folds.length > 8 || folds.some(p => !Number.isFinite(p.u) || !Number.isFinite(p.v) || p.u < .01 || p.u > .99 || Math.abs(p.v) > 1.5)) throw new Error('Punti non validi');
    if (!Number.isInteger(requestedIterations) || requestedIterations < 0 || requestedIterations > 10) throw new Error('Iterazioni non valide');
    if (!Number.isFinite(limit) || limit < 1 || limit > 131072) throw new Error('Limite non valido');
    const multiplier = folds.length + 1;
    let iterations = 0;
    while (iterations < requestedIterations && Math.pow(multiplier, iterations + 1) <= limit) iterations++;
    let points = new Float64Array([0, 0, 1, 0]);
    let flips = new Uint8Array(1);
    for (let depth = 0; depth < iterations; depth++) {
      const count = points.length / 2 - 1;
      const next = new Float64Array((count * multiplier + 1) * 2);
      const nextFlips = new Uint8Array(count * multiplier);
      let offset = 0;
      for (let i = 0; i < count; i++) {
        const x = points[i * 2], y = points[i * 2 + 1];
        const dx = points[i * 2 + 2] - x, dy = points[i * 2 + 3] - y;
        next[offset++] = x; next[offset++] = y;
        for (const f of folds) {
          const v = f.v * (flips[i] ? -1 : 1);
          next[offset++] = x + f.u * dx - v * dy;
          next[offset++] = y + f.u * dy + v * dx;
        }
        for (let j = 0; j < multiplier; j++) nextFlips[i * multiplier + j] = mirror ? (flips[i] ^ (j % 2)) : 0;
      }
      next[offset++] = points[points.length - 2];
      next[offset] = points[points.length - 1];
      points = next; flips = nextFlips;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      minX = Math.min(minX, points[i]); maxX = Math.max(maxX, points[i]);
      minY = Math.min(minY, points[i + 1]); maxY = Math.max(maxY, points[i + 1]);
    }
    return {points, iterations, count: points.length / 2 - 1, bounds: {minX, maxX, minY, maxY}};
  }
  function validateProject(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.folds) || data.folds.length < 1 || data.folds.length > 8) throw new Error('Il file non è un progetto Forma valido.');
    const folds = data.folds.map(p => ({u: p?.u, v: p?.v}));
    if (folds.some(p => !Number.isFinite(p.u) || !Number.isFinite(p.v) || p.u < .01 || p.u > .99 || Math.abs(p.v) > 1.5)) throw new Error('Le coordinate del progetto non sono valide.');
    if (!Number.isInteger(data.iterations) || data.iterations < 0 || data.iterations > 10) throw new Error('Numero di iterazioni non valido.');
    const palette = ['lime','aurora','ocean','ember','chalk'].includes(data.palette) ? data.palette : 'lime';
    return {version:1, name: typeof data.name === 'string' ? data.name.slice(0,60) : 'Forma importata', folds, iterations:data.iterations, mirror: data.mirror === true, palette, lineWidth: typeof data.lineWidth === 'number' && Number.isFinite(data.lineWidth) ? Math.max(.5,Math.min(3,data.lineWidth)) : 1.3};
  }
  const api = {generate, validateProject, MAX_SEGMENTS};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FractalEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
