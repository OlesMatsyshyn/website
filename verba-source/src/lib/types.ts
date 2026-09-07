export type WordPair = {
  id: string;
  term: string;
  translation: string;
  ro?: string;
  en?: string;
};

export type TextExercise = {
  id: string;
  title: string;
  text: string;
  translation: string;
  translationLanguage?: string;
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

export type CourseContent = CoursePackage;

export type CorrectionMode = "immediate" | "submit";
export type EndingMode = "tolerant" | "strict";
