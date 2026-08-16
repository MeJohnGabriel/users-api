# MCP — This Whole Project Explained for a Beginner

---

## 1. The big picture: what is MCP?

**MCP = Model Context Protocol.** It's a standard way for an AI to talk to your code.

**The restaurant analogy:**
- The **client** is the **customer** — it has the AI brain and talks to you.
- The **server** is the **kitchen** — it cooks the food (data) and serves it through a menu.
- **MCP** is the **waiter** — the shared "language" that carries orders between them.

In this project, the "food" is **users** — creating them, listing them, and generating fake ones.

```
┌──────────────┐  MCP messages (stdio)  ┌──────────────┐  HTTP (fetch)  ┌──────────────┐
│  YOU         │                        │  MCP Server  │                │  API (Render)│
│  (client.ts) │◄──────────────────────►│ (server.ts)  │◄──────────────►│ /users       │
│  has Gemini  │                        │  tools/      │                │ stores data  │
└──────────────┘                        │  resources/  │                └──────────────┘
                                        │  prompts     │
```

- You type into the **client**.
- The client asks the **server**: "what can you do?" → tools, resources, prompts.
- The server actually talks to the **real API** (the deployed Express API) to read/write users.

---

## 2. client.ts vs server.ts — what's the difference?

| | `client.ts` | `server.ts` |
|---|---|---|
| Who it is | The customer. Has the AI (Google Gemini). | The kitchen. Has the data and actions. |
| Starts the conversation | Yes — it connects and asks questions | No — it waits for requests |
| Knows your inputs | Yes — `input()`/`select()` ask YOU for names, emails, etc. | No — it only receives commands |
| Holds the AI brain | Yes — `generateText` with Gemini | No — but it can **ask the client's AI** via sampling |
| Exposes tools/resources | No — it consumes them | Yes — `registerTool`, `registerResource`, `registerPrompt` |
| Talks to the API | No | Yes — `fetch()` to the deployed API |

**The one-liner:** `client.ts` is the brain that asks, `server.ts` is the hands that do.

---

## 3. Why aren't client and server supposed to be in one folder?

**Analogy:** it's like putting the **kitchen inside the dining room**. They're two different jobs and two different programs.

- They are **separate programs** that just happen to share a folder. They communicate only through MCP messages over **stdio** (the client literally launches the server as a child process: `node build/server.js`).
- The problems with one folder:
  - They have different lifecycles (the server can be restarted independently; the client may die while the server keeps running).
  - A real deployment has the server on one machine and clients on many.
  - Their dependencies/versions get tangled.

**The proper way:** a **monorepo with two packages**:

```
my-project/
├── packages/
│   ├── client/     # its own package.json, only the client code
│   └── server/     # its own package.json, only the server code
└── api/            # or even a third package for the REST API
```

Each package is a small, isolated program. They communicate **only** through MCP (or HTTP for the API) — never by importing each other's files.

---

## 4. Tour of `server.ts` (the kitchen)

| Function / block | What it does (macro vision) |
|---|---|
| `listUsers()` | Asks the API "give me all users" (`GET /users`) and returns the JSON. |
| `getUser(id)` | Asks the API "give me user #5" (`GET /users/5`). Returns `null` if 404. |
| `createUser(user)` | Asks the API "create this user" (`POST /users`) and returns the new id. |
| `createServer()` | The main "kitchen" factory — builds the MCP server with everything below. |
| `registerTool("create-user", ...)` | Adds a **tool** the AI/user can call: takes name/email/phone/address and calls `createUser()`. |
| `registerResource("users", "users://all")` | Adds a **resource**: reading it returns the whole list of users from the API. |
| `registerResource("user-details", "users://{userId}/profile")` | Adds a **resource template**: reading `users://5/profile` returns user #5. |
| `registerPrompt("create-fake-user", ...)` | Adds a **prompt**: a pre-written message template that asks the AI to invent a fake user. |
| `registerTool("generate-random-user", ...)` | The coolest one: it **asks the client's AI to generate a random user** (sampling), parses the JSON answer, then saves it via `createUser()`. |
| `serveStdio(createServer)` | Starts the server, listening on standard input/output (stdio) so the client can talk to it. |

**Key idea — sampling:** normally the server has no AI. In `generate-random-user`, the server *pauses* and asks the **client's AI** to write the user for it. That's the "sampling" feature you enabled — the client shows you the prompt and asks "Would you like to run this prompt?".

---

## 5. Tour of `client.ts` (the customer)

| Function / block | What it does (macro vision) |
|---|---|
| `mcpClient = new Client(...)` | Creates the MCP client and declares it supports sampling. |
| `transport = new StdioClientTransport(...)` | Configures how to reach the server: spawn `node build/server.js` and talk over stdio. |
| `main()` | The heart: connects, lists everything the server offers, then runs an endless menu (`select`) so YOU pick what to do. |
| `setRequestHandler(CreateMessageRequestSchema, ...)` | Handles **sampling**: when the server asks the client's AI for text, it collects each message, asks YOU to approve, and replies to the server. |
| `handlerQuery(tools)` | "Query" mode: takes your question, hands the server's tools to Gemini, and lets the AI decide which tool to call. |
| `handleTool(tool)` | "Tools" mode: asks YOU for each argument, calls the tool on the server, prints the result. |
| `handlePrompt(prompt)` | "Prompts" mode: asks YOU for the prompt's arguments, gets the prompt's messages from the server, and runs them through Gemini. |
| `handleResource(uri)` | "Resources" mode: reads a resource from the server (fills in `{userId}` from you) and prints it nicely. |
| `handlerServerMessage(message)` | The sampling helper: extracts the text, shows it to you, asks "Would you like to run this prompt?", and generates the answer with Gemini if you agree. |
| `handleServerMessagePrompt(message)` | Same idea but for **prompt** messages — shows the message, confirms with you, generates with Gemini. |

**The menu pattern:** after connecting, `main()` shows options (Query / Tools / Prompts / Resources) in a loop forever. Every option is "ask the user, then ask the server, then print."

---

## 6. The scripts (`package.json`)

| Script | Command | What it does |
|---|---|---|
| `server:build` | `tsc` | Compiles TypeScript (`src/`) → JavaScript (`build/`). You need this before running the client, since it spawns `build/server.js`. |
| `server:build:watch` | `tsc --watch` | Same, but re-compiles automatically when you save. |
| `server:dev` | `tsx src/server.ts` | Runs the server directly from TypeScript, no build step (great for debugging). |
| `server:inspect` | `npx @modelcontextprotocol/inspector ...` | Opens the **MCP Inspector** — a visual tool to click through the server's tools/resources. |
| `client:dev` | `tsx src/client.ts` | Runs the client — this is what YOU use. |
| `api:dev` | `tsx api/index.ts` | Runs the local REST API on port 3000 (only needed if you point at localhost). |
| `start` | `tsx api/index.ts` | The production command — what Render runs. |

**The usual flow:**
```bash
npm run server:build   # 1. compile the server (after code changes)
npm run client:dev     # 2. run the client (it launches the server itself)
```

---

## 7. Dependencies and their roles

| Dependency | Role |
|---|---|
| `@modelcontextprotocol/server` | Official SDK for building the MCP **server** (`McpServer`, `ResourceTemplate`, `serveStdio`). |
| `@ai-sdk/google` | Connects the AI SDK to Google's **Gemini** model. |
| `ai` | The AI SDK — gives us `generateText`, `ToolSet`, `jsonSchema` (used in the client). |
| `@inquirer/prompts` | Builds the interactive terminal questions (`input`, `select`, `confirm`). |
| `zod` | Schema validation — defines what each tool's inputs must look like. |
| `dotenv` | Loads a `.env` file with your secrets (e.g., the Google API key). |
| `tsx` | Runs TypeScript files directly without a build step. |
| `express` | Web framework for the **REST API** (`api/index.ts`). |
| `typescript` | The compiler that turns `.ts` into `.js` (`server:build`). |
| `@types/*` | Type definitions for TypeScript (node, express, json-schema). |
| `@modelcontextprotocol/inspector` | The visual debugging tool for the server. |

---

## 8. Next steps — a real plan

1. **Real database (the big one).** Right now data lives in a JSON file that Render **wipes on every redeploy**. Plan: add **PostgreSQL** (Render offers it free) and switch `api/index.ts` from `readFile`/`writeFile` to SQL. Your users survive restarts forever.
2. **Full CRUD.** Add `PUT /users/:id` and `DELETE /users/:id` so the API can also update and remove users.
3. **Auth.** Add an API key so only your client can create users, not any stranger on the internet.
4. **Separate the projects.** Move client and server into `packages/client` and `packages/server` (section 3) — the proper structure.
5. **More tools.** Add tools like "get user by email" or a resource that returns statistics — you already know how, since the pattern is the same.
