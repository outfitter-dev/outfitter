import type {
  CLI,
  CLIConfig,
  CommandAction,
  CommandBuilder,
  CommandConfig,
  CommandFlags,
  ErrorHintFn,
  SuccessHintFn,
} from "../../command.js";

export const verifyCommandExports = (
  cli: CLI,
  config: CLIConfig,
  builder: CommandBuilder,
  action: CommandAction,
  flags: CommandFlags,
  commandConfig: CommandConfig,
  successHintFn: SuccessHintFn,
  errorHintFn: ErrorHintFn
): void => {
  void cli;
  void config;
  void builder;
  void action;
  void flags;
  void commandConfig;
  void successHintFn;
  void errorHintFn;
};
