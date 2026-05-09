# your-story-app

Story capture app for faith journeys. Email/password auth with bcrypt + JWT, stories saved server-side as JSON.

## Architecture

- **Frontend** (`/`): Create React App. Requires `REACT_APP_API_URL` pointing at the API.
- **Backend** (`server/`): Node/Express + Postgres. Auth via bcrypt + JWT. Stories stored as JSONB per user.
- **Deploy**: `render.yaml` provisions the Postgres database and the API service on Render. The static frontend is deployed separately.

## Local development

```bash
# 1. Postgres running locally (or any reachable Postgres)
# 2. Server
cd server
cp .env.example .env   # fill in DATABASE_URL and a 32+ char JWT_SECRET
npm install
npm run dev            # listens on :3001

# 3. Frontend (in another shell, from repo root)
cp .env.example .env   # REACT_APP_API_URL=http://localhost:3001
npm install
npm start              # serves :3000
```

## Deploy on Render

1. Push this repo to GitHub.
2. In Render, **New → Blueprint**, point at this repo. The blueprint creates the Postgres DB and the API service.
3. After deploy, set `FRONTEND_URL` on the API service to your static-site URL (comma-separated if multiple).
4. On the existing static-site service, add env var `REACT_APP_API_URL` = the API service URL, then redeploy.

## Security notes

- Passwords are bcrypt-hashed (cost 12). Auth tokens are JWT (HS256, 7d).
- CORS allowlist enforced via `FRONTEND_URL`. Auth endpoints are rate-limited.
- All user input is HTML-escaped before being injected into the PDF export DOM.
- No password reset is implemented yet.
