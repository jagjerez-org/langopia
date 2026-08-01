import IntlMessageFormat from "intl-messageformat";
import { DEFAULT_LOCALE, type Locale } from "./locale.resolver.js";

/**
 * Mensajes de error de cara al usuario.
 *
 * El dominio lanza un `code` estable; la traducción es cosa de esta capa. Un
 * código sin traducción devuelve `null` y el filtro deja el mensaje original
 * en español: preferible a enseñar una clave sin traducir.
 *
 * Los `params` de cada patrón son los `details` del error de dominio que lo
 * lanza: se declaran juntos. Cuando los `details` de un código varían de
 * forma (`invalid_time_slot`, `tenant_resolution_failed` lanzan con distintas
 * claves según la rama que falle) el mensaje se deja sin parámetros: un
 * marcador que falta en `IntlMessageFormat` lanza en vez de traducir, y eso
 * sería peor que un mensaje genérico.
 */
export const MESSAGES: Record<string, Partial<Record<Locale, string>>> = {
  /**
   * Sin marcadores, y no por comodidad: `TeacherOverlapError` lleva en sus
   * `details` `teacherId` y `conflictingSessionId`, no el nombre del profesor
   * ni la hora. La versión anterior de este mensaje pedía `{teacherName}` y
   * `{startsAt}`, que nadie le pasaba nunca; `IntlMessageFormat` lanzaba, el
   * filtro caía al mensaje en español del `super()` y los cinco idiomas
   * devolvían el mismo texto. Los identificadores siguen viajando en `params`
   * para que el panel enlace a la clase que estorba, que es donde sí
   * significan algo.
   */
  teacher_overlap: {
    "es-ES": "El profesor ya tiene otra clase que se solapa con esa franja.",
    "en-GB": "The teacher already has another class overlapping that slot.",
    "de-DE": "Der Lehrer hat in diesem Zeitraum bereits einen anderen Unterricht.",
    "pt-BR": "O professor já tem outra aula que se sobrepõe a esse horário.",
    "gl-ES": "O profesor xa ten outra clase que se solapa con esa franxa.",
  },
  teacher_not_available: {
    "es-ES": "El profesor no tiene disponibilidad declarada en esa franja.",
    "en-GB": "The teacher has no declared availability for that slot.",
    "de-DE": "Für diesen Zeitraum ist keine Verfügbarkeit hinterlegt.",
    "pt-BR": "O professor não tem disponibilidade declarada nesse horário.",
    "gl-ES": "O profesor non ten dispoñibilidade declarada nesa franxa.",
  },
  session_already_closed: {
    "es-ES": "Esta clase ya está cerrada y no admite más cambios.",
    "en-GB": "This class is already closed and cannot be changed.",
    "de-DE": "Dieser Unterricht ist bereits abgeschlossen.",
    "pt-BR": "Esta aula já está encerrada e não aceita alterações.",
    "gl-ES": "Esta clase xa está pechada e non admite máis cambios.",
  },
  cannot_schedule_in_the_past: {
    "es-ES": "No se puede programar una clase en el pasado.",
    "en-GB": "A class cannot be scheduled in the past.",
    "de-DE": "Unterricht kann nicht in der Vergangenheit geplant werden.",
    "pt-BR": "Não é possível agendar uma aula no passado.",
    "gl-ES": "Non se pode programar unha clase no pasado.",
  },
  not_found: {
    "es-ES": "No existe ese recurso en esta escuela.",
    "en-GB": "That resource does not exist in this school.",
    "de-DE": "Diese Ressource existiert in dieser Schule nicht.",
    "pt-BR": "Esse recurso não existe nesta escola.",
    "gl-ES": "Ese recurso non existe nesta escola.",
  },
  missing_tenant: {
    "es-ES": "Necesitas iniciar sesión y elegir una escuela.",
    "en-GB": "You need to sign in and choose a school.",
    "de-DE": "Bitte melde dich an und wähle eine Schule.",
    "pt-BR": "Você precisa entrar e escolher uma escola.",
    "gl-ES": "Precisas iniciar sesión e escoller unha escola.",
  },
  concurrency_conflict: {
    "es-ES": "{resource} {id} ha cambiado desde que lo leíste. Vuelve a cargarlo e inténtalo de nuevo.",
    "en-GB": "{resource} {id} has changed since you last read it. Reload it and try again.",
    "de-DE": "{resource} {id} hat sich geändert, seit du es gelesen hast. Lade es neu und versuche es erneut.",
    "pt-BR": "{resource} {id} mudou desde que você o leu. Recarregue e tente novamente.",
    "gl-ES": "{resource} {id} cambiou desde que o liches. Cárgao de novo e téntao outra vez.",
  },
  invalid_cancellation_policy: {
    "es-ES": "La antelación mínima de cancelación no es válida ({minimumNoticeHours} horas).",
    "en-GB": "The minimum cancellation notice is not valid ({minimumNoticeHours} hours).",
    "de-DE": "Die Mindestkündigungsfrist ist ungültig ({minimumNoticeHours} Stunden).",
    "pt-BR": "A antecedência mínima de cancelamento não é válida ({minimumNoticeHours} horas).",
    "gl-ES": "A antelación mínima de cancelación non é válida ({minimumNoticeHours} horas).",
  },
  invalid_room: {
    "es-ES": "El aula configurada para «{provider}» no es válida.",
    "en-GB": "The room configured for “{provider}” is not valid.",
    "de-DE": "Der für „{provider}“ konfigurierte Raum ist ungültig.",
    "pt-BR": "A sala configurada para “{provider}” não é válida.",
    "gl-ES": "A aula configurada para «{provider}» non é válida.",
  },
  invalid_time_slot: {
    "es-ES": "La franja horaria de la clase no es válida.",
    "en-GB": "The class time slot is not valid.",
    "de-DE": "Der Zeitraum des Unterrichts ist ungültig.",
    "pt-BR": "O horário da aula não é válido.",
    "gl-ES": "A franxa horaria da clase non é válida.",
  },
  invalid_uuid: {
    "es-ES": "«{value}» no es un identificador válido de {type}.",
    "en-GB": "“{value}” is not a valid {type} identifier.",
    "de-DE": "„{value}“ ist keine gültige {type}-Kennung.",
    "pt-BR": "“{value}” não é um identificador válido de {type}.",
    "gl-ES": "«{value}» non é un identificador válido de {type}.",
  },
  missing_actor: {
    "es-ES": "Cancelar una clase requiere saber quién la cancela.",
    "en-GB": "Cancelling a class requires knowing who is cancelling it.",
    "de-DE": "Um einen Unterricht zu stornieren, muss bekannt sein, wer ihn storniert.",
    "pt-BR": "Cancelar uma aula exige saber quem a está cancelando.",
    "gl-ES": "Cancelar unha clase require saber quen a cancela.",
  },
  // `room_not_ready` es de la Tarea 6 de la ola 1 (`classroom`: aula propia
  // en LiveKit e integraciones de vídeo). Sin parámetros, igual que
  // `invalid_time_slot`: `details.reason` distingue una clase presencial de
  // una integración sin OAuth, pero son dos frases, no un valor que encaje en
  // una única plantilla.
  room_not_ready: {
    "es-ES": "La sala de esta clase todavía no está lista para entrar.",
    "en-GB": "This class's room is not ready to join yet.",
    "de-DE": "Der Raum für diesen Unterricht ist noch nicht bereit.",
    "pt-BR": "A sala desta aula ainda não está pronta para entrar.",
    "gl-ES": "A aula desta clase aínda non está lista para entrar.",
  },
  not_enrolled_in_session: {
    "es-ES": "No estás matriculado en el grupo de esta clase.",
    "en-GB": "You are not enrolled in this class's group.",
    "de-DE": "Du bist nicht in der Gruppe dieses Unterrichts eingeschrieben.",
    "pt-BR": "Você não está matriculado no grupo desta aula.",
    "gl-ES": "Non estás matriculado no grupo desta clase.",
  },
  unknown_room_provider: {
    "es-ES": "«{value}» no es un tipo de aula conocido.",
    "en-GB": "“{value}” is not a known room type.",
    "de-DE": "„{value}“ ist kein bekannter Raumtyp.",
    "pt-BR": "“{value}” não é um tipo de sala conhecido.",
    "gl-ES": "«{value}» non é un tipo de aula coñecido.",
  },
  // Los siguientes dos códigos viven en `contexts/iam/` (guardias de sesión y
  // de roles, Tarea 7). Se traducen igual que cualquier otro: el catálogo es
  // uno solo para toda la API, no uno por contexto.
  insufficient_role: {
    "es-ES": "Esta acción requiere el rol {required}.",
    "en-GB": "This action requires the {required} role.",
    "de-DE": "Diese Aktion erfordert die Rolle {required}.",
    "pt-BR": "Esta ação exige a função {required}.",
    "gl-ES": "Esta acción require o rol {required}.",
  },
  // La ruta no declaró ni roles ni `@Public()`. No promete «prueba con otro
  // rol»: con ninguno se sirve, hasta que quien la escribió la anote.
  route_not_annotated: {
    "es-ES": "Esta ruta no declara quién puede usarla, así que no se sirve.",
    "en-GB": "This route does not declare who may use it, so it is not served.",
    "de-DE": "Diese Route gibt nicht an, wer sie nutzen darf, und wird daher nicht bedient.",
    "pt-BR": "Esta rota não declara quem pode usá-la, portanto não é atendida.",
    "gl-ES": "Esta ruta non declara quen pode usala, así que non se serve.",
  },
  // Ruta mal anotada, no petición mal hecha: el valor de
  // `@RestrictedWhileImpersonating` no está en la lista cerrada del dominio.
  unknown_restricted_action: {
    "es-ES": "«{action}» no es una acción restringida conocida.",
    "en-GB": "“{action}” is not a known restricted action.",
    "de-DE": "„{action}“ ist keine bekannte eingeschränkte Aktion.",
    "pt-BR": "“{action}” não é uma ação restrita conhecida.",
    "gl-ES": "«{action}» non é unha acción restrinxida coñecida.",
  },
  tenant_resolution_failed: {
    "es-ES": "No se ha podido determinar la escuela para esta petición.",
    "en-GB": "Could not determine the school for this request.",
    "de-DE": "Die Schule für diese Anfrage konnte nicht ermittelt werden.",
    "pt-BR": "Não foi possível determinar a escola desta requisição.",
    "gl-ES": "Non se puido determinar a escola para esta petición.",
  },
  school_not_operational: {
    "es-ES": "La escuela «{slug}» está cancelada y no admite accesos.",
    "en-GB": "The “{slug}” school is cancelled and does not allow access.",
    "de-DE": "Die Schule „{slug}“ ist gekündigt und erlaubt keinen Zugriff.",
    "pt-BR": "A escola “{slug}” está cancelada e não permite acesso.",
    "gl-ES": "A escola «{slug}» está cancelada e non admite accesos.",
  },
  email_not_verified: {
    "es-ES": "Tu correo todavía no está verificado. Abre el enlace que te hemos enviado antes de entrar.",
    "en-GB": "Your email is not verified yet. Open the link we sent you before signing in.",
    "de-DE": "Deine E-Mail-Adresse ist noch nicht bestätigt. Öffne den Link, den wir dir geschickt haben, bevor du dich anmeldest.",
    "pt-BR": "Seu e-mail ainda não foi verificado. Abra o link que enviamos antes de entrar.",
    "gl-ES": "O teu correo aínda non está verificado. Abre a ligazón que che enviamos antes de entrar.",
  },
  // Los siguientes cuatro códigos viven en `contexts/people/` (Tarea 1 de la
  // ola 1: alumno y minoría de edad). Ninguno interpola parámetros: sus
  // `details` varían de forma según la rama que los lanza (p. ej.
  // `invalid_date_of_birth` a veces añade `edad`), así que se deja el mensaje
  // fijo, igual que `invalid_time_slot`.
  invalid_date_of_birth: {
    "es-ES": "La fecha de nacimiento no es válida.",
    "en-GB": "The date of birth is not valid.",
    "de-DE": "Das Geburtsdatum ist ungültig.",
    "pt-BR": "A data de nascimento não é válida.",
    "gl-ES": "A data de nacemento non é válida.",
  },
  minor_cannot_self_consent: {
    "es-ES":
      "Un alumno menor de edad no puede firmar su propio consentimiento: debe hacerlo su tutor legal.",
    "en-GB": "A student who is a minor cannot sign their own consent: their legal guardian must do it.",
    "de-DE":
      "Ein minderjähriger Schüler kann seine Einwilligung nicht selbst erteilen: Das muss sein gesetzlicher Vormund tun.",
    "pt-BR":
      "Um aluno menor de idade não pode assinar seu próprio consentimento: isso deve ser feito pelo responsável legal.",
    "gl-ES": "Un alumno menor de idade non pode asinar o seu propio consentimento: debe facelo o seu titor legal.",
  },
  not_a_guardian: {
    "es-ES": "Quien firma no consta como tutor legal de este alumno.",
    "en-GB": "The person signing is not on record as this student's legal guardian.",
    "de-DE": "Die unterzeichnende Person ist nicht als gesetzlicher Vormund dieses Schülers eingetragen.",
    "pt-BR": "Quem assina não consta como responsável legal deste aluno.",
    "gl-ES": "Quen asina non consta como titor legal deste alumno.",
  },
  student_already_left: {
    "es-ES": "Este alumno ya está de baja.",
    "en-GB": "This student has already left.",
    "de-DE": "Dieser Schüler hat die Schule bereits verlassen.",
    "pt-BR": "Este aluno já está inativo.",
    "gl-ES": "Este alumno xa está de baixa.",
  },
  // `guardian_required` es de la Tarea 2 de la ola 1 (persistencia, comandos
  // y endpoints de `people`): lo lanza `EnrolStudentHandler` cuando el alta
  // es de un menor sin ningún tutor legal en la petición.
  guardian_required: {
    "es-ES": "Un alumno menor de edad necesita al menos un tutor legal para darse de alta.",
    "en-GB": "A student who is a minor needs at least one legal guardian to be enrolled.",
    "de-DE":
      "Ein minderjähriger Schüler benötigt mindestens einen gesetzlichen Vormund, um angemeldet zu werden.",
    "pt-BR": "Um aluno menor de idade precisa de pelo menos um responsável legal para se matricular.",
    "gl-ES": "Un alumno menor de idade precisa polo menos un titor legal para darse de alta.",
  },
  // Los siguientes tres códigos son de la Tarea 14 de la ola 1 (`people`:
  // importación de alumnado desde CSV). `invalid_import_file` e
  // `invalid_import_field` no interpolan su `reason`/`missing` a propósito:
  // es texto libre que varía en cada instancia y que `messages.ts` no puede
  // traducir — mismo criterio que `invalid_time_slot`. `invalid_import_field`
  // sí interpola `{field}`: es siempre uno de un puñado de nombres de columna
  // conocidos, igual que `{provider}` en `invalid_room`.
  invalid_import_file: {
    "es-ES": "El fichero CSV no se puede procesar.",
    "en-GB": "The CSV file could not be processed.",
    "de-DE": "Die CSV-Datei konnte nicht verarbeitet werden.",
    "pt-BR": "Não foi possível processar o arquivo CSV.",
    "gl-ES": "O ficheiro CSV non se pode procesar.",
  },
  duplicate_email_in_import: {
    "es-ES": "El correo «{email}» aparece en más de una fila del fichero.",
    "en-GB": "The email “{email}” appears in more than one row of the file.",
    "de-DE": "Die E-Mail-Adresse „{email}“ kommt in mehr als einer Zeile der Datei vor.",
    "pt-BR": "O e-mail “{email}” aparece em mais de uma linha do arquivo.",
    "gl-ES": "O correo «{email}» aparece en máis dunha fila do ficheiro.",
  },
  invalid_import_field: {
    "es-ES": "El campo «{field}» de la fila no es válido.",
    "en-GB": "The row's “{field}” field is not valid.",
    "de-DE": "Das Feld „{field}“ der Zeile ist ungültig.",
    "pt-BR": "O campo “{field}” da linha não é válido.",
    "gl-ES": "O campo «{field}» da fila non é válido.",
  },
  // Los siguientes cinco códigos son de la Tarea 3 de la ola 1 (`people`:
  // profesorado). Igual que los cuatro de la Tarea 1, ninguno interpola
  // parámetros: sus `details` son escalares, pero el mensaje no necesita
  // repetirlos para tener sentido — el mismo criterio que ya siguen
  // `invalid_date_of_birth` y `invalid_time_slot`.
  invalid_hourly_rate: {
    "es-ES": "La tarifa por hora no está dentro del tramo declarado.",
    "en-GB": "The hourly rate is not within the declared tier.",
    "de-DE": "Der Stundensatz liegt nicht im angegebenen Tarifbereich.",
    "pt-BR": "A tarifa por hora não está dentro da faixa declarada.",
    "gl-ES": "A tarifa por hora non está dentro do tramo declarado.",
  },
  invalid_contracted_hours: {
    "es-ES": "Las horas contratadas deben estar entre 1 y 60 semanales.",
    "en-GB": "Contracted hours must be between 1 and 60 per week.",
    "de-DE": "Die vertraglichen Stunden müssen zwischen 1 und 60 pro Woche liegen.",
    "pt-BR": "As horas contratadas devem estar entre 1 e 60 por semana.",
    "gl-ES": "As horas contratadas deben estar entre 1 e 60 semanais.",
  },
  invalid_availability_slot: {
    "es-ES": "La franja de disponibilidad no es válida.",
    "en-GB": "The availability slot is not valid.",
    "de-DE": "Der Verfügbarkeitszeitraum ist ungültig.",
    "pt-BR": "O horário de disponibilidade não é válido.",
    "gl-ES": "A franxa de dispoñibilidade non é válida.",
  },
  overlapping_availability: {
    "es-ES": "Esta franja de disponibilidad se solapa con otra del mismo día.",
    "en-GB": "This availability slot overlaps with another one on the same day.",
    "de-DE": "Dieser Verfügbarkeitszeitraum überschneidet sich mit einem anderen am selben Tag.",
    "pt-BR": "Este horário de disponibilidade se sobrepõe a outro no mesmo dia.",
    "gl-ES": "Esta franxa de dispoñibilidade solápase con outra do mesmo día.",
  },
  teacher_already_left: {
    "es-ES": "Este profesor ya está de baja.",
    "en-GB": "This teacher has already left.",
    "de-DE": "Dieser Lehrer hat die Schule bereits verlassen.",
    "pt-BR": "Este professor já está inativo.",
    "gl-ES": "Este profesor xa está de baixa.",
  },
  // Los siguientes cinco códigos son de `contexts/catalog/` (Tarea 4 de la
  // ola 1: cursos, grupos y matrículas).
  group_full: {
    "es-ES": "El grupo ya tiene su capacidad completa ({capacity} alumnos).",
    "en-GB": "The group is already at full capacity ({capacity} students).",
    "de-DE": "Die Gruppe hat bereits ihre volle Kapazität erreicht ({capacity} Schüler).",
    "pt-BR": "O grupo já está com a capacidade completa ({capacity} alunos).",
    "gl-ES": "O grupo xa ten a súa capacidade completa ({capacity} alumnos).",
  },
  student_not_active: {
    "es-ES": "El alumno está de baja y no se puede matricular.",
    "en-GB": "The student has left and cannot be enrolled.",
    "de-DE": "Der Schüler hat die Schule verlassen und kann nicht angemeldet werden.",
    "pt-BR": "O aluno está inativo e não pode ser matriculado.",
    "gl-ES": "O alumno está de baixa e non se pode matricular.",
  },
  negative_agreed_price: {
    "es-ES": "El precio acordado no puede ser negativo.",
    "en-GB": "The agreed price cannot be negative.",
    "de-DE": "Der vereinbarte Preis darf nicht negativ sein.",
    "pt-BR": "O preço acordado não pode ser negativo.",
    "gl-ES": "O prezo acordado non pode ser negativo.",
  },
  missing_default_translation: {
    "es-ES": "Falta el nombre del curso en el idioma por defecto de la escuela ({defaultLocale}).",
    "en-GB": "The course is missing its name in the school's default language ({defaultLocale}).",
    "de-DE": "Dem Kurs fehlt der Name in der Standardsprache der Schule ({defaultLocale}).",
    "pt-BR": "Falta o nome do curso no idioma padrão da escola ({defaultLocale}).",
    "gl-ES": "Falta o nome do curso no idioma por defecto da escola ({defaultLocale}).",
  },
  group_already_started: {
    "es-ES": "Este grupo ya está en marcha y no se puede iniciar de nuevo.",
    "en-GB": "This group has already started and cannot be started again.",
    "de-DE": "Diese Gruppe läuft bereits und kann nicht erneut gestartet werden.",
    "pt-BR": "Este grupo já está em andamento e não pode ser iniciado novamente.",
    "gl-ES": "Este grupo xa está en marcha e non se pode iniciar de novo.",
  },
  // Los siguientes cuatro códigos los lanza `AllExceptionsFilter` (Tarea 8b)
  // al reconocer un error de Postgres por su SQLSTATE (23505, 23503, 23514,
  // 22P02). Sí corresponden a clases reales —`UniqueViolationError`,
  // `ForeignKeyViolationError`, `CheckViolationError`,
  // `InvalidTextRepresentationError`, definidas en `all-exceptions.filter.ts`
  // junto al mapa que las construye— así que no hacen falta trucos:
  // `i18n-coverage.spec.ts` las encuentra igual que a cualquier otro
  // `DomainError`.
  unique_violation: {
    "es-ES": "Ya existe un registro con ese valor.",
    "en-GB": "A record with that value already exists.",
    "de-DE": "Es gibt bereits einen Datensatz mit diesem Wert.",
    "pt-BR": "Já existe um registro com esse valor.",
    "gl-ES": "Xa existe un rexistro con ese valor.",
  },
  foreign_key_violation: {
    "es-ES": "La operación hace referencia a algo que no existe o que todavía está en uso.",
    "en-GB": "The operation refers to something that does not exist or is still in use.",
    "de-DE": "Der Vorgang bezieht sich auf etwas, das nicht existiert oder noch verwendet wird.",
    "pt-BR": "A operação faz referência a algo que não existe ou que ainda está em uso.",
    "gl-ES": "A operación fai referencia a algo que non existe ou que aínda está en uso.",
  },
  check_violation: {
    "es-ES": "Uno de los valores enviados no cumple una restricción de los datos.",
    "en-GB": "One of the submitted values breaks a data constraint.",
    "de-DE": "Einer der übermittelten Werte verletzt eine Datenbedingung.",
    "pt-BR": "Um dos valores enviados não respeita uma restrição dos dados.",
    "gl-ES": "Un dos valores enviados non cumpre unha restrición dos datos.",
  },
  invalid_text_representation: {
    "es-ES": "Uno de los valores enviados no tiene el formato esperado.",
    "en-GB": "One of the submitted values does not have the expected format.",
    "de-DE": "Einer der übermittelten Werte hat nicht das erwartete Format.",
    "pt-BR": "Um dos valores enviados não tem o formato esperado.",
    "gl-ES": "Un dos valores enviados non ten o formato esperado.",
  },
  /**
   * `validation_failed` e `internal_error` no son `DomainError`: los asigna
   * `AllExceptionsFilter` (Tarea 8b) directamente, para un `HttpException` de
   * Nest (el `ValidationPipe` de `main.ts`, o cualquier ruta que no exista) y
   * para cualquier excepción que no encaje en ninguna otra familia. No hay
   * ninguna clase con `readonly code = "validation_failed"` ni con
   * `readonly code = "internal_error"` en `contexts/` —no tendría sentido
   * crear una solo para que la regex de `i18n-coverage.spec.ts` la
   * encuentre—, así que, igual que con `pending_reviews`, esta nota contiene
   * las dos cadenas literalmente para que la prueba de huérfanos los
   * reconozca como cubiertos.
   */
  validation_failed: {
    "es-ES": "Los datos enviados no son válidos.",
    "en-GB": "The submitted data is not valid.",
    "de-DE": "Die übermittelten Daten sind ungültig.",
    "pt-BR": "Os dados enviados não são válidos.",
    "gl-ES": "Os datos enviados non son válidos.",
  },
  internal_error: {
    "es-ES": "Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.",
    "en-GB": "An unexpected error has occurred. Please try again later.",
    "de-DE": "Es ist ein unerwarteter Fehler aufgetreten. Bitte versuche es später erneut.",
    "pt-BR": "Ocorreu um erro inesperado. Tente novamente mais tarde.",
    "gl-ES": "Produciuse un erro inesperado. Téntao de novo máis tarde.",
  },
  /**
   * Ejemplo de plural ICU documentado en `ARCHITECTURE.md` y ejercitado por
   * `locale.spec.ts`. No corresponde a ningún error de dominio real —no hay
   * ninguna clase con `readonly code = "pending_reviews"` en `contexts/`— así
   * que `i18n-coverage.spec.ts` lo reconoce como cubierto gracias a esta
   * misma nota: es preferible dejarlo documentado aquí, junto al patrón que
   * demuestra, a esconderlo en un sitio donde nadie explique por qué existe.
   */
  pending_reviews: {
    "es-ES": "{count, plural, one {# valoración pendiente} other {# valoraciones pendientes}}",
    "en-GB": "{count, plural, one {# pending review} other {# pending reviews}}",
    "de-DE": "{count, plural, one {# ausstehende Bewertung} other {# ausstehende Bewertungen}}",
    "pt-BR": "{count, plural, one {# avaliação pendente} other {# avaliações pendentes}}",
    "gl-ES": "{count, plural, one {# valoración pendente} other {# valoracións pendentes}}",
  },
  // Los siguientes ocho códigos son de `contexts/billing/` (Tarea 7 de la ola
  // 1: facturación con comisión configurable). Ninguno interpola parámetros:
  // sus `details` cambian de forma según qué invariante rompe la llamada
  // (a veces `cents`, a veces `currency`, a veces `invoiceId`/`status`) —
  // mismo criterio que ya siguen `invalid_time_slot` y `session_already_closed`.
  invalid_money_amount: {
    "es-ES": "El importe no es válido.",
    "en-GB": "The amount is not valid.",
    "de-DE": "Der Betrag ist ungültig.",
    "pt-BR": "O valor não é válido.",
    "gl-ES": "O importe non é válido.",
  },
  currency_mismatch: {
    "es-ES": "No se puede operar entre monedas distintas.",
    "en-GB": "You cannot operate between different currencies.",
    "de-DE": "Zwischen unterschiedlichen Währungen kann nicht gerechnet werden.",
    "pt-BR": "Não é possível operar entre moedas diferentes.",
    "gl-ES": "Non se pode operar entre moedas distintas.",
  },
  invalid_platform_fee: {
    "es-ES": "La comisión de plataforma configurada no es válida.",
    "en-GB": "The configured platform fee is not valid.",
    "de-DE": "Die konfigurierte Plattformgebühr ist ungültig.",
    "pt-BR": "A comissão de plataforma configurada não é válida.",
    "gl-ES": "A comisión de plataforma configurada non é válida.",
  },
  invalid_invoice_line: {
    "es-ES": "Una línea de la factura no es válida.",
    "en-GB": "An invoice line is not valid.",
    "de-DE": "Eine Rechnungsposition ist ungültig.",
    "pt-BR": "Uma linha da fatura não é válida.",
    "gl-ES": "Unha liña da factura non é válida.",
  },
  invalid_invoice_state: {
    "es-ES": "Esta factura está en un estado que no admite esa operación.",
    "en-GB": "This invoice is in a state that does not allow that operation.",
    "de-DE": "Diese Rechnung befindet sich in einem Status, der diesen Vorgang nicht zulässt.",
    "pt-BR": "Esta fatura está em um estado que não permite essa operação.",
    "gl-ES": "Esta factura está nun estado que non admite esa operación.",
  },
  platform_fee_not_allowed: {
    "es-ES": "Una factura de la plataforma a la escuela nunca lleva comisión.",
    "en-GB": "An invoice from the platform to the school never carries a fee.",
    "de-DE": "Eine Rechnung der Plattform an die Schule enthält nie eine Gebühr.",
    "pt-BR": "Uma fatura da plataforma para a escola nunca tem comissão.",
    "gl-ES": "Unha factura da plataforma á escola nunca leva comisión.",
  },
  payment_exceeds_invoice_total: {
    "es-ES": "El cobro supera lo que queda pendiente de la factura.",
    "en-GB": "The payment exceeds what is still owed on the invoice.",
    "de-DE": "Die Zahlung übersteigt den noch offenen Rechnungsbetrag.",
    "pt-BR": "O pagamento excede o que ainda falta na fatura.",
    "gl-ES": "O cobro supera o que queda pendente da factura.",
  },
  refund_exceeds_payment: {
    "es-ES": "No se puede devolver más de lo cobrado.",
    "en-GB": "You cannot refund more than what was collected.",
    "de-DE": "Es kann nicht mehr zurückerstattet werden, als eingezogen wurde.",
    "pt-BR": "Não é possível reembolsar mais do que foi cobrado.",
    "gl-ES": "Non se pode devolver máis do cobrado.",
  },
  // Los siguientes dos códigos son de la Tarea 5 de la ola 2 (créditos de IA
  // con tope duro). Sin interpolar `credits`/`requestedCredits` ni
  // `availableCredits`: son cifras internas de auditoría (`details`), no
  // datos que el mensaje de cara al usuario necesite mostrar.
  invalid_credit_amount: {
    "es-ES": "La cantidad de créditos debe ser un entero positivo.",
    "en-GB": "The number of credits must be a positive whole number.",
    "de-DE": "Die Anzahl der Credits muss eine positive ganze Zahl sein.",
    "pt-BR": "A quantidade de créditos deve ser um número inteiro positivo.",
    "gl-ES": "A cantidade de créditos debe ser un enteiro positivo.",
  },
  insufficient_credits: {
    "es-ES": "No hay créditos suficientes para generar contenido con IA.",
    "en-GB": "There are not enough credits left to generate AI content.",
    "de-DE": "Es sind nicht genügend Credits vorhanden, um KI-Inhalte zu erstellen.",
    "pt-BR": "Não há créditos suficientes para gerar conteúdo com IA.",
    "gl-ES": "Non hai créditos abondos para xerar contido con IA.",
  },
  // Los siguientes dos códigos son de `contexts/scheduling/` (Tarea 5 de la
  // ola 1: hoja de asistencia). Ninguno interpola parámetros: sus `details`
  // llevan identificadores y fechas que no aportan nada a la frase — mismo
  // criterio que `session_already_closed` y `teacher_overlap`.
  session_not_started: {
    "es-ES": "No se puede pasar lista de una clase que todavía no ha empezado.",
    "en-GB": "You cannot take attendance for a class that has not started yet.",
    "de-DE": "Die Anwesenheit kann nicht erfasst werden, bevor der Unterricht begonnen hat.",
    "pt-BR": "Não é possível registrar presença de uma aula que ainda não começou.",
    "gl-ES": "Non se pode pasar lista dunha clase que aínda non empezou.",
  },
  student_not_enrolled: {
    "es-ES": "El alumno no está matriculado en este grupo.",
    "en-GB": "The student is not enrolled in this group.",
    "de-DE": "Der Schüler ist nicht in dieser Gruppe eingeschrieben.",
    "pt-BR": "O aluno não está matriculado neste grupo.",
    "gl-ES": "O alumno non está matriculado neste grupo.",
  },
  // Los siguientes dos códigos son del webhook del proveedor de pago
  // (`contexts/billing/infrastructure/http/webhooks/`, Tarea 8 de la ola 1).
  // Sin parámetros: son rechazos de la petición entera, no un dato de
  // negocio que interpolar.
  invalid_webhook_signature: {
    "es-ES": "La firma del webhook no es válida.",
    "en-GB": "The webhook signature is not valid.",
    "de-DE": "Die Signatur des Webhooks ist ungültig.",
    "pt-BR": "A assinatura do webhook não é válida.",
    "gl-ES": "A sinatura do webhook non é válida.",
  },
  stripe_webhook_not_configured: {
    "es-ES": "No hay secreto de webhook configurado para el proveedor de pago.",
    "en-GB": "No webhook secret is configured for the payment provider.",
    "de-DE": "Für den Zahlungsanbieter ist kein Webhook-Secret konfiguriert.",
    "pt-BR": "Não há segredo de webhook configurado para o provedor de pagamento.",
    "gl-ES": "Non hai segredo de webhook configurado para o provedor de pago.",
  },
  // Portal del alumno (Tarea 9 de la ola 1). Sin parámetros interpolados: el
  // `studentId` de los `details` es para el cliente, no para el texto — la
  // persona ya sabe qué alumno pidió, no hace falta repetírselo.
  portal_access_denied: {
    "es-ES": "No puedes ver los datos de un alumno que no eres tú ni tutelas.",
    "en-GB": "You can't view the data of a student who isn't you or your dependant.",
    "de-DE": "Du kannst nur die Daten deiner eigenen oder deiner betreuten Schüler sehen.",
    "pt-BR": "Você não pode ver os dados de um aluno que não é você nem seu tutelado.",
    "gl-ES": "Non podes ver os datos dun alumno que non es ti nin titelas.",
  },
  // Los siguientes seis códigos son de `contexts/iam/` (Tarea 11 de la ola 1:
  // alta autoservicio de escuelas e invitaciones). `invalid_school_slug` no
  // interpola parámetros por el mismo motivo que `invalid_time_slot`: sus
  // tres ramas (longitud, alfabeto, palabra reservada) son frases distintas.
  invalid_school_slug: {
    "es-ES": "El identificador de la escuela no es válido.",
    "en-GB": "The school identifier is not valid.",
    "de-DE": "Die Schulkennung ist ungültig.",
    "pt-BR": "O identificador da escola não é válido.",
    "gl-ES": "O identificador da escola non é válido.",
  },
  invitation_expired: {
    "es-ES": "Esta invitación ya ha caducado.",
    "en-GB": "This invitation has expired.",
    "de-DE": "Diese Einladung ist abgelaufen.",
    "pt-BR": "Este convite já expirou.",
    "gl-ES": "Esta invitación xa caducou.",
  },
  invitation_already_resolved: {
    "es-ES": "Esta invitación ya se aceptó o se revocó.",
    "en-GB": "This invitation has already been accepted or revoked.",
    "de-DE": "Diese Einladung wurde bereits angenommen oder widerrufen.",
    "pt-BR": "Este convite já foi aceito ou revogado.",
    "gl-ES": "Esta invitación xa se aceptou ou se revogou.",
  },
  invitation_email_mismatch: {
    "es-ES": "Esta invitación no es para tu correo.",
    "en-GB": "This invitation is not for your email address.",
    "de-DE": "Diese Einladung ist nicht für deine E-Mail-Adresse bestimmt.",
    "pt-BR": "Este convite não é para o seu e-mail.",
    "gl-ES": "Esta invitación non é para o teu correo.",
  },
  unknown_membership_role: {
    "es-ES": "«{value}» no es un rol de membresía conocido.",
    "en-GB": "“{value}” is not a known membership role.",
    "de-DE": "„{value}“ ist keine bekannte Mitgliedschaftsrolle.",
    "pt-BR": "“{value}” não é uma função de associação conhecida.",
    "gl-ES": "«{value}» non é un rol de membresía coñecido.",
  },
  authentication_required: {
    "es-ES": "Inicia sesión antes de continuar.",
    "en-GB": "Sign in before continuing.",
    "de-DE": "Melde dich an, bevor du fortfährst.",
    "pt-BR": "Faça login antes de continuar.",
    "gl-ES": "Inicia sesión antes de continuar.",
  },
  // Los siguientes ocho códigos son de `contexts/iam/` (Tarea 17 de la ola 1:
  // impersonación de soporte). `invalid_impersonation_reason` interpola
  // `{minLength}` porque es siempre el mismo número (10) y aclara la regla;
  // el resto no interpola nada — sus `details` llevan identificadores
  // (`impersonationId`) o una acción (`{action}`, en
  // `impersonation_forbidden_action`, la única que sí lo necesita: es lo que
  // le dice a quien lo lee CUÁL de las seis categorías prohibidas rechazó).
  invalid_impersonation_reason: {
    "es-ES": "El motivo de la impersonación debe tener al menos {minLength} caracteres.",
    "en-GB": "The impersonation reason must be at least {minLength} characters long.",
    "de-DE": "Der Grund für die Impersonation muss mindestens {minLength} Zeichen lang sein.",
    "pt-BR": "O motivo da impersonação deve ter pelo menos {minLength} caracteres.",
    "gl-ES": "O motivo da impersonación debe ter polo menos {minLength} caracteres.",
  },
  impersonation_already_ended: {
    "es-ES": "Esta impersonación ya había terminado.",
    "en-GB": "This impersonation had already ended.",
    "de-DE": "Diese Impersonation war bereits beendet.",
    "pt-BR": "Esta impersonação já havia terminado.",
    "gl-ES": "Esta impersonación xa rematara.",
  },
  cannot_impersonate_self: {
    "es-ES": "No puedes impersonarte a ti mismo.",
    "en-GB": "You cannot impersonate yourself.",
    "de-DE": "Du kannst dich nicht selbst impersonieren.",
    "pt-BR": "Você não pode se personificar.",
    "gl-ES": "Non podes impersonarte a ti mesmo.",
  },
  impersonation_chain_forbidden: {
    "es-ES": "No se puede encadenar una impersonación.",
    "en-GB": "You cannot chain an impersonation.",
    "de-DE": "Eine Impersonation kann nicht verkettet werden.",
    "pt-BR": "Não é possível encadear uma impersonação.",
    "gl-ES": "Non se pode encadear unha impersonación.",
  },
  impersonation_already_active: {
    "es-ES": "Ya tienes una impersonación activa. Termínala antes de iniciar otra.",
    "en-GB": "You already have an active impersonation. End it before starting another one.",
    "de-DE": "Du hast bereits eine aktive Impersonation. Beende sie, bevor du eine neue startest.",
    "pt-BR": "Você já tem uma impersonação ativa. Encerre-a antes de iniciar outra.",
    "gl-ES": "Xa tes unha impersonación activa. Remátaa antes de iniciar outra.",
  },
  impersonation_not_allowed: {
    "es-ES": "No puedes impersonar a esa persona.",
    "en-GB": "You cannot impersonate that person.",
    "de-DE": "Du kannst diese Person nicht impersonieren.",
    "pt-BR": "Você não pode se passar por essa pessoa.",
    "gl-ES": "Non podes impersonar a esa persoa.",
  },
  impersonation_forbidden_action: {
    "es-ES": "Esta acción («{action}») no se puede hacer mientras se impersona a otra persona.",
    "en-GB": "This action (“{action}”) cannot be done while impersonating another person.",
    "de-DE": "Diese Aktion („{action}“) kann nicht ausgeführt werden, während eine andere Person impersoniert wird.",
    "pt-BR": "Esta ação (“{action}”) não pode ser feita enquanto se personifica outra pessoa.",
    "gl-ES": "Esta acción («{action}») non se pode facer mentres se impersona a outra persoa.",
  },
  impersonation_not_active: {
    "es-ES": "No tienes ninguna impersonación activa.",
    "en-GB": "You don't have any active impersonation.",
    "de-DE": "Du hast keine aktive Impersonation.",
    "pt-BR": "Você não tem nenhuma impersonação ativa.",
    "gl-ES": "Non tes ningunha impersonación activa.",
  },
  // Los siguientes cinco códigos son de `contexts/assessment/` (Tarea 16 de
  // la ola 1: valoración del alumno por el profesor). Ninguno interpola
  // parámetros: sus `details` llevan identificadores y fechas que no aportan
  // nada a la frase — mismo criterio que `session_already_closed` y
  // `teacher_overlap`.
  invalid_progress_rating: {
    "es-ES": "La puntuación de progreso debe estar entre 1 y 5.",
    "en-GB": "The progress rating must be between 1 and 5.",
    "de-DE": "Die Fortschrittsbewertung muss zwischen 1 und 5 liegen.",
    "pt-BR": "A nota de progresso deve estar entre 1 e 5.",
    "gl-ES": "A puntuación de progreso debe estar entre 1 e 5.",
  },
  evaluation_period_in_future: {
    "es-ES": "No se puede valorar un periodo que todavía no ha terminado: termina en el futuro.",
    "en-GB": "You cannot evaluate a period that has not ended yet: it ends in the future.",
    "de-DE":
      "Ein Zeitraum, der noch nicht beendet ist, kann nicht bewertet werden: er endet in der Zukunft.",
    "pt-BR": "Não é possível avaliar um período que ainda não terminou: ele termina no futuro.",
    "gl-ES": "Non se pode valorar un período que aínda non rematou: remata no futuro.",
  },
  evaluation_frozen: {
    "es-ES": "Esta valoración ya está congelada: han pasado más de 7 días desde que se creó.",
    "en-GB": "This evaluation is already frozen: more than 7 days have passed since it was created.",
    "de-DE":
      "Diese Bewertung ist bereits eingefroren: seit ihrer Erstellung sind mehr als 7 Tage vergangen.",
    "pt-BR": "Esta avaliação já está congelada: já se passaram mais de 7 dias desde que foi criada.",
    "gl-ES": "Esta valoración xa está conxelada: pasaron máis de 7 días desde que se creou.",
  },
  evaluation_period_overlap: {
    "es-ES": "Ya existe otra valoración de este profesor a este alumno que se solapa con ese periodo.",
    "en-GB":
      "There is already another evaluation from this teacher to this student overlapping that period.",
    "de-DE":
      "Es gibt bereits eine andere Bewertung dieses Lehrers für diesen Schüler, die sich mit diesem Zeitraum überschneidet.",
    "pt-BR": "Já existe outra avaliação deste professor para este aluno que se sobrepõe a esse período.",
    "gl-ES": "Xa existe outra valoración deste profesor a este alumno que se solapa con ese período.",
  },
  teacher_does_not_teach_student: {
    "es-ES": "Este profesor no ha impartido clase a este alumno en el periodo indicado.",
    "en-GB": "This teacher has not taught this student during the indicated period.",
    "de-DE": "Dieser Lehrer hat diesen Schüler in dem angegebenen Zeitraum nicht unterrichtet.",
    "pt-BR": "Este professor não deu aula a este aluno no período indicado.",
    "gl-ES": "Este profesor non impartiu clase a este alumno no período indicado.",
  },
  // Los dos siguientes son de `contexts/assessment/` (Tarea 16 de la ola 2:
  // progreso del alumno). Las dos mitades de la misma regla de acceso —un
  // profesor solo ve al suyo, un alumno o tutor solo lo propio o lo
  // tutelado—, mismo criterio que `portal_access_denied` de más arriba.
  teacher_cannot_view_student_progress: {
    "es-ES": "Este profesor no da clase a este alumno: no puede ver su progreso.",
    "en-GB": "This teacher does not teach this student: they cannot view their progress.",
    "de-DE": "Dieser Lehrer unterrichtet diesen Schüler nicht: Er kann dessen Fortschritt nicht einsehen.",
    "pt-BR": "Este professor não dá aula a este aluno: não pode ver o progresso dele.",
    "gl-ES": "Este profesor non lle dá clase a este alumno: non pode ver o seu progreso.",
  },
  student_progress_access_denied: {
    "es-ES": "No puedes ver el progreso de un alumno que no eres tú ni tutelas.",
    "en-GB": "You can't view the progress of a student who isn't you or your dependant.",
    "de-DE": "Du kannst nur den Fortschritt deiner eigenen oder deiner betreuten Schüler sehen.",
    "pt-BR": "Você não pode ver o progresso de um aluno que não é você nem seu tutelado.",
    "gl-ES": "Non podes ver o progreso dun alumno que non es ti nin titelas.",
  },
  // Los cinco siguientes son de `contexts/assessment/` (Tarea 7 de la ola 2:
  // intentos y corrección). `rubric_score_mismatch` lleva `expected`/
  // `received` como arrays en `details` —para el cliente, no para el texto—,
  // así que su mensaje se deja sin marcadores, igual que
  // `tenant_resolution_failed`.
  max_attempts_exceeded: {
    "es-ES": "Este ejercicio admite como máximo {maxAttempts} intento(s): ya se alcanzó el límite.",
    "en-GB": "This exercise allows at most {maxAttempts} attempt(s): the limit has already been reached.",
    "de-DE": "Diese Übung erlaubt höchstens {maxAttempts} Versuch(e): das Limit ist bereits erreicht.",
    "pt-BR": "Este exercício admite no máximo {maxAttempts} tentativa(s): o limite já foi atingido.",
    "gl-ES": "Este exercicio admite como máximo {maxAttempts} intento(s): xa se alcanzou o límite.",
  },
  invalid_attempt_state: {
    "es-ES": "El intento no admite «{action}» desde el estado «{from}».",
    "en-GB": "The attempt does not allow «{action}» from the state «{from}».",
    "de-DE": "Der Versuch erlaubt «{action}» nicht aus dem Zustand «{from}».",
    "pt-BR": "A tentativa não admite «{action}» a partir do estado «{from}».",
    "gl-ES": "O intento non admite «{action}» dende o estado «{from}».",
  },
  invalid_attempt_score: {
    "es-ES": "La puntuación debe ser un número finito y no negativo (recibida: {score}).",
    "en-GB": "The score must be a finite, non-negative number (received: {score}).",
    "de-DE": "Die Punktzahl muss eine endliche, nicht negative Zahl sein (erhalten: {score}).",
    "pt-BR": "A pontuação deve ser um número finito e não negativo (recebida: {score}).",
    "gl-ES": "A puntuación debe ser un número finito e non negativo (recibida: {score}).",
  },
  empty_attempt_response: {
    "es-ES": "Este intento no trae ninguna respuesta que corregir.",
    "en-GB": "This attempt carries no response to correct.",
    "de-DE": "Dieser Versuch enthält keine zu korrigierende Antwort.",
    "pt-BR": "Esta tentativa não traz nenhuma resposta para corrigir.",
    "gl-ES": "Este intento non trae ningunha resposta para corrixir.",
  },
  rubric_score_mismatch: {
    "es-ES": "La corrección no trae exactamente los criterios de la rúbrica de este ejercicio.",
    "en-GB": "The correction does not carry exactly the criteria of this exercise's rubric.",
    "de-DE": "Die Korrektur enthält nicht genau die Kriterien der Rubrik dieser Übung.",
    "pt-BR": "A correção não traz exatamente os critérios da rubrica deste exercício.",
    "gl-ES": "A corrección non trae exactamente os criterios da rúbrica deste exercicio.",
  },
  // Autoservicio del alumno al enviar un intento (Tarea 12 de la ola 2:
  // panel y portal — hacer ejercicios). Mismo criterio que
  // `student_progress_access_denied` de más arriba, aplicado a ENVIAR una
  // respuesta en vez de solo verla.
  attempt_access_denied: {
    "es-ES": "No puedes enviar una respuesta en nombre de un alumno que no eres tú ni tutelas.",
    "en-GB": "You can't submit an answer on behalf of a student who isn't you or your dependant.",
    "de-DE": "Du kannst keine Antwort im Namen eines Schülers senden, der nicht du oder dein betreuter Schüler ist.",
    "pt-BR": "Você não pode enviar uma resposta em nome de um aluno que não é você nem seu tutelado.",
    "gl-ES": "Non podes enviar unha resposta en nome dun alumno que non es ti nin titelas.",
  },
  // Prueba de nivelación adaptativa (Tarea 8 de la ola 2). `placement_test_id_mismatch`
  // lleva `expected`/`received` en `details` para el cliente, no para el
  // texto (mismo criterio que `rubric_score_mismatch`).
  placement_test_already_finished: {
    "es-ES": "Esta prueba de nivelación ya ha terminado: no admite más respuestas.",
    "en-GB": "This placement test has already finished: it does not accept more answers.",
    "de-DE": "Dieser Einstufungstest ist bereits abgeschlossen: es sind keine weiteren Antworten möglich.",
    "pt-BR": "Este teste de nivelamento já terminou: não admite mais respostas.",
    "gl-ES": "Esta proba de nivelación xa remató: non admite máis respostas.",
  },
  placement_test_id_mismatch: {
    "es-ES": "El identificador de la prueba no coincide con el estado recibido.",
    "en-GB": "The test identifier does not match the received state.",
    "de-DE": "Die Test-ID stimmt nicht mit dem empfangenen Zustand überein.",
    "pt-BR": "O identificador do teste não coincide com o estado recebido.",
    "gl-ES": "O identificador da proba non coincide co estado recibido.",
  },
  placement_bank_exhausted: {
    "es-ES": "No quedan ítems del banco de nivelación para el idioma «{language}».",
    "en-GB": "There are no placement bank items left for the «{language}» language.",
    "de-DE": "Es sind keine Einstufungstest-Elemente für die Sprache «{language}» mehr übrig.",
    "pt-BR": "Não restam itens do banco de nivelamento para o idioma «{language}».",
    "gl-ES": "Non quedan ítems do banco de nivelación para o idioma «{language}».",
  },
  // Los siguientes tres códigos son de `contexts/iam/` (Tarea 15 de la ola 1:
  // RGPD operativo — acceso, portabilidad y borrado). Ninguno interpola
  // parámetros: `membershipId` viaja en `details` para el cliente, no para el
  // texto — mismo criterio que `portal_access_denied`.
  personal_data_access_denied: {
    "es-ES":
      "No puedes acceder a los datos personales de otra persona: solo puede pedirlos ella misma " +
      "(si es mayor de edad), su tutor legal si es menor, o la dirección de la escuela.",
    "en-GB":
      "You cannot access another person's personal data: only they themselves (if of legal age), " +
      "their legal guardian if a minor, or the school's management can request it.",
    "de-DE":
      "Du kannst nicht auf die personenbezogenen Daten einer anderen Person zugreifen: Das kann nur " +
      "sie selbst (falls volljährig), ihr gesetzlicher Vormund bei Minderjährigkeit, oder die " +
      "Schulleitung anfordern.",
    "pt-BR":
      "Você não pode acessar os dados pessoais de outra pessoa: só ela mesma (se for maior de idade), " +
      "seu responsável legal se for menor, ou a direção da escola podem solicitá-los.",
    "gl-ES":
      "Non podes acceder aos datos persoais doutra persoa: só pode pedilos ela mesma (se é maior de " +
      "idade), o seu titor legal se é menor, ou a dirección da escola.",
  },
  person_already_erased: {
    "es-ES": "Los datos personales de esta persona ya se borraron.",
    "en-GB": "This person's personal data has already been erased.",
    "de-DE": "Die personenbezogenen Daten dieser Person wurden bereits gelöscht.",
    "pt-BR": "Os dados pessoais desta pessoa já foram apagados.",
    "gl-ES": "Os datos persoais desta persoa xa se borraron.",
  },
  person_has_other_school_memberships: {
    "es-ES":
      "Esta persona tiene una membresía activa en otra escuela: borrar su nombre y correo aquí los " +
      "borraría también allí. No se puede completar el borrado sin acuerdo con la otra escuela.",
    "en-GB":
      "This person has an active membership in another school: erasing their name and email here " +
      "would erase them there too. The erasure cannot be completed without agreement from the other school.",
    "de-DE":
      "Diese Person hat eine aktive Mitgliedschaft in einer anderen Schule: Das Löschen von Name und " +
      "E-Mail hier würde sie auch dort löschen. Die Löschung kann ohne Absprache mit der anderen Schule " +
      "nicht abgeschlossen werden.",
    "pt-BR":
      "Esta pessoa tem uma associação ativa em outra escola: apagar seu nome e e-mail aqui também os " +
      "apagaria lá. O apagamento não pode ser concluído sem acordo com a outra escola.",
    "gl-ES":
      "Esta persoa ten unha membresía activa noutra escola: borrar o seu nome e correo aquí tamén os " +
      "borraría alí. Non se pode completar o borrado sen acordo coa outra escola.",
  },
  content_unit_has_no_exercises: {
    "es-ES": "No se puede publicar una unidad sin ejercicios.",
    "en-GB": "A unit cannot be published without exercises.",
    "de-DE": "Eine Einheit kann nicht ohne Übungen veröffentlicht werden.",
    "pt-BR": "Não é possível publicar uma unidade sem exercícios.",
    "gl-ES": "Non se pode publicar unha unidade sen exercicios.",
  },
  content_unit_already_published: {
    "es-ES": "Esta unidad ya está publicada.",
    "en-GB": "This unit is already published.",
    "de-DE": "Diese Einheit ist bereits veröffentlicht.",
    "pt-BR": "Esta unidade já está publicada.",
    "gl-ES": "Esta unidade xa está publicada.",
  },
  // Sin interpolar `attempted` ni `status`: el primero es un verbo en
  // español pensado para el mensaje interno del dominio, no para viajar a
  // otro idioma, y el segundo varía de forma según quién lo lance.
  content_unit_archived: {
    "es-ES": "Esta unidad está archivada y no admite más cambios.",
    "en-GB": "This unit is archived and cannot be changed.",
    "de-DE": "Diese Einheit ist archiviert und kann nicht mehr geändert werden.",
    "pt-BR": "Esta unidade está arquivada e não aceita mais alterações.",
    "gl-ES": "Esta unidade está arquivada e non admite máis cambios.",
  },
  content_unit_not_in_draft: {
    "es-ES": "Esta unidad no está en borrador y no se puede enviar a revisión.",
    "en-GB": "This unit is not a draft and cannot be submitted for review.",
    "de-DE": "Diese Einheit ist kein Entwurf und kann nicht zur Prüfung eingereicht werden.",
    "pt-BR": "Esta unidade não está em rascunho e não pode ser enviada para revisão.",
    "gl-ES": "Esta unidade non está en borrador e non se pode enviar a revisión.",
  },
  content_unit_level_mismatch: {
    "es-ES": "El nivel de la unidad ({unitLevel}) no coincide con el del curso al que se asocia ({courseLevel}).",
    "en-GB": "The unit's level ({unitLevel}) does not match the course it is linked to ({courseLevel}).",
    "de-DE":
      "Das Niveau der Einheit ({unitLevel}) stimmt nicht mit dem des zugehörigen Kurses überein " +
      "({courseLevel}).",
    "pt-BR": "O nível da unidade ({unitLevel}) não corresponde ao do curso ao qual está associada ({courseLevel}).",
    "gl-ES": "O nivel da unidade ({unitLevel}) non coincide co do curso ao que se asocia ({courseLevel}).",
  },
  // `invalid_exercise` es de la Tarea 2 de la ola 2 (`learning`: los once
  // tipos de ejercicio con validación por esquema). Sin interpolar `reason`:
  // su forma varía en cada una de las decenas de ramas que puede lanzar
  // (huecos sin marcador, índices fuera de rango, permutaciones que no lo
  // son...), igual que `invalid_room` deja su `reason` fuera y solo traduce
  // `{type}`, que es el único dato común a todas las ramas.
  invalid_exercise: {
    "es-ES": "El ejercicio de tipo «{type}» no es válido.",
    "en-GB": "The “{type}” exercise is not valid.",
    "de-DE": "Die Übung vom Typ „{type}“ ist ungültig.",
    "pt-BR": "O exercício do tipo “{type}” não é válido.",
    "gl-ES": "O exercicio de tipo «{type}» non é válido.",
  },
  // `unit_generation_failed` es de la Tarea 6 de la ola 2 (`learning`: caso de
  // uso completo de generación). `reason` es el mensaje de lo que falló entre
  // generar y persistir —dos intentos de salida inválida, una rúbrica que
  // falta, un ejercicio que no cumple una regla transversal—, siempre una
  // cadena, nunca un objeto: es seguro interpolarlo tal cual.
  unit_generation_failed: {
    "es-ES": "No se pudo generar la unidad «{code}»: {reason}",
    "en-GB": "The unit “{code}” could not be generated: {reason}",
    "de-DE": "Die Einheit „{code}“ konnte nicht erzeugt werden: {reason}",
    "pt-BR": "Não foi possível gerar a unidade “{code}”: {reason}",
    "gl-ES": "Non se puido xerar a unidade «{code}»: {reason}",
  },
  // Mismo criterio que `missing_actor` (`scheduling`, tarea 5 de la ola 1),
  // pero con su propio código: reutilizar aquel habría dejado un mensaje
  // traducido que habla de cancelar una clase para un fallo de generación.
  unit_generation_missing_actor: {
    "es-ES": "Generar contenido con IA requiere saber quién lo pide.",
    "en-GB": "Generating AI content requires knowing who is requesting it.",
    "de-DE": "Um KI-Inhalte zu erzeugen, muss bekannt sein, wer sie anfordert.",
    "pt-BR": "Gerar conteúdo com IA exige saber quem o está solicitando.",
    "gl-ES": "Xerar contido con IA require saber quen o pide.",
  },
  missing_reviewer: {
    "es-ES": "Publicar una unidad requiere saber quién la revisa y firma.",
    "en-GB": "Publishing a unit requires knowing who reviews and signs it off.",
    "de-DE": "Um eine Einheit zu veröffentlichen, muss bekannt sein, wer sie prüft und freigibt.",
    "pt-BR": "Publicar uma unidade exige saber quem a revisa e assina.",
    "gl-ES": "Publicar unha unidade require saber quen a revisa e asina.",
  },
  // `invalid_review_quality` es de la Tarea 9 de la ola 2 (`learning`:
  // repetición espaciada con SM-2). `quality` es la calificación 0-5 tal cual
  // se recibió, siempre un número, seguro de interpolar.
  invalid_review_quality: {
    "es-ES": "La calificación de un repaso debe ser un entero entre 0 y 5 (recibido: {quality}).",
    "en-GB": "A review rating must be a whole number from 0 to 5 (received: {quality}).",
    "de-DE": "Die Bewertung einer Wiederholung muss eine ganze Zahl von 0 bis 5 sein (erhalten: {quality}).",
    "pt-BR": "A nota de uma revisão deve ser um número inteiro de 0 a 5 (recebido: {quality}).",
    "gl-ES": "A cualificación dun repaso debe ser un enteiro entre 0 e 5 (recibido: {quality}).",
  },
  // `due_cards_access_denied` es de la Tarea 12 de la ola 2 (`learning`:
  // repaso diario del portal). Mismo criterio que `student_progress_access_
  // denied` de `assessment`, aplicado al repaso espaciado.
  due_cards_access_denied: {
    "es-ES": "No puedes ver el repaso de un alumno que no eres tú ni tutelas.",
    "en-GB": "You can't view the review of a student who isn't you or your dependant.",
    "de-DE": "Du kannst nur die Wiederholung deiner eigenen oder deiner betreuten Schüler sehen.",
    "pt-BR": "Você não pode ver a revisão de um aluno que não é você nem seu tutelado.",
    "gl-ES": "Non podes ver o repaso dun alumno que non es ti nin titelas.",
  },
  // Tarea 11 del panel (ola 2): publicar una unidad a grupos. Una unidad se
  // asocia a UN curso, así que la selección múltiple no puede mezclar cursos.
  unit_groups_multiple_courses: {
    "es-ES":
      "Los grupos elegidos son de {courseCount} cursos distintos: una unidad se publica a los grupos de un solo curso.",
    "en-GB":
      "The selected groups belong to {courseCount} different courses: a unit is published to the groups of a single course.",
    "de-DE":
      "Die gewählten Gruppen gehören zu {courseCount} verschiedenen Kursen: Eine Einheit wird an die Gruppen eines einzigen Kurses veröffentlicht.",
    "pt-BR":
      "Os grupos escolhidos são de {courseCount} cursos diferentes: uma unidade é publicada para os grupos de um único curso.",
    "gl-ES":
      "Os grupos elixidos son de {courseCount} cursos distintos: unha unidade publícase aos grupos dun só curso.",
  },
  // Los tres siguientes son de la Tarea 14 de la ola 2 (`learning`: subida de
  // material propio). `unsupported_material_format` se rechaza SIEMPRE con la
  // lista de formatos válidos —regla del brief, verbatim: nunca un «formato no
  // soportado» a secas—; la lista llega ya unida en `validFormatsLabel`
  // porque un patrón ICU no sabe formatear un array. Igual `material_too_large`
  // con `megabytes`/`maxMegabytes`, ya redondeados en el error para que los
  // cinco idiomas digan la misma cifra.
  unsupported_material_format: {
    "es-ES": "«{declaredFilename}» no tiene un formato admitido. Formatos válidos: {validFormatsLabel}.",
    "en-GB": "“{declaredFilename}” is not a supported format. Valid formats: {validFormatsLabel}.",
    "de-DE": "„{declaredFilename}“ hat kein zulässiges Format. Gültige Formate: {validFormatsLabel}.",
    "pt-BR": "«{declaredFilename}» não tem um formato aceito. Formatos válidos: {validFormatsLabel}.",
    "gl-ES": "«{declaredFilename}» non ten un formato admitido. Formatos válidos: {validFormatsLabel}.",
  },
  material_too_large: {
    "es-ES":
      "El fichero pesa {megabytes} MB; el tope es {maxMegabytes} MB. Un vídeo de una clase entera va al aula virtual, no aquí.",
    "en-GB":
      "The file is {megabytes} MB; the limit is {maxMegabytes} MB. A recording of a whole class belongs in the virtual classroom, not here.",
    "de-DE":
      "Die Datei ist {megabytes} MB groß; das Limit liegt bei {maxMegabytes} MB. Die Aufzeichnung einer ganzen Unterrichtsstunde gehört ins virtuelle Klassenzimmer, nicht hierher.",
    "pt-BR":
      "O arquivo tem {megabytes} MB; o limite é {maxMegabytes} MB. O vídeo de uma aula inteira vai para a sala virtual, não aqui.",
    "gl-ES":
      "O ficheiro pesa {megabytes} MB; o tope é {maxMegabytes} MB. Un vídeo dunha clase enteira vai á aula virtual, non aquí.",
  },
  material_not_indexed: {
    "es-ES":
      "Ese material todavía no está indexado: solo se pueden generar unidades a partir de un PDF o un DOCX cuyo texto ya se ha extraído e indexado.",
    "en-GB":
      "That material isn't indexed yet: units can only be generated from a PDF or DOCX whose text has already been extracted and indexed.",
    "de-DE":
      "Dieses Material ist noch nicht indexiert: Einheiten lassen sich nur aus einer PDF- oder DOCX-Datei erzeugen, deren Text bereits extrahiert und indexiert wurde.",
    "pt-BR":
      "Esse material ainda não está indexado: só é possível gerar unidades a partir de um PDF ou DOCX cujo texto já foi extraído e indexado.",
    "gl-ES":
      "Ese material aínda non está indexado: só se poden xerar unidades a partir dun PDF ou dun DOCX co texto xa extraído e indexado.",
  },
  // Los doce siguientes son de `contexts/assessment/` (Tarea 15 de la ola 2:
  // generación y corrección de exámenes). `insufficient_credits` e
  // `invalid_credit_amount` (copias propias del error, mismo `code` que
  // `learning`) ya tienen su entrada más arriba: no se repiten.
  exam_requires_source_units: {
    "es-ES": "Un examen necesita al menos una unidad de origen.",
    "en-GB": "An exam needs at least one source unit.",
    "de-DE": "Eine Prüfung benötigt mindestens eine Quelleinheit.",
    "pt-BR": "Um exame precisa de pelo menos uma unidade de origem.",
    "gl-ES": "Un exame necesita polo menos unha unidade de orixe.",
  },
  exam_source_unit_not_published: {
    "es-ES": "La unidad {contentUnitId} no está publicada (estado: «{status}»): no puede formar parte de un examen.",
    "en-GB": "Unit {contentUnitId} is not published (status: «{status}»): it cannot be part of an exam.",
    "de-DE": "Die Einheit {contentUnitId} ist nicht veröffentlicht (Status: „{status}“): sie kann nicht Teil einer Prüfung sein.",
    "pt-BR": "A unidade {contentUnitId} não está publicada (estado: «{status}»): não pode fazer parte de um exame.",
    "gl-ES": "A unidade {contentUnitId} non está publicada (estado: «{status}»): non pode formar parte dun exame.",
  },
  exam_skill_distribution_invalid: {
    "es-ES": "El reparto de destrezas debe sumar 100 %, y suma {sum}.",
    "en-GB": "The skill distribution must add up to 100%, and it adds up to {sum}.",
    "de-DE": "Die Kompetenzverteilung muss 100 % ergeben, ergibt aber {sum}.",
    "pt-BR": "A distribuição de destrezas deve somar 100 %, e soma {sum}.",
    "gl-ES": "O reparto de destrezas debe sumar 100 %, e suma {sum}.",
  },
  exam_has_no_items: {
    "es-ES": "El examen no tiene ningún ítem generado.",
    "en-GB": "The exam has no generated items.",
    "de-DE": "Die Prüfung enthält keine generierten Aufgaben.",
    "pt-BR": "O exame não tem nenhum item gerado.",
    "gl-ES": "O exame non ten ningún ítem xerado.",
  },
  exam_mock_framework_required: {
    "es-ES": "Un examen «mock_official» necesita indicar qué examen real simula (DELE, Cambridge, Goethe...).",
    "en-GB": "A «mock_official» exam needs to state which real exam it simulates (DELE, Cambridge, Goethe...).",
    "de-DE": "Eine „mock_official“-Prüfung muss angeben, welche echte Prüfung sie simuliert (DELE, Cambridge, Goethe...).",
    "pt-BR": "Um exame «mock_official» precisa indicar qual exame real simula (DELE, Cambridge, Goethe...).",
    "gl-ES": "Un exame «mock_official» necesita indicar que exame real simula (DELE, Cambridge, Goethe...).",
  },
  // `itemId`/`sourceExerciseId` viajan en `details` para el cliente, no para
  // el texto (mismo criterio que `rubric_score_mismatch`).
  exam_item_duplicates_practice: {
    "es-ES": "Un ítem del examen es una copia literal de un ejercicio de práctica ya existente: hace falta una variante, no el mismo contenido.",
    "en-GB": "An exam item is a literal copy of an existing practice exercise: it needs a variant, not the same content.",
    "de-DE": "Eine Prüfungsaufgabe ist eine wortwörtliche Kopie einer bereits vorhandenen Übungsaufgabe: es braucht eine Variante, nicht denselben Inhalt.",
    "pt-BR": "Um item do exame é uma cópia literal de um exercício de prática já existente: é preciso uma variante, não o mesmo conteúdo.",
    "gl-ES": "Un ítem do exame é unha copia literal dun exercicio de práctica xa existente: fai falta unha variante, non o mesmo contido.",
  },
  invalid_exam_state: {
    "es-ES": "El examen no admite «{action}» desde el estado «{from}».",
    "en-GB": "The exam does not allow «{action}» from the state «{from}».",
    "de-DE": "Die Prüfung erlaubt «{action}» nicht aus dem Zustand „{from}“.",
    "pt-BR": "O exame não admite «{action}» a partir do estado «{from}».",
    "gl-ES": "O exame non admite «{action}» dende o estado «{from}».",
  },
  empty_exam_submission: {
    "es-ES": "Este examen se entrega sin ninguna respuesta.",
    "en-GB": "This exam is submitted with no answers at all.",
    "de-DE": "Diese Prüfung wird ohne jegliche Antwort abgegeben.",
    "pt-BR": "Este exame é entregue sem nenhuma resposta.",
    "gl-ES": "Este exame éntregase sen ningunha resposta.",
  },
  invalid_exam_score: {
    "es-ES": "La puntuación debe ser un número finito y no negativo (recibida: {score}).",
    "en-GB": "The score must be a finite, non-negative number (received: {score}).",
    "de-DE": "Die Punktzahl muss eine endliche, nicht negative Zahl sein (erhalten: {score}).",
    "pt-BR": "A pontuação deve ser um número finito e não negativo (recebida: {score}).",
    "gl-ES": "A puntuación debe ser un número finito e non negativo (recibida: {score}).",
  },
  exam_scheduled_in_past: {
    "es-ES": "No se puede programar un examen en una fecha que ya ha pasado.",
    "en-GB": "An exam cannot be scheduled for a date that has already passed.",
    "de-DE": "Eine Prüfung kann nicht für ein bereits vergangenes Datum angesetzt werden.",
    "pt-BR": "Não é possível agendar um exame para uma data que já passou.",
    "gl-ES": "Non se pode programar un exame nunha data que xa pasou.",
  },
  // `reason` no es interpolable de forma fiable en los cinco idiomas (varía
  // en forma según de dónde venga el fallo) — mismo criterio que
  // `invalid_exercise` (`learning`): texto genérico, `reason` viaja en `details`.
  exam_generation_rejected: {
    "es-ES": "La generación del examen no se pudo completar.",
    "en-GB": "The exam generation could not be completed.",
    "de-DE": "Die Prüfungserstellung konnte nicht abgeschlossen werden.",
    "pt-BR": "A geração do exame não pôde ser concluída.",
    "gl-ES": "A xeración do exame non se puido completar.",
  },
  missing_exam_actor: {
    "es-ES": "Esta acción sobre un examen requiere saber quién la pide.",
    "en-GB": "This action on an exam requires knowing who requests it.",
    "de-DE": "Diese Aktion für eine Prüfung erfordert zu wissen, wer sie anfordert.",
    "pt-BR": "Esta ação sobre um exame exige saber quem a solicita.",
    "gl-ES": "Esta acción sobre un exame require saber quen a pide.",
  },
  // `reason` de `invalid_exam_item` tampoco es interpolable de forma fiable
  // (mismo criterio que `invalid_exercise`, `learning`).
  invalid_exam_item: {
    "es-ES": "El ítem del examen no cumple el esquema esperado.",
    "en-GB": "The exam item does not meet the expected schema.",
    "de-DE": "Die Prüfungsaufgabe entspricht nicht dem erwarteten Schema.",
    "pt-BR": "O item do exame não cumpre o esquema esperado.",
    "gl-ES": "O ítem do exame non cumpre o esquema esperado.",
  },
  // Los dos siguientes son de `classroom` (transcripción de la clase).
  // `transcriptId` viaja en `details` para el cliente, no para el texto (mismo
  // criterio que `teacher_overlap`), y `action` de
  // `transcript_not_processing` es un fragmento de verbo en español que no se
  // puede repartir por los cinco idiomas: mensaje fijo.
  transcript_blocked: {
    "es-ES": "La transcripción de la clase está bloqueada porque falta el consentimiento de algún participante.",
    "en-GB": "The class transcript is blocked because a participant's consent is missing.",
    "de-DE": "Das Transkript des Unterrichts ist blockiert, weil die Einwilligung eines Teilnehmers fehlt.",
    "pt-BR": "A transcrição da aula está bloqueada porque falta o consentimento de um participante.",
    "gl-ES": "A transcrición da clase está bloqueada porque falta o consentimento dalgún participante.",
  },
  transcript_not_processing: {
    "es-ES": "Esta transcripción no está procesándose: no admite esa operación en su estado actual.",
    "en-GB": "This transcript is not being processed: it does not allow that operation in its current state.",
    "de-DE": "Dieses Transkript wird gerade nicht verarbeitet: In seinem aktuellen Zustand ist diese Operation nicht möglich.",
    "pt-BR": "Esta transcrição não está sendo processada: ela não admite essa operação no estado atual.",
    "gl-ES": "Esta transcrición non está procesándose: non admite esa operación no seu estado actual.",
  },
  // Los nueve siguientes son de `feedback` (encuestas y reseñas).
  // `invalid_survey_score` e `invalid_review_rating` llevan siempre los mismos
  // escalares (`score`/`rating`, `min`, `max`), seguros de interpolar —mismo
  // criterio que `invalid_review_quality`—. `kind`, `expected` y `actual` son
  // literales del dominio («nps», «student»...) que no se leen bien en un
  // mensaje, y los identificadores viajan en `details` para el cliente.
  invalid_survey_score: {
    "es-ES": "La puntuación de la encuesta debe ser un entero entre {min} y {max} (recibida: {score}).",
    "en-GB": "The survey score must be a whole number between {min} and {max} (received: {score}).",
    "de-DE": "Die Umfragebewertung muss eine ganze Zahl zwischen {min} und {max} sein (erhalten: {score}).",
    "pt-BR": "A pontuação da pesquisa deve ser um número inteiro entre {min} e {max} (recebida: {score}).",
    "gl-ES": "A puntuación da enquisa debe ser un enteiro entre {min} e {max} (recibida: {score}).",
  },
  inactive_survey: {
    "es-ES": "Esta encuesta no acepta nuevas respuestas.",
    "en-GB": "This survey is not accepting new responses.",
    "de-DE": "Diese Umfrage nimmt keine neuen Antworten mehr an.",
    "pt-BR": "Esta pesquisa não está aceitando novas respostas.",
    "gl-ES": "Esta enquisa non acepta novas respostas.",
  },
  survey_audience_mismatch: {
    "es-ES": "Esta encuesta no corresponde al tipo de persona que intenta responder.",
    "en-GB": "This survey is not meant for the type of person trying to answer it.",
    "de-DE": "Diese Umfrage richtet sich nicht an die Art von Person, die sie beantworten möchte.",
    "pt-BR": "Esta pesquisa não se destina ao tipo de pessoa que está tentando responder.",
    "gl-ES": "Esta enquisa non corresponde ao tipo de persoa que tenta responder.",
  },
  survey_session_required: {
    "es-ES": "Una encuesta post-clase necesita la clase a la que se refiere.",
    "en-GB": "A post-class survey needs the class it refers to.",
    "de-DE": "Eine Umfrage nach dem Unterricht benötigt den Unterricht, auf den sie sich bezieht.",
    "pt-BR": "Uma pesquisa pós-aula precisa da aula à qual se refere.",
    "gl-ES": "Unha enquisa postclase necesita a clase á que se refire.",
  },
  survey_access_denied: {
    "es-ES": "Solo quien asistió a la clase puede responder esta encuesta post-clase.",
    "en-GB": "Only people who attended the class can answer this post-class survey.",
    "de-DE": "Nur wer am Unterricht teilgenommen hat, kann diese Umfrage danach beantworten.",
    "pt-BR": "Somente quem participou da aula pode responder a esta pesquisa pós-aula.",
    "gl-ES": "Só quen asistiu á clase pode responder esta enquisa postclase.",
  },
  missing_respondent_membership: {
    "es-ES": "Responder una encuesta requiere una membresía activa en la escuela.",
    "en-GB": "Answering a survey requires an active membership in the school.",
    "de-DE": "Um eine Umfrage zu beantworten, braucht es eine aktive Mitgliedschaft in der Schule.",
    "pt-BR": "Responder a uma pesquisa exige uma associação ativa na escola.",
    "gl-ES": "Responder unha enquisa require unha membresía activa na escola.",
  },
  invalid_review_rating: {
    "es-ES": "La reseña debe puntuar de {min} a {max} (recibido: {rating}).",
    "en-GB": "A review must rate from {min} to {max} (received: {rating}).",
    "de-DE": "Eine Bewertung muss von {min} bis {max} Punkte vergeben (erhalten: {rating}).",
    "pt-BR": "A avaliação deve pontuar de {min} a {max} (recebido: {rating}).",
    "gl-ES": "A reseña debe puntuar de {min} a {max} (recibido: {rating}).",
  },
  review_already_acknowledged: {
    "es-ES": "Esta reseña ya estaba marcada como vista.",
    "en-GB": "This review was already marked as seen.",
    "de-DE": "Diese Bewertung war bereits als gesehen markiert.",
    "pt-BR": "Esta avaliação já estava marcada como vista.",
    "gl-ES": "Esta reseña xa estaba marcada como vista.",
  },
  missing_reviewer_membership: {
    "es-ES": "Crear o marcar una reseña requiere una membresía activa en la escuela.",
    "en-GB": "Creating or marking a review requires an active membership in the school.",
    "de-DE": "Um eine Bewertung zu erstellen oder zu markieren, braucht es eine aktive Mitgliedschaft in der Schule.",
    "pt-BR": "Criar ou marcar uma avaliação exige uma associação ativa na escola.",
    "gl-ES": "Crear ou marcar unha reseña require unha membresía activa na escola.",
  },
  // Los dos siguientes son de `people` (candidatos). `leadId` y `status`
  // («converted», «discarded») viajan en `details` para el cliente.
  lead_already_converted: {
    "es-ES": "Este candidato ya se ha convertido en alumno.",
    "en-GB": "This lead has already been converted into a student.",
    "de-DE": "Dieser Interessent wurde bereits in einen Schüler umgewandelt.",
    "pt-BR": "Este candidato já foi convertido em aluno.",
    "gl-ES": "Este candidato xa se converteu en alumno.",
  },
  lead_already_closed: {
    "es-ES": "Este candidato ya está cerrado y no admite esa operación.",
    "en-GB": "This lead is already closed and does not allow that operation.",
    "de-DE": "Dieser Interessent ist bereits geschlossen und erlaubt diese Operation nicht.",
    "pt-BR": "Este candidato já está encerrado e não admite essa operação.",
    "gl-ES": "Este candidato xa está pechado e non admite esa operación.",
  },
  // Los seis siguientes son de `sites` (sitio público de la escuela). Solo
  // `duplicate_site_domain` interpola: su `hostname` es un escalar presente en
  // la única rama que lo lanza. Los demás varían la forma de `details` según
  // la regla que falla —`invalid_site_domain` incluso tiene una rama sin
  // `details`—, así que llevan mensaje fijo (mismo criterio que
  // `invalid_time_slot`).
  invalid_site_block: {
    "es-ES": "El bloque del sitio no cumple las reglas de su tipo.",
    "en-GB": "The site block does not meet the rules of its type.",
    "de-DE": "Der Block der Website erfüllt die Regeln seines Typs nicht.",
    "pt-BR": "O bloco do site não cumpre as regras do seu tipo.",
    "gl-ES": "O bloque do sitio non cumpre as regras do seu tipo.",
  },
  invalid_site_page: {
    "es-ES": "La página del sitio no es válida.",
    "en-GB": "The site page is not valid.",
    "de-DE": "Die Seite der Website ist ungültig.",
    "pt-BR": "A página do site não é válida.",
    "gl-ES": "A páxina do sitio non é válida.",
  },
  invalid_site: {
    "es-ES": "La configuración del sitio no es válida.",
    "en-GB": "The site configuration is not valid.",
    "de-DE": "Die Konfiguration der Website ist ungültig.",
    "pt-BR": "A configuração do site não é válida.",
    "gl-ES": "A configuración do sitio non é válida.",
  },
  invalid_site_domain: {
    "es-ES": "El dominio del sitio no es válido.",
    "en-GB": "The site domain is not valid.",
    "de-DE": "Die Domain der Website ist ungültig.",
    "pt-BR": "O domínio do site não é válido.",
    "gl-ES": "O dominio do sitio non é válido.",
  },
  duplicate_site_domain: {
    "es-ES": "El dominio {hostname} ya está dado de alta.",
    "en-GB": "The domain {hostname} is already registered.",
    "de-DE": "Die Domain {hostname} ist bereits eingetragen.",
    "pt-BR": "O domínio {hostname} já está cadastrado.",
    "gl-ES": "O dominio {hostname} xa está dado de alta.",
  },
  rate_limited: {
    "es-ES": "Demasiadas peticiones seguidas. Inténtalo de nuevo en unos segundos.",
    "en-GB": "Too many requests in a row. Please try again in a few seconds.",
    "de-DE": "Zu viele Anfragen in kurzer Zeit. Bitte versuche es in ein paar Sekunden erneut.",
    "pt-BR": "Muitas requisições seguidas. Tente novamente em alguns segundos.",
    "gl-ES": "Demasiadas peticións seguidas. Téntao de novo nuns segundos.",
  },
};

/**
 * Mensaje traducido e interpolado.
 *
 * `params` son los `details` del error de dominio. Si el mensaje no lleva
 * marcadores, `params` sobra y no estorba.
 */
export function translateError(
  code: string,
  locale: Locale | string,
  params: Record<string, unknown> = {},
): string | null {
  const byLocale = MESSAGES[code];
  if (!byLocale) return null;

  const pattern = byLocale[locale as Locale] ?? byLocale[DEFAULT_LOCALE];
  if (!pattern) return null;

  return new IntlMessageFormat(pattern, locale).format(params) as string;
}
