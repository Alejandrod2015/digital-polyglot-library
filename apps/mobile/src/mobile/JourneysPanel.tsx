import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LanguageFlag } from "./LanguageFlag";
import {
  type Journey,
  cefrFromCoarseLevel,
  existingJourneyKeys,
  focusIcon,
  focusShortLabel,
  journeyDisplayName,
  journeyFlagVariant,
  journeyIcon,
  journeyId,
} from "./journeys";
import type { JourneyFocus } from "../../../../src/lib/onboarding";
import { bg as tokenBg, color as tokenColor } from "../theme/tokens";

/** A Studio Journey track exposed by the mobile journey API. Each
 *  Journey record in Studio is one option in the Step 2 picker. */
export type JourneysPanelTrack = {
  id: string;
  label: string;
};

/** Default focus assigned when the user creates a journey from this
 *  panel. The journey is uniquely identified by (language, track.id),
 *  so the focus field only exists to satisfy the legacy schema and is
 *  no longer user-facing. Phase-2 cleanup will drop the field. */
const DEFAULT_NEW_JOURNEY_FOCUS: JourneyFocus = "General";

/**
 * Full-screen "Your journeys" panel. Slides up from the bottom (mirror
 * of the sheet pattern but covers the whole viewport) and houses three
 * states:
 *
 *   1. List — every journey rendered as a card; tapping makes one
 *      active and closes. The active journey is pinned on top.
 *   2. Pick language (sub-state of "create") — 9-language grid, with
 *      English split into US / UK rows. Combinations that already
 *      exist for the chosen focus are disabled and labeled.
 *   3. Pick focus (sub-state of "create") — 4 cards (Travelers,
 *      Business, Culture, Everyday), then a `Start journey` CTA.
 *
 * Empty case: when the user has 0 journeys (rare — typically only
 * post-onboarding before the first commit) we skip the list and land
 * straight on the create flow with welcome copy.
 */

type LanguageOption = {
  /** Used as map key for selection state — for English this carries
   *  the variant: "English|us" / "English|uk". */
  key: string;
  /** Canonical name persisted to journey.language. */
  name: string;
  /** lower-case variant code (us/uk) when the language has multiple
   *  flags, otherwise null. */
  variant: string | null;
  /** Pretty label rendered as a pill ("US", "UK", "LATAM", "BRAZIL"). */
  variantLabel: string | null;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  // Spanish: two entries — Spain flag (ES) and Colombia flag (LATAM).
  // Mexico's flag was visually indistinguishable from Italy, so we
  // use Colombia (yellow-blue-red 2:1:1) as the LATAM signal.
  { key: "Spanish|es", name: "Spanish", variant: "es", variantLabel: "SPAIN" },
  { key: "Spanish|latam", name: "Spanish", variant: "latam", variantLabel: "LATAM" },
  { key: "French", name: "French", variant: null, variantLabel: null },
  { key: "German", name: "German", variant: null, variantLabel: null },
  { key: "Italian", name: "Italian", variant: null, variantLabel: null },
  // Two Portuguese rows — different flags + variant codes "br"/"pt"
  // so the LanguageFlag picks the right rendering and the journey
  // is keyed correctly (a Portugal-Travelers journey is distinct
  // from a Brazil-Travelers journey).
  { key: "Portuguese|br", name: "Portuguese", variant: "br", variantLabel: "BRAZIL" },
  { key: "Portuguese|pt", name: "Portuguese", variant: "pt", variantLabel: "PORTUGAL" },
  { key: "Japanese", name: "Japanese", variant: null, variantLabel: null },
  { key: "Korean", name: "Korean", variant: null, variantLabel: null },
  { key: "Chinese", name: "Chinese", variant: null, variantLabel: null },
  { key: "English|us", name: "English", variant: "us", variantLabel: "US" },
  { key: "English|uk", name: "English", variant: "uk", variantLabel: "UK" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** All journeys, ordered as they should appear (active first). */
  journeys: Journey[];
  activeJourneyId: string | null;
  /** Mock or real per-journey-language stats. The panel doesn't
   *  compute them; the shell hands them in keyed by language. */
  statsByLanguage: Record<string, { streak: number; xpTotal: number; progress: number }>;
  /** Languages flagged as Próximamente in Studio Planning — they show up but
   *  can't be picked yet. Hydrated by the shell from /api/mobile/languages. */
  comingSoonLanguages?: ReadonlySet<string>;
  /** Activate an existing journey by id and close the panel. */
  onSelect: (id: string) => void | Promise<void>;
  /** Create a new journey (language + variant + focus). The shell is
   *  responsible for de-duping and persistence. `label` carries the
   *  picked Studio Journey.name so the chrome can render it instead
   *  of the generic focus shortlabel. */
  onCreate: (input: {
    language: string;
    variant: string | null;
    /** Código regional ("latam"/"spain"/"us"/"uk"/"br"/"pt"…) usado
     *  para la bandera. Distinto del `variant` (que bajo el modelo
     *  nuevo guarda el cuid del Studio Journey track). */
    region: string | null;
    focus: JourneyFocus;
    label?: string | null;
  }) => void | Promise<void>;
  /** Remove a journey by id. The shell decides what to do with the
   *  active journey if the deleted one was active (typically it
   *  promotes the next journey in the list). The panel only fires
   *  the request after the user confirms via Alert. */
  onDelete: (id: string) => void | Promise<void>;
  /** Fetch the Studio Journey tracks for a language. Used to populate
   *  Step 2 of the create flow with real journeys instead of the old
   *  4 hardcoded focus categories. The shell typically wraps the
   *  /api/mobile/journey endpoint. Should never throw — return an
   *  empty array on failure. */
  getTracksForLanguage: (language: string) => Promise<JourneysPanelTrack[]>;
  /** Synchronous cache hit for `getTracksForLanguage`. Returns the
   *  cached tracks if the shell already has them in memory, or null
   *  if a network fetch would be required. The panel uses this to
   *  skip the "Loading..." flicker when the data is already there. */
  getTracksForLanguageSync?: (language: string) => JourneysPanelTrack[] | null;
};

export function JourneysPanel({
  open,
  onClose,
  journeys,
  activeJourneyId,
  statsByLanguage,
  comingSoonLanguages,
  onSelect,
  onCreate,
  onDelete,
  getTracksForLanguage,
  getTracksForLanguageSync,
}: Props) {
  // Slide-up sheet animation, same pattern as LanguageSwitchSheet but
  // covering the whole screen height. We keep the tree alive during
  // the exit animation so the slide-out has time to play.
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(PANEL_TRAVEL)).current;
  const [mounted, setMounted] = useState(open);
  // "list" → browse + activate.
  // "pick-language" → step 1 of create flow.
  // "pick-focus"    → step 2 of create flow (now picks a Studio
  //                   Journey track, not one of 4 hardcoded focuses).
  type Mode = "list" | "pick-language" | "pick-focus";
  const [mode, setMode] = useState<Mode>("list");
  const [pickedLanguage, setPickedLanguage] = useState<LanguageOption | null>(null);
  const [pickedTrackId, setPickedTrackId] = useState<string | null>(null);
  const [availableTracks, setAvailableTracks] = useState<JourneysPanelTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // When the panel opens with zero journeys, drop the user straight
  // into the create flow — the list view would be empty otherwise.
  useEffect(() => {
    if (open) {
      if (journeys.length === 0) {
        setMode("pick-language");
      } else {
        setMode("list");
      }
      setPickedLanguage(null);
      setPickedTrackId(null);
      setAvailableTracks([]);
      setTracksLoading(false);
    }
  }, [open, journeys.length]);

  // Prefetch tracks for every selectable language as soon as the panel
  // opens, so by the time the user picks one in Step 1 the Step 2
  // cards render instantly. The shell's `getTracksForLanguage` reads
  // through an in-memory + disk cache, so duplicate calls are cheap.
  // We fire all requests in parallel and ignore the result here — only
  // the cache side-effect matters.
  const prefetchedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      prefetchedRef.current = false;
      return;
    }
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    const seen = new Set<string>();
    for (const option of LANGUAGE_OPTIONS) {
      if (seen.has(option.name)) continue;
      seen.add(option.name);
      void getTracksForLanguage(option.name);
    }
  }, [open, getTracksForLanguage]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 28,
          stiffness: 240,
          mass: 0.95,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: PANEL_TRAVEL,
          duration: 240,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open, mounted, backdrop, translateY]);

  const existingKeys = useMemo(() => existingJourneyKeys(journeys), [journeys]);

  if (!mounted) return null;

  function handleClose() {
    setMode("list");
    setPickedLanguage(null);
    setPickedTrackId(null);
    setAvailableTracks([]);
    setTracksLoading(false);
    onClose();
  }

  function handleBack() {
    if (mode === "pick-focus") {
      setMode("pick-language");
      setPickedTrackId(null);
      setAvailableTracks([]);
      setTracksLoading(false);
    } else if (mode === "pick-language") {
      // If there are no journeys yet, "back" closes — there's nowhere
      // to go in the list view.
      if (journeys.length === 0) handleClose();
      else setMode("list");
    } else {
      handleClose();
    }
  }

  async function pickLanguageAndLoadTracks(option: LanguageOption) {
    setPickedLanguage(option);
    setPickedTrackId(null);
    // Sync cache hit: if the shell already has the tracks (typically
    // because the open-time prefetch already populated the cache),
    // render them in this same render — no spinner.
    const cachedSync = getTracksForLanguageSync?.(option.name) ?? null;
    if (cachedSync !== null && cachedSync.length > 0) {
      setAvailableTracks(cachedSync);
      setTracksLoading(false);
      setMode("pick-focus");
      return;
    }
    setAvailableTracks([]);
    setTracksLoading(true);
    setMode("pick-focus");
    try {
      const tracks = await getTracksForLanguage(option.name);
      setAvailableTracks(tracks);
    } catch {
      setAvailableTracks([]);
    } finally {
      setTracksLoading(false);
    }
  }

  async function handleCreate() {
    if (!pickedLanguage || !pickedTrackId || submitting) return;
    const pickedTrack = availableTracks.find((t) => t.id === pickedTrackId) ?? null;
    setSubmitting(true);
    try {
      await onCreate({
        language: pickedLanguage.name,
        // Use the Studio Journey track id as the variant so the
        // resulting journey id is unique per (language, track).
        variant: pickedTrackId,
        // El código regional ("latam"/"spain"/…) viene del paso 1 y
        // se persiste aparte para que `LanguageFlag` pinte la
        // bandera correcta. Antes se perdía porque `variant` se
        // sobreescribía con el cuid del track.
        region: pickedLanguage.variant,
        focus: DEFAULT_NEW_JOURNEY_FOCUS,
        label: pickedTrack?.label ?? null,
      });
      handleClose();
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeletePress(journey: Journey) {
    // Block the destructive path on the last journey — leaving the
    // user with zero journeys would push them straight back into the
    // create flow with no obvious way out, and the activeJourneyId
    // bookkeeping would have nothing to point at.
    if (journeys.length <= 1) {
      Alert.alert(
        "Can't remove your only journey",
        "Add another journey first if you want to switch focuses, then remove this one.",
        [{ text: "OK" }]
      );
      return;
    }
    Alert.alert(
      "Remove this journey?",
      `${journeyDisplayName(journey)} will be removed. Your global progress and saved words stay.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void onDelete(journey.id),
        },
      ]
    );
  }

  const headerTitle =
    mode === "list"
      ? journeys.length <= 1
        ? "Your journey"
        : "Your journeys"
      : mode === "pick-language"
        ? "Pick a language"
        : "Pick a journey";
  const headerSub =
    mode === "list"
      ? `${journeys.length} active`
      : mode === "pick-language"
        ? "Step 1 of 2"
        : "Step 2 of 2";

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[styles.backdrop, { opacity: backdrop }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          { transform: [{ translateY }] },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={12} style={styles.headerIcon}>
            <Feather name="chevron-left" size={20} color="#f5f7fb" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>{headerSub.toUpperCase()}</Text>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.headerIcon}>
            <Feather name="x" size={20} color="#f5f7fb" />
          </Pressable>
        </View>

        {mode === "list" ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {journeys.map((journey) => {
              const isActive = journey.id === activeJourneyId;
              const stats = statsByLanguage[journey.language] ?? {
                streak: 0,
                xpTotal: 0,
                progress: 0,
              };
              const focusLabel = focusShortLabel(journey.focus);
              // `journeyIcon` deriva el icono del label real
              // ("Viajero" → send, "Business" → briefcase, etc.) en
              // lugar de mirar `focus` que bajo el modelo nuevo
              // siempre vale "General" → coffee. Antes el card pintaba
              // taza de café para TODOS los journeys.
              const icon = journeyIcon(journey);
              // Título = solo el idioma. El nombre específico del
              // journey ("Conversational", "Viajero", "Travelers"…)
              // se mueve a la sub-línea para que la línea del idioma
              // no quede tan larga ("Portuguese · Conversational" se
              // partía a dos visuales).
              const journeyNameLabel = (journey.label ?? "").trim() || focusLabel;
              // Level: pasamos por cefrFromCoarseLevel para que el
              // card muestre "B1" en lugar de "Intermediate", igual
              // que la sheet de switch idiomas. Antes había
              // inconsistencia entre las dos vistas del mismo journey.
              const levelLabel = cefrFromCoarseLevel(journey.level);
              return (
                <Pressable
                  key={journey.id}
                  onPress={() => void onSelect(journey.id)}
                  style={[
                    styles.card,
                    isActive ? styles.cardActive : styles.cardInactive,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <LanguageFlag
                      language={journey.language}
                      variant={journeyFlagVariant(journey)}
                      size={44}
                    />
                    <View style={styles.cardTitleBlock}>
                      <Text style={styles.cardTitle}>{journey.language}</Text>
                      <View style={styles.cardSubLine}>
                        <Feather
                          name={icon.feather}
                          size={12}
                          color="rgba(255,255,255,0.7)"
                        />
                        <Text style={styles.cardSubText}>
                          {journeyNameLabel}
                          {levelLabel ? ` · ${levelLabel}` : ""}
                        </Text>
                      </View>
                    </View>
                    {isActive ? (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>ACTIVE</Text>
                      </View>
                    ) : (
                      <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.45)" />
                    )}
                  </View>
                  <View style={styles.cardFooterRow}>
                    <View style={styles.cardStatsRow}>
                      <View style={styles.cardStat}>
                        <Feather
                          name="zap"
                          size={12}
                          color={stats.streak > 0 ? tokenColor.streak : "rgba(255,255,255,0.45)"}
                        />
                        <Text style={[styles.cardStatText, {
                          color: stats.streak > 0 ? tokenColor.streak : "rgba(255,255,255,0.45)",
                        }]}>
                          {stats.streak}
                        </Text>
                      </View>
                      <View style={styles.cardStat}>
                        <Feather name="star" size={12} color={tokenColor.xp} />
                        <Text style={[styles.cardStatText, { color: tokenColor.xp }]}>
                          {stats.xpTotal >= 1000
                            ? `${(stats.xpTotal / 1000).toFixed(1)}k`
                            : stats.xpTotal}
                        </Text>
                      </View>
                      <View style={styles.cardStat}>
                        <Feather name="trending-up" size={12} color={tokenColor.cyan} />
                        <Text style={[styles.cardStatText, { color: tokenColor.cyan }]}>
                          {stats.progress}%
                        </Text>
                      </View>
                    </View>
                    {/* Trash button — subtle in normal state, lights
                        up red on press. Tapping fires an Alert
                        confirm before any state mutation runs. The
                        button uses hitSlop so the small icon target
                        is forgiving; we also stopPropagation so the
                        whole-card "make active" Pressable above
                        doesn't swallow the tap. */}
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeletePress(journey);
                      }}
                      hitSlop={10}
                      style={({ pressed }) => [
                        styles.cardDeleteButton,
                        pressed ? styles.cardDeleteButtonPressed : null,
                      ]}
                      accessibilityLabel={`Remove ${journey.language} ${focusLabel} journey`}
                    >
                      <Feather
                        name="trash-2"
                        size={14}
                        color="rgba(255,255,255,0.5)"
                      />
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => setMode("pick-language")}
              style={[styles.card, styles.createCard]}
            >
              <View style={styles.createIconRing}>
                <Feather name="plus" size={20} color={tokenColor.xp} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.createTitle}>Start a new journey</Text>
                <Text style={styles.createHint}>Pick a language + focus</Text>
              </View>
              <Feather name="chevron-right" size={18} color={tokenColor.xp} />
            </Pressable>
          </ScrollView>
        ) : null}

        {mode === "pick-language" ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {journeys.length === 0 ? (
              <View style={styles.welcomeBanner}>
                <Text style={styles.welcomeTitle}>Pick your first language</Text>
                <Text style={styles.welcomeBody}>
                  This is the first journey on your account. You can add more
                  later — one per (language · focus) combination.
                </Text>
              </View>
            ) : null}
            <View style={styles.languageGrid}>
              {LANGUAGE_OPTIONS.map((option) => {
                const selected = pickedLanguage?.key === option.key;
                // We can no longer cheaply check "all journeys taken
                // for this language" without fetching the track list,
                // so the language picker stays open and the dedup is
                // enforced one level down (Step 2: alreadyExists).
                const comingSoon = comingSoonLanguages?.has(option.name) ?? false;
                const disabled = comingSoon;
                return (
                  <Pressable
                    key={option.key}
                    disabled={disabled}
                    onPress={() => {
                      void pickLanguageAndLoadTracks(option);
                    }}
                    style={[
                      styles.languageCard,
                      selected ? styles.languageCardSelected : null,
                      disabled ? styles.languageCardDisabled : null,
                    ]}
                  >
                    <LanguageFlag
                      language={option.name}
                      variant={option.variant}
                      size={42}
                    />
                    <View style={styles.languageCardMeta}>
                      <Text style={styles.languageCardName}>{option.name}</Text>
                      {option.variantLabel ? (
                        <View style={styles.variantPill}>
                          <Text style={styles.variantPillText}>
                            {option.variantLabel}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {comingSoon ? (
                      <View style={styles.comingSoonPill}>
                        <Text style={styles.comingSoonPillText}>COMING SOON</Text>
                      </View>
                    ) : (
                      <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.4)" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : null}

        {mode === "pick-focus" && pickedLanguage ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.focusContextRow}>
              <LanguageFlag
                language={pickedLanguage.name}
                variant={pickedLanguage.variant}
                size={28}
              />
              <Text style={styles.focusContextText}>
                {pickedLanguage.name}
                {pickedLanguage.variantLabel ? ` · ${pickedLanguage.variantLabel}` : ""}
              </Text>
            </View>
            <Text style={styles.focusPrompt}>Pick a journey</Text>
            <View style={styles.focusGrid}>
              {tracksLoading ? (
                <Text style={styles.focusEmptyText}>
                  Loading journeys for {pickedLanguage.name}…
                </Text>
              ) : availableTracks.length === 0 ? (
                <Text style={styles.focusEmptyText}>
                  No journeys available for {pickedLanguage.name} yet.
                </Text>
              ) : (
                availableTracks.map((track) => {
                  const id = journeyId(
                    pickedLanguage.name,
                    track.id,
                    DEFAULT_NEW_JOURNEY_FOCUS
                  );
                  const alreadyExists = existingKeys.has(id);
                  const selected = pickedTrackId === track.id;
                  return (
                    <Pressable
                      key={track.id}
                      onPress={() => {
                        if (alreadyExists) {
                          // Tap on an existing combo just activates it.
                          void onSelect(id);
                          handleClose();
                          return;
                        }
                        setPickedTrackId(track.id);
                      }}
                      style={[
                        styles.focusCard,
                        selected ? styles.focusCardSelected : null,
                        alreadyExists ? styles.focusCardDisabled : null,
                      ]}
                    >
                      <View style={styles.focusIconBox}>
                        <Feather
                          name="map"
                          size={20}
                          color={selected ? tokenBg[1] : tokenColor.cyan}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.focusCardTitle}>{track.label}</Text>
                      </View>
                      {alreadyExists ? (
                        <Text style={styles.alreadyText}>Already started ›</Text>
                      ) : selected ? (
                        <Feather name="check" size={18} color={tokenColor.xp} />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </View>
          </ScrollView>
        ) : null}

        {mode === "pick-focus" ? (
          <View style={styles.footer}>
            <Pressable
              onPress={() => void handleCreate()}
              disabled={!pickedTrackId || submitting}
              style={[
                styles.startButton,
                !pickedTrackId || submitting ? styles.startButtonDisabled : null,
              ]}
            >
              <Text style={styles.startButtonText}>
                {submitting ? "Starting…" : "Start journey"}
              </Text>
              <Feather name="arrow-right" size={18} color={tokenBg[1]} />
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const PANEL_TRAVEL = 1100;

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 24, 52, 0.65)",
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#0c1626",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerEyebrow: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    padding: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    gap: 12,
  },
  cardActive: {
    backgroundColor: "rgba(252, 211, 77, 0.08)",
    borderColor: "rgba(252, 211, 77, 0.45)",
  },
  cardInactive: {
    backgroundColor: "rgba(255,255,255,0.035)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  cardSubLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  cardSubText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "700",
  },
  activePill: {
    backgroundColor: tokenColor.xp,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activePillText: {
    color: tokenBg[1],
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 56,
  },
  cardStatsRow: {
    flexDirection: "row",
    gap: 16,
    flexShrink: 1,
  },
  cardDeleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  cardDeleteButtonPressed: {
    backgroundColor: "rgba(220, 38, 38, 0.18)",
  },
  cardStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardStatText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  // Lime-bordered "+ Start a new journey" card. Pinned at the bottom
  // of the journey list so the create CTA is always one tap away.
  createCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(252, 211, 77, 0.06)",
    borderColor: "rgba(252, 211, 77, 0.35)",
    borderStyle: "dashed",
  },
  createIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(252, 211, 77, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  createTitle: {
    color: tokenColor.xp,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  createHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  // ─── Step 1: pick language ─────────────────────────────────────────
  welcomeBanner: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(125, 211, 252, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.22)",
    gap: 4,
    marginBottom: 4,
  },
  welcomeTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  welcomeBody: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12.5,
    lineHeight: 18,
  },
  languageGrid: {
    gap: 10,
  },
  languageCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  languageCardSelected: {
    borderColor: "rgba(252, 211, 77, 0.5)",
    backgroundColor: "rgba(252, 211, 77, 0.08)",
  },
  languageCardDisabled: {
    opacity: 0.45,
  },
  languageCardMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  languageCardName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  variantPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(125, 211, 252, 0.14)",
  },
  variantPillText: {
    color: tokenColor.cyan,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  allTakenText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "800",
  },
  comingSoonPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  comingSoonPillText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  // ─── Step 2: pick focus ───────────────────────────────────────────
  focusContextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginBottom: 6,
  },
  focusContextText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  focusPrompt: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 8,
    marginBottom: 4,
  },
  focusGrid: {
    gap: 10,
  },
  focusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  focusCardSelected: {
    borderColor: "rgba(252, 211, 77, 0.5)",
    backgroundColor: "rgba(252, 211, 77, 0.08)",
  },
  focusCardDisabled: {
    opacity: 0.55,
  },
  focusIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(125, 211, 252, 0.14)",
  },
  focusCardTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  focusCardHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  focusEmptyText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 18,
    textAlign: "center",
  },
  alreadyText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "800",
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: tokenColor.xp,
  },
  startButtonDisabled: {
    opacity: 0.4,
  },
  startButtonText: {
    color: tokenBg[1],
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
});
