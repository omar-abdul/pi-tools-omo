import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { 
  ListToolsResultSchema, 
  CallToolResultSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";

interface MCPConnection {
  client: Client;
  transport: StdioClientTransport;
  tools: Tool[];
}

export default function (pi: ExtensionAPI) {
  const mcpConnections = new Map<string, MCPConnection>();

  pi.registerCommand("mcp-connect", {
    description: "Connect to an MCP server",
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage: /mcp-connect <name> <command> [args...]", "error");
        return;
      }

      const [name, command, ...commandArgs] = args.split(/\s+/);
      
      if (mcpConnections.has(name)) {
        ctx.ui.notify(`MCP server '${name}' is already connected.`, "warn");
        return;
      }

      try {
        ctx.ui.setStatus("mcp", `Connecting to ${name}...`);
        
        const transport = new StdioClientTransport({
          command,
          args: commandArgs,
        });

        const client = new Client(
          { name: "pi-mcp-client", version: "1.0.0" },
          { capabilities: { tools: {} } }
        );

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
        ctx.ui.notify(`Connected to MCP server '${name}' with ${tools.length} tools.`, "info");
      } catch (error: any) {
        ctx.ui.notify(`Failed to connect to MCP server: ${error.message}`, "error");
      } finally {
        ctx.ui.setStatus("mcp", "");
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
        ctx.ui.notify(`Disconnected from MCP server '${name}'. (Note: Tools are still registered in pi's index but will fail if called)`, "info");
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
