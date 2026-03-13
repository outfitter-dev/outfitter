/**
 * {{projectName}} - MCP server definition
 */

import { Result } from "@outfitter/contracts";
import { createMcpServer, connectStdio, defineResource } from "@outfitter/mcp";

import { helloTool } from "./tools/hello.js";

const server = createMcpServer({
  name: "{{binName}}",
  version: "{{version}}",
});

server.registerTool(helloTool);

/** Static resource exposing the server version. */
const versionResource = defineResource({
  uri: "info:///version",
  name: "Server Version",
  description: "Returns the current server version",
  handler: async (uri, _ctx) =>
    Result.ok([{ uri, text: JSON.stringify({ version: "{{version}}" }) }]),
});

server.registerResource(versionResource);

export { server };

/** Start the MCP server over stdio transport. */
export async function startServer(): Promise<void> {
  await connectStdio(server);
}
