import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const planNames: Record<string, string> = {
  individual: "Consultorio Individual",
  profesional: "Consultorio Profesional",
  avanzada: "Clínica Avanzada",
};

const PlanPayment = () => {
  const { planId } = useParams<{ planId: string }>();
  const planName = planId ? planNames[planId] || "Plan seleccionado" : "Plan seleccionado";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 py-12">
      <div
        className="w-full max-w-md p-8 rounded-2xl border border-white/10"
        style={{ backgroundColor: "#111111" }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>

        <h1 className="text-2xl font-bold mb-2">{planName}</h1>
        <p className="text-gray-500 mb-8">
          El sistema de pago estará disponible próximamente.
        </p>

        <div
          className="p-6 rounded-xl mb-6"
          style={{ backgroundColor: "rgba(0, 199, 138, 0.1)" }}
        >
          <p className="text-sm text-gray-300 text-center">
            Para contratar este plan, contactanos por WhatsApp y te ayudamos con el proceso.
          </p>
        </div>

        <a
          href="https://api.whatsapp.com/send?phone=59891093977&text=Hola%2C+me+interesa+contratar+el+plan+de+gesti%C3%B3n+de+consultorio."
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Button
            className="w-full h-12 font-semibold rounded-xl transition-all duration-300"
            style={{
              backgroundColor: "#00c78a",
              boxShadow: "0 4px 20px rgba(0, 199, 138, 0.3)",
            }}
          >
            Contactar por WhatsApp
          </Button>
        </a>
      </div>
    </div>
  );
};

export default PlanPayment;
