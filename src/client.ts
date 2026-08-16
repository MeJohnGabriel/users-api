import { confirm, input, select } from "@inquirer/prompts";
import { google } from "@ai-sdk/google";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CreateMessageRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { SamplingMessage } from "@modelcontextprotocol/sdk/types.js";
import { generateText, jsonSchema, ToolSet } from "ai";
import type { JSONSchema7 } from "json-schema";
import "dotenv/config";
import { stderr } from "node:process";

type ClientTool = Awaited<
  ReturnType<typeof mcpClient.listTools>
>["tools"][number];
type ClientPrompt = Awaited<
  ReturnType<typeof mcpClient.listPrompts>
>["prompts"][number];
type PromptMessage = Awaited<
  ReturnType<typeof mcpClient.getPrompt>
>["messages"][number];

// Create a new client instance with the name and version of the client, and the capabilities of the client
const mcpClient = new Client(
  {
    name: "mcp-client-test",
    version: "1.0.0",
  },
  {
    capabilities: { sampling: {} },
  },
);

// Create a new transport instance that will spawn a child process to run the server, and connect to it via stdio
const transport = new StdioClientTransport({
  command: "node",
  args: ["build/server.js"],
  stderr: "ignore",
});

// Connect the client to the server via the transport, and list the tools, prompts, resources, and resource templates available on the server
async function main() {
  await mcpClient.connect(transport);

  mcpClient.setRequestHandler(CreateMessageRequestSchema, async (request) => {
    const texts: string[] = [];
    for (const message of request.params.messages) {
      const text = await handlerServerMessage(message);
      if (text !== null) {
        texts.push(text);
      }
    }
    return {
      role: "user",
      model: "gemini-3.5-flash",
      stopReason: "endTurn",
      content: { type: "text", text: texts.join("\n") },
    };
  });

  const [{ tools }, { prompts }, { resources }, { resourceTemplates }] =
    await Promise.all([
      mcpClient.listTools(),
      mcpClient.listPrompts(),
      mcpClient.listResources(),
      mcpClient.listResourceTemplates(),
    ]);
  console.log("You are connected to the server!");

  while (true) {
    const option = await select({
      message: "What do you want to do?",
      choices: ["Query", "Tools", "Prompts", "Resources", "Resource Templates"],
    });

    switch (option) {
      case "Query":
        await handlerQuery(tools);
        break;
      case "Tools":
        const toolName = await select({
          message: "Select a tool",
          choices: tools.map((tool) => ({
            name: tool.annotations?.title || tool.name,
            value: tool.name,
            description: tool.description,
          })),
        });
        const tool = tools.find((tool) => tool.name === toolName);
        if (!tool) {
          console.error(`Tool ${toolName} not found`);
        } else {
          await handleTool(tool);
        }
        break;
      case "Prompts":
        const promptName = await select({
          message: "Select a prompt",
          choices: prompts.map((prompt) => ({
            name: prompt.title || prompt.name,
            value: prompt.name,
            description: prompt.description,
          })),
        });
        const prompt = prompts.find((prompt) => prompt.name === promptName);
        if (!prompt) {
          console.error(`Prompt ${promptName} not found`);
        } else {
          await handlePrompt(prompt);
        }
        break;
      case "Resources":
        const resourceUri = await select({
          message: "Select a resource",
          choices: [
            ...resources.map((resource) => ({
              name: resource.name,
              value: resource.uri,
              description: resource.description,
            })),
            ...resourceTemplates.map((template) => ({
              name: template.name,
              value: template.uriTemplate,
              description: template.description,
            })),
          ],
        });
        const uri =
          resources.find((resource) => resource.uri === resourceUri)?.uri ??
          resourceTemplates.find(
            (template) => template.uriTemplate === resourceUri,
          )?.uriTemplate;
        if (!uri) {
          console.error(`Resource not found`);
        } else {
          await handleResource(uri);
        }
        break;
    }
  }

  async function handleTool(tool: ClientTool) {
    const args: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      tool.inputSchema.properties ?? {},
    )) {
      args[key] = await input({
        message: `Enter value for ${key} (${(value as { type: string }).type}):`,
      });
    }
    const result = await mcpClient.callTool({
      name: tool.name,
      arguments: args,
    });
    const blocks = result.content as Array<{ type: string; text?: string }>;
    const block = blocks[0];
    if (block?.type === "text") {
      console.log(block.text);
    } else {
      console.log(JSON.stringify(result.content, null, 2));
    }
  }

  async function handleResource(uri: string) {
    let finalUri = uri;
    const paramMatches = uri.match(/({([^}]+)})/g);

    if (paramMatches != null) {
      for (const paramMatch of paramMatches) {
        const paramName = paramMatch.replace("{", "").replace("}", "");
        const paramValue = await input({
          message: `Enter value for ${paramName}`,
        });
        finalUri = finalUri.replace(paramMatch, paramValue);
      }
    }

    const result = await mcpClient.readResource({ uri: finalUri });
    const first = result.contents[0];
    const text = first != null && "text" in first ? first.text : undefined;
    if (text == null) {
      console.error("Resource returned no text content");
      return;
    }
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log(text);
    }
  }

  async function handlerQuery(tools: ClientTool[]) {
    const query = await input({ message: "Enter your query:" });
    const toolSet: ToolSet = tools.reduce((acc, tool) => {
      acc[tool.name] = {
        description: tool.description ?? "",
        inputSchema: jsonSchema(tool.inputSchema as JSONSchema7),
        execute: async (args: Record<string, unknown>) =>
          mcpClient.callTool({ name: tool.name, arguments: args }),
      };
      return acc;
    }, {} as ToolSet);

    const { text, toolResults } = await generateText({
      model: google("gemini-3.5-flash"),
      prompt: query,
      tools: toolSet,
    });

    if (text) {
      console.log(text);
    } else if (toolResults.length > 0) {
      const output = toolResults[0].output as {
        content?: Array<{ text?: string }>;
      };
      console.log(output?.content?.[0]?.text || "No text generated");
    } else {
      console.log("No text generated");
    }
  }

  async function handlePrompt(prompt: ClientPrompt) {
    const args: Record<string, string> = {};
    for (const arg of prompt.arguments ?? []) {
      args[arg.name] = await input({
        message: `Enter value for ${arg.name}${
          arg.description ? ` (${arg.description})` : ""
        }`,
      });
    }
    const response = await mcpClient.getPrompt({
      name: prompt.name,
      arguments: args,
    });
    for (const message of response.messages) {
      await handleServerMessagePrompt(message);
    }
  }

  async function handlerServerMessage(
    message: SamplingMessage,
  ): Promise<string | null> {
    const text = Array.isArray(message.content)
      ? message.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n")
      : message.content.type === "text"
        ? message.content.text
        : null;
    if (text == null) {
      return null;
    }
    console.log(text);
    const run = await confirm({
      message: "Would you like to run this prompt?",
      default: true,
    });
    if (!run) {
      return null;
    }
    try {
      const result = await generateText({
        model: google("gemini-3.5-flash"),
        prompt: text,
      });
      return result.text;
    } catch (error) {
      console.error(
        "Failed to generate text. Make sure GOOGLE_GENERATIVE_AI_API_KEY is set in .env",
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  async function handleServerMessagePrompt(message: PromptMessage) {
    if (message.content.type !== "text") {
      return;
    }
    console.log(message);
    const run = await confirm({
      message: "Would you like to run this prompt?",
      default: true,
    });
    if (!run) {
      return;
    }
    try {
      const result = await generateText({
        model: google("gemini-3.5-flash"),
        prompt: message.content.text,
      });
      console.log(result.text);
    } catch (error) {
      console.error(
        "Failed to generate text. Make sure GOOGLE_GENERATIVE_AI_API_KEY is set in .env",
        error instanceof Error ? error.message : error,
      );
    }
  }
}
main();
