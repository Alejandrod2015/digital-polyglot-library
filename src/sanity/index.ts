import { createClient } from "next-sanity";
import { projectId, dataset, apiVersion } from "./env";

// 🔹 Cliente de lectura (seguro para frontend)
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
});

// 🔹 Cliente de escritura (solo backend)
export const sanityWriteClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false, // ❗ no usar CDN al escribir
  token: process.env.SANITY_WRITE_TOKEN, // ❗ requiere permisos de "create" y "write"
});
