import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/shared/LanguageToggle";
import { supabase } from "@/services/supabase";
import { LogOut, Shield, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import rxLogo from "@/assets/rx-logo.asset.json";
import { toast } from "sonner";
import { getDispatchQueue, setDispatchQueue } from "@/utils/printQueue";

const Header = () => {
  const { user, signOut, isAdmin, isOwner } = useAuth();
  const { t } = useLanguage();
  const [appName, setAppName] = useState("");
  const [appImageUrl, setAppImageUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("app_name, app_image_url")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setAppName(data.app_name || "");
          setAppImageUrl(data.app_image_url || (rxLogo as any).url);
        }
      });
  }, []);

  const handleLogoClick = async () => {
    // Pull ready-for-dispatch devices from master_data and copy to clipboard + print queue
    try {
      const { data, error } = await supabase
        .from("master_data")
        .select(
          "serial_number,psu_serial_number,hash_board_serial_number,work_order,final_status,dispatch_date,dispatch_location,client_name,miner_model_and_type,ready_for_dispatch",
        )
        .eq("ready_for_dispatch", "Yes")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) {
        toast.info("No ready-for-dispatch devices");
        return;
      }
      const existing = getDispatchQueue();
      const seen = new Set(existing.map((e) => e.serialNumber).filter(Boolean));
      const merged = [...existing];
      for (const r of rows as any[]) {
        const sn = String(r.serial_number || "").trim();
        if (!sn || seen.has(sn)) continue;
        seen.add(sn);
        merged.push({
          serialNumber: sn,
          psuNumber: r.psu_serial_number || "",
          hashboardSerial: r.hash_board_serial_number || "",
          workOrder: r.work_order || "",
          finalStatus: r.final_status || "",
          dispatchDate: r.dispatch_date || "",
          location: r.dispatch_location || "",
          customerName: r.client_name || "",
        });
      }
      setDispatchQueue(merged);
      const text = rows
        .map((r: any) =>
          [
            r.serial_number,
            r.psu_serial_number,
            r.hash_board_serial_number,
            r.work_order,
            r.final_status,
            r.dispatch_date,
            r.dispatch_location,
          ]
            .filter(Boolean)
            .join("\t"),
        )
        .join("\n");
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        /* clipboard best-effort */
      }
      toast.success(`${rows.length} ready devices → Printing › Dispatch`);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  return (
    <header className="h-16 border-b border-border/60 bg-card/80 backdrop-blur-xl flex items-center px-4 md:px-6 gap-3 sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleLogoClick}
          title="Copy ready-for-dispatch devices for printing"
          className="h-10 w-10 rounded-lg overflow-hidden ring-1 ring-border/60 bg-card hover:ring-primary transition"
        >
          <img
            src={appImageUrl || (rxLogo as any).url}
            alt="RX Expert Miners"
            className="h-full w-full object-contain"
          />
        </button>
        <div className="flex flex-col leading-tight">
          <span
            className="font-bold text-foreground text-base tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {appName || t("appName")}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground hidden sm:block">
            RX Expert Miners
          </span>
        </div>
      </div>
      <div className="flex-1" />
      <LanguageToggle />
      {user && (
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 border border-border/60">
          {isOwner || isAdmin ? (
            <Shield className="h-3.5 w-3.5 text-primary" />
          ) : (
            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-xs font-medium text-foreground max-w-[180px] truncate">{user.email}</span>
        </div>
      )}
      <Button variant="ghost" size="icon" onClick={signOut} title={t("signOut")} aria-label={t("signOut")}>
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
};

export default Header;
