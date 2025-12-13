import { lazy } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const DesktopCommandCenter = lazy(() => 
  import("@/components/desktop/DesktopCommandCenter").then(m => ({ default: m.DesktopCommandCenter }))
);
const CalendarV2Mobile = lazy(() => import("./CalendarV2"));

const CommandCenter = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <CalendarV2Mobile />;
  }

  return <DesktopCommandCenter />;
};

export default CommandCenter;
