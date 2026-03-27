import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiFetch } from "../lib/api";

export type PushRegistrationState =
  | { status: "idle" }
  | { status: "unsupported"; message: string }
  | { status: "denied"; message: string }
  | { status: "registered"; tokenPreview: string }
  | { status: "error"; message: string };

function getNotificationsModule():
  | typeof import("expo-notifications")
  | null {
  try {
    return require("expo-notifications") as typeof import("expo-notifications");
  } catch {
    return null;
  }
}

function getDeviceModule():
  | typeof import("expo-device")
  | null {
  try {
    return require("expo-device") as typeof import("expo-device");
  } catch {
    return null;
  }
}

function getDeviceLabel(): string {
  const Device = getDeviceModule();
  return (
    Device?.deviceName?.trim() ||
    Constants.deviceName?.trim() ||
    `${Platform.OS}-device`
  );
}

export async function registerPushNotifications(args: {
  baseUrl: string;
  sessionToken: string;
}): Promise<PushRegistrationState> {
  const { baseUrl, sessionToken } = args;
  const Notifications = getNotificationsModule();
  const Device = getDeviceModule();

  if (!Notifications) {
    return {
      status: "unsupported",
      message: "Push notifications will be enabled after the next native rebuild.",
    };
  }

  if (!Device?.isDevice) {
    return {
      status: "unsupported",
      message: "Push notifications will be available on a physical iPhone.",
    };
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== "granted") {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== "granted") {
    return {
      status: "denied",
      message: "Notification permission is off for this device.",
    };
  }

  try {
    const nativeToken = await Notifications.getDevicePushTokenAsync();
    const token = typeof nativeToken.data === "string" ? nativeToken.data.trim() : "";

    if (!token) {
      return {
        status: "error",
        message: "The device did not return a push token.",
      };
    }

    await apiFetch<{ ok: true }>({
      baseUrl,
      path: "/api/mobile/push-token",
      token: sessionToken,
      method: "POST",
      body: {
        provider: Platform.OS === "ios" ? "apns" : "native",
        token,
        platform: Platform.OS,
        deviceName: getDeviceLabel(),
      },
    });

    const tokenPreview =
      token.length > 12 ? `${token.slice(0, 6)}...${token.slice(-6)}` : token;

    return {
      status: "registered",
      tokenPreview,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to register notifications.",
    };
  }
}
