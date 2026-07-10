// Demo de la reserva online: renderiza la pantalla REAL (PublicBooking) en modo
// demo (horarios de ejemplo, envío simulado, nada se guarda) con el banner arriba.
import { DemoBanner } from "@/components/demo/DemoBanner";
import PublicBooking from "./PublicBooking";

const DemoReservar = () => (
  <>
    <DemoBanner />
    <PublicBooking demo />
  </>
);

export default DemoReservar;
