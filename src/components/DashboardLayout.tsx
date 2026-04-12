import { PremiumSidebar } from "@/components/PremiumSidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { DashboardBrandingProvider } from "@/contexts/DashboardBrandingContext";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const isMobile = useIsMobile();

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
          {children}
        </main>
      </div>
    </DashboardBrandingProvider>
  );
}
