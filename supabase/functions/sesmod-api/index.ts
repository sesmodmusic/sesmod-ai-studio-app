// SESMOD AI API - v0.2.0
// Authenticated gateway and secure generation-job enqueue endpoint.
// Heavy model inference runs on a separate trusted worker.
// Never put service-role keys or model credentials in the client.

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://sesmodmusic.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

  if (req.method !== "GET" && req.method !== "POST") {
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
  let userResponse: Response;
  try {
    userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "apikey": anonKey,
      },
    });
  } catch {
    return json({ ok: false, error: "authentication_service_unavailable" }, 503);
  }

  if (!userResponse.ok) {
    return json({ ok: false, error: "invalid_or_expired_session" }, 401);
  }

  const user = await userResponse.json();

  // GET remains the lightweight connection/health test used by the app.
  if (req.method === "GET") {
    return json({
      ok: true,
      service: "SESMOD AI API",
      version: "0.2.0",
      authenticated: true,
      user_id: user.id,
      modules: {
        music: { status: "queue_ready", credit_cost: 10, engine: "ACE-Step 1.5 candidate" },
        lyrics: { status: "queue_ready", credit_cost: 1 },
        image: { status: "queue_ready", credit_cost: 3 },
        video: { status: "queue_ready", credit_cost: 15 },
      },
      note: "Requests can be queued. Model inference worker is not connected yet.",
    });
  }

  let body: unknown;
  try {
    const rawBody = await req.text();
    if (rawBody.length > 40000) {
      return json({ ok: false, error: "request_too_large" }, 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "invalid_request_body" }, 400);
  }

  const data = body as Record<string, unknown>;
  const allowedCosts: Record<string, number> = {
    lyrics: 1,
    image: 3,
    music: 10,
    video: 15,
  };

  if (typeof data.module !== "string" || !(data.module in allowedCosts)) {
    return json({ ok: false, error: "invalid_module" }, 400);
  }

  const prompt = data.prompt === undefined ? "" : data.prompt;
  if (typeof prompt !== "string" || prompt.length > 10000) {
    return json({ ok: false, error: "invalid_prompt" }, 400);
  }

  const requestData = data.request_data === undefined ? {} : data.request_data;
  if (
    !requestData ||
    typeof requestData !== "object" ||
    Array.isArray(requestData)
  ) {
    return json({ ok: false, error: "invalid_request_data" }, 400);
  }

  // The database function determines the authoritative credit cost.
  // The client cannot provide user_id or credit_cost.
  let jobResponse: Response;
  try {
    jobResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/create_generation_job`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_module: data.module,
          p_prompt: prompt,
          p_request_data: requestData,
        }),
      },
    );
  } catch {
    return json({ ok: false, error: "queue_service_unavailable" }, 503);
  }

  if (!jobResponse.ok) {
    return json({ ok: false, error: "job_creation_failed" }, 400);
  }

  let jobId: unknown;
  try {
    jobId = await jobResponse.json();
  } catch {
    return json({ ok: false, error: "invalid_queue_response" }, 502);
  }

  return json({
    ok: true,
    queued: true,
    job_id: jobId,
    module: data.module,
    credit_cost: allowedCosts[data.module],
    status: "pending",
    charged: false,
    message: "İsteğiniz kuyruğa alındı. Gerçek AI üretimi için worker bağlantısı bekleniyor.",
  }, 202);
});
