// Vercel ejecuta este fichero como función serverless. El bundle real se
// genera con `@vercel/ncc` durante el build (ver `vercel.json`).
// pdfjs-dist (usado por pdf-parse) necesita un `DOMMatrix` global; lo
// instalamos ANTES de cargar el bundle para que el polyfill esté disponible
// durante la evaluación de los módulos empaquetados.
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = require("dommatrix");
}
module.exports = require("../dist/ncc/index.js");
