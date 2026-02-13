export type Operation =
  | {
      readonly type: "file-create";
      readonly path: string;
      readonly source: "template" | "block" | "generated";
    }
  | {
      readonly type: "file-overwrite";
      readonly path: string;
      readonly source: "template" | "block" | "generated";
    }
  | {
      readonly type: "file-skip";
      readonly path: string;
      readonly reason: string;
    }
  | {
      readonly type: "dir-create";
      readonly path: string;
    }
  | {
      readonly type: "dependency-add";
      readonly name: string;
      readonly version: string;
      readonly section: "dependencies" | "devDependencies" | "peerDependencies";
    }
  | {
      readonly type: "block-add";
      readonly name: string;
      readonly files: readonly string[];
    }
  | {
      readonly type: "config-inject";
      readonly target: string;
      readonly description: string;
    }
  | {
      readonly type: "git";
      readonly action: "init" | "add-all" | "commit";
      readonly cwd: string;
      readonly message?: string | undefined;
    }
  | {
      readonly type: "install";
      readonly command: string;
      readonly cwd: string;
    };

export class OperationCollector {
  private readonly operations: Operation[] = [];

  add(op: Operation): void {
    this.operations.push(op);
  }

  getOperations(): readonly Operation[] {
    return this.operations;
  }

  countByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const op of this.operations) {
      counts[op.type] = (counts[op.type] ?? 0) + 1;
    }
    return counts;
  }

  isEmpty(): boolean {
    return this.operations.length === 0;
  }

  toJSON(): {
    operations: readonly Operation[];
    summary: Record<string, number>;
  } {
    return {
      operations: this.operations,
      summary: this.countByType(),
    };
  }
}
