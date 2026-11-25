import { InterfaceType } from './interface-type';
import { TaskPatternTypeDefinition } from './role-module.interface';

/** Add case files to written tasks without changing spec-backed tables or charts. */
export function withCaseFileOption(pattern: TaskPatternTypeDefinition): TaskPatternTypeDefinition {
  if (pattern.spec || (pattern.interfaceType !== InterfaceType.TEXT_AREA && pattern.interfaceType !== InterfaceType.RICH_TEXT_COMPOSER)) {
    return pattern;
  }
  return { ...pattern, allowedInterfaceTypes: [pattern.interfaceType, InterfaceType.CASE_FILE_TEXT_AREA] };
}
