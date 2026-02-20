# API contract (stubs)

All endpoints are Supabase Edge Functions invoked via `/functions/v1/<name>`.
Auth required for `startRun` and `submitRun` (Bearer access token).

## `POST /functions/v1/startRun`
Issue a short-lived run token for the active season.

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
  "digest": "sha256:..."
}
```

### Response 200
```json
{
  "accepted": true,
  "new_best": true,
  "crown_stolen": false
}
```

### Errors
- `400` bad payload, expired/used token, invalid metrics
- `401` missing/invalid auth
- `500` write or verification failure

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
