// Vercel solo crea funciones serverless desde el directorio `api/` del
// proyecto, y el código de verdad lo compila antes `nest build` en `dist/`
// (ver `buildCommand` en `vercel.json`). Este shim existe para que la
// función sea un fichero plano que el empaquetador de Vercel traza hasta
// `dist/vercel.js` y, transitivamente, a toda la aplicación.
module.exports = require("../dist/vercel.js").default;
