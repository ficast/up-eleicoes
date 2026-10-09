import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const TSE = 'https://cdn.tse.jus.br/estatistica/sead/odsele';
export const CACHE = '.cache/tse';
export const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export const urls = {
  secao: (ano: number, uf: string) => `${TSE}/votacao_secao/votacao_secao_${ano}_${uf}.zip`,
  locais: (ano: number) => `${TSE}/eleitorado_locais_votacao/eleitorado_local_votacao_${ano}.zip`,
  partido: (ano: number) => `${TSE}/votacao_partido_munzona/votacao_partido_munzona_${ano}.zip`,
};

/** Baixa `url` para .cache/tse se ausente ou com tamanho diferente do servidor. Retorna o caminho local. */
export async function ensureFile(url: string): Promise<string> {
  fs.mkdirSync(CACHE, { recursive: true });
  const dest = path.join(CACHE, path.basename(url));
  const head = await fetch(url, { method: 'HEAD' });
  if (!head.ok) throw new Error(`HEAD ${url} → ${head.status}`);
  const size = Number(head.headers.get('content-length'));
  if (fs.existsSync(dest) && fs.statSync(dest).size === size) return dest;
  console.log(`↓ ${url} (${(size / 1e6).toFixed(0)} MB)`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`GET ${url} → ${res.status}`);
  const tmp = dest + '.part';
  await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(tmp));
  if (fs.statSync(tmp).size !== size) throw new Error(`Download incompleto: ${url}`);
  fs.renameSync(tmp, dest);
  return dest;
}
