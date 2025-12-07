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
    
    // Get the authorization header to validate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller is authenticated
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user: callerUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { patientId } = await req.json();
    
    if (!patientId) {
      return new Response(
        JSON.stringify({ error: "Patient ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch patient data and verify ownership
    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("id, full_name, email, auth_user_id, business_id, businesses!inner(owner_user_id)")
      .eq("id", patientId)
      .single();

    if (patientError || !patient) {
      return new Response(
        JSON.stringify({ error: "Patient not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify that the caller owns this patient's business
    const businessData = patient.businesses as unknown as { owner_user_id: string };
    if (businessData.owner_user_id !== callerUser.id) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to invite this patient" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let authUserId = patient.auth_user_id;

    // If patient doesn't have an auth user, check if one exists with that email first
    if (!authUserId && patient.email) {
      // Check if a user already exists with this email
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        u => u.email?.toLowerCase() === patient.email?.toLowerCase()
      );

      if (existingUser) {
        // Use existing user
        authUserId = existingUser.id;
        console.log(`Found existing user for email ${patient.email}: ${authUserId}`);

        // Update patient with auth_user_id
        await supabaseAdmin
          .from("patients")
          .update({ auth_user_id: authUserId })
          .eq("id", patientId);

        // Check if patient role already exists
        const { data: existingRole } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", authUserId)
          .eq("role", "patient")
          .maybeSingle();

        if (!existingRole) {
          await supabaseAdmin
            .from("user_roles")
            .insert({
              user_id: authUserId,
              role: "patient",
            });
        }
      }
    }

    // If still no auth user, create one
    if (!authUserId) {
      // Generate a placeholder email if patient doesn't have one
      const patientEmail = patient.email || `patient-${patientId}@portal.interno`;
      
      // Generate a random temporary password (patient will set their own via the invite link)
      const tempPassword = crypto.randomUUID() + crypto.randomUUID();

      // Create auth user
      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: patientEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: patient.full_name,
          is_patient: true,
        },
      });

      if (createUserError) {
        console.error("Error creating auth user:", createUserError);
        return new Response(
          JSON.stringify({ error: "Failed to create user account: " + createUserError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      authUserId = newUser.user.id;

      // Update patient with auth_user_id
      const { error: updatePatientError } = await supabaseAdmin
        .from("patients")
        .update({ auth_user_id: authUserId })
        .eq("id", patientId);

      if (updatePatientError) {
        console.error("Error updating patient:", updatePatientError);
      }

      // Create patient role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: authUserId,
          role: "patient",
        });

      if (roleError) {
        console.error("Error creating user role:", roleError);
      }
    }

    // Generate a secure token
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    
    // Create the invite record
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("patient_portal_invites")
      .insert({
        patient_id: patientId,
        auth_user_id: authUserId,
        token: token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invite:", inviteError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        token: invite.token,
        expiresAt: invite.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in create-patient-invite:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
