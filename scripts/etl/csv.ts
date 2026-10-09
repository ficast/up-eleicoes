import yauzl from 'yauzl';
import readline from 'node:readline';
import type { Readable } from 'node:stream';

export function parseLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  const n = line.length;
  while (i <= n) {
    if (line[i] === '"') {
      let s = ''; i++;
      while (i < n) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') { s += '"'; i += 2; continue; }
          i++; break;
        }
        s += line[i++];
      }
      out.push(s);
      i++; // pula ';'
    } else {
      const j = line.indexOf(';', i);
      const end = j === -1 ? n : j;
      out.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return out;
}

function openZip(path: string): Promise<yauzl.ZipFile> {
  return new Promise((res, rej) => yauzl.open(path, { lazyEntries: true, autoClose: false }, (e, z) => (e ? rej(e) : res(z!))));
}

/** Lista as entradas .csv do zip que passam no filtro. */
export async function listZipCsv(zipPath: string, filter: (name: string) => boolean = () => true): Promise<string[]> {
  const zip = await openZip(zipPath);
  const names: string[] = [];
  try {
    await new Promise<void>((res, rej) => {
      zip.on('entry', (e: yauzl.Entry) => { if (e.fileName.endsWith('.csv') && filter(e.fileName)) names.push(e.fileName); zip.readEntry(); });
      zip.on('end', () => res()); zip.on('error', rej); zip.readEntry();
    });
  } finally { zip.close(); }
  return names;
}

/** Itera as linhas (como objetos coluna→valor) de todos os CSVs do zip que passam no filtro. */
export async function* readZipCsv(zipPath: string, filter: (name: string) => boolean = () => true): AsyncGenerator<Record<string, string>> {
  const zip = await openZip(zipPath);
  try {
    const entries: yauzl.Entry[] = [];
    await new Promise<void>((res, rej) => {
      zip.on('entry', (e: yauzl.Entry) => { if (e.fileName.endsWith('.csv') && filter(e.fileName)) entries.push(e); zip.readEntry(); });
      zip.on('end', () => res()); zip.on('error', rej); zip.readEntry();
    });
    for (const entry of entries) {
      const stream: Readable = await new Promise((res, rej) => zip.openReadStream(entry, (e, s) => (e ? rej(e) : res(s!))));
      stream.setEncoding('latin1');
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
      try {
        let header: string[] | null = null;
        for await (const line of rl) {
          if (!line) continue;
          const cells = parseLine(line);
          if (!header) { header = cells; continue; }
          const row: Record<string, string> = {};
          for (let k = 0; k < header.length; k++) row[header[k]] = cells[k] ?? '';
          yield row;
        }
      } finally { rl.close(); stream.destroy(); }
    }
  } finally { zip.close(); }
}
