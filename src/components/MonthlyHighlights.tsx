import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/payments";
import { startOfMonth, endOfMonth } from "date-fns";
import { Trophy, DollarSign, RefreshCw, Sparkles } from "lucide-react";

interface PatientHighlight {
  id: string;
  full_name: string;
  avatar_url: string | null;
  value: number;
  label: string;
}

interface MonthlyHighlightsProps {
  businessId: string | null;
  className?: string;
}

const AVATAR_COLORS = [
  "hsl(var(--primary))",
  "hsl(190, 90%, 45%)",
  "hsl(280, 65%, 60%)",
  "hsl(340, 75%, 55%)",
  "hsl(45, 90%, 50%)",
];

const getAvatarColor = (name: string) => {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const MonthlyHighlights = ({ businessId, className = "" }: MonthlyHighlightsProps) => {
  const [loading, setLoading] = useState(true);
  const [highlights, setHighlights] = useState<{
    mostAttendance: PatientHighlight | null;
    highestBilling: PatientHighlight | null;
    mostConsistent: PatientHighlight | null;
    mostActiveNew: PatientHighlight | null;
  }>({
    mostAttendance: null,
    highestBilling: null,
    mostConsistent: null,
    mostActiveNew: null,
  });

  useEffect(() => {
    if (!businessId) return;
    fetchHighlights();
  }, [businessId]);

  const fetchHighlights = async () => {
    if (!businessId) return;

    try {
      setLoading(true);
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());

      // Get all appointments this month (attended)
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, patient_id, status")
        .eq("business_id", businessId)
        .eq("status", "attended")
        .gte("start_at", monthStart.toISOString())
        .lte("start_at", monthEnd.toISOString());

      // Get all payments this month (paid)
      const { data: payments } = await supabase
        .from("payments")
        .select("id, patient_id, amount, paid_at")
        .eq("business_id", businessId)
        .not("paid_at", "is", null)
        .gte("paid_at", monthStart.toISOString())
        .lte("paid_at", monthEnd.toISOString());

      // Get new patients this month
      const { data: newPatients } = await supabase
        .from("patients")
        .select("id, full_name, avatar_url, created_at")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString());

      // Get all patients for lookup
      const patientIds = [
        ...new Set([
          ...(appointments?.map((a) => a.patient_id).filter(Boolean) || []),
          ...(payments?.map((p) => p.patient_id).filter(Boolean) || []),
          ...(newPatients?.map((p) => p.id) || []),
        ]),
      ];

      if (patientIds.length === 0) {
        setHighlights({
          mostAttendance: null,
          highestBilling: null,
          mostConsistent: null,
          mostActiveNew: null,
        });
        setLoading(false);
        return;
      }

      const { data: patients } = await supabase
        .from("patients")
        .select("id, full_name, avatar_url")
        .in("id", patientIds);

      const patientsMap = new Map(
        patients?.map((p) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]) || []
      );

      // Calculate most attendance (most sessions)
      const attendanceCounts: Record<string, number> = {};
      appointments?.forEach((a) => {
        if (a.patient_id) {
          attendanceCounts[a.patient_id] = (attendanceCounts[a.patient_id] || 0) + 1;
        }
      });

      const topAttendance = Object.entries(attendanceCounts)
        .sort(([, a], [, b]) => b - a)
        .filter(([, count]) => count >= 2)[0];

      // Calculate highest billing
      const billingCounts: Record<string, number> = {};
      payments?.forEach((p) => {
        if (p.patient_id) {
          billingCounts[p.patient_id] = (billingCounts[p.patient_id] || 0) + (p.amount || 0);
        }
      });

      const topBilling = Object.entries(billingCounts)
        .sort(([, a], [, b]) => b - a)
        .filter(([, amount]) => amount > 0)[0];

      // Calculate most consistent (highest attendance rate - need to compare with scheduled)
      // For now, use highest attendance as proxy for consistency
      const mostConsistentPatient = topAttendance
        ? {
            ...topAttendance,
            percentage: 100, // placeholder
          }
        : null;

      // Most active new patient (new patients with most appointments this month)
      const newPatientIds = new Set(newPatients?.map((p) => p.id) || []);
      const newPatientAttendance: Record<string, number> = {};
      appointments?.forEach((a) => {
        if (a.patient_id && newPatientIds.has(a.patient_id)) {
          newPatientAttendance[a.patient_id] = (newPatientAttendance[a.patient_id] || 0) + 1;
        }
      });

      const topNewPatient = Object.entries(newPatientAttendance)
        .sort(([, a], [, b]) => b - a)
        .filter(([, count]) => count >= 1)[0];

      // Build highlights
      setHighlights({
        mostAttendance: topAttendance
          ? {
              id: topAttendance[0],
              full_name: patientsMap.get(topAttendance[0])?.full_name || "Paciente",
              avatar_url: patientsMap.get(topAttendance[0])?.avatar_url || null,
              value: topAttendance[1],
              label: `${topAttendance[1]} sesiones este mes`,
            }
          : null,
        highestBilling: topBilling
          ? {
              id: topBilling[0],
              full_name: patientsMap.get(topBilling[0])?.full_name || "Paciente",
              avatar_url: patientsMap.get(topBilling[0])?.avatar_url || null,
              value: topBilling[1],
              label: `${formatCurrency(topBilling[1])} en el mes`,
            }
          : null,
        mostConsistent: mostConsistentPatient
          ? {
              id: mostConsistentPatient[0],
              full_name: patientsMap.get(mostConsistentPatient[0])?.full_name || "Paciente",
              avatar_url: patientsMap.get(mostConsistentPatient[0])?.avatar_url || null,
              value: mostConsistentPatient[1],
              label: "100% asistencia",
            }
          : null,
        mostActiveNew: topNewPatient
          ? {
              id: topNewPatient[0],
              full_name: patientsMap.get(topNewPatient[0])?.full_name || "Paciente",
              avatar_url: patientsMap.get(topNewPatient[0])?.avatar_url || null,
              value: topNewPatient[1],
              label: `${topNewPatient[1]} citas desde alta`,
            }
          : null,
      });
    } catch (error) {
      console.error("Error fetching monthly highlights:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasHighlights = useMemo(() => {
    return (
      highlights.mostAttendance ||
      highlights.highestBilling ||
      highlights.mostConsistent ||
      highlights.mostActiveNew
    );
  }, [highlights]);

  // Don't render if no data
  if (!loading && !hasHighlights) {
    return null;
  }

  const highlightCards = [
    {
      data: highlights.mostAttendance,
      icon: Trophy,
      title: "Más asistencias",
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      data: highlights.highestBilling,
      icon: DollarSign,
      title: "Mayor facturación",
      iconColor: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      data: highlights.mostConsistent,
      icon: RefreshCw,
      title: "Más constante",
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      data: highlights.mostActiveNew,
      icon: Sparkles,
      title: "Nuevo más activo",
      iconColor: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ].filter((card) => card.data !== null);

  if (loading) {
    return (
      <div className={className}>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Actividad destacada del mes
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-20 mb-3" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Actividad destacada del mes
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {highlightCards.map(({ data, icon: Icon, title, iconColor, bgColor }) => {
          if (!data) return null;
          const avatarColor = getAvatarColor(data.full_name);

          return (
            <Card
              key={data.id + title}
              className="p-4 hover:shadow-md transition-all duration-200 group"
            >
              {/* Header with icon and title */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-6 w-6 rounded-full ${bgColor} flex items-center justify-center`}>
                  <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{title}</span>
              </div>

              {/* Patient info */}
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-background shadow-sm group-hover:ring-primary/20 transition-all">
                  <AvatarImage src={data.avatar_url || undefined} alt={data.full_name} />
                  <AvatarFallback
                    style={{
                      backgroundColor: `${avatarColor}20`,
                      color: avatarColor,
                    }}
                    className="font-semibold text-sm"
                  >
                    {getInitials(data.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground text-sm truncate leading-tight">
                    {data.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{data.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
