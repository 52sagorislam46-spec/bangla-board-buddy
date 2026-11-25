export const MAX_SUGGESTION_IMAGES = 20;
export const ANSWER_BATCH_SIZE = 8;

export function isWithinSuggestionImageLimit(count: number): boolean {
  return Number.isInteger(count) && count >= 0 && count <= MAX_SUGGESTION_IMAGES;
}

export function createQuestionBatches<T>(items: T[], batchSize = ANSWER_BATCH_SIZE): T[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1) return [];
  const batches: T[][] = [];
  for (let offset = 0; offset < items.length; offset += batchSize) {
    batches.push(items.slice(offset, offset + batchSize));
  }
  return batches;
}

export function hasCompleteQuestionCoverage(expectedIds: string[], answerIds: string[]): boolean {
  if (expectedIds.length !== answerIds.length) return false;
  const expected = new Set(expectedIds);
  const answered = new Set(answerIds);
  return expected.size === expectedIds.length && answered.size === answerIds.length &&
    expectedIds.every((id) => answered.has(id));
}
export function totalPaperMarks(questions: string[]): number {
  const bn = "০১২৩৪৫৬৭৮৯";
  return questions.reduce((sum, question) => {
    const match = question.match(/\(([০-৯0-9.]+)\)\s*$/);
    if (!match?.[1]) return sum;
    const digits = [...match[1]].map((c) => (bn.includes(c) ? String(bn.indexOf(c)) : c)).join("");
    return sum + (Number(digits) || 0);
  }, 0);
}
