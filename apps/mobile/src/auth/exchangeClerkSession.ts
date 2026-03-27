import { mobileConfig } from "../config";

type ExchangeResponse = {
  token: string;
};

export async function exchangeClerkSessionForMobileToken(
  clerkSessionToken: string
): Promise<string> {
  const response = await fetch(new URL("/api/mobile/session", mobileConfig.apiBaseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clerkSessionToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Mobile session exchange failed (${response.status}).`);
  }

  const json = (await response.json()) as Partial<ExchangeResponse>;
  const token = typeof json.token === "string" ? json.token.trim() : "";
  if (!token) {
    throw new Error("Mobile session exchange completed without a token.");
  }

  return token;
}
