import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureFile } from '../../scripts/etl/download';

const body = Buffer.alloc(256 * 1024, 7);
let server: http.Server;
let base = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-length': body.length });
    if (req.method === 'HEAD') return res.end();
    // envia em duas metades para que downloads simultâneos se intercalem
    res.write(body.subarray(0, body.length / 2));
    setTimeout(() => res.end(body.subarray(body.length / 2)), 50);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('ensureFile', () => {
  it('dois downloads simultâneos do mesmo arquivo não colidem no arquivo temporário', async () => {
    const name = `test-download-${process.pid}-${Date.now()}.bin`;
    const [a, b] = await Promise.all([ensureFile(`${base}/${name}`), ensureFile(`${base}/${name}`)]);
    try {
      expect(a).toBe(b);
      expect(fs.readFileSync(a).equals(body)).toBe(true);
      expect(fs.readdirSync('.cache/tse').filter((f) => f.startsWith(name) && f.endsWith('.part'))).toEqual([]);
    } finally {
      fs.rmSync(a, { force: true });
    }
  });
});
