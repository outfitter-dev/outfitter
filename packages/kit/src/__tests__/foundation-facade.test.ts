import { describe, expect, it } from "bun:test";
import {
  createLoggerFactory as ContractCreateLoggerFactory,
  ValidationError,
} from "@outfitter/contracts";
import { brand, isDefined } from "@outfitter/types";
import {
  Result as FoundationContractsResult,
  createLoggerFactory as FoundationCreateLoggerFactory,
} from "../foundation/contracts";
import {
  Result as FoundationResult,
  ValidationError as FoundationValidationError,
} from "../foundation/index";
import {
  brand as foundationBrand,
  isDefined as foundationIsDefined,
} from "../foundation/types";
import {
  Result as RootResult,
  Types as RootTypes,
  ValidationError as RootValidationError,
} from "../index";

describe("@outfitter/kit foundation facade", () => {
  it("root facade re-exports contracts surface", () => {
    const ok = RootResult.ok({ ok: true });
    expect(ok.isOk()).toBe(true);
    expect(RootValidationError).toBe(ValidationError);
  });

  it("root facade exposes types as a namespace", () => {
    expect(RootTypes.brand).toBe(brand);
    expect(RootTypes.isDefined).toBe(isDefined);
  });

  it("foundation facade exports contracts directly", () => {
    const err = FoundationResult.err(
      new FoundationValidationError({ message: "bad" })
    );
    expect(err.isErr()).toBe(true);
  });

  it("foundation/contracts forwards logger contract types", () => {
    expect(FoundationCreateLoggerFactory).toBe(ContractCreateLoggerFactory);
    expect(FoundationContractsResult).toBe(RootResult);
  });

  it("foundation/types forwards branded and guard helpers", () => {
    expect(foundationBrand).toBe(brand);
    expect(foundationIsDefined).toBe(isDefined);
  });
});
