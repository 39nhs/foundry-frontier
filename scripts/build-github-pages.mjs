import { readdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const basePath = "/foundry-frontier";
const nextCli = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const build = spawnSync(process.execPath, [nextCli, "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    GITHUB_PAGES: "true",
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
});

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

async function rewritePublicAssetUrls(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewritePublicAssetUrls(path);
      continue;
    }
    if (!/\.(?:css|html|js)$/.test(entry.name)) continue;
    const source = await readFile(path, "utf8");
    const updated = source.replace(
      /(["'(])\/(assets|audio)\//g,
      `$1${basePath}/$2/`,
    );
    if (updated !== source) await writeFile(path, updated);
  }
}

await rewritePublicAssetUrls(join(process.cwd(), "out"));
