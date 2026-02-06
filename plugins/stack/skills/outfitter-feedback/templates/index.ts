/**
 * Issue template types and registry for outfitter-feedback skill
 */

export interface IssueTemplate {
  type: string;
  labels: string[];
  titlePrefix: string;
  bodyTemplate: string;
  requiredFields: string[];
  optionalFields: string[];
}

export interface TemplateFields {
  [key: string]: string | undefined;
}

// Import all templates
import bug from "./bug.json";
import compatibility from "./compatibility.json";
import conversionHelper from "./conversion-helper.json";
import docs from "./docs.json";
import dx from "./dx.json";
import enhancement from "./enhancement.json";
import migrationDocs from "./migration-docs.json";
import migrationPattern from "./migration-pattern.json";
import unclearPattern from "./unclear-pattern.json";

export const templates: Record<string, IssueTemplate> = {
  bug,
  enhancement,
  docs,
  "unclear-pattern": unclearPattern,
  dx,
  "migration-pattern": migrationPattern,
  "conversion-helper": conversionHelper,
  compatibility,
  "migration-docs": migrationDocs,
};

export const templateTypes = Object.keys(templates);
