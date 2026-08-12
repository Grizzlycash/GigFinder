import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Download, Eye, FileText, Loader2, RotateCcw } from 'lucide-react';
import {
  buildDocument, documentFor, printableSections, reorderSection, updateSection,
  sectionPhotos, estimatePages,
} from '@/lib/epkDocument';
import { generateEpkPdf } from '@/lib/epkPdf';
import { saveEpkDocument, currentUser } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * The press kit on screen and on paper.
 *
 * `PressKitPages` mirrors the PDF's layout closely enough to edit against — same document
 * model, same type, same palette — but the PDF from `epkPdf.js` is the artifact that
 * actually goes out. Where they differ it's pagination: the browser scrolls, the PDF breaks.
 */

/* ---------- the preview ---------- */

function Block({ section, epk }) {
  const photos = section.kind === 'photos' ? sectionPhotos(section, epk) : [];
  return (
    <section className="mt-6 first:mt-0">
      <span className="block h-[2px] w-8 bg-flash-red" />
      <h3 className="mt-2 font-display uppercase tracking-[0.09em] text-[0.95rem] text-paper-ink">{section.title}</h3>
      {section.kind === 'photos' ? (
        <div className="mt-2.5 grid grid-cols-2 gap-3">
          {photos.map((p) => (
            <figure key={p.id}>
              <img src={p.src} alt={p.label || ''} className="w-full rounded-[2px] border border-paper-line object-cover" />
              {p.label && <figcaption className="mt-1 text-[0.68rem] text-paper-muted">{p.label}</figcaption>}
            </figure>
          ))}
        </div>
      ) : (
        <div className="mt-2 space-y-1.5">
          {String(section.body || '').split('\n').map((line, i) => {
            const pair = /^(.{1,28}?) — (.+)$/.exec(line.trim());
            if (!line.trim()) return <div key={i} className="h-1.5" />;
            if (pair) {
              return (
                <p key={i} className="flex flex-wrap gap-x-3 text-[0.84rem] leading-relaxed">
                  <span className="w-28 shrink-0 font-display uppercase tracking-[0.07em] text-[0.7rem] text-paper-muted">{pair[1]}</span>
                  <span className="min-w-0 flex-1 break-words text-paper-ink">{pair[2]}</span>
                </p>
              );
            }
            return <p key={i} className="text-[0.84rem] leading-relaxed text-paper-ink">{line}</p>;
          })}
        </div>
      )}
    </section>
  );
}

export function PressKitPages({ document, epk, className }) {
  const cover = (epk?.photos || []).find((p) => p.id === document.coverPhotoId) || null;
  const sections = printableSections(document);

  return (
    <div className={cn('overflow-hidden rounded-[3px] border border-paper-line bg-paper', className)} data-kit-preview>
      {/* Cover */}
      <div className="bg-ink text-bone">
        {cover && <img src={cover.src} alt="" className="h-44 w-full object-cover" />}
        <div className="px-6 py-6">
          <span className="block h-[3px] w-16 bg-flash-red" />
          <h2 className="mt-3 text-3xl leading-[1.02] text-bone">{document.headline}</h2>
          {document.tagline && <p className="mt-2 text-[0.9rem] text-bone-muted">{document.tagline}</p>}
          {document.strapline && (
            <p className="mt-2.5 font-display uppercase tracking-[0.12em] text-[0.68rem] text-flash-red">{document.strapline}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {sections.length ? sections.map((s) => <Block key={s.id} section={s} epk={epk} />) : (
          <p className="text-[0.84rem] text-paper-muted">
            Nothing to print yet — fill in your EPK, or switch a section back on.
          </p>
        )}
        {document.contact && (
          <Block section={{ id: 'contact', title: 'Get in touch', body: document.contact }} epk={epk} />
        )}
      </div>
    </div>
  );
}

/* ---------- the editor ---------- */

export function PressKitEditor({ document, epk, onChange }) {
  const sections = [...(document.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pk-headline">Cover headline</Label>
          <Input
            id="pk-headline"
            value={document.headline || ''}
            onChange={(e) => onChange({ ...document, headline: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pk-tagline">Tagline</Label>
          <Input
            id="pk-tagline"
            value={document.tagline || ''}
            onChange={(e) => onChange({ ...document, tagline: e.target.value })}
          />
        </div>
      </div>

      {sections.map((s, i) => (
        <div key={s.id} className="rounded-[3px] border border-paper-line bg-paper-shade/50 p-3" data-kit-section={s.kind}>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`inc-${s.id}`}
              checked={s.include !== false}
              onCheckedChange={(checked) => onChange(updateSection(document, s.id, { include: Boolean(checked) }))}
              aria-label={`Include ${s.title}`}
            />
            <Input
              value={s.title}
              onChange={(e) => onChange(updateSection(document, s.id, { title: e.target.value }))}
              aria-label={`${s.title} heading`}
              className="h-8 flex-1 font-display uppercase tracking-[0.06em] text-[0.8rem]"
            />
            <Button
              type="button" variant="ghost-paper" size="icon-sm" aria-label={`Move ${s.title} up`}
              disabled={i === 0} onClick={() => onChange(reorderSection(document, s.id, -1))}
            >
              <ArrowUp className="size-3.5" />
            </Button>
            <Button
              type="button" variant="ghost-paper" size="icon-sm" aria-label={`Move ${s.title} down`}
              disabled={i === sections.length - 1} onClick={() => onChange(reorderSection(document, s.id, 1))}
            >
              <ArrowDown className="size-3.5" />
            </Button>
          </div>

          {s.kind === 'photos' ? (
            <p className="mt-2 text-[0.75rem] text-paper-muted">
              {sectionPhotos(s, epk).length} photo(s) from your EPK. Add or remove them in the EPK editor.
            </p>
          ) : (
            <Textarea
              value={s.body}
              onChange={(e) => onChange(updateSection(document, s.id, { body: e.target.value }))}
              aria-label={`${s.title} text`}
              rows={s.kind === 'bio' ? 5 : 3}
              className="mt-2 bg-paper text-[0.82rem]"
            />
          )}
        </div>
      ))}

      <div className="space-y-1.5">
        <Label htmlFor="pk-contact">Contact block</Label>
        <Textarea
          id="pk-contact"
          rows={3}
          value={document.contact || ''}
          onChange={(e) => onChange({ ...document, contact: e.target.value })}
        />
      </div>
    </div>
  );
}

/* ---------- the piece the routes actually use ---------- */

/**
 * Holds the working copy of the document, saves edits back to the EPK, and owns PDF
 * generation. `onDocumentChange` lets the send flow keep the snapshot it will record.
 */
export function usePressKit(epk) {
  const user = currentUser();
  const [document, setDocument] = useState(() => documentFor(epk, user));
  const [building, setBuilding] = useState(false);

  // Switching EPK (or editing one in another tab) has to reload the working copy.
  useEffect(() => { setDocument(documentFor(epk, user)); }, [epk?.id, epk?.updatedAt]);

  const pages = useMemo(() => estimatePages(document, epk), [document, epk]);

  function change(next) {
    setDocument(next);
    if (epk?.id) saveEpkDocument(epk.id, next);
  }

  function rebuild() {
    const fresh = buildDocument(epk, user);
    setDocument(fresh);
    if (epk?.id) saveEpkDocument(epk.id, null);
    toast.success('Rebuilt from your EPK');
  }

  async function build() {
    setBuilding(true);
    try {
      return await generateEpkPdf({ document, epk, user });
    } finally {
      setBuilding(false);
    }
  }

  async function download() {
    try {
      const { blob, filename } = await build();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Press kit downloaded', { description: filename });
    } catch (err) {
      toast.error('Could not build the PDF', { description: err.message });
    }
  }

  return { document, setDocument: change, rebuild, build, download, building, pages };
}

export function PressKitActions({ kit, epk, className }) {
  const [preview, setPreview] = useState(false);
  return (
    <>
      <div className={cn('flex flex-wrap gap-2', className)}>
        <Button type="button" variant="paper" size="sm" onClick={() => setPreview(true)} data-kit-preview-open>
          <Eye className="size-4" /> Preview
        </Button>
        <Button type="button" variant="paper" size="sm" onClick={kit.download} disabled={kit.building} data-kit-download>
          {kit.building ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download PDF
        </Button>
        <Button type="button" variant="ghost-paper" size="sm" onClick={kit.rebuild} data-kit-rebuild>
          <RotateCcw className="size-4" /> Rebuild from EPK
        </Button>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4" /> Press kit preview
            </DialogTitle>
          </DialogHeader>
          <p className="text-[0.76rem] text-paper-muted">
            About {kit.pages} pages. Download the PDF for the exact page breaks.
          </p>
          <PressKitPages document={kit.document} epk={epk} />
        </DialogContent>
      </Dialog>
    </>
  );
}
