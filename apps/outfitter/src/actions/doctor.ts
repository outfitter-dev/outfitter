/**
 * Doctor action definition.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";
import { cwdPreset } from "@outfitter/cli/flags";
import { defineAction, Result } from "@outfitter/contracts";
import { z } from "zod";
import { printDoctorResults, runDoctor } from "../commands/doctor.js";
import {
  type CliOutputMode,
  resolveOutputModeFromContext,
} from "../output-mode.js";
import { outputModeSchema } from "./shared.js";

interface DoctorActionInput {
  cwd: string;
  outputMode: CliOutputMode;
}

const doctorInputSchema = z.object({
  cwd: z.string(),
  outputMode: outputModeSchema,
}) as z.ZodType<DoctorActionInput>;

const doctorCwd = cwdPreset();

export const doctorAction = defineAction({
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
      const { cwd: rawCwd } = doctorCwd.resolve(context.flags);
      const cwd = resolve(process.cwd(), rawCwd);
      return {
        cwd,
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
