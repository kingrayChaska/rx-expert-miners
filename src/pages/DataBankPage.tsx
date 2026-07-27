
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { BarChart3, Database, UserRound, CheckCircle2, Wrench, PackageCheck, Clock, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const CHART_COLORS = ['#f2b632', '#e8944a', '#4ade80', '#60a5fa', '#c084fc', '#f87171'];

type Row = Record<string, any>;

const DataBankPage = () => {
  const { dir } = useLanguage();
  const [master, setMaster] = useState<Row[]>([]);
  const [passing, setPassing] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState<string>(''); // YYYY-MM
  const [serialFilter, setSerialFilter] = useState<string>('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [m, p] = await Promise.all([
      (supabase as any).from('master_data').select('*').limit(20000),
      (supabase as any).from('passing_by').select('*').limit(20000),
    ]);
    setMaster(m.data || []);
    setPassing(p.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Apply realtime payloads incrementally instead of refetching everything.
  // Multiple rapid changes are coalesced so the UI updates once per burst.
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const apply = (setter: (fn: (prev: Row[]) => Row[]) => void, payload: any) => {
      setter(prev => {
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
    };
    const ch = (supabase as any)
      .channel('databank-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'master_data' }, (p: any) => {
        if (flushTimer.current) clearTimeout(flushTimer.current);
        flushTimer.current = setTimeout(() => apply(setMaster, p), 150);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passing_by' }, (p: any) => {
        if (flushTimer.current) clearTimeout(flushTimer.current);
        flushTimer.current = setTimeout(() => apply(setPassing, p), 150);
      })
      .subscribe();
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      (supabase as any).removeChannel(ch);
    };
  }, []);

  // Available months across both datasets, sorted desc.
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const pick = (r: Row) => {
      const d = r.receiving_date || r.date || r.created_at;
      if (!d) return;
      const s = String(d).slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(s)) set.add(s);
    };
    master.forEach(pick); passing.forEach(pick);
    return [...set].sort().reverse();
  }, [master, passing]);

  const inMonth = (r: Row, dateKey: string) => {
    if (!monthFilter) return true;
    const d = String(r[dateKey] || r.created_at || '').slice(0, 7);
    return d === monthFilter;
  };
  const matchSerial = (r: Row) => {
    const q = serialFilter.trim().toLowerCase();
    if (!q) return true;
    return [r.serial_number, r.psu_serial_number, r.hash_board_serial_number]
      .some(v => String(v || '').toLowerCase().includes(q));
  };

  const filteredMaster = useMemo(
    () => master.filter(r => inMonth(r, 'receiving_date') && matchSerial(r)),
    [master, monthFilter, serialFilter],
  );
  const filteredPassing = useMemo(
    () => passing.filter(r => inMonth(r, 'date') && matchSerial(r)),
    [passing, monthFilter, serialFilter],
  );

  const stats = useMemo(() => {
    const m = filteredMaster;
    const p = filteredPassing;
    const total = m.length;
    const dispatched = m.filter(r => r.dispatch_status === 'Dispatch' || r.dispatch_date).length;
    const inRepair = m.filter(r => (r.repair_status || r.aging_status) && !r.dispatch_date).length;
    const awaiting = m.filter(r => r.client_approval === 'Awaiting approved').length;
    const ready = m.filter(r => r.ready_for_dispatch === 'Yes' && !r.dispatch_date).length;
    const warranty = m.filter(r => r.warranty_status === 'Warranty').length;
    const outWarranty = m.filter(r => r.warranty_status === 'Out of 6').length;
    const uniqueClients = new Set(m.map(r => (r.client_name || '').trim()).filter(Boolean)).size;

    // Last 30 days receiving
    const cutoff30 = Date.now() - 30 * 86400000;
    const last30 = m.filter(r => {
      const t = r.receiving_date ? new Date(r.receiving_date).getTime() : 0;
      return t >= cutoff30;
    }).length;

    // Top clients
    const clientCount = new Map<string, number>();
    for (const r of m) {
      const c = (r.client_name || '').trim();
      if (!c) continue;
      clientCount.set(c, (clientCount.get(c) || 0) + 1);
    }
    const topClients = [...clientCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Top models
    const modelCount = new Map<string, number>();
    for (const r of m) {
      const mm = (r.miner_model_and_type || '').trim();
      if (!mm) continue;
      modelCount.set(mm, (modelCount.get(mm) || 0) + 1);
    }
    const topModels = [...modelCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Final status distribution
    const finalDist = new Map<string, number>();
    for (const r of m) {
      const f = (r.final_status || '').trim();
      if (!f) continue;
      finalDist.set(f, (finalDist.get(f) || 0) + 1);
    }

    // Per-month time series (top 12)
    const perMonth = new Map<string, number>();
    for (const r of m) {
      const mm = String(r.receiving_date || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(mm)) continue;
      perMonth.set(mm, (perMonth.get(mm) || 0) + 1);
    }
    const byMonth = [...perMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);

    // Serial number breakdown by status
    const pickSerials = (rows: Row[]) => {
      const out: string[] = [];
      for (const r of rows) {
        const s = String(r.serial_number || r.psu_serial_number || r.hash_board_serial_number || '').trim();
        if (s) out.push(s);
      }
      return out.sort();
    };
    const serialsReady = pickSerials(m.filter(r => r.ready_for_dispatch === 'Yes' && !r.dispatch_date));
    const serialsInRepair = pickSerials(m.filter(r => (r.repair_status || r.aging_status) && !r.dispatch_date));
    const serialsAwaiting = pickSerials(m.filter(r => r.client_approval === 'Awaiting approved'));
    const serialsDispatched = pickSerials(m.filter(r => r.dispatch_status === 'Dispatch' || r.dispatch_date));
    const serialsWarranty = pickSerials(m.filter(r => r.warranty_status === 'Warranty'));
    const serialsOutWarranty = pickSerials(m.filter(r => r.warranty_status === 'Out of 6'));

    return {
      total, dispatched, inRepair, awaiting, ready, warranty, outWarranty,
      uniqueClients, last30, topClients, topModels, finalDist, byMonth,
      passingTotal: p.length,
      passingDispatched: p.filter(r => r.dispatch_date).length,
      serialsReady, serialsInRepair, serialsAwaiting, serialsDispatched,
      serialsWarranty, serialsOutWarranty,
    };
  }, [filteredMaster, filteredPassing]);

  const isRTL = dir === 'rtl';
  const label = (en: string, ar: string) => (isRTL ? ar : en);

  const cards = [
    { icon: Database, tint: 'primary', v: stats.total, l: label('Total Master Records', 'إجمالي السجلات') },
    { icon: PackageCheck, tint: 'success', v: stats.dispatched, l: label('Dispatched', 'تم التسليم') },
    { icon: Wrench, tint: 'warning', v: stats.inRepair, l: label('In Repair', 'قيد الصيانة') },
    { icon: Clock, tint: 'warning', v: stats.awaiting, l: label('Awaiting Approval', 'بانتظار الموافقة') },
    { icon: CheckCircle2, tint: 'success', v: stats.ready, l: label('Ready for Dispatch', 'جاهز للتسليم') },
    { icon: Users, tint: 'primary', v: stats.uniqueClients, l: label('Unique Clients', 'العملاء الفريدون') },
    { icon: BarChart3, tint: 'primary', v: stats.last30, l: label('Received (30d)', 'مستلم آخر 30 يوم') },
    { icon: UserRound, tint: 'primary', v: stats.passingTotal, l: label('Passing By Entries', 'سجلات العابرين') },
  ];

  const tintClasses = (t: string) =>
    t === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    : t === 'warning' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    : 'bg-primary/10 text-primary';

  const Bar = ({ label, count, max }: { label: string; count: number; max: number }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="truncate max-w-[70%]" title={label}>{label}</span>
        <span className="text-muted-foreground tabular-nums">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${max ? (count / max) * 100 : 0}%` }} />
      </div>
    </div>
  );

  const maxClient = Math.max(1, ...stats.topClients.map(([, n]) => n));
  const maxModel = Math.max(1, ...stats.topModels.map(([, n]) => n));
  const finalArr = [...stats.finalDist.entries()];

  return (
    <div dir={dir} className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{label('Data Bank', 'بنك البيانات')}</h1>
          <p className="text-sm text-muted-foreground">{label('Live statistics across all records', 'إحصاءات حية لجميع السجلات')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase text-muted-foreground">{label('Month', 'الشهر')}</label>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">{label('All months', 'كل الأشهر')}</option>
            {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-[10px] uppercase text-muted-foreground">{label('Serial Number', 'الرقم المتسلسل')}</label>
          <Input
            value={serialFilter}
            onChange={(e) => setSerialFilter(e.target.value)}
            placeholder={label('Search serial / PSU / hashboard…', 'ابحث بالرقم المتسلسل…')}
            className="h-8 text-xs"
          />
        </div>
        {(monthFilter || serialFilter) && (
          <Button size="sm" variant="outline" onClick={() => { setMonthFilter(''); setSerialFilter(''); }}>
            {label('Clear', 'مسح')}
          </Button>
        )}
        <div className="text-xs text-muted-foreground ms-auto">
          {label('Showing', 'يعرض')}: {filteredMaster.length} / {master.length}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">{label('Loading…', 'جارِ التحميل…')}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.l} className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3 shadow-sm">
                  <div className={`p-2 rounded-xl ${tintClasses(c.tint)}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-bold tabular-nums">{c.v.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.l}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:col-span-2">
              <h3 className="font-semibold mb-3">{label('Records by Month', 'السجلات حسب الشهر')}</h3>
              {stats.byMonth.length === 0 ? (
                <p className="text-xs text-muted-foreground">{label('No data', 'لا توجد بيانات')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={stats.byMonth.map(([m, v]) => ({ month: m, count: v }))}
                    onClick={(e: any) => { const m = e?.activeLabel; if (m) setMonthFilter(m); }}
                  >
                    <defs>
                      <linearGradient id="monthFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={28} />
                    <RechartsTooltip
                      cursor={{ stroke: 'hsl(var(--border))' }}
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#monthFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-semibold mb-3">{label('Warranty Breakdown', 'حالة الضمان')}</h3>
              {stats.warranty + stats.outWarranty === 0 ? (
                <p className="text-xs text-muted-foreground">{label('No data', 'لا توجد بيانات')}</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={160}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: label('Warranty', 'ضمان'), value: stats.warranty },
                          { name: label('Out of Warranty', 'خارج الضمان'), value: stats.outWarranty },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        <Cell fill={CHART_COLORS[0]} />
                        <Cell fill={CHART_COLORS[5]} />
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[0] }} />{label('Warranty', 'ضمان')}: <b className="tabular-nums">{stats.warranty}</b></div>
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[5] }} />{label('Out of Warranty', 'خارج الضمان')}: <b className="tabular-nums">{stats.outWarranty}</b></div>
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-semibold mb-3">{label('Final Status', 'الحالة النهائية')}</h3>
              {finalArr.length === 0 ? (
                <p className="text-xs text-muted-foreground">{label('No data', 'لا توجد بيانات')}</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={160}>
                    <PieChart>
                      <Pie
                        data={finalArr.map(([k, v]) => ({ name: k, value: v }))}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {finalArr.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 text-xs max-h-40 overflow-auto">
                    {finalArr.map(([k, v], i) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="truncate">{k}</span>: <b className="tabular-nums">{v}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-semibold mb-3">{label('Top Clients', 'أهم العملاء')}</h3>
              <div className="space-y-3">
                {stats.topClients.length === 0 && <p className="text-xs text-muted-foreground">{label('No data', 'لا توجد بيانات')}</p>}
                {stats.topClients.map(([k, v]) => <Bar key={k} label={k} count={v} max={maxClient} />)}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-semibold mb-3">{label('Top Miner Models', 'أهم موديلات الأجهزة')}</h3>
              <div className="space-y-3">
                {stats.topModels.length === 0 && <p className="text-xs text-muted-foreground">{label('No data', 'لا توجد بيانات')}</p>}
                {stats.topModels.map(([k, v]) => <Bar key={k} label={k} count={v} max={maxModel} />)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-semibold mb-3">{label('Serial Numbers by Status', 'الأرقام المتسلسلة حسب الحالة')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: label('Ready for Dispatch', 'جاهز للتسليم'), list: stats.serialsReady, tone: 'text-emerald-600 dark:text-emerald-400' },
                { title: label('In Repair', 'قيد الصيانة'), list: stats.serialsInRepair, tone: 'text-amber-600 dark:text-amber-400' },
                { title: label('Awaiting Approval', 'بانتظار الموافقة'), list: stats.serialsAwaiting, tone: 'text-amber-600 dark:text-amber-400' },
                { title: label('Dispatched', 'تم التسليم'), list: stats.serialsDispatched, tone: 'text-emerald-600 dark:text-emerald-400' },
                { title: label('Warranty', 'ضمان'), list: stats.serialsWarranty, tone: 'text-primary' },
                { title: label('Out of Warranty', 'خارج الضمان'), list: stats.serialsOutWarranty, tone: 'text-destructive' },
              ].map(g => (
                <div key={g.title} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold ${g.tone}`}>{g.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{g.list.length}</span>
                  </div>
                  <div className="max-h-40 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-[11px] leading-5">
                    {g.list.length === 0
                      ? <span className="text-muted-foreground">{label('No data', 'لا توجد بيانات')}</span>
                      : g.list.slice(0, 500).map((s, i) => (
                          <button
                            key={`${s}-${i}`}
                            type="button"
                            onClick={() => setSerialFilter(s)}
                            className="block w-full text-start hover:text-primary hover:underline"
                          >{s}</button>
                        ))}
                    {g.list.length > 500 && (
                      <span className="text-muted-foreground">… +{g.list.length - 500}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DataBankPage;
