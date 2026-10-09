// MapLibre 6 (ESM) carrega o worker por URL relativa ao módulo, o que o bundler do Next não resolve.
// Copiamos o worker para public/ e o MapPanel aponta para ele com setWorkerUrl.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const src = path.join(path.dirname(require.resolve('maplibre-gl/package.json')), 'dist', 'maplibre-gl-worker.mjs');
const dest = path.join(import.meta.dirname, '..', 'public', 'maplibre', 'maplibre-gl-worker.mjs');
mkdirSync(path.dirname(dest), { recursive: true });
copyFileSync(src, dest);
