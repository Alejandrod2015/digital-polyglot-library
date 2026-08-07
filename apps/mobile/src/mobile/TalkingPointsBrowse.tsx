/**
 * Índice de Talking Points. NAVEGACIÓN, no recorrido.
 *
 * A diferencia de un journey, aquí no hay orden ni progreso: se entra por donde
 * a uno le interese. Por eso son filas horizontales por categoría, sin números
 * de paso, sin "continuar donde lo dejaste" y sin bloqueos entre piezas. La
 * única jerarquía es el interés.
 *
 * Las piezas sin cuerpo escrito se muestran atenuadas y no abren: el catálogo
 * las declara con `body: []`, y enseñar una pantalla vacía es peor que decir
 * que todavía no está.
 */
import { memo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { TalkingCategoryRow, TalkingIndexEntry } from "../lib/talkingPoints";

const ANGLE_LABEL: Record<string, string> = {
  explainer: "Explainer",
  debate: "Debate",
  portrait: "Portrait",
};

function flagEmoji(country: string): string {
  if (!country || country.length !== 2) return "";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (country.toUpperCase().charCodeAt(0) - 65),
    base + (country.toUpperCase().charCodeAt(1) - 65)
  );
}

const PieceCard = memo(function PieceCard({
  entry,
  onOpen,
}: {
  entry: TalkingIndexEntry;
  onOpen: (slug: string) => void;
}) {
  const disabled = !entry.written;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => onOpen(entry.slug)}
      accessibilityRole="button"
      accessibilityLabel={entry.title}
      style={({ pressed }) => [
        styles.card,
        disabled ? styles.cardDisabled : null,
        pressed && !disabled ? styles.cardPressed : null,
      ]}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.cardFlag}>{flagEmoji(entry.country)}</Text>
        <Text style={styles.cardAngle}>{ANGLE_LABEL[entry.angle] ?? entry.angle}</Text>
        {entry.hasAudio ? (
          <Feather name="headphones" size={12} color="rgba(255,255,255,0.45)" />
        ) : null}
      </View>
      <Text style={styles.cardTitle} numberOfLines={3}>
        {entry.title}
      </Text>
      <Text style={styles.cardHook} numberOfLines={3}>
        {entry.hook}
      </Text>
      <Text style={styles.cardTopic} numberOfLines={1}>
        {entry.topicLabel}
      </Text>
      {disabled ? <Text style={styles.cardSoon}>Not written yet</Text> : null}
    </Pressable>
  );
});

export function TalkingPointsBrowse({
  categories,
  loading,
  error,
  planLocked,
  onOpenPiece,
  onRetry,
}: {
  categories: TalkingCategoryRow[];
  loading: boolean;
  error: string | null;
  planLocked: boolean;
  onOpenPiece: (slug: string) => void;
  onRetry: () => void;
}) {
  if (planLocked) {
    return (
      <View style={styles.stateBox}>
        <Feather name="lock" size={22} color="rgba(255,255,255,0.5)" />
        <Text style={styles.stateTitle}>Part of the Polyglot plan</Text>
        <Text style={styles.stateBody}>
          Talking Points are long-form pieces about how things actually work, with
          narration, word lookup and their sources.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color="#9fe8ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>Couldn&apos;t load Talking Points</Text>
        <Text style={styles.stateBody}>{error}</Text>
        <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (categories.length === 0) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>Nothing here yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {categories.map((row) => (
        <View key={row.id} style={styles.row}>
          <Text style={styles.rowLabel}>{row.label}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rowScroll}
          >
            {row.entries.map((entry) => (
              <PieceCard key={entry.slug} entry={entry} onOpen={onOpenPiece} />
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: 24 },
  row: { marginBottom: 22 },
  rowLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  rowScroll: { paddingHorizontal: 16, gap: 10 },
  card: {
    width: 216,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(97,146,201,0.26)",
    backgroundColor: "rgba(19,54,107,0.75)",
    padding: 14,
  },
  cardDisabled: { opacity: 0.45 },
  cardPressed: { backgroundColor: "rgba(19,54,107,0.95)" },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  cardFlag: { fontSize: 14 },
  cardAngle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    flex: 1,
  },
  cardTitle: { color: "#f5f7fb", fontSize: 15, fontWeight: "800", marginBottom: 6 },
  cardHook: { color: "rgba(226,232,244,0.72)", fontSize: 12.5, lineHeight: 17 },
  cardTopic: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 11,
    marginTop: 10,
  },
  cardSoon: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },
  stateBox: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  stateTitle: { color: "#f5f7fb", fontSize: 16, fontWeight: "800", textAlign: "center" },
  stateBody: {
    color: "rgba(226,232,244,0.7)",
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
  },
  retry: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  retryText: { color: "#f5f7fb", fontSize: 13, fontWeight: "700" },
});
