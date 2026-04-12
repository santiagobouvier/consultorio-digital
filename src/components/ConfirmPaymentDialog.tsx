import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CreditCard, Loader2, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  amount: number;
  onConfirm: () => Promise<void>;
}

type DialogState = "confirm" | "loading" | "success";

export function ConfirmPaymentDialog({
  open,
  onOpenChange,
  patientName,
  amount,
  onConfirm,
}: ConfirmPaymentDialogProps) {
  const [state, setState] = useState<DialogState>("confirm");

  const handleConfirm = async () => {
    setState("loading");
    try {
      await onConfirm();
      setState("success");
      setTimeout(() => {
        onOpenChange(false);
        setState("confirm");
      }, 1800);
    } catch {
      setState("confirm");
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (state === "loading") return;
    if (!isOpen) {
      onOpenChange(false);
      setTimeout(() => setState("confirm"), 200);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-sm rounded-2xl">
        {state === "success" ? (
          <div className="flex flex-col items-center justify-center py-6 animate-in zoom-in-50 fade-in duration-300">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-in zoom-in-0 duration-500" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-1">¡Pago registrado!</h3>
            <p className="text-muted-foreground text-center text-sm">
              ${amount.toLocaleString()} de {patientName}
            </p>
            <div className="mt-3 flex items-center gap-1 text-emerald-600">
              <PartyPopper className="w-4 h-4" />
              <span className="text-sm font-medium">Todo al día</span>
            </div>
          </div>
        ) : (
          <>
            <AlertDialogHeader>
              <div className="flex justify-center mb-2">
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center",
                  state === "loading"
                    ? "bg-primary/10"
                    : "bg-emerald-100 dark:bg-emerald-900/30"
                )}>
                  {state === "loading" ? (
                    <Loader2 className="w-7 h-7 text-primary animate-spin" />
                  ) : (
                    <CreditCard className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
              </div>
              <AlertDialogTitle className="text-center text-lg">
                {state === "loading" ? "Registrando pago..." : "¿Marcar como cobrado?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                {state === "loading" ? (
                  "Un momento por favor"
                ) : (
                  <>
                    Vas a registrar el cobro de{" "}
                    <span className="font-semibold text-foreground">
                      ${amount.toLocaleString()}
                    </span>{" "}
                    de{" "}
                    <span className="font-semibold text-foreground">{patientName}</span>.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {state === "confirm" && (
              <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-2">
                <AlertDialogCancel className="rounded-xl h-11 font-medium">
                  Cancelar
                </AlertDialogCancel>
                <Button
                  onClick={handleConfirm}
                  className="rounded-xl h-11 font-medium gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Sí, cobrar
                </Button>
              </AlertDialogFooter>
            )}
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
