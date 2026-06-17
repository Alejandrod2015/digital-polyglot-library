// ffprobe-static ships no type declarations. It does `module.exports = { path, version }`.
declare module "ffprobe-static" {
  const ffprobeStatic: { path: string; version: string };
  export = ffprobeStatic;
}
