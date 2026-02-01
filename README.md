# Resume AI Chatbot (Phase 1)

A conversational AI app that helps users capture and organize their professional info (work history, projects, skills) through a natural chat experience. The AI feels like a curious podcast host — casual but substantive. All gathered data is stored in Supabase and shown in a live notes panel; users can also view and edit their profile directly.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, shadcn-style UI, Lucide React
- **Backend**: Next.js API Routes (Vercel serverless)
- **AI**: Claude Sonnet 4.5 via Anthropic API (`claude-sonnet-4-5-20250929`)
- **Chat**: Vercel AI SDK (`@ai-sdk/react`, `ai`, `@ai-sdk/anthropic`)
- **Database & Auth**: Supabase (PostgreSQL + Auth)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and set:

- `ANTHROPIC_API_KEY` — from [Anthropic](https://console.anthropic.com/)
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase project settings
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project settings
- `SUPABASE_SERVICE_ROLE_KEY` (optional) — for server-side admin use

### 3. Supabase setup

1. Create a [Supabase](https://supabase.com) project.
2. In the SQL Editor, run the schema in `supabase/schema.sql` to create tables and RLS policies.
3. In Authentication → Providers, enable Email.
4. (Optional) For live notes updates, enable Realtime for `profiles`, `work_experience`, and `projects` in Database → Replication.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up, then go to **Chat** to talk to the AI. The right-hand **Live notes** panel updates as the conversation is parsed into profile, work experience, and projects.

### Anthropic 403 "Request not allowed"

If chat fails with a **403 Forbidden** from Anthropic:

1. **API key** — In [Anthropic Console](https://console.anthropic.com/) → API Keys, create or copy a key. Put it in `.env.local` as `ANTHROPIC_API_KEY=` (no quotes). Restart the dev server.
2. **Key restrictions** — If the key has IP or product restrictions, allow your environment (e.g. localhost or your Vercel domain).
3. **Account / model** — Ensure your account has access to the Messages API and to `claude-sonnet-4-5-20250929` (or switch the app to a model you have access to).

## Features

- **Split-screen chat**: Chat on the left, live notes on the right.
- **Conversation storage**: Messages are saved in Supabase per session.
- **Structured extraction**: The AI emits `resume-json` blocks (profile, work_experience, project); the API parses them and upserts into Supabase.
- **Session summary**: When you click **End chat**, the AI generates a short summary of what was captured and what’s still missing.
- **Profile editor**: `/profile` lets you view and edit profile, work experience, and projects directly.
- **Life Story mode**: Toggle for deeper, interview-style questions (e.g. career path, pivotal moments).

## Deploy on Vercel

1. **Push to GitHub**
   - Create a repo on [GitHub](https://github.com/new) (e.g. `resume-ai-chatbot`).
   - In your project folder:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
     git push -u origin main
     ```

2. **Import on Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in (use GitHub).
   - Click **Add New** → **Project**.
   - Import your GitHub repo. Leave **Framework Preset** as Next.js and **Root Directory** blank.
   - Click **Deploy** (it may fail until env vars are set).

3. **Add environment variables**
   - In the Vercel project, go to **Settings** → **Environment Variables**.
   - Add (use the same values as in `.env.local`):
     | Name | Value |
     |------|--------|
     | `ANTHROPIC_API_KEY` | Your Anthropic API key |
     | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
   - Optional: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_CHAT_MODEL`.
   - Enable for **Production**, **Preview**, and **Development** if you use preview branches.

4. **Redeploy**
   - Go to **Deployments** → open the three dots on the latest deployment → **Redeploy** (so the new env vars are used).
   - After the build finishes, open the deployment URL. Sign up and use the app.

## Project structure

- `app/` — App Router pages and API routes (`/chat`, `/profile`, `/api/chat`, `/api/session`, etc.)
- `components/` — `ChatInterface`, `NotesPanel`, `ProfileEditor`, and `ui/` (Button, Card, Input, etc.)
- `lib/` — Supabase clients, chat system prompt, extraction and upsert helpers
- `types/` — TypeScript types for DB and extracted data
- `supabase/schema.sql` — Table definitions and RLS

## Success criteria (Phase 1)

- [x] Users can sign up, log in, and start a chat
- [x] Chat feels natural and engaging (podcast-host tone)
- [x] Live notes panel updates as the user talks (and via Realtime if enabled)
- [x] Data is extracted and stored in Supabase
- [x] Users can view and edit profile/database on `/profile`
- [x] Session summaries when the user ends a chat
- [x] App builds and is ready to deploy on Vercel
