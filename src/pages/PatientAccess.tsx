import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolvePatientAccess } from "@/lib/patient-access";
import logoWhite from "@/assets/logo-consultorio-digital-white.png";

const BRAND = "#00a5a0";
const BRAND_GLOW = "rgba(0, 165, 160, 0.15)";
const GREEN = "#00c78a";

interface Clinic {
  slug: string;
  name: string;
  specialty: string | null;
  logo_url: string | null;
}

const PatientAccess = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [clinics, setClinics] = useState<Clinic[] | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Primero se verifica la identidad (email + contraseña) y recién con la
  // sesión se piden SUS consultorios: un email solo no revela nada. El portal
  // respeta la sesión abierta, así que el paciente entra directo.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setNotFound(false);
    setClinics(null);
    setLoginError(null);

    try {
      const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError || !signIn.session) {
        // 400 = credenciales inválidas; cualquier otra cosa es conexión/servidor
        setLoginError(
          !signInError || signInError.status === 400
            ? "El email o la contraseña no son correctos."
            : "No pudimos verificar tu cuenta. Probá de nuevo en unos minutos.",
        );
        return;
      }

      // El email va solo por compatibilidad con la versión anterior de la
      // función mientras se despliega; la nueva lo ignora y usa la sesión.
      const { data, error } = await supabase.functions.invoke("public-patient-lookup", {
        body: { email: signIn.session.user.email },
      });
      if (error) throw error;

      const results: Clinic[] = data?.clinics ?? [];
      const next = resolvePatientAccess(results);
      if (next.kind === "redirect") {
        navigate(next.path);
      } else if (next.kind === "choose") {
        setClinics(results);
      } else {
        await supabase.auth.signOut();
        setNotFound(true);
      }
    } catch (err) {
      console.error("Lookup error:", err);
      setLoginError("No pudimos verificar tu cuenta. Probá de nuevo en unos minutos.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtherAccount = async () => {
    await supabase.auth.signOut();
    setClinics(null);
    setNotFound(false);
    setPassword("");
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white overflow-x-hidden flex flex-col items-center justify-center px-4 py-12 relative">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "140%",
            height: "60%",
            background: `radial-gradient(ellipse 80% 50% at 50% 50%, ${BRAND_GLOW}, transparent)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "15%",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 165, 160, 0.06), transparent 70%)",
            animation: "orbFloat1 20s ease-in-out infinite",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "40%",
            right: "10%",
            width: "350px",
            height: "350px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 199, 138, 0.05), transparent 70%)",
            animation: "orbFloat2 25s ease-in-out infinite",
            filter: "blur(50px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(0,165,160,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,165,160,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage:
              "linear-gradient(to bottom, transparent, rgba(0,0,0,0.5) 20%, rgba(0,0,0,0.5) 80%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent, rgba(0,0,0,0.5) 20%, rgba(0,0,0,0.5) 80%, transparent)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-md">
        {/* Back link */}
        <Link
          to="/acceso"
          className="self-start flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors text-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>

        {/* Logo */}
        <img
          src={logoWhite}
          alt="Tu Consultorio Digital"
          className="h-16 sm:h-20 w-auto mb-8"
          style={{ animation: "logoFloat 6s ease-in-out infinite" }}
        />

        <h1
          className="text-2xl sm:text-3xl font-bold mb-2 text-center"
          style={{ animation: "fadeSlideUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}
        >
          Ingresá como paciente
        </h1>
        <p
          className="text-gray-400 text-sm mb-8 text-center"
          style={{ animation: "fadeSlideUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}
        >
          Ingresá con el email y la contraseña de tu cuenta de paciente
        </p>

        {/* Form */}
        {!clinics && (
          <form
            onSubmit={handleSubmit}
            className="w-full space-y-4"
            style={{ animation: "fadeSlideUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.35s both" }}
          >
            <Input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-12 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#00a5a0]/50 focus:ring-[#00a5a0]/20"
            />
            <Input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              aria-label="Contraseña"
              className="h-12 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#00a5a0]/50 focus:ring-[#00a5a0]/20"
            />
            <Button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full h-12 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: `linear-gradient(135deg, ${BRAND}, ${GREEN})`,
                boxShadow: `0 4px 20px rgba(0, 165, 160, 0.35)`,
              }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Ingresar"
              )}
            </Button>

            <p className="text-xs text-center text-gray-500">
              ¿No tenés acceso? Contactá a tu profesional.
            </p>

            {loginError && (
              <div role="alert" className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                <p className="text-gray-300 text-sm mb-1">{loginError}</p>
                <p className="text-gray-500 text-xs">
                  Si todavía no creaste tu contraseña, usá el link del mail de invitación de tu profesional.
                </p>
              </div>
            )}

            {notFound && (
              <div role="alert" className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                <p className="text-gray-300 text-sm mb-1">
                  Esta cuenta no tiene un portal de paciente.
                </p>
                <p className="text-gray-500 text-xs">
                  Pedile a tu profesional que te envíe la invitación. Si sos profesional,{" "}
                  <Link to="/auth" className="underline hover:text-gray-300">ingresá desde acá</Link>.
                </p>
              </div>
            )}
          </form>
        )}

        {/* Clinic selection */}
        {clinics && clinics.length > 1 && (
          <div
            className="w-full space-y-3"
            style={{ animation: "fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both" }}
          >
            <p className="text-gray-400 text-sm text-center mb-4">
              Tenés portal en varios consultorios. ¿A cuál querés ingresar?
            </p>
            {clinics.map((clinic) => (
              <button
                key={clinic.slug}
                onClick={() => navigate(`/portal/${clinic.slug}`)}
                className="w-full rounded-2xl p-5 border border-white/10 backdrop-blur-md text-left transition-all duration-300 hover:border-[#00a5a0]/40 group"
                style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 30px rgba(0,165,160,0.2)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div className="flex items-center gap-4">
                  {clinic.logo_url ? (
                    <img
                      src={clinic.logo_url}
                      alt={clinic.name}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                      style={{ backgroundColor: "rgba(0,165,160,0.15)", color: BRAND }}
                    >
                      {clinic.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{clinic.name}</p>
                    {clinic.specialty && (
                      <p className="text-xs text-gray-500">{clinic.specialty}</p>
                    )}
                  </div>
                  <ArrowLeft className="w-4 h-4 text-gray-600 rotate-180 group-hover:text-[#00a5a0] transition-colors" />
                </div>
              </button>
            ))}
            <button
              onClick={() => void handleOtherAccount()}
              className="text-gray-500 text-sm hover:text-gray-300 transition-colors mx-auto block mt-4"
            >
              Ingresar con otra cuenta
            </button>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(60px, 40px); }
          50% { transform: translate(-30px, 80px); }
          75% { transform: translate(-60px, 20px); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-50px, 60px); }
          50% { transform: translate(40px, -30px); }
          75% { transform: translate(70px, 40px); }
        }
      `}</style>
    </div>
  );
};

export default PatientAccess;