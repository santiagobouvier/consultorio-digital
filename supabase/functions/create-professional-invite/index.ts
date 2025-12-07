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

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the current user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, email, businessId } = await req.json();

    if (!name || !email || !businessId) {
      return new Response(JSON.stringify({ error: "Missing required fields: name, email, businessId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user is the owner of this business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, owner_user_id")
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      return new Response(JSON.stringify({ error: "Business not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (business.owner_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not authorized to invite professionals to this business" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already exists with this email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let authUserId: string | null = null;
    
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (existingUser) {
      authUserId = existingUser.id;
      
      // Check if already a member of this business
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", authUserId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (existingRole) {
        return new Response(JSON.stringify({ error: "Este usuario ya es miembro del consultorio" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Create a new user without password (they'll set it when accepting the invite)
      const tempPassword = crypto.randomUUID() + crypto.randomUUID();
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name, pending_password_setup: true }
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(JSON.stringify({ error: "Error creating user account" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      authUserId = newUser.user.id;

      // Create profile for the new user
      await supabase
        .from("profiles")
        .insert({
          id: authUserId,
          name,
          email
        });
    }

    // Create user_role entry
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: authUserId,
        role: "professional",
        business_id: businessId
      });

    if (roleError) {
      console.error("Error creating role:", roleError);
      return new Response(JSON.stringify({ error: "Error assigning role" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate invite token
    const token_invite = crypto.randomUUID();

    // Create professional invite
    const { data: invite, error: inviteError } = await supabase
      .from("professional_portal_invites")
      .insert({
        business_id: businessId,
        auth_user_id: authUserId,
        email,
        name,
        token: token_invite,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invite:", inviteError);
      return new Response(JSON.stringify({ error: "Error creating invitation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      token: token_invite,
      inviteId: invite.id
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
