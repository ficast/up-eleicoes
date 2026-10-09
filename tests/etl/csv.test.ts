import { describe, it, expect } from 'vitest';
import { parseLine, readZipCsv } from '../../scripts/etl/csv';
import fs from 'node:fs';
import { mkZip } from './zip-helper';

describe('parseLine', () => {
  it('lida com campos com e sem aspas', () => {
    expect(parseLine('"AC";1392;"RIO BRANCO";9')).toEqual(['AC', '1392', 'RIO BRANCO', '9']);
  });
  it('preserva ; e aspas escapadas dentro de aspas', () => {
    expect(parseLine('"A;B";"diz ""oi""";3')).toEqual(['A;B', 'diz "oi"', '3']);
  });
  it('campo vazio', () => {
    expect(parseLine('"";1;')).toEqual(['', '1', '']);
  });
});

describe('readZipCsv', () => {
  it('lê CSV latin1 de dentro de zip', async () => {
    const { zip } = mkZip({ 'x.csv': '"NM";"QT"\n"SÃO PAULO";3\n' });
    const rows = []; for await (const r of readZipCsv(zip)) rows.push(r);
    expect(rows).toEqual([{ NM: 'SÃO PAULO', QT: '3' }]);
  });

  it('lê vários CSVs do zip, em ordem', async () => {
    const { zip } = mkZip({ 'a.csv': '"N"\n1\n2\n', 'b.csv': '"N"\n3\n' });
    const rows = []; for await (const r of readZipCsv(zip)) rows.push(r.N);
    expect(rows).toEqual(['1', '2', '3']);
  });

  it('libera o arquivo ao interromper a iteração', async () => {
    const { dir, zip } = mkZip({ 'a.csv': '"N"\n1\n2\n3\n' });
    for await (const r of readZipCsv(zip)) { expect(r.N).toBe('1'); break; }
    fs.rmSync(zip); // falha no Windows se o handle vazou
    expect(fs.existsSync(zip)).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('exige colunas obrigatórias, com o nome do arquivo no erro', async () => {
    const { zip } = mkZip({ 'ok.csv': '"A";"B"\n1;2\n', 'ruim.csv': '"A"\n1\n' });
    const rows: string[] = [];
    await expect((async () => { for await (const r of readZipCsv(zip, () => true, ['A', 'B'])) rows.push(r.A); })())
      .rejects.toThrow(/ruim\.csv.*B/);
    expect(rows).toEqual(['1']);
  });
});
