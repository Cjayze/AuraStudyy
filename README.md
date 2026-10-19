# AuraStudy

AuraStudy is an AI-powered study workspace for organizing course materials, asking questions about uploaded documents, generating quizzes, and tracking learning activity.

The repository contains a Node.js application that serves the React web app and its API. It also includes an optional, separate FastAPI backend under `backend/`.

## Features

- Upload and organize study documents, including PDF and DOCX files.
- Ask Aura AI questions grounded in uploaded materials.
- Generate quizzes, complete them, and review results.
- Track study activity from a learning dashboard.
- Sign in with email and password or Google through Supabase Auth.

## Technology

- **Web:** React, TypeScript, Vite, Tailwind CSS
- **Application server:** Node.js, Express, TypeScript
- **Authentication:** Supabase Auth, Google OAuth, and application JWTs
- **AI:** Google Gemini API
- **Persistence:** Local JSON storage for application data, local file storage for uploads, and optional Supabase PostgreSQL for user profiles
- **Optional service:** FastAPI, SQLAlchemy, and MySQL in `backend/`

## Requirements

- Node.js 20 or later and npm
- A Supabase project for authentication
- A Google OAuth client configured in Supabase to enable Google sign-in
- A Gemini API key for Gemini-powered features
- Supabase PostgreSQL connection credentials when using database-backed user profiles

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/Cjayze/AuraStudy.git
cd AuraStudy
npm ci
```

### 2. Configure environment variables

Create a root `.env` file from the example:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS or Linux
cp .env.example .env
```

Set the values that apply to your setup:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Gemini API key used by AI features. Some quiz generation can fall back to a local heuristic when this is not configured. |
| `JWT_SECRET` | Secret used to sign application JWTs. Replace the example value with a long, random secret, especially in production. |
| `SUPABASE_URL` | Supabase project URL used by the application server to validate Auth sessions. |
| `SUPABASE_ANON_KEY` | Supabase publishable/anonymous key used by the application server. |
| `VITE_SUPABASE_URL` | Supabase project URL exposed to the web client. Usually the same as `SUPABASE_URL`. |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anonymous key exposed to the web client. Usually the same as `SUPABASE_ANON_KEY`. |
| `SUPABASE_HOST` | PostgreSQL host, typically `db.<project-ref>.supabase.co`. |
| `SUPABASE_PORT` | PostgreSQL port; defaults to `5432`. |
| `SUPABASE_USER` | PostgreSQL user; defaults to `postgres`. |
| `SUPABASE_DATABASE` | PostgreSQL database; defaults to `postgres`. |
| `SUPABASE_PASSWORD` | PostgreSQL database password. `SUPABASE_DB_PASSWORD` is also accepted by the application. |
| `APP_URL` | Optional public URL of the deployed application. |

Do not commit `.env` or share secrets in issue reports. The `VITE_` variables are bundled into the browser app, so use only the Supabase publishable/anonymous key there. Never put a service-role key in a `VITE_` variable.

### 3. Configure Supabase and Google sign-in

1. In the Supabase dashboard, enable **Authentication → Providers → Google** and provide your Google OAuth client ID and client secret.
2. Add the Supabase callback URL shown in the provider settings to the authorized redirect URIs in Google Cloud. It usually has this form: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. In **Authentication → URL Configuration**, set the local site URL to `http://localhost:3000` and add `http://localhost:3000/**` to the allowed redirect URLs.
4. Copy the project URL, publishable/anonymous key, and PostgreSQL connection details into `.env` as needed.

### 4. Start the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The API health endpoint is available at [http://localhost:3000/api/health](http://localhost:3000/api/health).

## Build and quality checks

Run the TypeScript check:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

Start the production server:

```powershell
# Windows PowerShell
$env:NODE_ENV = "production"
npm start
```

```bash
# macOS or Linux
NODE_ENV=production npm start
```

The Node.js server listens on port `3000`.

## Data and uploads

- The Node.js application creates its local JSON database under `data/` when it starts.
- Uploaded documents are stored under `uploads/` and served from `/uploads`.
- Local data and uploaded files are machine-specific and are not included in Git. Back them up separately if you need to keep them.
- Configure Supabase PostgreSQL credentials to enable database-backed user profile operations. The local JSON store is still used for application data.

## Optional FastAPI backend

The `backend/` directory contains a separate Python service. The root npm commands do not start it. It requires Python 3.10 or later and a MySQL database created in advance.

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

```bash
# macOS or Linux
source .venv/bin/activate
```

Install dependencies and configure its environment:

```bash
python -m pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env`, then set the MySQL connection, `SECRET_KEY`, and `GEMINI_API_KEY` values. Start the service with:

```bash
uvicorn app.main:app --reload
```

The API documentation is at [http://localhost:8000/docs](http://localhost:8000/docs), and its health endpoint is at [http://localhost:8000/api/health](http://localhost:8000/api/health).

## Troubleshooting

- **Port 3000 is already in use:** stop the other process using the port before starting AuraStudy.
- **AI features are unavailable:** check `GEMINI_API_KEY` in the root `.env`, then restart the Node.js server.
- **Google sign-in fails:** verify the Google provider credentials, Supabase callback URI, and allowed redirect URLs.
- **Database connection fails:** check the Supabase database host and password, network access, and database connection settings.
- **The web app reports missing Supabase configuration:** check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then restart the development server.

## Project structure

```text
.
├── backend/              # Optional FastAPI service
├── public/               # Static web assets
├── server/               # Express API routes and application logic
├── src/                  # React app, client services, and database helpers
├── data/                 # Local JSON application data (generated at runtime)
├── uploads/              # Uploaded files (generated at runtime)
├── server.ts             # Node.js and Vite application entry point
└── package.json          # Node.js scripts and dependencies
```
