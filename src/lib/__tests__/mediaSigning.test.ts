import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * El firmador lee la configuracion de process.env en cada llamada, asi que
 * cada bloque monta su entorno y lo deshace. Importamos con `await import`
 * despues de tocar el entorno para no depender del orden de los modulos.
 */
const ENV_BASE = {
  MEDIA_STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  MEDIA_STORAGE_BUCKET: "dpl-media",
  MEDIA_STORAGE_ACCESS_KEY_ID: "AKIAEJEMPLO",
  MEDIA_STORAGE_SECRET_ACCESS_KEY: "secreto-de-prueba",
  MEDIA_STORAGE_PUBLIC_BASE_URL: "https://pub-ejemplo.r2.dev",
  MEDIA_STORAGE_REGION: "auto",
  MEDIA_PRIVATE_BUCKET: "dpl-media-private",
};

const PUBLIC_MP3 = "https://pub-ejemplo.r2.dev/media/generated/audio/historia_123.mp3";

let guardadas: Record<string, string | undefined> = {};

function ponerEntorno(extra: Record<string, string>) {
  for (const [k, v] of Object.entries({ ...ENV_BASE, ...extra })) {
    guardadas[k] = process.env[k];
    process.env[k] = v;
  }
}

beforeEach(() => {
  guardadas = {};
});

afterEach(() => {
  for (const [k, v] of Object.entries(guardadas)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  guardadas = {};
});

async function cargar() {
  return import("@/lib/mediaSigning");
}

describe("extractAudioKey", () => {
  beforeEach(() => ponerEntorno({ MEDIA_SIGNED_AUDIO: "1" }));

  it("saca la key de una URL absoluta del bucket publico", async () => {
    const { extractAudioKey } = await cargar();
    expect(extractAudioKey(PUBLIC_MP3)).toBe("media/generated/audio/historia_123.mp3");
  });

  it("saca la key de una ruta relativa", async () => {
    const { extractAudioKey } = await cargar();
    expect(extractAudioKey("/media/catalog/audio/venecia-01.mp3")).toBe(
      "media/catalog/audio/venecia-01.mp3"
    );
  });

  it("decodifica el porcentaje del path", async () => {
    const { extractAudioKey } = await cargar();
    expect(extractAudioKey("https://pub-ejemplo.r2.dev/media/catalog/audio/un%20titulo.mp3")).toBe(
      "media/catalog/audio/un titulo.mp3"
    );
  });

  it("ignora una URL ajena", async () => {
    const { extractAudioKey } = await cargar();
    expect(extractAudioKey("https://cdn.sanity.io/files/x/y/z.mp3")).toBeNull();
    expect(extractAudioKey("https://modal.example.com/tmp/out.mp3")).toBeNull();
  });

  it("ignora un prefijo que no es de audio", async () => {
    const { extractAudioKey } = await cargar();
    expect(extractAudioKey("https://pub-ejemplo.r2.dev/media/catalog/images/tapa.jpg")).toBeNull();
  });

  it("reconoce el mp3 de una historia de CreateStory o standalone", async () => {
    const { extractAudioKey } = await cargar();
    expect(extractAudioKey("https://pub-ejemplo.r2.dev/media/polyglot/mi-historia/audio.mp3")).toBe(
      "media/polyglot/mi-historia/audio.mp3"
    );
    expect(extractAudioKey("https://pub-ejemplo.r2.dev/media/standalone/el-asado/audio.mp3")).toBe(
      "media/standalone/el-asado/audio.mp3"
    );
  });

  it("NO toca la portada que vive junto a ese mp3", async () => {
    const { extractAudioKey } = await cargar();
    expect(extractAudioKey("https://pub-ejemplo.r2.dev/media/polyglot/mi-historia/cover.png")).toBeNull();
    expect(extractAudioKey("https://pub-ejemplo.r2.dev/media/standalone/el-asado/cover.jpg")).toBeNull();
  });

  it("reconoce subidas del Studio y la cache de segmentos multivoz", async () => {
    const { extractAudioKey } = await cargar();
    expect(extractAudioKey("https://pub-ejemplo.r2.dev/media/uploads/audio/take-9.mp3")).toBe(
      "media/uploads/audio/take-9.mp3"
    );
    expect(extractAudioKey("https://pub-ejemplo.r2.dev/media/multivoice-segments/abc123.mp3")).toBe(
      "media/multivoice-segments/abc123.mp3"
    );
  });

  it("ignora vacio y nulo", async () => {
    const { extractAudioKey } = await cargar();
    expect(extractAudioKey(null)).toBeNull();
    expect(extractAudioKey("")).toBeNull();
    expect(extractAudioKey("   ")).toBeNull();
  });
});

describe("signAudioUrl con el flag apagado", () => {
  beforeEach(() => ponerEntorno({ MEDIA_SIGNED_AUDIO: "0" }));

  it("devuelve la misma URL, sin firma", async () => {
    const { signAudioUrl } = await cargar();
    expect(signAudioUrl(PUBLIC_MP3)).toBe(PUBLIC_MP3);
  });

  it("no toca los fragmentos", async () => {
    const { signAudioFragments } = await cargar();
    const fragments = [{ index: 0, url: PUBLIC_MP3, text: "hola" }];
    expect(signAudioFragments(fragments)).toBe(fragments);
  });
});

describe("signAudioUrl con el flag encendido", () => {
  beforeEach(() => ponerEntorno({ MEDIA_SIGNED_AUDIO: "1" }));

  it("firma contra el bucket privado y conserva la key", async () => {
    const { signAudioUrl } = await cargar();
    const firmada = signAudioUrl(PUBLIC_MP3);
    expect(firmada).toBeTruthy();
    const url = new URL(firmada!);
    expect(url.pathname).toBe("/dpl-media-private/media/generated/audio/historia_123.mp3");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
  });

  it("caduca a las 24 horas", async () => {
    const { signAudioUrl, SIGNED_AUDIO_TTL_SECONDS } = await cargar();
    const url = new URL(signAudioUrl(PUBLIC_MP3)!);
    expect(SIGNED_AUDIO_TTL_SECONDS).toBe(86400);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("86400");
  });

  it("deja pasar lo que no es audio nuestro", async () => {
    const { signAudioUrl } = await cargar();
    const ajena = "https://cdn.sanity.io/files/x/y/z.mp3";
    expect(signAudioUrl(ajena)).toBe(ajena);
  });

  it("no deja rastro del host publico en la URL firmada", async () => {
    const { signAudioUrl } = await cargar();
    expect(signAudioUrl(PUBLIC_MP3)).not.toContain("pub-ejemplo.r2.dev");
  });

  it("firma url y prevUrl de cada fragmento y respeta el resto", async () => {
    const { signAudioFragments } = await cargar();
    const fragments = [
      { index: 0, speaker: "Ana", url: PUBLIC_MP3, prevUrl: PUBLIC_MP3, text: "hola" },
      { index: 1, speaker: "Luis", url: null, text: "adios" },
    ];
    const firmados = signAudioFragments(fragments) as Array<Record<string, unknown>>;
    expect(String(firmados[0].url)).toContain("X-Amz-Signature");
    expect(String(firmados[0].prevUrl)).toContain("X-Amz-Signature");
    expect(firmados[0].speaker).toBe("Ana");
    expect(firmados[0].text).toBe("hola");
    expect(firmados[1].url).toBeNull();
  });

  it("firma en profundidad las URLs de un payload de practica", async () => {
    const { signAudioUrlsDeep } = await cargar();
    const payload = {
      items: [
        { word: "casi", audioClip: { clipUrl: PUBLIC_MP3, cachedUrl: null }, wordClipUrl: PUBLIC_MP3 },
      ],
      coverUrl: "https://pub-ejemplo.r2.dev/media/catalog/images/tapa.jpg",
    };
    const firmado = signAudioUrlsDeep(payload);
    expect(firmado.items[0].audioClip.clipUrl).toContain("X-Amz-Signature");
    expect(firmado.items[0].wordClipUrl).toContain("X-Amz-Signature");
    // Las portadas siguen publicas a proposito.
    expect(firmado.coverUrl).toBe(payload.coverUrl);
  });

  it("firma el nombre suelto de un audio de catalogo", async () => {
    const { signCatalogAudioUrl } = await cargar();
    const firmada = signCatalogAudioUrl("venecia-01");
    expect(new URL(firmada!).pathname).toBe("/dpl-media-private/media/catalog/audio/venecia-01.mp3");
  });
});

describe("signAudioUrl sin bucket privado configurado", () => {
  beforeEach(() => ponerEntorno({ MEDIA_SIGNED_AUDIO: "1", MEDIA_PRIVATE_BUCKET: "" }));

  it("firma contra el bucket publico y no rompe la reproduccion", async () => {
    const { signAudioUrl } = await cargar();
    const firmada = signAudioUrl(PUBLIC_MP3);
    expect(new URL(firmada!).pathname).toBe("/dpl-media/media/generated/audio/historia_123.mp3");
  });
});
