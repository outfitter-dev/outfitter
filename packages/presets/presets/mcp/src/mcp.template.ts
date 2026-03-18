/**
 * {{projectName}} - MCP server definition
 */

import { NotFoundError, Result } from "@outfitter/contracts";
import {
  createMcpServer,
  connectStdio,
  defineResource,
  defineResourceTemplate,
  defineTool,
} from "@outfitter/mcp";
import { type ZodType, z } from "zod";

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

/** Parameterized resource template that generates a greeting by name. */
const greetingTemplate = defineResourceTemplate({
  uriTemplate: "greeting:///{name}",
  name: "Greeting",
  description: "Generate a greeting for a specific name",
  mimeType: "application/json",
  paramSchema: z.object({
    name: z.string().describe("Name to greet"),
  }),
  handler: async (uri, params, _ctx) => {
    const { name } = params as { name: string };
    return Result.ok([
      { uri, text: JSON.stringify({ message: `Hello, ${name}!` }) },
    ]);
  },
});

server.registerResourceTemplate(greetingTemplate);

/** Input for the lookup tool. */
interface LookupInput {
  readonly id: string;
}

/** Zod schema for lookup tool input validation. */
const lookupInputSchema: ZodType<LookupInput> = z.object({
  id: z.string().min(1, "id must not be empty").describe("Item ID to look up"),
});

/** Output from the lookup tool. */
interface LookupOutput {
  readonly name: string;
  readonly found: boolean;
}

/** Tool that looks up an item by ID, demonstrating NotFoundError. */
const lookupTool = defineTool({
  name: "lookup",
  description: "Look up an item by ID",
  inputSchema: lookupInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async (
    input,
    _ctx
  ): Promise<Result<LookupOutput, NotFoundError>> => {
    if (input.id === "unknown") {
      return Result.err(NotFoundError.create("item", input.id));
    }

    return Result.ok({ name: `Item ${input.id}`, found: true });
  },
});

server.registerTool(lookupTool);

export { server, lookupTool };

/** Start the MCP server over stdio transport. */
export async function startServer(): Promise<void> {
  await connectStdio(server);
}
