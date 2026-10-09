import fs from 'node:fs';
import { CARGOS_POR_TIPO, TIPO, UNIDADE, type Ano, type Cargo, type CargoAnoFile, type LocaisInfoFile, type MetaFile, type TotalCargo } from '../../src/lib/data-types';
import { Aggregator, COLUNAS_SECAO } from './aggregate';
import { anosDoArgv } from './conferir';
import { readZipCsv } from './csv';
import { ensureFile, UFS, urls } from './download';
import { loadCentroides, loadExterior, loadLocais, loadTotalizados, loadTseIbge } from './refs';
import { rollup, type Refs } from './rollup';
import { OUT, writeJson } from './write';

const MAJORITARIOS = new Set<Cargo>(['presidente', 'governador', 'senador', 'prefeito']);

async function runAno(ano: Ano, base: Omit<Refs, 'locais'>): Promise<Partial<Record<Cargo, TotalCargo>>> {
  const tipo = TIPO[ano];
  const cargos = CARGOS_POR_TIPO[tipo];
  const refs: Refs = { ...base, locais: await loadLocais(await ensureFile(urls.locais(ano))) };
  console.log(`[${ano}] ${refs.locais.size} locais com coordenadas`);
  const totalizados = await loadTotalizados(await ensureFile(urls.candidato(ano)));
  console.log(`[${ano}] ${totalizados.candidatos.size} candidatos da UP com votos válidos/sub judice em ${totalizados.unidades.size} unidades`);
  const files = new Map<Cargo, CargoAnoFile>(cargos.map((c) => [c, {
    ano, cargo: c, candidatos: [], ufsComCandidatura: [], ufs: [], municipios: [], exterior: null,
  }]));
  const unidades = new Map<Cargo, number>();
  const infoPorUf = new Map<string, LocaisInfoFile>();

  const processZip = async (zip: string, cs: Cargo[]) => {
    const agg = new Aggregator(totalizados);
    for await (const r of readZipCsv(zip, () => true, COLUNAS_SECAO)) agg.add(r);
    for (const cargo of cs) {
      // só seções dentro das unidades (Brasil / UF / município) onde a UP disputou
      const secs = agg.sectionsComCandidatura(cargo);
      if (!secs.length) continue;
      const r = rollup(secs, refs);
      const f = files.get(cargo)!;
      f.candidatos = [...new Set([...f.candidatos, ...agg.candidatos(cargo)])].sort();
      f.ufsComCandidatura.push(...r.ufs.map((u) => u.uf));
      f.ufs.push(...r.ufs);
      f.municipios.push(...r.municipios);
      if (cargo === 'presidente') f.exterior = { cidades: r.cidades, paises: r.paises };
      unidades.set(cargo, (unidades.get(cargo) ?? 0) + agg.unidadesComCandidatura(cargo).size);
      for (const [uf, l] of r.locaisPorUf) {
        writeJson(`${ano}/${cargo}/locais/${uf}.json`, l.votos);
        infoPorUf.set(uf, { ...(infoPorUf.get(uf) ?? {}), ...l.info });
      }
    }
  };

  if (tipo === 'geral') await processZip(await ensureFile(urls.secao(ano, 'BR')), ['presidente']);
  const cargosUf = cargos.filter((c) => UNIDADE[c] !== 'br');
  const ufs = tipo === 'municipal' ? UFS.filter((u) => u !== 'DF') : UFS; // DF não tem eleição municipal
  for (const uf of ufs) {
    console.log(`[${ano}] ${uf}`);
    await processZip(await ensureFile(urls.secao(ano, uf)), cargosUf);
  }
  for (const [uf, info] of infoPorUf) writeJson(`${ano}/locais/${uf}.json`, info);

  const totais: Partial<Record<Cargo, TotalCargo>> = {};
  for (const [cargo, f] of files) {
    if (!f.ufs.length) continue;
    f.ufs.sort((a, b) => a.uf.localeCompare(b.uf));
    f.ufsComCandidatura.sort();
    writeJson(`${ano}/${cargo}.json`, f);
    const up = f.ufs.reduce((s, u) => s + u.up, 0);
    const upExterior = f.ufs.find((u) => u.uf === 'ZZ')?.up ?? 0;
    totais[cargo] = {
      up, validos: f.ufs.reduce((s, u) => s + u.validos, 0), upBrasil: up - upExterior, upExterior,
      unidadesComCandidatura: unidades.get(cargo) ?? 0,
      municipiosComVoto: f.municipios.filter((m) => m.up > 0).length,
      candidatos: MAJORITARIOS.has(cargo) ? f.candidatos : [],
    };
  }
  return totais;
}

async function main() {
  const anos = anosDoArgv(process.argv, () => true);
  const base = { tseIbge: loadTseIbge(), centroides: loadCentroides(), exterior: loadExterior() };
  const metaPath = `${OUT}/meta.json`;
  const meta: MetaFile = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    : { geradoEm: '', fonte: 'TSE — Portal de Dados Abertos (dadosabertos.tse.jus.br)', disponivel: {}, totais: {} };
  for (const ano of anos) {
    fs.rmSync(`${OUT}/${ano}`, { recursive: true, force: true });
    const totais = await runAno(ano, base);
    meta.totais[ano] = totais;
    meta.disponivel[ano] = Object.keys(totais) as Cargo[];
  }
  meta.geradoEm = new Date().toISOString();
  writeJson('meta.json', meta);
  console.log('ETL ok', JSON.stringify(meta.totais, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
