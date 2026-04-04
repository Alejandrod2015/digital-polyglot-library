import * as Crypto from "expo-crypto";
import { Clerk } from "@clerk/clerk-js";
import { mobileConfig } from "../config";

let clerkInstance: Clerk | null = null;
let clerkLoadPromise: Promise<Clerk> | null = null;

function ensureClerkReactNativeEnvironment() {
  const baseUrl = new URL("/native-auth", mobileConfig.apiBaseUrl).toString();
  const parsedBaseUrl = new URL(baseUrl);
  const root = globalThis as typeof globalThis & {
    window?: Record<string, unknown>;
    document?: Record<string, unknown>;
    history?: Record<string, unknown>;
    location?: Location;
    navigator?: Record<string, unknown>;
    crypto?: Crypto;
    BroadcastChannel?: typeof BroadcastChannel;
  };
  const storage = new Map<string, string>();

  const storageApi = {
    get length() {
      return storage.size;
    },
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    removeItem: (key: string) => {
      storage.delete(key);
    },
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  };

  const crypto = {
    ...root.crypto,
    subtle: {
      digest: async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
        const rawAlgorithm =
          typeof algorithm === "string"
            ? algorithm
            : "name" in algorithm && typeof algorithm.name === "string"
              ? algorithm.name
              : "SHA-256";
        const normalizedAlgorithm = rawAlgorithm.toUpperCase() as Crypto.CryptoDigestAlgorithm;

        return Crypto.digest(
          normalizedAlgorithm,
          data
        );
      },
    },
    getRandomValues: root.crypto?.getRandomValues?.bind(root.crypto),
    randomUUID: root.crypto?.randomUUID?.bind(root.crypto),
  } as unknown as Crypto;

  const location = {
    href: parsedBaseUrl.toString(),
    origin: parsedBaseUrl.origin,
    protocol: parsedBaseUrl.protocol,
    host: parsedBaseUrl.host,
    hostname: parsedBaseUrl.hostname,
    port: parsedBaseUrl.port,
    pathname: parsedBaseUrl.pathname,
    search: parsedBaseUrl.search,
    hash: parsedBaseUrl.hash,
    assign: () => {},
    replace: () => {},
    reload: () => {},
    toString: () => parsedBaseUrl.toString(),
  } as unknown as Location;

  const history = {
    length: 1,
    state: null,
    back: () => {},
    forward: () => {},
    go: () => {},
    pushState: () => {},
    replaceState: () => {},
  };

  const navigator = {
    ...root.navigator,
    userAgent: root.navigator?.userAgent ?? "react-native",
    language: root.navigator?.language ?? "en-US",
  };

  const document = {
    ...root.document,
    visibilityState: "visible",
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
    head: {
      appendChild: () => {},
      removeChild: () => {},
    },
    addEventListener: () => {},
    createElement: () => ({
      setAttribute: () => {},
      getAttribute: () => null,
      removeAttribute: () => {},
      parentNode: { removeChild: () => {} },
      style: {},
    }),
    getElementsByTagName: () => [],
    querySelector: () => null,
    removeEventListener: () => {},
  };

  const windowObject = {
    ...(typeof root.window === "object" && root.window ? root.window : {}),
    location,
    history,
    navigator,
    document,
    crypto,
    localStorage: storageApi,
    sessionStorage: storageApi,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as Record<string, unknown>;

  windowObject.window = windowObject;
  windowObject.self = windowObject;
  windowObject.top = windowObject;

  root.location = location;
  root.history = history;
  root.navigator = navigator;
  root.document = document;
  root.crypto = crypto;
  root.window = windowObject;
}

export async function getHeadlessClerk(): Promise<Clerk> {
  if (clerkInstance) {
    return clerkInstance;
  }

  if (!mobileConfig.clerkPublishableKey) {
    throw new Error("Missing Clerk publishable key.");
  }

  if (!clerkLoadPromise) {
    clerkLoadPromise = (async () => {
      ensureClerkReactNativeEnvironment();
      const clerk = new Clerk(mobileConfig.clerkPublishableKey);
      await clerk.load();
      clerkInstance = clerk;
      return clerk;
    })();
  }

  return clerkLoadPromise;
}
