import { Body, Controller, HttpCode, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CommandBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { CreateUnitFromMaterialCommand } from "../../application/commands/create-unit-from-material/create-unit-from-material.command.js";
import { UploadMaterialCommand } from "../../application/commands/upload-material/upload-material.command.js";
import {
  MAX_MATERIAL_BYTES,
  UnsupportedMaterialFormatError,
} from "../../domain/model/uploaded-material.vo.js";
import { CreateUnitFromMaterialDto } from "./dto/materials.dto.js";

/**
 * Lo que `multer` deja en la petición. Se declara aquí, mínimo, en vez de
 * añadir `@types/multer` al proyecto: de un fichero subido solo se usan estos
 * tres campos, y el tipo completo arrastra el vocabulario de una biblioteca
 * que ningún otro sitio de la API menciona.
 */
type UploadedFilePart = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

/**
 * Freno de memoria, no la regla de negocio.
 *
 * El tope de verdad son 100 MB y lo decide el dominio
 * (`UploadedMaterial.create()` → `MaterialTooLargeError`, un error traducido
 * a los cinco idiomas que explica cuál es el límite). Este otro límite existe
 * para que un fichero absurdo no se cargue entero en memoria antes de llegar
 * a esa comprobación: el doble del tope deja pasar cualquier fichero que el
 * dominio pueda rechazar con su mensaje y corta los que solo pueden ser un
 * abuso.
 */
const MULTIPART_MEMORY_LIMIT_BYTES = MAX_MATERIAL_BYTES * 2;

/**
 * Adaptador de ENTRADA sobre HTTP para el material propio de la escuela
 * (tarea 14 de la ola 2).
 *
 * `owner`/`admin`/`teacher`, igual que `UnitsController`: subir el cuaderno
 * de siempre y convertirlo en una unidad es trabajo de quien prepara clase,
 * no del alumnado.
 *
 * Es el único sitio de `learning` que sabe que existe `multipart/form-data`:
 * saca el fichero de la petición y lo pasa como `Buffer` al comando, que no
 * sabe nada de HTTP. Subir NO consume créditos (solo generar consume), así
 * que aquí no hay ninguna comprobación de saldo.
 */
@Roles("owner", "admin", "teacher")
@Controller("learning")
export class MaterialsController {
  constructor(private readonly commands: CommandBus) {}

  /**
   * `POST /learning/materials` (multiparte, campo `file`). El formato lo
   * decide el CONTENIDO del fichero, no su extensión ni el `Content-Type`
   * que declare el cliente: eso lo comprueba `UploadedMaterial.create()`.
   */
  @Post("materials")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MULTIPART_MEMORY_LIMIT_BYTES, files: 1 } }),
  )
  async upload(@UploadedFile() file?: UploadedFilePart) {
    // Sin fichero no hay nada que validar por contenido: se responde con la
    // MISMA lista de formatos válidos que un formato rechazado, que es lo que
    // quien sube necesita saber en los dos casos.
    if (!file) throw new UnsupportedMaterialFormatError("(sin fichero)");

    return this.commands.execute(
      new UploadMaterialCommand({
        bytes: file.buffer,
        declaredFilename: file.originalname,
        declaredMimeType: file.mimetype,
      }),
    );
  }

  /** `POST /learning/units/from-material`: unidad `hybrid` sobre el material ya subido e indexado. */
  @Post("units/from-material")
  @HttpCode(201)
  async createUnitFromMaterial(@Body() dto: CreateUnitFromMaterialDto) {
    return this.commands.execute(
      new CreateUnitFromMaterialCommand({
        materialId: dto.materialId,
        code: dto.code,
        language: dto.language,
        level: dto.level,
        topic: dto.topic,
        skills: dto.skills,
        primaryLocale: dto.primaryLocale,
        exerciseTypes: dto.exerciseTypes,
      }),
    );
  }
}
