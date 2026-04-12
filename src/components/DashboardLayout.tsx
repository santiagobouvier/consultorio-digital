import { PremiumSidebar } from "@/components/PremiumSidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen flex w-full relative">
      {/* Desktop: Premium sidebar with mini + expandable */}
      <PremiumSidebar />

      {/* Main content area */}
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
  );
}