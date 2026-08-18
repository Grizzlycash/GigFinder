import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, MapPin, Map as MapIcon, Phone, User, Star, Settings as SettingsIcon,
  Shield, Menu, Send, ChevronRight, Zap, LogOut, ArrowLeft, Database, Upload, Users as UsersIcon, BarChart3,
} from 'lucide-react';
import { currentUser, signOut, plan, isPro, dueFollowUps, sendsRemaining, pendingSubmissions } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PrototypeNotice, PrototypeStamp, FeedbackButton } from '@/components/PrototypeNotice';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

const NAV = [
  { group: 'Main' },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { to: '/venues', label: 'Venues', icon: MapPin },
  { to: '/map', label: 'Map', icon: MapIcon },
  { to: '/outreach', label: 'Outreach', icon: Phone, badge: 'followups' },
  { group: 'My profile' },
  { to: '/epk', label: 'My EPK', icon: User },
  { to: '/lists', label: 'Saved Lists', icon: Star, pro: true },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const ADMIN_NAV = [
  { group: 'Admin' },
  { to: '/admin/overview', label: 'Overview', icon: BarChart3 },
  { to: '/admin/venues', label: 'Venue database', icon: Database },
  { to: '/admin/import', label: 'Import spreadsheet', icon: Upload },
  { to: '/admin/submissions', label: 'Submissions', icon: Shield, badge: 'pending' },
  { to: '/admin/users', label: 'Users', icon: UsersIcon },
];

function NavItem({ item, admin }) {
  const Icon = item.icon;
  const follow = dueFollowUps().length;
  const queued = item.badge === 'pending' ? pendingSubmissions().length : 0;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 px-2.5 py-2 rounded-[3px] text-[0.82rem] font-display uppercase tracking-[0.08em]',
          'text-bone-muted hover:bg-ink-hover hover:text-bone transition-colors',
          isActive && (admin
            ? 'bg-ink-hover text-bone shadow-[inset_2px_0_0_var(--color-stamp-emailed)]'
            : 'bg-ink-hover text-bone shadow-[inset_2px_0_0_var(--color-flash-red)]'),
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-4 shrink-0', isActive ? 'text-flash-red' : 'text-bone-muted/70', admin && isActive && 'text-stamp-emailed')} />
          <span className="truncate">{item.label}</span>
          {item.badge === 'followups' && follow > 0 && (
            <Badge variant="red" className="ml-auto">{follow}</Badge>
          )}
          {queued > 0 && <Badge variant="red" className="ml-auto" data-queue>{queued}</Badge>}
          {item.pro && !isPro() && <Badge variant="ink" className="ml-auto">Pro</Badge>}
        </>
      )}
    </NavLink>
  );
}

export default function AppShell({ title, subtitle, actions, admin = false, flush = false, children }) {
  const user = currentUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(false);
  const remaining = sendsRemaining();

  return (
    <div className="flex min-h-screen">
      <PrototypeNotice />
      {/* ---- Sidebar ---- */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-56 shrink-0 flex flex-col bg-ink-deep spine',
          'transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-ink-line">
          <span
            className={cn('grid place-items-center size-7 rounded-[2px] font-display text-[0.85rem]',
              admin ? 'bg-stamp-emailed text-ink' : 'bg-flash-red text-[#fbf7ec]')}
          >
            {admin ? <Shield className="size-4" /> : 'GB'}
          </span>
          <span className="leading-none">
            <span className="block font-display text-[1.05rem] tracking-[0.06em] text-bone">GigBook</span>
            {admin && <span className="block eyebrow text-stamp-emailed mt-0.5">Admin</span>}
          </span>
        </div>

        <div className="px-4 pb-1 pt-2.5">
          <PrototypeStamp />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {(admin ? ADMIN_NAV : NAV).map((item, i) =>
            item.group ? (
              <div key={item.group} className={cn('eyebrow text-bone-muted/60 px-2.5 pb-1', i > 0 && 'pt-4')}>
                {item.group}
              </div>
            ) : (
              <NavItem key={item.to} item={item} admin={admin} />
            ),
          )}

          {!admin && user?.isAdmin && (
            <>
              <div className="eyebrow text-bone-muted/60 px-2.5 pb-1 pt-4">Staff</div>
              <NavItem item={{ to: '/admin/overview', label: 'Admin panel', icon: Shield }} />
            </>
          )}
          {admin && (
            <>
              <div className="eyebrow text-bone-muted/60 px-2.5 pb-1 pt-4">Back</div>
              <NavItem item={{ to: '/dashboard', label: 'Artist app', icon: ArrowLeft }} admin />
            </>
          )}
        </nav>

        <div className="border-t border-ink-line p-2.5">
          <FeedbackButton className="mb-1 w-full justify-start text-bone-muted hover:text-bone" />
          {remaining !== Infinity && (
            <p className="px-1 pb-2 text-[0.68rem] text-bone-muted">
              {remaining} of {plan().limits.sendsPerMonth} sends left this month
            </p>
          )}
          <button
            type="button"
            onClick={() => setAccount(true)}
            className="flex w-full items-center gap-2.5 rounded-[3px] p-1.5 text-left hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-flash-red"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-hover font-display text-[0.7rem] text-bone">
              {initials(user?.artistName || user?.email)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[0.8rem] tracking-wide text-bone">
                {user?.artistName || 'Your account'}
              </span>
              <span className="block text-[0.68rem] text-flash-red">{plan().name} plan</span>
            </span>
            <ChevronRight className="size-4 text-bone-muted" />
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-ink/70 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      {/* ---- Main ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bill-rule sticky top-0 z-20 flex items-center gap-3 bg-ink/95 px-4 py-3 backdrop-blur lg:px-6">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl leading-tight tracking-[0.04em] text-bone lg:text-2xl">{title}</h1>
            {subtitle && <p className="truncate text-[0.75rem] text-bone-muted">{subtitle}</p>}
          </div>
          {actions}
          {!admin && (
            <Button asChild size="sm">
              <Link to="/send"><Send className="size-4" /> Send EPK</Link>
            </Button>
          )}
          {admin && (
            <span className="stamp hidden sm:inline-flex" style={{ color: 'var(--color-stamp-emailed)', borderColor: 'var(--color-stamp-emailed)' }}>
              Admin panel
            </span>
          )}
        </header>

        <main className={cn('flex-1', flush ? 'flex min-h-0 flex-col' : 'mx-auto w-full max-w-6xl px-4 py-5 lg:px-6')}>
          {children}
        </main>
      </div>

      {/* ---- Account dialog ---- */}
      <Dialog open={account} onOpenChange={setAccount}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{user?.artistName || 'Account'}</DialogTitle>
            <p className="text-[0.8rem] text-paper-muted">{user?.email}</p>
          </DialogHeader>
          <p className="text-[0.8rem] text-paper-muted -mt-2">
            {plan().name} plan · billed {user?.cycle === 'annual' ? 'annually' : 'monthly'}
          </p>
          <div className="grid gap-2">
            <Button variant="paper" asChild onClick={() => setAccount(false)}>
              <Link to="/pricing"><Zap className="size-4" /> Plan &amp; billing</Link>
            </Button>
            <Button variant="paper" asChild onClick={() => setAccount(false)}>
              <Link to="/settings"><SettingsIcon className="size-4" /> Settings</Link>
            </Button>
            {user?.isAdmin && (
              <Button variant="paper" asChild onClick={() => setAccount(false)}>
                <Link to="/admin/overview"><Shield className="size-4" /> Admin panel</Link>
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => {
                setAccount(false);
                signOut();
                navigate('/');
              }}
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
