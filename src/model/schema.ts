// src/model/schema.ts
import type { Project } from './types';
import { repairProjectReferentialIntegrity } from './projectReferentialIntegrity';
import { migrateLegacyProject } from './projectMigration';
import { ProjectSchema } from './projectSchemas';
export * from './schemaPrimitives';
export * from './schemaLayers';
export * from './shotSchemas';
export * from './projectSchemas';

export type ValidationResult =
  | { success: true; data: Project; project: Project }
  | { success: false; errors: string[] };

export { repairProjectReferentialIntegrity } from './projectReferentialIntegrity';

export function validateProject(raw: unknown): ValidationResult {
  const migrated = migrateLegacyProject(raw);
  const parsed = ProjectSchema.safeParse(migrated);
  if (parsed.success) {
    const repaired = repairProjectReferentialIntegrity(parsed.data as Project);
    return { success: true, data: repaired, project: repaired };
  }
  const errors = parsed.error.issues.map(
    (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`
  );
  return { success: false, errors };
}





