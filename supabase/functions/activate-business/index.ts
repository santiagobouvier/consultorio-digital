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
    const businessName = pending.business_name;
    const planCode = pending.plan_code || "inicial";

    // Step 2: find or create the auth user
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
        name: businessName,
        email,
      });
    } else {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: businessName },
      });
      if (createError || !newUser?.user) {
        console.error("Error creating user:", createError);
        return json(500, { error: "No se pudo crear la cuenta: " + (createError?.message || "error desconocido") });
      }
      ownerId = newUser.user.id;
      await supabase.from("profiles").insert({
        id: ownerId,
        name: businessName,
        email,
      });
    }

    // Step 3: clean up orphan user_roles
    const { data: existingRoles } = await supabase
      .from("user_roles")
      .select("id, business_id, role")
      .eq("user_id", ownerId)
      .in("role", ["owner", "professional"]);

    if (existingRoles && existingRoles.length > 0) {
      const businessIds = existingRoles.map((r: any) => r.business_id).filter(Boolean);
      const { data: existingBusinesses } = await supabase
        .from("businesses")
        .select("id")
        .in("id", businessIds);
      const validIds = new Set((existingBusinesses || []).map((b: any) => b.id));
      const orphanRoleIds = existingRoles
        .filter((r: any) => r.business_id && !validIds.has(r.business_id))
        .map((r: any) => r.id);
      if (orphanRoleIds.length > 0) {
        await supabase.from("user_roles").delete().in("id", orphanRoleIds);
      }
    }

    // Step 4: create the business
    const slug = businessName.trim().toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") + "-" + Date.now().toString(36);

    const insertPayload: Record<string, unknown> = {
      name: businessName,
      owner_user_id: ownerId,
      public_slug: slug,
      contact_email: email,
      plan_code: planCode,
    };
    if (pending.custom_max_patients !== null && pending.custom_max_patients !== undefined) {
      insertPayload.custom_max_patients = pending.custom_max_patients;
    }
    if (pending.custom_max_professionals !== null && pending.custom_max_professionals !== undefined) {
      insertPayload.custom_max_professionals = pending.custom_max_professionals;
    }

    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .insert(insertPayload)
      .select()
      .single();

    if (bizError) {
      console.error("Error creating business:", bizError);
      return json(500, { error: "No se pudo crear el consultorio: " + bizError.message });
    }

    // Step 5: assign owner role
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", ownerId)
      .eq("business_id", business.id);

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: ownerId,
      role: "owner",
      business_id: business.id,
    });
    if (roleError) {
      console.error("Error creating owner role:", roleError);
    }

    // Step 6: mark the pending activation as used
    await supabase
      .from("pending_business_activations")
      .update({ used_at: new Date().toISOString() })
      .eq("id", pending.id);

    return json(200, {
      success: true,
      businessId: business.id,
      ownerEmail: email,
    });
  } catch (e) {
    console.error("activate-business error:", e);
    return json(500, { error: "Error interno: " + String(e) });
  }
});