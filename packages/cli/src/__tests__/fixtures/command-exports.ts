import type {
  CLI,
  CLIConfig,
  CommandAction,
  CommandBuilder,
  CommandConfig,
  CommandFlags,
} from "../../command.js";

export const verifyCommandExports = (
  cli: CLI,
  config: CLIConfig,
  builder: CommandBuilder,
  action: CommandAction,
  flags: CommandFlags,
  commandConfig: CommandConfig
): void => {
  void cli;
  void config;
  void builder;
  void action;
  void flags;
  void commandConfig;
};
