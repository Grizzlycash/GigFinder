import { cn } from '@/lib/utils';

/**
 * The signature element: contact status printed as a rubber stamp rather than a pill.
 * Each stamp tilts by a few degrees, derived from the seed so a given venue's stamp
 * always sits at the same angle — hand-stamped, not generated.
 */
const STAMPS = {
  none: { label: 'Not contacted', color: 'var(--color-stamp-none)' },
  emailed: { label: 'Emailed', color: 'var(--color-stamp-emailed)' },
  opened: { label: 'Opened', color: 'var(--color-stamp-opened)' },
  replied: { label: 'Replied', color: 'var(--color-stamp-replied)' },
  booked: { label: 'Booked', color: 'var(--color-stamp-booked)' },
  declined: { label: 'Passed', color: 'var(--color-stamp-declined)' },
};

function tiltFrom(seed) {
  const text = String(seed ?? '');
  let hash = 7;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 1000;
  return -5 + (hash % 7); // -5deg … +1deg
}

export function Stamp({ status = 'none', seed, size, className, onDark = false }) {
  const stamp = STAMPS[status] || STAMPS.none;
  const colour = status === 'none' && onDark ? 'var(--color-bone-muted)' : stamp.color;
  return (
    <span
      className={cn('stamp', size === 'lg' && 'stamp-lg', status === 'none' && 'border opacity-60', className)}
      style={{ '--stamp-tilt': `${tiltFrom(seed ?? stamp.label)}deg`, color: colour, borderColor: colour }}
    >
      {stamp.label}
    </span>
  );
}

export function stampLabel(status) {
  return (STAMPS[status] || STAMPS.none).label;
}

export function stampColour(status) {
  return (STAMPS[status] || STAMPS.none).color;
}

export { STAMPS };
