import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Clock } from "../../domain/ports/clock.port.js";
import type { IdGenerator } from "../../domain/ports/id-generator.port.js";

/** El reloj de verdad. En las pruebas se sustituye por uno fijo. */
@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

@Injectable()
export class UuidGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
