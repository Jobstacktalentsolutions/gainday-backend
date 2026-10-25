import { GeneratedTaskCandidate } from './role-module.interface';

// Digit runs, with thousands separators removed first ("1,250.00" -> "1250.00").
function numbersIn(text: string): string[] {
  const withoutSeparators = text.replace(/(?<=\d),(?=\d{3})/g, '');
  return Array.from(
    withoutSeparators.matchAll(/\d+(?:\.\d+)?/g),
    (match) => String(Number(match[0])),
  );
}

/**
 * Figures the candidate-facing text states that the data table does not show (finance doc Section
 * 6.3, narrative–data consistency). Numbers in the text must come from the data, never be written
 * freehand by the model.
 */
export function unsourcedFigures(task: GeneratedTaskCandidate): string[] {
  const { title, scenarioDescription, questionPrompt, interfacePayload, openEndedComponent } =
    task.taskContent;
  const candidateText = [
    title,
    scenarioDescription,
    questionPrompt,
    openEndedComponent ? JSON.stringify(openEndedComponent) : '',
  ].join('\n');
  const visible = new Set(numbersIn(JSON.stringify(interfacePayload)));
  return numbersIn(candidateText).filter((figure) => !visible.has(figure));
}
