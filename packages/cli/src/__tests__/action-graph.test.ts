/**
 * Tests for .relatedTo() CommandBuilder method and action graph (tier-4 hints).
 *
 * Covers:
 * - .relatedTo(target, options?) chainable on CommandBuilder (VAL-GRAPH-001)
 * - Action graph builds from registered commands and declarations (VAL-GRAPH-002)
 * - Invalid targets and edge cases handled safely (VAL-GRAPH-003)
 * - Tier-4 success hints use graph neighbors (VAL-GRAPH-004)
 * - Tier-4 error hints include remediation paths (VAL-GRAPH-005)
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";

import { Command } from "commander";

import { command } from "../command.js";
import {
  buildActionGraph,
  graphErrorHints,
  graphSuccessHints,
} from "../hints.js";
import type { ActionGraph } from "../hints.js";

// =============================================================================
// VAL-GRAPH-001: .relatedTo() is available and chainable
// =============================================================================

describe(".relatedTo() builder method (VAL-GRAPH-001)", () => {
  test(".relatedTo(target) is chainable", () => {
    const builder = command("deploy")
      .description("Deploy application")
      .relatedTo("status")
      .action(async () => {});

    const cmd = builder.build();
    expect(cmd.name()).toBe("deploy");
  });

  test(".relatedTo(target, options) accepts description", () => {
    const builder = command("deploy")
      .description("Deploy application")
      .relatedTo("status", { description: "Check deployment status" })
      .action(async () => {});

    const cmd = builder.build();
    expect(cmd.name()).toBe("deploy");
  });

  test("multiple .relatedTo() calls are chainable", () => {
    const builder = command("deploy")
      .description("Deploy application")
      .relatedTo("status", { description: "Check status" })
      .relatedTo("rollback", { description: "Rollback if needed" })
      .action(async () => {});

    const cmd = builder.build();
    expect(cmd.name()).toBe("deploy");
  });

  test("chains with other builder methods", () => {
    const builder = command("deploy")
      .description("Deploy application")
      .readOnly(false)
      .idempotent(false)
      .relatedTo("status")
      .option("--env <env>", "Target environment")
      .action(async () => {});

    const cmd = builder.build();
    expect(cmd.name()).toBe("deploy");
  });
});

// =============================================================================
// VAL-GRAPH-002: Action graph builds from .relatedTo() declarations
// =============================================================================

describe("Action graph construction (VAL-GRAPH-002)", () => {
  test("builds graph with nodes for each registered command", () => {
    const program = new Command("cli");
    program.addCommand(
      command("list")
        .description("List")
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("get")
        .description("Get")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);

    expect(graph.nodes).toContain("list");
    expect(graph.nodes).toContain("get");
  });

  test("builds graph with edges from .relatedTo() declarations", () => {
    const program = new Command("cli");
    program.addCommand(
      command("deploy")
        .description("Deploy")
        .relatedTo("status", { description: "Check status" })
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("status")
        .description("Check status")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);

    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0]).toEqual({
      from: "deploy",
      to: "status",
      description: "Check status",
    });
  });

  test("builds graph with multiple edges", () => {
    const program = new Command("cli");
    program.addCommand(
      command("deploy")
        .description("Deploy")
        .relatedTo("status", { description: "Check status" })
        .relatedTo("rollback", { description: "Rollback deployment" })
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("status")
        .description("Status")
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("rollback")
        .description("Rollback")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);

    expect(graph.edges.length).toBe(2);
    const targets = graph.edges.map((e) => e.to);
    expect(targets).toContain("status");
    expect(targets).toContain("rollback");
  });

  test("includes commands without .relatedTo() as isolated nodes", () => {
    const program = new Command("cli");
    program.addCommand(
      command("list")
        .description("List")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);

    expect(graph.nodes).toContain("list");
    expect(graph.edges.length).toBe(0);
  });

  test("graph is queryable — neighbors returns adjacent nodes", () => {
    const program = new Command("cli");
    program.addCommand(
      command("deploy")
        .description("Deploy")
        .relatedTo("status")
        .relatedTo("rollback")
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("status")
        .description("Status")
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("rollback")
        .description("Rollback")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);

    // Get neighbors of "deploy"
    const neighbors = graph.edges
      .filter((e) => e.from === "deploy")
      .map((e) => e.to);
    expect(neighbors).toContain("status");
    expect(neighbors).toContain("rollback");
  });
});

// =============================================================================
// VAL-GRAPH-003: Invalid targets and edge cases handled safely
// =============================================================================

describe("Edge cases (VAL-GRAPH-003)", () => {
  test("unknown target produces warning edge, not crash", () => {
    const program = new Command("cli");
    program.addCommand(
      command("deploy")
        .description("Deploy")
        .relatedTo("nonexistent")
        .action(async () => {})
        .build()
    );

    // Should not throw
    const graph = buildActionGraph(program);

    // Edge to unknown target should have a warning flag
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0]!.to).toBe("nonexistent");
    expect(graph.warnings).toBeDefined();
    expect(graph.warnings!.length).toBeGreaterThanOrEqual(1);
    expect(graph.warnings![0]).toContain("nonexistent");
  });

  test("self-link does not cause infinite loops", () => {
    const program = new Command("cli");
    program.addCommand(
      command("retry")
        .description("Retry last command")
        .relatedTo("retry", { description: "Retry again" })
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);

    // Self-link should exist but graph traversal shouldn't loop
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0]!.from).toBe("retry");
    expect(graph.edges[0]!.to).toBe("retry");
  });

  test("cycles do not cause infinite loops", () => {
    const program = new Command("cli");
    program.addCommand(
      command("a")
        .description("A")
        .relatedTo("b")
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("b")
        .description("B")
        .relatedTo("a")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);

    expect(graph.edges.length).toBe(2);
    // Verify no infinite loop by checking graph is finite and well-formed
    expect(graph.nodes.length).toBe(2);
  });

  test("empty program produces empty graph", () => {
    const program = new Command("cli");

    const graph = buildActionGraph(program);

    expect(graph.nodes.length).toBe(0);
    expect(graph.edges.length).toBe(0);
  });

  test("nested subcommands in groups are traversed", () => {
    const program = new Command("cli");

    // Create a group command with nested subcommands
    const group = new Command("check").description("Check commands");
    group.addCommand(
      command("tsdoc")
        .description("Check TSDoc")
        .relatedTo("lint", { description: "Run lint" })
        .action(async () => {})
        .build()
    );
    group.addCommand(
      command("deps")
        .description("Check dependencies")
        .action(async () => {})
        .build()
    );
    program.addCommand(group);

    // Also add a top-level command
    program.addCommand(
      command("lint")
        .description("Lint")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);

    // Should include nested subcommands as full paths
    expect(graph.nodes).toContain("check tsdoc");
    expect(graph.nodes).toContain("check deps");
    expect(graph.nodes).toContain("lint");

    // Should include edges from nested subcommands using full paths
    expect(
      graph.edges.some((e) => e.from === "check tsdoc" && e.to === "lint")
    ).toBe(true);
  });

  test("deeply nested subcommands are traversed", () => {
    const program = new Command("cli");

    const level1 = new Command("check").description("Check commands");
    const level2 = new Command("deep").description("Deep group");
    level2.addCommand(
      command("leaf")
        .description("Leaf command")
        .relatedTo("other")
        .action(async () => {})
        .build()
    );
    level1.addCommand(level2);
    program.addCommand(level1);

    program.addCommand(
      command("other")
        .description("Other")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);

    // Should find nested leaf command with full path
    expect(graph.nodes).toContain("check deep leaf");
    expect(graph.nodes).toContain("other");
    expect(
      graph.edges.some((e) => e.from === "check deep leaf" && e.to === "other")
    ).toBe(true);
  });
});

// =============================================================================
// VAL-GRAPH-004: Tier-4 success hints use graph neighbors
// =============================================================================

describe("Tier-4 success hints (VAL-GRAPH-004)", () => {
  test("success hints include related next-action commands", () => {
    const program = new Command("cli");
    program.addCommand(
      command("deploy")
        .description("Deploy")
        .relatedTo("status", { description: "Check deployment status" })
        .relatedTo("logs", { description: "View deployment logs" })
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("status")
        .description("Status")
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("logs")
        .description("Logs")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);
    const hints = graphSuccessHints(graph, "deploy", "cli");

    expect(hints.length).toBe(2);
    expect(hints.some((h) => h.command?.includes("status"))).toBe(true);
    expect(hints.some((h) => h.command?.includes("logs"))).toBe(true);
  });

  test("success hints include relationship description", () => {
    const program = new Command("cli");
    program.addCommand(
      command("deploy")
        .description("Deploy")
        .relatedTo("status", { description: "Check deployment status" })
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("status")
        .description("Status")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);
    const hints = graphSuccessHints(graph, "deploy", "cli");

    expect(hints.length).toBe(1);
    expect(hints[0]!.description).toBe("Check deployment status");
    expect(hints[0]!.command).toBe("cli status");
  });

  test("no success hints for commands without relationships", () => {
    const program = new Command("cli");
    program.addCommand(
      command("list")
        .description("List")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);
    const hints = graphSuccessHints(graph, "list", "cli");

    expect(hints.length).toBe(0);
  });

  test("success hints use fallback description when not provided", () => {
    const program = new Command("cli");
    program.addCommand(
      command("deploy")
        .description("Deploy")
        .relatedTo("status")
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("status")
        .description("Check status")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);
    const hints = graphSuccessHints(graph, "deploy", "cli");

    expect(hints.length).toBe(1);
    // Should use a default description since none was provided
    expect(hints[0]!.description).toBeTruthy();
    expect(hints[0]!.command).toBe("cli status");
  });

  test("success hints do not include self-links", () => {
    const program = new Command("cli");
    program.addCommand(
      command("retry")
        .description("Retry")
        .relatedTo("retry")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);
    const hints = graphSuccessHints(graph, "retry", "cli");

    // Self-links should be excluded from success hints
    expect(hints.length).toBe(0);
  });
});

// =============================================================================
// VAL-GRAPH-005: Tier-4 error hints include remediation paths
// =============================================================================

describe("Tier-4 error hints (VAL-GRAPH-005)", () => {
  test("error hints include remediation paths from graph neighbors", () => {
    const program = new Command("cli");
    program.addCommand(
      command("deploy")
        .description("Deploy")
        .relatedTo("status", { description: "Check deployment status" })
        .relatedTo("rollback", { description: "Rollback deployment" })
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("status")
        .description("Status")
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("rollback")
        .description("Rollback")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);
    const hints = graphErrorHints(graph, "deploy", "cli");

    expect(hints.length).toBeGreaterThan(0);
    expect(hints.some((h) => h.command?.includes("status"))).toBe(true);
    expect(hints.some((h) => h.command?.includes("rollback"))).toBe(true);
  });

  test("error hints are distinguished with remediation context", () => {
    const program = new Command("cli");
    program.addCommand(
      command("deploy")
        .description("Deploy")
        .relatedTo("rollback", { description: "Rollback deployment" })
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("rollback")
        .description("Rollback")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);
    const hints = graphErrorHints(graph, "deploy", "cli");

    expect(hints.length).toBe(1);
    expect(hints[0]!.command).toBe("cli rollback");
    // Error hints should have remediation-style descriptions
    expect(hints[0]!.description).toBeTruthy();
  });

  test("no error hints for commands without relationships", () => {
    const program = new Command("cli");
    program.addCommand(
      command("list")
        .description("List")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);
    const hints = graphErrorHints(graph, "list", "cli");

    expect(hints.length).toBe(0);
  });

  test("error hints do not include self-links", () => {
    const program = new Command("cli");
    program.addCommand(
      command("retry")
        .description("Retry")
        .relatedTo("retry")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);
    const hints = graphErrorHints(graph, "retry", "cli");

    expect(hints.length).toBe(0);
  });
});
