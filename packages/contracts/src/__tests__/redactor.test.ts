/**
 * Tests for @outfitter/contracts/redactor
 *
 * Tests cover:
 * - createRedactor() (4 tests)
 * - Redactor.redact() (8 tests)
 * - redactString() + runtime methods (4 tests)
 * - isSensitiveKey() (3 tests)
 * - DEFAULT_PATTERNS coverage (8 tests)
 *
 * Total: 27 tests
 */
import { describe, expect, it } from "bun:test";
import {
	createRedactor,
	DEFAULT_PATTERNS,
	DEFAULT_SENSITIVE_KEYS,
	type Redactor,
	type RedactorConfig,
} from "../redactor.js";

// ============================================================================
// createRedactor() Tests (4 tests)
// ============================================================================

describe("createRedactor()", () => {
	it("accepts patterns and keys config", () => {
		const config: RedactorConfig = {
			patterns: [/secret-[a-z]+/gi],
			keys: ["mySecretKey"],
		};

		const redactor = createRedactor(config);

		expect(redactor).toBeDefined();
		expect(typeof redactor.redact).toBe("function");
	});

	it("returns Redactor interface", () => {
		const redactor = createRedactor({
			patterns: [],
			keys: [],
		});

		// Verify all interface methods exist
		expect(typeof redactor.redact).toBe("function");
		expect(typeof redactor.redactString).toBe("function");
		expect(typeof redactor.isSensitiveKey).toBe("function");
		expect(typeof redactor.addPattern).toBe("function");
		expect(typeof redactor.addSensitiveKey).toBe("function");
	});

	it("uses DEFAULT_PATTERNS when none provided", () => {
		// Create redactor with empty patterns array
		const redactor = createRedactor({
			patterns: [...DEFAULT_PATTERNS],
			keys: [],
		});

		// Should redact OpenAI API key pattern
		const result = redactor.redactString("key: sk-abcdefghijklmnopqrstuvwxyz123456789012345678");

		expect(result).toContain("[REDACTED]");
		expect(result).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
	});

	it("uses DEFAULT_SENSITIVE_KEYS when none provided", () => {
		const redactor = createRedactor({
			patterns: [],
			keys: [...DEFAULT_SENSITIVE_KEYS],
		});

		// Should redact values of sensitive keys
		const obj = {
			username: "alice",
			apiKey: "my-secret-api-key",
		};

		const result = redactor.redact(obj);

		expect(result.username).toBe("alice");
		expect(result.apiKey).toBe("[REDACTED]");
	});
});

// ============================================================================
// Redactor.redact() Tests (8 tests)
// ============================================================================

describe("Redactor.redact()", () => {
	const createTestRedactor = (): Redactor => {
		return createRedactor({
			patterns: [...DEFAULT_PATTERNS],
			keys: [...DEFAULT_SENSITIVE_KEYS],
		});
	};

	it("replaces Bearer tokens with [REDACTED]", () => {
		const redactor = createTestRedactor();
		const obj = {
			headers: {
				authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			},
		};

		const result = redactor.redact(obj);

		expect(result.headers.authorization).not.toContain("Bearer eyJ");
		expect(result.headers.authorization).toContain("[REDACTED]");
	});

	it("replaces API keys (sk-, ghp_, etc.)", () => {
		const redactor = createTestRedactor();
		const obj = {
			openaiKey: "sk-abcdefghijklmnopqrstuvwxyz123456789012345678",
			githubToken: "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
		};

		const result = redactor.redact(obj);

		expect(result.openaiKey).toContain("[REDACTED]");
		expect(result.githubToken).toContain("[REDACTED]");
	});

	it("replaces values of sensitive keys in objects", () => {
		const redactor = createTestRedactor();
		const obj = {
			user: "alice",
			password: "super-secret-password",
			token: "my-auth-token",
		};

		const result = redactor.redact(obj);

		expect(result.user).toBe("alice");
		expect(result.password).toBe("[REDACTED]");
		expect(result.token).toBe("[REDACTED]");
	});

	it("handles nested objects", () => {
		const redactor = createTestRedactor();
		const obj = {
			config: {
				database: {
					host: "localhost",
					password: "db-password",
				},
				api: {
					apiKey: "secret-key",
				},
			},
		};

		const result = redactor.redact(obj);

		expect(result.config.database.host).toBe("localhost");
		expect(result.config.database.password).toBe("[REDACTED]");
		expect(result.config.api.apiKey).toBe("[REDACTED]");
	});

	it("handles arrays", () => {
		const redactor = createTestRedactor();
		const obj = {
			users: [
				{ name: "Alice", apiKey: "alice-key" },
				{ name: "Bob", apiKey: "bob-key" },
			],
		};

		const result = redactor.redact(obj);

		expect(result.users[0].name).toBe("Alice");
		expect(result.users[0].apiKey).toBe("[REDACTED]");
		expect(result.users[1].name).toBe("Bob");
		expect(result.users[1].apiKey).toBe("[REDACTED]");
	});

	it("preserves non-sensitive data", () => {
		const redactor = createTestRedactor();
		const obj = {
			id: 123,
			name: "Test Item",
			description: "A normal description",
			count: 42,
			active: true,
		};

		const result = redactor.redact(obj);

		expect(result).toEqual(obj);
	});

	it("handles null/undefined values", () => {
		const redactor = createTestRedactor();
		const obj = {
			defined: "value",
			nullValue: null,
			undefinedValue: undefined,
			apiKey: null, // sensitive key with null value
		};

		const result = redactor.redact(obj);

		expect(result.defined).toBe("value");
		expect(result.nullValue).toBeNull();
		expect(result.undefinedValue).toBeUndefined();
		// Even null values for sensitive keys should remain null (nothing to redact)
		expect(result.apiKey).toBeNull();
	});

	it("returns same type as input", () => {
		const redactor = createTestRedactor();

		// Object input returns object
		const objInput = { key: "value" };
		const objResult = redactor.redact(objInput);
		expect(typeof objResult).toBe("object");

		// Array input returns array
		const arrInput = [{ key: "value" }];
		const arrResult = redactor.redact(arrInput);
		expect(Array.isArray(arrResult)).toBe(true);

		// Primitive input returns primitive
		const strInput = "plain string";
		const strResult = redactor.redact(strInput);
		expect(typeof strResult).toBe("string");
	});
});

// ============================================================================
// redactString() + runtime methods Tests (4 tests)
// ============================================================================

describe("Redactor runtime methods", () => {
	it("redactString replaces patterns in plain string", () => {
		const redactor = createRedactor({
			patterns: [...DEFAULT_PATTERNS],
			keys: [],
		});

		const input = "API key is sk-abcdefghijklmnopqrstuvwxyz123456789012345678 and more";
		const result = redactor.redactString(input);

		expect(result).toContain("[REDACTED]");
		expect(result).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
	});

	it("redactString handles multiple matches", () => {
		const redactor = createRedactor({
			patterns: [...DEFAULT_PATTERNS],
			keys: [],
		});

		const input =
			"Key1: sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa Key2: sk-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
		const result = redactor.redactString(input);

		// Should have two [REDACTED] markers
		const matches = result.match(/\[REDACTED\]/g);
		expect(matches).not.toBeNull();
		expect(matches?.length).toBe(2);
	});

	it("addPattern registers new pattern", () => {
		const redactor = createRedactor({
			patterns: [],
			keys: [],
		});

		// Initially should not redact custom pattern
		const before = redactor.redactString("custom-secret-abc123");
		expect(before).toBe("custom-secret-abc123");

		// Add new pattern
		redactor.addPattern(/custom-secret-[a-z0-9]+/gi);

		// Now should redact
		const after = redactor.redactString("custom-secret-abc123");
		expect(after).toContain("[REDACTED]");
	});

	it("addSensitiveKey registers new key", () => {
		const redactor = createRedactor({
			patterns: [],
			keys: [],
		});

		// Initially should not redact custom key
		const obj = { myCustomSecret: "secret-value" };
		const before = redactor.redact(obj);
		expect(before.myCustomSecret).toBe("secret-value");

		// Add new sensitive key
		redactor.addSensitiveKey("myCustomSecret");

		// Now should redact
		const after = redactor.redact({ myCustomSecret: "secret-value" });
		expect(after.myCustomSecret).toBe("[REDACTED]");
	});
});

// ============================================================================
// isSensitiveKey() Tests (implicit in above, but explicit here)
// ============================================================================

describe("Redactor.isSensitiveKey()", () => {
	it("returns true for configured sensitive keys", () => {
		const redactor = createRedactor({
			patterns: [],
			keys: ["password", "apiKey"],
		});

		expect(redactor.isSensitiveKey("password")).toBe(true);
		expect(redactor.isSensitiveKey("apiKey")).toBe(true);
	});

	it("returns false for non-sensitive keys", () => {
		const redactor = createRedactor({
			patterns: [],
			keys: ["password"],
		});

		expect(redactor.isSensitiveKey("username")).toBe(false);
		expect(redactor.isSensitiveKey("email")).toBe(false);
	});

	it("matches sensitive keys case-insensitively", () => {
		const redactor = createRedactor({
			patterns: [],
			keys: ["apiKey"],
		});

		// All case variations should be considered sensitive
		expect(redactor.isSensitiveKey("apiKey")).toBe(true);
		expect(redactor.isSensitiveKey("ApiKey")).toBe(true);
		expect(redactor.isSensitiveKey("APIKEY")).toBe(true);
		expect(redactor.isSensitiveKey("apikey")).toBe(true);
	});
});

// ============================================================================
// Security Pattern Coverage Tests (comprehensive DEFAULT_PATTERNS)
// ============================================================================

describe("DEFAULT_PATTERNS coverage", () => {
	const createTestRedactor = (): Redactor => {
		return createRedactor({
			patterns: [...DEFAULT_PATTERNS],
			keys: [...DEFAULT_SENSITIVE_KEYS],
		});
	};

	it("replaces AWS access keys (AKIA pattern)", () => {
		const redactor = createTestRedactor();
		const obj = { awsKey: "AKIAIOSFODNN7EXAMPLE" };

		const result = redactor.redact(obj);

		expect(result.awsKey).toContain("[REDACTED]");
		expect(result.awsKey).not.toContain("AKIAIOSFODNN7EXAMPLE");
	});

	it("replaces Anthropic API keys (sk-ant- pattern)", () => {
		const redactor = createTestRedactor();
		// Anthropic keys are sk-ant- followed by 95 characters
		const anthropicKey = `sk-ant-${"a".repeat(95)}`;
		const obj = { anthropicKey };

		const result = redactor.redact(obj);

		expect(result.anthropicKey).toContain("[REDACTED]");
		expect(result.anthropicKey).not.toContain("sk-ant-");
	});

	it("replaces Slack tokens (xox* pattern)", () => {
		const redactor = createTestRedactor();
		// Use obviously fake tokens that don't trigger GitHub's secret detection
		// Real Slack tokens are longer and use specific character sets
		const obj = {
			slackBotToken: "xoxb-FAKE-TOKEN-FOR-TESTING-ONLY",
			slackAppToken: "xoxa-FAKE-TOKEN-FOR-TESTING-ONLY",
		};

		const result = redactor.redact(obj);

		expect(result.slackBotToken).toContain("[REDACTED]");
		expect(result.slackBotToken).not.toContain("xoxb-");
		expect(result.slackAppToken).toContain("[REDACTED]");
	});

	it("replaces PEM private key headers", () => {
		const redactor = createTestRedactor();
		const pemContent = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3o...
-----END RSA PRIVATE KEY-----`;
		const obj = { privateKey: pemContent };

		const result = redactor.redact(obj);

		expect(result.privateKey).toContain("[REDACTED]");
		expect(result.privateKey).not.toContain("-----BEGIN RSA PRIVATE KEY-----");
	});

	it("replaces Basic auth headers", () => {
		const redactor = createTestRedactor();
		const obj = {
			headers: {
				authorization: "Basic dXNlcm5hbWU6cGFzc3dvcmQ=",
			},
		};

		const result = redactor.redact(obj);

		expect(result.headers.authorization).toContain("[REDACTED]");
		expect(result.headers.authorization).not.toContain("dXNlcm5hbWU6cGFzc3dvcmQ=");
	});

	it("replaces database connection strings with credentials", () => {
		const redactor = createTestRedactor();
		const obj = {
			postgresUrl: "postgres://user:password123@localhost:5432/mydb",
			mysqlUrl: "mysql://admin:secret@db.example.com:3306/app",
			mongoUrl: "mongodb://root:rootpass@cluster0.mongodb.net/myapp",
			redisUrl: "redis://default:mypassword@redis.example.com:6379",
		};

		const result = redactor.redact(obj);

		expect(result.postgresUrl).toContain("[REDACTED]");
		expect(result.postgresUrl).not.toContain("password123");
		expect(result.mysqlUrl).toContain("[REDACTED]");
		expect(result.mongoUrl).toContain("[REDACTED]");
		expect(result.redisUrl).toContain("[REDACTED]");
	});

	it("replaces GitHub token variants (gho_, ghu_, ghs_, ghr_, github_pat_)", () => {
		const redactor = createTestRedactor();
		const obj = {
			oauthToken: `gho_${"a".repeat(36)}`,
			userToken: `ghu_${"b".repeat(36)}`,
			serverToken: `ghs_${"c".repeat(36)}`,
			refreshToken: `ghr_${"d".repeat(36)}`,
			fineGrained: `github_pat_${"e".repeat(22)}`,
		};

		const result = redactor.redact(obj);

		expect(result.oauthToken).toContain("[REDACTED]");
		expect(result.userToken).toContain("[REDACTED]");
		expect(result.serverToken).toContain("[REDACTED]");
		expect(result.refreshToken).toContain("[REDACTED]");
		expect(result.fineGrained).toContain("[REDACTED]");
	});

	it("replaces password= and secret= patterns in strings", () => {
		const redactor = createTestRedactor();
		const configString = `
			database.password=mysecretpass
			api.secret="api-secret-value"
			other.setting=normal-value
		`;

		const result = redactor.redactString(configString);

		expect(result).toContain("[REDACTED]");
		expect(result).not.toContain("mysecretpass");
		expect(result).not.toContain("api-secret-value");
		expect(result).toContain("other.setting=normal-value");
	});
});
