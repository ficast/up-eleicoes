import fs from 'node:fs';
import { topology } from 'topojson-server';
import { geoArea, geoCentroid } from 'd3-geo';

/** A IBGE usa a orientação do RFC 7946 (anel externo anti-horário); o d3-geo espera horário e,
 *  sem correção, interpreta cada polígono como o complemento da esfera (centroide = antípoda). */
const rewind = (f: any) => {
  if (geoArea(f) <= 2 * Math.PI) return;
  const rev = (poly: number[][][]) => poly.map((ring) => ring.slice().reverse());
  const g = f.geometry;
  g.coordinates = g.type === 'Polygon' ? rev(g.coordinates) : g.coordinates.map(rev);
};

const IBGE = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR';
const get = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url} → ${r.status}`); return r.json(); };

const UF_SIGLA: Record<string, string> = { '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO','21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA','31':'MG','32':'ES','33':'RJ','35':'SP','41':'PR','42':'SC','43':'RS','50':'MS','51':'MT','52':'GO','53':'DF' };

async function main() {
  fs.mkdirSync('public/geo', { recursive: true });
  const mun = await get(`${IBGE}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`);
  const centroides: Record<string, [number, number]> = {};
  for (const f of mun.features) {
    const id = Number(f.properties.codarea);
    if (!id) throw new Error(`feature sem codarea: ${JSON.stringify(f.properties)}`);
    f.id = id; f.properties = { uf: UF_SIGLA[String(id).slice(0, 2)] };
    rewind(f);
    const [lon, lat] = geoCentroid(f);
    centroides[id] = [+lon.toFixed(4), +lat.toFixed(4)];
  }
  fs.writeFileSync('public/geo/br-municipios.topo.json', JSON.stringify(topology({ municipios: mun }, 1e5)));
  fs.writeFileSync('data/ref/centroides.json', JSON.stringify(centroides));

  const ufs = await get(`${IBGE}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF`);
  for (const f of ufs.features) { rewind(f); f.id = UF_SIGLA[f.properties.codarea]; f.properties = {}; }
  fs.writeFileSync('public/geo/br-ufs.topo.json', JSON.stringify(topology({ ufs }, 1e5)));

  fs.copyFileSync('node_modules/world-atlas/countries-110m.json', 'public/geo/world.topo.json');
  console.log('geo ok', mun.features.length, 'municípios', ufs.features.length, 'UFs');
}
main().catch((e) => { console.error(e); process.exit(1); });
