/**
 * Action registry for Outfitter CLI.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";
import {
	InternalError,
	Result,
	createActionRegistry,
	defineAction,
	type ActionCliInputContext,
	type ActionCliOption,
} from "@outfitter/contracts";
import { z } from "zod";
import { runInit } from "./commands/init.js";
import { printDoctorResults, runDoctor } from "./commands/doctor.js";
import type { InitOptions } from "./commands/init.js";

type InitFlags = {
	readonly name?: string | undefined;
	readonly bin?: unknown;
	readonly template?: unknown;
	readonly force?: unknown;
	readonly local?: unknown;
	readonly workspace?: unknown;
};

const initInputSchema = z.object({
	targetDir: z.string(),
	name: z.string().optional(),
	bin: z.string().optional(),
	template: z.string().optional(),
	local: z.boolean().optional(),
	force: z.boolean(),
}) as z.ZodType<InitOptions>;

const doctorInputSchema = z.object({
	cwd: z.string(),
});

function resolveStringFlag(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function resolveInitOptions(
	context: ActionCliInputContext,
	templateOverride?: string,
): InitOptions {
	const flags = context.flags as InitFlags;
	const targetDir = context.args[0] ?? process.cwd();
	const name = resolveStringFlag(flags.name);
	const bin = resolveStringFlag(flags.bin);
	const template = templateOverride ?? resolveStringFlag(flags.template);
	const local = Boolean(flags.local || flags.workspace);
	const force = Boolean(flags.force);

	return {
		targetDir,
		name,
		template,
		local,
		force,
		...(bin ? { bin } : {}),
	};
}

const commonInitOptions: ActionCliOption[] = [
	{
		flags: "-n, --name <name>",
		description: "Package name (defaults to directory name)",
	},
	{
		flags: "-b, --bin <name>",
		description: "Binary name (defaults to project name)",
	},
	{
		flags: "-f, --force",
		description: "Overwrite existing files",
		defaultValue: false,
	},
	{
		flags: "--local",
		description: "Use workspace:* for @outfitter dependencies",
		defaultValue: false,
	},
	{
		flags: "--workspace",
		description: "Alias for --local",
		defaultValue: false,
	},
];

const templateOption: ActionCliOption = {
	flags: "-t, --template <template>",
	description: "Template to use",
};

function createInitAction(options: {
	readonly id: string;
	readonly description: string;
	readonly command: string;
	readonly templateOverride?: string;
	readonly includeTemplateOption?: boolean;
}) {
	const initOptions = options.includeTemplateOption
		? [...commonInitOptions, templateOption]
		: commonInitOptions;

	return defineAction({
		id: options.id,
		description: options.description,
		surfaces: ["cli"],
		input: initInputSchema,
		cli: {
			group: "init",
			command: options.command,
			description: options.description,
			options: initOptions,
			mapInput: (context) => resolveInitOptions(context, options.templateOverride),
		},
		handler: async (input) => {
			const result = await runInit(input);
			if (result.isErr()) {
				return Result.err(
					new InternalError({
						message: result.error.message,
						context: { action: options.id },
					}),
				);
			}

			// biome-ignore lint/suspicious/noConsole: CLI output is expected
			console.log(`Project initialized successfully in ${resolve(input.targetDir)}`);

			return Result.ok({ ok: true });
		},
	});
}

const doctorAction = defineAction({
	id: "doctor",
	description: "Validate environment and dependencies",
	surfaces: ["cli"],
	input: doctorInputSchema,
	cli: {
		command: "doctor",
		description: "Validate environment and dependencies",
		mapInput: () => ({ cwd: process.cwd() }),
	},
	handler: async (input) => {
		const result = await runDoctor(input);
		printDoctorResults(result);

		if (result.exitCode !== 0) {
			process.exit(result.exitCode);
		}

		return Result.ok(result);
	},
});

export const outfitterActions = createActionRegistry()
	.add(
		createInitAction({
			id: "init",
			description: "Scaffold a new Outfitter project",
			command: "[directory]",
			includeTemplateOption: true,
		}),
	)
	.add(
		createInitAction({
			id: "init.cli",
			description: "Scaffold a new CLI project",
			command: "cli [directory]",
			templateOverride: "cli",
		}),
	)
	.add(
		createInitAction({
			id: "init.mcp",
			description: "Scaffold a new MCP server",
			command: "mcp [directory]",
			templateOverride: "mcp",
		}),
	)
	.add(
		createInitAction({
			id: "init.daemon",
			description: "Scaffold a new daemon project",
			command: "daemon [directory]",
			templateOverride: "daemon",
		}),
	)
	.add(doctorAction);
