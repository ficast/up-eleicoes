import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJson } from '@/lib/load';

afterEach(() => vi.unstubAllGlobals());

const ok = (data: unknown) => ({ data, error: false });
const fail = { data: null, error: true };

describe('fetchJson', () => {
  it('falha de rede é erro e não fica em cache', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ a: 1 }) });
    vi.stubGlobal('fetch', fn);
    expect(await fetchJson('/x/net.json')).toEqual(fail);
    expect(await fetchJson('/x/net.json')).toEqual(ok({ a: 1 }));
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('erro de servidor e JSON inválido são erro e não ficam em cache', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => null })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new Error('json'); } })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => 7 });
    vi.stubGlobal('fetch', fn);
    expect(await fetchJson('/x/srv.json')).toEqual(fail);
    expect(await fetchJson('/x/srv.json')).toEqual(fail);
    expect(await fetchJson('/x/srv.json')).toEqual(ok(7));
  });
  it('404 não é erro (arquivo inexistente) e fica em cache', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => null });
    vi.stubGlobal('fetch', fn);
    expect(await fetchJson('/x/nf.json')).toEqual(ok(null));
    expect(await fetchJson('/x/nf.json')).toEqual(ok(null));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
