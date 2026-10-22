# AuraStudy

AuraStudy is an AI-assisted study workspace for managing course materials, asking questions about documents, creating quizzes and flashcards, and tracking study progress.

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Cjayze/AuraStudyy)

The Render Blueprint in `render.yaml` configures the Express app, production build, health check, and persistent storage for local records and uploaded documents. Push this file to GitHub before using the button. Render will ask you to supply the Gemini and Supabase environment values in its dashboard; never put their secrets in `render.yaml`.

This Blueprint uses a paid Render web service because free web services do not support persistent disks. Apply `drizzle/0001_flashcards.sql` to the configured PostgreSQL database before using Flashcard with PostgreSQL synchronization.

## Features

- **Document library:** Upload and organize study documents. The Express service extracts text from PDF, DOCX, PPTX, and plain-text formats and stores document chunks for AI features.
- **Aura AI assistant:** Ask questions about your study materials and request document summaries.
- **Quizzes:** Generate quizzes from library documents, take them, and review results.
- **Flashcards:** Create card sets manually or generate a preview from a library document with Gemini. Edit cards before saving, study with a 3D flip interaction, mark cards as learning or known, and keep per-user review progress.
- **Dashboard:** View learning activity and quiz results.
- **Accounts:** Register or sign in with email and password. Google sign-in is available through Supabase Auth when configured.

## Technology

- React 19, TypeScript, Vite, and Tailwind CSS for the web app.
- Express and TypeScript for the main application server and API.
- JWT sessions for AuraStudy API requests; Supabase Auth can provide Google sign-in.
- Google Gemini for document chat, summaries, quizzes, and AI flashcard generation.
- The main Express application stores application records in `data/db.json` and uploaded files in `uploads/`. When PostgreSQL is configured, it also synchronizes records to PostgreSQL.
- `backend/` is a separate, optional FastAPI service using MySQL. The root npm scripts do not start it.

## Requirements

- Node.js 20 or newer and npm.
- PostgreSQL/Supabase connection settings for database-backed account registration and PostgreSQL synchronization.
- A Gemini API key for AI generation and document assistance.
- Supabase Auth and Google OAuth configuration only if you want Google sign-in.

## Run the main application

Clone this repository and install the dependencies:

```bash
git clone https://github.com/Cjayze/AuraStudyy.git
cd AuraStudyy
npm ci
```

Copy the root environment template:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux, use `cp .env.example .env` instead. Set the values you need in `.env`:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-side key for Gemini features, including AI flashcard generation. |
| `JWT_SECRET` | Secret used to sign AuraStudy API tokens. Use a long, random value outside local development. |
| `SUPABASE_HOST` | PostgreSQL host. When set, provide the database password too. |
| `SUPABASE_PORT` | PostgreSQL port; defaults to `5432`. |
| `SUPABASE_USER` | PostgreSQL user; defaults to `postgres`. |
| `SUPABASE_DATABASE` | PostgreSQL database; defaults to `postgres`. |
| `SUPABASE_PASSWORD` | PostgreSQL password. `SUPABASE_DB_PASSWORD` is also accepted. |
| `SUPABASE_URL` | Supabase project URL used to verify Google sign-in sessions. |
| `SUPABASE_ANON_KEY` | Supabase publishable/anonymous key used by the server for Google sign-in. |
| `VITE_SUPABASE_URL` | Supabase project URL exposed to the browser for OAuth. |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anonymous key exposed to the browser for OAuth. |

The server also supports `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, and `SQL_DB_NAME` as a PostgreSQL connection fallback. Drizzle migration tooling reads `SQL_HOST`, `SQL_DB_NAME`, `SQL_ADMIN_USER`, and `SQL_ADMIN_PASSWORD` from the root `.env`.

Never put a database password, JWT secret, Gemini key, or Supabase service-role key in a `VITE_` variable. Do not commit `.env`; the repository ignores `.env*` while allowing `.env.example`.

Start the app in development mode:

```bash
npm run dev
```

Open <http://localhost:3000>. The API health endpoint is <http://localhost:3000/api/health>. The port can be overridden with `PORT`.

## Flashcard database migration

Flashcard data uses the application's existing local store and PostgreSQL connection. If you use PostgreSQL synchronization, apply the migration to the same database before using the flashcard feature:

```bash
psql -h <host> -U <user> -d <database> -f drizzle/0001_flashcards.sql
```

Replace the placeholders with your PostgreSQL connection details. The migration creates `flashcard_sets`, `flashcards`, and `flashcard_progress`, with ownership constraints and cascading cleanup. Do not run it against a production database without following your normal database change process.

Without PostgreSQL, the Express application continues to use its local `data/db.json` store. Keep that file and `uploads/` backed up if you need to preserve local data; both are ignored by Git.

## Build and checks

Type-check the project:

```bash
npm run lint
```

Build the client and production server bundle:

```bash
npm run build
```

Run the production bundle:

```powershell
$env:NODE_ENV = "production"
npm start
```

On macOS or Linux:

```bash
NODE_ENV=production npm start
```

## Optional FastAPI backend

`backend/` is a separate service and is not required by the React/Express application. It requires Python 3.10 or newer and a MySQL database. From the repository root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment, then install dependencies:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

On macOS or Linux, activate with `source .venv/bin/activate` and copy the template with `cp .env.example .env`. Configure the MySQL settings and optional Gemini key in `backend/.env`, then run:

```bash
uvicorn app.main:app --reload
```

The FastAPI docs are at <http://localhost:8000/docs>; its health endpoint is <http://localhost:8000/api/health>.

## Troubleshooting

- **Port already in use:** Set `PORT` to another free port before starting the Express app.
- **AI generation is unavailable:** Check `GEMINI_API_KEY` in the root `.env`, then restart the app.
- **Google sign-in is unavailable:** Configure the Supabase Google provider, OAuth redirect URLs, and the `SUPABASE_*` and `VITE_SUPABASE_*` variables.
- **PostgreSQL synchronization fails for flashcards:** Apply `drizzle/0001_flashcards.sql` to the configured database and verify the connection settings.
- **Document text is empty or incomplete:** Scanned PDFs may not contain extractable text; use a text-based source file when possible.

## Project structure

```text
.
├── backend/              # Optional FastAPI/MySQL service
├── data/                 # Local JSON store (created at runtime)
├── drizzle/              # PostgreSQL SQL migrations
├── public/               # Static assets
├── server/               # Express routes, parsers, and AI services
├── src/                  # React app, API client, and Drizzle schema
├── uploads/              # Uploaded documents (created at runtime)
├── server.ts             # Express/Vite application entry point
└── package.json          # npm scripts and dependencies
```
