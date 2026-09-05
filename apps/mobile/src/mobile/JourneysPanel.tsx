import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LanguageFlag, regionFamily } from "./LanguageFlag";
import { ProgressiveImage } from "./ProgressiveImage";
import { getCoverUrl } from "./coverUrl";
import { formatVariantLabel } from "@digital-polyglot/domain";
import { type Journey, existingJourneyKeys, journeyId } from "./journeys";
import type { JourneyFocus } from "../../../../src/lib/onboarding";
import { bg as tokenBg, color as tokenColor } from "../theme/tokens";

/** A Studio Journey track exposed by the mobile journey API. Each
 *  Journey record in Studio is one option in the Step 2 picker. */
export type JourneysPanelTrack = {
  id: string;
  label: string;
  /** Friendly level label (e.g. "Beginner") shown to disambiguate tracks
   *  that share a name. By design journeys are single-level, so several
   *  "Traveler" records differ only by their level; without this they all
   *  render identically. Null when the level can't be resolved. */
  levelLabel?: string | null;
  /** CEFR level code of the track's (single) level, e.g. "a0". Drives the
   *  level meter so the card art reflects how advanced the journey is. */
  levelCode?: string | null;
  /** Studio Journey.variant ("latam", "spain", …). The track list is fetched
   *  by language only, so this is used to filter to the variant the user
   *  picked (a Spain pick must not show LATAM journeys). */
  variant?: string | null;
  /** Portada de la primera historia con arte del track. Es la ficha del
   *  selector: el arte distingue dos journeys mejor que su nivel escrito, y
   *  ya viaja en el payload, sin llamada extra. */
  coverUrl?: string | null;
  /** Thumbhash de esa portada, para el borroso instantáneo mientras baja. */
  coverThumbhash?: string | null;
};

// Orden CEFR: ordena los niveles dentro de cada region.
const CEFR_ORDER = ["a0", "a1", "a2", "b1", "b2", "c1", "c2"];

/** Que vas a poder HACER con cada tipo de journey. Va en la SUBCABECERA, una
 *  sola vez: en la fila la ocupa la gramatica del nivel.
 *
 *  Tres reglas, las tres aprendidas rompiendolas:
 *
 *  1. Describe, no promete. "Travel without translating" y "Sound like you
 *     live there" prometian lo mismo con otras palabras y no decian que sabra
 *     hacer el alumno.
 *  2. Habla del journey, no del comprador. Atarla al dolor de UNA persona
 *     ("Talk to their family yourself") deja fuera a los demas que hacen ese
 *     mismo camino.
 *  3. Sin deicticos: "everyday life there" no señala ningun sitio. La region
 *     ya esta en la cabecera que hay justo encima de la fila.
 *
 *  El contraste es la situacion, que es lo unico que de verdad separa los tres
 *  caminos: un viaje, una conversacion, el dia a dia.
 *
 *  Son los tres tipos que existen en el catalogo vivo (17 Traveler, 8 Friends,
 *  3 Expat, segun `scripts/journeysTable.ts`). Un tipo nuevo sale sin linea
 *  hasta que se le escriba la suya; nunca una inventada al vuelo. */
const TYPE_BLURBS: Record<string, string> = {
  traveler: "Get through a trip on your own",
  friends: "Follow and join conversations",
  expat: "Handle everyday life",
};
function typeBlurb(label: string): string | null {
  return TYPE_BLURBS[label.trim().toLowerCase()] ?? null;
}

/** Lo que hace distinto a cada nivel, en una linea que NUNCA se corta.
 *
 *  Condensa `grammarStructures` de `PEDAGOGICAL_RULES` (src/agents/config),
 *  que es donde vive la definicion. Se copia aqui corta a proposito: aquella
 *  lista esta escrita para el generador y una sola de sus entradas ya son 60
 *  caracteres ("Full range of subjunctive mood including imperfect
 *  subjunctive"), que en la fila salia partida o cortada.
 *
 *  Tope 33 caracteres, y la fila admite dos renglones: en el movil mas
 *  estrecho envuelve, nunca trunca. Si se toca `PEDAGOGICAL_RULES`, hay que
 *  revisar estas.
 *
 *  A0 no sale de ahi, porque ese archivo empieza en A1. Sale del validador
 *  (`src/lib/validateGeneratedStory.ts`), que fija el suelo A0 con esas
 *  palabras: "one idea per short sentence". Su techo gramatical esta escrito
 *  por exclusion (puede llegar a A1/A2, nunca a B1), asi que no hay una lista
 *  de estructuras que copiar; lo que de verdad define el nivel es la frase.
 */
const LEVEL_GRAMMAR: Record<string, string> = {
  a0: "Present tense, basic questions",
  a1: "Present tense, articles, pronouns",
  a2: "Past, present continuous, future",
  b1: "Present perfect, relative clauses",
  b2: "Perfect tenses, conditionals",
  c1: "All tenses, subjunctive mood",
  // El C2 de `PEDAGOGICAL_RULES` habla de formas arcaicas y literarias. Eso
  // no es este producto: aqui se aprende a hablar como la gente del sitio, no
  // a leer a los clasicos. Se queda la otra mitad de la regla, la flexibilidad
  // nativa y el cambio de registro, que si describe hablar de verdad.
  c2: "Native range, any register",
};
function grammarLine(levelCode?: string | null): string | null {
  return LEVEL_GRAMMAR[(levelCode ?? "").trim().toLowerCase()] ?? null;
}

/** Default focus assigned when the user creates a journey from this
 *  panel. The journey is uniquely identified by (language, track.id),
 *  so the focus field only exists to satisfy the legacy schema and is
 *  no longer user-facing. Phase-2 cleanup will drop the field. */
const DEFAULT_NEW_JOURNEY_FOCUS: JourneyFocus = "General";

/**
 * Full-screen "Start a new journey" panel. Slides up from the bottom
 * (mirror of the sheet pattern but covers the whole viewport) and is
 * two steps deep:
 *
 *   1. Pick language; 9-language grid, with English split into US / UK
 *      rows. Combinations that already exist are disabled and labeled.
 *   2. Pick journey; one card per Studio Journey track for the picked
 *      language, then an `Add journey` CTA that matches the label on
 *      the sheet footer that opened this panel.
 *
 * Browsing, activating and deleting journeys are NOT here; they live
 * in the flag sheet (`LanguageSwitchSheet`), which is also the only
 * way in. Back from step 1 therefore returns to that sheet.
 */

type LanguageOption = {
  /** Used as map key for selection state; for English this carries
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
  // Spanish: two entries; Spain flag (ES) and Colombia flag (LATAM).
  // Mexico's flag was visually indistinguishable from Italy, so we
  // use Colombia (yellow-blue-red 2:1:1) as the LATAM signal.
  { key: "Spanish|es", name: "Spanish", variant: "es", variantLabel: "SPAIN" },
  { key: "Spanish|latam", name: "Spanish", variant: "latam", variantLabel: "LATAM" },
  { key: "French", name: "French", variant: null, variantLabel: null },
  { key: "German", name: "German", variant: null, variantLabel: null },
  { key: "Italian", name: "Italian", variant: null, variantLabel: null },
  // Two Portuguese rows; different flags + variant codes "br"/"pt"
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
  /** Languages flagged as Próximamente in Studio Planning; they show up but
   *  can't be picked yet. Hydrated by the shell from /api/mobile/languages. */
  comingSoonLanguages?: ReadonlySet<string>;
  /** Variants with no journeys yet, keyed `${language}:${regionFamily}`. Lets
   *  the picker disable e.g. Spanish · Spain while Spanish · LATAM is live. */
  unavailableVariants?: ReadonlySet<string>;
  /** Activate an existing journey by id and close the panel. */
  onSelect: (id: string) => void | Promise<void>;
  /** CEFR code of the learner's placement ("a0", "b1"…), used to mark the
   *  row that matches their level. Null when they never took the test. */
  placementLevelCode?: string | null;
  /** Studio track id -> id of the saved journey that already opens it.
   *  A journey knows its track through `variant` only under the current
   *  model; older ones store a region there, so their track looked free
   *  here and the user could add a second journey onto the same content.
   *  The shell resolves the mapping the same way it resolves the rows in
   *  the switch sheet, so a track this marks as taken is a track the user
   *  can already see in their list. */
  journeyIdByTrack?: Record<string, string>;
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
  /** Fetch the Studio Journey tracks for a language. Used to populate
   *  Step 2 of the create flow with real journeys instead of the old
   *  4 hardcoded focus categories. The shell typically wraps the
   *  /api/mobile/journey endpoint. Should never throw; return an
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
  comingSoonLanguages,
  unavailableVariants,
  journeyIdByTrack,
  placementLevelCode,
  onSelect,
  onCreate,
  getTracksForLanguage,
  getTracksForLanguageSync,
}: Props) {
  // Slide-up sheet animation, same pattern as LanguageSwitchSheet but
  // covering the whole screen height. We keep the tree alive during
  // the exit animation so the slide-out has time to play.
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(PANEL_TRAVEL)).current;
  const [mounted, setMounted] = useState(open);
  // "pick-language" → step 1 of create flow.
  // "pick-focus"    → step 2 of create flow (now picks a Studio
  //                   Journey track, not one of 4 hardcoded focuses).
  // There is no list mode: browsing, activating and deleting journeys
  // all live in the flag sheet (`LanguageSwitchSheet`). This panel only
  // creates.
  type Mode = "pick-language" | "pick-focus";
  const [mode, setMode] = useState<Mode>("pick-language");
  const [pickedLanguage, setPickedLanguage] = useState<LanguageOption | null>(null);
  const [pickedTrackId, setPickedTrackId] = useState<string | null>(null);
  const [availableTracks, setAvailableTracks] = useState<JourneysPanelTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // The panel's only entry point is the sheet's "Add journey" CTA, so
  // it opens straight on the create flow. It used to open on a list of
  // the journeys the sheet had *just* listed, which made "Add journey"
  // a button that added nothing: the user had to tap "Start a new
  // journey" to reach the languages.
  useEffect(() => {
    if (open) {
      setMode("pick-language");
      setPickedLanguage(null);
      setPickedTrackId(null);
      setAvailableTracks([]);
      setTracksLoading(false);
    }
  }, [open]);

  // Prefetch tracks for every selectable language as soon as the panel
  // opens, so by the time the user picks one in Step 1 the Step 2
  // cards render instantly. The shell's `getTracksForLanguage` reads
  // through an in-memory + disk cache, so duplicate calls are cheap.
  // We fire all requests in parallel and ignore the result here; only
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
    setMode("pick-language");
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
    } else {
      // Step 1 is the first screen of the panel, so "back" leaves the
      // panel and returns to the flag sheet the user came from.
      handleClose();
    }
  }

  async function pickLanguageAndLoadTracks(option: LanguageOption) {
    setPickedLanguage(option);
    setPickedTrackId(null);
    // Sync cache hit: if the shell already has the tracks (typically
    // because the open-time prefetch already populated the cache),
    // render them in this same render; no spinner.
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


  // Tracks are fetched by language only, so filter to the variant the user
  // picked in step 1. Without this, picking Spanish · Spain shows the LATAM
  // "Traveler" journeys (the only Spanish content that exists). When the
  // picked language has no regional variant, show everything.
  const pickedRegion = regionFamily(pickedLanguage?.variant);
  const visibleTracks = pickedLanguage?.variant
    ? availableTracks.filter((t) => regionFamily(t.variant) === pickedRegion)
    : availableTracks;

  /**
   * Los tracks, agrupados por REGION. Es lo que clasifica: primero eliges el
   * español (o el portugues) que quieres oir, y dentro de esa region subes de
   * nivel. Antes salian los seis en una lista plana donde lo unico que los
   * separaba iba en gris pequeño, y no se veia que Latin America tiene
   * escalera de cuatro niveles mientras Mexico y Colombia tienen uno.
   *
   * Dentro de cada grupo mandan los niveles, de menor a mayor. Primero va la
   * region generica (la familia que el usuario pico en el paso 1) y despues
   * los paises, por orden alfabetico.
   */
  const regionGroups: Array<{
    key: string;
    variant: string | null;
    label: string;
    tracks: JourneysPanelTrack[];
    types: Array<{ label: string; blurb: string | null; tracks: JourneysPanelTrack[] }>;
  }> = [];
  for (const track of visibleTracks) {
    const key = (track.variant ?? "").trim().toLowerCase();
    let group = regionGroups.find((g) => g.key === key);
    if (!group) {
      group = {
        key,
        variant: track.variant ?? null,
        label: formatVariantLabel(track.variant) || pickedLanguage?.name || "",
        tracks: [],
        types: [],
      };
      regionGroups.push(group);
    }
    group.tracks.push(track);
  }
  const cefrRank = (t: JourneysPanelTrack) => {
    const idx = CEFR_ORDER.indexOf((t.levelCode ?? "").trim().toLowerCase());
    return idx < 0 ? CEFR_ORDER.length : idx;
  };
  for (const group of regionGroups) {
    group.tracks.sort((a, b) => cefrRank(a) - cefrRank(b));
    // Segundo corte: por TIPO. Una region puede tener dos caminos distintos
    // (Traveler y Friends) y en una lista sola se leian como una escalera
    // unica: un C1 de Friends parecia la continuacion del A2 de Traveler.
    // Dentro de cada tipo mandan los niveles, y los tipos van por el nivel
    // mas bajo que ofrecen, asi que el camino por el que se entra sale antes.
    for (const track of group.tracks) {
      let type = group.types.find((t) => t.label === track.label);
      if (!type) {
        type = { label: track.label, blurb: typeBlurb(track.label), tracks: [] };
        group.types.push(type);
      }
      type.tracks.push(track);
    }
    group.types.sort((a, b) => cefrRank(a.tracks[0]) - cefrRank(b.tracks[0]));
  }
  regionGroups.sort((a, b) => {
    if (a.key === pickedRegion) return -1;
    if (b.key === pickedRegion) return 1;
    return a.label.localeCompare(b.label);
  });

  const selectedTrack = visibleTracks.find((t) => t.id === pickedTrackId) ?? null;

  const headerTitle = mode === "pick-language" ? "Pick a language" : "Pick a journey";
  const headerSub = mode === "pick-language" ? "Step 1 of 2" : "Step 2 of 2";

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
                  later; one per (language · focus) combination.
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
                const variantUnavailable = option.variant
                  ? unavailableVariants?.has(
                      `${option.name.toLowerCase()}:${regionFamily(option.variant)}`
                    ) ?? false
                  : false;
                const comingSoon =
                  (comingSoonLanguages?.has(option.name) ?? false) || variantUnavailable;
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
                      <Text style={styles.languageCardName} numberOfLines={1}>
                        {option.name}
                      </Text>
                      {option.variantLabel ? (
                        <View style={styles.variantPill}>
                          <Text style={styles.variantPillText} numberOfLines={1}>
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
                size={22}
              />
              <Text style={styles.focusContextText}>{pickedLanguage.name}</Text>
            </View>

            {tracksLoading ? (
              <Text style={styles.focusEmptyText}>
                Loading journeys for {pickedLanguage.name}…
              </Text>
            ) : regionGroups.length === 0 ? (
              <Text style={styles.focusEmptyText}>
                No journeys available for {pickedLanguage.name}
                {pickedLanguage.variantLabel ? ` (${pickedLanguage.variantLabel})` : ""} yet.
              </Text>
            ) : (
              regionGroups.map((group) => (
                <View key={group.key} style={styles.regionBlock}>
                  <View style={styles.regionHeader}>
                    <LanguageFlag
                      language={pickedLanguage.name}
                      variant={group.variant}
                      size={20}
                    />
                    <Text style={styles.regionName}>{group.label}</Text>
                  </View>

                  {group.types.map((type) => (
                  <View key={type.label} style={styles.typeBlock}>
                  <Text style={styles.typeName}>{type.label.toUpperCase()}</Text>
                  {type.blurb ? <Text style={styles.typeBlurb}>{type.blurb}</Text> : null}
                  {type.tracks.map((track) => {
                    const id = journeyId(
                      pickedLanguage.name,
                      track.id,
                      DEFAULT_NEW_JOURNEY_FOCUS
                    );
                    // The journey that already opens this track, if any. The
                    // id-based check only sees journeys created under the
                    // current model; `journeyIdByTrack` also covers the older
                    // ones, which store a region in `variant` instead of the
                    // track id.
                    const existingId =
                      journeyIdByTrack?.[track.id] ?? (existingKeys.has(id) ? id : null);
                    const alreadyExists = existingId !== null;
                    const selected = pickedTrackId === track.id;
                    const recommended =
                      !alreadyExists &&
                      placementLevelCode !== null &&
                      placementLevelCode !== undefined &&
                      (track.levelCode ?? "").trim().toLowerCase() ===
                        placementLevelCode.trim().toLowerCase();
                    const grammar = grammarLine(track.levelCode);
                    return (
                      <Pressable
                        key={track.id}
                        onPress={() => {
                          if (existingId) {
                            // Tap on an existing combo just activates it.
                            void onSelect(existingId);
                            handleClose();
                            return;
                          }
                          setPickedTrackId(track.id);
                        }}
                        style={[
                          styles.trackCard,
                          selected ? styles.trackCardSelected : null,
                          alreadyExists ? styles.trackCardTaken : null,
                        ]}
                      >
                        {track.coverUrl ? (
                          <ProgressiveImage
                            uri={getCoverUrl(track.coverUrl, 256)}
                            thumbhash={track.coverThumbhash}
                            style={styles.trackCover}
                          />
                        ) : (
                          <View style={[styles.trackCover, styles.trackCoverFallback]}>
                            <LanguageFlag
                              language={pickedLanguage.name}
                              variant={track.variant}
                              size={24}
                            />
                          </View>
                        )}
                        <View style={styles.trackBody}>
                          <Text style={styles.trackLevel} numberOfLines={1}>
                            {track.levelLabel ?? track.label}
                          </Text>
                          {grammar ? (
                            <Text style={styles.trackBlurb} numberOfLines={2}>
                              {grammar}
                            </Text>
                          ) : null}
                        </View>
                        {alreadyExists ? (
                          <Text style={styles.trackTaken}>Added</Text>
                        ) : recommended ? (
                          <Text style={styles.trackForYou}>FOR YOU</Text>
                        ) : selected ? (
                          <Feather name="check" size={18} color={tokenColor.xp} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                  </View>
                  ))}
                </View>
              ))
            )}
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
              <Text style={styles.startButtonText} numberOfLines={1}>
                {submitting
                  ? "Adding…"
                  : selectedTrack
                    ? // Sin la region delante: "Add Latin America ·
                      // Pre-Intermediate (A2)" no cabe en el boton, y la
                      // region ya esta en la cabecera de arriba.
                      `Add ${selectedTrack.levelLabel ?? selectedTrack.label}`
                    : "Add journey"}
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
  // Lime-bordered "+ Start a new journey" card. Pinned at the bottom
  // of the journey list so the create CTA is always one tap away.
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
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  languageCardName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    flexShrink: 1,
  },
  variantPill: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(125, 211, 252, 0.14)",
  },
  variantPillText: {
    color: tokenColor.cyan,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  comingSoonPill: {
    flexShrink: 0,
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
    letterSpacing: 0.5,
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
  typeBlock: {
    marginBottom: 4,
  },
  typeName: {
    color: tokenColor.cyan,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginTop: 10,
  },
  typeBlurb: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    marginBottom: 8,
  },
  trackCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  trackCardSelected: {
    borderColor: tokenColor.cyan,
    backgroundColor: "rgba(125,211,252,0.10)",
  },
  trackCardTaken: {
    opacity: 0.55,
  },
  // Cuadrada. La portada nace en 3:4 y a 52 de ancho el arte quedaba en una
  // tira estrecha; recortada al centro y a 68 de lado se ve la escena, que es
  // lo que distingue un journey de otro. La altura de la fila no cambia.
  trackCover: {
    width: 68,
    height: 68,
    borderRadius: 10,
  },
  trackCoverFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(125,211,252,0.10)",
  },
  trackBody: {
    flex: 1,
    minWidth: 0,
  },
  trackLevel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  trackBlurb: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  trackForYou: {
    color: tokenColor.cyan,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  trackTaken: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "800",
  },
  regionBlock: {
    marginTop: 18,
  },
  regionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  regionName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  focusEmptyText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 18,
    textAlign: "center",
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
