export type DailyFortuneCategory =
  | "encouragement"
  | "curiosity"
  | "focus"
  | "creativity"
  | "patience"
  | "connection"
  | "rest"
  | "playful"
  | "perspective"
  | "small-adventure";

export type DailyFortune = {
  id: string;
  text: string;
  category: DailyFortuneCategory;
};

const categories = [
  "encouragement",
  "curiosity",
  "focus",
  "creativity",
  "patience",
  "connection",
  "rest",
  "playful",
  "perspective",
  "small-adventure",
] as const satisfies DailyFortuneCategory[];

const encouragementSeeds = [
  "small step",
  "steady choice",
  "quiet beginning",
  "honest attempt",
  "gentle effort",
  "brave pause",
  "simple start",
  "clear yes",
  "patient try",
  "kind decision",
];

const curiositySeeds = [
  "ordinary shelf",
  "passing question",
  "half-noticed sound",
  "familiar corner",
  "open tab",
  "old note",
  "new word",
  "small pattern",
  "quiet detail",
  "unexpected clue",
];

const focusSeeds = [
  "one sentence",
  "single task",
  "tidy list",
  "next page",
  "clear reply",
  "small repair",
  "opened file",
  "first draft",
  "short errand",
  "finished note",
];

const creativitySeeds = [
  "rough sketch",
  "strange idea",
  "messy draft",
  "side path",
  "borrowed color",
  "fresh rhythm",
  "crooked line",
  "curious phrase",
  "loose plan",
  "playful mistake",
];

const patienceSeeds = [
  "slow answer",
  "quiet progress",
  "delayed reply",
  "unseen root",
  "careful pause",
  "gradual change",
  "soft waiting",
  "longer route",
  "steady return",
  "unfinished lesson",
];

const connectionSeeds = [
  "warm message",
  "honest thanks",
  "shared laugh",
  "small invitation",
  "careful question",
  "remembered detail",
  "kind check-in",
  "open chair",
  "good listening",
  "simple hello",
];

const restSeeds = [
  "quiet minute",
  "unhurried breath",
  "empty margin",
  "soft reset",
  "closed screen",
  "clearer evening",
  "slow stretch",
  "gentle stop",
  "still pocket",
  "peaceful pause",
];

const playfulSeeds = [
  "mysterious spoon",
  "dramatic sock",
  "cheerful typo",
  "tiny parade",
  "secretly heroic mug",
  "overconfident bookmark",
  "wobbly plan",
  "suspiciously neat drawer",
  "accidental theme song",
  "tiny confetti moment",
];

const perspectiveSeeds = [
  "minor delay",
  "awkward moment",
  "unexpected detour",
  "changed plan",
  "small mistake",
  "odd coincidence",
  "missed turn",
  "messy morning",
  "quiet setback",
  "unfinished errand",
];

const adventureSeeds = [
  "different doorway",
  "new side street",
  "untried cafe",
  "fresh playlist",
  "nearby bench",
  "later sunset",
  "unfamiliar aisle",
  "extra block",
  "small window",
  "new shortcut",
];

function encouragement(seed: string) {
  return [
    `A ${seed} can still change the shape of the day.`,
    `Let one ${seed} prove that movement does not need drama.`,
    `Your ${seed} counts, even before anyone else notices.`,
    `A calm ${seed} may become tomorrow's useful momentum.`,
  ];
}

function curiosity(seed: string) {
  return [
    `The ${seed} may be more interesting than it first appears.`,
    `Ask one better question about the ${seed} today.`,
    `A patient look at the ${seed} may reveal a useful thread.`,
    `Curiosity may turn the ${seed} into a small discovery.`,
  ];
}

function focus(seed: string) {
  return [
    `Give the ${seed} your full attention for a little while.`,
    `The ${seed} may matter more than three scattered beginnings.`,
    `Finishing the ${seed} can make the rest feel lighter.`,
    `A clear ${seed} is enough work for this moment.`,
  ];
}

function creativity(seed: string) {
  return [
    `The ${seed} may be the doorway to a better version.`,
    `Let the ${seed} be imperfect long enough to teach you.`,
    `A surprising ${seed} can loosen the whole idea.`,
    `Today, the ${seed} deserves room before judgment arrives.`,
  ];
}

function patience(seed: string) {
  return [
    `The ${seed} may be working where measurement cannot reach yet.`,
    `Give the ${seed} a little more time to become clear.`,
    `Patience can make the ${seed} easier to understand.`,
    `The ${seed} is allowed to unfold without applause.`,
  ];
}

function connection(seed: string) {
  return [
    `A ${seed} may brighten more than the obvious moment.`,
    `Offer the ${seed} without making it heavy.`,
    `The right ${seed} can make ordinary time feel warmer.`,
    `A sincere ${seed} is a small bridge worth building.`,
  ];
}

function rest(seed: string) {
  return [
    `A ${seed} can be part of moving forward.`,
    `Let the ${seed} make a little room around the day.`,
    `The ${seed} may return more clarity than it costs.`,
    `A well-kept ${seed} can hold the next good step.`,
  ];
}

function playful(seed: string) {
  return [
    `The ${seed} seems ready to improve morale without permission.`,
    `A ${seed} may be the unofficial mascot of today.`,
    `Trust the ${seed} to add a harmless twist to the plot.`,
    `If the ${seed} had a meeting, it would arrive early.`,
  ];
}

function perspective(seed: string) {
  return [
    `Today's ${seed} may become a useful story later.`,
    `The ${seed} is not the whole map, only one marker.`,
    `A wider view may make the ${seed} feel smaller.`,
    `The ${seed} might be less important than the response it teaches.`,
  ];
}

function smallAdventure(seed: string) {
  return [
    `Try the ${seed} and notice one detail you usually miss.`,
    `A ${seed} may give the day a fresh corner.`,
    `Choose the ${seed} if it asks only a little courage.`,
    `The ${seed} could make ordinary time feel lightly new.`,
  ];
}

const textGroups = {
  encouragement: encouragementSeeds.flatMap(encouragement),
  curiosity: curiositySeeds.flatMap(curiosity),
  focus: focusSeeds.flatMap(focus),
  creativity: creativitySeeds.flatMap(creativity),
  patience: patienceSeeds.flatMap(patience),
  connection: connectionSeeds.flatMap(connection),
  rest: restSeeds.flatMap(rest),
  playful: playfulSeeds.flatMap(playful),
  perspective: perspectiveSeeds.flatMap(perspective),
  "small-adventure": adventureSeeds.flatMap(smallAdventure),
} satisfies Record<DailyFortuneCategory, string[]>;

export const dailyFortunes: DailyFortune[] = categories.flatMap((category, categoryIndex) =>
  textGroups[category].map((text, index) => ({
    id: `fortune-${String(categoryIndex * 40 + index + 1).padStart(3, "0")}`,
    text,
    category,
  })),
);

export function validateDailyFortunes(fortunes = dailyFortunes) {
  const recognizedCategories = new Set<DailyFortuneCategory>(categories);
  const ids = new Set<string>();
  const texts = new Set<string>();

  if (fortunes.length !== 400) {
    throw new Error(`Daily fortune catalogue must contain 400 records, found ${fortunes.length}.`);
  }

  for (const fortune of fortunes) {
    if (!/^fortune-\d{3}$/.test(fortune.id)) {
      throw new Error(`Invalid fortune ID: ${fortune.id}`);
    }
    if (ids.has(fortune.id)) {
      throw new Error(`Duplicate fortune ID: ${fortune.id}`);
    }
    ids.add(fortune.id);

    const normalizedText = fortune.text.trim().toLowerCase();
    if (!normalizedText) {
      throw new Error(`Empty fortune text: ${fortune.id}`);
    }
    if (texts.has(normalizedText)) {
      throw new Error(`Duplicate fortune text: ${fortune.text}`);
    }
    texts.add(normalizedText);

    const wordCount = fortune.text.trim().split(/\s+/).length;
    if (wordCount < 5 || wordCount > 22) {
      throw new Error(`Fortune text length is out of range: ${fortune.id}`);
    }
    if (!recognizedCategories.has(fortune.category)) {
      throw new Error(`Unrecognized fortune category: ${fortune.category}`);
    }
  }
}

if (process.env.NODE_ENV !== "production") {
  validateDailyFortunes();
}
