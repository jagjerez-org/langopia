# RGPD operativo

Qué datos personales guarda Langopia, cuánto tiempo, con qué base legal, y cómo se ejercen en la
práctica el derecho de acceso, portabilidad y supresión (Tarea 15, ola 1).

## Qué se guarda, dónde y con qué base legal

| Dato | Contexto / tabla | Base legal (RGPD art. 6) | Retención |
|---|---|---|---|
| Ficha (nombre, correo, fecha de nacimiento, nivel, idiomas) | `people` (`users`, `student_profiles`, `teacher_profiles`) | Ejecución del contrato (art. 6.1.b) | Mientras dure la relación con la escuela |
| Tutores legales y consentimientos | `people` (`guardians`, `consents`) | Consentimiento del tutor (art. 6.1.a) para un menor; interés legítimo/contrato para el resto | Mientras dure la relación; el consentimiento se conserva como prueba aunque se retire |
| Matrículas | `catalog` (`enrollments`) | Ejecución del contrato | Mientras dure la relación |
| Asistencia | `scheduling` (`attendance`) | Ejecución del contrato | Mientras dure la relación |
| Intentos y exámenes | `assessment` (`attempts`, `assessments`) | Ejecución del contrato | Mientras dure la relación |
| Valoraciones del progreso | `assessment` (`evaluations`) | Interés legítimo (seguimiento pedagógico) | Mientras dure la relación |
| Grabaciones y transcripciones | `classroom` (`transcripts`, `transcript_segments`) | Consentimiento expreso, **de todos los participantes** (art. 6.1.a); sin consentimiento de uno solo, no se graba la clase entera | `schools.data_retention_days` desde la clase; la purga diaria de la ola 0 (`PurgeExpiredRecordingsJob`) la borra al vencer |
| Facturas | `billing` (`invoices`, `invoice_lines`, `payments`) | Obligación legal fiscal (art. 6.1.c) | El plazo de conservación fiscal aplicable (España: 6 años desde el último asiento, Ley 58/2003 y Código de Comercio); **prevalece sobre el derecho de supresión** mientras dure |
| Avisos por correo | `notifications` | Ejecución del contrato | **No se persiste ninguno.** El correo se envía y no queda registro más allá del log de la pasarela (Resend) y del rastro de que se disparó un evento; no hay tabla que exportar o borrar en este contexto |
| Rastro de auditoría (quién hizo qué) | `shared` (`audit_logs`) | Obligación legal / interés legítimo en poder demostrar cumplimiento | Append-only, no se borra con la persona: es la prueba de qué se hizo, incluido el propio borrado |

## Los menores

Quien ejerce cualquiera de estos tres derechos sobre los datos de un alumno **menor de edad** es su
tutor legal, nunca el propio menor — el dominio lo comprueba
(`canAccessPersonalData`, `apps/api/src/contexts/iam/domain/model/personal-data-access.ts`), no
la interfaz. Un menor que pida sus propios datos recibe el mismo `403` que un desconocido; solo
pasa quien conste como su tutor (`guardians.can_give_consent`) o la dirección de la escuela
(`owner`/`admin`).

## Derecho de acceso y portabilidad

`GET /people/:membershipId/export` devuelve un único JSON con todo lo que la escuela tiene de esa
persona: ficha, tutores o tutelados, consentimientos, matrículas, asistencia, intentos, exámenes,
valoraciones, facturas y las transcripciones donde aparece (como quien habló, o como quien asistió
o impartió la sesión, aunque el reconocimiento de voz no le atribuyera ningún segmento).

Puede pedirlo:

- La propia persona, si es mayor de edad.
- Su tutor legal, si es menor.
- La dirección de la escuela (`owner`/`admin`), sobre cualquier miembro.

Nadie más, aunque comparta escuela (un profesor no puede exportar los datos de un alumno solo por
serlo).

## Derecho de supresión

`POST /people/:membershipId/erase` — **exclusivamente rol `owner`**, sea quien sea quien lo haya
solicitado. Es irreversible y queda registrado en `audit_logs` (`action: iam.person.erased`).

**No es un `DELETE`.** Un borrado en cascada se llevaría por delante las facturas, que hay que
conservar por ley fiscal, y las clases de un grupo, que no desaparecen porque uno de sus alumnos se
vaya. En su lugar:

1. **Se pseudonimiza la identidad** (`users.name` → `Persona eliminada (RGPD)`,
   `users.email` → un marcador único bajo `erased.invalid`, el TLD que la IANA reserva para
   direcciones que a propósito no son de nadie). Como el nombre y el correo se leen siempre por
   `JOIN` contra `users` — ninguna otra tabla los guarda como texto —, esta única fila pseudonimizada
   basta para que cualquier factura, asistencia o valoración pasada deje de mostrar el dato real, sin
   tocar esas filas ni sus importes.
2. **Se borran los ficheros de grabación de los que esta persona era la única protagonista**: una
   clase 1 a 1 donde nadie más asistió. Si la sesión fue de grupo, el fichero se conserva —borrarlo
   quitaría a otros alumnos su propio material sin que lo hayan pedido—, y en su lugar se anonimiza
   el enlace de identidad en `transcript_segments` (`speaker_membership_id`, `speaker_label`) de
   **sus** intervenciones, dejando intacto lo que dijeron los demás y el texto en sí, que es
   conversación compartida de la clase, no un dato exclusivamente suyo.
3. **Queda constancia en `audit_logs`**, sin el nombre ni el correo reales — el rastro dice qué
   pasó (cuántas grabaciones se borraron, cuántos segmentos se anonimizaron), nunca reintroduce el
   dato que se acaba de borrar.

**Las facturas se conservan con el importe exacto y sin datos personales**: la obligación fiscal y
el derecho al olvido conviven porque el importe nunca dependió del nombre, y el nombre ya desapareció
en el paso 1.

### Qué decide qué NO se borra, y por qué

| No se toca | Motivo |
|---|---|
| `invoices` (importe, líneas, pagos) | Obligación de conservación fiscal, por delante del derecho de supresión mientras dure el plazo legal |
| `consents.granted_by_membership_id` | Es la prueba de quién autorizó qué — incluido el consentimiento de grabación de un menor firmado por su tutor —, y esa prueba tiene valor legal propio |
| `student_profiles.goals` / `teacher_profiles.bio` (texto libre) | El brief define la pseudonimización como sustituir nombre y correo; estos campos son contenido pedagógico de interés legítimo de la escuela, no el identificador de la persona. Si en el futuro se detecta que contienen datos sensibles con frecuencia, es una decisión aparte, no automática |
| Sesiones, grupos y matrículas | Una clase de un grupo no desaparece porque uno de sus alumnos se vaya; el historial de a qué grupo perteneció es dato operativo de la escuela |
| `memberships.status` | Queda `active`. Este borrado es RGPD, no una baja operativa — si la escuela también quiere dar de baja a la persona, lo hace aparte (`POST /students/:id/leave`), con su propio motivo y su propio evento de dominio |

## Límite conocido: identidad compartida entre escuelas

`users` es una tabla global — la misma persona puede dar clase en dos escuelas (caso real del seed:
Dan Whitfield, en Atlántico y en Paulista) —. Si se pseudonimizara su nombre al borrarlo desde una
escuela, la otra vería desaparecer el nombre de su propio profesor sin haberlo pedido. Por eso
`ErasePersonHandler` comprueba antes si la persona tiene otra membresía **activa** en otra escuela
(reutilizando `memberships_for_auth_user`, la misma función que resuelve el tenant al iniciar sesión)
y, si la tiene, **rechaza el borrado entero** con `person_has_other_school_memberships` en vez de
hacerlo a medias.

Esa comprobación solo funciona si la persona alguna vez inició sesión (`users.auth_user_id` no es
`NULL`). Si nunca lo hizo —el caso típico de un alumno, a menudo menor, dado de alta solo por esta
escuela—, no hay credencial con la que preguntar por sus otras membresías y se asume que pertenece a
una única escuela. Cerrar ese hueco del todo pide una función nueva a nivel de `user_id` en
`packages/db/src/policies.sql`, que esta tarea no añadió: ese fichero estaba siendo editado en
paralelo por la Tarea 17 (impersonación de soporte) en el momento de implementar esta, y ampliarlo
entonces era más riesgo de conflicto que beneficio para un caso límite. Queda anotado para cuando se
generalice el borrado a perfiles con más presencia entre escuelas.

## Impersonación de soporte

Mientras alguien impersona a otra persona (Tarea 17), **no puede** exportar ni borrar datos: las dos
rutas de este documento llevan `@RestrictedWhileImpersonating("data_export_or_erasure")`. Sin esto,
el soporte de la plataforma actuando como un `owner` sería una vía de exfiltración con la propia
herramienta de auditoría.

## Qué queda fuera, a propósito

- No se revoca la sesión de Better Auth (`user`/`session`/`account`) al borrar: el puente
  `users.auth_user_id` es el único que conecta ambos mundos, y tocar las tablas de credenciales es
  una decisión de identidad más amplia que esta tarea, con su propio análisis pendiente.
- No se genera un fichero descargable: `GET /people/:membershipId/export` devuelve el JSON
  directamente, igual que cualquier otro `GET` de la API — la portabilidad no exige un formato de
  fichero concreto, solo un formato estructurado y de uso común, que JSON ya es.
