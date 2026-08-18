import { useState } from 'react';
import { toast } from 'sonner';
import { MessageSquare, AlertTriangle } from 'lucide-react';
import { acknowledgeNotice, currentUser, plan, state } from '@/store/store';
import { FEEDBACK_EMAIL, PROTOTYPE, BUILD_LABEL } from '@/config';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * What this build is and isn't.
 *
 * Sending is simulated and the seeded venues are invented. Without saying so plainly, a
 * tester can walk the whole flow, get a success toast and a tracked outreach record, and
 * reasonably believe they have just emailed a venue. That is the one misunderstanding
 * this build could cause that actually costs somebody something.
 */
export function PrototypeNotice() {
  const [open, setOpen] = useState(() => PROTOTYPE && !state.noticeAckAt);
  if (!PROTOTYPE) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        acknowledgeNotice();
        setOpen(false);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-flash-red" /> Before you start
          </DialogTitle>
        </DialogHeader>

        <p className="text-[0.85rem] leading-relaxed text-paper-ink">
          This is a working prototype of GigBook, not the finished product. Three things
          worth knowing before you use it:
        </p>

        <ul className="space-y-2.5 text-[0.84rem] leading-relaxed text-paper-ink">
          <li className="flex gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-flash-red" />
            <span>
              <strong className="font-semibold">No email is ever sent.</strong> Drafting and
              &ldquo;sending&rdquo; a pitch records it in your pipeline so you can try the flow, but
              nothing leaves your browser and no venue hears from you.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-flash-red" />
            <span>
              <strong className="font-semibold">The venues are real, but unverified.</strong> The
              rooms, addresses and booking emails come from a working spreadsheet — some are
              missing, some are out of date, and none of it has been checked with the venue.
              Treat a listing as a lead, not a confirmed contact.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-flash-red" />
            <span>
              <strong className="font-semibold">Everything lives in this browser.</strong> There
              are no accounts and no server. Clearing site data, switching device or using a
              private window loses your work. When you&apos;re done, send it back with{' '}
              <em>Settings → Data → Download my test data</em>.
            </span>
          </li>
        </ul>

        <p className="text-[0.8rem] text-paper-muted">
          Hit the feedback button in the sidebar whenever something annoys you — the moment it
          happens is worth more than trying to remember it later. ({BUILD_LABEL})
        </p>

        <DialogFooter>
          <Button
            onClick={() => { acknowledgeNotice(); setOpen(false); }}
            data-notice-ack
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The standing reminder, so it's true on every screen and not just the first one. */
export function PrototypeStamp({ className }) {
  if (!PROTOTYPE) return null;
  return (
    <span
      className={cn('stamp', className)}
      style={{ color: 'var(--color-stamp-none)', borderColor: 'var(--color-stamp-none)' }}
      title="Nothing is really sent, and the venues may be invented"
      data-prototype
    >
      Prototype
    </span>
  );
}

/**
 * Feedback, captured where it happens. Mails it if an address is configured, otherwise
 * copies it to the clipboard — the repo is public, so an address in the source gets
 * scraped, and that's the tester's call to make rather than a default.
 */
export function FeedbackButton({ className }) {
  if (!PROTOTYPE) return null;
  const user = currentUser();

  function report() {
    const lines = [
      'What were you trying to do?',
      '',
      '',
      'What happened instead?',
      '',
      '',
      '---',
      `Screen: ${window.location.hash || '#/'}`,
      `Build: ${BUILD_LABEL}`,
      `Plan: ${user ? plan().name : 'signed out'}`,
      `Window: ${window.innerWidth}×${window.innerHeight}`,
      `Browser: ${navigator.userAgent}`,
    ].join('\n');

    if (FEEDBACK_EMAIL) {
      window.location.href = `mailto:${FEEDBACK_EMAIL}`
        + `?subject=${encodeURIComponent(`GigBook feedback — ${BUILD_LABEL}`)}`
        + `&body=${encodeURIComponent(lines)}`;
      return;
    }

    navigator.clipboard?.writeText(lines).then(
      () => toast.success('Report copied', { description: 'Paste it to whoever sent you this link.' }),
      () => toast.error('Could not copy — take a screenshot instead'),
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={report} className={className} data-feedback>
      <MessageSquare className="size-4" /> Feedback
    </Button>
  );
}
