# Users API — Project Documentation

Your first real API, built with Express, replacing the fake `users.json` approach.

---

## 1. What an API is (the mental model)

Think of an API as a waiter in a restaurant:

- Your code (the **kitchen**) takes orders from clients (the **customers**) over HTTP (the **table**).
- Clients send requests like `GET /users` or `POST /users`.
- The API (waiter) delivers JSON responses back.

---

## 2. Architecture overview

The project now has **3 layers**:

```
MCP Client (src/client.ts)          MCP Server (src/server.ts)           Real API (api/index.ts)           api/data/users.json
       (asks you questions)          (exposes tools/resources)          (Express, port 3000)               (the "database")
```

| Layer | File | Role |
|---|---|---|
| MCP Client | `src/client.ts` | Interactive CLI. Asks you questions, calls tools/resources, handles sampling. |
| MCP Server | `src/server.ts` | Exposes tools + resources. Calls the real API over HTTP instead of touching files. |
| Real API | `api/index.ts` | Express web server on `http://localhost:3000`. Owns all data access. |
| Data | `api/data/users.json` | The JSON file the API reads/writes (your "database"). |

**The key change:** the MCP server no longer reads/writes `users.json` directly.
It now calls your API over HTTP with `fetch` (`src/server.ts:15-47`).

---

## 3. Your API endpoints

| Request | Meaning | Response |
|---|---|---|
| `GET /users` | "Give me all users" | JSON array of users |
| `GET /users/:id` | "Give me user #5" | JSON object or `404 { "error": "User not found" }` |
| `POST /users` | "Create this user" | `201` + the newly created user (with id) |

Example:

```bash
# List all users
curl http://localhost:3000/users

# Get one user
curl http://localhost:3000/users/1

# Create a user
curl -X POST http://localhost:3000/users \
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

> The API **must be running** before the MCP server/client, otherwise tools fail.

```bash
npm run api:dev        # Terminal 1 — starts the API on http://localhost:3000
npm run server:build   # Rebuild the MCP server after TS changes (tsc)
npm run client:dev     # Terminal 2 — starts the interactive MCP client
```

### Restarting the server

The API runs as a **separate process** — it is not started automatically. If you close the terminal
or stop the process (e.g. to make code changes), you must restart it before using the tools:

```bash
npm run api:dev        # Terminal 1 — (re)start the API
npm run client:dev     # Terminal 2 — (re)start the MCP client
```

> If you run a tool while the API is down, you'll see an error like
> `Failed to create user: fetch failed`. Just start the API again and retry.

Remember: **one terminal for the API (`npm run api:dev`), one for the client (`npm run client:dev`).**

Other useful scripts:

```bash
npm run server:dev     # Run the MCP server with tsx (no build needed)
npm run server:inspect # Open the MCP inspector UI
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

## 6. What was tested (end-to-end)

- `GET /users` → returns all 17 seeded users.
- `GET /users/1` → returns the first user.
- `POST /users` → creates a user and returns its new id.
- MCP `create-user` tool → created user 18 through the API, confirmed via `GET /users/18`.
- MCP `users` resource → returns the API's list.
- All TypeScript compiles cleanly (`tsc --noEmit`).

---

## 7. Key concepts used in this project

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

---

## 8. What's next (potential improvements)

- **Update + delete endpoints** — only create + list were built by design. Add `PUT /users/:id` and `DELETE /users/:id` for full CRUD.
- **Real database** — a JSON file is fine for learning but can't handle concurrent writes. SQLite is the natural upgrade.
- **Error handling** — if the API is down, tools just return "Failed". Add retries or clearer error messages.
- **Validation** — the API checks types, but you could add stricter validation (e.g., zod) on the API side.
