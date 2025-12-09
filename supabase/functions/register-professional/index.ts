import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan configuration (must match frontend)
const PLAN_CONFIG: Record<string, { maxProfessionals: number | null }> = {
  individual: { maxProfessionals: 1 },
  professional: { maxProfessionals: 3 },
  advanced: { maxProfessionals: 7 },
  enterprise: { maxProfessionals: null },
  custom: { maxProfessionals: null },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { businessSlug, name, email, password } = await req.json();

    // Validate required fields
    if (!businessSlug || !name || !email || !password) {
      return new Response(JSON.stringify({ error: "Faltan campos requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find business by slug
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id, name, plan_code, custom_max_professionals, is_active")
      .eq("public_slug", businessSlug)
      .maybeSingle();

    if (bizError || !business) {
      return new Response(JSON.stringify({ error: "Consultorio no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!business.is_active) {
      return new Response(JSON.stringify({ error: "Este consultorio no está activo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get plan limits
    const planCode = business.plan_code || "individual";
    let maxProfessionals: number | null = PLAN_CONFIG[planCode]?.maxProfessionals ?? 1;
    
    if (planCode === "custom") {
      maxProfessionals = business.custom_max_professionals ?? null;
    }

    // Count current professionals
    const { count: profCount } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id)
      .in("role", ["owner", "professional"]);

    const currentProfessionals = profCount || 0;

    // Check if can add more
    if (maxProfessionals !== null && currentProfessionals >= maxProfessionals) {
      return new Response(JSON.stringify({ 
        error: `Este consultorio ya alcanzó el máximo de ${maxProfessionals} profesional${maxProfessionals > 1 ? "es" : ""} para su plan actual. Consultá con el administrador del consultorio.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if email already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const emailExists = existingUser?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (emailExists) {
      return new Response(JSON.stringify({ 
        error: "Ya existe un usuario con ese email. Probá con otro email o iniciá sesión si ya tenés cuenta." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError || !newUser.user) {
      console.error("Error creating user:", createError);
      return new Response(JSON.stringify({ error: "Error al crear el usuario. Intentá de nuevo." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create profile
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: newUser.user.id,
        email,
        name,
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Don't fail, profile might be created by trigger
    }

    // Assign professional role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        business_id: business.id,
        role: "professional",
      });

    if (roleError) {
      console.error("Error creating role:", roleError);
      // Try to clean up user if role creation fails
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: "Error al asignar el rol. Intentá de nuevo." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      email: newUser.user.email,
      businessName: business.name,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});