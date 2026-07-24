# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single product: **Kidev Trading Bot** — a React + TypeScript (Vite) dashboard for a Binance paper-trading bot. The backend bot logic lives in a Supabase Edge Function (`supabase/functions/trading-bot`, Deno).

Standard commands are in `package.json` (`dev`, `build`, `preview`, `test`, `lint`) and `README.md`. Package manager is **npm** (`package-lock.json`). Dependencies are refreshed automatically by the startup update script, so you normally don't need to run `npm install` yourself.

Non-obvious notes:

- **Dev server**: `npm run dev` serves the dashboard on `http://localhost:5173` (Vite default, not overridden). Use a tmux-backed session for long-running processes.
- **Runs without secrets (Demo mode)**: With no `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, the app runs in "Demo" mode. The live BTC/USDT candlestick chart still works (it pulls public data from `https://data-api.binance.vision`), but the Trade History stays empty. This is the expected, fully-runnable local path. Egress to `data-api.binance.vision` must be reachable for the chart to populate.
- **Full mode**: Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (in `.env`, copy from `.env.example`) to enable live trade history + realtime updates. This requires a Supabase project with a `trades` table + realtime enabled. There is no `supabase/config.toml` or migrations in-repo, so local `supabase start` is not scaffolded.
- **Edge Function is Deno, not npm**: `supabase/functions/trading-bot/index.ts` runs under Deno via the Supabase CLI (`supabase functions serve trading-bot`), not through any npm script. It needs `BINANCE_API_KEY`, `BINANCE_SECRET_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as Supabase secrets to place testnet orders.
- **Lint caveat**: `npm run lint` currently exits non-zero due to a pre-existing `@typescript-eslint/no-explicit-any` error in `supabase/functions/trading-bot/index.ts` (the ESLint flat config lints the Deno edge function too). This is an existing code issue, not an environment problem — the frontend `src/` code lints clean.
- **Tests**: `npm test` runs Vitest (jsdom). Use `npm test -- --run` for a single non-watch run.
