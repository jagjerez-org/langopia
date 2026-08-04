import { ApiError, api, getSchoolSlug } from "../../../lib/api-client.js";
import type { Problem } from "../../../lib/api-client.js";
import type {
  CreateUnitFromMaterialInput,
  CreateUnitFromMaterialResult,
  UploadMaterialResult,
} from "./types.js";

/**
 * Cliente de la subida de material propio (Tarea 14 de la ola 2).
 *
 * `uploadMaterial` NO usa `api.post` del cliente compartido, y es la única
 * excepción del panel: `fetch` no informa del progreso de SUBIDA (su
 * `ReadableStream` de progreso es solo de bajada), y el brief pide progreso
 * de verdad para un fichero que puede pesar 100 MB. `XMLHttpRequest` sí lo
 * da (`upload.onprogress`), así que se usa aquí y solo aquí.
 *
 * Todo lo demás se mantiene igual que en el cliente compartido: `credentials`
 * para la cookie de sesión, la cabecera `x-school-slug` con la escuela
 * elegida, `Accept-Language` con el idioma de la interfaz, y el mismo
 * `ApiError` con el `Problem` de la API — para que quien lo pinte use el
 * mismo `useErrorMessage` que el resto de pantallas. `Content-Type` NO se
 * fija a mano: lo pone el navegador con el `boundary` del multiparte.
 */
export function uploadMaterial(
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadMaterialResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/v1/learning/materials");
    request.withCredentials = true;
    request.setRequestHeader("Accept-Language", document.documentElement.lang);
    const slug = getSchoolSlug();
    if (slug) request.setRequestHeader("x-school-slug", slug);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onerror = () => {
      // Mismo código que el cliente compartido para un fallo de red: la
      // pantalla no tiene que distinguir de dónde vino.
      reject(new ApiError({ code: "network_error", title: "", status: 0 }));
    };

    request.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(request.responseText) as unknown;
      } catch (cause) {
        // Un cuerpo ilegible no se descarta en silencio: si además era un
        // error, esta es la única pista de qué pasó.
        console.error("respuesta sin JSON válido al subir material", {
          status: request.status,
          cause,
        });
      }

      if (request.status >= 200 && request.status < 300) {
        resolve(body as UploadMaterialResult);
        return;
      }
      const problem = body as Partial<Problem> | null;
      reject(
        new ApiError({
          code: problem?.code ?? "unknown_error",
          title: problem?.title ?? request.statusText,
          status: request.status,
          params: problem?.params,
          details: problem?.details,
          traceId: problem?.traceId,
        }),
      );
    };

    request.send(form);
  });
}

/** `POST /learning/units/from-material`: unidad `hybrid` sobre el material ya subido e indexado. */
export function createUnitFromMaterial(
  input: CreateUnitFromMaterialInput,
): Promise<CreateUnitFromMaterialResult> {
  return api.post<CreateUnitFromMaterialResult>("/learning/units/from-material", input);
}
