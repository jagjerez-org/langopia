import { describe, expect, it } from "vitest";
import { InvalidSurveyScoreError } from "../errors/feedback.errors.js";
import { Score } from "./score.vo.js";

describe("Score", () => {
  it("rechaza NPS por encima de 10", () => {
    expect(() => Score.forSurveyKind("nps", 11)).toThrow(InvalidSurveyScoreError);
  });

  it("rechaza CSAT por debajo de 1", () => {
    expect(() => Score.forSurveyKind("csat", 0)).toThrow(InvalidSurveyScoreError);
  });

  it("acepta los límites válidos de cada escala", () => {
    expect(Score.forSurveyKind("nps", 0).value).toBe(0);
    expect(Score.forSurveyKind("nps", 10).value).toBe(10);
    expect(Score.forSurveyKind("csat", 1).value).toBe(1);
    expect(Score.forSurveyKind("post_session", 5).value).toBe(5);
    expect(Score.forSurveyKind("teacher_pulse", 5).value).toBe(5);
  });
});
