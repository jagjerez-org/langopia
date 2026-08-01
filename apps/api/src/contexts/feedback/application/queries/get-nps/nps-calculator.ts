import type { NpsResult } from "../../ports/feedback-read-model.port.js";

export function calculateNps(scores: readonly number[]): NpsResult {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;

  for (const score of scores) {
    if (score >= 9) promoters += 1;
    else if (score >= 7) passives += 1;
    else detractors += 1;
  }

  const respondents = scores.length;
  return {
    score: respondents === 0 ? null : ((promoters - detractors) / respondents) * 100,
    respondents,
    promoters,
    passives,
    detractors,
  };
}
