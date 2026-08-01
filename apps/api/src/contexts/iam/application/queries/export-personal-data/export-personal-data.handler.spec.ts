import { describe, expect, it } from "vitest";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { PersonAccessContext } from "../../../domain/model/personal-data-access.js";
import type {
  PersonalDataExport,
  PersonalDataReadModel,
} from "../../ports/personal-data-read-model.port.js";
import { ExportPersonalDataHandler, ExportPersonalDataQuery } from "./export-personal-data.handler.js";

const MENOR: PersonAccessContext = {
  membershipId: "alumno-menor",
  isMinor: true,
  guardianMembershipIds: ["tutor-1"],
};

const ADULTO: PersonAccessContext = {
  membershipId: "alumno-adulto",
  isMinor: false,
  guardianMembershipIds: [],
};

/**
 * Muestrario con TODAS las categorías que pide el brief, verbatim: «ficha,
 * asistencia, intentos, valoraciones, facturas, consentimientos,
 * transcripciones donde aparece», más matrículas (`catalog`, citado en el
 * "Dónde encaja" de la tarea). Esta es la prueba de que la exportación no
 * omite ninguna tabla con datos de la persona: si el manejador dejara de
 * devolver una sección, esta comprobación lo detecta.
 */
function exportCompleto(): PersonalDataExport {
  return {
    membershipId: "alumno-menor",
    name: "Nerea Ojeda",
    email: "nerea@example.com",
    role: "student",
    membershipStatus: "active",
    locale: "es-ES",
    timezone: "Europe/Madrid",
    createdAt: "2025-01-01T00:00:00.000Z",
    lastSeenAt: null,
    joinedAt: "2025-01-01T00:00:00.000Z",
    student: {
      studentProfileId: "sp-1",
      dateOfBirth: "2012-05-01",
      isMinor: true,
      nativeLanguage: "es",
      targetLanguage: "en",
      currentLevel: "A2",
      targetLevel: "B1",
      goals: "Aprobar el examen de Cambridge",
      status: "active",
      joinedAt: "2025-01-01T00:00:00.000Z",
      pausedUntil: null,
      leftAt: null,
      leftReason: null,
      guardians: [
        { membershipId: "tutor-1", name: "Tutor Uno", relationship: "mother", canGiveConsent: true },
      ],
    },
    teacher: null,
    wardsAsGuardian: [],
    consents: [
      {
        kind: "recording",
        status: "granted",
        grantedByMembershipId: "tutor-1",
        grantedAt: "2025-01-02T00:00:00.000Z",
        withdrawnAt: null,
        policyVersion: "1.0",
      },
    ],
    enrollments: [
      {
        enrollmentId: "en-1",
        courseCode: "EN-A2",
        groupName: "A2 tardes",
        status: "active",
        enrolledAt: "2025-01-01T00:00:00.000Z",
        endedAt: null,
      },
    ],
    attendance: [
      {
        sessionId: "s-1",
        groupName: "A2 tardes",
        scheduledStart: "2026-02-01T10:00:00.000Z",
        status: "present",
        source: "manual",
        minutesPresent: 55,
      },
    ],
    attempts: [
      {
        attemptId: "at-1",
        exerciseId: "ex-1",
        attemptNumber: 1,
        status: "teacher_validated",
        aiScore: 0.8,
        teacherScore: 4,
        submittedAt: "2026-02-02T10:00:00.000Z",
      },
    ],
    assessments: [
      {
        assessmentId: "as-1",
        kind: "placement",
        title: "Prueba de nivel",
        status: "teacher_validated",
        levelBefore: "A1",
        levelResult: "A2",
        score: 70,
        maxScore: 100,
        scheduledFor: "2025-01-01T10:00:00.000Z",
      },
    ],
    evaluations: [
      {
        evaluationId: "ev-1",
        as: "student",
        counterpartName: "Carla Prof",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        progressRating: 4,
        strengths: "Buena pronunciación",
        improvements: "Vocabulario",
        nextSteps: "Subir a B1",
        createdAt: "2026-02-01T00:00:00.000Z",
      },
    ],
    invoices: [
      {
        invoiceId: "inv-1",
        number: "2026-0001",
        direction: "school_to_student",
        status: "paid",
        currency: "EUR",
        totalCents: 12000,
        issuedOn: "2026-01-05",
        dueOn: "2026-01-15",
        paidAt: "2026-01-10T00:00:00.000Z",
      },
    ],
    transcripts: [
      {
        transcriptId: "tr-1",
        sessionId: "s-1",
        status: "ready",
        language: "en",
        spokeInSession: true,
        hasRecording: true,
        ownSegments: [{ startMs: 0, endMs: 5000, text: "Buenos días." }],
      },
    ],
  };
}

function fakeReadModel(
  ctx: PersonAccessContext | null,
  bundle: PersonalDataExport = exportCompleto(),
): PersonalDataReadModel & { exportForCalls: string[] } {
  const exportForCalls: string[] = [];
  return {
    exportForCalls,
    accessContext: async () => ctx,
    exportFor: async (membershipId: string) => {
      exportForCalls.push(membershipId);
      return bundle;
    },
  };
}

function fakeTenant(params: { membershipId: string | null; roles: readonly string[] }): TenantContext {
  return {
    schoolId: () => "11111111-1111-4111-8111-111111111111",
    membershipId: () => params.membershipId,
    roles: () => params.roles,
    has: (role) => params.roles.includes(role),
  };
}

describe("ExportPersonalDataHandler (Tarea 15)", () => {
  it("la exportación incluye TODAS las categorías con datos de la persona", async () => {
    const readModel = fakeReadModel(MENOR);
    const handler = new ExportPersonalDataHandler(
      readModel,
      fakeTenant({ membershipId: "tutor-1", roles: ["guardian"] }),
    );

    const result = await handler.execute(new ExportPersonalDataQuery({ membershipId: "alumno-menor" }));

    // Ficha
    expect(result.student).not.toBeNull();
    expect(result.student!.guardians).toHaveLength(1);
    // Consentimientos
    expect(result.consents).toHaveLength(1);
    // Matrículas (catalog)
    expect(result.enrollments).toHaveLength(1);
    // Asistencia
    expect(result.attendance).toHaveLength(1);
    // Intentos
    expect(result.attempts).toHaveLength(1);
    // Valoraciones (assessments + evaluations)
    expect(result.assessments).toHaveLength(1);
    expect(result.evaluations).toHaveLength(1);
    // Facturas
    expect(result.invoices).toHaveLength(1);
    // Transcripciones donde aparece
    expect(result.transcripts).toHaveLength(1);
    expect(result.transcripts[0]!.ownSegments).toHaveLength(1);

    expect(readModel.exportForCalls).toEqual(["alumno-menor"]);
  });

  it("404 si la membresía no existe en esta escuela (RLS ya la habría ocultado)", async () => {
    const handler = new ExportPersonalDataHandler(
      fakeReadModel(null),
      fakeTenant({ membershipId: "owner-1", roles: ["owner"] }),
    );

    await expect(
      handler.execute(new ExportPersonalDataQuery({ membershipId: "no-existe" })),
    ).rejects.toThrow(/no existe/i);
  });

  it("un adulto puede exportar sus propios datos", async () => {
    const handler = new ExportPersonalDataHandler(
      fakeReadModel(ADULTO),
      fakeTenant({ membershipId: "alumno-adulto", roles: ["student"] }),
    );

    await expect(
      handler.execute(new ExportPersonalDataQuery({ membershipId: "alumno-adulto" })),
    ).resolves.toBeDefined();
  });

  it("un menor NO puede exportar sus propios datos: debe pedirlo su tutor", async () => {
    const handler = new ExportPersonalDataHandler(
      fakeReadModel(MENOR),
      fakeTenant({ membershipId: "alumno-menor", roles: ["student"] }),
    );

    await expect(
      handler.execute(new ExportPersonalDataQuery({ membershipId: "alumno-menor" })),
    ).rejects.toThrow(/tutor/i);
  });

  it("el tutor legal de un menor puede exportar sus datos", async () => {
    const handler = new ExportPersonalDataHandler(
      fakeReadModel(MENOR),
      fakeTenant({ membershipId: "tutor-1", roles: ["guardian"] }),
    );

    await expect(
      handler.execute(new ExportPersonalDataQuery({ membershipId: "alumno-menor" })),
    ).resolves.toBeDefined();
  });

  it("la dirección (owner) puede exportar los datos de cualquiera", async () => {
    const handler = new ExportPersonalDataHandler(
      fakeReadModel(ADULTO),
      fakeTenant({ membershipId: "owner-1", roles: ["owner"] }),
    );

    await expect(
      handler.execute(new ExportPersonalDataQuery({ membershipId: "alumno-adulto" })),
    ).resolves.toBeDefined();
  });

  it("otro alumno sin ninguna relación no puede exportar datos ajenos", async () => {
    const handler = new ExportPersonalDataHandler(
      fakeReadModel(ADULTO),
      fakeTenant({ membershipId: "otro-alumno", roles: ["student"] }),
    );

    await expect(
      handler.execute(new ExportPersonalDataQuery({ membershipId: "alumno-adulto" })),
    ).rejects.toThrow(/no puedes acceder/i);
  });
});
