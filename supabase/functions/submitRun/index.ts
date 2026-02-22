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

const MAX_DIGEST_BYTES = 16_000;
const MIN_ACTION_DELTA_MS = 60;
const MAX_DURATION_MS = 2 * 60 * 1000;
const MAX_SUBMITS_PER_MINUTE = 20;

function isPowerOfTwoScore(score: number, doubles: number) {
  if (!Number.isInteger(score) || !Number.isInteger(doubles) || doubles < 0 || score < 1) {
    return false;
  }

  const expected = 2 ** doubles;
  return Number.isSafeInteger(expected) && score === expected;
}

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
  if (
    !payload.run_token
    || payload.final_score == null
    || payload.doubles == null
    || payload.duration_ms == null
    || !payload.digest
  ) {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (
    !Number.isInteger(payload.final_score)
    || !Number.isInteger(payload.doubles)
    || !Number.isInteger(payload.duration_ms)
    || payload.digest.length > MAX_DIGEST_BYTES
  ) {
    return new Response(JSON.stringify({ accepted: false, error: 'Invalid metric types.' }), {
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

  const { count: recentSubmitCount, error: rateError } = await admin
    .from('runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString());

  if (rateError) {
    return new Response(JSON.stringify({ accepted: false, error: 'Rate-limit check failed.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if ((recentSubmitCount ?? 0) >= MAX_SUBMITS_PER_MINUTE) {
    return new Response(JSON.stringify({ accepted: false, error: 'Rate limit exceeded. Try again shortly.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const minimumExpectedDuration = payload.doubles * MIN_ACTION_DELTA_MS;
  if (
    payload.duration_ms < minimumExpectedDuration
    || payload.duration_ms > MAX_DURATION_MS
    || !isPowerOfTwoScore(payload.final_score, payload.doubles)
  ) {
    return new Response(JSON.stringify({ accepted: false, error: 'Run verification failed.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const nowIso = new Date().toISOString();
  const { data: tokenRows, error: useError } = await admin
    .from('run_tokens')
    .update({ used: true, consumed_at: nowIso })
    .eq('token_id', payload.run_token)
    .eq('user_id', userId)
    .eq('used', false)
    .gt('expires_at', nowIso)
    .select('token_id, season_id')
    .limit(1);

  if (useError || !tokenRows?.length) {
    return new Response(JSON.stringify({ accepted: false, error: 'Invalid, expired, or reused run token.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const tokenRow = tokenRows[0];

  const { data: submitResult, error: submitError } = await admin.rpc('submit_verified_run', {
    p_user_id: userId,
    p_season_id: tokenRow.season_id,
    p_score: payload.final_score,
    p_doubles: payload.doubles,
    p_duration_ms: payload.duration_ms,
    p_digest: payload.digest,
  });

  if (submitError || !submitResult?.length) {
    return new Response(JSON.stringify({ accepted: false, error: 'Failed to persist verified run.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const result = submitResult[0];

  return new Response(JSON.stringify({ accepted: true, new_best: result.new_best, crown_stolen: result.crown_stolen }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
