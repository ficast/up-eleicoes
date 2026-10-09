import fs from 'node:fs';
import { CARGOS_POR_TIPO, TIPO, type CargoAnoFile } from '../../src/lib/data-types';
import { cargoFromCode } from './cargos';
import { anosDoArgv, confere, somaOficial, type Oficial } from './conferir';
import { readZipCsv } from './csv';
import { ensureFile, urls } from './download';

async function main() {
  let falhas = 0;
  const anos = anosDoArgv(process.argv, (a) => fs.existsSync(`public/data/${a}`));
  for (const ano of anos) {
    const CARGOS = CARGOS_POR_TIPO[TIPO[ano]];
    const oficial = new Map<string, Oficial>();
    const cols = ['NR_PARTIDO', 'NR_TURNO', 'CD_CARGO', 'SG_UF', 'QT_VOTOS_NOMINAIS_VALIDOS', 'QT_VOTOS_LEGENDA_VALIDOS',
      'QT_VOTOS_LEGENDA_ANUL_SUBJUD', 'QT_VOTOS_NOMINAIS_ANUL_SUBJUD'];
    // só CSVs por UF: o zip também traz um _BRASIL.csv que duplicaria os totais
    for await (const r of readZipCsv(await ensureFile(urls.partido(ano)), (n) => !/BRASIL/i.test(n), cols)) {
      if (r.NR_PARTIDO !== '80' || r.NR_TURNO !== '1') continue;
      const cargo = cargoFromCode(Number(r.CD_CARGO)); if (!cargo) continue;
      const k = `${cargo}|${r.SG_UF}`;
      const t = oficial.get(k) ?? { validos: 0, subjud: 0 };
      const s = somaOficial(r);
      t.validos += s.validos; t.subjud += s.subjud;
      oficial.set(k, t);
    }
    for (const cargo of CARGOS) {
      const p = `public/data/${ano}/${cargo}.json`;
      const nosso = new Map<string, number>();
      if (fs.existsSync(p)) for (const u of (JSON.parse(fs.readFileSync(p, 'utf8')) as CargoAnoFile).ufs) nosso.set(u.uf, u.up);
      // UFs com voto válido/sub judice oficial (UF só com votos anulados, ex. GO 2022 depfed, fica de fora) ou no nosso
      const ufs = new Set([...nosso.keys(), ...[...oficial].filter(([k, o]) => k.startsWith(cargo + '|') && o.validos + o.subjud > 0).map(([k]) => k.split('|')[1])]);
      for (const uf of ufs) {
        const o = oficial.get(`${cargo}|${uf}`) ?? { validos: 0, subjud: 0 };
        const n = nosso.get(uf) ?? 0;
        if (!confere(n, o)) {
          falhas++; console.error(`✗ ${ano} ${cargo} ${uf}: nosso=${nosso.has(uf) ? n : '—'} oficial=${o.validos} (+${o.subjud} sub judice)`);
        }
      }
      console.log(`✓ ${ano} ${cargo}: ${ufs.size} UFs conferidas`);
    }
  }
  if (falhas) { console.error(`${falhas} divergências`); process.exit(1); }
  console.log('validação ok');
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
