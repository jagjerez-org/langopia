import { DeleteObjectCommand, PutObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ObjectStoragePort } from "../../domain/ports/object-storage.port.js";

/**
 * Sin las cuatro variables de entorno no hay forma de hablar con el almacén
 * de objetos en este entorno. El camino falla limpio y pronto —antes de
 * construir ningún cliente— en vez de fallar tarde con un error de red o de
 * autenticación de AWS más difícil de diagnosticar.
 */
export class MissingObjectStorageCredentialsError extends Error {
  constructor() {
    super(
      "Falta configurar el almacén de objetos: definir OBJECT_STORAGE_BUCKET, OBJECT_STORAGE_REGION, " +
        "OBJECT_STORAGE_ACCESS_KEY_ID y OBJECT_STORAGE_SECRET_ACCESS_KEY. " +
        "OBJECT_STORAGE_ENDPOINT es opcional (solo hace falta para un proveedor compatible con S3 distinto de AWS, como R2).",
    );
    this.name = "MissingObjectStorageCredentialsError";
  }
}

/**
 * Adaptador real de `ObjectStoragePort` sobre S3 (o cualquier almacén
 * compatible con su API, como Cloudflare R2 vía `OBJECT_STORAGE_ENDPOINT`).
 *
 * Cierra la deuda anotada en el saneamiento previo a esta ola: antes de este
 * adaptador, `classroom` e `iam` resolvían su necesidad de borrar ficheros
 * contra un noop que siempre "tenía éxito" sin tocar nada real, así que una
 * purga o un borrado RGPD acababan quitando la fila de Postgres (y con ella
 * la referencia al fichero) mientras el fichero de verdad seguía existiendo,
 * huérfano e ilocalizable. Este adaptador borra de verdad cuando hay
 * credenciales, y si no las hay, lanza en vez de fingir éxito: un borrado que
 * no deja rastro de haber fallado es tan malo como no borrar nada.
 *
 * `S3Client` no valida credenciales en su constructor —las resuelve de forma
 * perezosa en la primera llamada—, así que comprobamos la configuración
 * nosotros mismos antes de construirlo: da un mensaje en español, claro y
 * temprano, en vez de un error crudo del SDK de AWS.
 */
@Injectable()
export class S3ObjectStorageAdapter implements ObjectStoragePort {
  constructor(private readonly config: ConfigService) {}

  async put(params: { key: string; body: Buffer; contentType: string }): Promise<void> {
    const client = this.requireClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.requireBucket(),
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    const client = this.requireClient();
    // DeleteObject de S3 es idempotente: borrar una clave que ya no existe
    // no lanza. Es justo el contrato que exige `RecordingStoragePort`.
    await client.send(new DeleteObjectCommand({ Bucket: this.requireBucket(), Key: key }));
  }

  private requireBucket(): string {
    const bucket = this.config.get<string>("OBJECT_STORAGE_BUCKET");
    if (!bucket) throw new MissingObjectStorageCredentialsError();
    return bucket;
  }

  private requireClient(): S3Client {
    const region = this.config.get<string>("OBJECT_STORAGE_REGION");
    const accessKeyId = this.config.get<string>("OBJECT_STORAGE_ACCESS_KEY_ID");
    const secretAccessKey = this.config.get<string>("OBJECT_STORAGE_SECRET_ACCESS_KEY");
    const bucket = this.config.get<string>("OBJECT_STORAGE_BUCKET");
    if (!region || !accessKeyId || !secretAccessKey || !bucket) {
      throw new MissingObjectStorageCredentialsError();
    }
    const endpoint = this.config.get<string>("OBJECT_STORAGE_ENDPOINT");
    return this.createClient({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  /** Punto de extensión para las pruebas: sustituir por un doble del SDK sin tocar la lógica. */
  protected createClient(options: S3ClientConfig): S3Client {
    return new S3Client(options);
  }
}
