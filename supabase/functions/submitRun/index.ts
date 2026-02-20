import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SubmitPayload = {
  run_token?: string;
  final_score?: number;
  doubles?: number;
  duration_ms?: number;
  digest?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing server environment variables.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const payload = (await req.json().catch(() => ({}))) as SubmitPayload;
  if (!payload.run_token || payload.final_score == null || payload.doubles == null || payload.duration_ms == null || !payload.digest) {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const bearer = authHeader.replace('Bearer ', '').trim();
  const { data: userData, error: userError } = await admin.auth.getUser(bearer);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Invalid auth token.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = userData.user.id;

  const { data: tokenRow, error: tokenError } = await admin
    .from('run_tokens')
    .select('token_id, user_id, season_id, expires_at, used')
    .eq('token_id', payload.run_token)
    .maybeSingle();

  if (tokenError || !tokenRow || tokenRow.user_id !== userId || tokenRow.used) {
    return new Response(JSON.stringify({ accepted: false, error: 'Invalid or used run token.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return new Response(JSON.stringify({ accepted: false, error: 'Run token expired.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // TODO(anti-cheat): replace basic checks with deterministic run replay verification.
  if (payload.final_score < 0 || payload.doubles < 0 || payload.duration_ms < 0) {
    return new Response(JSON.stringify({ accepted: false, error: 'Invalid metrics.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { error: useError } = await admin.from('run_tokens').update({ used: true }).eq('token_id', tokenRow.token_id);
  if (useError) {
    return new Response(JSON.stringify({ accepted: false, error: 'Failed to consume token.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: runRow, error: runError } = await admin
    .from('runs')
    .insert({
      user_id: userId,
      season_id: tokenRow.season_id,
      score: payload.final_score,
      doubles: payload.doubles,
      duration_ms: payload.duration_ms,
      digest: payload.digest,
      is_valid: true,
    })
    .select('id, score')
    .single();

  if (runError || !runRow) {
    return new Response(JSON.stringify({ accepted: false, error: 'Failed to write run.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: currentBoard } = await admin
    .from('leaderboard')
    .select('best_score')
    .eq('season_id', tokenRow.season_id)
    .eq('user_id', userId)
    .maybeSingle();

  const newBest = !currentBoard || runRow.score > currentBoard.best_score;

  if (newBest) {
    await admin.from('leaderboard').upsert({
      season_id: tokenRow.season_id,
      user_id: userId,
      best_score: runRow.score,
      best_run_id: runRow.id,
      updated_at: new Date().toISOString(),
    });
  }

  const { data: crownRow } = await admin
    .from('crown')
    .select('score, user_id')
    .eq('season_id', tokenRow.season_id)
    .maybeSingle();

  const crownStolen = Boolean(!crownRow || runRow.score > crownRow.score);

  if (crownStolen) {
    await admin.from('crown').upsert({
      season_id: tokenRow.season_id,
      user_id: userId,
      score: runRow.score,
      run_id: runRow.id,
      updated_at: new Date().toISOString(),
    });
  }

  return new Response(JSON.stringify({ accepted: true, new_best: newBest, crown_stolen: crownStolen }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
