// Deja correr en un script de Node los modulos sellados con `server-only`
// (src/lib/prisma.ts). El sello existe para que ningun client component los
// bundlee; aqui no hay bundle, solo Node.
const Module = require("module");
const path = require("path");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only" || request === "client-only") {
    return path.join(__dirname, "_noop.cjs");
  }
  return original.call(this, request, ...rest);
};
