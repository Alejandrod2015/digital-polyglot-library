import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useIAP } from "expo-iap";
import type { Purchase } from "expo-iap";
import { apiFetch } from "../lib/api";

/**
 * Native iOS paywall (Apple In-App Purchase via StoreKit 2 / expo-iap).
 * Replaces the non-compliant web Stripe checkout inside the app. On a
 * successful purchase it sends the StoreKit 2 signed transaction
 * (`purchase.purchaseToken`, which on iOS is the JWS) to the server, which
 * verifies it and unlocks premium.
 *
 * SKUs must match the auto-renewable subscription product IDs created in App
 * Store Connect (and the server's APP_STORE_PRODUCT_PLAN_MAP).
 */
const PREMIUM_SKUS = ["premium_monthly", "premium_annual"];

const TERMS_URL = "https://digitalpolyglot.com/terms";
const PRIVACY_URL = "https://digitalpolyglot.com/privacy";

type Props = {
  visible: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  sessionToken: string | null | undefined;
  /** Called after the server confirms the purchase, so the shell can refresh entitlement. */
  onPurchased: () => void;
};

export function AppStorePaywall({ visible, onClose, apiBaseUrl, sessionToken, onPurchased }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyOnServer = useCallback(
    async (purchase: Purchase) => {
      const signedTransactionInfo = purchase.purchaseToken;
      if (!signedTransactionInfo) {
        throw new Error("Missing signed transaction from the App Store.");
      }
      await apiFetch({
        baseUrl: apiBaseUrl,
        path: "/api/mobile/billing/app-store/verify",
        token: sessionToken,
        method: "POST",
        body: { signedTransactionInfo },
      });
    },
    [apiBaseUrl, sessionToken]
  );

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    restorePurchases,
  } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void (async () => {
        try {
          await verifyOnServer(purchase);
          await finishTransaction({ purchase, isConsumable: false });
          onPurchased();
          onClose();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not confirm the purchase.");
        } finally {
          setBusy(false);
        }
      })();
    },
    onPurchaseError: (e) => {
      setBusy(false);
      // User cancellation is not an error worth surfacing.
      if (!/cancel/i.test(e?.message ?? "")) {
        setError(e?.message ?? "The purchase could not be completed.");
      }
    },
  });

  // Load the subscription products once the store connection is ready.
  useEffect(() => {
    if (visible && connected) {
      void fetchProducts({ skus: PREMIUM_SKUS, type: "subs" });
    }
  }, [visible, connected, fetchProducts]);

  const buy = useCallback(
    (sku: string) => {
      setError(null);
      setBusy(true);
      try {
        void requestPurchase({ request: { ios: { sku } }, type: "subs" });
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message : "The purchase could not be started.");
      }
    },
    [requestPurchase]
  );

  const restore = useCallback(() => {
    setError(null);
    setBusy(true);
    void (async () => {
      try {
        await restorePurchases();
        onPurchased();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not restore purchases.");
      } finally {
        setBusy(false);
      }
    })();
  }, [restorePurchases, onPurchased]);

  const ordered = PREMIUM_SKUS.map((sku) => subscriptions.find((s) => s.id === sku)).filter(
    (s): s is NonNullable<typeof s> => Boolean(s)
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Go Premium</Text>
            <Text style={styles.subtitle}>
              Unlock every story, offline access, full practice and your saved words.
            </Text>

            {!connected || ordered.length === 0 ? (
              <View style={styles.loading}>
                <ActivityIndicator color="#f8c15c" />
                <Text style={styles.loadingText}>Loading plans…</Text>
              </View>
            ) : (
              ordered.map((sub) => (
                <Pressable
                  key={sub.id}
                  disabled={busy}
                  onPress={() => buy(sub.id)}
                  style={[styles.planCard, busy ? styles.disabled : null]}
                >
                  <View style={styles.planText}>
                    <Text style={styles.planTitle}>{sub.title || sub.displayName || sub.id}</Text>
                    <Text style={styles.planPrice}>{sub.displayPrice}</Text>
                  </View>
                  <Text style={styles.planCta}>{busy ? "…" : "Choose"}</Text>
                </Pressable>
              ))
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable onPress={restore} disabled={busy} style={styles.restore}>
              <Text style={styles.restoreText}>Restore purchases</Text>
            </Pressable>

            <Text style={styles.legal}>
              Payment is charged to your Apple ID. Subscriptions renew automatically unless cancelled
              at least 24h before the period ends. Manage or cancel in your App Store account
              settings.{" "}
              <Text style={styles.link} onPress={() => void Linking.openURL(TERMS_URL)}>
                Terms
              </Text>{" "}
              ·{" "}
              <Text style={styles.link} onPress={() => void Linking.openURL(PRIVACY_URL)}>
                Privacy
              </Text>
            </Text>

            <Pressable onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>Not now</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0e1626",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginTop: 10,
  },
  content: { padding: 22, gap: 14 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 6 },
  subtitle: { color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 20 },
  loading: { alignItems: "center", gap: 10, paddingVertical: 28 },
  loadingText: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(248,193,92,0.4)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  disabled: { opacity: 0.5 },
  planText: { gap: 2 },
  planTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  planPrice: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  planCta: { color: "#f8c15c", fontSize: 15, fontWeight: "800" },
  error: { color: "#fca5a5", fontSize: 13 },
  restore: { alignItems: "center", paddingVertical: 8 },
  restoreText: { color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: "600" },
  legal: { color: "rgba(255,255,255,0.4)", fontSize: 11, lineHeight: 16 },
  link: { color: "rgba(255,255,255,0.7)", textDecorationLine: "underline" },
  close: { alignItems: "center", paddingVertical: 12 },
  closeText: { color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: "600" },
});
