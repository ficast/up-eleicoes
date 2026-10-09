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
  const sizeKnown = Number.isFinite(size) && size > 0;
  if (fs.existsSync(dest)) {
    const have = fs.statSync(dest).size;
    if (sizeKnown ? have === size : have > 0) return dest;
  }
  for (let tentativa = 1; ; tentativa++) {
    try { return await download(url, dest, size, sizeKnown); } catch (e) {
      if (tentativa >= 3) throw e;
      console.warn(`falha ao baixar ${url} (tentativa ${tentativa}): ${e}`);
    }
  }
}

const IDLE_MS = 60_000;

async function download(url: string, dest: string, size: number, sizeKnown: boolean): Promise<string> {
  console.log(`↓ ${url}${sizeKnown ? ` (${(size / 1e6).toFixed(0)} MB)` : ''}`);
  // nome temporário por processo: dois processos baixando o mesmo arquivo não colidem
  const tmp = `${dest}.${process.pid}.part`;
  const ac = new AbortController();
  let timer = setTimeout(() => ac.abort(new Error(`download parado há ${IDLE_MS / 1000}s`)), IDLE_MS);
  const touch = () => { clearTimeout(timer); timer = setTimeout(() => ac.abort(new Error(`download parado há ${IDLE_MS / 1000}s`)), IDLE_MS); };
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok || !res.body) throw new Error(`GET ${url} → ${res.status}`);
    const body = Readable.fromWeb(res.body as any);
    body.on('data', touch);
    await pipeline(body, fs.createWriteStream(tmp), { signal: ac.signal });
    const got = fs.statSync(tmp).size;
    const expected = Number(res.headers.get('content-length'));
    if (got === 0 || (sizeKnown && got !== size) || (!sizeKnown && Number.isFinite(expected) && expected > 0 && got !== expected)) {
      throw new Error(`Download incompleto: ${url}`);
    }
    fs.renameSync(tmp, dest);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  } finally {
    clearTimeout(timer);
  }
  return dest;
}
