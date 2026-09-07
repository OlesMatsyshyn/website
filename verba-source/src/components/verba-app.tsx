"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { withBasePath } from "@/lib/deployment";
import {
  downloadPackage,
  formBefore,
  loadCatalog,
  readActivePackageId,
  readInstalledPackages,
  removeInstalledPackage,
  saveActivePackageId,
  termForWord,
  translationForWord,
} from "@/lib/packages";
import { accuracy, answerMatches, insertLater, sampleStable, stableShuffle } from "@/lib/practice";
import {
  emptyProgress,
  progressTotals,
  readProgress,
  recordAttempt,
  recordMatchAttempt,
  saveProgress,
  weakItems,
  itemWeaknessScore,
  type ItemProgress,
  type PracticeKind,
  type VerbaProgress,
} from "@/lib/progress";
import type {
  AnthemReference,
  CivicReference,
  CorrectionMode,
  CoursePackage,
  EndingMode,
  FormExercise,
  PackageCatalog,
  PackageCatalogItem,
  TextExercise,
  WordPair,
} from "@/lib/types";

type Screen = "home" | "match" | "text" | "forms" | "progress" | "library" | "reference" | "anthem";

const pairOptions = [3, 5, 10, 20];
const textLevels = [1, 2, 3, 4, 5] as const;
const sessionSize = 10;

export function VerbaApp() {
  const [catalog, setCatalog] = useState<PackageCatalog | null>(null);
  const [installed, setInstalled] = useState<CoursePackage[]>([]);
  const [activePackageId, setActivePackageId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [screen, setScreen] = useState<Screen>("home");
  const [progress, setProgress] = useState<VerbaProgress>(() => emptyProgress());
  const [practice, setPractice] = useState<{ kind: PracticeKind; ids: string[] } | null>(null);
  const [requestedPackageId, setRequestedPackageId] = useState("");
  const [busyPackageId, setBusyPackageId] = useState("");
  const [libraryMessage, setLibraryMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function start() {
      try {
        const requested = new URLSearchParams(window.location.search).get("package") ?? "";
        const [nextCatalog, storedInstalled] = await Promise.all([loadCatalog(), readInstalledPackages()]);
        const nextInstalled = await refreshOutdatedInstalledPackages(nextCatalog, storedInstalled);
        if (!mounted) return;

        setCatalog(nextCatalog);
        setInstalled(sortPackages(nextInstalled, nextCatalog));
        setRequestedPackageId(requested);
        if (requested) setScreen("library");

        const storedActiveId = readActivePackageId();
        const selected = nextInstalled.find((item) => item.metadata.id === storedActiveId) ?? nextInstalled[0] ?? null;
        if (selected) {
          setActivePackageId(selected.metadata.id);
          saveActivePackageId(selected.metadata.id);
        }

        setProgress(readProgress());
      } catch (error) {
        if (mounted) setLoadError(error instanceof Error ? error.message : "Could not load Vérba.");
      }
    }

    start();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(withBasePath("/sw.js"), { scope: withBasePath("/") }).catch(() => {
      // Service worker support is helpful, but the app should still work online without it.
    });
  }, []);

  const activePackage = installed.find((item) => item.metadata.id === activePackageId) ?? null;
  const totals = activePackage ? progressTotals(progress, activePackage.metadata.id) : { attempts: 0, correct: 0, incorrect: 0, weak: 0 };

  function record(kind: PracticeKind, itemId: string, wasCorrect: boolean) {
    if (!activePackage) return;
    setProgress((current) => {
      const next = recordAttempt(current, activePackage.metadata.id, kind, itemId, wasCorrect);
      saveProgress(next);
      return next;
    });
  }

  function recordMatch(itemId: string, wasCorrect: boolean, rank: number, total: number) {
    if (!activePackage) return;
    setProgress((current) => {
      const next = recordMatchAttempt(current, activePackage.metadata.id, itemId, wasCorrect, rank, total);
      saveProgress(next);
      return next;
    });
  }

  function goHome() {
    setPractice(null);
    setScreen("home");
  }

  async function refreshInstalled(nextCatalog = catalog) {
    const nextInstalled = await readInstalledPackages();
    const sorted = nextCatalog ? sortPackages(nextInstalled, nextCatalog) : nextInstalled;
    setInstalled(sorted);
    return sorted;
  }

  async function installCatalogPackage(item: PackageCatalogItem) {
    setBusyPackageId(item.id);
    setLibraryMessage("");
    try {
      const coursePackage = await downloadPackage(item);
      const nextInstalled = await refreshInstalled();
      const selected = nextInstalled.find((installedPackage) => installedPackage.metadata.id === coursePackage.metadata.id) ?? coursePackage;
      setActivePackageId(selected.metadata.id);
      saveActivePackageId(selected.metadata.id);
      setLibraryMessage(`${selected.metadata.title} installed and selected.`);
    } catch (error) {
      setLibraryMessage(error instanceof Error ? error.message : "Package could not be installed.");
    } finally {
      setBusyPackageId("");
    }
  }

  async function removePackage(packageId: string) {
    setBusyPackageId(packageId);
    setLibraryMessage("");
    try {
      await removeInstalledPackage(packageId);
      const nextInstalled = await refreshInstalled();
      if (activePackageId === packageId) {
        const nextActive = nextInstalled[0]?.metadata.id ?? "";
        setActivePackageId(nextActive);
        saveActivePackageId(nextActive);
      }
      setLibraryMessage("Package removed from this browser.");
    } catch (error) {
      setLibraryMessage(error instanceof Error ? error.message : "Package could not be removed.");
    } finally {
      setBusyPackageId("");
    }
  }

  function usePackage(packageId: string) {
    setActivePackageId(packageId);
    saveActivePackageId(packageId);
    setLibraryMessage("Active package updated.");
    setScreen("home");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand-button" type="button" onClick={goHome} aria-label="Vérba home">
          <img src={withBasePath("/icons/verba.svg")} alt="" width="44" height="44" />
          <span>Vérba</span>
        </button>
        <div className="topbar-actions">
          <button className="ghost-button compact" type="button" onClick={() => setScreen("library")}>
            Library
          </button>
          <button className="ghost-button compact" type="button" onClick={() => setScreen("progress")}>
            Progress
          </button>
        </div>
      </header>

      {loadError && (
        <section className="panel">
          <h1>Content unavailable</h1>
          <p>{loadError}</p>
        </section>
      )}

      {!catalog && !loadError && (
        <section className="panel">
          <h1>Loading Vérba</h1>
          <p>Language packages are getting ready.</p>
        </section>
      )}

      {catalog && screen === "home" && (
        <HomeScreen
          activePackage={activePackage}
          totals={totals}
          onOpen={(nextScreen) => {
            setPractice(null);
            setScreen(activePackage ? nextScreen : "library");
          }}
          onChangePackage={() => setScreen("library")}
        />
      )}

      {catalog && screen === "library" && (
        <LibraryScreen
          catalog={catalog}
          installed={installed}
          activePackageId={activePackageId}
          requestedPackageId={requestedPackageId}
          busyPackageId={busyPackageId}
          message={libraryMessage}
          onBack={goHome}
          onInstall={installCatalogPackage}
          onRemove={removePackage}
          onUse={usePackage}
        />
      )}

      {catalog && screen === "progress" && (
        activePackage ? (
          <ProgressScreen
            content={activePackage}
            progress={progress}
            onBack={goHome}
            onPractice={(kind, ids) => {
              setPractice({ kind, ids });
              setScreen(kind);
            }}
          />
        ) : (
          <ChoosePackagePanel onBack={goHome} onLibrary={() => setScreen("library")} />
        )
      )}

      {activePackage?.reference && screen === "reference" && <ReferenceScreen reference={activePackage.reference} onBack={goHome} onReadAnthem={() => setScreen("anthem")} />}

      {activePackage?.reference?.anthem && screen === "anthem" && (
        <AnthemScreen anthem={activePackage.reference.anthem} onBack={() => setScreen("reference")} />
      )}

      {activePackage && screen === "match" && (
        <MatchExercise
          key={`${activePackage.metadata.id}-match-${practice?.kind === "match" ? practice.ids.join("-") : "fresh"}`}
          packageTitle={activePackage.metadata.title}
          practiceIds={practice?.kind === "match" ? practice.ids : []}
          words={activePackage.words}
          languageLabel={activePackage.metadata.language}
          matchProgress={progress.packages[activePackage.metadata.id]?.match ?? {}}
          onBack={goHome}
          onPracticeMistakes={(ids) => setPractice({ kind: "match", ids })}
          onRecordMatch={recordMatch}
        />
      )}

      {activePackage && screen === "text" && (
        <TextExerciseView
          key={`${activePackage.metadata.id}-text-${practice?.kind === "text" ? practice.ids.join("-") : "fresh"}`}
          packageTitle={activePackage.metadata.title}
          practiceIds={practice?.kind === "text" ? practice.ids : []}
          texts={activePackage.texts}
          onBack={goHome}
          onPracticeMistakes={(ids) => setPractice({ kind: "text", ids })}
          onRecord={record}
        />
      )}

      {activePackage && screen === "forms" && (
        <FormsExercise
          key={`${activePackage.metadata.id}-forms-${practice?.kind === "forms" ? practice.ids.join("-") : "fresh"}`}
          content={activePackage}
          forms={activePackage.forms}
          practiceIds={practice?.kind === "forms" ? practice.ids : []}
          onBack={goHome}
          onPracticeMistakes={(ids) => setPractice({ kind: "forms", ids })}
          onRecord={record}
        />
      )}
    </main>
  );
}

function HomeScreen({
  activePackage,
  totals,
  onOpen,
  onChangePackage,
}: {
  activePackage: CoursePackage | null;
  totals: { attempts: number; correct: number; incorrect: number; weak: number };
  onOpen: (screen: Screen) => void;
  onChangePackage: () => void;
}) {
  return (
    <section className="home-grid">
      <div className="hero-copy">
        <p className="eyebrow">Language practice</p>
        <h1>Pick a short drill.</h1>
      </div>

      <div className="package-strip">
        <div>
          <span>Active package</span>
          <strong>{activePackage?.metadata.title ?? "No package selected"}</strong>
        </div>
        <button className="ghost-button compact" type="button" onClick={onChangePackage}>
          Change
        </button>
      </div>

      <div className="exercise-grid">
        <button className="exercise-card primary-card" type="button" onClick={() => onOpen("match")}>
          <span>Match</span>
          <small>Vocabulary</small>
        </button>
        <button className="exercise-card warm-card" type="button" onClick={() => onOpen("text")}>
          <span>Text</span>
          <small>Fill text</small>
        </button>
        <button className="exercise-card cool-card" type="button" onClick={() => onOpen("forms")}>
          <span>Forms</span>
          <small>Grammar forms</small>
        </button>
      </div>
      <button className="progress-strip" type="button" onClick={() => onOpen("progress")}>
        <span>Progress</span>
        <strong>{totals.attempts ? `${accuracy(totals.correct, totals.attempts)}%` : "New"}</strong>
        <small>{totals.weak} weak items</small>
      </button>
      {activePackage?.reference && (
        <button className="reference-strip" type="button" onClick={() => onOpen("reference")}>
          <span>Country & Civic</span>
          <strong>{activePackage.reference.country ?? activePackage.reference.title}</strong>
          <small>{referenceSummary(activePackage.reference)}</small>
          <em>Open</em>
        </button>
      )}
    </section>
  );
}

function ReferenceScreen({ reference, onBack, onReadAnthem }: { reference: CivicReference; onBack: () => void; onReadAnthem: () => void }) {
  const basicFacts = reference.facts.filter((fact) => fact.id !== "flag");
  const pledge = reference.citizenshipPledge ?? reference.oath;

  return (
    <section className="workout">
      <ExerciseHeader title={reference.title} onBack={onBack} meta="Reference" />

      {reference.flag && (
        <article className="reference-card">
          <p className="eyebrow">Flag</p>
          <h2>{reference.flag.title ?? "Flag"}</h2>
          <FlagView flag={reference.flag} />
          <p className="reference-primary compact-text">{reference.flag.colorsLocal ?? reference.flag.colorLabel ?? reference.flag.label}</p>
          {reference.flag.translationLabel && <p className="reference-translation">{reference.flag.translationLabel}</p>}
          {(reference.flag.descriptionLocal ?? reference.flag.description) && (
            <p className="reference-primary small-text">{reference.flag.descriptionLocal ?? reference.flag.description}</p>
          )}
          {reference.flag.translation && <p className="reference-translation">{reference.flag.translation}</p>}
        </article>
      )}

      {reference.anthem && (
        <article className="reference-card">
          <p className="eyebrow">Anthem</p>
          <h2>{reference.anthem.title}</h2>
          <p className="reference-primary compact-text">{reference.anthem.name}</p>
          {reference.anthem.nameTranslation && <p className="reference-translation">{reference.anthem.nameTranslation}</p>}
          {reference.anthem.description && <p className="reference-translation">{reference.anthem.description}</p>}
          {reference.anthem.lyrics && (
            <button className="ghost-button compact reference-read-button" type="button" onClick={onReadAnthem}>
              Read anthem
            </button>
          )}
        </article>
      )}

      {pledge && (
        <article className="reference-card oath-card">
          <p className="eyebrow">{pledge.title.toLocaleLowerCase().includes("oath") || pledge.title.toLocaleLowerCase().includes("jurământ") ? "Oath" : "Pledge"}</p>
          <h2>{pledge.title}</h2>
          <p className="reference-primary">{pledge.text}</p>
          <p className="translation-label">English translation</p>
          <p className="reference-translation">{pledge.translation}</p>
        </article>
      )}

      <article className="reference-card">
        <p className="eyebrow">General information</p>
        <div className="facts-list">
          {basicFacts.map((fact) => (
            <div className="fact-row" key={fact.id}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
              {fact.translation && <small>{fact.translation}</small>}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function AnthemScreen({ anthem, onBack }: { anthem: AnthemReference; onBack: () => void }) {
  return (
    <section className="workout">
      <ExerciseHeader title={anthem.title} onBack={onBack} meta="Anthem" />
      <article className="reference-card">
        <h2>{anthem.name}</h2>
        {anthem.nameTranslation && <p className="reference-translation">{anthem.nameTranslation}</p>}
        {anthem.lyrics ? <p className="reference-poem">{anthem.lyrics}</p> : <p className="reference-translation">{anthem.description}</p>}
        {anthem.translation && (
          <>
            <p className="translation-label">English translation</p>
            <p className="reference-poem translation-poem">{anthem.translation}</p>
          </>
        )}
      </article>
    </section>
  );
}

function FlagView({ flag }: { flag: NonNullable<CivicReference["flag"]> }) {
  const aspectRatio = flag.aspectRatio ?? "3 / 2";
  if (!flag.asset) return null;
  const asset = typeof flag.asset === "string" ? { src: flag.asset, alt: flag.label } : flag.asset;
  const src = asset.src.startsWith("/") ? asset.src : `/${asset.src}`;
  return (
    <img
      className="reference-flag reference-flag-image"
      src={withBasePath(src)}
      alt={asset.alt ?? flag.label}
      style={{ aspectRatio }}
    />
  );
}

function referenceSummary(reference: CivicReference) {
  const sections = [];
  const pledge = reference.citizenshipPledge ?? reference.oath;
  if (reference.flag) sections.push("Flag");
  if (reference.anthem) sections.push("Anthem");
  if (pledge) sections.push(pledge.title.toLocaleLowerCase().includes("oath") || pledge.title.toLocaleLowerCase().includes("jurământ") ? "Oath" : "Pledge");
  if (reference.facts.length) sections.push("General information");
  return sections.join(" · ");
}

function LibraryScreen({
  catalog,
  installed,
  activePackageId,
  requestedPackageId,
  busyPackageId,
  message,
  onBack,
  onInstall,
  onRemove,
  onUse,
}: {
  catalog: PackageCatalog;
  installed: CoursePackage[];
  activePackageId: string;
  requestedPackageId: string;
  busyPackageId: string;
  message: string;
  onBack: () => void;
  onInstall: (item: PackageCatalogItem) => void;
  onRemove: (packageId: string) => void;
  onUse: (packageId: string) => void;
}) {
  const installedIds = new Set(installed.map((item) => item.metadata.id));
  const groups = groupCatalog(catalog.packages);

  return (
    <section className="workout">
      <ExerciseHeader title="Library" onBack={onBack} meta={`${installed.length} installed`} />
      {requestedPackageId && <p className="library-message">Requested package: {catalog.packages.find((item) => item.id === requestedPackageId)?.title ?? requestedPackageId}</p>}
      {message && <p className="library-message">{message}</p>}
      <div className="library-groups">
        {groups.map((group) => (
          <section className="panel package-group" key={group.name}>
            <h2>{group.name}</h2>
            <div className="package-list">
              {group.items.map((item) => {
                const isInstalled = installedIds.has(item.id);
                const isActive = activePackageId === item.id;
                const isRequested = requestedPackageId === item.id;
                return (
                  <article className={`package-card${isRequested ? " is-requested" : ""}`} key={item.id}>
                    <div>
                      <h3>{packageDisplayName(item)}</h3>
                      <p className="package-stage">{packageStageName(item)}</p>
                      <p className="package-level">
                        {item.wordCount} words · {item.textCount} texts · {item.formCount} forms
                      </p>
                    </div>
                    <div className="package-actions">
                      {isInstalled ? (
                        <>
                          <span className="installed-label">{isActive ? "Active" : "Installed"}</span>
                          <button className="ghost-button compact" type="button" onClick={() => onUse(item.id)} disabled={isActive}>
                            Use
                          </button>
                          <button className="ghost-button compact" type="button" onClick={() => onRemove(item.id)} disabled={busyPackageId === item.id}>
                            Remove
                          </button>
                        </>
                      ) : (
                        <button className="primary-button package-download" type="button" onClick={() => onInstall(item)} disabled={busyPackageId === item.id}>
                          {busyPackageId === item.id ? "Downloading" : "Download"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function ChoosePackagePanel({ onBack, onLibrary }: { onBack: () => void; onLibrary: () => void }) {
  return (
    <section className="workout">
      <ExerciseHeader title="Choose a package" onBack={onBack} meta="Library" />
      <div className="panel">
        <p>Download a language package before practicing.</p>
      </div>
      <button className="primary-button" type="button" onClick={onLibrary}>
        Open Library
      </button>
    </section>
  );
}

function MatchExercise({
  words,
  practiceIds,
  packageTitle,
  languageLabel,
  matchProgress,
  onBack,
  onPracticeMistakes,
  onRecordMatch,
}: {
  words: WordPair[];
  practiceIds: string[];
  packageTitle: string;
  languageLabel: string;
  matchProgress: Record<string, ItemProgress>;
  onBack: () => void;
  onPracticeMistakes: (ids: string[]) => void;
  onRecordMatch: (itemId: string, wasCorrect: boolean, rank: number, total: number) => void;
}) {
  const [pairsPerRound, setPairsPerRound] = useState(practiceIds.length || Math.min(5, words.length));
  const [roundCount, setRoundCount] = useState(5);
  const [mode, setMode] = useState<CorrectionMode>("immediate");
  const [started, setStarted] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [roundWords, setRoundWords] = useState<WordPair[]>([]);
  const [left, setLeft] = useState<WordPair[]>([]);
  const [right, setRight] = useState<WordPair[]>([]);
  const [selectedLeft, setSelectedLeft] = useState("");
  const [selectedRight, setSelectedRight] = useState("");
  const [completed, setCompleted] = useState<string[]>([]);
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ ids: string[]; state: "right" | "wrong" } | null>(null);
  const [roundMistakes, setRoundMistakes] = useState<Record<string, number>>({});
  const [roundSignals, setRoundSignals] = useState<Record<string, number>>({});
  const [sessionWeak, setSessionWeak] = useState<Record<string, number>>({});
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [cumulativeCorrect, setCumulativeCorrect] = useState(0);
  const [cumulativeMistakes, setCumulativeMistakes] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const [pairOrder, setPairOrder] = useState<string[]>([]);
  const [results, setResults] = useState<{ correct: number; attempts: number; weak: string[] } | null>(null);
  const shuffleSeedRef = useRef(0);

  function start() {
    setStarted(true);
    setCumulativeCorrect(0);
    setCumulativeMistakes(0);
    setSessionWeak({});
    setSeenIds([]);
    setResults(null);
    beginRound(1, {}, []);
  }

  function beginRound(roundNumber: number, weakMap = sessionWeak, alreadySeen = seenIds) {
    shuffleSeedRef.current += 1;
    const shuffleSalt = `${roundNumber}-${shuffleSeedRef.current}`;
    const selected = sampleMatchRound(words, practiceIds, pairsPerRound, roundNumber, weakMap, alreadySeen, matchProgress, shuffleSalt);
    const nextSeen = Array.from(new Set([...alreadySeen, ...selected.map((word) => word.id)]));
    setCurrentRound(roundNumber);
    setRoundWords(selected);
    setLeft(stableShuffle(selected, `term-${shuffleSalt}`));
    setRight(stableShuffle(selected, `translation-${shuffleSalt}`));
    setSelectedLeft("");
    setSelectedRight("");
    setCompleted([]);
    setPairs({});
    setFeedback(null);
    setRoundMistakes({});
    setRoundSignals({});
    setAdvancing(false);
    setPairOrder([]);
    setSeenIds(nextSeen);
  }

  function choose(side: "left" | "right", id: string) {
    if (!roundWords.length || completed.includes(id) || advancing) return;

    const nextLeft = side === "left" ? id : selectedLeft;
    const nextRight = side === "right" ? id : selectedRight;
    setSelectedLeft(nextLeft);
    setSelectedRight(nextRight);

    if (mode === "submit") {
      if (nextLeft && nextRight) {
        setPairs((current) => ({ ...current, [nextLeft]: nextRight }));
        setPairOrder((current) => (current.includes(nextLeft) ? current : [...current, nextLeft]));
        setSelectedLeft("");
        setSelectedRight("");
      }
      return;
    }

    if (!nextLeft || !nextRight) return;

    const isCorrect = nextLeft === nextRight;
    setFeedback({ ids: [nextLeft, nextRight], state: isCorrect ? "right" : "wrong" });

    if (isCorrect) {
      const nextCompleted = [...completed, nextLeft];
      const rank = nextCompleted.length;
      const signal = matchRoundWeaknessSignal(true, rank, roundWords.length);
      onRecordMatch(nextLeft, true, rank, roundWords.length);
      setCompleted(nextCompleted);
      if (nextCompleted.length === roundWords.length) {
        const nextSignals = { ...roundSignals, ...(signal > 0 ? { [nextLeft]: (roundSignals[nextLeft] ?? 0) + signal } : {}) };
        setRoundSignals(nextSignals);
        completeRound(roundWords.length, roundMistakes, nextSignals);
      } else if (signal > 0) {
        setRoundSignals((current) => ({ ...current, [nextLeft]: (current[nextLeft] ?? 0) + signal }));
      }
    } else {
      onRecordMatch(nextLeft, false, completed.length + 1, roundWords.length);
      setRoundMistakes((current) => ({ ...current, [nextLeft]: (current[nextLeft] ?? 0) + 1 }));
      setRoundSignals((current) => ({ ...current, [nextLeft]: (current[nextLeft] ?? 0) + 4 }));
    }

    setSelectedLeft("");
    setSelectedRight("");
  }

  function submit() {
    if (!roundWords.length || advancing) return;
    let correct = 0;
    const misses: Record<string, number> = {};
    const signals: Record<string, number> = {};

    roundWords.forEach((word) => {
      const isCorrect = pairs[word.id] === word.id;
      const rank = pairOrder.indexOf(word.id) >= 0 ? pairOrder.indexOf(word.id) + 1 : roundWords.length;
      if (isCorrect) correct += 1;
      if (!isCorrect) misses[word.id] = 1;
      const signal = matchRoundWeaknessSignal(isCorrect, rank, roundWords.length);
      if (signal > 0) signals[word.id] = signal;
      onRecordMatch(word.id, isCorrect, rank, roundWords.length);
    });

    setRoundMistakes(misses);
    setRoundSignals(signals);
    setCompleted(roundWords.map((word) => word.id));
    completeRound(correct, misses, signals);
  }

  function completeRound(correct: number, mistakeMap: Record<string, number>, signalMap: Record<string, number>) {
    const mistakes = Object.values(mistakeMap).reduce((sum, value) => sum + value, 0);
    const nextWeak = { ...sessionWeak };
    Object.entries(signalMap).forEach(([id, signal]) => {
      nextWeak[id] = (nextWeak[id] ?? 0) + signal;
    });
    const nextCorrect = cumulativeCorrect + correct;
    const nextMistakes = cumulativeMistakes + mistakes;
    setSessionWeak(nextWeak);
    setCumulativeCorrect(nextCorrect);
    setCumulativeMistakes(nextMistakes);
    setAdvancing(true);

    window.setTimeout(() => {
      if (currentRound >= roundCount) {
        setResults({ correct: nextCorrect, attempts: nextCorrect + nextMistakes, weak: Object.keys(nextWeak) });
        setAdvancing(false);
        return;
      }
      beginRound(currentRound + 1, nextWeak, seenIds);
    }, 600);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => setFeedback(null), feedback?.state === "wrong" ? 750 : 650);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  if (!started) {
    return (
      <SetupPanel title="Match" onBack={onBack} onStart={start}>
        <p className="setup-package">{packageTitle}</p>
        <Segmented
          label="Words per round"
          options={(practiceIds.length ? [Math.min(practiceIds.length, words.length)] : pairOptions.filter((option) => option <= words.length)).map(String)}
          value={String(pairsPerRound)}
          onChange={(value) => setPairsPerRound(Number(value))}
        />
        <Segmented
          label="Rounds"
          options={["5", "10", "20"]}
          value={String(roundCount)}
          onChange={(value) => setRoundCount(Number(value))}
        />
        <Segmented
          label="Correction"
          options={["immediate", "submit"]}
          labels={{ immediate: "Immediate", submit: "After submission" }}
          value={mode}
          onChange={(value) => setMode(value as CorrectionMode)}
        />
      </SetupPanel>
    );
  }

  if (results) {
    const weakNames = results.weak.map((id) => termForWord(words.find((word) => word.id === id) ?? { id, term: id, translation: id }));
    return (
      <ResultsPanel
        title="Match results"
        correct={results.correct}
        attempts={results.attempts}
        mistakes={results.attempts - results.correct}
        rounds={roundCount}
        weak={weakNames}
        onBack={onBack}
        backLabel="Finish"
        practiceLabel="Practice weak words"
        onPracticeMistakes={results.weak.length ? () => onPracticeMistakes(results.weak) : undefined}
      />
    );
  }

  return (
    <section className="workout">
      <ExerciseHeader title="Match" onBack={onBack} meta={`Round ${currentRound} of ${roundCount} · ${completed.length}/${roundWords.length} complete`} />
      {advancing && <p className="library-message">Loading next board...</p>}
      <div className="match-board" aria-label="Vocabulary matching columns">
        <div className="match-column">
          <h2>{languageLabel}</h2>
          {left.map((word) => (
            <button
              className={choiceClass(word.id, selectedLeft === word.id, completed.includes(word.id), feedback)}
              disabled={advancing || completed.includes(word.id)}
              key={word.id}
              type="button"
              onClick={() => choose("left", word.id)}
            >
              {termForWord(word)}
            </button>
          ))}
        </div>
        <div className="match-column">
          <h2>Meaning</h2>
          {right.map((word) => {
            const isPaired = Object.values(pairs).includes(word.id);
            return (
              <button
                className={choiceClass(word.id, selectedRight === word.id || isPaired, completed.includes(word.id), feedback)}
                disabled={advancing || completed.includes(word.id)}
                key={word.id}
                type="button"
                onClick={() => choose("right", word.id)}
              >
                {translationForWord(word)}
              </button>
            );
          })}
        </div>
      </div>
      {mode === "submit" && (
        <button className="primary-button" type="button" onClick={submit} disabled={advancing || Object.keys(pairs).length < roundWords.length}>
          Submit
        </button>
      )}
    </section>
  );
}

function TextExerciseView({
  texts,
  practiceIds,
  packageTitle,
  onBack,
  onPracticeMistakes,
  onRecord,
}: {
  texts: TextExercise[];
  practiceIds: string[];
  packageTitle: string;
  onBack: () => void;
  onPracticeMistakes: (ids: string[]) => void;
  onRecord: (kind: PracticeKind, itemId: string, wasCorrect: boolean) => void;
}) {
  const [level, setLevel] = useState<(typeof textLevels)[number]>(1);
  const [mode, setMode] = useState<CorrectionMode>("immediate");
  const [text, setText] = useState<TextExercise | null>(null);
  const [activeBlank, setActiveBlank] = useState<number | null>(null);
  const [selectedWord, setSelectedWord] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [showTranslation, setShowTranslation] = useState(false);
  const [results, setResults] = useState<{ correct: number; attempts: number; weak: string[] } | null>(null);

  const parsed = useMemo(() => (text ? parseText(text, level, practiceIds) : null), [text, level, practiceIds]);
  const wordBank = useMemo(() => (parsed ? stableShuffle(parsed.gaps.map((gap) => gap.answer), text?.id ?? "") : []), [parsed, text?.id]);
  const typedMode = level >= 3;

  function start() {
    const selected = practiceIds.length
      ? texts.find((item) => practiceIds.some((id) => id.startsWith(`${item.id}:`))) ?? texts[0]
      : sampleStable(texts, 1, `text-${Date.now()}-${level}`)[0];
    setText(selected);
    setAnswers({});
    setChecked({});
    setSelectedWord("");
    setActiveBlank(null);
    setShowTranslation(false);
    setResults(null);
  }

  function answerGap(index: number, value: string) {
    const nextAnswers = { ...answers, [index]: value };
    setAnswers(nextAnswers);
    if (mode === "immediate" && parsed) {
      const gap = parsed.gaps.find((item) => item.index === index);
      if (gap && value.trim().length >= gap.answer.length) {
        const correct = normalizeTextAnswer(value) === normalizeTextAnswer(gap.answer);
        setChecked((current) => ({ ...current, [index]: correct }));
      }
    }
  }

  function chooseBlank(index: number) {
    if (selectedWord) {
      answerGap(index, selectedWord);
      setSelectedWord("");
      setActiveBlank(null);
      return;
    }
    setActiveBlank(index);
  }

  function chooseBankWord(word: string) {
    if (activeBlank !== null) {
      answerGap(activeBlank, word);
      setActiveBlank(null);
      setSelectedWord("");
      return;
    }
    setSelectedWord(word);
  }

  function submit() {
    if (!parsed) return;
    let correct = 0;
    const weak: string[] = [];
    const nextChecked: Record<number, boolean> = {};

    parsed.gaps.forEach((gap) => {
      const isCorrect = normalizeTextAnswer(answers[gap.index] ?? "") === normalizeTextAnswer(gap.answer);
      nextChecked[gap.index] = isCorrect;
      if (isCorrect) correct += 1;
      if (!isCorrect) weak.push(gap.key);
      onRecord("text", gap.key, isCorrect);
    });

    setChecked(nextChecked);
    setResults({ correct, attempts: parsed.gaps.length, weak });
  }

  if (!text || !parsed) {
    return (
      <SetupPanel title="Text" onBack={onBack} onStart={start}>
        <p className="setup-package">{packageTitle}</p>
        <Segmented label="Level" options={textLevels.map(String)} value={String(level)} onChange={(value) => setLevel(Number(value) as typeof level)} />
        <Segmented
          label="Correction"
          options={["immediate", "submit"]}
          labels={{ immediate: "Immediate", submit: "After submission" }}
          value={mode}
          onChange={(value) => setMode(value as CorrectionMode)}
        />
      </SetupPanel>
    );
  }

  if (results) {
    return (
      <ResultsPanel
        title="Text results"
        correct={results.correct}
        attempts={results.attempts}
        mistakes={results.attempts - results.correct}
        weak={results.weak.map((id) => id.split(":").slice(1).join(" gap "))}
        onBack={onBack}
        onPracticeMistakes={results.weak.length ? () => onPracticeMistakes(results.weak) : undefined}
      />
    );
  }

  const usedWords = Object.values(answers);

  return (
    <section className="workout">
      <ExerciseHeader title={text.title} onBack={onBack} meta={`Level ${level}`} />
      <article className="text-card" aria-label="Practice passage">
        {parsed.parts.map((part, index) =>
          part.kind === "text" ? (
            <span key={`${part.text}-${index}`}>{part.text}</span>
          ) : typedMode ? (
            <input
              aria-label={`Gap ${part.index + 1}`}
              className={gapClass(checked[part.index])}
              key={part.key}
              value={answers[part.index] ?? ""}
              onChange={(event) => answerGap(part.index, event.target.value)}
            />
          ) : (
            <button
              className={`${gapClass(checked[part.index])} gap-button${activeBlank === part.index ? " is-selected" : ""}`}
              key={part.key}
              type="button"
              onClick={() => chooseBlank(part.index)}
            >
              {answers[part.index] || "______"}
            </button>
          ),
        )}
      </article>

      {!typedMode && (
        <div className="word-bank" aria-label="Word bank">
          {wordBank.map((word) => (
            <button
              className={`bank-word${selectedWord === word ? " is-selected" : ""}`}
              disabled={usedWords.includes(word)}
              key={word}
              type="button"
              onClick={() => chooseBankWord(word)}
            >
              {word}
            </button>
          ))}
        </div>
      )}

      <button className="ghost-button" type="button" onClick={() => setShowTranslation((current) => !current)}>
        {showTranslation ? "Hide translation" : "Show translation"}
      </button>
      {showTranslation && <p className="translation">{text.translation}</p>}

      <button className="primary-button" type="button" onClick={submit}>
        Submit
      </button>
    </section>
  );
}

function FormsExercise({
  forms,
  practiceIds,
  content,
  onBack,
  onPracticeMistakes,
  onRecord,
}: {
  forms: FormExercise[];
  practiceIds: string[];
  content: CoursePackage;
  onBack: () => void;
  onPracticeMistakes: (ids: string[]) => void;
  onRecord: (kind: PracticeKind, itemId: string, wasCorrect: boolean) => void;
}) {
  const [mode, setMode] = useState<EndingMode>("tolerant");
  const [started, setStarted] = useState(false);
  const [queue, setQueue] = useState<FormExercise[]>([]);
  const [current, setCurrent] = useState<FormExercise | null>(null);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState<"right" | "wrong" | "">("");
  const [correct, setCorrect] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [weak, setWeak] = useState<string[]>([]);

  function start() {
    const selected = practiceIds.length
      ? forms.filter((item) => practiceIds.includes(item.id))
      : sampleStable(forms, sessionSize, `forms-${Date.now()}`);
    setCurrent(selected[0] ?? null);
    setQueue(selected.slice(1));
    setStarted(true);
    setAnswer("");
    setMessage("");
    setCorrect(0);
    setAttempts(0);
    setWeak([]);
  }

  function check() {
    if (!current) return;
    const wasCorrect = answerMatches(answer, current.answer, mode === "tolerant", content.metadata.characterSubstitutions);
    setAttempts((value) => value + 1);
    setCorrect((value) => value + (wasCorrect ? 1 : 0));
    setMessage(wasCorrect ? "right" : "wrong");
    setWeak((items) => (wasCorrect || items.includes(current.id) ? items : [...items, current.id]));
    onRecord("forms", current.id, wasCorrect);

    window.setTimeout(() => {
      setQueue((items) => {
        const nextQueue = wasCorrect ? items : insertLater(items, current, 4);
        setCurrent(nextQueue[0] ?? null);
        return nextQueue.slice(1);
      });
      setAnswer("");
      setMessage("");
    }, wasCorrect ? 450 : 850);
  }

  if (!started) {
    return (
      <SetupPanel title="Forms" onBack={onBack} onStart={start}>
        <p className="setup-package">{content.metadata.title}</p>
        <Segmented
          label="Answer mode"
          options={["tolerant", "strict"]}
          labels={{ tolerant: "Tolerant", strict: "Strict" }}
          value={mode}
          onChange={(value) => setMode(value as EndingMode)}
        />
      </SetupPanel>
    );
  }

  if (!current) {
    return (
      <ResultsPanel
        title="Forms results"
        correct={correct}
        attempts={attempts}
        mistakes={attempts - correct}
        weak={weak.map((id) => forms.find((item) => item.id === id)?.result ?? id)}
        onBack={onBack}
        onPracticeMistakes={weak.length ? () => onPracticeMistakes(weak) : undefined}
      />
    );
  }

  return (
    <section className="workout">
      <ExerciseHeader title="Forms" onBack={onBack} meta={`${attempts + 1}/${attempts + queue.length + 1}`} />
      <article className={`ending-card ${message ? `is-${message}` : ""}`}>
        <p className="prompt">{current.prompt}</p>
        <label className="ending-input">
          {formBefore(current) && <span>{formBefore(current)}</span>}
          <input
            aria-label="Missing form"
            autoCapitalize="off"
            autoCorrect="off"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") check();
            }}
          />
          {current.after && <span>{current.after}</span>}
        </label>
        {message === "wrong" && (
          <p className="feedback-line">
            Answer: <strong>{current.answer || "(blank)"}</strong> → {current.result}
          </p>
        )}
        {message === "right" && <p className="feedback-line">Correct: {current.result}</p>}
        <p className="note">
          {current.type}: {current.note}
        </p>
      </article>
      <button className="primary-button" type="button" onClick={check}>
        Check
      </button>
    </section>
  );
}

function ProgressScreen({
  content,
  progress,
  onBack,
  onPractice,
}: {
  content: CoursePackage;
  progress: VerbaProgress;
  onBack: () => void;
  onPractice: (kind: PracticeKind, ids: string[]) => void;
}) {
  const packageId = content.metadata.id;
  const totals = progressTotals(progress, packageId);
  const weakMatch = weakItems(progress, packageId, "match");
  const weakText = weakItems(progress, packageId, "text");
  const weakForms = weakItems(progress, packageId, "forms");

  return (
    <section className="workout">
      <ExerciseHeader title="Progress" onBack={onBack} meta={`${content.metadata.title} · ${totals.attempts} attempts`} />
      <div className="stats-grid">
        <Stat label="Correct" value={String(totals.correct)} />
        <Stat label="Mistakes" value={String(totals.incorrect)} />
        <Stat label="Accuracy" value={`${accuracy(totals.correct, totals.attempts)}%`} />
        <Stat label="Weak" value={String(totals.weak)} />
      </div>
      <WeakPanel
        title="Match"
        ids={weakMatch}
        labelFor={(id) => termForWord(content.words.find((item) => item.id === id) ?? { id, term: id, translation: id })}
        onPractice={() => onPractice("match", weakMatch)}
      />
      <WeakPanel title="Text gaps" ids={weakText} labelFor={(id) => id.replace(":", " gap ")} onPractice={() => onPractice("text", weakText)} />
      <WeakPanel
        title="Forms"
        ids={weakForms}
        labelFor={(id) => content.forms.find((item) => item.id === id)?.result ?? id}
        onPractice={() => onPractice("forms", weakForms)}
      />
    </section>
  );
}

function SetupPanel({
  title,
  children,
  onBack,
  onStart,
}: {
  title: string;
  children: React.ReactNode;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <section className="workout">
      <ExerciseHeader title={title} onBack={onBack} meta="Setup" />
      <div className="panel controls-panel">{children}</div>
      <button className="primary-button" type="button" onClick={onStart}>
        Start
      </button>
    </section>
  );
}

function ExerciseHeader({ title, meta, onBack }: { title: string; meta: string; onBack: () => void }) {
  return (
    <header className="exercise-header">
      <button className="ghost-button compact" type="button" onClick={onBack}>
        Back
      </button>
      <div>
        <h1>{title}</h1>
        <p>{meta}</p>
      </div>
    </header>
  );
}

function Segmented({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  labels?: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field-group">
      <span>{label}</span>
      <span className="segmented">
        {options.map((option) => (
          <button className={value === option ? "is-selected" : ""} key={option} type="button" onClick={() => onChange(option)}>
            {labels?.[option] ?? option}
          </button>
        ))}
      </span>
    </div>
  );
}

function ResultsPanel({
  title,
  correct,
  attempts,
  mistakes,
  rounds,
  weak,
  onBack,
  backLabel = "Back",
  practiceLabel = "Practice mistakes",
  onPracticeMistakes,
}: {
  title: string;
  correct: number;
  attempts: number;
  mistakes: number;
  rounds?: number;
  weak: string[];
  onBack: () => void;
  backLabel?: string;
  practiceLabel?: string;
  onPracticeMistakes?: () => void;
}) {
  return (
    <section className="workout">
      <ExerciseHeader title={title} onBack={onBack} meta={`${accuracy(correct, attempts)}% accuracy`} />
      <div className="stats-grid">
        <Stat label="Correct" value={`${correct}/${attempts}`} />
        <Stat label="Mistakes" value={String(mistakes)} />
        <Stat label="Accuracy" value={`${accuracy(correct, attempts)}%`} />
        {rounds ? <Stat label="Rounds" value={String(rounds)} /> : null}
      </div>
      <div className="panel">
        <h2>{practiceLabel === "Practice weak words" ? "Worth another look" : "Needs repetition"}</h2>
        {weak.length ? <p>{weak.join(", ")}</p> : <p>No weak items in this session.</p>}
      </div>
      <button className="ghost-button" type="button" onClick={onBack}>
        {backLabel}
      </button>
      {onPracticeMistakes && (
        <button className="primary-button" type="button" onClick={onPracticeMistakes}>
          {practiceLabel}
        </button>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WeakPanel({
  title,
  ids,
  labelFor,
  onPractice,
}: {
  title: string;
  ids: string[];
  labelFor: (id: string) => string;
  onPractice: () => void;
}) {
  return (
    <section className="panel weak-panel">
      <div>
        <h2>{title}</h2>
        <p>{ids.length ? ids.slice(0, 8).map(labelFor).join(", ") : "No weak items yet."}</p>
      </div>
      <button className="ghost-button" type="button" onClick={onPractice} disabled={!ids.length}>
        Practice mistakes
      </button>
    </section>
  );
}

function choiceClass(id: string, selected: boolean, done: boolean, feedback: { ids: string[]; state: "right" | "wrong" } | null) {
  const state = feedback?.ids.includes(id) ? ` is-${feedback.state}` : "";
  return `match-choice${selected ? " is-selected" : ""}${done ? " is-complete" : ""}${state}`;
}

function sampleMatchRound(
  words: WordPair[],
  practiceIds: string[],
  pairsPerRound: number,
  currentRound: number,
  weakMap: Record<string, number>,
  seenIds: string[],
  matchProgress: Record<string, ItemProgress>,
  seed: string,
) {
  const pool = practiceIds.length ? words.filter((word) => practiceIds.includes(word.id)) : words;
  const count = Math.min(pairsPerRound, pool.length);
  const seen = new Set(seenIds);
  const salt = `match-round-${currentRound}-${seed}`;
  const weakCount = Math.min(Math.max(1, Math.floor(count / 5)), Math.max(0, count - 1));
  const weakWords = stableShuffle(
    [...pool]
      .filter((word) => (weakMap[word.id] ?? 0) > 0 || itemWeaknessScore(matchProgress[word.id]) > 0)
      .sort((a, b) => matchSelectionWeakness(b.id, weakMap, matchProgress) - matchSelectionWeakness(a.id, weakMap, matchProgress)),
    `weak-${salt}`,
  )
    .sort((a, b) => matchSelectionWeakness(b.id, weakMap, matchProgress) - matchSelectionWeakness(a.id, weakMap, matchProgress))
    .slice(0, weakCount);
  const selected = new Set(weakWords.map((word) => word.id));
  const unseenWords = stableShuffle(
    pool.filter((word) => !selected.has(word.id) && !seen.has(word.id)),
    `unseen-${salt}`,
  );
  const repeatWords = stableShuffle(
    pool.filter((word) => !selected.has(word.id) && seen.has(word.id)),
    `repeat-${salt}`,
  );

  return [...weakWords, ...unseenWords, ...repeatWords].slice(0, count);
}

function matchSelectionWeakness(id: string, sessionWeak: Record<string, number>, matchProgress: Record<string, ItemProgress>) {
  return (sessionWeak[id] ?? 0) * 2 + itemWeaknessScore(matchProgress[id]);
}

function matchRoundWeaknessSignal(wasCorrect: boolean, rank: number, total: number) {
  if (!wasCorrect) return 4;
  if (total <= 1) return 0;
  if (rank === total) return 1.5;
  const position = (rank - 1) / (total - 1);
  if (position >= 0.67) return 0.75;
  return 0;
}

type TextPart =
  | { kind: "text"; text: string }
  | { kind: "gap"; key: string; index: number; answer: string };

function parseText(text: TextExercise, level: number, practiceIds: string[]) {
  const parts: TextPart[] = [];
  const gaps: Extract<TextPart, { kind: "gap" }>[] = [];
  const regex = /\{([^}]+)\}/g;
  let cursor = 0;
  let gapIndex = 0;
  let match: RegExpExecArray | null;

  const allAnswers = [...text.text.matchAll(regex)].map((item, index) => ({
    id: `${text.id}:${index}`,
    index,
    answer: item[1],
    key: `${text.id}:${index}`,
  }));
  const ratio = level === 5 ? 1 : level === 2 || level === 4 ? 0.65 : 0.4;
  const desired = Math.max(1, Math.ceil(allAnswers.length * ratio));
  const selectedKeys = new Set(
    practiceIds.length
      ? practiceIds.filter((id) => id.startsWith(`${text.id}:`))
      : stableShuffle(allAnswers, `${text.id}-${level}`).slice(0, desired).map((gap) => gap.key),
  );

  while ((match = regex.exec(text.text))) {
    if (match.index > cursor) parts.push({ kind: "text", text: text.text.slice(cursor, match.index) });
    const answer = match[1];
    const key = `${text.id}:${gapIndex}`;
    if (selectedKeys.has(key)) {
      const gap = { kind: "gap" as const, key, index: gapIndex, answer };
      parts.push(gap);
      gaps.push(gap);
    } else {
      parts.push({ kind: "text", text: answer });
    }
    cursor = match.index + match[0].length;
    gapIndex += 1;
  }

  if (cursor < text.text.length) parts.push({ kind: "text", text: text.text.slice(cursor) });
  return { parts, gaps };
}

function normalizeTextAnswer(value: string) {
  return value.trim().toLocaleLowerCase();
}

function gapClass(state: boolean | undefined) {
  return `gap-input${state === true ? " is-right" : ""}${state === false ? " is-wrong" : ""}`;
}

function groupCatalog(items: PackageCatalogItem[]) {
  const groups = new Map<string, PackageCatalogItem[]>();
  items.forEach((item) => {
    const name = item.variant === "General" ? item.language : `${item.variant} ${item.language}`;
    groups.set(name, [...(groups.get(name) ?? []), item]);
  });
  return Array.from(groups, ([name, groupItems]) => ({
    name,
    items: groupItems.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title)),
  }));
}

function packageDisplayName(item: PackageCatalogItem) {
  return item.variant === "General" ? item.language : `${item.variant} ${item.language}`;
}

function packageStageName(item: PackageCatalogItem) {
  return item.title.split(" · ")[1] ?? item.variant;
}

function sortPackages(packages: CoursePackage[], catalog: PackageCatalog) {
  const order = new Map(catalog.packages.map((item, index) => [item.id, index]));
  return [...packages].sort((a, b) => (order.get(a.metadata.id) ?? 9999) - (order.get(b.metadata.id) ?? 9999));
}

async function refreshOutdatedInstalledPackages(catalog: PackageCatalog, installed: CoursePackage[]) {
  const catalogById = new Map(catalog.packages.map((item) => [item.id, item]));
  const updates = installed
    .map((coursePackage) => {
      const catalogItem = catalogById.get(coursePackage.metadata.id);
      return catalogItem && catalogItem.version > coursePackage.metadata.version ? catalogItem : null;
    })
    .filter((item): item is PackageCatalogItem => Boolean(item));

  if (!updates.length) return installed;

  await Promise.all(updates.map((item) => downloadPackage(item)));
  return readInstalledPackages();
}
