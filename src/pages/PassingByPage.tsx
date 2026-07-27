
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { sanitizeError } from '@/utils/errorHandler';
import { Trash2, UserRound, Plus } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { upsertDispatchItem } from '@/utils/printQueue';
import BulkAddDialog, { type BulkAddRow } from '@/components/forms/BulkAddDialog';
import { normalizeSerial, validateSerial } from '@/utils/serial';

type Row = Record<string, any>;

const COLUMNS: { key: string; label: string; type?: 'date' }[] = [
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'serial_number', label: 'Serial Number' },
  { key: 'model', label: 'Model' },
  { key: 'name', label: 'Name' },
  { key: 'location', label: 'Location' },
  { key: 'note', label: 'Note' },
  { key: 'comment', label: 'Comment' },
  { key: 'dispatch_date', label: 'Dispatch Date', type: 'date' },
];

const today = () => new Date().toISOString().slice(0, 10);
const COL_WIDTH = 180;
const ROW_HEIGHT = 34;
const PAD_ROWS = 100;

const PassingByPage = () => {
  const { user, isAdmin, isOwner } = useAuth();
  const canDelete = isAdmin || isOwner;
  const { t, dir } = useLanguage();
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Buffer for empty (uncommitted) rows so a barcode scanner blasting characters
  // one-by-one doesn't create a new DB row per keystroke.
  const [drafts, setDrafts] = useState<Record<number, Record<string, string>>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const committingDrafts = useRef<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const appendRows = (incoming: Row | Row[]) => {
    const list = Array.isArray(incoming) ? incoming : [incoming];
    setRows(prev => {
      const seen = new Set(prev.map(r => r.id).filter(Boolean));
      const next = [...prev];
      for (const item of list) {
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        next.push(item);
      }
      return next;
    });
  };

  const fetchRows = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('passing_by')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) toast.error(sanitizeError(error));
    else setRows(data || []);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Realtime: reflect other users' changes instantly.
  useEffect(() => {
    const channel = (supabase as any)
      .channel('passing_by-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passing_by' }, (payload: any) => {
        setRows(prev => {
          if (payload.eventType === 'INSERT') {
            if (prev.some(r => r.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          }
          if (payload.eventType === 'UPDATE') {
            return prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r);
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter(r => r.id !== payload.old.id);
          }
          return prev;
        });
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, []);

  const displayRows = useMemo(() => {
    const arr: (Row | null)[] = [...rows];
    while (arr.length < rows.length + PAD_ROWS) arr.push(null);
    return arr;
  }, [rows]);

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const totalWidth = 48 + COLUMNS.length * COL_WIDTH + 140;

  const persistCell = (id: string, key: string, value: string) => {
    const timerKey = `${id}:${key}`;
    if (saveTimers.current[timerKey]) clearTimeout(saveTimers.current[timerKey]);
    saveTimers.current[timerKey] = setTimeout(async () => {
      const savedValue = key === 'model' || key === 'name'
        ? String(value || '').replace(/\s+/g, ' ').trim()
        : value;
      const { error } = await (supabase as any)
        .from('passing_by')
        .update({ [key]: savedValue || null })
        .eq('id', id);
      if (error) toast.error(sanitizeError(error));
    }, 200);
  };

  const createRowWith = async (key: string, value: string) => {
    let cleanValue = value;
    if (key === 'serial_number' && value) {
      const check = validateSerial(value);
      if (!check.ok) { toast.error(check.error!); return; }
      cleanValue = check.value;
    } else if (key === 'model' || key === 'name') {
      cleanValue = String(value || '').replace(/\s+/g, ' ').trim();
    }
    const payload: Row = { created_by: user?.id, date: today(), [key]: cleanValue || null };
    if (key === 'date') payload.date = value || today();
    const { data, error } = await (supabase as any)
      .from('passing_by')
      .insert(payload)
      .select()
      .single();
    if (error) { toast.error(sanitizeError(error)); return; }
    appendRows(data);
  };

  const commitDraft = async (index: number) => {
    const draft = drafts[index];
    if (!draft) return null;
    if (committingDrafts.current.has(index)) return null;
    const hasValue = Object.values(draft).some(v => v && v.trim() !== '');
    if (!hasValue) return null;
    committingDrafts.current.add(index);
    const cleanDraft = { ...draft };
    if (cleanDraft.serial_number) {
      const check = validateSerial(cleanDraft.serial_number);
      if (!check.ok) { toast.error(check.error!); committingDrafts.current.delete(index); return null; }
      cleanDraft.serial_number = check.value;
    }
    cleanDraft.model = String(cleanDraft.model || '').replace(/\s+/g, ' ').trim();
    cleanDraft.name = String(cleanDraft.name || '').replace(/\s+/g, ' ').trim();
    const payload: Row = { created_by: user?.id, date: cleanDraft.date || today(), ...cleanDraft };
    try {
      const { data, error } = await (supabase as any)
        .from('passing_by')
        .insert(payload)
        .select()
        .single();
      if (error) { toast.error(sanitizeError(error)); return null; }
      appendRows(data);
      setDrafts(prev => { const n = { ...prev }; delete n[index]; return n; });
      return data;
    } finally {
      committingDrafts.current.delete(index);
    }
  };

  const updateCell = (id: string, key: string, value: string) => {
    if (key === 'serial_number' && value) {
      const check = validateSerial(value);
      if (!check.ok) { toast.error(check.error!); return; }
      value = check.value;
    }
    setRows(prev => prev.map(row => row.id === id ? { ...row, [key]: value } : row));
    persistCell(id, key, value);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) { toast.error('Admin only'); return; }
    const { error } = await (supabase as any).from('passing_by').delete().eq('id', id);
    if (error) toast.error(sanitizeError(error));
    else setRows(prev => prev.filter(row => row.id !== id));
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkAddRows = async (items: BulkAddRow[]) => {
    if (!items.length) return;
    const payload: Row[] = [];
    const seen = new Set<string>();
    let skipped = 0;
    for (const r of items.slice(0, 2000)) {
      const check = validateSerial(r.serial, { required: true });
      if (!check.ok) { skipped++; continue; }
      if (seen.has(check.value)) { skipped++; continue; }
      seen.add(check.value);
      payload.push({
        created_by: user?.id,
        date: today(),
        serial_number: check.value,
        model: (r.model || '').trim() || null,
        name: (r.name || '').trim() || null,
      });
    }
    if (!payload.length) { toast.error('No valid serials'); return; }
    const { data, error } = await (supabase as any).from('passing_by').insert(payload).select();
    if (error) toast.error(sanitizeError(error));
    else { toast.success(`+${data?.length || 0} rows${skipped ? ` (skipped ${skipped})` : ''}`); appendRows(data || []); }
  };

  const dispatchRow = (row: Row) => {
    if (!row.serial_number) { toast.error('Serial required'); return; }
    const dd = row.dispatch_date || today();
    upsertDispatchItem({
      serialNumber: normalizeSerial(row.serial_number),
      minerModel: row.model || '',
      location: row.location || '',
      customerName: row.name || '',
      dispatchDate: dd,
    });
    if (!row.dispatch_date) updateCell(row.id, 'dispatch_date', dd);
    toast.success('→ Printing › Dispatch');
  };

  const focusNextRow = (currentIndex: number, key: string) => {
    requestAnimationFrame(() => {
      const next = document.querySelector<HTMLInputElement>(
        `input[data-row-idx="${currentIndex + 1}"][data-col="${key}"]`,
      );
      next?.focus();
      next?.select();
    });
  };

  return (
    <div dir={dir} className="space-y-4">
      <div className="flex items-center gap-3">
        <UserRound className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">{t('passingBy')}</h1>
        <span className="text-xs text-muted-foreground">({rows.length})</span>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Bulk Add
        </Button>
      </div>
      <BulkAddDialog open={bulkOpen} onOpenChange={setBulkOpen} onSubmit={bulkAddRows} title="Bulk Add — Passing By" />

      <div
        ref={scrollRef}
        className="rounded-lg border border-border overflow-auto bg-card shadow-sm relative"
        style={{ height: '75vh' }}
      >
        <div style={{ width: totalWidth, position: 'relative' }}>
          <div className="sticky top-0 z-20 bg-primary/10 border-b border-border flex" style={{ height: ROW_HEIGHT, width: totalWidth }}>
            <div className="border-e border-border flex items-center justify-center font-semibold text-xs shrink-0" style={{ width: 48 }}>#</div>
            {COLUMNS.map(col => (
              <div key={col.key} className="border-e border-border flex items-center px-2 font-semibold text-xs shrink-0" style={{ width: COL_WIDTH }}>
                {col.label}
              </div>
            ))}
            <div className="flex items-center justify-center font-semibold text-xs shrink-0" style={{ width: 140 }}>{t('actions')}</div>
          </div>

          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map(v => {
              const row = displayRows[v.index];
              return (
                <div
                  key={v.key}
                  className={`flex absolute top-0 left-0 ${row && selected.has(row.id) ? 'bg-primary/15 ring-1 ring-primary/40' : (v.index % 2 ? 'bg-muted/30' : 'bg-background')}`}
                  style={{ transform: `translateY(${v.start}px)`, height: ROW_HEIGHT, width: totalWidth }}
                >
                  <button
                    type="button"
                    onClick={() => row && toggleSelect(row.id)}
                    className="border-e border-b border-border flex items-center justify-center text-xs text-muted-foreground shrink-0 hover:bg-primary/10"
                    style={{ width: 48 }}
                  >
                    {v.index + 1}
                  </button>
                  {COLUMNS.map(col => (
                    <div key={col.key} className="border-e border-b border-border shrink-0 p-0.5" style={{ width: COL_WIDTH }}>
                      <Input
                        type={col.type === 'date' ? 'date' : 'text'}
                        value={row ? (row[col.key] ?? '') : (drafts[v.index]?.[col.key] ?? '')}
                        data-row-idx={v.index}
                        data-col={col.key}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (!row) await commitDraft(v.index);
                            focusNextRow(v.index, col.key);
                          }
                        }}
                        onBlur={async () => {
                          if (!row && drafts[v.index]) await commitDraft(v.index);
                        }}
                        onChange={async (e) => {
                          const value = e.target.value;
                          if (row) updateCell(row.id, col.key, value);
                          else {
                            setDrafts(prev => ({
                              ...prev,
                              [v.index]: { ...(prev[v.index] || {}), [col.key]: value },
                            }));
                          }
                        }}
                        className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-primary rounded-none px-2"
                      />
                    </div>
                  ))}
                  <div className="border-b border-border flex items-center justify-center gap-1 shrink-0" style={{ width: 140 }}>
                    {row && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => dispatchRow(row)}
                      >
                        Dispatch
                      </Button>
                    )}
                    {row && canDelete && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(row.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PassingByPage;
