/**
 * E2E integration test for the full builder chain.
 *
 * Verifies that all builder-core and presets-envelope features work together:
 * .input(schema).context(factory).hints(fn).preset(preset).handler(fn)
 *
 * Covers: arg parsing → schema validation → context construction →
 * handler invocation → hint generation → envelope wrapping → output
 * in both JSON and human modes.
 *
 * @see VAL-CROSS-001
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { CLIHint, OutfitterError } from "@outfitter/contracts";
import { NotFoundError, ValidationError } from "@outfitter/contracts";
import { Result } from "better-result";
import { z } from "zod";

import { command, createCLI } from "../command.js";
import { runHandler } from "../envelope.js";
import { createSchemaPreset } from "../flags.js";

// =============================================================================
// Test Utilities
// =============================================================================

interface CapturedOutput {
  readonly stderr: string;
  readonly stdout: string;
}

async function captureOutput(
  fn: () => void | Promise<void>
): Promise<CapturedOutput> {
  let stdoutContent = "";
  let stderrContent = "";

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    stdoutContent +=
      typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  };

  process.stderr.write = (chunk: string | Uint8Array): boolean => {
    stderrContent +=
      typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  };

  try {
    await fn();
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  return { stdout: stdoutContent, stderr: stderrContent };
}

function mockProcessExit(): {
  restore: () => void;
  getCapture: () => { exitCode: number | undefined; called: boolean };
} {
  let exitCode: number | undefined;
  let called = false;
  const originalExit = process.exit;

  // @ts-expect-error - mocking process.exit
  process.exit = (code?: number): never => {
    // Capture only the first exit code — Commander may re-call after our mock throws
    if (!called) {
      exitCode = code;
      called = true;
    }
    throw new Error(`process.exit(${code}) called`);
  };

  return {
    restore: () => {
      process.exit = originalExit;
    },
    getCapture: () => ({ exitCode, called }),
  };
}

// =============================================================================
// Shared test fixtures
// =============================================================================

/** Input schema for the test "deploy" command. */
const deployInputSchema = z.object({
  env: z.string().describe("Target environment"),
  replicas: z.number().default(1).describe("Number of replicas"),
  dryRun: z.boolean().default(false).describe("Dry-run mode"),
});

type DeployInput = z.infer<typeof deployInputSchema>;

/** Context produced by the deploy context factory. */
interface DeployContext {
  readonly cluster: string;
  readonly region: string;
}

/** Handler result for the deploy command. */
interface DeployResult {
  readonly status: string;
  readonly env: string;
  readonly replicas: number;
}

/** Verbosity schema-driven preset. */
const verbosityPreset = createSchemaPreset({
  id: "verbosity",
  schema: z.object({
    verbose: z.boolean().default(false).describe("Verbose output"),
  }),
  resolve: (flags) => ({
    verbose: Boolean(flags["verbose"]),
  }),
});

/** Context factory that derives cluster info from the deploy input. */
async function deployContextFactory(
  input: DeployInput
): Promise<DeployContext> {
  // Simulate async context construction
  await new Promise((resolve) => setTimeout(resolve, 1));
  return {
    cluster: input.env === "prod" ? "prod-us-east-1" : "staging-us-west-2",
    region: input.env === "prod" ? "us-east-1" : "us-west-2",
  };
}

/** Success hint function for the deploy command. */
function deploySuccessHints(result: unknown, input: DeployInput): CLIHint[] {
  return [
    {
      description: `Check deployment status in ${input.env}`,
      command: `deploy status --env ${input.env}`,
    },
    {
      description: "View logs",
      command: `deploy logs --env ${input.env}`,
    },
  ];
}

/** Error hint function for the deploy command. */
function deployErrorHints(_error: unknown, input: DeployInput): CLIHint[] {
  return [
    {
      description: "Retry with --dry-run to validate",
      command: `deploy --env ${input.env} --dry-run`,
    },
  ];
}

// =============================================================================
// Setup/Teardown
// =============================================================================

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  process.env = originalEnv;
  delete process.env["OUTFITTER_JSON"];
  delete process.env["OUTFITTER_JSONL"];
});

// =============================================================================
// Full Builder Chain — Success Path (JSON Mode)
// =============================================================================

describe("Full builder chain E2E", () => {
  describe("success path — JSON mode", () => {
    test("parses args, validates schema, constructs context, invokes handler, generates hints, wraps in envelope", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      const callOrder: string[] = [];
      let capturedInput: DeployInput | undefined;
      let capturedContext: DeployContext | undefined;

      cli.register(
        command("deploy")
          .description("Deploy the application")
          .input(deployInputSchema)
          .context(async (input: DeployInput) => {
            callOrder.push("context");
            return deployContextFactory(input);
          })
          .hints(deploySuccessHints)
          .preset(verbosityPreset)
          .action(async ({ input, ctx }) => {
            callOrder.push("handler");
            capturedInput = input as DeployInput;
            capturedContext = ctx as DeployContext;

            await runHandler<DeployInput, DeployResult, DeployContext>({
              command: "deploy",
              handler: async (inp, _ctx) => {
                callOrder.push("runHandler-handler");
                return Result.ok({
                  status: "deployed",
                  env: inp.env,
                  replicas: inp.replicas,
                });
              },
              input: input as DeployInput,
              format: "json",
              contextFactory: async () => ctx as DeployContext,
              hints: deploySuccessHints,
            });
          })
      );

      const captured = await captureOutput(async () => {
        await cli.parse([
          "node",
          "test",
          "deploy",
          "--env",
          "prod",
          "--replicas",
          "3",
          "--verbose",
        ]);
      });

      // Verify call order: context → handler
      expect(callOrder).toContain("context");
      expect(callOrder).toContain("handler");
      expect(callOrder.indexOf("context")).toBeLessThan(
        callOrder.indexOf("handler")
      );

      // Verify input was parsed and validated
      expect(capturedInput).toEqual({
        env: "prod",
        replicas: 3,
        dryRun: false,
      });

      // Verify context was constructed from input
      expect(capturedContext).toEqual({
        cluster: "prod-us-east-1",
        region: "us-east-1",
      });

      // Verify JSON envelope output
      const envelope = JSON.parse(captured.stdout.trim());
      expect(envelope.ok).toBe(true);
      expect(envelope.command).toBe("deploy");
      expect(envelope.result).toEqual({
        status: "deployed",
        env: "prod",
        replicas: 3,
      });
      // Hints present in envelope
      expect(envelope.hints).toBeDefined();
      expect(envelope.hints).toHaveLength(2);
      expect(envelope.hints[0].command).toBe("deploy status --env prod");
      expect(envelope.hints[1].command).toBe("deploy logs --env prod");
    });

    test("defaults are applied from schema when args omitted", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let capturedInput: DeployInput | undefined;

      cli.register(
        command("deploy")
          .description("Deploy the application")
          .input(deployInputSchema)
          .context(deployContextFactory)
          .hints(deploySuccessHints)
          .preset(verbosityPreset)
          .action(async ({ input, ctx }) => {
            capturedInput = input as DeployInput;

            await runHandler<DeployInput, DeployResult, DeployContext>({
              command: "deploy",
              handler: async (inp) =>
                Result.ok({
                  status: "deployed",
                  env: inp.env,
                  replicas: inp.replicas,
                }),
              input: input as DeployInput,
              format: "json",
              contextFactory: async () => ctx as DeployContext,
              hints: deploySuccessHints,
            });
          })
      );

      const captured = await captureOutput(async () => {
        await cli.parse(["node", "test", "deploy", "--env", "staging"]);
      });

      // Defaults applied
      expect(capturedInput).toEqual({
        env: "staging",
        replicas: 1,
        dryRun: false,
      });

      // Context derived from staging env
      const envelope = JSON.parse(captured.stdout.trim());
      expect(envelope.ok).toBe(true);
      expect(envelope.result.env).toBe("staging");
      expect(envelope.result.replicas).toBe(1);
    });
  });

  // ===========================================================================
  // Success Path — Human Mode
  // ===========================================================================

  describe("success path — human mode", () => {
    test("renders readable output with hints as suggestions", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });

      cli.register(
        command("deploy")
          .description("Deploy the application")
          .input(deployInputSchema)
          .context(deployContextFactory)
          .hints(deploySuccessHints)
          .preset(verbosityPreset)
          .action(async ({ input, ctx }) => {
            await runHandler<DeployInput, DeployResult, DeployContext>({
              command: "deploy",
              handler: async (inp) =>
                Result.ok({
                  status: "deployed",
                  env: inp.env,
                  replicas: inp.replicas,
                }),
              input: input as DeployInput,
              format: "human",
              contextFactory: async () => ctx as DeployContext,
              hints: deploySuccessHints,
            });
          })
      );

      const captured = await captureOutput(async () => {
        await cli.parse([
          "node",
          "test",
          "deploy",
          "--env",
          "prod",
          "--replicas",
          "2",
        ]);
      });

      // Human-readable output should contain result fields
      expect(captured.stdout).toContain("deployed");
      expect(captured.stdout).toContain("prod");
      // Should NOT be raw JSON envelope
      expect(captured.stdout).not.toContain('"ok":true');
      // Hints rendered as suggestions
      expect(captured.stdout).toContain("deploy status --env prod");
    });
  });

  // ===========================================================================
  // Error Path — Handler returns Result.err
  // ===========================================================================

  describe("error path — handler returns Result.err", () => {
    test("produces ok: false envelope with category and message in JSON mode", async () => {
      const exitMock = mockProcessExit();

      try {
        const cli = createCLI({ name: "test", version: "0.0.1" });

        cli.register(
          command("deploy")
            .description("Deploy the application")
            .input(deployInputSchema)
            .context(deployContextFactory)
            .hints(deploySuccessHints)
            .onError(deployErrorHints)
            .preset(verbosityPreset)
            .action(async ({ input, ctx }) => {
              await runHandler<DeployInput, DeployResult, DeployContext>({
                command: "deploy",
                handler: async (inp) =>
                  Result.err(
                    new NotFoundError({
                      message: `Environment "${inp.env}" not found`,
                    })
                  ),
                input: input as DeployInput,
                format: "json",
                contextFactory: async () => ctx as DeployContext,
                onError: deployErrorHints,
              });
            })
        );

        const captured = await captureOutput(async () => {
          try {
            await cli.parse(["node", "test", "deploy", "--env", "nonexistent"]);
          } catch {
            // process.exit mock throws
          }
        });

        // Verify error envelope
        const envelope = JSON.parse(captured.stderr.trim());
        expect(envelope.ok).toBe(false);
        expect(envelope.command).toBe("deploy");
        expect(envelope.error.category).toBe("not_found");
        expect(envelope.error.message).toBe(
          'Environment "nonexistent" not found'
        );
        // Error hints present
        expect(envelope.hints).toBeDefined();
        expect(envelope.hints).toHaveLength(1);
        expect(envelope.hints[0].command).toBe(
          "deploy --env nonexistent --dry-run"
        );

        // Exit code should map to not_found → 2
        const capture = exitMock.getCapture();
        expect(capture.called).toBe(true);
        expect(capture.exitCode).toBe(2);
      } finally {
        exitMock.restore();
      }
    });

    test("produces readable error output in human mode", async () => {
      const exitMock = mockProcessExit();

      try {
        const cli = createCLI({ name: "test", version: "0.0.1" });

        cli.register(
          command("deploy")
            .description("Deploy the application")
            .input(deployInputSchema)
            .context(deployContextFactory)
            .onError(deployErrorHints)
            .preset(verbosityPreset)
            .action(async ({ input, ctx }) => {
              await runHandler<DeployInput, DeployResult, DeployContext>({
                command: "deploy",
                handler: async (inp) =>
                  Result.err(
                    new NotFoundError({
                      message: `Environment "${inp.env}" not found`,
                    })
                  ),
                input: input as DeployInput,
                format: "human",
                contextFactory: async () => ctx as DeployContext,
                onError: deployErrorHints,
              });
            })
        );

        const captured = await captureOutput(async () => {
          try {
            await cli.parse(["node", "test", "deploy", "--env", "nonexistent"]);
          } catch {
            // process.exit mock throws
          }
        });

        // Human-readable error on stderr
        expect(captured.stderr).toContain("not found");
        // Hints rendered
        expect(captured.stderr).toContain("--dry-run");
      } finally {
        exitMock.restore();
      }
    });
  });

  // ===========================================================================
  // Error Path — Schema validation failure
  // ===========================================================================

  describe("error path — schema validation failure", () => {
    test("exits with validation error when schema rejects input", async () => {
      const exitMock = mockProcessExit();

      try {
        const cli = createCLI({ name: "test", version: "0.0.1" });

        cli.register(
          command("deploy")
            .description("Deploy the application")
            .input(deployInputSchema)
            .context(deployContextFactory)
            .hints(deploySuccessHints)
            .preset(verbosityPreset)
            .action(async () => {
              // Should never be called
              throw new Error("Handler should not be called");
            })
        );

        let handlerCalled = false;
        const captured = await captureOutput(async () => {
          try {
            // --replicas "abc" → NaN after Commander coercion → Zod rejects
            await cli.parse([
              "node",
              "test",
              "deploy",
              "--env",
              "prod",
              "--replicas",
              "abc",
            ]);
            handlerCalled = true;
          } catch {
            // process.exit mock throws
          }
        });

        // Handler should not be invoked on validation failure
        expect(handlerCalled).toBe(false);
        // Exit code 1 = validation error
        expect(exitMock.getCapture().exitCode).toBe(1);
        // Error output should mention the failing field
        const stderrOutput = captured.stderr;
        expect(stderrOutput).toContain("replicas");
      } finally {
        exitMock.restore();
      }
    });
  });

  // ===========================================================================
  // Error Path — Context factory failure
  // ===========================================================================

  describe("error path — context factory failure", () => {
    test("produces error envelope when context factory throws", async () => {
      const exitMock = mockProcessExit();

      try {
        const cli = createCLI({ name: "test", version: "0.0.1" });
        let handlerCalled = false;

        cli.register(
          command("deploy")
            .description("Deploy the application")
            .input(deployInputSchema)
            .context(async () => {
              throw new Error("Cluster unreachable");
            })
            .hints(deploySuccessHints)
            .preset(verbosityPreset)
            .action(async () => {
              handlerCalled = true;
            })
        );

        const captured = await captureOutput(async () => {
          try {
            await cli.parse(["node", "test", "deploy", "--env", "prod"]);
          } catch {
            // process.exit mock throws
          }
        });

        // Handler not invoked
        expect(handlerCalled).toBe(false);
        // Context error triggers exit
        expect(exitMock.getCapture().called).toBe(true);
        expect(captured.stderr).toContain("Cluster unreachable");
      } finally {
        exitMock.restore();
      }
    });
  });

  // ===========================================================================
  // Preset composition with full chain
  // ===========================================================================

  describe("preset composition in full chain", () => {
    test("schema-driven preset composes with .input() schema and is accessible via flags", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let capturedVerbose: boolean | undefined;

      cli.register(
        command("deploy")
          .description("Deploy the application")
          .input(deployInputSchema)
          .context(deployContextFactory)
          .hints(deploySuccessHints)
          .preset(verbosityPreset)
          .action(async ({ input, flags, ctx }) => {
            capturedVerbose = (flags as Record<string, unknown>)[
              "verbose"
            ] as boolean;

            await runHandler<DeployInput, DeployResult, DeployContext>({
              command: "deploy",
              handler: async (inp) =>
                Result.ok({
                  status: "deployed",
                  env: inp.env,
                  replicas: inp.replicas,
                }),
              input: input as DeployInput,
              format: "json",
              contextFactory: async () => ctx as DeployContext,
              hints: deploySuccessHints,
            });
          })
      );

      const captured = await captureOutput(async () => {
        await cli.parse([
          "node",
          "test",
          "deploy",
          "--env",
          "prod",
          "--verbose",
        ]);
      });

      // Preset flag was resolved
      expect(capturedVerbose).toBe(true);

      // Command still worked end-to-end
      const envelope = JSON.parse(captured.stdout.trim());
      expect(envelope.ok).toBe(true);
    });

    test("multiple presets compose with input in full chain", async () => {
      const formatPreset = createSchemaPreset({
        id: "format",
        schema: z.object({
          format: z
            .enum(["json", "text"])
            .default("text")
            .describe("Output format"),
        }),
        resolve: (flags) => ({
          format: (flags["format"] as string) ?? "text",
        }),
      });

      const cli = createCLI({ name: "test", version: "0.0.1" });
      let capturedFlags: Record<string, unknown> | undefined;

      cli.register(
        command("deploy")
          .description("Deploy the application")
          .input(deployInputSchema)
          .context(deployContextFactory)
          .hints(deploySuccessHints)
          .preset(verbosityPreset)
          .preset(formatPreset)
          .action(async ({ input, flags, ctx }) => {
            capturedFlags = flags as Record<string, unknown>;

            await runHandler({
              command: "deploy",
              handler: async (inp: DeployInput) =>
                Result.ok({
                  status: "deployed",
                  env: inp.env,
                  replicas: inp.replicas,
                }),
              input: input as DeployInput,
              format: "json",
              contextFactory: async () => ctx as DeployContext,
            });
          })
      );

      const captured = await captureOutput(async () => {
        await cli.parse([
          "node",
          "test",
          "deploy",
          "--env",
          "prod",
          "--verbose",
          "--format",
          "json",
        ]);
      });

      expect(capturedFlags?.["verbose"]).toBe(true);
      expect(capturedFlags?.["format"]).toBe("json");

      const envelope = JSON.parse(captured.stdout.trim());
      expect(envelope.ok).toBe(true);
    });
  });

  // ===========================================================================
  // runHandler() direct usage with full chain
  // ===========================================================================

  describe("runHandler() bridges full lifecycle", () => {
    test("context → handler → Result → envelope → output → exit code", async () => {
      const callOrder: string[] = [];

      const captured = await captureOutput(async () => {
        await runHandler<DeployInput, DeployResult, DeployContext>({
          command: "deploy",
          input: { env: "prod", replicas: 3, dryRun: false },
          format: "json",
          contextFactory: async (input) => {
            callOrder.push("contextFactory");
            return deployContextFactory(input);
          },
          handler: async (input, context) => {
            callOrder.push("handler");
            // Verify context was constructed
            expect(context.cluster).toBe("prod-us-east-1");
            return Result.ok({
              status: "deployed",
              env: input.env,
              replicas: input.replicas,
            });
          },
          hints: (result, input) => {
            callOrder.push("hints");
            return deploySuccessHints(result, input);
          },
          onError: deployErrorHints,
        });
      });

      // Lifecycle order: context → handler → hints
      expect(callOrder).toEqual(["contextFactory", "handler", "hints"]);

      // Full envelope in JSON
      const envelope = JSON.parse(captured.stdout.trim());
      expect(envelope).toEqual({
        ok: true,
        command: "deploy",
        result: {
          status: "deployed",
          env: "prod",
          replicas: 3,
        },
        hints: [
          {
            description: "Check deployment status in prod",
            command: "deploy status --env prod",
          },
          {
            description: "View logs",
            command: "deploy logs --env prod",
          },
        ],
      });
    });

    test("error path: context → handler (err) → onError → envelope → exit", async () => {
      const exitMock = mockProcessExit();
      const callOrder: string[] = [];

      try {
        const captured = await captureOutput(async () => {
          try {
            await runHandler<DeployInput, DeployResult, DeployContext>({
              command: "deploy",
              input: { env: "invalid", replicas: 1, dryRun: false },
              format: "json",
              contextFactory: async (input) => {
                callOrder.push("contextFactory");
                return deployContextFactory(input);
              },
              handler: async (input) => {
                callOrder.push("handler");
                return Result.err(
                  new NotFoundError({
                    message: `Environment "${input.env}" not found`,
                  })
                );
              },
              hints: deploySuccessHints,
              onError: (_error, input) => {
                callOrder.push("onError");
                return deployErrorHints(_error, input);
              },
            });
          } catch {
            // process.exit mock throws
          }
        });

        // Lifecycle order: context → handler → onError (no hints — error path)
        expect(callOrder).toEqual(["contextFactory", "handler", "onError"]);

        const envelope = JSON.parse(captured.stderr.trim());
        expect(envelope).toEqual({
          ok: false,
          command: "deploy",
          error: {
            category: "not_found",
            message: 'Environment "invalid" not found',
          },
          hints: [
            {
              description: "Retry with --dry-run to validate",
              command: "deploy --env invalid --dry-run",
            },
          ],
        });

        // not_found → exit code 2
        expect(exitMock.getCapture().exitCode).toBe(2);
      } finally {
        exitMock.restore();
      }
    });
  });

  // ===========================================================================
  // Hints absent when not provided
  // ===========================================================================

  describe("hints field absent when no hints", () => {
    test("JSON envelope omits hints key when no hint functions provided", async () => {
      const captured = await captureOutput(async () => {
        await runHandler<DeployInput, DeployResult>({
          command: "deploy",
          input: { env: "prod", replicas: 1, dryRun: false },
          format: "json",
          handler: async (input) =>
            Result.ok({
              status: "deployed",
              env: input.env,
              replicas: input.replicas,
            }),
        });
      });

      const envelope = JSON.parse(captured.stdout.trim());
      expect(envelope.ok).toBe(true);
      expect("hints" in envelope).toBe(false);
    });
  });

  // ===========================================================================
  // End-to-end with CLI parse + runHandler
  // ===========================================================================

  describe("CLI parse → runHandler full integration", () => {
    test("complete chain from CLI args to JSON envelope output", async () => {
      const cli = createCLI({ name: "myapp", version: "1.0.0" });

      // Define a complete command with ALL builder chain methods
      cli.register(
        command("deploy")
          .description("Deploy the application to an environment")
          .input(deployInputSchema)
          .context(deployContextFactory)
          .hints(deploySuccessHints)
          .onError(deployErrorHints)
          .preset(verbosityPreset)
          .action(async ({ input, ctx }) => {
            // Bridge to runHandler for full lifecycle
            await runHandler<DeployInput, DeployResult, DeployContext>({
              command: "deploy",
              handler: async (inp, context) => {
                // Handler receives validated input and context
                return Result.ok({
                  status: `deployed to ${context.cluster}`,
                  env: inp.env,
                  replicas: inp.replicas,
                });
              },
              input: input as DeployInput,
              format: "json",
              contextFactory: async () => ctx as DeployContext,
              hints: deploySuccessHints,
              onError: deployErrorHints,
            });
          })
      );

      const captured = await captureOutput(async () => {
        await cli.parse([
          "node",
          "myapp",
          "deploy",
          "--env",
          "prod",
          "--replicas",
          "5",
          "--dry-run",
          "--verbose",
        ]);
      });

      // Full envelope verification
      const envelope = JSON.parse(captured.stdout.trim());

      // Structure
      expect(envelope.ok).toBe(true);
      expect(envelope.command).toBe("deploy");

      // Result includes context-derived data
      expect(envelope.result.status).toBe("deployed to prod-us-east-1");
      expect(envelope.result.env).toBe("prod");
      expect(envelope.result.replicas).toBe(5);

      // Hints generated from input
      expect(envelope.hints).toHaveLength(2);
      expect(envelope.hints[0]).toEqual({
        description: "Check deployment status in prod",
        command: "deploy status --env prod",
      });
    });
  });
});
