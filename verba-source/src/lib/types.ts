export type WordPair = {
  id: string;
  term: string;
  translation: string;
  custom?: boolean;
  ro?: string;
  en?: string;
};

export type WordSet = {
  id: string;
  packageId: string;
  title: string;
  wordIds: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type ContentSet = {
  id: string;
  packageId: string;
  type: "texts" | "forms";
  title: string;
  itemIds: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type TextExercise = {
  id: string;
  title: string;
  text: string;
  translation: string;
  translationLanguage?: string;
  custom?: boolean;
};

export type FormExercise = {
  id: string;
  type: string;
  prompt: string;
  before: string;
  answer: string;
  after: string;
  result: string;
  note: string;
  custom?: boolean;
  prefix?: string;
};

export type CharacterSubstitutions = Record<string, string[]>;

export type PackageMetadata = {
  id: string;
  language: string;
  languageCode: string;
  variant: string;
  level: number;
  title: string;
  description: string;
  version: number;
  wordCount: number;
  textCount: number;
  formCount: number;
  characterSubstitutions?: CharacterSubstitutions;
  preferredTranslateDirection?: "term-to-translation" | "translation-to-term";
  source?: "catalog" | "local";
};

export type ReferenceFact = {
  id: string;
  label: string;
  value: string;
  translation?: string;
};

export type ReferenceText = {
  title: string;
  text: string;
  translation: string;
};

export type AnthemReference = {
  title: string;
  name: string;
  nameTranslation?: string;
  description: string;
  lyrics?: string;
  translation?: string;
};

export type FlagReference = {
  title?: string;
  asset: string | {
    src: string;
    alt?: string;
  };
  aspectRatio?: string;
  colorsLocal?: string;
  colorLabel?: string;
  descriptionLocal?: string;
  translationLabel?: string;
  description?: string;
  label: string;
  translation?: string;
};

export type CivicReference = {
  title: string;
  country?: string;
  citizenshipPledge?: ReferenceText;
  oath?: ReferenceText;
  anthem?: AnthemReference;
  facts: ReferenceFact[];
  flag?: FlagReference;
};

export type PackageCatalogItem = PackageMetadata & {
  path: string;
};

export type PackageCatalog = {
  version: number;
  packages: PackageCatalogItem[];
};

export type CoursePackage = {
  metadata: PackageMetadata;
  words: WordPair[];
  texts: TextExercise[];
  forms: FormExercise[];
  reference?: CivicReference;
};

export type PortableVerbaPackage = {
  format: "verba-package";
  formatVersion: 1;
  exportedAt?: string;
  metadata: Partial<PackageMetadata> & {
    title: string;
  };
  words: WordPair[];
  texts: TextExercise[];
  forms: FormExercise[];
  wordSets?: WordSet[];
  textSets?: ContentSet[];
  formSets?: ContentSet[];
  reference?: CivicReference;
};

export type CustomPackageContent = {
  packageId: string;
  words: WordPair[];
  texts: TextExercise[];
  forms: FormExercise[];
  wordSets: WordSet[];
  textSets: ContentSet[];
  formSets: ContentSet[];
};

export type CourseContent = CoursePackage;

export type CorrectionMode = "immediate" | "submit";
export type EndingMode = "tolerant" | "strict";
