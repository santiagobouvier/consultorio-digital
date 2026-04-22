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
    const trimmedName = businessName.trim();

    // ──────────────────────────────────────────────────────────────────
    // INVITATION MODE: Create a pending activation + send activation email
    // The business is NOT created until the owner confirms and sets a password
    // ──────────────────────────────────────────────────────────────────
    if (mode === "invite") {
      // Warn if there's already an active business with this email
      const { data: existingProfileForCheck } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfileForCheck) {
        const { data: existingBusiness } = await supabase
          .from("businesses")
          .select("id, name")
          .eq("owner_user_id", existingProfileForCheck.id)
          .maybeSingle();
        if (existingBusiness) {
          return new Response(JSON.stringify({
            error: "El email ya tiene un consultorio asignado: " + existingBusiness.name,
          }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Clean up any previous unused pending activations for this email
      await supabase
        .from("pending_business_activations")
        .delete()
        .eq("owner_email", email)
        .is("used_at", null);

      // Generate secure activation token
      const activationToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: pending, error: pendingError } = await supabase
        .from("pending_business_activations")
        .insert({
          business_name: trimmedName,
          owner_email: email,
          plan_code: planCode || "inicial",
          token: activationToken,
          expires_at: expiresAt,
          created_by: user.id,
        })
        .select()
        .single();

      if (pendingError) {
        console.error("Error creating pending activation:", pendingError);
        return new Response(JSON.stringify({ error: pendingError.message || "Error creando la activación pendiente" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const origin = req.headers.get("origin") || "https://consultoriodigital.app";
      const activationUrl = `${origin}/activar-consultorio?token=${activationToken}`;

      // Send activation email via Resend
      let emailSent = false;
      let emailErrorDetails: string | null = null;
      try {
        const emailResp = await fetch(`${supabaseUrl}/functions/v1/send-resend-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            to: email,
            template: "raw",
            data: {
              subject: `Activá tu consultorio en Consultorio Digital`,
              message:
                `¡Hola!\n\n` +
                `Te damos la bienvenida a Consultorio Digital. Para activar el consultorio "${trimmedName}" ` +
                `y empezar a usarlo, hacé clic en el siguiente enlace y definí tu contraseña de acceso:\n\n` +
                `${activationUrl}\n\n` +
                `Este enlace es personal y vence en 7 días.\n\n` +
                `Si no esperabas este correo, podés ignorarlo.\n\n` +
                `— El equipo de Consultorio Digital`,
            },
          }),
        });
        emailSent = emailResp.ok;
        if (!emailResp.ok) {
          emailErrorDetails = await emailResp.text();
          console.error("Activation email failed:", emailErrorDetails);
        }
      } catch (e) {
        emailErrorDetails = String(e);
        console.error("Activation email exception:", e);
      }

      if (!emailSent) {
        await supabase
          .from("pending_business_activations")
          .delete()
          .eq("id", pending.id);

        return new Response(JSON.stringify({
          error: "email_send_failed",
          message: "No se pudo enviar el correo de activación. Verificá la dirección e intentá nuevamente.",
          details: emailErrorDetails,
        }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        mode: "invite",
        pendingActivationId: pending.id,
        activationUrl,
        expiresAt,
        sentTo: email,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper: find auth user by email by paginating through all pages
    const findAuthUserByEmail = async (targetEmail: string): Promise<string | null> => {
      let page = 1;
      const perPage = 1000;
      while (page <= 20) { // safety cap: 20k users
        const { data: authList, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage });
        if (listErr) {
          console.error("listUsers error on page", page, listErr);
          return null;
        }
        const users = authList?.users || [];
        const found = users.find((u: any) => u.email?.toLowerCase() === targetEmail);
        if (found) return found.id;
        if (users.length < perPage) return null; // last page reached
        page++;
      }
      return null;
    };

    // Check if user exists in profiles
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    // Also check auth.users (profile may be missing even if auth user exists)
    let existingAuthUserId: string | null = null;
    if (!existingProfile) {
      existingAuthUserId = await findAuthUserByEmail(email);
    }

    let ownerId: string;
    const userAlreadyExists = !!existingProfile || !!existingAuthUserId;

    if (existingProfile) {
      ownerId = existingProfile.id;
    } else if (existingAuthUserId) {
      // Auth user exists but no profile — create profile and reuse
      ownerId = existingAuthUserId;
      await supabase.from("profiles").insert({
        id: ownerId,
        name: businessName,
        email,
      });
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
        const msg = (createError.message || "").toLowerCase();
        if (msg.includes("already") && msg.includes("registered")) {
          const recoveredId = await findAuthUserByEmail(email);
          if (!recoveredId) {
            return new Response(JSON.stringify({ error: "El email ya está registrado pero no se pudo recuperar el usuario" }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          ownerId = recoveredId;
          await supabase.from("profiles").upsert({ id: ownerId, name: businessName, email });
        } else {
          console.error("Error creating user:", createError);
          return new Response(JSON.stringify({ error: createError.message || "Error creating user" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        ownerId = newUser.user.id;
        await supabase.from("profiles").insert({ id: ownerId, name: businessName, email });
      }
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
        const msg = (createError.message || "").toLowerCase();
        if (msg.includes("already") && msg.includes("registered")) {
          const recoveredId = await findAuthUserByEmail(email);
          if (!recoveredId) {
            return new Response(JSON.stringify({ error: "El email ya está registrado pero no se pudo recuperar el usuario" }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          ownerId = recoveredId;
          await supabase.from("profiles").upsert({ id: ownerId, name: businessName, email });
        } else {
          console.error("Error creating user:", createError);
          return new Response(JSON.stringify({ error: createError.message || "Error creating user" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        ownerId = newUser.user.id;
        await supabase.from("profiles").insert({ id: ownerId, name: businessName, email });
      }
    }

    // Clean up orphan user_roles (roles pointing to businesses that no longer exist)
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
        console.log(`Cleaned ${orphanRoleIds.length} orphan user_roles for ${ownerId}`);
      }
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

    // Assign owner role (use upsert-style: delete duplicates first)
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", ownerId)
      .eq("business_id", business.id);

    await supabase.from("user_roles").insert({
      user_id: ownerId,
      role: "owner",
      business_id: business.id,
    });

    // For invitation mode with new users, generate an invite token
    let inviteToken: string | null = null;
    if (!userAlreadyExists && mode === "invite") {
      inviteToken = crypto.randomUUID();
      await supabase.from("professional_portal_invites").insert({
        business_id: business.id,
        auth_user_id: ownerId,
        email,
        name: businessName.trim(),
        token: inviteToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return new Response(JSON.stringify({
      success: true,
      businessId: business.id,
      ownerId,
      isExistingUser: userAlreadyExists,
      inviteToken,
      mode: userAlreadyExists ? "existing" : mode,
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
