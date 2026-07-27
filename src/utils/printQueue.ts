
import { normalizeSerial } from '@/utils/serial';

export type PrintReceiveItem = {
  id?: string;
  serialNumber: string;
  clientName?: string;
  minerModel?: string;
  psuSerial?: string;
  hbSerial?: string;
  location?: string;
  note?: string;
  entryData?: string;
};

export type PrintDispatchItem = {
  serialNumber: string;
  psuNumber?: string;
  hashboardSerial?: string;
  workOrder?: string;
  finalStatus?: string;
  dispatchDate?: string;
  location?: string;
  customerName?: string;
  minerModel?: string;
};

const RECEIVE_KEY = 'print_queue_receive_v1';
const DISPATCH_KEY = 'print_queue_dispatch_v1';

const hasText = (value: unknown) => String(value ?? '').trim() !== '';
const queueSerialKey = (value: unknown) => normalizeSerial(value).replace(/[^A-Z0-9]/g, '');

const mergeQueueItem = <T extends Record<string, any>>(current: T, incoming: T): T => {
  const next = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    if (hasText(value) || !hasText(next[key])) next[key as keyof T] = value as T[keyof T];
  }
  return next;
};

const cleanReceiveItem = (item: PrintReceiveItem): PrintReceiveItem => ({
  ...item,
  serialNumber: normalizeSerial(item.serialNumber),
  psuSerial: normalizeSerial(item.psuSerial),
  hbSerial: normalizeSerial(item.hbSerial),
});

const cleanDispatchItem = (item: PrintDispatchItem): PrintDispatchItem => ({
  ...item,
  serialNumber: normalizeSerial(item.serialNumber),
  psuNumber: normalizeSerial(item.psuNumber),
  hashboardSerial: normalizeSerial(item.hashboardSerial),
});

const receiveKey = (item: PrintReceiveItem) => {
  const serial = queueSerialKey(item.serialNumber);
  if (serial) return `serial:${serial}`;
  if (item.id) return `id:${item.id}`;
  const psu = queueSerialKey(item.psuSerial);
  if (psu) return `psu:${psu}`;
  const hb = queueSerialKey(item.hbSerial);
  if (hb) return `hb:${hb}`;
  return '';
};

const sameReceiveItem = (a: PrintReceiveItem, b: PrintReceiveItem) => {
  if (a.id && b.id && a.id === b.id) return true;
  const aSerial = queueSerialKey(a.serialNumber);
  const bSerial = queueSerialKey(b.serialNumber);
  if (aSerial && bSerial && aSerial === bSerial) return true;
  const aPsu = queueSerialKey(a.psuSerial);
  const bPsu = queueSerialKey(b.psuSerial);
  if (aPsu && bPsu && aPsu === bPsu) return true;
  const aHb = queueSerialKey(a.hbSerial);
  const bHb = queueSerialKey(b.hbSerial);
  return !!aHb && !!bHb && aHb === bHb;
};

export const normalizeReceiveQueue = (items: PrintReceiveItem[]) => {
  const out: PrintReceiveItem[] = [];
  const keyed = new Map<string, number>();

  for (const raw of items) {
    const item = cleanReceiveItem(raw);
    if (!Object.values(item).some(hasText)) continue;
    const key = receiveKey(item);
    const idx = key ? keyed.get(key) : -1;
    if (idx != null && idx >= 0) {
      out[idx] = mergeQueueItem(out[idx], item);
      continue;
    }
    const matchIdx = out.findIndex(existing => sameReceiveItem(existing, item));
    if (matchIdx >= 0) {
      out[matchIdx] = mergeQueueItem(out[matchIdx], item);
      if (key) keyed.set(key, matchIdx);
    } else {
      if (key) keyed.set(key, out.length);
      out.push(item);
    }
  }

  return out;
};

export const normalizeDispatchQueue = (items: PrintDispatchItem[]) => {
  const out: PrintDispatchItem[] = [];
  const keyed = new Map<string, number>();

  for (const raw of items) {
    const item = cleanDispatchItem(raw);
    if (!Object.values(item).some(hasText)) continue;
    const key = queueSerialKey(item.serialNumber);
    if (!key) {
      out.push(item);
      continue;
    }
    const idx = keyed.get(key);
    if (idx != null) out[idx] = mergeQueueItem(out[idx], item);
    else {
      keyed.set(key, out.length);
      out.push(item);
    }
  }

  return out;
};

const read = <T>(k: string): T[] => {
  try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; }
};
const write = <T>(k: string, v: T[]) => {
  localStorage.setItem(k, JSON.stringify(v));
  window.dispatchEvent(new CustomEvent('print-queue-changed', { detail: k }));
};

export const getReceiveQueue = () => normalizeReceiveQueue(read<PrintReceiveItem>(RECEIVE_KEY));
export const getDispatchQueue = () => normalizeDispatchQueue(read<PrintDispatchItem>(DISPATCH_KEY));

export const addReceiveItem = (item: PrintReceiveItem) => {
  write(RECEIVE_KEY, normalizeReceiveQueue([...read<PrintReceiveItem>(RECEIVE_KEY), item]));
};
export const addDispatchItem = (item: PrintDispatchItem) => {
  write(DISPATCH_KEY, normalizeDispatchQueue([...read<PrintDispatchItem>(DISPATCH_KEY), item]));
};

export const upsertReceiveItem = (item: PrintReceiveItem) => {
  if (!item.id && !item.serialNumber && !item.psuSerial && !item.hbSerial) return;
  const clean = cleanReceiveItem(item);
  const cur = normalizeReceiveQueue(read<PrintReceiveItem>(RECEIVE_KEY));
  const idx = cur.findIndex(c => sameReceiveItem(c, clean));
  if (idx >= 0) cur[idx] = mergeQueueItem(cur[idx], clean);
  else cur.push(clean);
  write(RECEIVE_KEY, normalizeReceiveQueue(cur));
};
export const upsertDispatchItem = (item: PrintDispatchItem) => {
  if (!item.serialNumber) return;
  const clean = cleanDispatchItem(item);
  const cur = normalizeDispatchQueue(read<PrintDispatchItem>(DISPATCH_KEY));
  const idx = cur.findIndex(c => queueSerialKey(c.serialNumber) === queueSerialKey(clean.serialNumber));
  if (idx >= 0) cur[idx] = mergeQueueItem(cur[idx], clean);
  else cur.push(clean);
  write(DISPATCH_KEY, normalizeDispatchQueue(cur));
};

export const setReceiveQueue = (items: PrintReceiveItem[]) => write(RECEIVE_KEY, normalizeReceiveQueue(items));
export const setDispatchQueue = (items: PrintDispatchItem[]) => write(DISPATCH_KEY, normalizeDispatchQueue(items));

export const clearReceiveQueue = () => write(RECEIVE_KEY, []);
export const clearDispatchQueue = () => write(DISPATCH_KEY, []);
