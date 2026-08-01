import { Entity } from "../../../shared/domain/primitives/entity.js";
import { MembershipId } from "../../../shared/domain/primitives/school-id.js";
import type { RespondentKind } from "./survey-types.js";
import type { ResponseId, SessionId, TeacherProfileId } from "./identifiers.js";
import type { Score } from "./score.vo.js";

export class SurveyResponse extends Entity<ResponseId> {
  private constructor(
    id: ResponseId,
    private readonly _respondentMembershipId: MembershipId,
    private readonly _respondentKind: RespondentKind,
    private _score: Score,
    private _comment: string | null,
    private readonly _sessionId: SessionId | null,
    private readonly _teacherProfileId: TeacherProfileId | null,
    private _submittedAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: ResponseId;
    respondentMembershipId: MembershipId;
    respondentKind: RespondentKind;
    score: Score;
    comment: string | null;
    sessionId: SessionId | null;
    teacherProfileId: TeacherProfileId | null;
    submittedAt: Date;
  }): SurveyResponse {
    return new SurveyResponse(
      props.id,
      props.respondentMembershipId,
      props.respondentKind,
      props.score,
      props.comment,
      props.sessionId,
      props.teacherProfileId,
      props.submittedAt,
    );
  }

  replaceWith(params: { score: Score; comment: string | null; submittedAt: Date }): void {
    this._score = params.score;
    this._comment = params.comment;
    this._submittedAt = params.submittedAt;
  }

  samePeriodAs(params: {
    respondentMembershipId: MembershipId;
    sessionId: SessionId | null;
  }): boolean {
    return (
      this._respondentMembershipId.equals(params.respondentMembershipId) &&
      (this._sessionId?.value ?? null) === (params.sessionId?.value ?? null)
    );
  }

  get respondentMembershipId(): MembershipId {
    return this._respondentMembershipId;
  }
  get respondentKind(): RespondentKind {
    return this._respondentKind;
  }
  get score(): Score {
    return this._score;
  }
  get comment(): string | null {
    return this._comment;
  }
  get sessionId(): SessionId | null {
    return this._sessionId;
  }
  get teacherProfileId(): TeacherProfileId | null {
    return this._teacherProfileId;
  }
  get submittedAt(): Date {
    return this._submittedAt;
  }
}

