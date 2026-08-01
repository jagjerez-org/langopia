import { ValueObject } from "../../../shared/domain/primitives/value-object.js";
import { MembershipId } from "../../../shared/domain/primitives/school-id.js";

export const ConsentKind = {
  DataProcessing: "data_processing", // base para tratar los datos del alumno
  Recording: "recording", // grabar la clase
  Transcription: "transcription", // transcribir la grabación
  AiProcessing: "ai_processing", // procesar sus respuestas con IA
  Marketing: "marketing",
  ImageRights: "image_rights", // uso de su imagen en la web de la escuela
} as const;

export type ConsentKind = (typeof ConsentKind)[keyof typeof ConsentKind];

/**
 * El estado de un consentimiento concreto, ya resuelto.
 *
 * Es la prueba que se enseña en una auditoría RGPD: qué se consintió, quién
 * lo firmó y cuándo. Retirarlo no borra el rastro de que en su día se
 * concedió: crea un nuevo estado sin `grantedBy`, no reescribe el anterior.
 */
export class Consent extends ValueObject<{
  kind: ConsentKind;
  granted: boolean;
  grantedBy: MembershipId | null;
  at: Date;
}> {
  private constructor(props: {
    kind: ConsentKind;
    granted: boolean;
    grantedBy: MembershipId | null;
    at: Date;
  }) {
    super(props);
  }

  static granted(params: { kind: ConsentKind; grantedBy: MembershipId; at: Date }): Consent {
    return new Consent({
      kind: params.kind,
      granted: true,
      grantedBy: params.grantedBy,
      at: params.at,
    });
  }

  static withdrawn(params: { kind: ConsentKind; at: Date }): Consent {
    return new Consent({ kind: params.kind, granted: false, grantedBy: null, at: params.at });
  }

  get kind(): ConsentKind {
    return this.props.kind;
  }
  get granted(): boolean {
    return this.props.granted;
  }
  get grantedBy(): MembershipId | null {
    return this.props.grantedBy;
  }
  get at(): Date {
    return this.props.at;
  }
}
