import { FUEL_LABELS, FUEL_TYPES, NETWORK_BY_ID, NETWORKS, REGIONS, type FuelType } from '@ohmygas/shared';
import L from 'leaflet';
import { useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { usePrices, useStations } from '../lib/api';
import { indexPrices, priced } from '../lib/pricing';
import { useDiscounts } from '../store/discounts';
import { uk } from '../uk';

const iconCache = new Map<string, L.DivIcon>();
function icon(color: string, label: string) {
  const k = color + label;
  let i = iconCache.get(k);
  if (!i) {
    i = L.divIcon({
      className: '',
      html: `<div class="pin" style="background:${color}">${label}</div>`,
      iconSize: [46, 22],
      iconAnchor: [23, 11],
    });
    iconCache.set(k, i);
  }
  return i;
}

export default function MapPage() {
  const stations = useStations();
  const prices = usePrices();
  const discounts = useDiscounts((s) => s.discounts);
  const [fuel, setFuel] = useState<FuelType>('A95');
  const [nets, setNets] = useState<Set<string>>(new Set());
  const [region, setRegion] = useState('');
  const [max, setMax] = useState('');
  const [onlyDisc, setOnlyDisc] = useState(false);
  const [open, setOpen] = useState(false); // mobile filter sheet
  const activeCount = nets.size + (region ? 1 : 0) + (max ? 1 : 0) + (onlyDisc ? 1 : 0);

  const idx = useMemo(() => indexPrices(prices.data ?? []), [prices.data]);

  const rows = useMemo(() => {
    const maxN = max ? Number(max) : Infinity;
    const out = [];
    for (const s of stations.data ?? []) {
      if (nets.size && !nets.has(s.networkId)) continue;
      if (region && s.region !== region) continue;
      const p = priced(idx, discounts, s.networkId, fuel, s.id);
      if (!p || p.final > maxN) continue;
      if (onlyDisc && p.final >= p.base) continue;
      out.push({ s, p });
    }
    return out;
  }, [stations.data, idx, discounts, fuel, nets, region, max, onlyDisc]);

  const cheapest = useMemo(() => rows.reduce<number | null>((m, r) => (m == null || r.p.final < m ? r.p.final : m), null), [rows]);

  if (stations.isLoading || prices.isLoading) return <div className="page">{uk.loading}</div>;
  if (stations.error || prices.error) return <div className="page error">{uk.error}</div>;

  const toggle = (id: string) =>
    setNets((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div className="mapwrap">
      <div className="fuel-chips mobile-only" role="tablist">
        {FUEL_TYPES.map((f) => (
          <button key={f} role="tab" aria-selected={f === fuel} className={f === fuel ? 'on' : ''} onClick={() => setFuel(f)}>
            {FUEL_LABELS[f]}
          </button>
        ))}
      </div>
      <button className="fab mobile-only" onClick={() => setOpen(true)}>
        ☰ {uk.filters}{activeCount > 0 && <span className="badge">{activeCount}</span>} · {rows.length}
      </button>
      {open && <div className="scrim mobile-only" onClick={() => setOpen(false)} />}
      <aside className={`filters${open ? ' open' : ''}`}>
        <div className="sheet-head mobile-only">
          <strong>{uk.filters}</strong>
          <button onClick={() => setOpen(false)}>{uk.show} {rows.length}</button>
        </div>
        <label className="desktop-only">
          {uk.fuel}
          <select value={fuel} onChange={(e) => setFuel(e.target.value as FuelType)}>
            {FUEL_TYPES.map((f) => (
              <option key={f} value={f}>{FUEL_LABELS[f]}</option>
            ))}
          </select>
        </label>
        <label>
          {uk.region}
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">{uk.allRegions}</option>
            {REGIONS.map((r) => (
              <option key={r.name}>{r.name}</option>
            ))}
          </select>
        </label>
        <label>
          {uk.maxPrice}
          <input type="number" step={0.1} value={max} onChange={(e) => setMax(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={onlyDisc} onChange={(e) => setOnlyDisc(e.target.checked)} /> {uk.onlyDiscount}
        </label>
        <div className="nets">
          <div className="lbl">{uk.network}</div>
          {NETWORKS.map((n) => (
            <label key={n.id} className="check">
              <input type="checkbox" checked={nets.has(n.id)} onChange={() => toggle(n.id)} />
              <span className="dot" style={{ background: n.color }} /> {n.name}
            </label>
          ))}
        </div>
        <button onClick={() => { setNets(new Set()); setRegion(''); setMax(''); setOnlyDisc(false); }}>{uk.reset}</button>
        <p className="hint">
          {uk.shown}: {rows.length}
          {cheapest != null && <><br />{uk.cheapest}: {cheapest.toFixed(2)} ₴</>}
        </p>
      </aside>
      <MapContainer center={[48.4, 31.2]} zoom={6} minZoom={5} className="map" preferCanvas>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup chunkedLoading>
          {rows.map(({ s, p }) => {
            const net = NETWORK_BY_ID[s.networkId];
            return (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={icon(net?.color ?? '#757575', p.final.toFixed(1))}>
                <Popup>
                  <strong>{s.name}</strong>
                  <div className="muted">{net?.name}{s.address ? ` · ${s.address}` : ''}</div>
                  <table className="pop">
                    <tbody>
                      {FUEL_TYPES.map((f) => {
                        const q = priced(idx, discounts, s.networkId, f, s.id);
                        if (!q) return null;
                        return (
                          <tr key={f}>
                            <td>{FUEL_LABELS[f]}</td>
                            <td>{q.final < q.base && <s className="muted">{q.base.toFixed(2)} </s>}<strong>{q.final.toFixed(2)}</strong> ₴</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
