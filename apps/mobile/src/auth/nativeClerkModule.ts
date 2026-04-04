import { Platform, TurboModuleRegistry, type TurboModule } from "react-native";

type NativeAuthMode = "signIn" | "signUp" | "signInOrUp";

type NativeAuthResult = {
  cancelled?: boolean;
  sessionId?: string | null;
  type?: "signIn" | "signUp" | null;
};

interface ClerkExpoSpec extends TurboModule {
  configure(publishableKey: string, bearerToken: string | null): Promise<void>;
  presentAuth(options: {
    mode?: NativeAuthMode;
    dismissable?: boolean;
  }): Promise<NativeAuthResult | null>;
  getSession(): Promise<Record<string, unknown> | null>;
  getClientToken(): Promise<string | null>;
  getSessionToken?: () => Promise<string | null>;
  signOut(): Promise<void>;
}

export const NativeClerkModule =
  Platform.OS === "ios" || Platform.OS === "android"
    ? TurboModuleRegistry.get<ClerkExpoSpec>("ClerkExpo")
    : null;

export type { NativeAuthMode, NativeAuthResult };
