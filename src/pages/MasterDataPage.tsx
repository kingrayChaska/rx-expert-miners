
import { useState, useEffect, useCallback, useRef, useMemo, useDeferredValue } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { sanitizeError } from '@/utils/errorHandler';
import { Trash2, Database, Download, Upload, Plus } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/utils/cn';
import { upsertReceiveItem, upsertDispatchItem, getReceiveQueue } from '@/utils/printQueue';
import BulkAddDialog, { type BulkAddRow } from '@/components/forms/BulkAddDialog';
import { normalizeSerial, validateSerial, isSerialKey } from '@/utils/serial';

type Row = Record<string, any>;

const COLUMNS: { key: string; label: string; type?: 'date' | 'select'; options?: string[] }[] = [
  { key: 'receiving_date', label: 'Receiving Date', type: 'date' },
  { key: 'customer_type', label: 'Customer Type', type: 'select', options: ['General Customer', 'Courier'] },
  { key: 'client_name', label: 'Client Name' },
  { key: 'miner_model_and_type', label: 'Miner Model & Type' },
  { key: 'serial_number', label: 'Serial Number' },
  { key: 'psu_serial_number', label: 'PSU Serial Number' },
  { key: 'hash_board_serial_number', label: 'Hash Board Serial Number' },
  { key: 'receiving_location', label: 'Receiving Location' },
  { key: 'warranty_status', label: 'Warranty Status', type: 'select', options: ['Warranty', 'Out of 6'] },
  { key: 'column_10', label: 'Column 10', type: 'select', options: ['Ticket assigned'] },
  { key: 'work_order', label: 'Work Order' },
  { key: 'client_approval', label: 'Client Approval', type: 'select', options: ['Approved', 'Awaiting approved'] },
  { key: 'repair_status', label: 'Repair Status', type: 'select', options: ['Went for repair'] },
  { key: 'aging_status', label: 'Aging Status', type: 'select', options: ['Repair and went to test'] },
  { key: 'quotation_sent', label: 'Quotation Sent', type: 'select', options: ['Yes', 'No'] },
  { key: 'final_status', label: 'Final Status', type: 'select', options: ['Repair', 'Scrape', 'Return to customer'] },
  { key: 'payment', label: 'Payment', type: 'select', options: ['Yes', 'No'] },
  { key: 'ready_for_dispatch', label: 'Ready For Dispatch', type: 'select', options: ['Yes', 'No'] },
  { key: 'dispatch_status', label: 'Dispatch Status', type: 'select', options: ['Dispatch'] },
  { key: 'dispatch_date', label: 'Dispatch Date', type: 'date' },
  { key: 'dispatch_location', label: 'Dispatch Location' },
  { key: 'note', label: 'Note' },
];

const today = () => new Date().toISOString().slice(0, 10);
const COL_WIDTH = 180;
const ROW_HEIGHT = 34;
const ROW_PAD_STEP = 1000;
const INITIAL_PAD = 100;
const DAYS_REPEAT = 15;
const SAVED_PAGE_SIZE = 1000;

const blankToNull = (value: any) => String(value ?? '').trim() === '' ? null : value;
const normalizeText = (value: any) => String(value ?? '').replace(/\s+/g, ' ').trim();

const dateMs = (value: any) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const SelectButtonCell = ({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className={cn(
          'h-7 w-full px-2 text-start text-xs hover:bg-accent/40 focus:outline-none focus:ring-1 focus:ring-primary',
          value ? 'bg-transparent' : 'bg-background',
        )}
      >
        {value}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="min-w-[160px]">
      <DropdownMenuItem className="text-xs text-muted-foreground" onClick={() => onChange('')}>
        Clear
      </DropdownMenuItem>
      {options.map((opt) => (
        <DropdownMenuItem key={opt} className="text-xs" onClick={() => onChange(opt)}>
          {opt}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

const MasterDataPage = () => {
  const { user, isAdmin, isOwner } = useAuth();
  const canDelete = isAdmin || isOwner;
  const { t, dir } = useLanguage();
  const [rows, setRows] = useState<Row[]>([]);
  // Buffer typing into an empty (not-yet-created) row so a barcode scanner
  // sending characters one-by-one doesn't insert a new DB row per keystroke.
  const [drafts, setDrafts] = useState<Record<number, Record<string, any>>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [padCount, setPadCount] = useState(INITIAL_PAD);
  const [hasMoreSaved, setHasMoreSaved] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recentDispatches, setRecentDispatches] = useState<Row[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
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

  // Track which rows are present in the local print (Receive) queue so we can
  // show a per-row sync indicator (Synced vs Pending sync).
  const [syncedKeys, setSyncedKeys] = useState<{ ids: Set<string>; serials: Set<string> }>(
    { ids: new Set(), serials: new Set() },
  );
  useEffect(() => {
    const refresh = () => {
      const q = getReceiveQueue();
      const ids = new Set<string>();
      const serials = new Set<string>();
      for (const it of q) {
        if (it.id) ids.add(it.id);
        if (it.serialNumber) serials.add(normalizeSerial(it.serialNumber));
      }
      setSyncedKeys({ ids, serials });
    };
    refresh();
    const onChange = () => refresh();
    window.addEventListener('print-queue-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('print-queue-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const getSyncState = (r: Row | null): 'synced' | 'pending' | 'none' => {
    if (!r) return 'none';
    const hasScan = !!(r.serial_number || r.psu_serial_number || r.hash_board_serial_number);
    if (!hasScan) return 'none';
    const sn = normalizeSerial(r.serial_number);
    if (syncedKeys.ids.has(r.id) || (sn && syncedKeys.serials.has(sn))) return 'synced';
    return 'pending';
  };

  const fetchRecentDispatches = useCallback(async () => {
    const cutoff = new Date(Date.now() - DAYS_REPEAT * 86400000).toISOString().slice(0, 10);
    const { data } = await (supabase as any)
      .from('master_data')
      .select('id,serial_number,dispatch_date')
      .not('dispatch_date', 'is', null)
      .gte('dispatch_date', cutoff)
      .limit(10000);
    setRecentDispatches(data || []);
  }, []);

  const fetchRows = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('master_data')
      .select('*')
      .order('created_at', { ascending: true })
      .range(0, SAVED_PAGE_SIZE - 1);
    if (error) toast.error(sanitizeError(error));
    else {
      setRows(data || []);
      setHasMoreSaved((data || []).length === SAVED_PAGE_SIZE);
      fetchRecentDispatches();
    }
  }, [fetchRecentDispatches]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Realtime: any insert/update/delete from another user shows up immediately.
  useEffect(() => {
    const channel = (supabase as any)
      .channel('master_data-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'master_data' }, (payload: any) => {
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

  const serialLookup = useMemo(() => {
    const map = new Map<string, Row>();
    for (const row of rows) {
      const sn = normalizeSerial(row.serial_number);
      if (sn && !map.has(sn)) map.set(sn, row);
    }
    return map;
  }, [rows]);

  const createRowWith = async (key: string, value: any): Promise<Row | null> => {
    const payload: Row = { created_by: user?.id, receiving_date: today() };
    if (key !== 'receiving_date') {
      let v = value;
      if (isSerialKey(key) && v) {
        const check = validateSerial(v);
        if (!check.ok) { toast.error(check.error!); return null; }
        v = check.value;
      } else if (key === 'client_name' || key === 'miner_model_and_type') {
        v = normalizeText(v);
      }
      payload[key] = blankToNull(v);
    }
    else payload.receiving_date = value || today();
    if (key === 'serial_number' && value) {
      const match = serialLookup.get(normalizeSerial(value));
      if (match) {
        if (match.client_name) payload.client_name = match.client_name;
        if (match.miner_model_and_type) payload.miner_model_and_type = match.miner_model_and_type;
      }
    }
    const { data, error } = await (supabase as any)
      .from('master_data')
      .insert(payload)
      .select()
      .single();
    if (error) { toast.error(sanitizeError(error)); return null; }
    appendRows(data);
    if (data.dispatch_date) fetchRecentDispatches();
    return data;
  };

  const commitDraft = async (index: number): Promise<Row | null> => {
    const draft = drafts[index];
    if (!draft) return null;
    if (committingDrafts.current.has(index)) return null;
    const hasValue = Object.values(draft).some(v => v != null && String(v).trim() !== '');
    if (!hasValue) return null;
    committingDrafts.current.add(index);
    try {
      const cleanDraft: Row = { ...draft };
      for (const k of Object.keys(cleanDraft)) {
        if (isSerialKey(k) && cleanDraft[k]) {
          const check = validateSerial(cleanDraft[k]);
          if (!check.ok) { toast.error(`${k}: ${check.error}`); return null; }
          cleanDraft[k] = check.value;
        } else if (k === 'client_name' || k === 'miner_model_and_type') {
          cleanDraft[k] = normalizeText(cleanDraft[k]);
        }
      }
      const payload: Row = { created_by: user?.id, receiving_date: cleanDraft.receiving_date || today(), ...cleanDraft };
      if (draft.serial_number) {
        const match = serialLookup.get(normalizeSerial(draft.serial_number));
        if (match) {
          if (match.client_name && !payload.client_name) payload.client_name = match.client_name;
          if (match.miner_model_and_type && !payload.miner_model_and_type) payload.miner_model_and_type = match.miner_model_and_type;
        }
      }
      const { data, error } = await (supabase as any)
        .from('master_data')
        .insert(payload)
        .select()
        .single();
      if (error) { toast.error(sanitizeError(error)); return null; }
      appendRows(data);
      setDrafts(prev => { const n = { ...prev }; delete n[index]; return n; });
      if (data.dispatch_date) fetchRecentDispatches();
      return data;
    } finally {
      committingDrafts.current.delete(index);
    }
  };

  const persistCell = (id: string, key: string, value: any) => {
    const k = `${id}:${key}`;
    if (saveTimers.current[k]) clearTimeout(saveTimers.current[k]);
    saveTimers.current[k] = setTimeout(async () => {
      const savedValue = key === 'client_name' || key === 'miner_model_and_type'
        ? normalizeText(value)
        : value;
      const { error } = await (supabase as any)
        .from('master_data')
        .update({ [key]: blankToNull(savedValue) })
        .eq('id', id);
      if (error) toast.error(sanitizeError(error));
    }, 200);
  };

  const updateCell = (id: string, key: string, value: any) => {
    if (isSerialKey(key) && value) {
      const check = validateSerial(value);
      if (!check.ok) { toast.error(check.error!); return; }
      value = check.value;
    }
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const next = { ...r, [key]: value };
      if (key === 'dispatch_status' && value === 'Dispatch' && !next.dispatch_date) {
        next.dispatch_date = today();
        persistCell(id, 'dispatch_date', next.dispatch_date);
        fetchRecentDispatches();
      }
      // Push to Dispatch print queue when Dispatch button is pressed,
      // and keep it in sync for any later field edits on a dispatched row.
      if (next.dispatch_status === 'Dispatch' && next.serial_number) {
        upsertDispatchItem({
          serialNumber: normalizeSerial(next.serial_number),
          psuNumber: next.psu_serial_number || '',
          hashboardSerial: next.hash_board_serial_number || '',
          workOrder: next.work_order || '',
          finalStatus: next.final_status || next.repair_status || '',
          dispatchDate: next.dispatch_date || today(),
          location: next.dispatch_location || next.receiving_location || '',
          customerName: next.client_name || '',
          minerModel: next.miner_model_and_type || '',
        });
      }
      // Push/refresh the Receive print queue as soon as we have a serial number.
      // Any later edit (PSU, hashboard, client, location, etc.) syncs into the
      // same queue entry via upsert.
      if (next.serial_number || next.psu_serial_number || next.hash_board_serial_number) {
        upsertReceiveItem({
          id: next.id,
          serialNumber: normalizeSerial(next.serial_number),
          clientName: next.client_name || '',
          minerModel: next.miner_model_and_type || '',
          psuSerial: next.psu_serial_number || '',
          hbSerial: next.hash_board_serial_number || '',
          location: next.receiving_location || '',
          note: next.note || '',
          entryData: next.receiving_date || '',
        });
      }
      if (key === 'serial_number' && value) {
        const match = serialLookup.get(normalizeSerial(value));
        if (match) {
          if (match.client_name && !next.client_name) {
            next.client_name = match.client_name;
            persistCell(id, 'client_name', match.client_name);
          }
          if (match.miner_model_and_type && !next.miner_model_and_type) {
            next.miner_model_and_type = match.miner_model_and_type;
            persistCell(id, 'miner_model_and_type', match.miner_model_and_type);
          }
        }
      }
      return next;
    }));
    persistCell(id, key, value);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Excel-style multi-cell paste. If clipboard has tabs/newlines, distribute
  // the values into columns/rows starting from the focused cell.
  const pasteGridFrom = async (
    text: string,
    startRowIdx: number,
    startColKey: string,
  ): Promise<boolean> => {
    if (!text.includes('\t') && !text.includes('\n')) return false;
    const grid = text.replace(/\r/g, '').split('\n').map(l => l.split('\t'));
    while (grid.length && grid[grid.length - 1].every(x => x === '')) grid.pop();
    if (!grid.length) return false;
    const startCol = COLUMNS.findIndex(cc => cc.key === startColKey);
    if (startCol < 0) return false;

    const updates: { id: string; patch: Row }[] = [];
    const inserts: Row[] = [];

    for (let ri = 0; ri < grid.length; ri++) {
      const target = filteredRows[startRowIdx + ri];
      const cells = grid[ri];
      const patch: Row = {};
      for (let ci = 0; ci < cells.length; ci++) {
        const col = COLUMNS[startCol + ci];
        if (!col) break;
        let raw = cells[ci];
        if (isSerialKey(col.key) && raw) {
          const check = validateSerial(raw);
          if (!check.ok) { toast.error(`${col.key}: ${check.error}`); return true; }
          raw = check.value;
        }
        if (col.key === 'client_name' || col.key === 'miner_model_and_type') raw = normalizeText(raw);
        patch[col.key] = blankToNull(raw);
      }
      if (target) updates.push({ id: target.id, patch });
      else inserts.push({ created_by: user?.id, receiving_date: today(), ...patch });
    }

    if (updates.length) {
      setRows(prev => prev.map(r => {
        const u = updates.find(x => x.id === r.id);
        return u ? { ...r, ...u.patch } : r;
      }));
      for (const u of updates) {
        const { error } = await (supabase as any)
          .from('master_data').update(u.patch).eq('id', u.id);
        if (error) { toast.error(sanitizeError(error)); return true; }
      }
    }
    if (inserts.length) {
      const { data, error } = await (supabase as any)
        .from('master_data').insert(inserts).select();
      if (error) { toast.error(sanitizeError(error)); return true; }
      if (data) appendRows(data);
    }
    toast.success(`Pasted ${grid.length} row(s)`);
    return true;
  };

  const bulkAddRows = async (items: BulkAddRow[]) => {
    if (!items.length) return;
    const payload: Row[] = [];
    const skipped: string[] = [];
    const seen = new Set<string>();
    for (const r of items.slice(0, 2000)) {
      const check = validateSerial(r.serial, { required: true });
      if (!check.ok) { skipped.push(`${r.serial}: ${check.error}`); continue; }
      if (seen.has(check.value)) { skipped.push(`${check.value}: duplicate`); continue; }
      seen.add(check.value);
      payload.push({
        created_by: user?.id,
        receiving_date: today(),
        serial_number: check.value,
        miner_model_and_type: normalizeText(r.model) || null,
        client_name: normalizeText(r.name) || null,
      });
    }
    if (!payload.length) { toast.error('No valid serials'); return; }
    const { data, error } = await (supabase as any).from('master_data').insert(payload).select();
    if (error) toast.error(sanitizeError(error));
    else {
      toast.success(`+${data?.length || 0} rows${skipped.length ? ` (skipped ${skipped.length})` : ''}`);
      appendRows(data || []);
    }
  };

  const loadMoreSavedRows = async () => {
    setLoadingMore(true);
    const from = rows.length;
    const { data, error } = await (supabase as any)
      .from('master_data')
      .select('*')
      .order('created_at', { ascending: true })
      .range(from, from + SAVED_PAGE_SIZE - 1);
    setLoadingMore(false);
    if (error) { toast.error(sanitizeError(error)); return; }
    appendRows(data || []);
    setHasMoreSaved((data || []).length === SAVED_PAGE_SIZE);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) { toast.error('Admin only'); return; }
    if (!confirm('?')) return;
    const { error } = await (supabase as any).from('master_data').delete().eq('id', id);
    if (error) toast.error(sanitizeError(error));
    else setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleExport = async () => {
    const XLSX = await import('xlsx');
    const data = rows.map((r, i) => {
      const out: Row = { '#': i + 1 };
      for (const c of COLUMNS) out[c.label] = r[c.key] ?? '';
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master Data');
    XLSX.writeFile(wb, `master_data_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: Row[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const labelToKey = Object.fromEntries(COLUMNS.map(c => [c.label.toLowerCase(), c.key]));
      const payload = json.map(row => {
        const obj: Row = { created_by: user?.id };
        for (const [k, v] of Object.entries(row)) {
          const key = labelToKey[String(k).toLowerCase()];
          if (key) {
            let val: any = v;
            if (isSerialKey(key) && val) val = normalizeSerial(val);
            else if (key === 'client_name' || key === 'miner_model_and_type') val = normalizeText(val);
            obj[key] = blankToNull(val);
          }
        }
        return obj;
      }).filter(o => Object.keys(o).length > 1);
      if (!payload.length) { toast.error('No rows'); return; }
      const { error } = await (supabase as any).from('master_data').insert(payload);
      if (error) toast.error(sanitizeError(error));
      else { toast.success(`+${payload.length}`); fetchRows(); }
    } catch (err: any) {
      toast.error(err?.message || 'Import failed');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const filteredRows = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return q
      ? rows.filter(r => COLUMNS.some(c => String(r[c.key] ?? '').toLowerCase().includes(q)))
      : rows;
  }, [rows, deferredSearch]);

  const isSearching = deferredSearch.trim().length > 0;
  const virtualCount = filteredRows.length + (isSearching ? 0 : padCount);

  const rowVirtualizer = useVirtualizer({
    count: virtualCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  });

  const SYNC_WIDTH = 90;
  const totalWidth = 48 + COLUMNS.length * COL_WIDTH + SYNC_WIDTH + 80;

  // Detect repeat-repair: a serial was dispatched, then a NEW row for the same
  // serial was received within DAYS_REPEAT days. Flag the repeat row's id.
  const repeatRepair = useMemo(() => {
    const dispatchesBySerial = new Map<string, { id: string; time: number }[]>();
    for (const r of [...recentDispatches, ...rows]) {
      const sn = normalizeSerial(r.serial_number);
      if (!sn || !r.dispatch_date) continue;
      const t = dateMs(r.dispatch_date);
      if (t == null) continue;
      const arr = dispatchesBySerial.get(sn) || [];
      arr.push({ id: r.id, time: t });
      dispatchesBySerial.set(sn, arr);
    }
    const flaggedIds = new Set<string>();
    for (const r of rows) {
      const sn = normalizeSerial(r.serial_number);
      if (!sn || !r.receiving_date) continue;
      const rt = dateMs(r.receiving_date) ?? dateMs(r.created_at);
      if (rt == null) continue;
      const dispatches = dispatchesBySerial.get(sn);
      if (!dispatches) continue;
      for (const dispatch of dispatches) {
        if (dispatch.id === r.id) continue;
        const diff = (rt - dispatch.time) / 86400000;
        if (diff >= 0 && diff <= DAYS_REPEAT) {
          flaggedIds.add(r.id);
          break;
        }
      }
    }
    return flaggedIds;
  }, [rows, recentDispatches]);

  return (
    <div dir={dir} className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('masterData')}</h1>
          <span className="text-xs text-muted-foreground">({rows.length})</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search') || 'Search...'}
            className="h-8 w-48 text-xs"
          />
          <Button size="sm" variant="outline" onClick={() => setPadCount(c => c + ROW_PAD_STEP)}>
            + 1000 Rows
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Bulk Add
          </Button>
          {hasMoreSaved && (
            <Button size="sm" variant="outline" onClick={loadMoreSavedRows} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load saved rows'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>
      <BulkAddDialog open={bulkOpen} onOpenChange={setBulkOpen} onSubmit={bulkAddRows} title="Bulk Add — Master Data" />

      <div
        ref={scrollRef}
        className="rounded-lg border border-border overflow-auto bg-card shadow-sm relative"
        style={{ height: '75vh' }}
      >
        <div style={{ width: totalWidth, position: 'relative' }}>
          {/* Header */}
          <div
            className="sticky top-0 z-20 bg-amber-100 dark:bg-amber-900/40 border-b-2 border-amber-500 flex"
            style={{ height: ROW_HEIGHT, width: totalWidth }}
          >
            <div className="border-e border-border flex items-center justify-center font-semibold text-xs shrink-0" style={{ width: 48 }}>#</div>
            {COLUMNS.map(c => (
              <div key={c.key} className="border-e border-border flex items-center px-2 font-semibold text-xs shrink-0" style={{ width: COL_WIDTH }}>
                {c.label}
              </div>
            ))}
            <div className="border-e border-border flex items-center justify-center font-semibold text-xs shrink-0" style={{ width: SYNC_WIDTH }}>Print Sync</div>
            <div className="flex items-center justify-center font-semibold text-xs shrink-0" style={{ width: 80 }}>{t('actions')}</div>
          </div>

          {/* Virtualized rows */}
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map(v => {
              const r = filteredRows[v.index] || null;
              const i = v.index;
              return (
                <div
                  key={v.key}
                  className={`flex absolute top-0 left-0 ${
                    r && selected.has(r.id)
                      ? 'bg-primary/15 ring-1 ring-primary/40'
                      : (i % 2 ? 'bg-muted/30' : 'bg-background')
                  }`}
                  style={{ transform: `translateY(${v.start}px)`, height: ROW_HEIGHT, width: totalWidth }}
                >
                  <button
                    type="button"
                    onClick={() => r && toggleSelect(r.id)}
                    className="border-e border-b border-border flex items-center justify-center text-xs text-muted-foreground shrink-0 hover:bg-primary/10"
                    style={{ width: 48 }}
                    title={r ? 'Click to select row' : ''}
                  >
                    {i + 1}
                  </button>
                  {COLUMNS.map(c => (
                    <div key={c.key} className="border-e border-b border-border shrink-0 p-0.5" style={{ width: COL_WIDTH }}>
                      {c.type === 'select' ? (
                          <SelectButtonCell
                            value={(r && r[c.key]) || ''}
                            options={c.options!}
                            onChange={async (value) => {
                              if (r) updateCell(r.id, c.key, value);
                              else if (value !== '') {
                                setDrafts(prev => ({ ...prev, [v.index]: { ...(prev[v.index] || {}), [c.key]: value } }));
                                await commitDraft(v.index);
                              }
                            }}
                          />
                        ) : (
                          <div className="relative flex items-center gap-1">
                            <Input
                              type={c.type === 'date' ? 'date' : 'text'}
                              value={r ? (r[c.key] ?? '') : (drafts[v.index]?.[c.key] ?? '')}
                              data-row-idx={v.index}
                              data-col={c.key}
                              onPaste={async (e) => {
                                const text = e.clipboardData.getData('text');
                                const handled = await pasteGridFrom(text, v.index, c.key);
                                if (handled) e.preventDefault();
                              }}
                              onKeyDown={async (e) => {
                                const scanCols = ['serial_number', 'psu_serial_number', 'hash_board_serial_number'];
                                if (scanCols.includes(c.key) && e.key === 'Enter') {
                                  e.preventDefault();
                                  if (!r) await commitDraft(v.index);
                                  requestAnimationFrame(() => {
                                    const next = document.querySelector<HTMLInputElement>(
                                      `input[data-row-idx="${v.index + 1}"][data-col="${c.key}"]`,
                                    );
                                    next?.focus();
                                    next?.select();
                                  });
                                }
                              }}
                              onBlur={async () => {
                                if (!r && drafts[v.index]) await commitDraft(v.index);
                              }}
                              onChange={async (e) => {
                                const val = e.target.value;
                                if (r) updateCell(r.id, c.key, val);
                                else {
                                  setDrafts(prev => ({
                                    ...prev,
                                    [v.index]: { ...(prev[v.index] || {}), [c.key]: val },
                                  }));
                                }
                              }}
                              className={`h-7 text-xs border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-primary rounded-none px-2 ${
                                c.key === 'serial_number' && r && repeatRepair.has(r.id)
                                  ? 'text-destructive font-bold'
                                  : ''
                              }`}
                            />
                            {c.key === 'serial_number' && r && repeatRepair.has(r.id) && (
                              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] bg-destructive text-destructive-foreground px-1 rounded">2 repair</span>
                            )}
                          </div>
                        )}
                    </div>
                  ))}
                  <div className="border-e border-b border-border flex items-center justify-center shrink-0" style={{ width: SYNC_WIDTH }}>
                    {(() => {
                      const st = getSyncState(r);
                      if (st === 'none') return <span className="text-[10px] text-muted-foreground">—</span>;
                      if (st === 'synced') return (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" title="Synced to Print queue">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Synced
                        </span>
                      );
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400" title="Waiting to sync to Print queue">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending
                        </span>
                      );
                    })()}
                  </div>
                  <div className="border-b border-border flex items-center justify-center shrink-0" style={{ width: 80 }}>
                    {r && canDelete && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(r.id)}>
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

export default MasterDataPage;
