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

    const { name, email, businessId, isNewOwner } = await req.json();

    if (!name) {
      return new Response(JSON.stringify({ error: "Missing required field: name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is super_admin
    const { data: superAdminRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    const isSuperAdmin = !!superAdminRole;

    // If businessId is provided, verify authorization
    if (businessId) {
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

      // Allow if super_admin or business owner
      if (!isSuperAdmin && business.owner_user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not authorized to invite professionals to this business" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (!isSuperAdmin) {
      // Only super_admin can create users without a business (for new owner creation)
      return new Response(JSON.stringify({ error: "Business ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already exists with this email (if email provided)
    let authUserId: string | null = null;
    
    if (email) {
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (existingUser) {
        authUserId = existingUser.id;
        
        // If businessId provided, check if already a member
        if (businessId) {
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
    } else {
      // No email provided - create a user with generated credentials
      const generatedEmail = `${crypto.randomUUID()}@generated.local`;
      const tempPassword = crypto.randomUUID() + crypto.randomUUID();
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: generatedEmail,
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

      // Create profile
      await supabase
        .from("profiles")
        .insert({
          id: authUserId,
          name,
          email: generatedEmail
        });
    }

    // If isNewOwner flag is set, return early - business will be created by the caller
    if (isNewOwner) {
      return new Response(JSON.stringify({ 
        success: true, 
        userId: authUserId
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user_role entry (only if businessId is provided)
    if (businessId) {
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

      // Generate invite token (only if email provided)
      if (email) {
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
          inviteId: invite.id,
          userId: authUserId
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId: authUserId
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
