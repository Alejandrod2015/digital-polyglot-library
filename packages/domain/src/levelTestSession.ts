import {
  demonstratedLevelFromStations,
  pickStations,
  placementFromDemonstrated,
  shouldStopLadder,
  type LevelTestLevel,
  type LevelTestPayload,
  type LevelTestStation,
  type LevelTestStationResult,
} from "./levelTest";

/**
 * The listening test as a pure state machine, so the whole flow (load,
 * intro, station by station, result) is unit-tested here and the mobile
 * runner only renders it. The app has no OTA: a broken onboarding flow
 * would block every Spanish sign-up until the next store build, so the
 * logic that decides what happens on each tap must not live in JSX.
 */

export type LevelTestPhase = "loading" | "error" | "intro" | "station" | "result";
export type LevelTestAudioState = "idle" | "playing" | "done" | "failed";

export const LEVEL_TEST_MAX_REPLAYS = 1;

export type LevelTestSessionState = {
  phase: LevelTestPhase;
  ladder: LevelTestPayload["ladder"];
  stations: LevelTestStation[];
  stationIndex: number;
  results: LevelTestStationResult[];
  correct: number;
  answered: number;
  skipped: boolean;
  audio: LevelTestAudioState;
  replaysLeft: number;
  /** 0 = comprehension, 1 = vocabulary. */
  questionIndex: 0 | 1;
  selected: number | null;
  comprehensionRight: boolean | null;
};

export type LevelTestSessionAction =
  | { type: "reset" }
  | { type: "loaded"; payload: LevelTestPayload; random?: () => number }
  | { type: "loadFailed" }
  | { type: "start" }
  | { type: "audioStarted" }
  | { type: "audioDone" }
  | { type: "audioFailed" }
  | { type: "replay" }
  | { type: "select"; index: number }
  | { type: "submit" }
  | { type: "skipBrandNew" };

export const LEVEL_TEST_INITIAL_STATE: LevelTestSessionState = {
  phase: "loading",
  ladder: [],
  stations: [],
  stationIndex: 0,
  results: [],
  correct: 0,
  answered: 0,
  skipped: false,
  audio: "idle",
  replaysLeft: LEVEL_TEST_MAX_REPLAYS,
  questionIndex: 0,
  selected: null,
  comprehensionRight: null,
};

const freshStation = {
  audio: "idle" as const,
  replaysLeft: LEVEL_TEST_MAX_REPLAYS,
  questionIndex: 0 as const,
  selected: null,
  comprehensionRight: null,
};

export function currentStation(state: LevelTestSessionState): LevelTestStation | undefined {
  return state.stations[state.stationIndex];
}

/** The question on screen, or null outside a station. */
export function currentQuestion(state: LevelTestSessionState) {
  const station = currentStation(state);
  if (!station || state.phase !== "station") return null;
  return state.questionIndex === 0 ? station.comprehension : station.vocab;
}

/** Questions show only once the clip has ended (or could not play). */
export function questionsVisible(state: LevelTestSessionState): boolean {
  return state.phase === "station" && (state.audio === "done" || state.audio === "failed");
}

export function canReplay(state: LevelTestSessionState): boolean {
  return state.phase === "station" && state.replaysLeft > 0 && state.audio !== "playing";
}

export function levelTestSessionReducer(
  state: LevelTestSessionState,
  action: LevelTestSessionAction
): LevelTestSessionState {
  switch (action.type) {
    case "reset":
      return LEVEL_TEST_INITIAL_STATE;
    case "loaded": {
      const stations = pickStations(action.payload, action.random);
      if (stations.length === 0) return { ...LEVEL_TEST_INITIAL_STATE, phase: "error" };
      return { ...LEVEL_TEST_INITIAL_STATE, phase: "intro", ladder: action.payload.ladder, stations };
    }
    case "loadFailed":
      return { ...LEVEL_TEST_INITIAL_STATE, phase: "error" };
    case "start":
      if (state.phase !== "intro") return state;
      return { ...state, phase: "station", stationIndex: 0, results: [], correct: 0, answered: 0, ...freshStation };
    case "audioStarted":
      return state.phase === "station" ? { ...state, audio: "playing" } : state;
    case "audioDone":
      return state.phase === "station" ? { ...state, audio: "done" } : state;
    case "audioFailed":
      return state.phase === "station" ? { ...state, audio: "failed" } : state;
    case "replay":
      if (!canReplay(state)) return state;
      return { ...state, replaysLeft: state.replaysLeft - 1, audio: "playing" };
    case "select": {
      const question = currentQuestion(state);
      if (!question || !questionsVisible(state)) return state;
      if (action.index < 0 || action.index >= question.options.length) return state;
      return { ...state, selected: action.index };
    }
    case "submit": {
      const question = currentQuestion(state);
      if (!question || state.selected === null || !questionsVisible(state)) return state;
      const right = state.selected === question.answerIndex;
      const answered = state.answered + 1;
      const correct = state.correct + (right ? 1 : 0);
      if (state.questionIndex === 0) {
        return { ...state, answered, correct, comprehensionRight: right, questionIndex: 1, selected: null };
      }
      const station = currentStation(state)!;
      const passed = Boolean(state.comprehensionRight) && right;
      const results = [...state.results, { level: station.level, passed }];
      const last = state.stationIndex >= state.stations.length - 1;
      if (shouldStopLadder(results) || last) {
        return { ...state, answered, correct, results, phase: "result", selected: null };
      }
      return {
        ...state,
        answered,
        correct,
        results,
        stationIndex: state.stationIndex + 1,
        ...freshStation,
      };
    }
    case "skipBrandNew":
      if (state.phase !== "intro" && state.phase !== "error") return state;
      return { ...state, phase: "result", skipped: true, results: [] };
    default:
      return state;
  }
}

export type LevelTestOutcome = {
  level: LevelTestLevel;
  demonstrated: LevelTestLevel;
  correct: number;
  total: number;
  stations: LevelTestStationResult[];
  skipped: boolean;
};

/**
 * What the runner hands back. From onboarding the learner starts one rung
 * below what they demonstrated; from a locked story the test unlocks the
 * level demonstrated, so no rung is taken off there.
 */
export function levelTestOutcome(
  state: LevelTestSessionState,
  source: "onboarding" | "locked-story"
): LevelTestOutcome {
  const demonstrated = state.skipped ? "A0" : demonstratedLevelFromStations(state.results, state.ladder);
  const level = source === "onboarding" ? placementFromDemonstrated(demonstrated) : demonstrated;
  return {
    level: state.skipped ? "A0" : level,
    demonstrated,
    correct: state.correct,
    total: state.answered,
    stations: state.results,
    skipped: state.skipped,
  };
}
