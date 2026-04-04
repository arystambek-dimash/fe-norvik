import type { SolverVariant } from './types';

/**
 * Client-side kitchen plan generator.
 *
 * Currently a stub — server-side generation via `/arrangements` API
 * is the primary path. This function exists to satisfy the import
 * in editor.tsx for the client-side "Generate" button.
 */
export function planKitchen(_input: unknown): SolverVariant[] {
  console.warn('[planKitchen] Client-side planning not yet implemented. Use server generation.');
  return [];
}
