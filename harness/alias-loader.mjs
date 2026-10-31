// Node module-resolution hook: resolves the app's "@/..." alias to src/ so pure app
// modules (e.g. src/lib/shift-messages.ts) can be tested AS-IS, without a copy.
// Used via: node --import ./harness/register-alias.mjs ...
const SRC = new URL("../src/", import.meta.url);
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    const url = new URL(rel.endsWith(".ts") ? rel : `${rel}.ts`, SRC);
    return next(url.href, context);
  }
  return next(specifier, context);
}
