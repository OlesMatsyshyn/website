"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { withBasePath } from "@/lib/deployment";
import {
  appendCustomContent,
  createLocalPackage,
  deleteLocalPackage,
  downloadPackage,
  formBefore,
  loadCatalog,
  mergeCustomContent,
  readActivePackageId,
  readAllCustomContent,
  readInstalledPackages,
  removeInstalledPackage,
  saveActivePackageId,
  saveCustomContent,
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
  recordChooseAttempt,
  recordTranslateAttempt,
  saveProgress,
  weakItems,
  itemWeaknessScore,
  type ItemProgress,
  type PracticeKind,
  type TranslateDirectionKey,
  type VerbaProgress,
} from "@/lib/progress";
import type {
  AnthemReference,
  CharacterSubstitutions,
  CivicReference,
  CorrectionMode,
  CoursePackage,
  EndingMode,
  FormExercise,
  PackageCatalog,
  PackageCatalogItem,
  TextExercise,
  WordPair,
  CustomPackageContent,
  WordSet,
} from "@/lib/types";

type Screen = "home" | "words" | "match" | "choose" | "translate" | "text" | "forms" | "progress" | "library" | "reference" | "anthem" | "manage-local";
type ImportKind = "words" | "texts" | "forms";
type TranslateDirection = "term-to-translation" | "translation-to-term" | "mixed";

const pairOptions = [3, 5, 10, 20];
const translateQuestionOptions = [5, 10, 20, 50];
const textLevels = [1, 2, 3, 4, 5] as const;
const sessionSize = 10;

export function VerbaApp() {
  const [catalog, setCatalog] = useState<PackageCatalog | null>(null);
  const [installed, setInstalled] = useState<CoursePackage[]>([]);
  const [customContent, setCustomContent] = useState<Record<string, CustomPackageContent>>({});
  const [activePackageId, setActivePackageId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [screen, setScreen] = useState<Screen>("home");
  const [progress, setProgress] = useState<VerbaProgress>(() => emptyProgress());
  const [practice, setPractice] = useState<{ kind: PracticeKind; ids: string[] } | null>(null);
  const [requestedPackageId, setRequestedPackageId] = useState("");
  const [busyPackageId, setBusyPackageId] = useState("");
  const [libraryMessage, setLibraryMessage] = useState("");
  const [homeToast, setHomeToast] = useState("");
  const [importKind, setImportKind] = useState<ImportKind | null>(null);
  const [managePackageId, setManagePackageId] = useState("");
  const homeToastTimeout = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function start() {
      try {
        const requested = new URLSearchParams(window.location.search).get("package") ?? "";
        const [nextCatalog, storedInstalled, storedCustom] = await Promise.all([loadCatalog(), readInstalledPackages(), readAllCustomContent()]);
        const nextInstalled = await refreshOutdatedInstalledPackages(nextCatalog, storedInstalled);
        if (!mounted) return;

        setCatalog(nextCatalog);
        setInstalled(sortPackages(nextInstalled, nextCatalog));
        setCustomContent(storedCustom);
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
    if (process.env.NODE_ENV !== "production" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(withBasePath("/sw.js"), { scope: withBasePath("/") }).catch(() => {
      // Service worker support is helpful, but the app should still work online without it.
    });
  }, []);

  useEffect(() => {
    return () => {
      if (homeToastTimeout.current) window.clearTimeout(homeToastTimeout.current);
    };
  }, []);

  const baseActivePackage = installed.find((item) => item.metadata.id === activePackageId) ?? null;
  const activePackage = baseActivePackage ? mergeCustomContent(baseActivePackage, customContent[baseActivePackage.metadata.id]) : null;
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

  function recordChoose(itemId: string, wasCorrect: boolean) {
    if (!activePackage) return;
    setProgress((current) => {
      const next = recordChooseAttempt(current, activePackage.metadata.id, itemId, wasCorrect);
      saveProgress(next);
      return next;
    });
  }

  function recordTranslate(itemId: string, wasCorrect: boolean, wasExact: boolean, direction: TranslateDirectionKey) {
    if (!activePackage) return;
    setProgress((current) => {
      const next = recordTranslateAttempt(current, activePackage.metadata.id, itemId, wasCorrect, wasExact, direction);
      saveProgress(next);
      return next;
    });
  }

  function goHome() {
    setPractice(null);
    setScreen("home");
  }

  function showHomeToast(message: string) {
    setHomeToast(message);
    if (homeToastTimeout.current) window.clearTimeout(homeToastTimeout.current);
    homeToastTimeout.current = window.setTimeout(() => setHomeToast(""), 2000);
  }

  async function refreshInstalled(nextCatalog = catalog) {
    const [nextInstalled, nextCustom] = await Promise.all([readInstalledPackages(), readAllCustomContent()]);
    const sorted = nextCatalog ? sortPackages(nextInstalled, nextCatalog) : nextInstalled;
    setInstalled(sorted);
    setCustomContent(nextCustom);
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
    const selected = installed.find((item) => item.metadata.id === packageId);
    setLibraryMessage("");
    setScreen("home");
    showHomeToast(`Using ${packageToastLabel(selected)}`);
  }

  async function createUserPackage(options: { title: string; language?: string; languageCode?: string; variant?: string }) {
    setLibraryMessage("");
    try {
      const coursePackage = await createLocalPackage(options.title, options.language || options.title, options.languageCode || "local", options.variant || "Local");
      const nextInstalled = await refreshInstalled();
      const selected = nextInstalled.find((item) => item.metadata.id === coursePackage.metadata.id) ?? coursePackage;
      setActivePackageId(selected.metadata.id);
      saveActivePackageId(selected.metadata.id);
      setLibraryMessage(`${selected.metadata.title} created and selected.`);
    } catch (error) {
      setLibraryMessage(error instanceof Error ? error.message : "Local package could not be created.");
    }
  }

  async function deleteUserPackage(packageId: string) {
    const target = installed.find((item) => item.metadata.id === packageId);
    if (!target || target.metadata.source !== "local") return;
    if (!window.confirm(`Delete local package "${target.metadata.title}" and its local content?`)) return;
    await deleteLocalPackage(packageId);
    const nextInstalled = await refreshInstalled();
    if (activePackageId === packageId) {
      const nextActive = nextInstalled[0]?.metadata.id ?? "";
      setActivePackageId(nextActive);
      saveActivePackageId(nextActive);
    }
    setLibraryMessage("Local package deleted.");
  }

  async function importCustomEntries(kind: ImportKind, raw: string) {
    if (!activePackage) return { added: 0, duplicates: 0, ignored: 0 };
    const parsed = parseImport(kind, raw, activePackage, customContent[activePackage.metadata.id]);
    if (parsed.added > 0) {
      const additions = kind === "words" ? { words: parsed.words, wordSets: parsed.wordSets } : kind === "texts" ? { texts: parsed.texts } : { forms: parsed.forms };
      await appendCustomContent(activePackage.metadata.id, additions);
      await refreshInstalled();
    }
    return { added: parsed.added, duplicates: parsed.duplicates, ignored: parsed.ignored };
  }

  function manageLocalContent(packageId: string) {
    setManagePackageId(packageId);
    setScreen("manage-local");
  }

  async function updateCustomPackageContent(packageId: string, content: CustomPackageContent) {
    await saveCustomContent(content);
    setCustomContent(await readAllCustomContent());
  }

  return (
    <main className="app-shell">
      {homeToast && (
        <div className="toast" role="status" aria-live="polite">
          {homeToast}
        </div>
      )}
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
          onCreateLocal={createUserPackage}
          onDeleteLocal={deleteUserPackage}
          customContent={customContent}
          onManageLocal={manageLocalContent}
        />
      )}

      {catalog && screen === "manage-local" && (
        <ManageLocalContentScreen
          packageId={managePackageId || activePackageId}
          installed={installed}
          customContent={customContent}
          onBack={() => setScreen("library")}
          onSave={updateCustomPackageContent}
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

      {activePackage && screen === "words" && (
        <WordsScreen
          packageTitle={activePackage.metadata.title}
          wordCount={activePackage.words.length}
          wordSets={customContent[activePackage.metadata.id]?.wordSets ?? []}
          onBack={goHome}
          onMatch={() => {
            setPractice(null);
            setScreen("match");
          }}
          onChoose={() => {
            setPractice(null);
            setScreen("choose");
          }}
          onTranslate={() => {
            setPractice(null);
            setScreen("translate");
          }}
          onAddContent={() => setImportKind("words")}
        />
      )}

      {activePackage && screen === "match" && (
        <MatchExercise
          key={`${activePackage.metadata.id}-match-${practice?.kind === "match" ? practice.ids.join("-") : "fresh"}`}
          packageTitle={activePackage.metadata.title}
          practiceIds={practice?.kind === "match" ? practice.ids : []}
          words={activePackage.words}
          wordSets={customContent[activePackage.metadata.id]?.wordSets ?? []}
          languageLabel={activePackage.metadata.language}
          matchProgress={progress.packages[activePackage.metadata.id]?.match ?? {}}
          chooseProgress={progress.packages[activePackage.metadata.id]?.choose ?? {}}
          translateProgress={progress.packages[activePackage.metadata.id]?.translate ?? {}}
          onBack={goHome}
          onPracticeMistakes={(ids) => setPractice({ kind: "match", ids })}
          onRecordMatch={recordMatch}
          onAddContent={() => setImportKind("words")}
        />
      )}

      {activePackage && screen === "choose" && (
        <ChooseExercise
          key={`${activePackage.metadata.id}-choose-${practice?.kind === "choose" ? practice.ids.join("-") : "fresh"}`}
          content={activePackage}
          wordSets={customContent[activePackage.metadata.id]?.wordSets ?? []}
          practiceIds={practice?.kind === "choose" ? practice.ids : []}
          chooseProgress={progress.packages[activePackage.metadata.id]?.choose ?? {}}
          translateProgress={progress.packages[activePackage.metadata.id]?.translate ?? {}}
          matchProgress={progress.packages[activePackage.metadata.id]?.match ?? {}}
          onBack={goHome}
          onPracticeMistakes={(ids) => setPractice({ kind: "choose", ids })}
          onRecordChoose={recordChoose}
          onAddContent={() => setImportKind("words")}
        />
      )}

      {activePackage && screen === "translate" && (
        <TranslateExercise
          key={`${activePackage.metadata.id}-translate-${practice?.kind === "translate" ? practice.ids.join("-") : "fresh"}`}
          content={activePackage}
          wordSets={customContent[activePackage.metadata.id]?.wordSets ?? []}
          practiceIds={practice?.kind === "translate" ? practice.ids : []}
          translateProgress={progress.packages[activePackage.metadata.id]?.translate ?? {}}
          matchProgress={progress.packages[activePackage.metadata.id]?.match ?? {}}
          chooseProgress={progress.packages[activePackage.metadata.id]?.choose ?? {}}
          onBack={goHome}
          onPracticeMistakes={(ids) => setPractice({ kind: "translate", ids })}
          onRecordTranslate={recordTranslate}
          onAddContent={() => setImportKind("words")}
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
          onAddContent={() => setImportKind("texts")}
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
          onAddContent={() => setImportKind("forms")}
        />
      )}

      {importKind && activePackage && (
        <ImportDialog
          kind={importKind}
          activePackage={activePackage}
          onCancel={() => setImportKind(null)}
          onImport={async (raw) => importCustomEntries(importKind, raw)}
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
        <button className="exercise-card primary-card" type="button" onClick={() => onOpen("words")}>
          <span>Words</span>
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

function WordsScreen({
  packageTitle,
  wordCount,
  wordSets,
  onBack,
  onMatch,
  onChoose,
  onTranslate,
  onAddContent,
}: {
  packageTitle: string;
  wordCount: number;
  wordSets: WordSet[];
  onBack: () => void;
  onMatch: () => void;
  onChoose: () => void;
  onTranslate: () => void;
  onAddContent: () => void;
}) {
  return (
    <section className="workout">
      <ExerciseHeader title="Words" onBack={onBack} meta={packageTitle} />
      {wordSets.length > 0 && <p className="setup-help">{wordSets.length} named word {wordSets.length === 1 ? "set" : "sets"} available.</p>}
      <div className="vocabulary-mode-grid">
        <button className="exercise-card primary-card compact-mode-card" type="button" onClick={onMatch} disabled={!wordCount}>
          <span>Match</span>
          <small>Match vocabulary pairs.</small>
        </button>
        <button className="exercise-card cool-card compact-mode-card" type="button" onClick={onChoose} disabled={!wordCount}>
          <span>Choose</span>
          <small>Pick the correct translation.</small>
        </button>
        <button className="exercise-card warm-card compact-mode-card" type="button" onClick={onTranslate} disabled={!wordCount}>
          <span>Translate</span>
          <small>Type the other side from memory.</small>
        </button>
      </div>
      {!wordCount && <p className="setup-help">No vocabulary yet. Add words manually to start practicing this package.</p>}
      <button className="ghost-button setup-secondary-action" type="button" onClick={onAddContent}>
        Add words manually
      </button>
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

function packageToastLabel(coursePackage: CoursePackage | undefined) {
  if (!coursePackage) return "package";
  return coursePackage.metadata.title.replace(/\s*·\s*Starter$/u, "");
}

function LibraryScreen({
  catalog,
  installed,
  activePackageId,
  requestedPackageId,
  busyPackageId,
  message,
  customContent,
  onBack,
  onInstall,
  onRemove,
  onUse,
  onCreateLocal,
  onDeleteLocal,
  onManageLocal,
}: {
  catalog: PackageCatalog;
  installed: CoursePackage[];
  activePackageId: string;
  requestedPackageId: string;
  busyPackageId: string;
  message: string;
  customContent: Record<string, CustomPackageContent>;
  onBack: () => void;
  onInstall: (item: PackageCatalogItem) => void;
  onRemove: (packageId: string) => void;
  onUse: (packageId: string) => void;
  onCreateLocal: (options: { title: string; language?: string; languageCode?: string; variant?: string }) => void;
  onDeleteLocal: (packageId: string) => void;
  onManageLocal: (packageId: string) => void;
}) {
  const installedIds = new Set(installed.map((item) => item.metadata.id));
  const groups = groupCatalog(catalog.packages);
  const localPackages = installed.filter((item) => item.metadata.source === "local");
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [languageCode, setLanguageCode] = useState("");

  return (
    <section className="workout">
      <ExerciseHeader title="Library" onBack={onBack} meta={`${installed.length} installed`} />
      {requestedPackageId && <p className="library-message">Requested package: {catalog.packages.find((item) => item.id === requestedPackageId)?.title ?? requestedPackageId}</p>}
      {message && <p className="library-message">{message}</p>}
      <section className="panel local-package-panel">
        <div>
          <h2>Local packages</h2>
          <p className="setup-help">Create an empty package and fill it with your own words, texts, and forms on this device.</p>
        </div>
        {!isCreating ? (
          <button className="ghost-button compact" type="button" onClick={() => setIsCreating(true)}>
            New local package
          </button>
        ) : (
          <form
            className="local-package-form"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmedTitle = title.trim();
              if (!trimmedTitle) return;
              onCreateLocal({ title: trimmedTitle, languageCode: languageCode.trim() || "local" });
              setTitle("");
              setLanguageCode("");
              setIsCreating(false);
            }}
          >
            <label>
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="My Norwegian" />
            </label>
            <label>
              <span>Language/code optional</span>
              <input value={languageCode} onChange={(event) => setLanguageCode(event.target.value)} placeholder="nb, de, custom" />
            </label>
            <div className="package-actions">
              <button className="primary-button compact-button" type="submit" disabled={!title.trim()}>
                Create
              </button>
              <button className="ghost-button compact" type="button" onClick={() => setIsCreating(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
      {localPackages.length > 0 && (
        <section className="panel package-group">
          <h2>On this device</h2>
          <div className="package-list">
            {localPackages.map((coursePackage) => {
              const local = customCounts(customContent[coursePackage.metadata.id]);
              const isActive = activePackageId === coursePackage.metadata.id;
              return (
                <article className="package-card" key={coursePackage.metadata.id}>
                  <div>
                    <h3>{coursePackage.metadata.title}</h3>
                    <p className="package-stage">Local package</p>
                    <p className="package-level">{countLine(local.words, local.texts, local.forms)}</p>
                  </div>
                  <div className="package-actions">
                    <span className="installed-label">{isActive ? "Active" : "Local"}</span>
                    <button className="ghost-button compact" type="button" onClick={() => onUse(coursePackage.metadata.id)}>
                      Use
                    </button>
                    <button className="ghost-button compact" type="button" onClick={() => onManageLocal(coursePackage.metadata.id)}>
                      Manage local content
                    </button>
                    <button className="ghost-button compact" type="button" onClick={() => onDeleteLocal(coursePackage.metadata.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <div className="library-groups">
        {groups.map((group) => (
          <section className="panel package-group" key={group.name}>
            <h2>{group.name}</h2>
            <div className="package-list">
              {group.items.map((item) => {
                const isInstalled = installedIds.has(item.id);
                const isActive = activePackageId === item.id;
                const isRequested = requestedPackageId === item.id;
                const local = customCounts(customContent[item.id]);
                return (
                  <article className={`package-card${isRequested ? " is-requested" : ""}`} key={item.id}>
                    <div>
                      <h3>{packageDisplayName(item)}</h3>
                      <p className="package-stage">{packageStageName(item)}</p>
                      <p className="package-level">
                        {item.wordCount} words · {item.textCount} texts · {item.formCount} forms
                      </p>
                      {local.total > 0 && <p className="package-local-count">+ {countLine(local.words, local.texts, local.forms, local.wordSets)} local</p>}
                    </div>
                    <div className="package-actions">
                      {isInstalled ? (
                        <>
                          <span className="installed-label">{isActive ? "Active" : "Installed"}</span>
                          <button className="ghost-button compact" type="button" onClick={() => onUse(item.id)}>
                            Use
                          </button>
                          <button className="ghost-button compact" type="button" onClick={() => onRemove(item.id)} disabled={busyPackageId === item.id}>
                            Remove
                          </button>
                          <button className="ghost-button compact" type="button" onClick={() => onManageLocal(item.id)}>
                            Manage local content
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

function ManageLocalContentScreen({
  packageId,
  installed,
  customContent,
  onBack,
  onSave,
}: {
  packageId: string;
  installed: CoursePackage[];
  customContent: Record<string, CustomPackageContent>;
  onBack: () => void;
  onSave: (packageId: string, content: CustomPackageContent) => void;
}) {
  const coursePackage = installed.find((item) => item.metadata.id === packageId);
  const content = customContent[packageId] ?? { packageId, words: [], texts: [], forms: [], wordSets: [] };
  const words = [...(coursePackage?.words ?? []), ...content.words];

  function removeEntry(kind: ImportKind, id: string) {
    const nextWordSets = kind === "words" ? content.wordSets.map((set) => ({ ...set, wordIds: set.wordIds.filter((wordId) => wordId !== id) })) : content.wordSets;
    const next = {
      ...content,
      [kind]: content[kind].filter((item) => item.id !== id),
      wordSets: nextWordSets,
    };
    onSave(packageId, next);
  }

  function clearKind(kind: ImportKind) {
    const count = content[kind].length;
    if (!count) return;
    if (!window.confirm(`Remove ${count} local ${kind} from "${coursePackage?.metadata.title ?? "this package"}"?`)) return;
    const removedWordIds = kind === "words" ? new Set(content.words.map((word) => word.id)) : new Set<string>();
    const nextWordSets = kind === "words" ? content.wordSets.map((set) => ({ ...set, wordIds: set.wordIds.filter((wordId) => !removedWordIds.has(wordId)) })) : content.wordSets;
    onSave(packageId, { ...content, [kind]: [], wordSets: nextWordSets });
  }

  return (
    <section className="workout">
      <ExerciseHeader title="Manage local content" onBack={onBack} meta={coursePackage?.metadata.title ?? "Local additions"} />
      <LocalContentSection
        title="Words"
        items={content.words}
        labelFor={(item) => `${termForWord(item)} — ${translationForWord(item)}`}
        onRemove={(id) => removeEntry("words", id)}
        onClear={() => clearKind("words")}
      />
      <WordSetsSection
        packageId={packageId}
        words={words}
        wordSets={content.wordSets}
        onChange={(wordSets) => onSave(packageId, { ...content, wordSets })}
      />
      <LocalContentSection
        title="Texts"
        items={content.texts}
        labelFor={(item) => item.title || item.text.slice(0, 70)}
        onRemove={(id) => removeEntry("texts", id)}
        onClear={() => clearKind("texts")}
      />
      <LocalContentSection
        title="Forms"
        items={content.forms}
        labelFor={(item) => `${item.prompt} — ${formBefore(item)}[${item.answer}]${item.after}`}
        onRemove={(id) => removeEntry("forms", id)}
        onClear={() => clearKind("forms")}
      />
    </section>
  );
}

function WordSetsSection({
  packageId,
  words,
  wordSets,
  onChange,
}: {
  packageId: string;
  words: WordPair[];
  wordSets: WordSet[];
  onChange: (wordSets: WordSet[]) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const namedMemberships = new Set(wordSets.flatMap((set) => set.wordIds));
  const generalCount = words.filter((word) => word.custom && !namedMemberships.has(word.id)).length;
  const editingSet = wordSets.find((set) => set.id === editingId) ?? null;
  const filteredWords = words.filter((word) => normalizeDuplicateKey(termForWord(word), translationForWord(word)).includes(search.trim().toLocaleLowerCase())).slice(0, 150);

  function createSet() {
    const title = newTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    onChange([...wordSets, { id: localId("set"), packageId, title, wordIds: [], createdAt: now, updatedAt: now }]);
    setNewTitle("");
  }

  function renameSet(set: WordSet) {
    const title = window.prompt("Rename word set", set.title)?.trim();
    if (!title) return;
    onChange(wordSets.map((item) => (item.id === set.id ? { ...item, title, updatedAt: new Date().toISOString() } : item)));
  }

  function deleteSet(set: WordSet) {
    if (!window.confirm(`Delete "${set.title}"? Vocabulary words will stay in the package.`)) return;
    onChange(wordSets.filter((item) => item.id !== set.id));
    if (editingId === set.id) setEditingId("");
  }

  function toggleWord(wordId: string, checked: boolean) {
    if (!editingSet) return;
    const nextIds = checked ? Array.from(new Set([...editingSet.wordIds, wordId])) : editingSet.wordIds.filter((id) => id !== wordId);
    onChange(wordSets.map((set) => (set.id === editingSet.id ? { ...set, wordIds: nextIds, updatedAt: new Date().toISOString() } : set)));
  }

  return (
    <section className="panel local-content-section">
      <div className="local-content-heading">
        <div>
          <h2>Word sets</h2>
          <p className="setup-help">Sets organize vocabulary by ID. Deleting a set does not delete words.</p>
        </div>
      </div>
      <div className="word-set-summary">
        <div><strong>All words</strong><span>{words.length}</span></div>
        {generalCount > 0 && <div><strong>General</strong><span>{generalCount}</span></div>}
        {wordSets.map((set) => (
          <article className="word-set-row" key={set.id}>
            <button className="ghost-button compact" type="button" onClick={() => setEditingId(set.id)}>
              {set.title} · {validSetWordIds(set, words).length}
            </button>
            <button className="ghost-button compact" type="button" onClick={() => renameSet(set)}>
              Rename
            </button>
            <button className="ghost-button compact" type="button" onClick={() => deleteSet(set)}>
              Delete
            </button>
          </article>
        ))}
      </div>
      <div className="word-set-create">
        <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="New word set title" />
        <button className="ghost-button compact" type="button" onClick={createSet} disabled={!newTitle.trim()}>
          New word set
        </button>
      </div>
      {editingSet && (
        <div className="word-set-editor">
          <div className="local-content-heading">
            <div>
              <h3>{editingSet.title}</h3>
              <p className="setup-help">{validSetWordIds(editingSet, words).length} selected</p>
            </div>
            <button className="ghost-button compact" type="button" onClick={() => setEditingId("")}>
              Done
            </button>
          </div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search words" />
          <div className="word-checkbox-list">
            {filteredWords.map((word) => (
              <label className="word-checkbox-row" key={word.id}>
                <input type="checkbox" checked={editingSet.wordIds.includes(word.id)} onChange={(event) => toggleWord(word.id, event.target.checked)} />
                <span>
                  <strong>{termForWord(word)}</strong>
                  <small>{translationForWord(word)}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function LocalContentSection<T extends { id: string }>({
  title,
  items,
  labelFor,
  onRemove,
  onClear,
}: {
  title: string;
  items: T[];
  labelFor: (item: T) => string;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <section className="panel local-content-section">
      <div className="local-content-heading">
        <div>
          <h2>{title}</h2>
          <p className="setup-help">{items.length} local {items.length === 1 ? "entry" : "entries"}</p>
        </div>
        <button className="ghost-button compact" type="button" onClick={onClear} disabled={!items.length}>
          Clear local {title.toLocaleLowerCase()}
        </button>
      </div>
      {items.length ? (
        <div className="local-entry-list">
          {items.map((item) => (
            <article className="local-entry" key={item.id}>
              <span>{labelFor(item)}</span>
              <button className="ghost-button compact" type="button" onClick={() => onRemove(item.id)}>
                Remove
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="setup-help">No local {title.toLocaleLowerCase()} added yet.</p>
      )}
    </section>
  );
}

function ImportDialog({
  kind,
  activePackage,
  onCancel,
  onImport,
}: {
  kind: ImportKind;
  activePackage: CoursePackage;
  onCancel: () => void;
  onImport: (raw: string) => Promise<{ added: number; duplicates: number; ignored: number }>;
}) {
  const [raw, setRaw] = useState("");
  const [showExamples, setShowExamples] = useState(false);
  const [summary, setSummary] = useState("");
  const [clipboardMessage, setClipboardMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messageTimeout = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (messageTimeout.current) window.clearTimeout(messageTimeout.current);
    };
  }, []);

  async function submit() {
    setIsImporting(true);
    try {
      const result = await onImport(raw);
      setSummary(`${result.added} added · ${result.duplicates} duplicates · ${result.ignored} ignored`);
      if (result.added > 0) setRaw("");
    } finally {
      setIsImporting(false);
    }
  }

  function showClipboardMessage(message: string) {
    setClipboardMessage(message);
    if (messageTimeout.current) window.clearTimeout(messageTimeout.current);
    messageTimeout.current = window.setTimeout(() => setClipboardMessage(""), 1600);
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(importTemplate(kind, activePackage));
      showClipboardMessage("Copied");
    } catch {
      showClipboardMessage("Clipboard access was blocked. Select the template text and copy it manually.");
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        showClipboardMessage("Clipboard is empty. Copy some text, then try again.");
        window.setTimeout(() => textareaRef.current?.focus(), 0);
        return;
      }
      setRaw(text);
      showClipboardMessage("Pasted");
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    } catch {
      showClipboardMessage("Clipboard access was blocked. Click the text box and press Ctrl+V.");
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="import-dialog" role="dialog" aria-modal="true" aria-label={`Add ${kind} manually`}>
        <header className="import-header">
          <div>
            <p className="eyebrow">{activePackage.metadata.title}</p>
            <h2>Add {kind} manually</h2>
          </div>
          <button className="ghost-button compact" type="button" onClick={onCancel}>
            Cancel
          </button>
        </header>
        <p className="setup-help">{importHelp(kind)}</p>
        <div className="import-helper-actions">
          <button className="ghost-button compact examples-toggle" type="button" onClick={() => setShowExamples((value) => !value)}>
            {showExamples ? "Hide examples" : "Show format"}
          </button>
          <button className="ghost-button compact" type="button" onClick={copyTemplate}>
            Copy template
          </button>
          <button className="ghost-button compact" type="button" onClick={pasteFromClipboard}>
            Paste from clipboard
          </button>
        </div>
        {showExamples && <pre className="format-example">{importExample(kind)}</pre>}
        <textarea
          ref={textareaRef}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && raw.trim() && !isImporting) {
              event.preventDefault();
              void submit();
            }
          }}
          rows={10}
          spellCheck={false}
        />
        {clipboardMessage && <p className="library-message">{clipboardMessage}</p>}
        {summary && <p className="library-message">{summary}</p>}
        <button className="primary-button" type="button" onClick={submit} disabled={!raw.trim() || isImporting}>
          {isImporting ? "Importing" : "Import"}
        </button>
      </section>
    </div>
  );
}

function MatchExercise({
  words,
  wordSets,
  practiceIds,
  packageTitle,
  languageLabel,
  matchProgress,
  chooseProgress,
  translateProgress,
  onBack,
  onAddContent,
  onPracticeMistakes,
  onRecordMatch,
}: {
  words: WordPair[];
  wordSets: WordSet[];
  practiceIds: string[];
  packageTitle: string;
  languageLabel: string;
  matchProgress: Record<string, ItemProgress>;
  chooseProgress: Record<string, ItemProgress>;
  translateProgress: Record<string, ItemProgress>;
  onBack: () => void;
  onAddContent: () => void;
  onPracticeMistakes: (ids: string[]) => void;
  onRecordMatch: (itemId: string, wasCorrect: boolean, rank: number, total: number) => void;
}) {
  const [wordPoolId, setWordPoolId] = useState(practiceIds.length ? "weak" : "all");
  const poolOptions = wordPoolOptions(words, wordSets, practiceIds);
  const poolWords = wordsForPool(words, wordSets, wordPoolId, practiceIds);
  const [pairsPerRound, setPairsPerRound] = useState(practiceIds.length || Math.min(5, Math.max(1, poolWords.length)));
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
  const currentPairsPerRound = Math.min(pairsPerRound, Math.max(1, poolWords.length));

  function start() {
    const selectedWords = wordsForPool(words, wordSets, wordPoolId, practiceIds);
    setStarted(true);
    setCumulativeCorrect(0);
    setCumulativeMistakes(0);
    setSessionWeak({});
    setSeenIds([]);
    setResults(null);
    beginRound(1, {}, [], selectedWords);
  }

  function beginRound(roundNumber: number, weakMap = sessionWeak, alreadySeen = seenIds, availableWords = poolWords) {
    shuffleSeedRef.current += 1;
    const shuffleSalt = `${roundNumber}-${shuffleSeedRef.current}`;
    const selected = sampleMatchRound(availableWords, [], currentPairsPerRound, roundNumber, weakMap, alreadySeen, matchProgress, chooseProgress, translateProgress, shuffleSalt);
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
        setResults({
          correct: nextCorrect,
          attempts: nextCorrect + nextMistakes,
          weak: selectWeakVocabularyIds(poolWords, nextWeak, translateProgress, matchProgress, chooseProgress, Math.max(5, Math.min(20, roundWords.length * roundCount))),
        });
        setAdvancing(false);
        return;
      }
      beginRound(currentRound + 1, nextWeak, seenIds, poolWords);
    }, 600);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => setFeedback(null), feedback?.state === "wrong" ? 750 : 650);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  if (!started) {
    return (
      <SetupPanel title="Match" onBack={onBack} onStart={start} startDisabled={!poolWords.length}>
        <p className="setup-package">{packageTitle}</p>
        <WordPoolSelect
          value={wordPoolId}
          options={poolOptions}
          onChange={(value) => {
            const nextWords = wordsForPool(words, wordSets, value, practiceIds);
            setWordPoolId(value);
            if (nextWords.length > 0 && pairsPerRound > nextWords.length) setPairsPerRound(nextWords.length);
          }}
        />
        <Segmented
          label="Words per round"
          options={matchPairOptions(poolWords.length).map(String)}
          value={String(currentPairsPerRound)}
          onChange={(value) => setPairsPerRound(Number(value))}
        />
        <p className="setup-help">Number of matching pairs visible on one board.</p>
        <Segmented
          label="Rounds"
          options={["5", "10", "20"]}
          value={String(roundCount)}
          onChange={(value) => setRoundCount(Number(value))}
        />
        <p className="setup-help">{currentPairsPerRound} pairs per board · {roundCount} boards in this session.</p>
        <Segmented
          label="Correction"
          options={["immediate", "submit"]}
          labels={{ immediate: "Immediate", submit: "After submission" }}
          value={mode}
          onChange={(value) => setMode(value as CorrectionMode)}
        />
        <p className="setup-help">{mode === "immediate" ? "Check each match as you make it." : "Complete the board first, then check all matches."}</p>
        {!poolWords.length && <p className="setup-help">No vocabulary in this pool yet.</p>}
        <button className="ghost-button setup-secondary-action" type="button" onClick={onAddContent}>
          Add words manually
        </button>
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
        tryMoreLabel="Try more"
        onTryMore={() => {
          setStarted(false);
          setResults(null);
          setAdvancing(false);
        }}
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

function ChooseExercise({
  content,
  wordSets,
  practiceIds,
  chooseProgress,
  translateProgress,
  matchProgress,
  onBack,
  onAddContent,
  onPracticeMistakes,
  onRecordChoose,
}: {
  content: CoursePackage;
  wordSets: WordSet[];
  practiceIds: string[];
  chooseProgress: Record<string, ItemProgress>;
  translateProgress: Record<string, ItemProgress>;
  matchProgress: Record<string, ItemProgress>;
  onBack: () => void;
  onAddContent: () => void;
  onPracticeMistakes: (ids: string[]) => void;
  onRecordChoose: (itemId: string, wasCorrect: boolean) => void;
}) {
  const preferredDirection = content.metadata.preferredTranslateDirection ?? "mixed";
  const [wordPoolId, setWordPoolId] = useState(practiceIds.length ? "weak" : "all");
  const [direction, setDirection] = useState<TranslateDirection>(practiceIds.length ? "mixed" : preferredDirection);
  const [questionCount, setQuestionCount] = useState(10);
  const [started, setStarted] = useState(false);
  const [queue, setQueue] = useState<ChooseQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback, setFeedback] = useState<ChooseFeedback | null>(null);
  const [correct, setCorrect] = useState(0);
  const [sessionWeak, setSessionWeak] = useState<Record<string, number>>({});
  const [results, setResults] = useState<{ correct: number; attempts: number; weak: string[] } | null>(null);
  const advanceTimeout = useRef<number | null>(null);
  const words = content.words;
  const poolOptions = wordPoolOptions(words, wordSets, practiceIds);
  const poolWords = wordsForPool(words, wordSets, wordPoolId, practiceIds);
  const current = queue[currentIndex];
  const directionLabels = translateDirectionLabels(content);

  useEffect(() => {
    return () => {
      if (advanceTimeout.current) window.clearTimeout(advanceTimeout.current);
    };
  }, []);

  function start() {
    clearAdvanceTimer(advanceTimeout);
    const selectedWords = wordsForPool(words, wordSets, wordPoolId, practiceIds);
    const nextQueue = sampleChooseQueue(selectedWords, words, questionCount, direction, chooseProgress, translateProgress, matchProgress, content.metadata.id);
    setQueue(nextQueue);
    setStarted(true);
    setCurrentIndex(0);
    setFeedback(null);
    setCorrect(0);
    setSessionWeak({});
    setResults(null);
  }

  function answer(choice: WordPair) {
    if (!current || feedback) return;
    const isCorrect = choice.id === current.word.id;
    onRecordChoose(current.word.id, isCorrect);
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextWeak = isCorrect ? sessionWeak : { ...sessionWeak, [current.word.id]: (sessionWeak[current.word.id] ?? 0) + 4 };
    setCorrect(nextCorrect);
    setSessionWeak(nextWeak);
    setFeedback({ selectedId: choice.id, correct: isCorrect });
    if (!isCorrect && !queue.slice(currentIndex + 1, currentIndex + 5).some((question) => question.word.id === current.word.id)) {
      const retryChoices = buildChooseOptions(current.word, current.direction, poolWords, words, chooseProgress, translateProgress, matchProgress, `retry-${current.word.id}-${currentIndex}`);
      if (retryChoices.length === 4) {
        setQueue((currentQueue) => {
          const nextQueue = [...currentQueue];
          const insertAt = Math.min(currentIndex + 4, nextQueue.length);
          nextQueue.splice(insertAt, 0, { word: current.word, direction: current.direction, choices: retryChoices });
          if (nextQueue.length <= questionCount) return nextQueue;
          const removableIndex = findRemovableFutureQuestion(nextQueue, currentIndex + 1, current.word.id);
          if (removableIndex >= 0) nextQueue.splice(removableIndex, 1);
          return nextQueue;
        });
      }
    }
    clearAdvanceTimer(advanceTimeout);
    advanceTimeout.current = window.setTimeout(() => {
      advance(nextCorrect, nextWeak);
    }, isCorrect ? 600 : 2100);
  }

  function advance(nextCorrect = correct, nextWeak = sessionWeak) {
    clearAdvanceTimer(advanceTimeout);
    if (currentIndex + 1 >= queue.length) {
      const weak = selectWeakVocabularyIds(poolWords, nextWeak, translateProgress, matchProgress, chooseProgress, Math.max(5, Math.min(20, queue.length)));
      setResults({ correct: nextCorrect, attempts: queue.length, weak });
      return;
    }
    setCurrentIndex((index) => index + 1);
    setFeedback(null);
  }

  if (!started) {
    return (
      <SetupPanel title="Choose" onBack={onBack} onStart={start} startDisabled={!poolWords.length || words.length < 4}>
        <p className="setup-package">{content.metadata.title}</p>
        <WordPoolSelect value={wordPoolId} options={poolOptions} onChange={setWordPoolId} />
        <Segmented
          label="Direction"
          options={["term-to-translation", "translation-to-term", "mixed"]}
          labels={directionLabels}
          value={direction}
          onChange={(value) => setDirection(value as TranslateDirection)}
        />
        <p className="setup-help">{translateDirectionHelp(direction, directionLabels)}</p>
        <Segmented label="Questions" options={translateQuestionOptions.map(String)} value={String(questionCount)} onChange={(value) => setQuestionCount(Number(value))} />
        <p className="setup-help">Number of multiple-choice questions in this session.</p>
        {!poolWords.length && <p className="setup-help">No vocabulary in this pool yet.</p>}
        {poolWords.length > 0 && words.length < 4 && <p className="setup-help">Choose needs at least 4 total words for answer choices. Add words manually to start practicing this package.</p>}
        <button className="ghost-button setup-secondary-action" type="button" onClick={onAddContent}>
          Add words manually
        </button>
      </SetupPanel>
    );
  }

  if (results) {
    const weakNames = results.weak.map((id) => termForWord(words.find((word) => word.id === id) ?? { id, term: id, translation: id }));
    return (
      <ResultsPanel
        title="Choose results"
        correct={results.correct}
        attempts={results.attempts}
        mistakes={results.attempts - results.correct}
        weak={weakNames}
        onBack={onBack}
        backLabel="Finish"
        tryMoreLabel="Try more"
        onTryMore={() => {
          clearAdvanceTimer(advanceTimeout);
          setStarted(false);
          setResults(null);
          setFeedback(null);
        }}
        practiceLabel="Practice weak words"
        onPracticeMistakes={results.weak.length ? () => onPracticeMistakes(results.weak) : undefined}
      />
    );
  }

  if (!current) {
    return (
      <section className="workout">
        <ExerciseHeader title="Choose" onBack={onBack} meta={content.metadata.title} />
        <div className="panel">
          <h2>Choose needs at least 4 words.</h2>
          <p>Add words manually to start practicing this package.</p>
          <button className="ghost-button setup-secondary-action" type="button" onClick={onAddContent}>
            Add words manually
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="workout">
      <ExerciseHeader title="Choose" onBack={onBack} meta={`Question ${currentIndex + 1} of ${queue.length}`} />
      <article className={`choose-card${feedback ? (feedback.correct ? " is-right" : " is-wrong") : ""}`}>
        <p className="eyebrow">{directionLabels[current.direction]}</p>
        <h2>{translatePrompt(current)}</h2>
        <div className="choose-options" aria-label="Answer choices">
          {current.choices.map((choice) => {
            const isCorrectChoice = choice.id === current.word.id;
            const isSelected = feedback?.selectedId === choice.id;
            return (
              <button
                className={`choose-option${isSelected ? " is-selected" : ""}${feedback && isCorrectChoice ? " is-right" : ""}${feedback && isSelected && !isCorrectChoice ? " is-wrong" : ""}`}
                disabled={Boolean(feedback)}
                key={choice.id}
                type="button"
                onClick={() => answer(choice)}
              >
                {chooseOptionLabel(choice, current.direction)}
              </button>
            );
          })}
        </div>
        {feedback && (
          <div className="translate-feedback">
            <p>
              {feedback.correct ? "✓ Correct:" : "✗ Correct:"} <strong>{translateExpected(current)}</strong>
            </p>
            {!feedback.correct && (
              <button className="ghost-button compact translate-next-button" type="button" onClick={() => advance()}>
                Next
              </button>
            )}
          </div>
        )}
      </article>
    </section>
  );
}

function TranslateExercise({
  content,
  wordSets,
  practiceIds,
  translateProgress,
  matchProgress,
  chooseProgress,
  onBack,
  onAddContent,
  onPracticeMistakes,
  onRecordTranslate,
}: {
  content: CoursePackage;
  wordSets: WordSet[];
  practiceIds: string[];
  translateProgress: Record<string, ItemProgress>;
  matchProgress: Record<string, ItemProgress>;
  chooseProgress: Record<string, ItemProgress>;
  onBack: () => void;
  onAddContent: () => void;
  onPracticeMistakes: (ids: string[]) => void;
  onRecordTranslate: (itemId: string, wasCorrect: boolean, wasExact: boolean, direction: TranslateDirectionKey) => void;
}) {
  const preferredDirection = content.metadata.preferredTranslateDirection ?? "mixed";
  const [wordPoolId, setWordPoolId] = useState(practiceIds.length ? "weak" : "all");
  const [direction, setDirection] = useState<TranslateDirection>(practiceIds.length ? "mixed" : preferredDirection);
  const [mode, setMode] = useState<EndingMode>("tolerant");
  const [questionCount, setQuestionCount] = useState(10);
  const [started, setStarted] = useState(false);
  const [queue, setQueue] = useState<TranslateQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<TranslateFeedback | null>(null);
  const [correct, setCorrect] = useState(0);
  const [sessionWeak, setSessionWeak] = useState<Record<string, number>>({});
  const [results, setResults] = useState<{ correct: number; attempts: number; weak: string[] } | null>(null);
  const advanceTimeout = useRef<number | null>(null);
  const words = content.words;
  const poolOptions = wordPoolOptions(words, wordSets, practiceIds);
  const poolWords = wordsForPool(words, wordSets, wordPoolId, practiceIds);
  const directionLabels = translateDirectionLabels(content);
  const current = queue[currentIndex];

  useEffect(() => {
    return () => {
      if (advanceTimeout.current) window.clearTimeout(advanceTimeout.current);
    };
  }, []);

  function start() {
    clearAdvanceTimer(advanceTimeout);
    const selectedWords = wordsForPool(words, wordSets, wordPoolId, practiceIds);
    const nextQueue = sampleTranslateQueue(selectedWords, [], questionCount, direction, translateProgress, matchProgress, chooseProgress, content.metadata.id);
    setQueue(nextQueue);
    setStarted(true);
    setCurrentIndex(0);
    setAnswer("");
    setFeedback(null);
    setCorrect(0);
    setSessionWeak({});
    setResults(null);
  }

  function check() {
    if (!current || feedback) return;
    const expected = translateExpected(current);
    const isExact = normalizeTranslateAnswer(answer) === normalizeTranslateAnswer(expected);
    const isCorrect = translateAnswerMatches(answer, expected, mode === "tolerant", content.metadata.characterSubstitutions);
    const directionKey = translateDirectionKey(current.direction);
    onRecordTranslate(current.word.id, isCorrect, isExact, directionKey);
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const weaknessDelta = isCorrect ? (isExact ? 0 : 0.8) : 5;
    const nextWeak = weaknessDelta > 0 ? { ...sessionWeak, [current.word.id]: (sessionWeak[current.word.id] ?? 0) + weaknessDelta } : sessionWeak;
    setCorrect(nextCorrect);
    setSessionWeak(nextWeak);
    setFeedback({ correct: isCorrect, exact: isExact, userAnswer: answer, expected });
    clearAdvanceTimer(advanceTimeout);
    advanceTimeout.current = window.setTimeout(() => {
      advance(nextCorrect, nextWeak);
    }, translateFeedbackDelay(isCorrect, expected, answer));
  }

  function advance(nextCorrect = correct, nextWeak = sessionWeak) {
    clearAdvanceTimer(advanceTimeout);
    if (currentIndex + 1 >= queue.length) {
      const weak = selectWeakVocabularyIds(poolWords, nextWeak, translateProgress, matchProgress, chooseProgress, Math.max(5, Math.min(20, queue.length)));
      setResults({ correct: nextCorrect, attempts: queue.length, weak });
      return;
    }
    setCurrentIndex((index) => index + 1);
    setAnswer("");
    setFeedback(null);
  }

  if (!started) {
    return (
      <SetupPanel title="Translate" onBack={onBack} onStart={start} startDisabled={!poolWords.length}>
        <p className="setup-package">{content.metadata.title}</p>
        <WordPoolSelect value={wordPoolId} options={poolOptions} onChange={setWordPoolId} />
        <Segmented
          label="Direction"
          options={["term-to-translation", "translation-to-term", "mixed"]}
          labels={directionLabels}
          value={direction}
          onChange={(value) => setDirection(value as TranslateDirection)}
        />
        <p className="setup-help">{translateDirectionHelp(direction, directionLabels)}</p>
        <Segmented label="Questions" options={translateQuestionOptions.map(String)} value={String(questionCount)} onChange={(value) => setQuestionCount(Number(value))} />
        <p className="setup-help">Number of typed translations in this session.</p>
        <Segmented
          label="Answer checking"
          options={["tolerant", "strict"]}
          labels={{ tolerant: "Tolerant", strict: "Strict" }}
          value={mode}
          onChange={(value) => setMode(value as EndingMode)}
        />
        <p className="setup-help">
          {mode === "tolerant" ? "Allows configured keyboard/diacritic equivalents." : "Exact spelling and characters required, ignoring capitalization."}
        </p>
        {!poolWords.length && <p className="setup-help">No vocabulary in this pool yet. Add words manually to start practicing this package.</p>}
        <button className="ghost-button setup-secondary-action" type="button" onClick={onAddContent}>
          Add words manually
        </button>
      </SetupPanel>
    );
  }

  if (results) {
    const weakNames = results.weak.map((id) => termForWord(words.find((word) => word.id === id) ?? { id, term: id, translation: id }));
    return (
      <ResultsPanel
        title="Translate results"
        correct={results.correct}
        attempts={results.attempts}
        mistakes={results.attempts - results.correct}
        weak={weakNames}
        onBack={onBack}
        backLabel="Finish"
        tryMoreLabel="Try more"
        onTryMore={() => {
          clearAdvanceTimer(advanceTimeout);
          setStarted(false);
          setResults(null);
          setFeedback(null);
        }}
        practiceLabel="Practice weak words"
        onPracticeMistakes={results.weak.length ? () => onPracticeMistakes(results.weak) : undefined}
      />
    );
  }

  if (!current) {
    return (
      <section className="workout">
        <ExerciseHeader title="Translate" onBack={onBack} meta={content.metadata.title} />
        <div className="panel">
          <h2>No vocabulary yet.</h2>
          <p>Add words manually to start practicing this package.</p>
          <button className="ghost-button setup-secondary-action" type="button" onClick={onAddContent}>
            Add words manually
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="workout">
      <ExerciseHeader title="Translate" onBack={onBack} meta={`Question ${currentIndex + 1} of ${queue.length}`} />
      <article className={`translate-card${feedback ? (feedback.correct ? " is-right" : " is-wrong") : ""}`}>
        <p className="eyebrow">{directionLabels[current.direction]}</p>
        <h2>{translatePrompt(current)}</h2>
        <label className="translate-answer">
          <span>Your answer</span>
          <input
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (feedback) {
                  advance();
                } else {
                  check();
                }
              }
            }}
            disabled={Boolean(feedback)}
          />
        </label>
        {feedback && (
          <div className="translate-feedback">
            <p>
              {feedback.correct ? "✓ Correct:" : "✗ Correct:"} <strong>{feedback.expected}</strong>
            </p>
            {!feedback.correct && <p>Your answer: {feedback.userAnswer || "(blank)"}</p>}
            {!feedback.correct && (
              <button className="ghost-button compact translate-next-button" type="button" onClick={() => advance()}>
                Next
              </button>
            )}
          </div>
        )}
      </article>
      <button className="primary-button" type="button" onClick={feedback ? () => advance() : check} disabled={!answer.trim() && !feedback}>
        {feedback ? "Next" : "Check"}
      </button>
    </section>
  );
}

function TextExerciseView({
  texts,
  practiceIds,
  packageTitle,
  onBack,
  onAddContent,
  onPracticeMistakes,
  onRecord,
}: {
  texts: TextExercise[];
  practiceIds: string[];
  packageTitle: string;
  onBack: () => void;
  onAddContent: () => void;
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
      <SetupPanel title="Text" onBack={onBack} onStart={start} startDisabled={!texts.length}>
        <p className="setup-package">{packageTitle}</p>
        <Segmented label="Level" options={textLevels.map(String)} value={String(level)} onChange={(value) => setLevel(Number(value) as typeof level)} />
        <p className="setup-help">{textLevelHelp(level)}</p>
        <Segmented
          label="Correction"
          options={["immediate", "submit"]}
          labels={{ immediate: "Immediate", submit: "After submission" }}
          value={mode}
          onChange={(value) => setMode(value as CorrectionMode)}
        />
        <p className="setup-help">{mode === "immediate" ? "Check answers as each gap is filled." : "Fill the passage first, then check all gaps."}</p>
        {!texts.length && <p className="setup-help">No text exercises yet. Add texts manually to practice this package locally.</p>}
        <button className="ghost-button setup-secondary-action" type="button" onClick={onAddContent}>
          Add texts manually
        </button>
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
  onAddContent,
  onPracticeMistakes,
  onRecord,
}: {
  forms: FormExercise[];
  practiceIds: string[];
  content: CoursePackage;
  onBack: () => void;
  onAddContent: () => void;
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
  const advanceTimeout = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      clearAdvanceTimer(advanceTimeout);
    };
  }, []);

  function start() {
    clearAdvanceTimer(advanceTimeout);
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
    if (message) {
      advance();
      return;
    }
    const wasCorrect = answerMatches(answer, current.answer, mode === "tolerant", content.metadata.characterSubstitutions);
    setAttempts((value) => value + 1);
    setCorrect((value) => value + (wasCorrect ? 1 : 0));
    setMessage(wasCorrect ? "right" : "wrong");
    setWeak((items) => (wasCorrect || items.includes(current.id) ? items : [...items, current.id]));
    onRecord("forms", current.id, wasCorrect);

    if (wasCorrect) {
      clearAdvanceTimer(advanceTimeout);
      advanceTimeout.current = window.setTimeout(() => advance(true, current), 750);
    }
  }

  function advance(wasCorrect = message === "right", item = current) {
    clearAdvanceTimer(advanceTimeout);
    if (!item) return;
    setQueue((items) => {
      const nextQueue = wasCorrect ? items : insertLater(items, item, 4);
      setCurrent(nextQueue[0] ?? null);
      return nextQueue.slice(1);
    });
    setAnswer("");
    setMessage("");
  }

  if (!started) {
    return (
      <SetupPanel title="Forms" onBack={onBack} onStart={start} startDisabled={!forms.length}>
        <p className="setup-package">{content.metadata.title}</p>
        <Segmented
          label="Answer mode"
          options={["tolerant", "strict"]}
          labels={{ tolerant: "Tolerant", strict: "Strict" }}
          value={mode}
          onChange={(value) => setMode(value as EndingMode)}
        />
        <p className="setup-help">{mode === "tolerant" ? "Allows configured keyboard/diacritic equivalents." : "Exact spelling and characters required."}</p>
        {!forms.length && <p className="setup-help">No form exercises yet. Add forms manually to practice this package locally.</p>}
        <button className="ghost-button setup-secondary-action" type="button" onClick={onAddContent}>
          Add forms manually
        </button>
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
              if (event.key === "Enter") {
                event.preventDefault();
                check();
              }
            }}
            readOnly={Boolean(message)}
          />
          {current.after && <span>{current.after}</span>}
        </label>
        {message === "wrong" && (
          <div className="feedback-line form-feedback">
            <p>Your answer: {answer || "(blank)"}</p>
            <p>
              Correct: <strong>{current.result}</strong>
            </p>
          </div>
        )}
        {message === "right" && <p className="feedback-line">Correct: {current.result}</p>}
        {message && current.note && (
          <p className="note">
            Rule: {current.note}
          </p>
        )}
        {message === "wrong" && (
          <button className="ghost-button compact translate-next-button" type="button" onClick={() => advance(false)}>
            Next
          </button>
        )}
      </article>
      {!message && (
        <button className="primary-button" type="button" onClick={check}>
          Check
        </button>
      )}
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
  const weakChoose = weakItems(progress, packageId, "choose");
  const weakTranslate = weakItems(progress, packageId, "translate");
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
      <WeakPanel
        title="Choose"
        ids={weakChoose}
        labelFor={(id) => termForWord(content.words.find((item) => item.id === id) ?? { id, term: id, translation: id })}
        onPractice={() => onPractice("choose", weakChoose)}
      />
      <WeakPanel
        title="Translate"
        ids={weakTranslate}
        labelFor={(id) => termForWord(content.words.find((item) => item.id === id) ?? { id, term: id, translation: id })}
        onPractice={() => onPractice("translate", weakTranslate)}
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
  startDisabled = false,
}: {
  title: string;
  children: React.ReactNode;
  onBack: () => void;
  onStart: () => void;
  startDisabled?: boolean;
}) {
  return (
    <section className="workout">
      <ExerciseHeader title={title} onBack={onBack} meta="Setup" />
      <div className="panel controls-panel">{children}</div>
      <button className="primary-button" type="button" onClick={onStart} disabled={startDisabled}>
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

function WordPoolSelect({ value, options, onChange }: { value: string; options: WordPoolOption[]; onChange: (value: string) => void }) {
  return (
    <label className="field-group">
      <span>Pool</span>
      <select className="pool-select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title} · {option.count}
          </option>
        ))}
      </select>
    </label>
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
  tryMoreLabel = "Try more",
  onTryMore,
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
  tryMoreLabel?: string;
  onTryMore?: () => void;
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
      {onTryMore && (
        <button className="ghost-button" type="button" onClick={onTryMore}>
          {tryMoreLabel}
        </button>
      )}
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

type WordPoolOption = {
  id: string;
  title: string;
  count: number;
};

function wordPoolOptions(words: WordPair[], wordSets: WordSet[], practiceIds: string[] = []): WordPoolOption[] {
  const options: WordPoolOption[] = [{ id: "all", title: "All words", count: words.length }];
  if (practiceIds.length) {
    options.push({ id: "weak", title: "Weak words", count: wordsForPool(words, wordSets, "weak", practiceIds).length });
  }
  const generalCount = wordsForPool(words, wordSets, "general").length;
  if (generalCount > 0) options.push({ id: "general", title: "General", count: generalCount });
  wordSets.forEach((set) => {
    options.push({ id: set.id, title: set.title, count: validSetWordIds(set, words).length });
  });
  return options;
}

function wordsForPool(words: WordPair[], wordSets: WordSet[], poolId: string, practiceIds: string[] = []) {
  if (poolId === "weak") {
    const weakIds = new Set(practiceIds);
    return words.filter((word) => weakIds.has(word.id));
  }
  if (poolId === "general") {
    const assigned = new Set(wordSets.flatMap((set) => set.wordIds));
    return words.filter((word) => word.custom && !assigned.has(word.id));
  }
  if (poolId !== "all") {
    const set = wordSets.find((item) => item.id === poolId);
    if (!set) return [];
    const ids = new Set(set.wordIds);
    return words.filter((word) => ids.has(word.id));
  }
  return words;
}

function validSetWordIds(set: WordSet, words: WordPair[]) {
  const ids = new Set(words.map((word) => word.id));
  return set.wordIds.filter((wordId) => ids.has(wordId));
}

function matchPairOptions(wordCount: number) {
  if (wordCount <= 0) return ["1"];
  const options = pairOptions.filter((option) => option <= wordCount);
  return (options.length ? options : [wordCount]).map(String);
}

type TranslateQuestion = {
  word: WordPair;
  direction: Exclude<TranslateDirection, "mixed">;
};

type ChooseQuestion = TranslateQuestion & {
  choices: WordPair[];
};

type TranslateFeedback = {
  correct: boolean;
  exact: boolean;
  userAnswer: string;
  expected: string;
};

type ChooseFeedback = {
  correct: boolean;
  selectedId: string;
};

function sampleChooseQueue(
  promptWords: WordPair[],
  allWords: WordPair[],
  questionCount: number,
  direction: TranslateDirection,
  chooseProgress: Record<string, ItemProgress>,
  translateProgress: Record<string, ItemProgress>,
  matchProgress: Record<string, ItemProgress>,
  packageId: string,
): ChooseQuestion[] {
  const promptPool = promptWords;
  if (allWords.length < 4 || !promptPool.length) return [];
  const queue: ChooseQuestion[] = [];
  let cycle = 0;
  while (queue.length < questionCount && cycle < questionCount * 6) {
    const salt = `choose-${packageId}-${cycle}-${Date.now()}`;
    const ordered = stableShuffle(promptPool, salt).sort(
      (a, b) => vocabularySelectionWeakness(b.id, translateProgress, matchProgress, chooseProgress) - vocabularySelectionWeakness(a.id, translateProgress, matchProgress, chooseProgress),
    );
    for (const word of ordered) {
      if (queue.length >= questionCount) break;
      if (queue.at(-1)?.word.id === word.id && ordered.length > 1) continue;
      const currentDirection = chooseTranslateDirection(word.id, direction, translateProgress, salt);
      const choices = buildChooseOptions(word, currentDirection, promptPool, allWords, chooseProgress, translateProgress, matchProgress, `${salt}-${queue.length}`);
      if (choices.length === 4) queue.push({ word, direction: currentDirection, choices });
    }
    cycle += 1;
  }
  return queue;
}

function sampleTranslateQueue(
  words: WordPair[],
  practiceIds: string[],
  questionCount: number,
  direction: TranslateDirection,
  translateProgress: Record<string, ItemProgress>,
  matchProgress: Record<string, ItemProgress>,
  chooseProgress: Record<string, ItemProgress>,
  packageId: string,
): TranslateQuestion[] {
  const pool = practiceIds.length ? words.filter((word) => practiceIds.includes(word.id)) : words;
  if (!pool.length) return [];
  const queue: TranslateQuestion[] = [];
  let cycle = 0;
  while (queue.length < questionCount) {
    const salt = `translate-${packageId}-${cycle}-${Date.now()}`;
    const ordered = stableShuffle(pool, salt).sort(
      (a, b) => vocabularySelectionWeakness(b.id, translateProgress, matchProgress, chooseProgress) - vocabularySelectionWeakness(a.id, translateProgress, matchProgress, chooseProgress),
    );
    for (const word of ordered) {
      if (queue.length >= questionCount) break;
      if (queue.at(-1)?.word.id === word.id && ordered.length > 1) continue;
      queue.push({ word, direction: chooseTranslateDirection(word.id, direction, translateProgress, salt) });
    }
    cycle += 1;
  }
  return queue;
}

function chooseTranslateDirection(
  itemId: string,
  direction: TranslateDirection,
  translateProgress: Record<string, ItemProgress>,
  salt: string,
): Exclude<TranslateDirection, "mixed"> {
  if (direction !== "mixed") return direction;
  const item = translateProgress[itemId];
  const termToTranslationWeakness = directionWeakness(item?.termToTranslation);
  const translationToTermWeakness = directionWeakness(item?.translationToTerm);
  if (Math.abs(termToTranslationWeakness - translationToTermWeakness) >= 0.2) {
    return termToTranslationWeakness > translationToTermWeakness ? "term-to-translation" : "translation-to-term";
  }
  return stableShuffle(["term-to-translation", "translation-to-term"], `${itemId}-${salt}`)[0] as Exclude<TranslateDirection, "mixed">;
}

function directionWeakness(direction: ItemProgress[TranslateDirectionKey] | undefined) {
  if (!direction || direction.attempts === 0) return 0.4;
  return direction.incorrect * 2 + (1 - direction.correct / direction.attempts);
}

function vocabularySelectionWeakness(
  itemId: string,
  translateProgress: Record<string, ItemProgress>,
  matchProgress: Record<string, ItemProgress>,
  chooseProgress: Record<string, ItemProgress> = {},
) {
  return itemWeaknessScore(translateProgress[itemId]) * 1.6 + itemWeaknessScore(chooseProgress[itemId]) * 1.25 + itemWeaknessScore(matchProgress[itemId]);
}

function selectWeakVocabularyIds(
  words: WordPair[],
  sessionWeak: Record<string, number>,
  translateProgress: Record<string, ItemProgress>,
  matchProgress: Record<string, ItemProgress>,
  chooseProgress: Record<string, ItemProgress>,
  limit: number,
) {
  return [...words]
    .filter((word) => (sessionWeak[word.id] ?? 0) > 0 || vocabularySelectionWeakness(word.id, translateProgress, matchProgress, chooseProgress) > 0)
    .sort((a, b) => {
      const left = (sessionWeak[b.id] ?? 0) * 2 + vocabularySelectionWeakness(b.id, translateProgress, matchProgress, chooseProgress);
      const right = (sessionWeak[a.id] ?? 0) * 2 + vocabularySelectionWeakness(a.id, translateProgress, matchProgress, chooseProgress);
      return left - right;
    })
    .slice(0, limit)
    .map((word) => word.id);
}

function translateDirectionLabels(content: CoursePackage): Record<TranslateDirection, string> {
  const target = content.metadata.languageCode.startsWith("en") ? "Term" : content.metadata.language;
  const meaning = content.metadata.languageCode.startsWith("en") ? "Meaning" : "English";
  return {
    "term-to-translation": `${target} → ${meaning}`,
    "translation-to-term": `${meaning} → ${target}`,
    mixed: "Mixed",
  };
}

function translateDirectionHelp(direction: TranslateDirection, labels: Record<TranslateDirection, string>) {
  if (direction === "mixed") return "Randomly alternates directions, with more attention to the weaker side.";
  return `Type the missing side: ${labels[direction]}.`;
}

function translatePrompt(question: TranslateQuestion) {
  return question.direction === "term-to-translation" ? termForWord(question.word) : translationForWord(question.word);
}

function translateExpected(question: TranslateQuestion) {
  return question.direction === "term-to-translation" ? translationForWord(question.word) : termForWord(question.word);
}

function chooseOptionLabel(word: WordPair, direction: Exclude<TranslateDirection, "mixed">) {
  return direction === "term-to-translation" ? translationForWord(word) : termForWord(word);
}

function buildChooseOptions(
  word: WordPair,
  direction: Exclude<TranslateDirection, "mixed">,
  poolWords: WordPair[],
  allWords: WordPair[],
  chooseProgress: Record<string, ItemProgress>,
  translateProgress: Record<string, ItemProgress>,
  matchProgress: Record<string, ItemProgress>,
  salt: string,
) {
  const expectedLabel = normalizeChoiceLabel(chooseOptionLabel(word, direction));
  const seenLabels = new Set([expectedLabel]);
  const expectedLength = expectedLabel.length;
  const distractorPool = poolWords.length >= 4 ? poolWords : allWords;
  const distractors = stableShuffle(
    distractorPool.filter((candidate) => candidate.id !== word.id),
    `distractors-${salt}`,
  )
    .sort((a, b) => {
      const lengthScore = Math.abs(normalizeChoiceLabel(chooseOptionLabel(a, direction)).length - expectedLength) - Math.abs(normalizeChoiceLabel(chooseOptionLabel(b, direction)).length - expectedLength);
      if (lengthScore !== 0) return lengthScore;
      return vocabularySelectionWeakness(b.id, translateProgress, matchProgress, chooseProgress) - vocabularySelectionWeakness(a.id, translateProgress, matchProgress, chooseProgress);
    })
    .filter((candidate) => {
      const label = normalizeChoiceLabel(chooseOptionLabel(candidate, direction));
      if (!label || seenLabels.has(label)) return false;
      seenLabels.add(label);
      return true;
    })
    .slice(0, 3);

  return stableShuffle([word, ...distractors], `choices-${salt}`);
}

function findRemovableFutureQuestion(queue: ChooseQuestion[], startIndex: number, protectedId: string) {
  for (let index = queue.length - 1; index >= startIndex; index -= 1) {
    if (queue[index].word.id !== protectedId) return index;
  }
  return -1;
}

function normalizeChoiceLabel(value: string) {
  return normalizeTranslateAnswer(value);
}

function translateDirectionKey(direction: Exclude<TranslateDirection, "mixed">): TranslateDirectionKey {
  return direction === "term-to-translation" ? "termToTranslation" : "translationToTerm";
}

function translateAnswerMatches(input: string, answer: string, tolerant: boolean, substitutions: CharacterSubstitutions = {}) {
  const inputCandidates = translateAnswerCandidates(input);
  const answerCandidates = translateAnswerCandidates(answer);
  for (const inputCandidate of inputCandidates) {
    for (const answerCandidate of answerCandidates) {
      if (inputCandidate === answerCandidate) return true;
      if (tolerant && answerMatches(inputCandidate, answerCandidate, true, substitutions)) return true;
      if (tolerant && tokenMultisetMatches(inputCandidate, answerCandidate, substitutions)) return true;
    }
  }
  return false;
}

function translateFeedbackDelay(isCorrect: boolean, expected: string, userAnswer: string) {
  if (isCorrect) return 700;
  const textLength = Math.max(expected.trim().length, userAnswer.trim().length);
  return Math.min(6000, 2500 + textLength * 35);
}

function clearAdvanceTimer(timer: { current: number | null }) {
  if (!timer.current) return;
  window.clearTimeout(timer.current);
  timer.current = null;
}

function normalizeTranslateAnswer(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/[.。]+$/u, "").toLocaleLowerCase();
}

function translateAnswerCandidates(value: string) {
  const normalized = normalizeTranslateAnswer(value);
  const withoutParenthetical = stripTrailingParenthetical(normalized);
  return Array.from(new Set([normalized, withoutParenthetical].filter(Boolean)));
}

function stripTrailingParenthetical(value: string) {
  let current = value.trim();
  let next = current.replace(/\s*\([^()]*\)\s*$/u, "").trim();
  while (next !== current) {
    current = next;
    next = current.replace(/\s*\([^()]*\)\s*$/u, "").trim();
  }
  return current;
}

function tokenMultisetMatches(input: string, answer: string, substitutions: CharacterSubstitutions) {
  const inputTokens = answerTokens(input);
  const answerTokensList = answerTokens(answer);
  if (inputTokens.length !== answerTokensList.length) return false;
  const used = new Set<number>();
  return inputTokens.every((inputToken) => {
    const index = answerTokensList.findIndex((answerToken, candidateIndex) => !used.has(candidateIndex) && answerMatches(inputToken, answerToken, true, substitutions));
    if (index === -1) return false;
    used.add(index);
    return true;
  });
}

function answerTokens(value: string) {
  return value
    .replace(/[^\p{L}\p{N}'-]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
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
  chooseProgress: Record<string, ItemProgress>,
  translateProgress: Record<string, ItemProgress>,
  seed: string,
) {
  const pool = practiceIds.length ? words.filter((word) => practiceIds.includes(word.id)) : words;
  const count = Math.min(pairsPerRound, pool.length);
  const seen = new Set(seenIds);
  const salt = `match-round-${currentRound}-${seed}`;
  const weakCount = Math.min(Math.max(1, Math.floor(count / 5)), Math.max(0, count - 1));
  const weakWords = stableShuffle(
    [...pool]
      .filter((word) => (weakMap[word.id] ?? 0) > 0 || itemWeaknessScore(matchProgress[word.id]) > 0 || itemWeaknessScore(chooseProgress[word.id]) > 0 || itemWeaknessScore(translateProgress[word.id]) > 0)
      .sort((a, b) => matchSelectionWeakness(b.id, weakMap, matchProgress, chooseProgress, translateProgress) - matchSelectionWeakness(a.id, weakMap, matchProgress, chooseProgress, translateProgress)),
    `weak-${salt}`,
  )
    .sort((a, b) => matchSelectionWeakness(b.id, weakMap, matchProgress, chooseProgress, translateProgress) - matchSelectionWeakness(a.id, weakMap, matchProgress, chooseProgress, translateProgress))
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

function matchSelectionWeakness(
  id: string,
  sessionWeak: Record<string, number>,
  matchProgress: Record<string, ItemProgress>,
  chooseProgress: Record<string, ItemProgress>,
  translateProgress: Record<string, ItemProgress>,
) {
  return (sessionWeak[id] ?? 0) * 2 + itemWeaknessScore(matchProgress[id]) + itemWeaknessScore(chooseProgress[id]) * 1.25 + itemWeaknessScore(translateProgress[id]) * 1.4;
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

function textLevelHelp(level: number) {
  if (level === 1) return "Few gaps · choose from a word bank.";
  if (level === 2) return "More gaps · choose from a word bank.";
  if (level === 3) return "Few gaps · type the answers.";
  if (level === 4) return "More gaps · type the answers.";
  return "Most annotated words removed · exact typed answers.";
}

function importHelp(kind: ImportKind) {
  if (kind === "words") return "Paste one pair per line as word -- translation. Wrap lines in {{Set name}} blocks to create practice sets.";
  if (kind === "texts") return "Paste one annotated passage per line as target text -- translation, or paste JSON with text and translation fields.";
  return "Paste one form per line as prompt -- form with [answer] -- optional note, or paste JSON with prompt, before, answer, and after.";
}

function importExample(kind: ImportKind) {
  if (kind === "words") {
    return `casă -- house
copil -- child
carte -- book

{{Homework 1}}
acei -- those (masculine plural)
acestea -- these (feminine/neuter plural)
{{/Homework 1}}

[
  { "title": "Homework 2", "words": [
    { "term": "Haus", "translation": "house" },
    { "term": "Kind", "translation": "child" }
  ] }
]`;
  }
  if (kind === "texts") {
    return `Eu {locuiesc} în Singapore. -- I live in Singapore.
Ich {wohne} in Berlin und {arbeite} heute. -- I live in Berlin and work today.

[
  { "text": "Eu {locuiesc} în Singapore.", "translation": "I live in Singapore." }
]`;
  }
  return `we work -- noi lucr[ăm] -- present tense
the man is here -- [Der] Mann ist hier. -- masculine nominative definite article

[
  { "prompt": "we work", "before": "noi lucr", "answer": "ăm", "after": "", "note": "present tense" }
]`;
}

function importTemplate(kind: ImportKind, activePackage: CoursePackage) {
  if (kind === "words") return wordImportTemplate(activePackage);
  if (kind === "texts") return textImportTemplate(activePackage);
  return formsImportTemplate(activePackage);
}

function wordImportTemplate(activePackage: CoursePackage) {
  const labels = vocabularySideLabels(activePackage);
  return `Create vocabulary entries for ${activePackage.metadata.title} practice.

Return ONLY vocabulary entries using this format:

${labels.term} -- ${labels.translation}

For ordinary vocabulary:
${wordTemplateExamples(activePackage)}

To create a named practice set, wrap entries like this:

{{Homework 1}}
${wordTemplateExamples(activePackage).split("\n").slice(0, 2).join("\n")}
{{/Homework 1}}

Rules:
- one vocabulary pair per line;
- do not number entries;
- use correct spelling${activePackage.metadata.characterSubstitutions ? " and diacritics" : ""};
- text outside a named block goes into the general vocabulary;
- named blocks create practice sets;
- do not add explanations outside the required format.`;
}

function textImportTemplate(activePackage: CoursePackage) {
  const target = activePackage.metadata.language;
  const explanation = activePackage.metadata.languageCode.startsWith("en") ? "EXPLANATION OR PARAPHRASE" : "ENGLISH TRANSLATION";
  return `Create short practice texts in ${target}.

Return ONLY one text per line using:

TARGET TEXT -- ${explanation}

Put braces around words that may become gaps.

Example:
${textTemplateExample(activePackage)}

Do not number the entries.
Do not add explanations outside the format.
Use correct spelling${activePackage.metadata.characterSubstitutions ? " and diacritics" : ""}.`;
}

function formsImportTemplate(activePackage: CoursePackage) {
  return `Create grammar-form exercises for ${activePackage.metadata.language}.

Return ONLY one exercise per line using:

PROMPT -- SENTENCE WITH [ANSWER] -- OPTIONAL NOTE

Examples:
we work -- noi lucr[ăm] -- present tense, first person plural
the man is here -- [Der] Mann ist hier. -- masculine nominative definite article

Exactly one answer must be placed inside [square brackets].
Do not number the entries.
Do not add explanations outside the format.`;
}

function vocabularySideLabels(activePackage: CoursePackage) {
  if (activePackage.metadata.languageCode === "en-med") {
    return { term: "Medical English term", translation: "concise definition" };
  }
  if (activePackage.metadata.languageCode === "en-lit") {
    return { term: "Literary English term", translation: "concise modern definition" };
  }
  if (activePackage.metadata.languageCode.startsWith("en")) {
    return { term: `${activePackage.metadata.language} term`, translation: "concise meaning" };
  }
  return { term: `${activePackage.metadata.language} word`, translation: "English translation" };
}

function wordTemplateExamples(activePackage: CoursePackage) {
  if (activePackage.words.length) {
    return activePackage.words
      .slice(0, 3)
      .map((word) => `${termForWord(word)} -- ${translationForWord(word)}`)
      .join("\n");
  }
  if (activePackage.metadata.languageCode === "de") return "Haus -- house\nKind -- child\nBuch -- book";
  if (activePackage.metadata.languageCode === "en-med") {
    return "placental abruption -- premature separation of the placenta from the uterine wall\nuterine atony -- failure of the uterus to contract adequately after delivery";
  }
  if (activePackage.metadata.languageCode === "en-lit") {
    return "countenance -- a person's face or facial expression\npecuniary -- relating to money or financial matters";
  }
  if (activePackage.metadata.languageCode === "nb") return "hus -- house\nbarn -- child\nbrød -- bread";
  return "casă -- house\ncopil -- child\ncarte -- book";
}

function textTemplateExample(activePackage: CoursePackage) {
  if (activePackage.texts.length) {
    const text = activePackage.texts[0];
    return `${text.text} -- ${text.translation || "brief explanation or translation"}`;
  }
  if (activePackage.metadata.languageCode === "de") return "Ich {wohne} in Berlin und {arbeite} heute. -- I live in Berlin and work today.";
  if (activePackage.metadata.languageCode === "nb") return "Jeg {bor} i Oslo og {arbeider} i dag. -- I live in Oslo and work today.";
  if (activePackage.metadata.languageCode.startsWith("en")) {
    return "The patient reported {dyspnoea} after exertion. -- The patient had shortness of breath after activity.";
  }
  return "Eu {locuiesc} în Singapore și {lucrez} la universitate. -- I live in Singapore and work at the university.";
}

function parseImport(kind: ImportKind, raw: string, activePackage: CoursePackage, custom: CustomPackageContent | undefined) {
  if (kind === "words") return parseWordImport(raw, activePackage, custom);
  if (kind === "texts") return parseTextImport(raw, activePackage, custom);
  return parseFormImport(raw, activePackage, custom);
}

function parseWordImport(raw: string, activePackage: CoursePackage, custom: CustomPackageContent | undefined) {
  const existing = new Map(activePackage.words.map((word) => [normalizeDuplicateKey(termForWord(word), translationForWord(word)), word.id]));
  const words: WordPair[] = [];
  const setMemberships = new Map((custom?.wordSets ?? []).map((set) => [set.title.trim().toLocaleLowerCase(), { ...set, wordIds: [...set.wordIds] }]));
  let ignored = 0;
  let duplicates = 0;
  let membershipsAdded = 0;

  for (const block of readWordImportBlocks(raw)) {
    for (const item of block.items) {
      const parsed = typeof item === "string" ? parseWordLine(item) : parseWordObject(item);
      if (!parsed) {
        ignored += 1;
        continue;
      }
      const key = normalizeDuplicateKey(parsed.term, parsed.translation);
      let wordId = existing.get(key);
      if (wordId) {
        duplicates += 1;
      } else {
        wordId = localId("word");
        existing.set(key, wordId);
        words.push({ id: wordId, term: parsed.term, translation: parsed.translation, custom: true });
      }

      if (block.title) {
        const setKey = block.title.toLocaleLowerCase();
        const now = new Date().toISOString();
        const current = setMemberships.get(setKey) ?? { id: localId("set"), packageId: activePackage.metadata.id, title: block.title, wordIds: [], createdAt: now, updatedAt: now };
        if (!current.wordIds.includes(wordId)) {
          current.wordIds = [...current.wordIds, wordId];
          current.updatedAt = now;
          membershipsAdded += 1;
        }
        setMemberships.set(setKey, current);
      }
    }
  }

  return { words, texts: [], forms: [], wordSets: Array.from(setMemberships.values()), added: words.length + membershipsAdded, duplicates, ignored };
}

function parseTextImport(raw: string, activePackage: CoursePackage, custom: CustomPackageContent | undefined) {
  const existing = new Set([...activePackage.texts, ...(custom?.texts ?? [])].map((item) => normalizeDuplicateKey(item.text)));
  const texts: TextExercise[] = [];
  let ignored = 0;
  let duplicates = 0;

  for (const item of readImportItems(raw, "texts")) {
    const parsed = typeof item === "string" ? parseTextLine(item) : parseTextObject(item);
    const targetText = parsed?.text ?? "";
    if (!targetText || !hasTextGaps(targetText)) {
      ignored += 1;
      continue;
    }
    const key = normalizeDuplicateKey(targetText);
    if (existing.has(key)) {
      duplicates += 1;
      continue;
    }
    existing.add(key);
    texts.push({
      id: localId("text"),
      title: parsed?.title || "Custom text",
      text: targetText,
      translation: parsed?.translation ?? "",
      translationLanguage: parsed?.translationLanguage ?? "English",
      custom: true,
    });
  }

  return { words: [], texts, forms: [], wordSets: [], added: texts.length, duplicates, ignored };
}

function parseFormImport(raw: string, activePackage: CoursePackage, custom: CustomPackageContent | undefined) {
  const existing = new Set([...activePackage.forms, ...(custom?.forms ?? [])].map((item) => normalizeDuplicateKey(item.prompt, formBefore(item), item.answer, item.after)));
  const forms: FormExercise[] = [];
  let ignored = 0;
  let duplicates = 0;

  for (const item of readImportItems(raw, "forms")) {
    const parsed = typeof item === "string" ? parseFormLine(item) : parseFormObject(item);
    const prompt = parsed?.prompt ?? "";
    const before = parsed?.before ?? "";
    const answer = parsed?.answer ?? "";
    const after = parsed?.after ?? "";
    if (!prompt || !answer) {
      ignored += 1;
      continue;
    }
    const key = normalizeDuplicateKey(prompt, before, answer, after);
    if (existing.has(key)) {
      duplicates += 1;
      continue;
    }
    existing.add(key);
    forms.push({
      id: localId("form"),
      type: parsed?.type ?? "form",
      prompt,
      before,
      answer,
      after,
      result: parsed?.result ?? `${before}${answer}${after}`,
      note: parsed?.note ?? "",
      custom: true,
    });
  }

  return { words: [], texts: [], forms, wordSets: [], added: forms.length, duplicates, ignored };
}

function readImportItems(raw: string, packageKey: "words" | "texts" | "forms"): Array<string | Record<string, unknown>> {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed.filter(isRecord);
      if (isRecord(parsed) && Array.isArray(parsed[packageKey])) return (parsed[packageKey] as unknown[]).filter(isRecord);
      if (isRecord(parsed)) return [parsed];
    } catch {
      return trimmed.split(/\r?\n/);
    }
  }
  return trimmed.split(/\r?\n/);
}

function readWordImportBlocks(raw: string): Array<{ title?: string; items: Array<string | Record<string, unknown>> }> {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => {
          if (isRecord(item) && stringValue(item.title) && Array.isArray(item.words)) {
            return { title: stringValue(item.title), items: (item.words as unknown[]).filter(isRecord) };
          }
          return { items: isRecord(item) ? [item] : [] };
        });
      }
      if (isRecord(parsed) && stringValue(parsed.title) && Array.isArray(parsed.words)) {
        return [{ title: stringValue(parsed.title), items: (parsed.words as unknown[]).filter(isRecord) }];
      }
      if (isRecord(parsed) && Array.isArray(parsed.words)) {
        return [{ items: (parsed.words as unknown[]).filter(isRecord) }];
      }
      if (isRecord(parsed)) return [{ items: [parsed] }];
    } catch {
      // Fall through to the line parser so valid plain-text lines can still import.
    }
  }

  const blocks: Array<{ title?: string; items: string[] }> = [];
  let current: { title?: string; items: string[] } = { items: [] };
  for (const rawLine of trimmed.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const open = line.match(/^\{\{([^/][^}]*)\}\}$/u);
    const close = line.match(/^\{\{\/([^}]*)\}\}$/u);
    if (open) {
      if (current.items.length) blocks.push(current);
      const title = open[1].trim();
      current = title ? { title, items: [] } : { items: [] };
      continue;
    }
    if (close) {
      if (current.items.length) blocks.push(current);
      current = { items: [] };
      continue;
    }
    current.items.push(rawLine);
  }
  if (current.items.length) blocks.push(current);
  return blocks;
}

function parseWordLine(line: string) {
  const parts = splitImportLine(line, 2);
  if (!parts) return null;
  const [term, translation] = parts;
  return term && translation ? { term, translation } : null;
}

function parseWordObject(item: Record<string, unknown>) {
  const term = stringValue(item.term ?? item.ro ?? item.word);
  const translation = stringValue(item.translation ?? item.en ?? item.meaning ?? item.definition);
  return term && translation ? { term, translation } : null;
}

function parseTextLine(line: string): Partial<TextExercise> | null {
  const parts = line.includes("--") ? splitImportLine(line, 1) : [line.trim()];
  if (!parts) return null;
  const [text, translation = ""] = parts;
  return text ? { text, translation } : null;
}

function parseTextObject(item: Record<string, unknown>): Partial<TextExercise> | null {
  const text = stringValue(item.text);
  if (!text) return null;
  return {
    title: stringValue(item.title),
    text,
    translation: stringValue(item.translation),
    translationLanguage: stringValue(item.translationLanguage) || "English",
  };
}

function parseFormLine(line: string): Partial<FormExercise> | null {
  const parts = splitImportLine(line, 2);
  if (!parts) return null;
  const [prompt, formWithAnswer, note = ""] = parts;
  const matches = [...formWithAnswer.matchAll(/\[([^\]]+)\]/g)];
  if (!prompt || matches.length !== 1) return null;
  const match = matches[0];
  const answer = match[1].trim();
  if (!answer) return null;
  return {
    type: "form",
    prompt,
    before: formWithAnswer.slice(0, match.index).trimEnd(),
    answer,
    after: formWithAnswer.slice((match.index ?? 0) + match[0].length).trimStart(),
    note,
  };
}

function parseFormObject(item: Record<string, unknown>): Partial<FormExercise> | null {
  const prompt = stringValue(item.prompt);
  const answer = stringValue(item.answer);
  if (!prompt || !answer) return null;
  const before = stringValue(item.before ?? item.prefix);
  const after = stringValue(item.after);
  return {
    type: stringValue(item.type) || "form",
    prompt,
    before,
    answer,
    after,
    result: stringValue(item.result) || `${before}${answer}${after}`,
    note: stringValue(item.note),
  };
}

function splitImportLine(line: string, minParts: number) {
  const parts = line.split("--").map((part) => part.trim());
  if (parts.length < minParts || parts.slice(0, minParts).some((part) => !part)) return null;
  return parts;
}

function hasTextGaps(value: string) {
  return /\{[^}]+\}/.test(value);
}

function normalizeDuplicateKey(...parts: string[]) {
  return parts.map((part) => part.trim().toLocaleLowerCase()).join("\u0001");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function localId(kind: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `custom-${kind}-${crypto.randomUUID()}`;
  return `custom-${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function customCounts(content: CustomPackageContent | undefined) {
  const words = content?.words.length ?? 0;
  const texts = content?.texts.length ?? 0;
  const forms = content?.forms.length ?? 0;
  const wordSets = content?.wordSets.length ?? 0;
  return { words, texts, forms, wordSets, total: words + texts + forms + wordSets };
}

function countLine(words: number, texts: number, forms: number, wordSets = 0) {
  return `${words} words · ${texts} texts · ${forms} forms${wordSets ? ` · ${wordSets} sets` : ""}`;
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
