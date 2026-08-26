# Product Contract

## Product

WellCanvas is a private, mobile-first tracker for food, hydration, activity and weight.

Tagline: "Your health tracker, stored locally and shaped by you."

## First Milestone

The first milestone is a local prototype. It should make the core daily flows visible without adding backend services, authentication, barcode scanning, AI features, or complicated architecture. Browser `localStorage` may be used for device-local prototype persistence.

## Core Promise

Daily logging should be extremely quick. Adding a habitual meal should eventually take no more than two taps.

## Initial Routes

- `/` - Today
- `/foods` - Foods and saved meals
- `/activity` - Activity
- `/weight` - Measurements
- `/settings` - Profile, daily targets, appearance, calendar and about
- `/about` - About WellCanvas

## Nutrition Principles

- Show progress targets for protein and fibre.
- Show upper-limit indicators for saturated fat and sodium.
- Hydration belongs on Today and should show total fluids and plain water separately.
- Caloric drinks may contribute to nutrition totals, but drinks must not be double counted as food-log entries.
- Reusable library drinks should log through hydration rather than creating food-log entries.
- Today daily metrics must distinguish goals, upper limits and calorie reference values with visible text, not colour alone.
- Avoid moral language about foods.
- Keep controls large enough for fast phone use.
- Keep the desktop layout calm and usable without creating a separate desktop product.
- Offer manual daily targets and optional recommended starting targets.
- Nutrition and hydration targets should share one Settings editor and save flow.
- Recommended calories estimate maintenance only and do not create weight-loss targets.
- Automatic numerical recommendations are for adults aged 18 or older.

## Personalization Principles

- Profile and appearance settings are optional and private to the current browser.
- WellCanvas should remain usable without registration or a completed profile.
- Appearance changes must never reset or modify health records.
- Profile-photo crop position and zoom are presentation metadata and must not rewrite or replace the original stored image.
- Built-in decorative backgrounds must be local static assets. Automatic background rotation is optional, deterministic from local timestamps, and must not require network services or change health records.
- Optional delight features such as the daily fortune cookie must stay local, compact, non-intrusive, and free of streaks, notifications, countdowns, ads, or network requests.
- Settings should use compact progressive-disclosure cards rather than showing every detailed form by default.
- Settings should contain global preferences only; Measurements and Personal trackers should be managed in their own interfaces.
- Readability takes priority over decorative backgrounds or transparency.
- Text that sits directly over wallpaper must use a lightweight shared contrast treatment rather than relying on the background image being dark or bright enough.
- Navigation icons may support recognition, but visible text labels must remain.

## Food Library Principles

- Food items are reusable components; meal templates are combinations of food items and quantities.
- Foods should present one user-facing library catalogue; internal food and meal template types should not be exposed as top-level navigation concepts.
- Versioned seed packs can provide starter data, but imported seed data must not overwrite personal edits.
- One small neutral starter library may be offered as an optional first-run aid; personal or regional libraries should be distributed as separate food packs.
- Food category describes generic type, while collection describes place, brand, store, or personal grouping.
- Food and beverage browsing should be separated into compact horizontal rows so drink creation and drink logging are discoverable.
- Individual library items may be hidden from default browsing without deletion; hidden items must remain searchable and restorable.
- Starter packs may cover practical generic examples, but entries remain estimates unless replaced by package-label or user-confirmed nutrition.
- Habitual meals may be built from reusable component foods through a plate builder.
- Unfamiliar meals may be logged through transparent component-based estimates with visible uncertainty.
- Quick snack estimates must use category-specific calorie densities; ice cream and fried foods must not be estimated with a universal snack density.
- Restaurant combinations are reusable templates for the user and are not necessarily official restaurant sets.
- Restaurant entries should be populated gradually from actual orders, photographs, menus, or nutrition labels.
- Missing nutrition is distinct from zero.
- Creating a reusable food, meal, or drink should require only a name. Optional serving, nutrition, metadata and components can be added progressively.
- Official, estimated, user-confirmed, and missing statuses must remain visible.
- Factual nutrition-signal badges are allowed, but permanent healthy/unhealthy labels, scores, grades, and traffic-light morality are not.
- AI assistance is manual copy/paste only; changes require validation and approval.
- Manual AI imports must require structured JSON, validation, duplicate review, and explicit approval before creating personal foods or meals.
- Reference photos are local review aids only. They stay private in the current browser, are stored outside localStorage, and must be attached manually to any external AI conversation.
- Personal 1-5 star ratings are allowed for reusable foods, meals, and drinks as subjective preference. They must not be displayed or interpreted as health scores.
- Shareable food packs must contain reusable catalogue data only and must not include profile information, daily logs, measurements, trackers, hydration history, or activity history.

## Portability Principles

- A full WellCanvas backup is private and may replace the current local state only after manifest validation, preview, and explicit confirmation.
- A food pack is shareable and merge-oriented. Duplicate handling should preserve local records unless the user explicitly chooses otherwise.
- Export and import must run locally in the browser and must not upload user data to a server.

## Food Logging Principles

- Logged entries store nutrition snapshots to preserve historical data.
- Manual nutrition corrections affect future logs only; historical snapshots remain unchanged.
- Saved meal templates should be quick to add to Today.
- Custom foods may be saved for reuse, saved and logged, or logged once without saving.
- Today totals must come from real logged entries.
- Missing nutrition remains distinct from zero in daily totals.
- Removing a logged entry must not remove the underlying library item.
- Subjective notes such as fullness may be stored privately but must not alter nutrition calculations.
- Red interface styling is reserved for destructive actions and errors.
- Food-library cards should support one-click "Add today" logging with clear adding and added feedback while preserving optional precise logging through overflow/actions.

## Activity Principles

- Activity logging may cover walking, running, sports, cycling, treadmill sessions, strength training, and other movement.
- The Activity page should be weekly-first: weekly overview, quick logging, saved workouts, workout library, and recent history. Today's detailed activity records belong on Today.
- Use "Estimated active energy" rather than "Calories burned."
- Active energy must not automatically increase food targets or create net calories.
- Activity insights must be neutral and must not recommend exercise as punishment, food as reward, or food restriction after rest days.
- Activity insights should appear on Today only, at most one at a time, and be dismissible for the current local day.
- Strength training logs may capture exercises, sets, repetitions, and load, but energy estimates should remain based on duration and intensity.
- Weekly activity plans are editable and optional.
- Weekly activity plans should be edited from Activity through a compact editor, not shown as a permanent form during ordinary use.
- Saved workouts may be simple or structured. Structured workouts should log one historical ActivityEntry with a workout snapshot so future template edits do not rewrite past sessions.
- Starter workouts are copied into saved workouts rather than automatically installed.
- Today should summarize activity planning in weekly context so a normal rest day does not look like underperformance.
- Week summaries should use local calendar boundaries and the user's Monday/Sunday week-start preference.
- Day-scoped views should refresh automatically after local midnight, browser sleep, focus, visibility restoration or `pageshow` without deleting older records.
- Profile focus is contextual only and must not automatically modify nutrition targets.

## Personal Tracker Principles

- Custom trackers should use one generic model rather than separate hard-coded implementations for each personal metric.
- Trackers may be goals, upper limits, or log-only records.
- Upper-limit trackers must use neutral recorded, maximum, remaining, or over-limit wording, never completion wording.
- Zero is a valid target or upper limit and must not cause unsafe ratios or division-by-zero behaviour.
- Trackers may aggregate by sum, average, latest value, or count across a daily, weekly, or monthly period.
- Walking, sleep, weekly workouts, caffeine, cigarettes, alcohol, and blank custom trackers may be offered as editable templates.
- Cigarette and alcohol templates are optional reduction or abstinence trackers only; they must not be installed by default or praised as consumption goals.
- Pinned Today trackers should remain compact and limited so the dashboard stays readable.
- Pinned Today trackers should appear as compact rows in the overview column below weekly Activity.
- Tracker row `+` actions should open an editable amount/value dialog rather than forcing the configured quick increment.
- Custom trackers must not automatically change food, hydration, activity, weight, or nutrition targets.

## Measurements Principles

- The `/weight` route remains for compatibility, but the visible page is Measurements.
- Measurements are point-in-time variables such as Weight, Height, Waist, or Hair length.
- Cumulative behaviours such as steps, alcohol, caffeine, cigarettes, and workout sessions belong in Personal trackers instead.
- Existing weight records must migrate into generic measurement variables without deleting legacy weight keys.
- A measurement variable may have one reading or many; it becomes a trend naturally as more readings are added.
- The graph must display only the selected variable and must never mix incompatible units on one Y-axis.
- Measurement variable chips should scroll horizontally when too many variables exist and must not overlap the graph.
- Variables may be archived while preserving readings, restored later, or explicitly deleted with readings after confirmation.
- Hydration or weight changes must never automatically alter calorie or nutrition targets.
