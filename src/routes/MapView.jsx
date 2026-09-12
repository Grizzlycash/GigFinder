import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Minus, Crosshair, List, Mail } from 'lucide-react';
import { activeVenues, venueById, outreachForVenue, statusMeta, STATUSES } from '@/store/store';
import AppShell from '@/components/AppShell';
import { Stamp, stampColour } from '@/components/Stamp';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { initials, milesBetween } from '@/lib/format';
import { cn } from '@/lib/utils';

const W = 1000;
const H = 640;

function mappable() {
  return activeVenues().filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng) && (v.lat !== 0 || v.lng !== 0));
}

function project(venues) {
  const lats = venues.map((v) => v.lat);
  const lngs = venues.map((v) => v.lng);
  const meanLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const raw = (lat, lng) => ({ x: lng * k, y: -lat });
  const pts = venues.map((v) => raw(v.lat, v.lng));
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const padX = (maxX - minX) * 0.08 || 1;
  const padY = (maxY - minY) * 0.1 || 1;
  const bw = maxX - minX + padX * 2;
  const bh = maxY - minY + padY * 2;
  const scale = Math.min(W / bw, H / bh);
  const offX = (W - bw * scale) / 2;
  const offY = (H - bh * scale) / 2;
  return (lat, lng) => {
    const p = raw(lat, lng);
    return { x: offX + (p.x - minX + padX) * scale, y: offY + (p.y - minY + padY) * scale };
  };
}

export default function MapView() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState(params.get('venue') || null);
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 });
  const svgRef = useRef(null);
  const drag = useRef({ on: false, moved: false, x: 0, y: 0 });

  const all = useMemo(() => mappable(), []);
  const toXY = useMemo(() => (all.length ? project(all) : null), [all]);

  const rows = all.filter((v) => {
    const out = outreachForVenue(v.id);
    if (status === 'none' && out) return false;
    if (status === 'emailed' && !(out && ['emailed', 'opened'].includes(out.status))) return false;
    if (status === 'booked' && out?.status !== 'booked') return false;
    return true;
  });

  // Dense inner suburbs sit on top of each other at low zoom, so nearby rooms
  // collapse into one cluster marker that splits apart as you zoom in. Without this the
  // front pin simply covers the ones behind it and they can never be clicked.
  const clusters = useMemo(() => {
    if (!toXY) return [];
    const cell = 34 / view.s;
    const buckets = new Map();
    rows.forEach((v) => {
      const p = toXY(v.lat, v.lng);
      const key = `${Math.round(p.x / cell)}:${Math.round(p.y / cell)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ v, ...p });
    });
    return [...buckets.values()].map((group) => ({
      items: group,
      x: group.reduce((sum, g) => sum + g.x, 0) / group.length,
      y: group.reduce((sum, g) => sum + g.y, 0) / group.length,
    }));
  }, [rows, toXY, view.s]);

  function focusWorld(x, y, factor) {
    setView((v) => {
      const s = Math.min(10, v.s * factor);
      return { s, tx: W / 2 - x * s, ty: H / 2 - y * s };
    });
  }

  const selected = selectedId ? venueById(selectedId) : null;

  function unitsPerPx() {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 1;
    return Math.max(W / rect.width, H / rect.height);
  }

  function zoomAt(factor, clientX, clientY) {
    const rect = svgRef.current.getBoundingClientRect();
    const upp = unitsPerPx();
    const sx = (clientX - rect.left - (rect.width - W / upp) / 2) * upp;
    const sy = (clientY - rect.top - (rect.height - H / upp) / 2) * upp;
    setView((v) => {
      const next = Math.min(10, Math.max(1, v.s * factor));
      const k = next / v.s;
      const tx = sx - (sx - v.tx) * k;
      const ty = sy - (sy - v.ty) * k;
      return next === 1 ? { s: 1, tx: 0, ty: 0 } : { s: next, tx, ty };
    });
  }

  // Pan with window listeners rather than pointer capture, which would retarget the
  // click and stop pins being selectable.
  function onPointerDown(e) {
    if (e.button !== 0) return;
    drag.current = { on: true, moved: false, x: e.clientX, y: e.clientY };
    const move = (ev) => {
      if (!drag.current.on) return;
      const upp = unitsPerPx();
      const dx = (ev.clientX - drag.current.x) * upp;
      const dy = (ev.clientY - drag.current.y) * upp;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
      drag.current.x = ev.clientX;
      drag.current.y = ev.clientY;
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    };
    const up = () => {
      drag.current.on = false;
      window.removeEventListener('pointermove', move);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }

  if (!all.length) {
    return (
      <AppShell title="Map">
        <Card className="mx-auto max-w-md" data-map-empty>
          <CardContent className="py-10 text-center">
            <h2 className="text-xl">Nothing to plot yet</h2>
            <p className="mx-auto mt-2 max-w-xs text-[0.85rem] text-paper-muted">
              None of the rooms in the database carry coordinates, so there's no map to draw. Every
              venue is still in the list, with its address.
            </p>
            <Button asChild className="mt-4"><Link to="/venues">Browse the list</Link></Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const nearby = selected
    ? all.filter((u) => u.id !== selected.id).map((u) => ({ u, d: milesBetween(selected, u) })).sort((a, b) => a.d - b.d).slice(0, 4)
    : [];

  return (
    <AppShell title="Map" subtitle={`${rows.length} of ${all.length} rooms`} flush>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-line px-4 py-2.5">
        <span className="eyebrow mr-1 text-bone-muted/70">Show</span>
        {[['all', 'All'], ['none', 'Not contacted'], ['emailed', 'Emailed'], ['booked', 'Booked']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatus(id)}
            aria-pressed={status === id}
            data-status={id}
            className={cn(
              'rounded-[2px] border px-2.5 py-1 font-display uppercase tracking-[0.08em] text-[0.68rem]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flash-red',
              status === id ? 'border-flash-red bg-flash-red text-[#fbf7ec]' : 'border-ink-line-strong text-bone-muted hover:bg-ink-hover hover:text-bone',
            )}
          >
            {label}
          </button>
        ))}
        <span className="flex-1" />
        <Button variant="secondary" size="sm" asChild><Link to="/venues"><List className="size-4" /> List</Link></Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-80 flex-1 overflow-hidden bg-[#0c1017]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            className="size-full cursor-grab touch-none active:cursor-grabbing"
            data-map
            onPointerDown={onPointerDown}
            onWheel={(e) => zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX, e.clientY)}
          >
            <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
              <rect x="-3000" y="-3000" width="9000" height="9000" fill="#0c1017" />
              {Array.from({ length: 26 }).map((_, i) => (
                <g key={i} stroke="#1b2230" strokeWidth="1" vectorEffect="non-scaling-stroke">
                  <line x1={(i * W) / 25} y1="-2000" x2={(i * W) / 25} y2={H + 2000} />
                  <line x1="-2000" y1={(i * H) / 25} x2={W + 2000} y2={(i * H) / 25} />
                </g>
              ))}
              {clusters.map((c) => {
                if (c.items.length > 1) {
                  return (
                    <g
                      key={`c-${c.x.toFixed(1)}-${c.y.toFixed(1)}`}
                      transform={`translate(${c.x.toFixed(1)},${c.y.toFixed(1)})`}
                      className="cursor-pointer"
                      data-cluster={c.items.length}
                      onClick={() => { if (!drag.current.moved) focusWorld(c.x, c.y, 2.2); }}
                    >
                      <g transform={`scale(${(1 / view.s).toFixed(4)})`}>
                        <circle r="15" fill="#1a1e27" stroke="var(--color-flash-red)" strokeWidth="2" />
                        <text y="4" textAnchor="middle" fontSize="11" fontFamily="Anton, sans-serif" fill="#f1ede1">
                          {c.items.length}
                        </text>
                      </g>
                    </g>
                  );
                }
                const { v, x, y } = c.items[0];
                const out = outreachForVenue(v.id);
                const colour = stampColour(out?.status || 'none');
                const sel = selectedId === v.id;
                return (
                  <g
                    key={v.id}
                    transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
                    className="cursor-pointer"
                    data-marker={v.id}
                    onClick={() => { if (!drag.current.moved) { setSelectedId(v.id); setParams({ venue: v.id }); } }}
                  >
                    <g transform={`scale(${(1 / view.s).toFixed(4)})`}>
                      {sel && <circle cy="-12" r="18" fill={colour} opacity="0.3" />}
                      <path d="M-5,-9 L0,1 L5,-9 Z" fill={colour} />
                      <circle cy="-12" r="11" fill={colour} stroke="#0c1017" strokeWidth="1.5" />
                      <text y="-9" textAnchor="middle" fontSize="8.5" fontFamily="Anton, sans-serif" fill="#0c1017">
                        {initials(v.name)}
                      </text>
                      {(sel || view.s >= 2.4) && (
                        <text x="16" y="-9" fontSize="11" fontFamily="Anton, sans-serif" fill="#f1ede1" stroke="#0c1017" strokeWidth="3" paintOrder="stroke">
                          {v.name}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="absolute left-3 top-3 rounded-[3px] border border-ink-line-strong bg-ink-raised/95 p-2.5">
            <p className="eyebrow mb-1.5 text-bone-muted/80">Status</p>
            <ul className="space-y-1">
              {[{ id: 'none', label: 'Not contacted' }, ...STATUSES].map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-[0.7rem] text-bone-muted">
                  <span className="size-2.5 rounded-full" style={{ background: stampColour(s.id) }} />
                  {statusMeta(s.id).label}
                </li>
              ))}
            </ul>
          </div>

          <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
            {[[Plus, 'in'], [Minus, 'out'], [Crosshair, 'reset']].map(([Icon, kind]) => (
              <Button
                key={kind}
                variant="secondary"
                size="icon"
                aria-label={`Zoom ${kind}`}
                data-zoom={kind}
                onClick={() => {
                  const rect = svgRef.current.getBoundingClientRect();
                  if (kind === 'reset') setView({ s: 1, tx: 0, ty: 0 });
                  else zoomAt(kind === 'in' ? 1.4 : 1 / 1.4, rect.left + rect.width / 2, rect.top + rect.height / 2);
                }}
              >
                <Icon className="size-4" />
              </Button>
            ))}
          </div>
        </div>

        {/* ---- Side panel ---- */}
        <aside className="w-full shrink-0 overflow-y-auto border-t border-ink-line bg-ink-raised p-3 lg:w-80 lg:border-l lg:border-t-0">
          {selected ? (
            <div className="space-y-3" data-panel>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-lg leading-tight">{selected.name}</h2>
                      <p className="text-[0.78rem] text-paper-muted">{selected.city} · Cap. {selected.capacity}</p>
                    </div>
                    <Stamp status={outreachForVenue(selected.id)?.status || 'none'} seed={selected.id} />
                  </div>
                  <dl className="mt-3 space-y-1 border-t border-dashed border-paper-line pt-3 text-[0.8rem]">
                    <div className="flex justify-between gap-3"><dt className="text-paper-muted">Type</dt><dd>{selected.type}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-paper-muted">Pay</dt><dd>{selected.payType}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-paper-muted">Contact</dt><dd className="truncate">{selected.contactName}</dd></div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" asChild><Link to={`/send?venue=${selected.id}`}><Mail className="size-4" /> Draft email</Link></Button>
                    <Button variant="paper" size="sm" asChild><Link to={`/venues/${selected.id}`}>Full profile</Link></Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <p className="eyebrow border-b border-paper-line px-4 py-2.5 text-paper-muted">Nearby rooms</p>
                  <ul>
                    {nearby.map(({ u, d }) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          data-pick={u.id}
                          onClick={() => { setSelectedId(u.id); setParams({ venue: u.id }); }}
                          className="flex w-full items-center gap-2 border-b border-dashed border-paper-line px-4 py-2 text-left last:border-0 hover:bg-paper-shade/70 focus-visible:outline-2 focus-visible:outline-flash-red"
                        >
                          <span className="min-w-0 flex-1 truncate text-[0.82rem] text-paper-ink">{u.name}</span>
                          <span className="shrink-0 text-[0.7rem] text-paper-muted">{d < 10 ? d.toFixed(1) : Math.round(d)} km</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card><CardContent className="py-10 text-center">
              <p className="font-display uppercase tracking-[0.1em] text-paper-muted">Pick a pin</p>
              <p className="mt-1 text-[0.8rem] text-paper-muted">Tap any room to see the contact and what's nearby.</p>
            </CardContent></Card>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
