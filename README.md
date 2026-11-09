# Intrusive Thoughts

Get them out of your head. Intrusive Thoughts is a chat app for confronting the thoughts that won't leave you alone and arguing with them: a direct, philosophical AI that cites thinkers, challenges your assumptions, and doesn't hide behind hedging.

It's an AI to think out loud with, **not therapy or a crisis service**. If you might act on a thought to hurt yourself or someone else, contact local emergency services or find a free, confidential line at [findahelpline.com](https://findahelpline.com).

## Features

- **Interactive notebook home screen.** A lined-paper canvas where your cursor (or finger) leaves an ink trail that fades over time. Ink colours invert in dark mode.
- **Anonymous and private.** No sign-up. Each browser gets an anonymous identity (`Thinker-xxxx`) held in an httpOnly cookie, and conversations are only ever visible to the identity that wrote them.
- **Persistent conversations.** History is stored in Supabase and reloads across visits. You can branch a new thought off an earlier one, and the reply carries the original conversation as context.
- **Streaming replies.** Responses stream token by token from an OpenAI-compatible model (NVIDIA NIM `meta/llama-3.1-70b-instruct` by default) via LangChain and the Vercel AI SDK.
- **Safety guardrails.** The persona drops the edge when someone may be in danger, and crisis resources appear when a message mentions self-harm or harming someone. See [Safety](#safety).
- **Light and dark themes, mobile layout.** Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion and Lucide.

## Getting started

### 1. Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (the free tier is fine)
- An API key for an OpenAI-compatible model. The default is [NVIDIA NIM](https://build.nvidia.com) (`nvapi-...`).

### 2. Set up the database

In your Supabase project, open **SQL Editor**, paste in [`supabase/setup-database.sql`](supabase/setup-database.sql), and run it. The script is idempotent; re-run it after pulling changes to it.

### 3. Configure environment variables

Run the installer, which installs dependencies and writes `.env.local` for you:

```bash
./install.sh        # macOS / Linux
install.bat         # Windows
```

Or do it by hand: `npm install`, then `cp .env.example .env.local` and fill it in.

| Variable | Required | Where to find it |
|---|---|---|
| `NVIDIA_API_KEY` | yes | [build.nvidia.com](https://build.nvidia.com) → API key |
| `SUPABASE_URL` | yes | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SECRET_KEY` | yes | Supabase → Project Settings → API → **secret** key (`sb_secret_...`) or legacy `service_role` key |
| `NVIDIA_BASE_URL` | no | Any OpenAI-compatible endpoint. Default `https://integrate.api.nvidia.com/v1` |
| `NVIDIA_MODEL` | no | Model id for that endpoint. Default `meta/llama-3.1-70b-instruct` |

> **Keep `SUPABASE_SECRET_KEY` server-side.** It bypasses Row Level Security. Never prefix it with `NEXT_PUBLIC_`, commit it, or paste it into client code. The publishable/anon key isn't used at all.

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on the notebook; hit **BEGIN** to start a thought.

## Architecture

```
Browser ──(httpOnly session cookie)──▶ Next.js route handlers ──(secret key)──▶ Supabase Postgres
                                                  │
                                                  └──▶ OpenAI-compatible model (NVIDIA NIM)
```

- **The browser never talks to the database.** Every read and write goes through the API routes in `src/app/api/`, which scope each query to the user in the session cookie. In the database, RLS is enabled with no policies and table privileges are revoked from `anon`/`authenticated`, so the public keys can't read or write anything.
- **Sessions.** `POST /api/session` creates or resumes the anonymous identity (`src/lib/session.ts`). The cookie is httpOnly and SameSite=Lax, and its id is never returned by any API.
- **The server owns chat history.** The client sends only the new message. `/api/chat` loads the thread from the database (the conversation plus up to 4 parents it replies to), streams the reply, then stores the user and assistant messages together once the reply finishes. A failed turn stores nothing, so Retry is safe.
- **Rate limits.** 20 chat requests/minute per user and 10 new identities/hour per IP (`src/lib/rate-limit.ts`). The limiter is in-memory, so on serverless or multi-instance hosting it only limits per instance; swap in a shared store such as Upstash Redis if you need hard limits.

| Path | What it does |
|---|---|
| `src/app/api/chat/route.ts` | Model call, history assembly, persistence, safety reminder |
| `src/app/api/conversations/**` | List / create / rename / delete conversations; read messages |
| `src/app/api/session/route.ts` | Anonymous identity |
| `src/lib/prompts.ts` | System prompt and safety reminder |
| `src/lib/safety.ts` | Phrase matcher and crisis lines |
| `src/app/chat/ChatClient.tsx` | Chat UI (`useChat` from `@ai-sdk/react`) |
| `src/components/InteractiveHome.tsx` | Notebook canvas home page |
| `supabase/setup-database.sql` | Schema + access control |

## Safety

The app's name means people will bring thoughts that frighten them, so the prompt draws a line:

- **Unwanted intrusive thoughts** ("what if I jumped", "what if I hurt someone") are extremely common and aren't desires. The model says so plainly and keeps the conversation going, and it names reassurance-seeking loops rather than feeding them.
- **Intent, plans or present danger:** the persona steps aside, the reply is warm and direct, and it points to emergency services or a crisis line. It never debates whether someone should live, and never gives methods.

When a message matches `mentionsHarm()`, a reminder is added to that turn's system prompt and a card with crisis lines is shown under it. The matcher is deliberately broad: a false positive costs one card, and a miss could cost much more. If you deploy this somewhere specific, add your local lines to `CRISIS_LINES` in `src/lib/safety.ts`.

## License

This project is open-sourced under the [MIT License](LICENSE).
