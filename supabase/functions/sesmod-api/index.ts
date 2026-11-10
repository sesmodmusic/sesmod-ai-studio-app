// SESMOD AI API - v0.1.0
// Authenticated gateway only. Heavy model inference will run on a separate worker.
// Do not put service-role keys or model credentials in the client.

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://sesmodmusic.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Vary": "Origin",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    return json({ ok: false, error: "authentication_required" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    return json({ ok: false, error: "server_configuration_missing" }, 500);
  }

  // Validate the user's Supabase access token. Never trust a user_id sent by the client.
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "apikey": anonKey,
    },
  });

  if (!userResponse.ok) {
    return json({ ok: false, error: "invalid_or_expired_session" }, 401);
  }

  const user = await userResponse.json();

  return json({
    ok: true,
    service: "SESMOD AI API",
    version: "0.1.0",
    authenticated: true,
    user_id: user.id,
    modules: {
      music: { status: "planned", engine: "ACE-Step 1.5 candidate" },
      lyrics: { status: "planned" },
      image: { status: "planned" },
      video: { status: "planned" },
    },
    note: "Gateway is online. Model inference is not connected yet.",
  });
});
