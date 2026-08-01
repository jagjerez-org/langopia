import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import {
  InactiveSurveyError,
  SurveyAudienceMismatchError,
  SurveySessionRequiredError,
} from "../errors/feedback.errors.js";
import type { ResponseId, SessionId, SurveyId, TeacherProfileId } from "./identifiers.js";
import type { Score } from "./score.vo.js";
import { SurveyResponse } from "./survey-response.entity.js";
import type { RespondentKind, SurveyKind } from "./survey-types.js";

export class Survey extends AggregateRoot<SurveyId> {
  private constructor(
    id: SurveyId,
    private readonly _schoolId: SchoolId,
    private readonly _kind: SurveyKind,
    private readonly _code: string,
    private readonly _name: string,
    private readonly _audience: RespondentKind,
    private readonly _autoSendAfterSession: boolean,
    private _isActive: boolean,
    private readonly _createdAt: Date,
    private readonly _responses: SurveyResponse[],
  ) {
    super(id);
  }

  static create(props: {
    id: SurveyId;
    schoolId: SchoolId;
    kind: SurveyKind;
    code: string;
    name: string;
    audience: RespondentKind;
    autoSendAfterSession: boolean;
    now: Date;
  }): Survey {
    return new Survey(
      props.id,
      props.schoolId,
      props.kind,
      props.code,
      props.name,
      props.audience,
      props.autoSendAfterSession,
      true,
      props.now,
      [],
    );
  }

  static rehydrate(props: {
    id: SurveyId;
    schoolId: SchoolId;
    kind: SurveyKind;
    code: string;
    name: string;
    audience: RespondentKind;
    autoSendAfterSession: boolean;
    isActive: boolean;
    createdAt: Date;
    responses?: SurveyResponse[];
  }): Survey {
    return new Survey(
      props.id,
      props.schoolId,
      props.kind,
      props.code,
      props.name,
      props.audience,
      props.autoSendAfterSession,
      props.isActive,
      props.createdAt,
      props.responses ?? [],
    );
  }

  activate(): void {
    this._isActive = true;
  }

  close(): void {
    this._isActive = false;
  }

  respond(params: {
    responseId: ResponseId;
    respondentMembershipId: MembershipId;
    respondentKind: RespondentKind;
    score: Score;
    comment: string | null;
    sessionId: SessionId | null;
    teacherProfileId: TeacherProfileId | null;
    submittedAt: Date;
  }): { response: SurveyResponse; replaced: boolean } {
    if (!this._isActive) throw new InactiveSurveyError(this.id.value);
    if (params.respondentKind !== this._audience) {
      throw new SurveyAudienceMismatchError(this._audience, params.respondentKind);
    }
    if (this._kind === "post_session" && !params.sessionId) {
      throw new SurveySessionRequiredError(this.id.value);
    }

    const previous = this._responses.find((response) =>
      response.samePeriodAs({
        respondentMembershipId: params.respondentMembershipId,
        sessionId: params.sessionId,
      }),
    );
    if (previous) {
      previous.replaceWith({
        score: params.score,
        comment: params.comment,
        submittedAt: params.submittedAt,
      });
      return { response: previous, replaced: true };
    }

    const response = SurveyResponse.create({
      id: params.responseId,
      respondentMembershipId: params.respondentMembershipId,
      respondentKind: params.respondentKind,
      score: params.score,
      comment: params.comment,
      sessionId: params.sessionId,
      teacherProfileId: params.teacherProfileId,
      submittedAt: params.submittedAt,
    });
    this._responses.push(response);
    return { response, replaced: false };
  }

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get kind(): SurveyKind {
    return this._kind;
  }
  get code(): string {
    return this._code;
  }
  get name(): string {
    return this._name;
  }
  get audience(): RespondentKind {
    return this._audience;
  }
  get autoSendAfterSession(): boolean {
    return this._autoSendAfterSession;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get responses(): readonly SurveyResponse[] {
    return [...this._responses];
  }
}

