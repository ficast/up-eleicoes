import { describe, it, expect } from 'vitest';
import { fixWorld } from '@/lib/geo';

const poly = (id: string, ring: number[][]): GeoJSON.Feature => ({ type: 'Feature', id, properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } });

describe('fixWorld', () => {
  it('remove a Antártida', () => {
    const fc = fixWorld({ type: 'FeatureCollection', features: [poly('010', [[0, -80], [1, -80], [0, -81], [0, -80]]), poly('076', [[-50, -10], [-40, -10], [-45, 0], [-50, -10]])] });
    expect(fc.features.map((f) => f.id)).toEqual(['076']);
  });
  it('anel que cruza o antimeridiano: negativas + 360', () => {
    const fc = fixWorld({ type: 'FeatureCollection', features: [poly('643', [[170, 60], [180, 65], [-180, 65], [-170, 66], [170, 60]])] });
    expect((fc.features[0].geometry as GeoJSON.Polygon).coordinates[0].map((c) => c[0])).toEqual([170, 180, 180, 190, 170]);
  });
  it('anel comum fica igual', () => {
    const ring = [[-50, -10], [-40, -10], [-45, 0], [-50, -10]];
    const fc = fixWorld({ type: 'FeatureCollection', features: [{ type: 'Feature', id: '076', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [[ring]] } }] });
    expect((fc.features[0].geometry as GeoJSON.MultiPolygon).coordinates[0][0]).toEqual(ring);
  });
});
