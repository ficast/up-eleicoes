import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

/** Cria um zip temporário com os arquivos dados (conteúdo gravado em latin1). */
export const mkZip = (files: Record<string, string>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'up-'));
  for (const [n, c] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), Buffer.from(c, 'latin1'));
  const zip = path.join(dir, 'z.zip');
  // bsdtar (Windows/macOS) cria zip; no Windows evita o GNU tar do Git Bash
  const tar = process.platform === 'win32' ? 'C:/Windows/System32/tar.exe' : 'tar';
  execFileSync(tar, ['-a', '-c', '-f', zip, '-C', dir, ...Object.keys(files)]);
  return { dir, zip };
};
