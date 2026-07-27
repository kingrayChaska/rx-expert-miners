import type {
  Profile,
  UserRole,
  AppSettings,
  MasterDataRow,
  PassingByRow,
  DataRecord,
  Contact,
  MaintenanceName,
  MaintenanceRecord,
  ApprovedDevice,
} from "./database";

/**
 * Hand-written stand-in for the Supabase CLI's generated `Database` type.
 * Row-only (no Insert/Update variants) — good enough for typed `.from(...).select()`
 * calls without fighting strict generics everywhere. Once you have CLI access to
 * the real project, run:
 *   npx supabase gen types typescript --project-id <id> > src/types/supabase-generated.ts
 * and this file becomes redundant.
 */
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      user_roles: { Row: UserRole; Insert: Partial<UserRole>; Update: Partial<UserRole> };
      app_settings: { Row: AppSettings; Insert: Partial<AppSettings>; Update: Partial<AppSettings> };
      master_data: { Row: MasterDataRow; Insert: Partial<MasterDataRow>; Update: Partial<MasterDataRow> };
      passing_by: { Row: PassingByRow; Insert: Partial<PassingByRow>; Update: Partial<PassingByRow> };
      data_records: { Row: DataRecord; Insert: Partial<DataRecord>; Update: Partial<DataRecord> };
      contacts: { Row: Contact; Insert: Partial<Contact>; Update: Partial<Contact> };
      maintenance_names: { Row: MaintenanceName; Insert: Partial<MaintenanceName>; Update: Partial<MaintenanceName> };
      maintenance_records: { Row: MaintenanceRecord; Insert: Partial<MaintenanceRecord>; Update: Partial<MaintenanceRecord> };
      approved_devices: { Row: ApprovedDevice; Insert: Partial<ApprovedDevice>; Update: Partial<ApprovedDevice> };
    };
  };
}
