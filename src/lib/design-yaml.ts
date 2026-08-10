/**
 * Minimal hand-rolled parser for the constrained YAML subset used by DESIGN.md
 * front matter: nested 2-space-indented maps, scalar values only (quoted
 * strings, bare numbers/units, {dotted.token} refs). No lists, no anchors.
 * Deliberately not a general YAML parser — ponytail: if DESIGN.md ever needs
 * arrays/lists in front matter, swap in `js-yaml` (already resolvable via npm,
 * not currently a dependency).
 */

type YamlValue = string | number | boolean | { [key: string]: YamlValue };

function parseScalar(raw: string): string | number | boolean {
  const trimmed = raw.trim();
  if (/^".*"$/.test(trimmed)) return trimmed.slice(1, -1);
  if (/^'.*'$/.test(trimmed)) return trimmed.slice(1, -1);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed; // bare strings, e.g. "4px", "{colors.primary}"
}

function indentOf(line: string): number {
  const m = line.match(/^ */);
  return m ? m[0].length : 0;
}

/** Parses a block of `key: value` / nested-map lines into a nested object. */
function parseBlock(lines: string[]): Record<string, YamlValue> {
  const root: Record<string, YamlValue> = {};
  const stack: { indent: number; obj: Record<string, YamlValue> }[] = [{ indent: -1, obj: root }];

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const indent = indentOf(rawLine);
    const line = rawLine.trim();
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const valuePart = line.slice(colonIdx + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;

    if (valuePart === "") {
      // Could be a nested map (next lines more indented) OR an inline `{ a: 1, b: 2 }` map.
      const child: Record<string, YamlValue> = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
    } else if (/^\{.*\}$/.test(valuePart)) {
      // Inline map: { fontFamily: "...", fontSize: "3rem" }
      const inner = valuePart.slice(1, -1);
      const child: Record<string, YamlValue> = {};
      for (const pair of splitTopLevelCommas(inner)) {
        const c = pair.indexOf(":");
        if (c === -1) continue;
        child[pair.slice(0, c).trim()] = parseScalar(pair.slice(c + 1).trim());
      }
      parent[key] = child;
    } else {
      parent[key] = parseScalar(valuePart);
    }
  }
  return root;
}

function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "{" || ch === "[") depth++;
    if (ch === "}" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Extracts and parses the `---\n...\n---` front-matter block. Returns null if absent. */
export function extractFrontMatter(markdown: string): Record<string, YamlValue> | null {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return parseBlock(match[1].split("\n"));
}

function getPath(obj: Record<string, YamlValue>, path: string): YamlValue | undefined {
  return path.split(".").reduce<YamlValue | undefined>((acc, key) => {
    if (acc && typeof acc === "object" && !Array.isArray(acc)) return (acc as Record<string, YamlValue>)[key];
    return undefined;
  }, obj);
}

/** Recursively replaces `{a.b.c}` string values with the resolved value at that path. */
export function resolveTokens(root: Record<string, YamlValue>): Record<string, YamlValue> {
  function resolveValue(v: YamlValue): YamlValue {
    if (typeof v === "string") {
      const m = v.match(/^\{([\w.-]+)\}$/);
      if (m) {
        const resolved = getPath(root, m[1]);
        if (resolved !== undefined) return resolveValue(resolved);
      }
      return v;
    }
    if (v && typeof v === "object") {
      const out: Record<string, YamlValue> = {};
      for (const [k, val] of Object.entries(v)) out[k] = resolveValue(val);
      return out;
    }
    return v;
  }
  return resolveValue(root) as Record<string, YamlValue>;
}
