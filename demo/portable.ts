import type { DossierConfig } from "../src/types.ts";
/** Rewrite asset fields only. Captions, links, and record copy are never altered. */
export function mapAssets(
  config: DossierConfig,
  map: (source: string) => string,
): DossierConfig {
  const output = structuredClone(config);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if ((key === "src" || key === "poster") && typeof item === "string")
        (value as Record<string, unknown>)[key] = map(item);
      else visit(item);
    }
  };
  visit(output.options.records);
  return output;
}
export function safeArchivePath(path: string): boolean {
  return (
    path.startsWith("assets/") &&
    !path.includes("\\") &&
    path
      .split("/")
      .every((part) => part !== ".." && part !== "." && part.length > 0)
  );
}
