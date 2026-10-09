import fs from 'node:fs';
import path from 'node:path';
export const OUT = 'public/data';
export function writeJson(rel: string, data: unknown) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data));
}
