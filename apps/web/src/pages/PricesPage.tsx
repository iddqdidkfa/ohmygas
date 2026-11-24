import { FUEL_LABELS, FUEL_TYPES, NETWORKS, type FuelType } from '@ohmygas/shared';
import { useMemo, useState } from 'react';
import { usePrices } from '../lib/api';
import { indexPrices, priced } from '../lib/pricing';
import { useDiscounts } from '../store/discounts';
import { uk } from '../uk';

export default function PricesPage() {
  const { data, isLoading, error } = usePrices();
  const discounts = useDiscounts((s) => s.discounts);
  const idx = useMemo(() => indexPrices(data ?? []), [data]);
  const [fuel, setFuel] = useState<FuelType>('A95');
  const ranked = useMemo(
    () =>
      NETWORKS.flatMap((n) => {
        const p = priced(idx, discounts, n.id, fuel);
        return p ? [{ n, p }] : [];
      }).sort((a, b) => a.p.final - b.p.final),
    [idx, discounts, fuel],
  );
  if (isLoading) return <div className="page">{uk.loading}</div>;
  if (error) return <div className="page error">{uk.error}</div>;

  const updated = data?.[0]?.updatedAt;
  return (
    <div className="page">
      <h1>{uk.nav.prices}</h1>
      {updated && <p className="hint">{uk.updated}: {new Date(updated).toLocaleString('uk-UA')}</p>}
      <div className="mobile-only">
        <div className="chips" role="tablist">
          {FUEL_TYPES.map((f) => (
            <button key={f} role="tab" aria-selected={f === fuel} className={f === fuel ? 'on' : ''} onClick={() => setFuel(f)}>
              {FUEL_LABELS[f]}
            </button>
          ))}
        </div>
        <ol className="ranking">
          {ranked.map(({ n, p }, i) => (
            <li key={n.id} className={i === 0 ? 'best' : ''}>
              <span className="rank">{i + 1}</span>
              <span className="rname">
                <span className="dot" style={{ background: n.color }} /> {n.name}
              </span>
              <span className="rprice">
                {p.final < p.base && <s className="muted">{p.base.toFixed(2)}</s>}
                <strong className={p.final < p.base ? 'good' : ''}>{p.final.toFixed(2)}</strong>
              </span>
            </li>
          ))}
          {!ranked.length && <li className="muted">{uk.noPrice}</li>}
        </ol>
      </div>
      <div className="table-wrap desktop-only">
        <table>
          <thead>
            <tr>
              <th>{uk.network}</th>
              {FUEL_TYPES.map((f) => (
                <th key={f}>{FUEL_LABELS[f]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NETWORKS.map((n) => (
              <tr key={n.id}>
                <td>
                  <span className="dot" style={{ background: n.color }} /> {n.name}
                </td>
                {FUEL_TYPES.map((f) => {
                  const p = priced(idx, discounts, n.id, f);
                  if (!p) return <td key={f} className="muted">—</td>;
                  const has = p.final < p.base;
                  return (
                    <td key={f}>
                      {has ? (
                        <>
                          <s className="muted">{p.base.toFixed(2)}</s> <strong className="good">{p.final.toFixed(2)}</strong>
                        </>
                      ) : (
                        p.base.toFixed(2)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
