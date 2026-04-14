import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const demoEmail = 'demo@consultorio.app';
    const demoPassword = Deno.env.get('DEMO_USER_PASSWORD');
    const demoName = 'Usuario Demo';

    if (!demoPassword) {
      return new Response(
        JSON.stringify({ error: 'DEMO_USER_PASSWORD secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if demo business exists
    const { data: demoBusiness, error: bizError } = await supabaseAdmin
      .from('businesses')
      .select('id, name')
      .eq('is_demo', true)
      .single();

    if (bizError || !demoBusiness) {
      console.error('Demo business not found:', bizError);
      return new Response(
        JSON.stringify({ error: 'No se encontró el consultorio demo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found demo business:', demoBusiness.name);

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === demoEmail);

    let userId: string;

    if (existingUser) {
      console.log('Demo user already exists, updating password...');
      userId = existingUser.id;
      
      // Update password
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: demoPassword
      });
    } else {
      console.log('Creating new demo user...');
      
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: demoEmail,
        password: demoPassword,
        email_confirm: true,
        user_metadata: { name: demoName }
      });

      if (createError || !newUser.user) {
        console.error('Error creating user:', createError);
        return new Response(
          JSON.stringify({ error: 'Error al crear usuario: ' + createError?.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.user.id;
      console.log('Created user with ID:', userId);

      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email: demoEmail,
          name: demoName
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
      }
    }

    // Check if user_role already exists for this user and business
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('business_id', demoBusiness.id)
      .single();

    if (!existingRole) {
      // Create user_role as owner of demo business
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userId,
          business_id: demoBusiness.id,
          role: 'owner'
        });

      if (roleError) {
        console.error('Error creating role:', roleError);
      } else {
        console.log('Created owner role for demo user');
      }
    } else {
      console.log('User role already exists');
    }

    // Update business owner if needed
    const { error: updateBizError } = await supabaseAdmin
      .from('businesses')
      .update({ owner_user_id: userId })
      .eq('id', demoBusiness.id);

    if (updateBizError) {
      console.error('Error updating business owner:', updateBizError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Usuario demo configurado correctamente',
        credentials: {
          email: demoEmail,
          password: demoPassword
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Error inesperado: ' + errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
