import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export async function cleanupTempRoots(roots: Set<string>): Promise<void> {
  for (const root of roots) {
    await rm(root, { recursive: true, force: true });
  }
  roots.clear();
}

export async function createTrackedWorkspaceRoot(
  roots: Set<string>,
  prefix: string
): Promise<string> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), prefix));
  roots.add(workspaceRoot);
  return workspaceRoot;
}

export async function writeWorkspaceFiles(
  workspaceRoot: string,
  files: Record<string, string>
): Promise<void> {
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(workspaceRoot, relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  }
}

export async function createDocsMapGeneratorWorkspaceFixture(
  roots: Set<string>
): Promise<string> {
  const workspaceRoot = await createTrackedWorkspaceRoot(
    roots,
    "outfitter-docs-map-test-"
  );

  // Publishable package "alpha" with root README + docs/
  const alphaPkg = join(workspaceRoot, "packages", "alpha");
  await mkdir(join(alphaPkg, "docs"), { recursive: true });
  await writeFile(
    join(alphaPkg, "package.json"),
    JSON.stringify({ name: "@acme/alpha", version: "0.0.1" })
  );
  await writeFile(join(alphaPkg, "README.md"), "# Alpha\n\nAlpha package.\n");
  await writeFile(
    join(alphaPkg, "docs", "guide.md"),
    "# Alpha Guide\n\nA usage guide.\n"
  );
  await writeFile(
    join(alphaPkg, "docs", "notes.md"),
    "# Alpha Notes\n\nImplementation notes.\n"
  );
  await writeFile(join(alphaPkg, "CHANGELOG.md"), "# Changelog\n");

  // Publishable package "beta" with only a README
  const betaPkg = join(workspaceRoot, "packages", "beta");
  await mkdir(betaPkg, { recursive: true });
  await writeFile(
    join(betaPkg, "package.json"),
    JSON.stringify({ name: "@acme/beta", version: "0.0.1" })
  );
  await writeFile(join(betaPkg, "README.md"), "# Beta\n\nBeta package.\n");

  // Private package (should be excluded)
  const privatePkg = join(workspaceRoot, "packages", "private-pkg");
  await mkdir(privatePkg, { recursive: true });
  await writeFile(
    join(privatePkg, "package.json"),
    JSON.stringify({
      name: "@acme/private-pkg",
      private: true,
      version: "0.0.1",
    })
  );
  await writeFile(join(privatePkg, "README.md"), "# Private\n");

  // Directory without package.json (should be excluded)
  const noPkgJson = join(workspaceRoot, "packages", "no-package-json");
  await mkdir(noPkgJson, { recursive: true });
  await writeFile(join(noPkgJson, "README.md"), "# No package json\n");

  return workspaceRoot;
}
