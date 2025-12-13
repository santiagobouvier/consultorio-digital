import { Calendar, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface QuickActionSheetProps {
  open: boolean;
  onClose: () => void;
  onCreateAppointment: () => void;
  onCreatePayment: () => void;
}

export const QuickActionSheet = ({
  open,
  onClose,
  onCreateAppointment,
  onCreatePayment,
}: QuickActionSheetProps) => {
  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="pb-8">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-left">¿Qué querés agregar?</DrawerTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="p-4 space-y-3">
          {/* Create Appointment */}
          <Button
            variant="outline"
            className="w-full h-16 rounded-2xl justify-start gap-4 text-left"
            onClick={() => {
              onClose();
              onCreateAppointment();
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-base">Crear cita</p>
              <p className="text-sm text-muted-foreground">Agendar una nueva consulta</p>
            </div>
          </Button>

          {/* Create Payment */}
          <Button
            variant="outline"
            className="w-full h-16 rounded-2xl justify-start gap-4 text-left"
            onClick={() => {
              onClose();
              onCreatePayment();
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CreditCard className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-base">Registrar pago</p>
              <p className="text-sm text-muted-foreground">Cobro realizado o pendiente</p>
            </div>
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
