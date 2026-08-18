/**
 * Permite HTTP sin cifrar SOLO cuando la app se compila apuntando a un
 * servidor local, y solo hacia 127.0.0.1.
 *
 * WHY (2026-08-18): para probar en el teléfono un endpoint que todavía no
 * está desplegado hay que apuntar la app a la Mac por `adb reverse`, que es
 * `http://127.0.0.1:3000`. Android bloquea el HTTP sin cifrar en release, así
 * que la única forma de probarlo era compilar en debug y levantar Metro. Eso
 * es una cadena de dos servidores para ver una tarjeta. Con esto la release,
 * que es autónoma y ya lleva el JS dentro, sirve igual.
 *
 * El permiso NO es general: se activa solo si el build declara una
 * EXPO_PUBLIC_API_BASE_URL que empieza por `http://`, y aun entonces
 * autoriza únicamente el loopback. Un build de producción no lo activa.
 */
const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function allowLocalCleartext(config) {
  const base = (process.env.EXPO_PUBLIC_API_BASE_URL || "").trim();
  const device = (process.env.EXPO_PUBLIC_DEVICE_API_BASE_URL || "").trim();
  const apuntaALocal = [base, device].some((u) => u.startsWith("http://"));
  if (!apuntaALocal) return config;

  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$["android:usesCleartextTraffic"] = "true";
    return cfg;
  });
};
