/**
 * TaggedError base classes for all concrete error types.
 *
 * Base classes avoid TS9021 warnings from extending expressions directly.
 * Each base class is a TaggedErrorClass that concrete error classes extend.
 *
 * @internal
 */

import type { TaggedErrorClass } from "better-result";
import { TaggedError } from "better-result";

// ---------------------------------------------------------------------------
// TaggedError base classes
// ---------------------------------------------------------------------------

export const ValidationErrorBase: TaggedErrorClass<
  "ValidationError",
  {
    message: string;
    field?: string;
    context?: Record<string, unknown>;
  }
> = TaggedError("ValidationError")<{
  message: string;
  field?: string;
  context?: Record<string, unknown>;
}>();

export const AmbiguousErrorBase: TaggedErrorClass<
  "AmbiguousError",
  {
    message: string;
    candidates: string[];
    context?: Record<string, unknown>;
  }
> = TaggedError("AmbiguousError")<{
  message: string;
  candidates: string[];
  context?: Record<string, unknown>;
}>();

export const AssertionErrorBase: TaggedErrorClass<
  "AssertionError",
  {
    message: string;
  }
> = TaggedError("AssertionError")<{
  message: string;
}>();

export const NotFoundErrorBase: TaggedErrorClass<
  "NotFoundError",
  {
    message: string;
    resourceType: string;
    resourceId: string;
    context?: Record<string, unknown>;
  }
> = TaggedError("NotFoundError")<{
  message: string;
  resourceType: string;
  resourceId: string;
  context?: Record<string, unknown>;
}>();

export const AlreadyExistsErrorBase: TaggedErrorClass<
  "AlreadyExistsError",
  {
    message: string;
    resourceType: string;
    resourceId: string;
    context?: Record<string, unknown>;
  }
> = TaggedError("AlreadyExistsError")<{
  message: string;
  resourceType: string;
  resourceId: string;
  context?: Record<string, unknown>;
}>();

export const ConflictErrorBase: TaggedErrorClass<
  "ConflictError",
  {
    message: string;
    context?: Record<string, unknown>;
  }
> = TaggedError("ConflictError")<{
  message: string;
  context?: Record<string, unknown>;
}>();

export const PermissionErrorBase: TaggedErrorClass<
  "PermissionError",
  {
    message: string;
    context?: Record<string, unknown>;
  }
> = TaggedError("PermissionError")<{
  message: string;
  context?: Record<string, unknown>;
}>();

export const TimeoutErrorBase: TaggedErrorClass<
  "TimeoutError",
  {
    message: string;
    operation: string;
    timeoutMs: number;
  }
> = TaggedError("TimeoutError")<{
  message: string;
  operation: string;
  timeoutMs: number;
}>();

export const RateLimitErrorBase: TaggedErrorClass<
  "RateLimitError",
  {
    message: string;
    retryAfterSeconds?: number;
  }
> = TaggedError("RateLimitError")<{
  message: string;
  retryAfterSeconds?: number;
}>();

export const NetworkErrorBase: TaggedErrorClass<
  "NetworkError",
  {
    message: string;
    context?: Record<string, unknown>;
  }
> = TaggedError("NetworkError")<{
  message: string;
  context?: Record<string, unknown>;
}>();

export const InternalErrorBase: TaggedErrorClass<
  "InternalError",
  {
    message: string;
    context?: Record<string, unknown>;
  }
> = TaggedError("InternalError")<{
  message: string;
  context?: Record<string, unknown>;
}>();

export const AuthErrorBase: TaggedErrorClass<
  "AuthError",
  {
    message: string;
    reason?: "missing" | "invalid" | "expired";
  }
> = TaggedError("AuthError")<{
  message: string;
  reason?: "missing" | "invalid" | "expired";
}>();

export const CancelledErrorBase: TaggedErrorClass<
  "CancelledError",
  {
    message: string;
  }
> = TaggedError("CancelledError")<{
  message: string;
}>();
