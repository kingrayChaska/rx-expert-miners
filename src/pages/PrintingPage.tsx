
import { useState, useRef, useEffect } from 'react';
import { Printer, Copy, Check, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import rxLogo from '@/assets/rx-logo.asset.json';
import {
  getReceiveQueue,
  getDispatchQueue,
  setReceiveQueue,
  setDispatchQueue,
  clearReceiveQueue,
  clearDispatchQueue,
  normalizeReceiveQueue,
  normalizeDispatchQueue,
} from '@/utils/printQueue';

const WAREHOUSE_NOTE =
  'Miners unapproved or repaired and stored over 30 days will incur a $1/day warehouse fee thereafter.';

type ReceiveRow = {
  entryData: string;
  clientName: string;
  serialNumber: string;
  psuSerial: string;
  hbSerial: string;
  minerModel: string;
  location: string;
  note: string;
};

type DispatchRow = {
  serialNumber: string;
  minerModel: string;
  psuNumber: string;
  hashboardSerial: string;
  workOrder: string;
  finalStatus: string;
  dispatchDate: string;
  location: string;
};

const emptyReceive = (): ReceiveRow => ({
  entryData: '',
  clientName: '',
  serialNumber: '',
  psuSerial: '',
  hbSerial: '',
  minerModel: '',
  location: '',
  note: '',
});

const emptyDispatch = (): DispatchRow => ({
  serialNumber: '',
  minerModel: '',
  psuNumber: '',
  hashboardSerial: '',
  workOrder: '',
  finalStatus: '',
  dispatchDate: '',
  location: '',
});

const today = () => new Date().toISOString().slice(0, 10);

const PrintingPage = () => {
  const [mode, setMode] = useState<'receive' | 'dispatch'>('receive');

  // Receive state
  const [receivedBy, setReceivedBy] = useState('HASSAN ISMAIL');
  const [rDeliveredBy, setRDeliveredBy] = useState('');
  const [rDate, setRDate] = useState(today());
  const [rRows, setRRows] = useState<ReceiveRow[]>([emptyReceive()]);

  // Dispatch state
  const [dCustomerName, setDCustomerName] = useState('');
  const [dDate, setDDate] = useState(today());
  const [dRows, setDRows] = useState<DispatchRow[]>([emptyDispatch()]);

  const printRef = useRef<HTMLDivElement>(null);
  const selfWriteRef = useRef(0);
  const queuesReadyRef = useRef(false);

  // Auto-load any queued items from MasterData / scanners
  useEffect(() => {
    const loadQueues = () => {
      if (selfWriteRef.current > 0) {
        selfWriteRef.current -= 1;
        return;
      }
      const rq = getReceiveQueue();
      setRRows((rq.length
        ? rq.map(q => ({
          entryData: q.entryData || '',
          clientName: q.clientName || '',
          serialNumber: q.serialNumber || '',
          psuSerial: q.psuSerial || '',
          hbSerial: q.hbSerial || '',
          minerModel: q.minerModel || '',
          location: q.location || '',
          note: q.note || '',
        })).concat([emptyReceive()])
        : [emptyReceive()]));
      const dq = getDispatchQueue();
      const customer = dq.find(q => q.customerName)?.customerName;
      setDCustomerName(customer || '');
      setDRows((dq.length
        ? dq.map(q => ({
          serialNumber: q.serialNumber || '',
          minerModel: q.minerModel || '',
          psuNumber: q.psuNumber || '',
          hashboardSerial: q.hashboardSerial || '',
          workOrder: q.workOrder || '',
          finalStatus: q.finalStatus || '',
          dispatchDate: q.dispatchDate || today(),
          location: q.location || '',
        })).concat([emptyDispatch()])
        : [emptyDispatch()]));
    };
    loadQueues();
    const readyTimer = window.setTimeout(() => {
      queuesReadyRef.current = true;
    }, 0);
    const handler = () => loadQueues();
    window.addEventListener('print-queue-changed', handler);
    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener('print-queue-changed', handler);
    };
  }, []);

  const updateR = (i: number, k: keyof ReceiveRow, v: string) =>
    setRRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const updateD = (i: number, k: keyof DispatchRow, v: string) =>
    setDRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  const removeR = (i: number) =>
    setRRows((rs) => (rs.length === 1 ? [emptyReceive()] : rs.filter((_, idx) => idx !== i)));
  const removeD = (i: number) =>
    setDRows((rs) => (rs.length === 1 ? [emptyDispatch()] : rs.filter((_, idx) => idx !== i)));

  const rQuantity = rRows.filter((r) =>
    Object.values(r).some((v) => v.trim() !== ''),
  ).length;
  const dQuantity = dRows.filter((r) =>
    Object.values(r).some((v) => String(v).trim() !== ''),
  ).length;

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = async () => {
    const el = printRef.current;
    if (!el) return;
    try {
      const html = el.innerHTML;
      const text = el.innerText;
      if (navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
  };

  const clearAll = () => {
    if (mode === 'receive') {
      setRRows([emptyReceive()]);
      clearReceiveQueue();
    } else {
      setDRows([emptyDispatch()]);
      clearDispatchQueue();
    }
    toast.success('Cleared');
  };

  // Keep queue in sync with edits so it persists across navigations
  useEffect(() => {
    if (!queuesReadyRef.current) return;
    const items = normalizeReceiveQueue(rRows
      .filter(r => Object.values(r).some(v => v.trim() !== ''))
      .map(r => ({
        entryData: r.entryData,
        clientName: r.clientName,
        serialNumber: r.serialNumber,
        psuSerial: r.psuSerial,
        hbSerial: r.hbSerial,
        minerModel: r.minerModel,
        location: r.location,
        note: r.note,
      })));
    selfWriteRef.current += 1;
    setReceiveQueue(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rRows]);
  useEffect(() => {
    if (!queuesReadyRef.current) return;
    const items = normalizeDispatchQueue(dRows
      .filter(r => Object.values(r).some(v => String(v).trim() !== ''))
      .map(r => ({
        serialNumber: r.serialNumber,
        minerModel: r.minerModel,
        psuNumber: r.psuNumber,
        hashboardSerial: r.hashboardSerial,
        workOrder: r.workOrder,
        finalStatus: r.finalStatus,
        dispatchDate: r.dispatchDate,
        location: r.location,
        customerName: dCustomerName,
      })));
    selfWriteRef.current += 1;
    setDispatchQueue(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dRows, dCustomerName]);

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between gap-3 no-print flex-wrap">
        <div className="flex items-center gap-3">
          <Printer className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Printing</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={mode === 'receive' ? 'default' : 'outline'}
            onClick={() => setMode('receive')}
          >
            <Check className="h-4 w-4 mr-1" /> Receive
          </Button>
          <Button
            size="sm"
            variant={mode === 'dispatch' ? 'default' : 'outline'}
            onClick={() => setMode('dispatch')}
          >
            <Check className="h-4 w-4 mr-1" /> Dispatch
          </Button>
          <Button size="sm" variant="ghost" onClick={clearAll} title="Clear">
            <Trash2 className="h-4 w-4 mr-1" /> Clear
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopy} title="Copy for print">
            <Copy className="h-4 w-4 mr-1" /> Copy
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </div>

      {mode === 'receive' && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 no-print">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Received By</Label>
              <Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
            </div>
            <div>
              <Label>Customer Name</Label>
              <Input value={rDeliveredBy} onChange={(e) => setRDeliveredBy(e.target.value)} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)} />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input value={String(rQuantity)} readOnly />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-muted">
                <tr>
                  {['Entry Data','Client Name','Serial Number','PSU Serial','HB Serial','Miner Model','Location','Note'].map((h) => (
                    <th key={h} className="border px-2 py-1 text-left">{h}</th>
                  ))}
                  <th className="border px-2 py-1 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rRows.map((r, i) => (
                  <tr key={i}>
                    {(Object.keys(r) as (keyof ReceiveRow)[]).map((k) => (
                      <td key={k} className="border p-0">
                        <Input
                          className="h-8 border-0 rounded-none"
                          value={r[k]}
                          onChange={(e) => updateR(i, k, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="border p-0 text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeR(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button size="sm" variant="outline" onClick={() => setRRows((rs) => [...rs, emptyReceive()])}>
            + Add Row
          </Button>
        </div>
      )}

      {mode === 'dispatch' && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 no-print">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Customer Name</Label>
              <Input value={dCustomerName} onChange={(e) => setDCustomerName(e.target.value)} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={dDate} onChange={(e) => setDDate(e.target.value)} />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input value={String(dQuantity)} readOnly />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-muted">
                <tr>
                  {['Serial Number','Miner Model','PSU Number','Hashboard Serial','Work Order','Final Status','Dispatch Date','Location'].map((h) => (
                    <th key={h} className="border px-2 py-1 text-left">{h}</th>
                  ))}
                  <th className="border px-2 py-1 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {dRows.map((r, i) => (
                  <tr key={i}>
                    {(Object.keys(r) as (keyof DispatchRow)[]).map((k) => (
                      <td key={k} className="border p-0">
                        <Input
                          type={k === 'dispatchDate' ? 'date' : 'text'}
                          className="h-8 border-0 rounded-none"
                          value={r[k]}
                          onChange={(e) => updateD(i, k, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="border p-0 text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeD(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button size="sm" variant="outline" onClick={() => setDRows((rs) => [...rs, emptyDispatch()])}>
            + Add Row
          </Button>
        </div>
      )}

      {/* Printable area */}
      <div ref={printRef} className="print-area rounded-lg border border-border bg-white text-black p-6 space-y-3">
        <div className="flex items-center justify-between border-b border-black pb-2 mb-2">
          <img src={rxLogo.url} alt="RX Expert Miners" className="h-14 object-contain" />
          <div className="text-right text-xs leading-tight">
            <div className="font-bold text-base">RX EXPERT MINERS</div>
            <div>Hardware Service & Maintenance</div>
          </div>
        </div>
        {mode === 'receive' ? (
          <>
            <h2 className="text-xl font-bold text-center">Receive</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><b>Received By:</b> {receivedBy}</div>
              <div><b>Customer Name:</b> {rDeliveredBy}</div>
              <div><b>Quantity:</b> {rQuantity}</div>
              <div><b>Date:</b> {rDate}</div>
            </div>
            <div className="text-sm italic">Note: "{WAREHOUSE_NOTE}"</div>
            <table className="w-full text-xs border border-black border-collapse">
              <thead>
                <tr>
                  {['Entry Data','Client Name','Serial Number','PSU Serial','HB Serial','Miner Model','Location','Note'].map((h) => (
                    <th key={h} className="border border-black px-1 py-1 text-left bg-gray-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rRows.map((r, i) => (
                  <tr key={i}>
                    <td className="border border-black px-1 py-1">{r.entryData}</td>
                    <td className="border border-black px-1 py-1">{r.clientName}</td>
                    <td className="border border-black px-1 py-1">{r.serialNumber}</td>
                    <td className="border border-black px-1 py-1">{r.psuSerial}</td>
                    <td className="border border-black px-1 py-1">{r.hbSerial}</td>
                    <td className="border border-black px-1 py-1">{r.minerModel}</td>
                    <td className="border border-black px-1 py-1">{r.location}</td>
                    <td className="border border-black px-1 py-1">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-center">Dispatch</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><b>Customer Name:</b> {dCustomerName}</div>
              <div><b>Date:</b> {dDate}</div>
              <div><b>Quantity:</b> {dQuantity}</div>
            </div>
            <div className="text-sm italic">Note: "{WAREHOUSE_NOTE}"</div>
            <table className="w-full text-xs border border-black border-collapse">
              <thead>
                <tr>
                  {['Serial Number','Miner Model','PSU Number','Hashboard Serial','Work Order','Final Status','Dispatch Date','Location'].map((h) => (
                    <th key={h} className="border border-black px-1 py-1 text-left bg-gray-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dRows.map((r, i) => (
                  <tr key={i}>
                    <td className="border border-black px-1 py-1">{r.serialNumber}</td>
                    <td className="border border-black px-1 py-1">{r.minerModel}</td>
                    <td className="border border-black px-1 py-1">{r.psuNumber}</td>
                    <td className="border border-black px-1 py-1">{r.hashboardSerial}</td>
                    <td className="border border-black px-1 py-1">{r.workOrder}</td>
                    <td className="border border-black px-1 py-1">{r.finalStatus}</td>
                    <td className="border border-black px-1 py-1">{r.dispatchDate}</td>
                    <td className="border border-black px-1 py-1">{r.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
};

export default PrintingPage;
