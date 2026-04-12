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

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: superAdminRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!superAdminRole) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { businessName, ownerEmail, planCode, mode, password } = await req.json();

    if (!businessName || !ownerEmail) {
      return new Response(JSON.stringify({ error: "businessName and ownerEmail are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = ownerEmail.trim().toLowerCase();

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let ownerId: string;

    if (existingProfile) {
      // User already exists - just use them
      ownerId = existingProfile.id;
    } else if (mode === "test") {
      // TEST MODE: Create user with password, auto-confirmed
      if (!password || password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters for test mode" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: businessName }
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(JSON.stringify({ error: createError.message || "Error creating user" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      ownerId = newUser.user.id;

      await supabase.from("profiles").insert({
        id: ownerId,
        name: businessName,
        email,
      });
    } else {
      // INVITATION MODE: Create user with temp password, generate invite token
      const tempPassword = crypto.randomUUID() + crypto.randomUUID();
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: businessName, pending_password_setup: true }
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(JSON.stringify({ error: createError.message || "Error creating user" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      ownerId = newUser.user.id;

      await supabase.from("profiles").insert({
        id: ownerId,
        name: businessName,
        email,
      });
    }

    // Create the business
    const slug = businessName.trim().toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") + "-" + Date.now().toString(36);

    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .insert({
        name: businessName.trim(),
        owner_user_id: ownerId,
        public_slug: slug,
        contact_email: email,
        plan_code: planCode || "inicial",
      })
      .select()
      .single();

    if (bizError) {
      console.error("Error creating business:", bizError);
      return new Response(JSON.stringify({ error: bizError.message || "Error creating business" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign owner role
    await supabase.from("user_roles").insert({
      user_id: ownerId,
      role: "owner",
      business_id: business.id,
    });

    // For invitation mode with new users, generate an invite token
    let inviteToken: string | null = null;
    if (!existingProfile && mode === "invite") {
      inviteToken = crypto.randomUUID();
      await supabase.from("professional_portal_invites").insert({
        business_id: business.id,
        auth_user_id: ownerId,
        email,
        name: businessName.trim(),
        token: inviteToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      });
    }

    return new Response(JSON.stringify({
      success: true,
      businessId: business.id,
      ownerId,
      isExistingUser: !!existingProfile,
      inviteToken,
      mode: existingProfile ? "existing" : mode,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
