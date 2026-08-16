import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "https://users-api-lowp.onrender.com";

type User = {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
};

async function listUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE_URL}/users`);
  if (!res.ok) {
    throw new Error(`API returned status ${res.status}`);
  }
  return res.json();
}

async function getUser(id: number): Promise<User | null> {
  const res = await fetch(`${API_BASE_URL}/users/${id}`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`API returned status ${res.status}`);
  }
  return res.json();
}

async function createUser(
  user: Omit<User, "id">,
): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    throw new Error(`API returned status ${res.status}`);
  }
  const created: User = await res.json();
  return created.id;
}

function createServer(): McpServer {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  //this tool alllow the AI to know we have a name,email,address,,phone as strings.
  server.registerTool(
    // name of the tool, which is used to invoke it
    "create-user",
    // configuration for the tool, including a description and an input schema
    {
      description: "Create a new user in the database",
      inputSchema: {
        name: z.string(),
        email: z.string(),
        phone: z.string(),
        address: z.string(),
      },
      // optional, but good for documentation and to provide hints to the user about how tool behaves
      annotations: {
        title: "Create user",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },

    //handler for the tool, which is called when the tool is invoked
    async (params) => {
      // call the real API to create the user
      try {
        const id = await createUser(params);
        return {
          content: [{ type: "text", text: `Created user ${id}` }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to create user: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    },
  );

  server.registerResource(
    "users",
    "users://all",
    {
      description: "Get all users in the database",
      title: "users",
      mimeType: "application/json",
    },
    async (uri) => {
      try {
        const users = await listUsers();
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(users),
              mimeType: "application/json",
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({
                error:
                  error instanceof Error ? error.message : String(error),
              }),
              mimeType: "application/json",
            },
          ],
        };
      }
    },
  );

  server.registerResource(
    "user-details",
    new ResourceTemplate("users://{userId}/profile", {
      list: async () => ({ resources: [] }),
    }),
    {
      description: "Get details of a user from the database",
      title: "user details",
      mimeType: "application/json",
    },
    async (uri, { userId }) => {
      try {
        const user = await getUser(parseInt(userId as string));

        if (user == null) {
          return {
            contents: [
              {
                uri: uri.href,
                text: JSON.stringify({ error: "User not found" }),
                mimeType: "application/json",
              },
            ],
          };
        }

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(user),
              mimeType: "application/json",
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
              mimeType: "application/json",
            },
          ],
        };
      }
    },
  );

  server.registerPrompt(
    "create-fake-user",
    {
      argsSchema: z.object({ name: z.string() }),
      description: "Create a fake user in the database",
    },
    ({ name }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Create a fake user with the name ${name} with a realistic email, phone, and address as well.`,
            },
          },
        ],
      };
    },
  );

  //sampling: this tool asks the client's AI to generate text mid-run, instead of using its own model
  server.registerTool(
    "generate-random-user",
    {
      description: "Generate a random user with realistic data",
      inputSchema: { name: z.string() },
      annotations: {
        title: "Generate random user",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ name }, ctx) => {
      // try/catch covers the whole flow, including the client rejecting the sampling request
      try {
        // pause here and ask the client's AI to generate a response (the sampling call)
        const response = await ctx.mcpReq.requestSampling({
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                // prompt asks for JSON, since that's what we parse below (prompt must match what we parse)
                text: `Create a fake user named ${name}. Return ONLY a valid JSON object with exactly these keys: name, email, phone, address. Use a realistic email, phone, and address. Do not include markdown code fences or any other text.`,
              },
            },
          ],
          maxTokens: 300,
        });

        // normalize the response to handle both single and multiple content items
        const block = Array.isArray(response.content)
          ? response.content[0]
          : response.content;

        //guard clause if we didn't get text back
        if (!block || block.type !== "text") {
          return {
            content: [{ type: "text", text: `Failed to generate user bio.` }],
          };
        }

        // LLM output isn't guaranteed clean so strip any ```json fences before parsing
        const fakeUser = JSON.parse(
          block.text
            .trim()
            .replace(/^\s*```json\s*/, "")
            .replace(/\s*```\s*$/, "")
            .trim(),
        );

        // validate the parsed JSON actually has the fields/types we need before trusting it
        if (
          !fakeUser ||
          typeof fakeUser.name !== "string" ||
          typeof fakeUser.email !== "string" ||
          typeof fakeUser.phone !== "string" ||
          typeof fakeUser.address !== "string"
        ) {
          return {
            content: [{ type: "text", text: `Failed to generate user bio.` }],
          };
        }

        const id = await createUser(fakeUser);
        return {
          content: [
            { type: "text", text: `User created successfully with ID ${id}` },
          ],
        };
      } catch {
        // catches parse errors, validation failures, and the client refusing sampling
        return {
          content: [{ type: "text", text: `Failed to generate user bio.` }],
        };
      }
    },
  );
  return server;
}

void serveStdio(createServer);
console.error("test MCP server running on stdio");
