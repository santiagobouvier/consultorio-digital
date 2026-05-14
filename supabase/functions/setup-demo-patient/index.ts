import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { patient_id, email, password } = await req.json();

    const { data: list } = await admin.auth.admin.listUsers();
    let user = list.users.find((u) => u.email === email);
    if (user) {
      await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name: "Paciente Demo" },
      });
      if (error) throw error;
      user = data.user!;
    }

    await admin.from("profiles").upsert({ id: user.id, email, name: "Paciente Demo" });
    await admin.from("patients").update({ auth_user_id: user.id, email }).eq("id", patient_id);
    await admin.from("user_roles").insert({ user_id: user.id, role: "patient" }).select();

    return new Response(JSON.stringify({ ok: true, email, user_id: user.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
