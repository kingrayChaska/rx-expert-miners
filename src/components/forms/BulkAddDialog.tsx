
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { normalizeSerial } from '@/utils/serial';

export type BulkAddRow = { serial: string; model: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (rows: BulkAddRow[]) => void | Promise<void>;
  title?: string;
};

const splitLines = (s: string) => s.split(/\r?\n/).map(l => l.trim());

const BulkAddDialog = ({ open, onOpenChange, onSubmit, title = 'Bulk Add' }: Props) => {
  const [serials, setSerials] = useState('');
  const [models, setModels] = useState('');
  const [names, setNames] = useState('');
  const [busy, setBusy] = useState(false);

  const preview = (() => {
    const s = splitLines(serials).map(normalizeSerial).filter(Boolean);
    const m = splitLines(models);
    const n = splitLines(names);
    const single = { model: m.length === 1 ? m[0] : '', name: n.length === 1 ? n[0] : '' };
    return s.map((serial, i) => ({
      serial,
      model: m.length === 1 ? single.model : (m[i] || ''),
      name: n.length === 1 ? single.name : (n[i] || ''),
    }));
  })();

  const submit = async () => {
    if (!preview.length) return;
    setBusy(true);
    try {
      await onSubmit(preview);
      setSerials(''); setModels(''); setNames('');
      onOpenChange(false);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-xs">
            سطر واحد لكل صف. اكتب موديل/اسم واحد لتطبيقه على الكل، أو سطراً لكل صف.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Serial Numbers ({splitLines(serials).filter(Boolean).length})</Label>
            <Textarea rows={12} value={serials} onChange={e => setSerials(e.target.value)} placeholder="SN0001&#10;SN0002" className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Miner Model</Label>
            <Textarea rows={12} value={models} onChange={e => setModels(e.target.value)} placeholder="S19 Pro" className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Client / Name</Label>
            <Textarea rows={12} value={names} onChange={e => setNames(e.target.value)} placeholder="Ali" className="font-mono text-xs" />
          </div>
        </div>
        <DialogFooter>
          <span className="text-xs text-muted-foreground me-auto self-center">{preview.length} row(s) ready</span>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !preview.length}>{busy ? 'Adding…' : `Add ${preview.length}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAddDialog;
