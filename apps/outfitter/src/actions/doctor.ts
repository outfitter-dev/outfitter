/**
 * Doctor action definition.
 *
 * @packageDocumentation
 */

import { cwdPreset } from "@outfitter/cli/flags";
import { defineAction, Result } from "@outfitter/contracts";
import { z } from "zod";

import { printDoctorResults, runDoctor } from "../commands/doctor.js";
import {
  type CliOutputMode,
  resolveOutputModeFromContext,
} from "../output-mode.js";
import { outputModeSchema, resolveCwdFromPreset } from "./shared.js";

interface DoctorActionInput {
  readonly cwd: string;
  readonly outputMode: CliOutputMode;
}

type DoctorAction = ReturnType<typeof defineAction<DoctorActionInput, unknown>>;

const doctorInputSchema = z.object({
  cwd: z.string(),
  outputMode: outputModeSchema,
});

const doctorCwd = cwdPreset();

/** Validate the local environment, toolchain, and project dependencies. */
export const doctorAction: DoctorAction = defineAction({
  id: "doctor",
  description: "Validate environment and dependencies",
  surfaces: ["cli"],
  input: doctorInputSchema,
  cli: {
    command: "doctor",
    description: "Validate environment and dependencies",
    options: [...doctorCwd.options],
    mapInput: (context) => {
      const outputMode = resolveOutputModeFromContext(context.flags);
      return {
        cwd: resolveCwdFromPreset(context.flags, doctorCwd),
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ...doctorInput } = input;
    const result = await runDoctor(doctorInput);
    await printDoctorResults(result, { mode: outputMode });

    if (result.exitCode !== 0) {
      process.exit(result.exitCode);
    }

    return Result.ok(result);
  },
});
