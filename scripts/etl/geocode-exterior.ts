import fs from 'node:fs';
import countries from 'i18n-iso-countries';
import pt from 'i18n-iso-countries/langs/pt.json' with { type: 'json' };
import { readZipCsv } from './csv';
import { ensureFile, urls } from './download';
import { titleCase } from './refs';

countries.registerLocale(pt);
const OUT = 'data/ref/exterior_cidades.json';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const prev: any[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
  const known = new Map(prev.map((c) => [c.tse, c]));
  const cidades = new Map<number, string>();
  for (const ano of [2022, 2026]) {
    for await (const r of readZipCsv(await ensureFile(urls.secao(ano, 'BR')))) {
      if (r.SG_UF === 'ZZ') cidades.set(Number(r.CD_MUNICIPIO), r.NM_MUNICIPIO);
    }
  }
  const out = [];
  for (const [tse, nomeTse] of [...cidades].sort((a, b) => a[0] - b[0])) {
    if (known.has(tse)) { out.push(known.get(tse)); continue; }
    const q = encodeURIComponent(nomeTse);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&accept-language=pt-BR&addressdetails=1&featuretype=city`,
      { headers: { 'User-Agent': 'up-eleicoes/0.1 (hotsite eleitoral)' } });
    const [hit] = (await res.json()) as any[];
    const iso2 = hit?.address?.country_code?.toUpperCase();
    out.push({
      tse, nome: titleCase(nomeTse),
      iso3: iso2 ? countries.alpha2ToAlpha3(iso2) : '???', isoNum: iso2 ? countries.alpha2ToNumeric(iso2) : '???',
      pais: iso2 ? countries.getName(iso2, 'pt') : '???',
      lat: hit ? +Number(hit.lat).toFixed(4) : null, lon: hit ? +Number(hit.lon).toFixed(4) : null,
    });
    console.log(tse, nomeTse, '→', iso2, hit?.display_name);
    await sleep(1100); // política de uso do Nominatim: 1 req/s
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(out.length, 'cidades;', out.filter((c) => c.iso3 === '???').length, 'sem país');
}
main().catch((e) => { console.error(e); process.exit(1); });
