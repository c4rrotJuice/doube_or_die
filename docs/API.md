# API contract

All endpoints are Supabase Edge Functions invoked via `/functions/v1/<name>`.
Auth required for `startRun` and `submitRun` (Bearer access token).

## `POST /functions/v1/startRun`
Issue a short-lived single-use run token for the active season.

### Request
```json
{}
```

### Response 200
```json
{
  "run_token": "uuid",
  "expires_at": "2026-01-01T00:00:00.000Z",
  "season_id": "uuid"
}
```

### Token schema (`public.run_tokens`)
- `token_id uuid`: server-issued run token (single use).
- `user_id uuid`: owner user id.
- `season_id uuid`: season binding.
- `server_nonce text`: random server-side nonce.
- `issued_at timestamptz`: token mint time.
- `expires_at timestamptz`: hard TTL (~2 min).
- `used boolean`: consumed flag.
- `consumed_at timestamptz`: first successful submit timestamp.

### Errors
- `401` missing/invalid auth
- `400` no active season
- `500` server configuration/database error

## `POST /functions/v1/submitRun`
Submit a completed run for verification and leaderboard updates.

### Request
```json
{
  "run_token": "uuid",
  "final_score": 6400,
  "doubles": 7,
  "duration_ms": 18250,
  "digest": "{\"v\":1,\"actions\":[...] }"
}
```

`digest` is a structured JSON string with action log and timing deltas.

### Response 200
```json
{
  "accepted": true,
  "new_best": true,
  "crown_stolen": false,
  "streak_count": 4,
  "streak_bonus_awarded": false,
  "crown_run_available_tomorrow": "2026-01-02T00:00:00.000Z"
}
```

### Validation checks
- Token is consumed via conditional update, rejecting reused tokens.
- Token owner must match authenticated user.
- Token must be unexpired.
- Score must match doubles (`score === 2^doubles`).
- Duration must be plausible (`duration_ms >= doubles * min_delta` and under max run time).
- Per-user submit rate limit enforced (`429` when exceeded).

### Errors
- `400` bad payload, expired/used token, invalid verification checks
- `401` missing/invalid auth
- `429` submit rate limit exceeded
- `500` write/verification failure

## `POST /functions/v1/getLeaderboard`
Return active-season leaderboard and crown snapshot.

### Request
```json
{}
```

### Response 200
```json
{
  "leaderboard": [
    {
      "season_id": "uuid",
      "season_name": "Season 1",
      "user_id": "uuid",
      "username": "player1",
      "best_score": 9000,
      "updated_at": "2026-01-01T00:00:00.000Z",
      "has_crown": true
    }
  ],
  "crown": {
    "season_id": "uuid",
    "season_name": "Season 1",
    "user_id": "uuid",
    "username": "player1",
    "score": 9000,
    "run_id": "uuid",
    "updated_at": "2026-01-01T00:00:00.000Z"
  }
}
```

### Errors
- `500` database or server configuration error


## Social engagement tables/views

### `public.crown_run_attempts`
- Enforces **1 crown run attempt per user per UTC day** via `(user_id, run_date)` primary key.
- Recorded from `submit_verified_run` before crown update logic.

### `public.user_cashout_streaks`
- Tracks `successful_cashouts`, `current_streak`, and `bonus_awards`.
- `submit_verified_run` increments on each verified cashout and awards a bonus each time `current_streak % 3 = 0`.

### `public.social_events` + `public_social_events_view`
- Stores lightweight feed events (currently `event_type='dethroned'`).
- Feed line format in UI: `"<actor> dethroned <target> at <score>"`.

### Share copy template
Client uses:
```text
I just cashed out at x<score> in Double or Die. <streak-line> <vibe-line> 👑
```
Where:
- `<streak-line>` is either streak progress or a 3-cashout bonus message.
- `<vibe-line>` is a deterministic vibe phrase selected from a small template list.
