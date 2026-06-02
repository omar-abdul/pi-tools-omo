import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { 
  ListToolsResultSchema, 
  CallToolResultSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFile, writeFile, mkdir } from "node:fs/promises";

interface MCPConnection {
  client: Client;
  transport: StdioClientTransport;
  tools: Tool[];
}

interface SavedMCPServer {
  command: string;
  args: string[];
}

interface MCPConfigFile {
  servers: Record<string, SavedMCPServer>;
}

const CONFIG_DIR = join(homedir(), ".pi", "agent");
const CONFIG_FILE = join(CONFIG_DIR, "mcp-servers.json");

async function loadConfig(): Promise<MCPConfigFile> {
  try {
    const data = await readFile(CONFIG_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return { servers: {} };
  }
}

async function saveServer(name: string, command: string, args: string[]) {
  try {
    await mkdir(CONFIG_DIR, { recursive: true });
    const config = await loadConfig();
    config.servers[name] = { command, args };
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
  } catch (error) {
    // ignore
  }
}

async function removeServer(name: string) {
  try {
    const config = await loadConfig();
    delete config.servers[name];
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
  } catch (error) {
    // ignore
  }
}

export default function (pi: ExtensionAPI) {
  const mcpConnections = new Map<string, MCPConnection>();

  async function connectServer(
    name: string,
    command: string,
    commandArgs: string[],
    notifyFunc: (msg: string, type: "info" | "warn" | "error") => void,
    setStatusFunc?: (key: string, val: string) => void
  ): Promise<boolean> {
    if (mcpConnections.has(name)) {
      notifyFunc(`MCP server '${name}' is already connected.`, "warn");
      return false;
    }

    try {
      if (setStatusFunc) {
        setStatusFunc("mcp", `Connecting to ${name}...`);
      }
      
      const transport = new StdioClientTransport({
        command,
        args: commandArgs,
        stderr: "pipe", // Prevent writing to parent's stderr directly (which messes up the TUI/terminal screen)
      });

      // Simple handler for stderr to log to debugger or ignore, preventing stdio screen hijack
      const processStderr = (stream: any) => {
        if (stream && typeof stream.on === "function") {
          stream.on("data", (data: Buffer) => {
            // We can optionally keep track/debug this inside pi or discard it to prevent corruption
          });
        }
      };

      const client = new Client(
        { name: "pi-mcp-client", version: "1.0.0" },
        { capabilities: { tools: {} } }
      );

      // Extract transport stderr stream before connecting
      if (transport.stderr) {
        processStderr(transport.stderr);
      }

      await client.connect(transport);
      
      const toolsResult = await client.request(
        { method: "tools/list" },
        ListToolsResultSchema
      );

      const tools = toolsResult.tools as Tool[];

      for (const tool of tools) {
        const toolName = `${name}_${tool.name}`;
        
        pi.registerTool({
          name: toolName,
          label: `MCP: ${toolName}`,
          description: tool.description || `MCP tool from ${name}`,
          parameters: tool.inputSchema as any,
          async execute(_toolCallId, params) {
            const result = await client.request(
              {
                method: "tools/call",
                params: {
                  name: tool.name,
                  arguments: params,
                },
              },
              CallToolResultSchema
            );

            return {
              content: result.content as any,
              details: { mcpResult: result },
              isError: result.isError,
            };
          },
        });
      }

      mcpConnections.set(name, { client, transport, tools });
      notifyFunc(`Connected to MCP server '${name}' with ${tools.length} tools.`, "info");
      return true;
    } catch (error: any) {
      notifyFunc(`Failed to connect to MCP server '${name}': ${error.message}`, "error");
      return false;
    } finally {
      if (setStatusFunc) {
        setStatusFunc("mcp", "");
      }
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    const config = await loadConfig();
    const servers = Object.entries(config.servers);
    if (servers.length > 0) {
      ctx.ui.notify(`Restoring ${servers.length} MCP connection(s) in background...`, "info");
      // Connect to servers sequentially in background to avoid blocking interactive startup
      (async () => {
        for (const [name, srv] of servers) {
          try {
            await connectServer(
              name,
              srv.command,
              srv.args,
              (msg, type) => ctx.ui.notify(msg, type),
              (key, val) => ctx.ui.setStatus(key, val)
            );
          } catch (error: any) {
            ctx.ui.notify(`Failed to restore MCP server '${name}': ${error.message}`, "error");
          }
        }
      })().catch(() => {});
    }
  });

  pi.registerCommand("mcp-connect", {
    description: "Connect to an MCP server",
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage: /mcp-connect <name> <command> [args...]", "error");
        return;
      }

      const [name, command, ...commandArgs] = args.split(/\s+/);
      
      const success = await connectServer(
        name,
        command,
        commandArgs,
        (msg, type) => ctx.ui.notify(msg, type),
        (key, val) => ctx.ui.setStatus(key, val)
      );

      if (success) {
        await saveServer(name, command, commandArgs);
      }
    },
  });

  pi.registerCommand("mcp-disconnect", {
    description: "Disconnect from an MCP server",
    handler: async (name, ctx) => {
      if (!name) {
        ctx.ui.notify("Usage: /mcp-disconnect <name>", "error");
        return;
      }

      const connection = mcpConnections.get(name);
      if (!connection) {
        ctx.ui.notify(`No MCP server connected with name '${name}'.`, "error");
        return;
      }

      try {
        await connection.client.close();
        mcpConnections.delete(name);
        await removeServer(name);
        ctx.ui.notify(`Disconnected from MCP server '${name}'.`, "info");
      } catch (error: any) {
        ctx.ui.notify(`Error disconnecting: ${error.message}`, "error");
      }
    },
  });

  pi.registerCommand("mcp-list", {
    description: "List connected MCP servers and their tools",
    handler: async (_args, ctx) => {
      if (mcpConnections.size === 0) {
        ctx.ui.notify("No MCP servers connected.", "info");
        return;
      }

      const infoLines: string[] = [];
      for (const [name, conn] of mcpConnections.entries()) {
        infoLines.push(`Server: ${name}`);
        infoLines.push(`  Tools: ${conn.tools.map(t => t.name).join(", ")}`);
        infoLines.push("");
      }

      ctx.ui.notify(infoLines.join("\n"), "info");
    },
  });

  pi.on("session_shutdown", async () => {
    for (const { client } of mcpConnections.values()) {
      try {
        await client.close();
      } catch (e) {
        // ignore
      }
    }
    mcpConnections.clear();
  });
}
