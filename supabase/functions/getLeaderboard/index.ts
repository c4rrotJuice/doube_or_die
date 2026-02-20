import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: leaderboard, error: boardError } = await admin
    .from('public_leaderboard_view')
    .select('season_id, season_name, user_id, username, best_score, updated_at, has_crown')
    .limit(50);

  const { data: crown, error: crownError } = await admin
    .from('public_crown_view')
    .select('season_id, season_name, user_id, username, score, run_id, updated_at')
    .maybeSingle();

  if (boardError || crownError) {
    return new Response(JSON.stringify({ error: 'Failed to load leaderboard.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ leaderboard: leaderboard ?? [], crown: crown ?? null }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=15, s-maxage=30',
    },
  });
});
