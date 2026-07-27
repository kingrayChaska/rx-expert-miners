import type { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/layout/Header";

const AppShell = ({ children }: { children: ReactNode }) => {
  const { dir } = useLanguage();

  return (
    <div dir={dir} className="min-h-dvh flex flex-col bg-gradient-to-b from-background to-muted/20">
      <Header />
      <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
    </div>
  );
};

export default AppShell;
