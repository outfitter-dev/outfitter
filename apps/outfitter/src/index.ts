/**
 * Outfitter CLI - Programmatic API.
 *
 * This module exports the programmatic interface for the outfitter CLI,
 * allowing commands to be run from other code.
 *
 * @packageDocumentation
 */

// Init command
export { initCommand, runInit, type InitOptions, InitError } from "./commands/init";
