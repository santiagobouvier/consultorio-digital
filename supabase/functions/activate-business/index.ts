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

    // Step 2: find or create the auth user.
    // IMPORTANT: We do NOT create a business here. The owner will define
    // all the clinic data through the OnboardingWizard after logging in.
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
      await supabase.from("profiles").insert({
        id: ownerId,
        name: email.split("@")[0],
        email,
      });
    }

    // Step 3: mark the pending activation as used
    await supabase
      .from("pending_business_activations")
      .update({ used_at: new Date().toISOString() })
      .eq("id", pending.id);

    return json(200, {
      success: true,
      ownerEmail: email,
      // Carry the planCode so the wizard can apply it when creating the business.
      planCode: pending.plan_code || "inicial",
      customMaxProfessionals: pending.custom_max_professionals ?? null,
      customMaxPatients: pending.custom_max_patients ?? null,
    });
  } catch (e) {
    console.error("activate-business error:", e);
    return json(500, { error: "Error interno: " + String(e) });
  }
});