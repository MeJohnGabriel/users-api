# Users API — Project Documentation

Your first real API, built with Express, replacing the fake `users.json` approach.
It is deployed and **live on the internet** at `https://users-api-lowp.onrender.com`.

---

## 1. What an API is (the mental model)

Think of an API as a waiter in a restaurant:

- Your code (the **kitchen**) takes orders from clients (the **customers**) over HTTP (the **table**).
- Clients send requests like `GET /users` or `POST /users`.
- The API (waiter) delivers JSON responses back.

---

## 2. Architecture overview

The project has **3 local layers**, plus **GitHub** and **Render** when deployed:

```
MCP Client (src/client.ts)          MCP Server (src/server.ts)           Real API (api/index.ts)           api/data/users.json
       (asks you questions)          (exposes tools/resources)          (Express, port 3000)               (the "database")
```

| Layer | File / URL | Role |
|---|---|---|
| MCP Client | `src/client.ts` | Interactive CLI. Asks you questions, calls tools/resources, handles sampling. |
| MCP Server | `src/server.ts` | Exposes tools + resources. Calls the API over HTTP instead of touching files. |
| Real API | `api/index.ts` | Express web server. Runs locally on port 3000, or on Render via the `PORT` env var. |
| Data | `api/data/users.json` | The JSON file the API reads/writes (your "database"). |
| GitHub | `github.com/MeJohnGabriel/users-api` | Cloud copy of the code that Render builds from. |
| Render | `https://users-api-lowp.onrender.com` | Free web host that runs your API on the internet. |

**The key change:** the MCP server no longer reads/writes `users.json` directly.
It now calls your API over HTTP with `fetch` (`src/server.ts:15-47`).
The API's address comes from the `API_BASE_URL` env var — the **default is now the deployed API**
(`https://users-api-lowp.onrender.com`), so creating a user through the MCP client stores it online.
You can override it to `http://localhost:3000` to use the local API instead.

---

## 3. Your API endpoints

| Request | Meaning | Response |
|---|---|---|
| `GET /users` | "Give me all users" | JSON array of users |
| `GET /users/:id` | "Give me user #5" | JSON object or `404 { "error": "User not found" }` |
| `POST /users` | "Create this user" | `201` + the newly created user (with id) |

Example:

The same endpoints exist on the local API and the deployed one:

- Local: `http://localhost:3000/users`
- Deployed: `https://users-api-lowp.onrender.com/users`

```bash
# List all users (deployed)
curl https://users-api-lowp.onrender.com/users

# Get one user (deployed)
curl https://users-api-lowp.onrender.com/users/1

# Create a user (deployed)
curl -X POST https://users-api-lowp.onrender.com/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Joao","email":"joao@example.com","phone":"555-1234","address":"1 API Street"}'
```

---

## 4. How the pieces connect

**Create a user** (MCP `create-user` tool or `generate-random-user` tool):

```
Client → MCP Server → POST /users → API reads file, appends user, writes file → 201 { id } → back to client
```

**List users** (MCP `users` resource):

```
Client → MCP Server → GET /users → API reads file → JSON array → back to client
```

**Get one user** (MCP `user-details` resource):

```
Client → MCP Server → GET /users/:id → API reads file → JSON object or 404 → back to client
```

---

## 5. How to run it

The MCP client **defaults to the deployed API** (`https://users-api-lowp.onrender.com`), so to use the tools
you only need the client running — the online API is always up:

```bash
npm run server:build   # Rebuild the MCP server after TS changes (tsc)
npm run client:dev     # Terminal — starts the interactive MCP client (talks to Render by default)
```

### Using the local API instead

For local development, start the local API and point the MCP server at it:

```bash
npm run api:dev        # Terminal 1 — starts the local API on http://localhost:3000
```

```powershell
$env:API_BASE_URL = "http://localhost:3000"
npm run server:build   # recompile server.ts so it reads the env var
npm run client:dev     # Terminal 2 — the MCP server now talks to the local API
```

> If you point at the local API but it isn't running, you'll see an error like
> `Failed to create user: fetch failed`. Start it with `npm run api:dev` and retry.

Remember: **when using the local API, one terminal for the API (`npm run api:dev`), one for the client (`npm run client:dev`).**

Other useful scripts:

```bash
npm run server:dev     # Run the MCP server with tsx (no build needed)
npm run server:inspect # Open the MCP inspector UI
npm start              # Production start command (the one Render runs)
```

### Pointing the MCP server back to the deployed API

If you switched to local and want the deployed API again:

```powershell
$env:API_BASE_URL = "https://users-api-lowp.onrender.com"
npm run server:build   # recompile server.ts so it reads the env var
npm run client:dev     # the MCP server now talks to the deployed API
```

To use the deployed API again, just clear the env var (the code default is Render):

```powershell
Remove-Item Env:API_BASE_URL
npm run server:build
npm run client:dev
```

### Handy commands for beginners (Windows / PowerShell)

You're on Windows, so here are the PowerShell equivalents of the curl examples above.

**Check if the API is running:**

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/users" -Method Get
```

**Create a user directly against the API (bypasses the MCP client):**

```powershell
$body = @{ name = "Joao"; email = "joao@example.com"; phone = "555-1234"; address = "1 API Street" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/users" -Method Post -ContentType "application/json" -Body $body
```

**Stop the API** — if it's running in a terminal, just press `Ctrl + C`.
If it's running in the background and you need to kill it:

```powershell
Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ }
```

**Install all dependencies** (first time, or after deleting `node_modules`):

```bash
npm install
```

**Check your TypeScript code for errors without building:**

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
```

**See the data change live:** after creating a user, open `api/data/users.json` — the new user is appended there by the API.

---

## 6. Local API vs Deployed API

You have **two running copies** of the same API — one on your machine, one on Render.
They behave identically but are completely independent.

| | Local API | Deployed API (Render) |
|---|---|---|
| Address | `http://localhost:3000` | `https://users-api-lowp.onrender.com` |
| Who can reach it | Only your machine | Anyone on the internet |
| Data file | `api/data/users.json` on your machine | Its own copy stored on Render's server |
| Persistence | Keeps data as long as you keep the file | **Wiped on restart/redeploy** (free tier) |
| Availability | Manual — you start it with `npm run api:dev` | Always up, but sleeps after ~15 min idle |
| When to use | Local development, testing offline | Default — real usage from anywhere |

**The most important difference: the data is NOT shared.**

- Creating a user through the MCP client (default) saves it **on Render only**.
- To save locally instead, set `$env:API_BASE_URL = "http://localhost:3000"` and run the local API.
- Deleting `api/data/users.json` does **not** touch Render's data, but it **breaks the local API**
  (reads/writes fail with 500 errors). Keep the file if you want the local option.

---

## 7. Deployment (Render)

Your API is **online** — anyone in the world can call it at `https://users-api-lowp.onrender.com`.

### How it works

```
Your machine ──git push──► GitHub ──Render picks up──► https://users-api-lowp.onrender.com
```

1. You `git push` your code to the GitHub repo `MeJohnGabriel/users-api`.
2. Render watches that repo. On every push it installs dependencies (`npm install`) and starts the API (`npm start`).
3. Your API becomes reachable at the public URL.

### How we prepared the code for production

| Change | File | Why |
|---|---|---|
| `PORT` read from env | `api/index.ts` | Render assigns a random port to each service; we must respect it instead of hardcoding 3000. |
| `API_BASE_URL` read from env | `src/server.ts` | Defaults to the deployed URL — the MCP server stores users online by default. Override for local. |
| `start` script | `package.json` | The command Render runs to launch the API (`tsx api/index.ts`). |
| `.gitignore` | project root | Keeps `node_modules/`, `build/`, and `.env` out of git. |

### Free-tier caveats (important)

- **It sleeps after ~15 minutes** without traffic. The first request after idle can take ~30 seconds to wake up.
- **The JSON file is ephemeral** on the free tier — users you create are stored on the running instance, but
  are **wiped on restart or redeploy**. The seeded users come back after every deploy.
  → This is exactly why the "real database" upgrade (section 10) matters.
- **Redeploy automatically** every time you `git push` to `main`.

---

## 8. What was tested (end-to-end)

- `GET /users` → returns the full list of users (JSON array).
- `GET /users/1` → returns the first user.
- `POST /users` → creates a user and returns its new id.
- Deployed API: `GET /users` and `POST /users` verified on `https://users-api-lowp.onrender.com`.
- MCP `create-user` tool → creates a user through the API.
- MCP `users` resource → returns the API's list.
- All TypeScript compiles cleanly (`tsc --noEmit`).

---

## 9. Key concepts used in this project

| Concept | Where you saw it |
|---|---|
| HTTP methods | `GET` (read), `POST` (create) in `api/index.ts` |
| Status codes | `200` (ok), `201` (created), `400` (bad request), `404` (not found), `500` (server error) |
| Routing | `app.get("/users")`, `app.get("/users/:id")`, `app.post("/users")` |
| Middleware | `app.use(express.json())` parses incoming JSON bodies |
| Request body | `req.body` in `POST /users` |
| URL params | `req.params.id` in `GET /users/:id` |
| Fetch client | `fetch()` in `src/server.ts` calls the API over HTTP |
| Persistence | `readFile`/`writeFile` in `api/index.ts` manage the JSON file |
| Environment variables | `PORT` (API) and `API_BASE_URL` (MCP server) configure where each piece runs |
| Deployment | GitHub hosts the code; Render builds it and serves it at a public URL |

---

## 10. What's next (potential improvements)

- **Real database** — the biggest one now: on the free tier, your JSON file is wiped every redeploy. A real database
  (e.g., SQLite, or PostgreSQL on Render) makes your data survive restarts and handles concurrent writes.
- **Update + delete endpoints** — only create + list were built by design. Add `PUT /users/:id` and `DELETE /users/:id` for full CRUD.
- **Error handling** — if the API is down, tools just return "Failed". Add retries or clearer error messages.
- **Validation** — the API checks types, but you could add stricter validation (e.g., zod) on the API side.
- **Deploy pipeline** — Render already redeploys on every `git push`; you could add a production-only config (e.g., set `NODE_ENV=production`).
