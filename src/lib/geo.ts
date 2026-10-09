/** Antártida (ISO numérico 010): sem votos e distorce o mapa plano. */
const ANTARTIDA = '010';

type Ring = number[][];
/** Anel que cruza o antimeridiano (salto de longitude > 180°): longitudes negativas viram > 180 (o MapLibre desenha). */
function fixRing(ring: Ring): Ring {
  const cruza = ring.some((c, i) => i > 0 && Math.abs(c[0] - ring[i - 1][0]) > 180);
  return cruza ? ring.map(([lon, ...rest]) => [lon < 0 ? lon + 360 : lon, ...rest]) : ring;
}

/** Prepara a malha do mundo para projeção plana: remove a Antártida e corrige polígonos que cruzam o antimeridiano. */
export function fixWorld(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  return {
    ...fc,
    features: fc.features.filter((f) => String(f.id) !== ANTARTIDA).map((f) => {
      const g = f.geometry;
      if (g?.type === 'Polygon') return { ...f, geometry: { ...g, coordinates: g.coordinates.map(fixRing) } };
      if (g?.type === 'MultiPolygon') return { ...f, geometry: { ...g, coordinates: g.coordinates.map((p) => p.map(fixRing)) } };
      return f;
    }),
  };
}
