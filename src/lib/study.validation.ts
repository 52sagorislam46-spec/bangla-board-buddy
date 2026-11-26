import type { QuestionKind, SuggestionImage } from "./study.types";

export const MAX_SUGGESTION_IMAGES = 20;
export const ANSWER_BATCH_SIZE = 8;

const questionKinds: QuestionKind[] = ["short", "medium", "long", "writing"];
const supportedImageTypes: SuggestionImage["mimeType"][] = ["image/jpeg", "image/png", "image/webp"];

export function getSuggestionImageMimeType(fileName: string, fileType: string): SuggestionImage["mimeType"] | null {
  const mimeType = fileType.split(";")[0]?.trim().toLowerCase();
  if (mimeType && supportedImageTypes.includes(mimeType as SuggestionImage["mimeType"])) {
    return mimeType as SuggestionImage["mimeType"];
  }

  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg" || extension === "jfif") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return null;
}

export function canPrepareSuggestionImage(fileName: string, fileType: string): boolean {
  return getSuggestionImageMimeType(fileName, fileType) !== null || fileType.toLowerCase().startsWith("image/");
}

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

export function alignAnswersByQuestion<T extends { id: string }, A extends { id: string }>(
  questions: T[],
  answers: A[],
): Array<{ question: T; answer: A }> | null {
  if (questions.length !== answers.length) return null;

  const questionIds = questions.map((question) => question.id);
  const answerIds = answers.map((answer) => answer.id);
  const aligned: Array<{ question: T; answer: A }> = [];

  if (hasCompleteQuestionCoverage(questionIds, answerIds)) {
    const answersById = new Map(answers.map((answer) => [answer.id, answer]));
    for (const question of questions) {
      const answer = answersById.get(question.id);
      if (!answer) return null;
      aligned.push({ question, answer });
    }
    return aligned;
  }

  // The prompt asks the model to preserve input order; use that order if IDs were altered.
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const answer = answers[index];
    if (!question || !answer) return null;
    aligned.push({ question, answer });
  }
  return aligned;
}

export function totalPaperMarks(questions: string[]): number {
  return questions.reduce((sum, question) => {
    const match = question.match(/[（(]\s*([০-৯0-9]+)\s*[）)]\s*$/u);
    if (!match?.[1]) return sum;
    return sum + Number([...match[1]].map((character) => {
      const bengaliDigit = "০১২৩৪৫৬৭৮৯".indexOf(character);
      return bengaliDigit >= 0 ? String(bengaliDigit) : character;
    }).join(""));
  }, 0);
}

type MarkedQuestion = { question: string };

function markFromQuestion(question: string): number | null {
  const match = question.match(/[（(]\s*([০-৯0-9]+)\s*[）)]\s*$/u);
  if (!match?.[1]) return null;
  const digits = [...match[1]].map((character) => {
    const bengaliDigit = "০১২৩৪৫৬৭৮৯".indexOf(character);
    return bengaliDigit >= 0 ? String(bengaliDigit) : character;
  }).join("");
  const value = Number(digits);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function withQuestionMark(question: string, marks: number): string {
  const suffix = /[（(]\s*[০-৯0-9]+\s*[）)]\s*$/u;
  const label = `(${marks.toLocaleString("bn-BD")})`;
  return suffix.test(question) ? question.replace(suffix, label) : `${question.trimEnd()} ${label}`;
}

/** Adjusts generated question labels so a model-test paper always totals the requested marks. */
export function normalizeModelTestMarks<T extends MarkedQuestion>(
  questions: Record<QuestionKind, T[]>,
  target = 100,
): Record<QuestionKind, T[]> {
  const defaults: Record<QuestionKind, number> = { short: 2, medium: 5, long: 10, writing: 5 };
  const rows = questionKinds.flatMap((kind) =>
    questions[kind].map((item, index) => ({ kind, index, item, marks: markFromQuestion(item.question) ?? defaults[kind] })),
  );
  if (rows.length === 0) return questions;

  let remaining = target - rows.reduce((sum, row) => sum + row.marks, 0);
  const adjustmentOrder: QuestionKind[] = remaining < 0
    ? ["medium", "writing", "short", "long"]
    : ["long", "writing", "medium", "short"];
  const orderedRows = adjustmentOrder.flatMap((kind) => rows.filter((row) => row.kind === kind));

  while (remaining !== 0) {
    let changed = false;
    for (const row of orderedRows) {
      if (remaining === 0) break;
      if (remaining > 0) {
        row.marks += 1;
        remaining -= 1;
        changed = true;
      } else if (row.marks > 1) {
        row.marks -= 1;
        remaining += 1;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const marksByKind: Record<QuestionKind, number[]> = { short: [], medium: [], long: [], writing: [] };
  rows.forEach((row) => { marksByKind[row.kind][row.index] = row.marks; });
  const applyMarks = (kind: QuestionKind, list: T[]) => list.map((item, index) => {
    const marks = marksByKind[kind][index];
    return marks === undefined ? item : { ...item, question: withQuestionMark(item.question, marks) };
  });

  return {
    short: applyMarks("short", questions.short),
    medium: applyMarks("medium", questions.medium),
    long: applyMarks("long", questions.long),
    writing: applyMarks("writing", questions.writing),
  };
}
