import fs from "fs";
import path from "path";

const IGNORE_DIRS = new Set([
  "node_modules", ".next", ".git", ".turbo", ".cache",
  "dist", "build", ".vercel", ".output", "__pycache__",
]);

const IGNORE_EXTS = new Set([
  ".ico", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".woff", ".woff2",
  ".ttf", ".eot", ".lock", ".min.js", ".min.css", ".map",
]);

export interface IndexOptions {
  maxDepth?: number;
  maxFiles?: number;
}

export interface CodebaseIndex {
  root: string;
  totalFiles: number;
  truncated: boolean;
  tree: string;
  keyFiles: Record<string, string>;
}

/**
 * Index a directory tree and return a context summary for coding agents.
 * Returns file tree + key file summaries (package.json, tsconfig, README, etc.)
 */
export function indexCodebase(dir: string, opts: IndexOptions = {}): CodebaseIndex {
  const { maxDepth = 4, maxFiles = 500 } = opts;

  if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${dir}`);

  const files: string[] = [];
  const tree: string[] = [];

  function walk(d: string, depth: number, prefix: string) {
    if (depth > maxDepth) return;
    if (files.length >= maxFiles) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      if (IGNORE_DIRS.has(entry.name)) continue;

      if (entry.isDirectory()) {
        tree.push(`${prefix}├─ ${entry.name}/`);
        walk(path.join(d, entry.name), depth + 1, prefix + "│  ");
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (IGNORE_EXTS.has(ext)) continue;
        files.push(path.join(d, entry.name));
        tree.push(`${prefix}├─ ${entry.name}`);
      }
    }
  }

  walk(dir, 0, "");

  // Read key files
  const summaries: Record<string, string> = {};
  const keyFiles = [
    "package.json", "tsconfig.json", "next.config.mjs",
    "next.config.js", "tailwind.config.ts", "README.md", ".env.example",
    "drizzle.config.ts", "Dockerfile", "docker-compose.yml"
  ];

  for (const kf of keyFiles) {
    const fp = path.join(dir, kf);
    if (fs.existsSync(fp)) {
      try {
        summaries[kf] = fs.readFileSync(fp, "utf-8").slice(0, 2000);
      } catch { /* skip */ }
    }
  }

  return {
    root: dir,
    totalFiles: files.length,
    truncated: files.length >= maxFiles,
    tree: tree.join("\n"),
    keyFiles: summaries,
  };
}

/**
 * Generate a context document string for coding agents.
 */
export function buildCodebaseContext(dir: string, opts: IndexOptions = {}): string {
  const index = indexCodebase(dir, opts);

  let ctx = `# Codebase Context\n\n`;
  ctx += `**Root:** ${index.root}\n`;
  ctx += `**Total files indexed:** ${index.totalFiles}${index.truncated ? " (truncated)" : ""}\n\n`;
  ctx += `## File Tree\n\`\`\`\n${index.tree}\n\`\`\`\n`;

  if (Object.keys(index.keyFiles).length > 0) {
    ctx += `\n## Key Files\n`;
    for (const [name, content] of Object.entries(index.keyFiles)) {
      ctx += `\n### ${name}\n\`\`\`json\n${content}\n\`\`\`\n`;
    }
  }

  return ctx;
}