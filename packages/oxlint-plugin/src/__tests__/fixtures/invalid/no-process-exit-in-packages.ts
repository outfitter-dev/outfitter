/**
 * process.exit() calls should be reported in package source.
 */
export function fatalError(message: string): never {
  console.error(message);
  process.exit(1);
}

export function exitWithCode(code: number): never {
  process.exit(code);
}
