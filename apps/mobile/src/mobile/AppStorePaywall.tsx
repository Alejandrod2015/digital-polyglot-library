import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
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
 * Native paywall (Apple In-App Purchase via StoreKit 2, Google Play Billing on
 * Android, both through expo-iap). Replaces the non-compliant web Stripe
 * checkout inside the app. On a successful purchase it sends the store's proof
 * of purchase to the server, which verifies it and unlocks premium.
 *
 * The two stores model the plans differently, so the plan list is built per
 * platform and then rendered uniformly:
 *  - iOS: two separate products, `premium_monthly` and `premium_annual`
 *    (StoreKit has no "base plans" — each duration is its own product).
 *  - Android: one product, `premium_monthly`, with two base plans
 *    (`monthly`, `yearly`); each base plan carries its own offer token.
 * Either way the server verifies the purchase and both resolve to `premium`
 * (the Play productId is `premium_monthly` for both base plans).
 *
 * `purchase.purchaseToken` means a different thing per store: on iOS it is the
 * StoreKit 2 signed transaction (JWS); on Android it is the Play purchase
 * token. Each goes to its own verify route.
 */
const IOS_SKUS = ["premium_monthly", "premium_annual"];
// Android: a single subscription product exposing the base plans.
const ANDROID_PRODUCT_SKU = "premium_monthly";
const FETCH_SKUS = Platform.OS === "android" ? [ANDROID_PRODUCT_SKU] : IOS_SKUS;

const IOS_SKU_TITLES: Record<string, string> = {
  premium_monthly: "Monthly",
  premium_annual: "Yearly",
};

const TERMS_URL = "https://digitalpolyglot.com/terms";
const PRIVACY_URL = "https://digitalpolyglot.com/privacy";

// Both stores require the billing terms to name the account that gets charged
// and where to cancel, so this cannot be one shared string.
const BILLING_LEGAL_COPY =
  Platform.OS === "android"
    ? "Payment is charged to your Google Play account. Subscriptions renew automatically unless cancelled at least 24h before the period ends. Manage or cancel in your Google Play subscriptions."
    : "Payment is charged to your Apple ID. Subscriptions renew automatically unless cancelled at least 24h before the period ends. Manage or cancel in your App Store account settings.";

/** "Monthly" / "Yearly" / "Weekly", falling back to "Every N units". */
function periodLabel(unit: string | null | undefined, value: number | null | undefined): string | null {
  if (!unit || unit === "unknown") return null;
  if ((value ?? 1) === 1) {
    if (unit === "month") return "Monthly";
    if (unit === "year") return "Yearly";
    if (unit === "week") return "Weekly";
    if (unit === "day") return "Daily";
  }
  return `Every ${value} ${unit}s`;
}

type PlanOption = {
  key: string;
  title: string;
  price: string;
  buy: () => void;
};

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
      const token = purchase.purchaseToken;
      if (!token) {
        throw new Error("Missing proof of purchase from the store.");
      }
      const isAndroid = Platform.OS === "android";
      await apiFetch({
        baseUrl: apiBaseUrl,
        path: isAndroid
          ? "/api/mobile/billing/google-play/verify"
          : "/api/mobile/billing/app-store/verify",
        token: sessionToken,
        method: "POST",
        body: isAndroid ? { purchaseToken: token } : { signedTransactionInfo: token },
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
      void fetchProducts({ skus: FETCH_SKUS, type: "subs" });
    }
  }, [visible, connected, fetchProducts]);

  const startPurchase = useCallback(
    (run: () => void) => {
      setError(null);
      setBusy(true);
      try {
        run();
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message : "The purchase could not be started.");
      }
    },
    []
  );

  // Build the per-platform plan options into one uniform list for rendering.
  const options = useMemo<PlanOption[]>(() => {
    if (Platform.OS === "android") {
      const product = subscriptions.find((s) => s.id === ANDROID_PRODUCT_SKU);
      const offers = product?.platform === "android" ? product.subscriptionOffers ?? [] : [];
      const seen = new Set<string>();
      const out: PlanOption[] = [];
      for (const offer of offers) {
        const basePlanId = offer.basePlanIdAndroid;
        const offerToken = offer.offerTokenAndroid;
        // One entry per base plan; skip promo offers layered on the same plan.
        if (!basePlanId || !offerToken || seen.has(basePlanId)) continue;
        seen.add(basePlanId);
        out.push({
          key: offer.id,
          title: periodLabel(offer.period?.unit, offer.period?.value) ?? basePlanId,
          price: offer.displayPrice,
          buy: () =>
            startPurchase(() =>
              void requestPurchase({
                request: {
                  android: {
                    skus: [ANDROID_PRODUCT_SKU],
                    subscriptionOffers: [{ sku: ANDROID_PRODUCT_SKU, offerToken }],
                  },
                },
                type: "subs",
              })
            ),
        });
      }
      return out;
    }

    // iOS: keep the two products in the declared order.
    return IOS_SKUS.map((sku) => subscriptions.find((s) => s.id === sku))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((sub) => ({
        key: sub.id,
        title: IOS_SKU_TITLES[sub.id] ?? sub.title ?? sub.id,
        price: sub.displayPrice,
        buy: () => startPurchase(() => void requestPurchase({ request: { ios: { sku: sub.id } }, type: "subs" })),
      }));
  }, [subscriptions, requestPurchase, startPurchase]);

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

            {!connected || options.length === 0 ? (
              <View style={styles.loading}>
                <ActivityIndicator color="#f8c15c" />
                <Text style={styles.loadingText}>Loading plans…</Text>
              </View>
            ) : (
              options.map((opt) => (
                <Pressable
                  key={opt.key}
                  disabled={busy}
                  onPress={opt.buy}
                  style={[styles.planCard, busy ? styles.disabled : null]}
                >
                  <View style={styles.planText}>
                    <Text style={styles.planTitle}>{opt.title}</Text>
                    <Text style={styles.planPrice}>{opt.price}</Text>
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
              {BILLING_LEGAL_COPY}{" "}
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
