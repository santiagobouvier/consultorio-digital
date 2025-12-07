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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, password, name } = await req.json();

    if (!token || !password) {
      return new Response(JSON.stringify({ error: "Missing required fields: token, password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the invite by token
    const { data: invite, error: inviteError } = await supabase
      .from("professional_portal_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Invitación no encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already used
    if (invite.used_at) {
      return new Response(JSON.stringify({ error: "Esta invitación ya fue utilizada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Esta invitación ha expirado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!invite.auth_user_id) {
      return new Response(JSON.stringify({ error: "No hay usuario asociado a esta invitación" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the user's password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      invite.auth_user_id,
      { 
        password,
        user_metadata: { 
          name: name || invite.name,
          pending_password_setup: false 
        }
      }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(JSON.stringify({ error: "Error al establecer la contraseña" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile name if provided
    if (name) {
      await supabase
        .from("profiles")
        .update({ name })
        .eq("id", invite.auth_user_id);
    }

    // Mark invite as used
    const { error: markUsedError } = await supabase
      .from("professional_portal_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    if (markUsedError) {
      console.error("Error marking invite as used:", markUsedError);
    }

    // Return email for login
    return new Response(JSON.stringify({ 
      success: true,
      email: invite.email
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
