import { describe, it, expect, vi } from "vitest";
import { revertCoverageFailure } from "../_rerollSection";

// Reproduce el fallo real (2026-09-15, la-tournee-jamais-offerte, Friends FR
// B1): el rollback del candado de cobertura revertia solo audioUrl, dejando
// audioFragments con los startSec/endSec del empalme fallido (un master
// fantasma). El siguiente empalme cortaba en la ventana de silencio
// equivocada y arrastraba la cola del fragmento reemplazado, duplicando la
// ultima frase, aunque el candidato nuevo fuera limpio.
//
// Este test falla contra el codigo anterior a 25c8db60 (que solo revertia
// { audioUrl }) y pasa contra el actual (revierte los dos JUNTOS).
describe("revertCoverageFailure", () => {
  it("revierte audioUrl Y audioFragments juntos al estado previo", async () => {
    const update = vi.fn().mockResolvedValue({});
    const prismaLike = { journeyStory: { update } };

    const prevAudioUrl = "https://pub-xyz.r2.dev/media/old-master.mp3";
    const prevAudioFragments = [
      { index: 0, startSec: 0, endSec: 2.04, text: "titulo" },
      { index: 1, startSec: 2.04, endSec: 20.62, text: "parrafo 1" },
    ];

    await revertCoverageFailure(prismaLike, "story-123", prevAudioUrl, prevAudioFragments);

    expect(update).toHaveBeenCalledTimes(1);
    const call = update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "story-123" });
    // Las dos claves tienen que estar presentes Y coincidir con lo previo:
    // revertir solo audioUrl (el bug real) deja audioFragments AUSENTE del
    // payload, y Prisma no lo toca -> se queda con los boundaries del
    // intento fallido. Este assert es el que detecta esa regresion.
    expect(call.data.audioUrl).toBe(prevAudioUrl);
    expect(call.data.audioFragments).toEqual(prevAudioFragments);
    expect(Object.keys(call.data).sort()).toEqual(["audioFragments", "audioUrl"]);
  });

  it("revierte tambien cuando audioFragments previos son null (historia sin fragmentos)", async () => {
    const update = vi.fn().mockResolvedValue({});
    const prismaLike = { journeyStory: { update } };

    await revertCoverageFailure(prismaLike, "story-456", "https://pub-xyz.r2.dev/old.mp3", null);

    const call = update.mock.calls[0][0];
    expect(call.data.audioUrl).toBe("https://pub-xyz.r2.dev/old.mp3");
    expect(call.data.audioFragments).toBeNull();
  });
});
