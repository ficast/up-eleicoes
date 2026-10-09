import fs from 'node:fs';
import { ANOS, CARGOS_POR_TIPO, TIPO, type Ano, type CargoAnoFile } from '../../src/lib/data-types';
import { cargoFromCode } from './cargos';
import { readZipCsv } from './csv';
import { ensureFile, urls } from './download';

async function main() {
  let falhas = 0;
  const arg = process.argv.indexOf('--ano');
  const anos: Ano[] = arg > -1 ? [Number(process.argv[arg + 1]) as Ano] : ANOS.filter((a) => fs.existsSync(`public/data/${a}`));
  for (const ano of anos) {
    const CARGOS = CARGOS_POR_TIPO[TIPO[ano]];
    const oficial = new Map<string, { validos: number; anul: number }>();
    // só CSVs por UF: o zip também traz um _BRASIL.csv que duplicaria os totais
    for await (const r of readZipCsv(await ensureFile(urls.partido(ano)), (n) => !/BRASIL/i.test(n))) {
      if (r.NR_PARTIDO !== '80' || r.NR_TURNO !== '1') continue;
      const cargo = cargoFromCode(Number(r.CD_CARGO)); if (!cargo) continue;
      const k = `${cargo}|${r.SG_UF}`;
      const t = oficial.get(k) ?? { validos: 0, anul: 0 };
      t.validos += Number(r.QT_VOTOS_NOMINAIS_VALIDOS) + Number(r.QT_VOTOS_LEGENDA_VALIDOS);
      t.anul += ['QT_VOTOS_LEGENDA_ANUL_SUBJUD', 'QT_VOTOS_NOMINAIS_ANUL_SUBJUD', 'QT_VOTOS_LEGENDA_ANULADOS', 'QT_VOTOS_NOMINAIS_ANULADOS']
        .reduce((s, c) => s + Number(r[c] || 0), 0);
      oficial.set(k, t);
    }
    for (const cargo of CARGOS) {
      const p = `public/data/${ano}/${cargo}.json`;
      const nosso = new Map<string, number>();
      if (fs.existsSync(p)) for (const u of (JSON.parse(fs.readFileSync(p, 'utf8')) as CargoAnoFile).ufs) nosso.set(u.uf, u.up);
      const ufs = new Set([...nosso.keys(), ...[...oficial.keys()].filter((k) => k.startsWith(cargo + '|')).map((k) => k.split('|')[1])]);
      for (const uf of ufs) {
        const o = oficial.get(`${cargo}|${uf}`) ?? { validos: 0, anul: 0 };
        const n = nosso.get(uf) ?? 0;
        const ok = n >= o.validos && n <= o.validos + o.anul;
        if (!ok) { falhas++; console.error(`✗ ${ano} ${cargo} ${uf}: nosso=${n} oficial=${o.validos} (+${o.anul} anulados)`); }
      }
      console.log(`✓ ${ano} ${cargo}: ${ufs.size} UFs conferidas`);
    }
  }
  if (falhas) { console.error(`${falhas} divergências`); process.exit(1); }
  console.log('validação ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
