import { All, Controller, Inject, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Public } from "../../../shared/infrastructure/http/roles.decorator.js";
import { AUTH, type Auth } from "../auth/better-auth.config.js";

/**
 * Adaptador de entrada para Better Auth.
 *
 * Better Auth expone un handler que habla el estándar Fetch API. Nest usa
 * Express, así que hay que traducir en ambos sentidos. Es exactamente el punto
 * que había que validar antes de comprometerse con esta librería.
 */
@Controller("auth")
export class AuthController {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  @Public()
  @All("*path")
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const url = new URL(req.originalUrl, `${req.protocol}://${req.get("host")}`);
    const headers = new Headers();
    for (const [clave, valor] of Object.entries(req.headers)) {
      if (typeof valor === "string") headers.set(clave, valor);
      else if (Array.isArray(valor)) headers.set(clave, valor.join(","));
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    const response = await this.auth.handler(request);

    res.status(response.status);
    // Las cookies van aparte: `setHeader` PISA el valor anterior, y una misma
    // respuesta puede traer varias. Al cerrar sesión son tres, y en el ida y
    // vuelta de OAuth son el `state` y el verificador PKCE. Copiarlas en el
    // bucle dejaría solo la última y el resto se perdería en silencio.
    response.headers.forEach((valor, clave) => {
      if (clave !== "set-cookie") res.setHeader(clave, valor);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) res.setHeader("set-cookie", cookies);

    res.send(await response.text());
  }
}
