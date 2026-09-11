// Preload for standalone scripts that need BOTH env files: DATABASE_URL lives
// in .env, every other key in .env.local. Also neutralises the `server-only`
// fence so scripts can import src/lib/prisma outside Next.
const path = require("path");
const root = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env.local"), quiet: true });
require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
const Module = require("module");
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === "server-only") return {};
  return load.call(this, request, ...rest);
};
