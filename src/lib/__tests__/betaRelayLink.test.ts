import { beforeEach, describe, expect, it, vi } from "vitest";

// El fallo que origino esta regla (2026-09-19): dos testers que Apple daba
// por INSTALLED leian historias con un correo de relay de Apple, y el panel
// los contaba como "no ha entrado". El enlace por correo no podia resolverlos.

const db = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
}));
const asc = vi.hoisted(() => ({ states: new Map<string, { state: string; group: string; isInternal: boolean }>() }));

vi.mock("@/lib/prisma", () => ({ prisma: { betaSignup: db } }));
vi.mock("@/lib/appStoreConnect", () => ({
  listGroupTesterStates: async () => asc.states,
  inviteTesterToBetaGroup: vi.fn(),
  removeTester: vi.fn(),
  isAscConfigured: () => false,
  getTesterState: vi.fn(),
  getTesterEmail: vi.fn(),
  sendTesterInvitation: vi.fn(),
}));
vi.mock("@clerk/backend", () => ({
  createClerkClient: () => ({
    users: {
      getUser: async () => ({ publicMetadata: {} }),
      updateUserMetadata: async () => undefined,
    },
  }),
}));

import { reconcileBetaTesterLinkByInstall } from "@/lib/betaProgram";

const orphan = (id: string, firstName: string, ascTesterId: string) => ({
  id,
  email: `${id}@example.org`,
  firstName,
  ascTesterId,
});

beforeEach(() => {
  db.findFirst.mockReset().mockResolvedValue(null);
  db.findMany.mockReset();
  db.update.mockReset().mockResolvedValue({});
  asc.states.clear();
});

describe("reconcileBetaTesterLinkByInstall", () => {
  it("enlaza cuando hay un solo INSTALLED con ese nombre de pila", async () => {
    db.findMany.mockResolvedValue([orphan("s1", "Steven", "asc_1"), orphan("s2", "Irina", "asc_2")]);
    asc.states.set("asc_1", { state: "INSTALLED", group: "External", isInternal: false });
    asc.states.set("asc_2", { state: "INSTALLED", group: "External", isInternal: false });

    const ok = await reconcileBetaTesterLinkByInstall({
      userId: "user_relay",
      email: "abc@privaterelay.appleid.com",
      firstName: "Steven Schultz",
    });

    expect(ok).toBe(true);
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: expect.objectContaining({ clerkUserId: "user_relay", status: "accepted" }),
      }),
    );
  });

  it("no adivina entre dos Franks INSTALLED", async () => {
    db.findMany.mockResolvedValue([orphan("f1", "Frank", "asc_1"), orphan("f2", "Frank", "asc_2")]);
    asc.states.set("asc_1", { state: "INSTALLED", group: "External", isInternal: false });
    asc.states.set("asc_2", { state: "INSTALLED", group: "External", isInternal: false });

    const ok = await reconcileBetaTesterLinkByInstall({ userId: "u", email: null, firstName: "Frank" });

    expect(ok).toBe(false);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("descarta al Frank que Apple tiene solo en INVITED", async () => {
    db.findMany.mockResolvedValue([orphan("f1", "Frank", "asc_1"), orphan("f2", "Frank", "asc_2")]);
    asc.states.set("asc_1", { state: "INVITED", group: "External", isInternal: false });
    asc.states.set("asc_2", { state: "INSTALLED", group: "External", isInternal: false });

    const ok = await reconcileBetaTesterLinkByInstall({ userId: "u", email: null, firstName: "frank" });

    expect(ok).toBe(true);
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "f2" } }));
  });

  it("no toca nada si Apple no responde o el usuario ya esta enlazado", async () => {
    db.findMany.mockResolvedValue([orphan("s1", "Steven", "asc_1")]);
    expect(await reconcileBetaTesterLinkByInstall({ userId: "u", email: null, firstName: "Steven" })).toBe(false);

    db.findFirst.mockResolvedValue({ id: "already" });
    asc.states.set("asc_1", { state: "INSTALLED", group: "External", isInternal: false });
    expect(await reconcileBetaTesterLinkByInstall({ userId: "u", email: null, firstName: "Steven" })).toBe(false);
    expect(db.update).not.toHaveBeenCalled();
  });
});
