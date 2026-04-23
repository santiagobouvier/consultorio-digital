import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Build a placeholder business name + slug from the email so the row is valid
// even before the owner completes the OnboardingWizard.
const buildPlaceholders = (email: string) => {
  const local = (email.split("@")[0] || "consultorio")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || "consultorio";
  // Add a short random suffix so concurrent activations never collide on slug.
  const suffix = Math.random().toString(36).slice(2, 8);
  const slug = `${local}-${suffix}`.slice(0, 48);
  return {
    name: "Consultorio (pendiente de configurar)",
    public_slug: slug,
    custom_subdomain: slug,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, password } = await req.json();

    if (!token || typeof token !== "string") {
      return json(400, { error: "Token requerido" });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return json(400, { error: "La contraseña debe tener al menos 8 caracteres" });
    }

    // Step 1: re-validate the token server-side (CRITICAL)
    const { data: pending, error: pendingError } = await supabase
      .from("pending_business_activations")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (pendingError) {
      console.error("Error fetching pending activation:", pendingError);
      return json(500, { error: "Error validando el token" });
    }
    if (!pending) {
      return json(404, { error: "Token inválido o no encontrado" });
    }
    if (pending.used_at) {
      return json(410, { error: "Este enlace ya fue utilizado" });
    }
    if (new Date(pending.expires_at) < new Date()) {
      return json(410, { error: "El enlace de activación ha expirado" });
    }

    const email = pending.owner_email;
    const planCode = pending.plan_code || "inicial";
    const customMaxProfessionals = pending.custom_max_professionals ?? null;
    const customMaxPatients = pending.custom_max_patients ?? null;

    // Step 2: find or create the auth user.
    const findAuthUserByEmail = async (targetEmail: string): Promise<string | null> => {
      let page = 1;
      const perPage = 1000;
      while (page <= 20) {
        const { data: authList, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage });
        if (listErr) {
          console.error("listUsers error on page", page, listErr);
          return null;
        }
        const users = authList?.users || [];
        const found = users.find((u: any) => u.email?.toLowerCase() === targetEmail);
        if (found) return found.id;
        if (users.length < perPage) return null;
        page++;
      }
      return null;
    };

    let ownerId: string;
    let createdAuthUser = false;
    const existingAuthUserId = await findAuthUserByEmail(email);

    if (existingAuthUserId) {
      ownerId = existingAuthUserId;
      const { error: updateError } = await supabase.auth.admin.updateUserById(ownerId, {
        password,
        email_confirm: true,
      });
      if (updateError) {
        console.error("Error updating existing user:", updateError);
        return json(500, { error: "No se pudo actualizar la cuenta existente: " + updateError.message });
      }
      await supabase.from("profiles").upsert({
        id: ownerId,
        name: email.split("@")[0],
        email,
      });
    } else {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: email.split("@")[0] },
      });
      if (createError || !newUser?.user) {
        console.error("Error creating user:", createError);
        return json(500, { error: "No se pudo crear la cuenta: " + (createError?.message || "error desconocido") });
      }
      ownerId = newUser.user.id;
      createdAuthUser = true;
      await supabase.from("profiles").insert({
        id: ownerId,
        name: email.split("@")[0],
        email,
      });
    }

    // Step 3: if this user already owns a business (e.g. they reopened a stale
    // link after a previous successful activation), we don't need to create it
    // again. We still mark the token as used so it cannot be reused.
    const { data: existingBusiness, error: existingBusinessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", ownerId)
      .maybeSingle();

    if (existingBusinessError) {
      console.error("Error checking existing business:", existingBusinessError);
      return json(500, { error: "Error verificando consultorio existente" });
    }

    let businessId: string;

    if (existingBusiness) {
      businessId = existingBusiness.id;
    } else {
      // Step 4: create the business with placeholder values. The wizard will
      // overwrite name / slug / subdomain / email afterwards.
      const placeholders = buildPlaceholders(email);
      const businessInsert: Record<string, unknown> = {
        owner_user_id: ownerId,
        name: placeholders.name,
        public_slug: placeholders.public_slug,
        custom_subdomain: placeholders.custom_subdomain,
        contact_email: email,
        plan_code: planCode,
        onboarding_completed: false,
      };
      if (planCode === "personalizado" || planCode === "custom") {
        businessInsert.custom_max_professionals = customMaxProfessionals;
        businessInsert.custom_max_patients = customMaxPatients;
      }

      const { data: newBusiness, error: businessError } = await supabase
        .from("businesses")
        .insert(businessInsert)
        .select("id")
        .single();

      if (businessError || !newBusiness) {
        console.error("Error creating business:", businessError);
        // Rollback: if we just created the auth user, remove it so the link
        // can be retried cleanly. If the user already existed, leave it alone.
        if (createdAuthUser) {
          await supabase.auth.admin.deleteUser(ownerId).catch(() => {});
          await supabase.from("profiles").delete().eq("id", ownerId).catch(() => {});
        }
        return json(500, {
          error: "No se pudo crear el consultorio: " + (businessError?.message || "error desconocido"),
        });
      }
      businessId = newBusiness.id;

      // Step 5: assign the 'owner' role to this user for the new business.
      // We do NOT touch any pre-existing role (e.g. 'patient' in another
      // business). A user can be patient in one clinic and owner of another.
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: ownerId,
          business_id: businessId,
          role: "owner",
        });

      if (roleError) {
        console.error("Error assigning owner role:", roleError);
        // Rollback the business + (optionally) the auth user we just created.
        await supabase.from("businesses").delete().eq("id", businessId).catch(() => {});
        if (createdAuthUser) {
          await supabase.auth.admin.deleteUser(ownerId).catch(() => {});
          await supabase.from("profiles").delete().eq("id", ownerId).catch(() => {});
        }
        return json(500, {
          error: "No se pudo asignar el rol de dueño: " + roleError.message,
        });
      }
    }

    // Step 6: only NOW we mark the activation token as used. If anything above
    // failed, the token remains valid so the user (or admin) can retry.
    await supabase
      .from("pending_business_activations")
      .update({ used_at: new Date().toISOString() })
      .eq("id", pending.id);

    return json(200, {
      success: true,
      ownerEmail: email,
      businessId,
      planCode,
      customMaxProfessionals,
      customMaxPatients,
    });
  } catch (e) {
    console.error("activate-business error:", e);
    return json(500, { error: "Error interno: " + String(e) });
  }
});