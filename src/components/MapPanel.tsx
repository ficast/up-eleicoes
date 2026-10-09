'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MLMap, Marker, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { Tally } from '@/lib/data-types';
import type { Filters } from '@/lib/filters';
import type { ViewModel, ViewRow } from '@/lib/view';
import type { PointRow } from '@/lib/usePoints';
import { PALETTE } from '@/lib/colors';
import { CIRCLE_RADIUS_EXPR, POINTS_ZOOM, colorLayer, legendTitle, makeScale } from '@/lib/mapScale';
import { esc, fmtDelta, fmtInt, fmtPct } from '@/lib/format';
import { value } from '@/lib/metrics';
import { fixWorld } from '@/lib/geo';
import { MapLegend } from './MapLegend';

// Copiado de node_modules por scripts/copy-maplibre-worker.mjs (predev/prebuild).
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

type FC = GeoJSON.FeatureCollection;
type Feat = GeoJSON.Feature;
const EMPTY: FC = { type: 'FeatureCollection', features: [] };

const GEO = {
  ufs: ['/geo/br-ufs.topo.json', 'ufs'],
  mun: ['/geo/br-municipios.topo.json', 'municipios'],
  world: ['/geo/world.topo.json', 'countries'],
} as const;
const geoCache = new Map<keyof typeof GEO, Promise<FC | null>>();
/** Malha sob demanda (municípios só ao entrar numa UF). `null` = malha indisponível (não fica em cache). */
function loadGeo(k: keyof typeof GEO): Promise<FC | null> {
  if (!geoCache.has(k)) {
    const [url, obj] = GEO[k];
    // fetch direto (sem o cache de 404 do fetchJson): malha ausente é erro e deve poder ser tentada de novo
    geoCache.set(k, fetch(url).then((r) => (r.ok ? (r.json() as Promise<Topology>) : null)).catch(() => null).then((t) => {
      if (!t?.objects[obj]) { geoCache.delete(k); return null; }
      const fc = feature(t, t.objects[obj]) as unknown as FC;
      return k === 'world' ? fixWorld(fc) : fc;
    }));
  }
  return geoCache.get(k)!;
}

/**
 * Exterior (UF 'ZZ' do TSE) no mapa do Brasil, escopo 'tudo': um quadrado no Atlântico, a leste do Nordeste
 * (a costa mais a leste fica em −34,8°), longe de Noronha (−3,9°) e de Trindade (−20,5°).
 */
const EXTERIOR_ID = 'ZZ';
const EXTERIOR_FT: Feat = {
  type: 'Feature', id: EXTERIOR_ID, properties: {},
  geometry: { type: 'Polygon', coordinates: [[[-31, -11], [-28, -11], [-28, -8], [-31, -8], [-31, -11]]] },
};
/** Enquadramento do Brasil, já com o quadrado do exterior. */
const BRASIL_BOUNDS: [[number, number], [number, number]] = [[-74, -34], [-27.5, 5.5]];

function bbox(features: Feat[]): [[number, number], [number, number]] {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1] as number); y1 = Math.max(y1, c[1] as number);
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const ft of features) if (ft.geometry && 'coordinates' in ft.geometry) walk(ft.geometry.coordinates);
  return [[x0, y0], [x1, y1]];
}

type Hoverable = {
  nome: string; a?: Tally; b?: Tally; delta: number | null; status?: PointRow['status']; secoes?: string; aprox?: boolean;
  /** Área sem linha nos dados (fora das unidades com candidatura): sem drill-down. */
  semCandidatura?: boolean;
};

export function MapPanel({ v, f, set, points }: { v: ViewModel; f: Filters; set: (p: Partial<Filters>) => void; points: PointRow[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const areaRows = useRef(new Map<string, Hoverable>());
  const pointRows = useRef(new Map<string, Hoverable>());
  const lastView = useRef('');
  const hovered = useRef<string | number | undefined>(undefined);
  const extLabel = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const { compare, correspondente } = v;
  const [zoomAlto, setZoomAlto] = useState(false);
  // Escalas únicas (camada + legenda). No exterior as cidades usam a escala dos países.
  const areaScale = useMemo(() => makeScale(f.escopo === 'exterior' ? [...v.rows, ...points] : v.rows, compare, f.metrica), [v, points, compare, f.escopo, f.metrica]);
  const pointScale = useMemo(() => (f.escopo === 'exterior' ? areaScale : makeScale(points, compare, f.metrica)), [points, compare, f.escopo, f.metrica, areaScale]);
  const layer = colorLayer(f, zoomAlto ? POINTS_ZOOM : 0, points.length);
  const pontosVisiveis = points.length > 0 && (f.escopo === 'exterior' || !!f.mun || (!!f.uf && zoomAlto));
  const maxUp = useMemo(() => Math.max(0, ...points.map((p) => p.up)), [points]);
  const munNome = f.mun ? v.rows.find((r) => r.id === String(f.mun))?.nome : undefined;

  // init
  useEffect(() => {
    const m = new MLMap({
      container: el.current!, attributionControl: false, center: [-52, -15], zoom: 3, minZoom: 1, maxZoom: 15, dragRotate: false,
      cooperativeGestures: true,
      style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': 'rgba(0,0,0,0)' } }] },
    });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    // Rótulo do quadrado do exterior: Marker HTML (o estilo não tem glyphs para uma camada de texto);
    // o MapLibre o reposiciona sozinho ao mover/zoom. Só é adicionado quando o quadrado existe.
    const lbl = document.createElement('div');
    lbl.textContent = 'Exterior';
    lbl.setAttribute('aria-hidden', 'true');
    lbl.style.cssText = 'pointer-events:none;font-family:var(--font-display);text-transform:uppercase;font-weight:800;font-size:11px;letter-spacing:.05em;color:var(--fg);text-shadow:0 0 2px var(--bg),0 0 2px var(--bg)';
    extLabel.current = new Marker({ element: lbl, anchor: 'top' }).setLngLat([-29.5, -11.3]);
    m.touchZoomRotate.disableRotation();
    map.current = m;
    m.on('load', () => {
      for (const id of ['areas', 'points'] as const) m.addSource(id, { type: 'geojson', data: EMPTY, promoteId: 'id' });
      m.addLayer({ id: 'areas-fill', type: 'fill', source: 'areas', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.95, 'fill-color-transition': { duration: 300 } } });
      m.addLayer({ id: 'areas-line', type: 'line', source: 'areas', paint: { 'line-color': '#000', 'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 0.4] } });
      m.addLayer({ id: 'points', type: 'circle', source: 'points', paint: {
        'circle-color': ['get', 'color'], 'circle-stroke-color': '#000', 'circle-stroke-width': 1,
        'circle-radius': CIRCLE_RADIUS_EXPR as never, 'circle-opacity': 0.9 } });
      setReady(true);
      setZoomAlto(m.getZoom() >= POINTS_ZOOM);
    });
    m.on('zoomend', () => setZoomAlto(m.getZoom() >= POINTS_ZOOM));
    return () => { m.remove(); map.current = null; extLabel.current = null; };
  }, []);

  // dados → fontes
  useEffect(() => {
    const m = map.current; if (!m || !ready) return;
    let on = true;
    (async () => {
      const byId = new Map(v.rows.map((r) => [r.id, r]));
      const rowsMap = new Map<string, Hoverable>();
      const paint = (ft: Feat, id: string, nome: string, r?: ViewRow): Feat => {
        rowsMap.set(id, r ?? { nome, delta: null, semCandidatura: true });
        return { ...ft, properties: { ...ft.properties, id, color: areaScale.color(r) } };
      };
      const geo = await loadGeo(f.escopo === 'exterior' ? 'world' : f.uf ? 'mun' : 'ufs');
      if (!on) return;
      setGeoError(!geo);
      if (!geo) return;
      let features: Feat[];
      if (f.escopo === 'exterior') {
        const world = geo;
        const byNum = new Map(v.rows.filter((r) => r.isoNum).map((r) => [String(Number(r.isoNum)), r]));
        features = world.features.map((ft) => {
          const name = String(ft.properties?.name ?? '');
          const r = ft.id !== undefined ? byNum.get(String(Number(ft.id))) : undefined;
          return paint(ft, ft.id !== undefined ? String(ft.id) : `x-${name}`, r?.nome ?? name, r);
        });
      } else if (f.uf) {
        features = geo.features.filter((ft) => ft.properties?.uf === f.uf).map((ft) => paint(ft, String(ft.id), '', byId.get(String(ft.id))));
      } else {
        features = geo.features.map((ft) => paint(ft, String(ft.id), String(ft.id), byId.get(String(ft.id))));
        const ext = byId.get(EXTERIOR_ID); // linha só existe no escopo 'tudo' (Presidente)
        if (ext) features.push(paint(EXTERIOR_FT, EXTERIOR_ID, ext.nome, ext));
      }
      if (rowsMap.has(EXTERIOR_ID) && f.escopo !== 'exterior') extLabel.current?.addTo(m); else extLabel.current?.remove();
      areaRows.current = rowsMap;
      m.removeFeatureState({ source: 'areas' });
      hovered.current = undefined;
      (m.getSource('areas') as GeoJSONSource).setData({ type: 'FeatureCollection', features });

      const pRows = new Map<string, Hoverable>();
      const pts: Feat[] = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)).map((p) => {
        pRows.set(p.id, p);
        return {
          type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: { id: p.id, up: p.up, color: pointScale.color(p) },
        };
      });
      pointRows.current = pRows;
      (m.getSource('points') as GeoJSONSource).setData({ type: 'FeatureCollection', features: pts });
      // Locais aparecem com zoom alto ou com município escolhido; cidades do exterior, sempre.
      m.setLayerZoomRange('points', f.mun || f.escopo === 'exterior' ? 0 : POINTS_ZOOM, 24);

      // Enquadra só quando muda o recorte (não ao trocar métrica/ano).
      const view = `${f.escopo === 'exterior' ? 'ext' : 'br'}|${f.uf ?? ''}|${f.mun ?? ''}`;
      if (view === lastView.current) return;
      lastView.current = view;
      const opts = { padding: 20, duration: 600 };
      if (f.escopo === 'exterior') m.fitBounds([[-170, -55], [180, 75]], { ...opts, padding: 10 });
      else if (f.mun) { const ft = features.filter((x) => String(x.id) === String(f.mun)); if (ft.length) m.fitBounds(bbox(ft), { ...opts, padding: 30 }); }
      else if (f.uf && features.length) m.fitBounds(bbox(features), opts);
      else m.fitBounds(BRASIL_BOUNDS, { ...opts, padding: 10 });
    })();
    return () => { on = false; };
  }, [v, areaScale, pointScale, f.escopo, f.uf, f.mun, points, ready, tentativa]);

  // Só uma camada carrega cor: com os locais coloridos, as áreas ficam neutras (contorno e popup mantidos).
  useEffect(() => {
    const m = map.current; if (!m || !ready) return;
    m.setPaintProperty('areas-fill', 'fill-color', layer === 'points' ? PALETTE.zero : ['get', 'color']);
    m.setPaintProperty('areas-fill', 'fill-opacity', layer === 'points' ? 0.6 : 0.95);
  }, [layer, ready]);

  // interação
  useEffect(() => {
    const m = map.current; if (!m || !ready) return;
    const popup = new Popup({ closeButton: false, closeOnClick: false, maxWidth: '300px' });
    const showPct = !compare || correspondente;
    const tally = (t?: Tally) => (t ? `${fmtInt(t.up)}${showPct ? ` (${fmtPct(value(t, 'pct'))})` : ''}` : '—');
    const html = (r: Hoverable) => {
      const titulo = r.nome ? `<div style="font-family:var(--font-display);text-transform:uppercase;font-weight:800">${esc(r.nome)}</div>` : '';
      if (r.semCandidatura) return `${titulo}sem candidatura da UP`;
      const status = r.status === 'novo' ? 'local novo (sem par na eleição de referência)' : r.status === 'extinto' ? `local sem par em ${f.ano}` : '';
      const linhas = compare
        ? `<b>${esc(v.labelRef!)}:</b> ${tally(r.a)}<br><b>${esc(v.labelAtual)}:</b> ${tally(r.b)}<br>${r.delta === null ? `<i>${status || 'sem comparação'}</i>` : `<b>Variação:</b> ${fmtDelta(r.delta, f.metrica)}`}`
        : r.b ? `<b>${fmtInt(r.b.up)}</b> votos · ${fmtPct(value(r.b, 'pct'))} dos válidos` : 'sem candidatura da UP';
      const sec = r.secoes ? `<br><span style="font-size:11px">Seções (votos UP): ${esc(r.secoes)}</span>` : '';
      const aprox = r.aprox ? '<br><i style="font-size:11px">localização aproximada</i>' : '';
      return `${titulo}${linhas}${sec}${aprox}`;
    };
    const rowOf = (layer: 'areas-fill' | 'points', e: MapLayerMouseEvent) =>
      e.features?.[0] && (layer === 'points' ? pointRows : areaRows).current.get(String(e.features[0].properties?.id));
    const show = (layer: 'areas-fill' | 'points', e: MapLayerMouseEvent) => {
      const r = rowOf(layer, e);
      if (r) popup.setLngLat(e.lngLat).setHTML(html(r)).addTo(m);
    };
    /** Área que abre o próximo nível: Brasil, com linha nos dados. */
    const drillable = (r?: Hoverable) => f.escopo !== 'exterior' && !!r && !r.semCandidatura;
    const setHover = (id?: string | number) => {
      if (hovered.current !== undefined) m.setFeatureState({ source: 'areas', id: hovered.current }, { hover: false });
      hovered.current = id;
      if (id !== undefined) m.setFeatureState({ source: 'areas', id }, { hover: true });
    };
    const overPoint = (e: MapLayerMouseEvent) => m.queryRenderedFeatures(e.point, { layers: ['points'] }).length > 0;
    const moveArea = (e: MapLayerMouseEvent) => {
      const ft = e.features?.[0]; if (!ft) return;
      setHover(ft.id);
      if (overPoint(e)) return;
      m.getCanvas().style.cursor = drillable(rowOf('areas-fill', e)) ? 'pointer' : '';
      show('areas-fill', e);
    };
    const movePoint = (e: MapLayerMouseEvent) => { m.getCanvas().style.cursor = 'pointer'; show('points', e); };
    const leave = () => { m.getCanvas().style.cursor = ''; popup.remove(); setHover(undefined); };
    const clickArea = (e: MapLayerMouseEvent) => {
      const ft = e.features?.[0]; if (!ft || overPoint(e)) return;
      const r = rowOf('areas-fill', e);
      const id = String(ft.properties?.id);
      if (!drillable(r)) return show('areas-fill', e); // exterior ou sem candidatura: só o detalhe (toque no celular)
      if (id === EXTERIOR_ID) set({ escopo: 'exterior', uf: undefined, mun: undefined });
      else if (!f.uf) set({ uf: id });
      else if (Number(id) !== f.mun) set({ mun: Number(id) });
      else show('areas-fill', e);
    };
    const clickPoint = (e: MapLayerMouseEvent) => show('points', e);
    m.on('mousemove', 'areas-fill', moveArea); m.on('mouseleave', 'areas-fill', leave); m.on('click', 'areas-fill', clickArea);
    m.on('mousemove', 'points', movePoint); m.on('mouseleave', 'points', leave); m.on('click', 'points', clickPoint);
    return () => {
      m.off('mousemove', 'areas-fill', moveArea); m.off('mouseleave', 'areas-fill', leave); m.off('click', 'areas-fill', clickArea);
      m.off('mousemove', 'points', movePoint); m.off('mouseleave', 'points', leave); m.off('click', 'points', clickPoint);
      popup.remove();
      setHover(undefined);
    };
  }, [ready, f, set, compare, correspondente, v.labelRef, v.labelAtual]);

  return (
    <div className="relative border-2 border-[var(--line)] bg-[var(--surface)]">
      <div ref={el} className="h-[60vh] min-h-[420px] w-full" aria-label="Mapa de votos da UP" role="region" />
      <div className="absolute left-2 bottom-2">
        <MapLegend title={legendTitle(layer, f, munNome, v.rows.some((r) => r.id === 'ZZ'))} scale={layer === 'points' ? pointScale : areaScale}
          sizes={pontosVisiveis ? { maxUp, label: f.escopo === 'exterior' ? 'Cidades (votos)' : 'Locais (votos)' } : undefined} />
      </div>
      {v.aviso
        ? <div className="absolute inset-0 grid place-items-center bg-[var(--bg)]/80 p-6 text-center font-display uppercase text-xl">{v.aviso}</div>
        : geoError && (
          <div role="alert" className="absolute inset-0 grid place-items-center content-center gap-3 bg-[var(--bg)]/80 p-6 text-center">
            <p className="font-display uppercase text-xl">Erro ao carregar o mapa.</p>
            <button type="button" onClick={() => setTentativa((n) => n + 1)}
              className="px-3 py-2 border-2 border-[var(--line)] bg-[var(--surface)] font-display uppercase font-bold">Tentar de novo</button>
          </div>
        )}
    </div>
  );
}
