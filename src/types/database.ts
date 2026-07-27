// Hand-authored from supabase/migrations/*.sql (the exported project had no
// generated types.ts, so these are derived directly from the real schema —
// not guessed). Keep in sync if you change a migration.

export type AppRole = "owner" | "admin" | "user" | "viewer";

export interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface AppSettings {
  id: string;
  app_name: string | null;
  app_image_url: string | null;
}

export interface MasterDataRow {
  id: string;
  receiving_date: string | null;
  customer_type: string | null;
  client_name: string | null;
  miner_model_and_type: string | null;
  serial_number: string | null;
  psu_serial_number: string | null;
  hash_board_serial_number: string | null;
  receiving_location: string | null;
  warranty_status: string | null;
  column_10: string | null;
  work_order: string | null;
  client_approval: string | null;
  repair_status: string | null;
  aging_status: string | null;
  quotation_sent: string | null;
  final_status: string | null;
  payment: string | null;
  ready_for_dispatch: string | null;
  dispatch_status: string | null;
  dispatch_date: string | null;
  dispatch_location: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PassingByRow {
  id: string;
  date: string | null;
  serial_number: string | null;
  model: string | null;
  name: string | null;
  location: string | null;
  note: string | null;
  comment: string | null;
  dispatch_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataRecord {
  id: string;
  [key: string]: unknown;
}

export interface Contact {
  id: string;
  name: string | null;
  address: string | null;
  [key: string]: unknown;
}

export interface MaintenanceName {
  id: string;
  name: string;
}

export interface MaintenanceRecord {
  id: string;
  serial_number: string | null;
  model: string | null;
  [key: string]: unknown;
}

export interface ApprovedDevice {
  id: string;
  serial_number: string | null;
  model: string | null;
  approved_by: string | null;
  [key: string]: unknown;
}

/** Loose row shape used by the spreadsheet-like grids (Master Data / Passing By). */
export type Row = Record<string, any>;
