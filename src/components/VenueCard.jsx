import { outreachForVenue } from '@/store/store';
import { Stamp } from '@/components/Stamp';
import { cn } from '@/lib/utils';

/**
 * A venue as a ticket stub: perforated left edge, paper stock, name in poster type,
 * status printed as a stamp. Dense enough to skim a long list quickly.
 */
export default function VenueCard({ venue, selected, onSelect }) {
  const outreach = outreachForVenue(venue.id);
  const status = outreach?.status || 'none';

  return (
    <button
      type="button"
      onClick={() => onSelect?.(venue)}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'stub group relative block w-full pl-5 pr-3 py-3 text-left transition-colors',
        'hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flash-red',
        selected ? 'bg-paper shadow-[inset_3px_0_0_var(--color-flash-red)]' : 'bg-paper-shade/70',
      )}
    >
      <span className="stub-perf" aria-hidden />

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[1.05rem] leading-tight tracking-[0.03em] text-paper-ink group-hover:text-flash-red">
            {venue.name}
          </h3>
          <p className="mt-0.5 truncate text-[0.76rem] text-paper-muted">
            {venue.city} · Cap. {venue.capacity || '—'} · {venue.type}
            {venue.visibility === 'private' && <span className="ml-1.5 text-flash-red">· private</span>}
          </p>
        </div>
        <Stamp status={status} seed={venue.id} className="mt-0.5 shrink-0" />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-dashed border-paper-line pt-2">
        <p className="truncate font-display uppercase tracking-[0.1em] text-[0.66rem] text-paper-muted">
          {venue.genres.slice(0, 3).join(' / ') || 'Any genre'}
        </p>
        <p className="shrink-0 text-[0.7rem] text-paper-muted">{venue.payType}</p>
      </div>
    </button>
  );
}
