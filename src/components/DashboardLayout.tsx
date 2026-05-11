import { useEffect, useState } from "react";
import { PremiumSidebar } from "@/components/PremiumSidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { SuperAdminVisitBanner } from "@/components/SuperAdminVisitBanner";
import { TrialBanner } from "@/components/TrialBanner";
import { useIsMobile } from "@/hooks/use-mobile";
import { DashboardBrandingProvider } from "@/contexts/DashboardBrandingContext";

const PROFESSIONAL_FIRST_SEEN_KEY = "pwa_install_pro_first_seen";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const isMobile = useIsMobile();
  const [firstSeen, setFirstSeen] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(PROFESSIONAL_FIRST_SEEN_KEY);
    if (stored) {
      setFirstSeen(stored);
    } else {
      const now = new Date().toISOString();
      localStorage.setItem(PROFESSIONAL_FIRST_SEEN_KEY, now);
      setFirstSeen(now);
    }
  }, []);

  return (
    <DashboardBrandingProvider>
      <div className="min-h-screen flex w-full relative">
        <PremiumSidebar />
        <main
          className="flex-1 min-w-0 flex flex-col"
          style={{
            marginLeft: isMobile ? 0 : 64,
          }}
        >
          <MobileHeader />
          <SuperAdminVisitBanner />
          {isMobile && firstSeen && (
            <PWAInstallBanner
              variant="sticky"
              storageKey="pwa_install_banner_dismissed_pro"
              firstSeenDate={firstSeen}
              visibleDays={7}
              autoOpenIOS
            />
          )}
          {children}
        </main>
      </div>
    </DashboardBrandingProvider>
  );
}
