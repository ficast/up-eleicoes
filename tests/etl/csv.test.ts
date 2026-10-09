import { describe, it, expect } from 'vitest';
import { parseLine, readZipCsv } from '../../scripts/etl/csv';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'up-'));
    const csv = path.join(dir, 'x.csv');
    fs.writeFileSync(csv, Buffer.from('"NM";"QT"\n"SÃO PAULO";3\n', 'latin1'));
    const zip = path.join(dir, 'x.zip');
    // bsdtar (Windows/macOS) cria zip; no Windows evita o GNU tar do Git Bash
    const tar = process.platform === 'win32' ? 'C:/Windows/System32/tar.exe' : 'tar';
    execFileSync(tar, ['-a', '-c', '-f', zip, '-C', dir, 'x.csv']);
    const rows = []; for await (const r of readZipCsv(zip)) rows.push(r);
    expect(rows).toEqual([{ NM: 'SÃO PAULO', QT: '3' }]);
  });

  const mkZip = (files: Record<string, string>) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'up-'));
    for (const [n, c] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), Buffer.from(c, 'latin1'));
    const zip = path.join(dir, 'z.zip');
    const tar = process.platform === 'win32' ? 'C:/Windows/System32/tar.exe' : 'tar';
    execFileSync(tar, ['-a', '-c', '-f', zip, '-C', dir, ...Object.keys(files)]);
    return { dir, zip };
  };

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
});
