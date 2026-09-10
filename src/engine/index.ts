// Barrel for the calculation core.
//
// Nothing in this directory may import from `ui/`, `state/`, or React. The
// engine is plain TypeScript so it stays portable and testable on its own.
// `architecture.test.ts` enforces that, and it runs in `npm test`.

export const ENGINE_VERSION = 1 as const
