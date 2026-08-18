# ReproFlow Dashboard

Next.js (App Router) web dashboard implementing Phase 1 of `docs/ARCHITECTURE.md`:
login, signup, organisation switcher, and project list/create. Later phases add
the report list/detail, sharing, exports, and integration settings pages in the
same route layout.

## How auth works here

The browser never sees the refresh token. `src/app/api/auth/*` route handlers run
on the Next.js server and are the only code that reads/writes the httpOnly
`reproflow_refresh_token` cookie; they proxy to the ReproFlow API
(`API_URL`). The access token they hand back lives only in React state
(`src/lib/auth-context.tsx`) for the life of the tab — on reload, the app calls
`/api/auth/refresh` once to silently re-establish the session from the cookie.
See `docs/ARCHITECTURE.md` §10.

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Requires the backend running at the URL in `.env.local` (`backend/README.md`).

Open http://localhost:3000/signup to create the first account + organisation.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (also typechecks + lints) |
| `npm run start` | Serve a production build |
| `npm run lint` | ESLint |

## What's implemented (Phase 1)

- `/login`, `/signup` — call the backend via the server-side BFF routes.
- `/[org]/projects` — organisation switcher, project list, create-project dialog
  (gated to admin/owner, matching the backend's own role check).
- Every data view has loading, error (with retry), and empty states — see
  `src/app/(app)/[org]/projects/page.tsx` for the pattern later pages follow.
