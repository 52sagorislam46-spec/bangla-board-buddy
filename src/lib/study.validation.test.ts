import { describe, expect, it } from "vitest";

import {
  ANSWER_BATCH_SIZE,
  alignAnswersByQuestion,
  canPrepareSuggestionImage,
  createQuestionBatches,
  getSuggestionImageMimeType,
  hasCompleteQuestionCoverage,
  isWithinSuggestionImageLimit,
  normalizeModelTestMarks,
  totalPaperMarks,
} from "./study.validation";

describe("suggestion image limit", () => {
  it("accepts the requested maximum of 20 images", () => {
    expect(isWithinSuggestionImageLimit(20)).toBe(true);
  });

  it("rejects more than 20 images", () => {
    expect(isWithinSuggestionImageLimit(21)).toBe(false);
  });
});

describe("complete suggestion answer batches", () => {
  it("keeps all 1,000 suggestion items across bounded answer batches", () => {
    const questions = Array.from({ length: 1_000 }, (_, index) => `question-${index + 1}`);
    const batches = createQuestionBatches(questions);

    expect(batches.every((batch) => batch.length <= ANSWER_BATCH_SIZE)).toBe(true);
    expect(batches.flat()).toEqual(questions);
    expect(batches.flat()).toHaveLength(1_000);
  });

  it("rejects an answer response that omits or duplicates an item", () => {
    expect(hasCompleteQuestionCoverage(["q1", "q2"], ["q1", "q2"])).toBe(true);
    expect(hasCompleteQuestionCoverage(["q1", "q2"], ["q1"])).toBe(false);
    expect(hasCompleteQuestionCoverage(["q1", "q2"], ["q1", "q1"])).toBe(false);
  });

  it("aligns answers by ID even when the provider changes their order", () => {
    const questions = [{ id: "q1", question: "প্রথম" }, { id: "q2", question: "দ্বিতীয়" }];
    const answers = [{ id: "q2", answer: "দ্বিতীয় উত্তর" }, { id: "q1", answer: "প্রথম উত্তর" }];

    expect(alignAnswersByQuestion(questions, answers)?.map(({ answer }) => answer.answer)).toEqual([
      "প্রথম উত্তর",
      "দ্বিতীয় উত্তর",
    ]);
  });

  it("falls back to input order when the provider changes IDs but returns every answer", () => {
    const questions = [{ id: "q1", question: "প্রথম" }, { id: "q2", question: "দ্বিতীয়" }];
    const answers = [{ id: "changed-1", answer: "প্রথম উত্তর" }, { id: "changed-2", answer: "দ্বিতীয় উত্তর" }];

    expect(alignAnswersByQuestion(questions, answers)?.map(({ question, answer }) => [question.id, answer.answer])).toEqual([
      ["q1", "প্রথম উত্তর"],
      ["q2", "দ্বিতীয় উত্তর"],
    ]);
  });

  it("does not align answers when the provider omitted an answer", () => {
    expect(alignAnswersByQuestion([{ id: "q1" }, { id: "q2" }], [{ id: "q1" }])).toBeNull();
  });
});
describe("100-mark model test", () => {
  it("adds Bengali and English marks to exactly 100", () => {
    expect(totalPaperMarks(["প্রশ্ন ১ (১০)", "প্রশ্ন ২ (৮০)", "Q3 (10)"])).toBe(100);
  });
  it("detects a paper that is not 100 marks", () => {
    expect(totalPaperMarks(["প্রশ্ন (২)", "প্রশ্ন (৩)"])).toBe(5);
  });

  it("corrects a generated 104-mark paper without dropping questions", () => {
    const paper = {
      short: [{ question: "প্রশ্ন ১ (২)" }, { question: "প্রশ্ন ২ (২)" }],
      medium: [{ question: "প্রশ্ন ৩ (৫)" }, { question: "প্রশ্ন ৪ (৫)" }],
      long: [{ question: "প্রশ্ন ৫ (১০)" }, { question: "প্রশ্ন ৬ (৮০)" }],
      writing: [],
    };
    const normalized = normalizeModelTestMarks(paper);
    const allQuestions = Object.values(normalized).flat();

    expect(totalPaperMarks(allQuestions.map((item) => item.question))).toBe(100);
    expect(allQuestions).toHaveLength(6);
    expect(allQuestions.every((item) => totalPaperMarks([item.question]) > 0)).toBe(true);
  });

  it("assigns marks when a provider omits the mark labels", () => {
    const paper = {
      short: [{ question: "সংক্ষিপ্ত প্রশ্ন" }],
      medium: [{ question: "মাঝারি প্রশ্ন" }],
      long: [{ question: "বর্ণনামূলক প্রশ্ন" }],
      writing: [],
    };
    const normalized = normalizeModelTestMarks(paper);

    expect(totalPaperMarks(Object.values(normalized).flat().map((item) => item.question))).toBe(100);
  });
});

describe("mobile suggestion image formats", () => {
  it("accepts images with a known extension even when the phone omits MIME type", () => {
    expect(canPrepareSuggestionImage("page.jpg", "")).toBe(true);
    expect(getSuggestionImageMimeType("page.jpg", "")).toBe("image/jpeg");
  });

  it("allows browser-decodable image formats for JPEG conversion", () => {
    expect(canPrepareSuggestionImage("page.heic", "image/heic")).toBe(true);
    expect(getSuggestionImageMimeType("page.heic", "image/heic")).toBeNull();
  });

  it("rejects files that are not images", () => {
    expect(canPrepareSuggestionImage("notes.pdf", "application/pdf")).toBe(false);
  });
});
