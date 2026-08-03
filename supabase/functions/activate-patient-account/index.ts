import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { token, password } = await req.json();
    
    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: "Token and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the token
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("patient_portal_invites")
      .select("id, patient_id, auth_user_id, expires_at, used_at")
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ error: "Invalid invitation token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already used
    if (invite.used_at) {
      return new Response(
        JSON.stringify({ error: "This invitation has already been used" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This invitation has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the auth user's email
    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(invite.auth_user_id);
    
    if (authUserError || !authUser.user) {
      return new Response(
        JSON.stringify({ error: "User account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      invite.auth_user_id,
      { password: password }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      // Supabase rechaza contraseñas filtradas/conocidas (AuthWeakPasswordError).
      // Devolvemos 200 con `error` para que el paciente vea el motivo real y
      // pueda elegir otra — un 4xx/5xx llega al front como mensaje genérico.
      const errText = String((updateError as { message?: string }).message || "").toLowerCase();
      const isWeak =
        (updateError as { code?: string }).code === "weak_password" ||
        errText.includes("weak") || errText.includes("easy to guess");
      return new Response(
        JSON.stringify({
          error: isWeak
            ? "Esa contraseña es demasiado común y fácil de adivinar. Elegí una más única: combiná palabras, números o símbolos (ej: Camila.2026)."
            : "No se pudo establecer la contraseña. Intentá de nuevo en unos minutos.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Link the auth user to the patient record so portal queries
    // (which filter by auth_user_id) find them. Without this, the portal
    // loads empty even though the patient invite is valid.
    const { error: linkError } = await supabaseAdmin
      .from("patients")
      .update({ auth_user_id: invite.auth_user_id })
      .eq("id", invite.patient_id);

    if (linkError) {
      console.error("Error linking auth_user_id to patient:", linkError);
    }

    // Fetch the business slug so the frontend can redirect the patient
    // to their branded portal at /portal/:slug.
    let portalSlug: string | null = null;
    const { data: patientRow } = await supabaseAdmin
      .from("patients")
      .select("business_id")
      .eq("id", invite.patient_id)
      .single();

    if (patientRow?.business_id) {
      const { data: businessRow } = await supabaseAdmin
        .from("businesses")
        .select("public_slug")
        .eq("id", patientRow.business_id)
        .single();
      portalSlug = businessRow?.public_slug ?? null;
    }

    // Mark invite as used
    await supabaseAdmin
      .from("patient_portal_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    // Sign in the user and return the session
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: authUser.user.email!,
      password: password,
    });

    if (signInError) {
      // Password was set but login failed - patient can try manually
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Account activated. Please log in with your new password.",
          email: authUser.user.email,
          slug: portalSlug,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        session: signInData.session,
        email: authUser.user.email,
        slug: portalSlug,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in activate-patient-account:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
