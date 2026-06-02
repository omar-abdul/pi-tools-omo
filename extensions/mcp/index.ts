import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { 
  ListToolsResultSchema, 
  CallToolResultSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  const mcpClients = new Map<string, Client>();

  pi.registerCommand("mcp-add", {
    description: "Connect to an MCP server",
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage: /mcp-add <name> <command> [args...]", "error");
        return;
      }

      const [name, command, ...commandArgs] = args.split(/\s+/);
      
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

        for (const tool of (toolsResult.tools as Tool[])) {
          const toolName = `${name}_${tool.name}`;
          
          pi.registerTool({
            name: toolName,
            label: `MCP: ${toolName}`,
            description: tool.description || `MCP tool from ${name}`,
            parameters: tool.inputSchema as any,
            async execute(toolCallId, params, signal, onUpdate, ctx) {
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

        mcpClients.set(name, client);
        ctx.ui.notify(`Connected to MCP server '${name}' with ${toolsResult.tools.length} tools.`, "info");
      } catch (error: any) {
        ctx.ui.notify(`Failed to connect to MCP server: ${error.message}`, "error");
      } finally {
        ctx.ui.setStatus("mcp", "");
      }
    },
  });

  pi.on("session_shutdown", async () => {
    for (const client of mcpClients.values()) {
      try {
        await client.close();
      } catch (e) {
        // ignore
      }
    }
    mcpClients.clear();
  });
}
