import type { S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import { MissingObjectStorageCredentialsError, S3ObjectStorageAdapter } from "./s3-object-storage.adapter.js";

function configWith(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const FULL_CONFIG = {
  OBJECT_STORAGE_BUCKET: "langopia-media",
  OBJECT_STORAGE_REGION: "eu-west-1",
  OBJECT_STORAGE_ACCESS_KEY_ID: "AKIATEST",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret",
};

/** Expone `createClient` para sustituirlo por un doble del SDK en cada prueba. */
class TestableS3ObjectStorageAdapter extends S3ObjectStorageAdapter {
  createClientCalls: unknown[] = [];
  sendCalls: unknown[] = [];
  sendImpl: (command: unknown) => Promise<unknown> = async () => undefined;

  protected override createClient(options: unknown): S3Client {
    this.createClientCalls.push(options);
    return { send: (command: unknown) => this.sendImpl(command) } as unknown as S3Client;
  }
}

describe("S3ObjectStorageAdapter", () => {
  it("sin ninguna variable de entorno, put() rechaza con MissingObjectStorageCredentialsError sin crear cliente", async () => {
    const adapter = new TestableS3ObjectStorageAdapter(configWith({}));

    await expect(
      adapter.put({ key: "k", body: Buffer.from("x"), contentType: "audio/mpeg" }),
    ).rejects.toBeInstanceOf(MissingObjectStorageCredentialsError);
    expect(adapter.createClientCalls).toHaveLength(0);
  });

  it("con el bucket vacío, delete() también falla limpio", async () => {
    const adapter = new TestableS3ObjectStorageAdapter(
      configWith({ ...FULL_CONFIG, OBJECT_STORAGE_BUCKET: undefined }),
    );

    await expect(adapter.delete("k")).rejects.toBeInstanceOf(MissingObjectStorageCredentialsError);
  });

  it("con credenciales completas, put() sube el fichero al bucket configurado", async () => {
    const adapter = new TestableS3ObjectStorageAdapter(configWith(FULL_CONFIG));
    let seenCommand: any;
    adapter.sendImpl = async (command) => {
      seenCommand = command;
      return {};
    };

    await adapter.put({ key: "atlantico/units/ES-B1-U07/audio-1", body: Buffer.from("audio"), contentType: "audio/mpeg" });

    expect(seenCommand.input.Bucket).toBe("langopia-media");
    expect(seenCommand.input.Key).toBe("atlantico/units/ES-B1-U07/audio-1");
    expect(seenCommand.input.ContentType).toBe("audio/mpeg");
  });

  it("con OBJECT_STORAGE_ENDPOINT, construye el cliente con endpoint propio y forcePathStyle (compatibilidad R2)", async () => {
    const adapter = new TestableS3ObjectStorageAdapter(
      configWith({ ...FULL_CONFIG, OBJECT_STORAGE_ENDPOINT: "https://accountid.r2.cloudflarestorage.com" }),
    );

    await adapter.delete("k");

    expect(adapter.createClientCalls[0]).toMatchObject({
      endpoint: "https://accountid.r2.cloudflarestorage.com",
      forcePathStyle: true,
    });
  });

  it("delete() es seguro de invocar dos veces con la misma clave: la segunda no lanza", async () => {
    const adapter = new TestableS3ObjectStorageAdapter(configWith(FULL_CONFIG));
    adapter.sendImpl = async () => ({});

    await adapter.delete("k");
    await expect(adapter.delete("k")).resolves.toBeUndefined();
  });
});
