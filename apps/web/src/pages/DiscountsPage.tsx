import { FUEL_LABELS, FUEL_TYPES, NETWORKS } from '@ohmygas/shared';
import { useRef } from 'react';
import { uk } from '../uk';
import { dkey, useDiscounts } from '../store/discounts';

export default function DiscountsPage() {
  const { discounts, set, replaceAll, clear } = useDiscounts();
  const file = useRef<HTMLInputElement>(null);
  const networks = NETWORKS.filter((n) => n.id !== 'other');

  const doExport = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(discounts, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: 'ohmygas-discounts.json' }).click();
    URL.revokeObjectURL(url);
  };
  const doImport = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (data && typeof data === 'object') replaceAll(data);
    } catch {
      alert('Некоректний файл');
    }
  };

  return (
    <div className="page">
      <h1>{uk.discountsTitle}</h1>
      <p className="hint">{uk.discountsHint}</p>
      <div className="toolbar">
        <button onClick={doExport}>{uk.export}</button>
        <button onClick={() => file.current?.click()}>{uk.import}</button>
        <button onClick={clear}>{uk.clearAll}</button>
        <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
      </div>
      <div className="net-list">
        {networks.map((n) => (
          <section key={n.id} className="net-card">
            <h2>
              <span className="dot" style={{ background: n.color }} /> {n.name}
            </h2>
            <div className="fuel-grid">
              {FUEL_TYPES.map((f) => {
                const d = discounts[dkey(n.id, f)];
                const kind = d?.kind ?? 'percent';
                return (
                  <div key={f} className="fuel-row">
                    <span className="fuel-name">{FUEL_LABELS[f]}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.1}
                      value={d?.value || ''}
                      placeholder="0"
                      aria-label={`${n.name} ${FUEL_LABELS[f]}`}
                      onChange={(e) => set(n.id, f, { kind, value: Math.max(0, Number(e.target.value)) })}
                    />
                    <div className="seg" role="group">
                      {(['percent', 'fixed'] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          className={kind === k ? 'on' : ''}
                          aria-pressed={kind === k}
                          onClick={() => set(n.id, f, { kind: k, value: d?.value ?? 0 })}
                        >
                          {k === 'percent' ? '%' : '₴'}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
