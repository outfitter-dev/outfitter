/**
 * Tests for DEFAULT_PATTERNS secret redaction in log messages.
 *
 * These patterns are applied to message strings and stringified metadata values
 * to prevent accidental exposure of secrets like Bearer tokens, GitHub PATs,
 * API keys, and PEM private keys.
 */
import { describe, expect, it } from "bun:test";
import {
  createLogger,
  DEFAULT_PATTERNS,
  type LogRecord,
  type Sink,
} from "../index.js";

// ============================================================================
// DEFAULT_PATTERNS Export Tests
// ============================================================================

describe("DEFAULT_PATTERNS", () => {
  it("is exported and is an array of RegExp", () => {
    expect(DEFAULT_PATTERNS).toBeDefined();
    expect(Array.isArray(DEFAULT_PATTERNS)).toBe(true);
    expect(DEFAULT_PATTERNS.length).toBeGreaterThan(0);
    for (const pattern of DEFAULT_PATTERNS) {
      expect(pattern).toBeInstanceOf(RegExp);
    }
  });
});

// ============================================================================
// Message String Redaction Tests
// ============================================================================

describe("Message String Redaction", () => {
  it("Bearer token in message string is redacted", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: true },
    });

    logger.info(
      "Auth header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature"
    );

    expect(records[0].message).not.toContain(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    );
    expect(records[0].message).toContain("[REDACTED]");
  });

  it("GitHub PAT (ghp_xxx) in message is redacted", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: true },
    });

    // GitHub PATs are ghp_ + 36 alphanumeric characters
    logger.info(
      "Using token ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8 for auth"
    );

    expect(records[0].message).not.toContain(
      "ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"
    );
    expect(records[0].message).toContain("[REDACTED]");
  });

  it("GitHub OAuth token (gho_xxx) in message is redacted", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: true },
    });

    // GitHub OAuth tokens are gho_ + 36 alphanumeric characters
    logger.info("OAuth token: gho_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8");

    expect(records[0].message).not.toContain(
      "gho_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"
    );
    expect(records[0].message).toContain("[REDACTED]");
  });

  it("GitHub App token (ghs_xxx) in message is redacted", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: true },
    });

    // GitHub App tokens are ghs_ + 36 alphanumeric characters
    logger.info("App token: ghs_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8");

    expect(records[0].message).not.toContain(
      "ghs_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"
    );
    expect(records[0].message).toContain("[REDACTED]");
  });

  it("GitHub refresh token (ghr_xxx) in message is redacted", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: true },
    });

    // GitHub refresh tokens are ghr_ + 36 alphanumeric characters
    logger.info("Refresh: ghr_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8");

    expect(records[0].message).not.toContain(
      "ghr_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"
    );
    expect(records[0].message).toContain("[REDACTED]");
  });

  it("API key pattern (api_key=xxx) in message is redacted", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: true },
    });

    logger.info("Request with api_key=sk_live_abc123xyz");

    expect(records[0].message).not.toContain("api_key=sk_live_abc123xyz");
    expect(records[0].message).toContain("[REDACTED]");
  });

  it("API key with colon separator (apikey: xxx) in message is redacted", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: true },
    });

    logger.info('Config has apikey: "my-secret-key-123"');

    expect(records[0].message).not.toContain("my-secret-key-123");
    expect(records[0].message).toContain("[REDACTED]");
  });

  it("Multiple patterns in same message are all redacted", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: true },
    });

    // Use correct token lengths (36 chars after prefix for GitHub PAT)
    logger.info(
      "Using Bearer token123.payload.sig and ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"
    );

    expect(records[0].message).not.toContain("Bearer token123");
    expect(records[0].message).not.toContain(
      "ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"
    );
    // Should have two [REDACTED] markers
    const redactedCount = (records[0].message.match(/\[REDACTED\]/g) || [])
      .length;
    expect(redactedCount).toBe(2);
  });

  it("Non-matching content in message is preserved", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: true },
    });

    logger.info("User logged in successfully from 192.168.1.1");

    expect(records[0].message).toBe(
      "User logged in successfully from 192.168.1.1"
    );
  });
});

// ============================================================================
// PEM Key Redaction Tests
// ============================================================================

describe("PEM Key Redaction", () => {
  it("PEM private key in metadata value is redacted", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: true },
    });

    const pemKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7
-----END PRIVATE KEY-----`;

    logger.info("Loaded config", { privateKey: pemKey });

    const metadata = records[0].metadata;
    expect(metadata?.privateKey).not.toContain("BEGIN PRIVATE KEY");
    expect(metadata?.privateKey).toContain("[REDACTED]");
  });

  it("RSA private key in metadata value is redacted", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: true },
    });

    const rsaKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy
-----END RSA PRIVATE KEY-----`;

    logger.info("Config loaded", { key: rsaKey });

    const metadata = records[0].metadata;
    expect(metadata?.key).not.toContain("BEGIN RSA PRIVATE KEY");
    expect(metadata?.key).toContain("[REDACTED]");
  });

  it("PEM private key in message string is redacted", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: true },
    });

    const pemKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7
-----END PRIVATE KEY-----`;

    logger.info(`Loading key: ${pemKey}`);

    expect(records[0].message).not.toContain("BEGIN PRIVATE KEY");
    expect(records[0].message).toContain("[REDACTED]");
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Redaction Edge Cases", () => {
  it("redaction disabled does not redact patterns in message", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: false },
    });

    // Use correct token length (36 chars after prefix)
    logger.info("Token: ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8");

    // Should NOT be redacted when disabled
    expect(records[0].message).toContain(
      "ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"
    );
  });

  it("custom replacement string is used for message redaction", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: {
        enabled: true,
        replacement: "***HIDDEN***",
      },
    });

    logger.info("Auth: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig");

    expect(records[0].message).toContain("***HIDDEN***");
    expect(records[0].message).not.toContain("[REDACTED]");
  });

  it("Bearer token with equals padding is redacted", () => {
    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };

    const logger = createLogger({
      name: "test",
      sinks: [sink],
      redaction: { enabled: true },
    });

    logger.info("Header: Bearer eyJhbGc9PT0=");

    expect(records[0].message).not.toContain("eyJhbGc9PT0=");
    expect(records[0].message).toContain("[REDACTED]");
  });
});
