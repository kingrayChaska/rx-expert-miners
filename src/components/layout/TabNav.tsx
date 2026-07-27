import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Database, Settings as SettingsIcon, Users as UsersIcon, UserRound, Printer, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { cn } from "@/utils/cn";

const TABS: {
  to: string;
  end?: boolean;
  labelKey: TranslationKey;
  icon: typeof Database;
  admin?: boolean;
}[] = [
  { to: "/", end: true, labelKey: "masterData", icon: Database },
  { to: "/passing-by", labelKey: "passingBy", icon: UserRound },
  { to: "/printing", labelKey: "printing", icon: Printer },
  { to: "/data-bank", labelKey: "dataBank", icon: BarChart3 },
  { to: "/settings", labelKey: "settings", icon: SettingsIcon, admin: true },
  { to: "/users", labelKey: "users", icon: UsersIcon, admin: true },
];

const TabNav = () => {
  const { isAdmin, isOwner } = useAuth();
  const { t } = useLanguage();
  const canAdmin = isAdmin || isOwner;

  return (
    <nav className="mb-6 inline-flex items-center gap-1 p-1 rounded-xl bg-card border border-border/60 shadow-sm overflow-x-auto max-w-full">
      {TABS.filter((tab) => !tab.admin || canAdmin).map((tab) => {
        const Icon = tab.icon;
        const label = t(tab.labelKey);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end ?? false}
            className={({ isActive }) =>
              cn(
                "relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="active-tab-pill"
                    className="absolute inset-0 rounded-lg bg-primary shadow-sm"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};

export default TabNav;
