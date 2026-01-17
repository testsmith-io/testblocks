import { ProcedureDefinition } from '../../types';

/**
 * Procedure registry for runtime procedure storage.
 */
const procedureRegistry = new Map<string, ProcedureDefinition>();

/**
 * Register a procedure.
 */
export function registerProcedure(name: string, procedure: ProcedureDefinition): void {
  procedureRegistry.set(name, procedure);
}

/**
 * Get a procedure by name.
 */
export function getProcedure(name: string): ProcedureDefinition | undefined {
  return procedureRegistry.get(name);
}

/**
 * Clear all procedures.
 */
export function clearProcedures(): void {
  procedureRegistry.clear();
}
