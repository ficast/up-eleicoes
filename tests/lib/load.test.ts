import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJson } from '@/lib/load';

afterEach(() => vi.unstubAllGlobals());

describe('fetchJson', () => {
  it('não guarda falhas de rede em cache', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ a: 1 }) });
    vi.stubGlobal('fetch', fn);
    expect(await fetchJson('/x/net.json')).toBeNull();
    expect(await fetchJson('/x/net.json')).toEqual({ a: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('não guarda erro de servidor nem JSON inválido', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => null })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new Error('json'); } })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => 7 });
    vi.stubGlobal('fetch', fn);
    expect(await fetchJson('/x/srv.json')).toBeNull();
    expect(await fetchJson('/x/srv.json')).toBeNull();
    expect(await fetchJson('/x/srv.json')).toBe(7);
  });
  it('404 fica em cache como null', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => null });
    vi.stubGlobal('fetch', fn);
    expect(await fetchJson('/x/nf.json')).toBeNull();
    expect(await fetchJson('/x/nf.json')).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
