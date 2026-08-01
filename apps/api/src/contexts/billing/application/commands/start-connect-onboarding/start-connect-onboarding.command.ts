import { Command } from "@nestjs/cqrs";

/**
 * Da de alta (o continúa) el trámite de verificación del comerciante de la
 * escuela activa y devuelve la URL a la que redirigirla.
 *
 * `returnUrl`/`refreshUrl` las decide quien nos llama (el panel): a dónde
 * vuelve la escuela al terminar, y a dónde si el enlace caduca antes.
 */
export class StartConnectOnboardingCommand extends Command<{ onboardingUrl: string }> {
  constructor(
    readonly props: {
      returnUrl: string;
      refreshUrl: string;
    },
  ) {
    super();
  }
}
