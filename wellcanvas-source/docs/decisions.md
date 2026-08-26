# Decisions

## Keep the Prototype Local

The first milestone uses local-only state so the daily interaction model can be evaluated before accounts, backend storage, or integrations are introduced.

## Brand as WellCanvas

The visible product name is WellCanvas, with the tagline "Your health tracker, stored locally and shaped by you." Branding changes do not rename existing localStorage or IndexedDB keys because those keys preserve access to current local user data.

## Use MIT License

The source is distributed under the MIT License without extra non-commercial restrictions. The About page and README mention the licence, while the full terms live in the root `LICENSE` file.

## Keep Personalization Local

Profile and appearance preferences are local browser settings. The profile key is `health-tracker-pwa.profile.v1`; the appearance key is `health-tracker-pwa.appearance.v1`. Saving or resetting appearance never modifies nutrition targets, foods, meal templates, food logs, weight entries, or starter-pack records.

## Serve Bundled Images from public

The supplied project images are copied into `public/img` and served as static files. The original `img` folder remains untouched. Background images are referenced by URL paths rather than imported into JavaScript bundles.

## Reuse IndexedDB Image Storage

Uploaded profile photos reuse the existing IndexedDB database `health-tracker-pwa.reference-photos` and object store `photos`. Profile localStorage keeps only the uploaded photo ID and metadata; large image blobs are not stored in localStorage.

## Theme with CSS Custom Properties

Accent themes are implemented with `--accent`, `--accent-hover`, `--accent-soft`, `--accent-contrast`, and `--focus-ring`. The selected accent affects navigation, add actions, selected tabs/chips, links, focus rings, and progress fills while preserving semantic nutrition statuses, errors, and destructive red actions.

## Prioritize Readability Over Transparency

Backgrounds are fixed full-app images with a dimming overlay. Panel modes include Solid, Soft transparency, and Glass, but inputs remain nearly opaque and reduced-transparency preferences fall back to more opaque surfaces.

## Use Generated PNG Navigation Icons

Bottom navigation icons are generated PNG assets copied into `public/icons` and referenced through one shared `WellCanvasIcon` component. Labels remain visible, decorative icon instances use empty alt text, and filename-to-route mapping stays centralized rather than scattered through pages.

Today switches between the sun and moon icons in guarded client-side state, rendering a same-size placeholder before hydration to avoid server/client image mismatches. The fortune button uses cookie and opened-cookie PNG states with identical dimensions while retaining the existing once-per-local-day behaviour.

## Use Modal Add Flows on Today

Today keeps add flows out of inline page expansion. Ration, Hydration, and Activity each expose one compact header action; detailed editing and removal live in drill-down dialogs instead of default dashboard rows.

## Group Today Food Logs as Ration

The daily food log is labelled Ration on the dashboard. Matching logged foods or meals may be aggregated visually for scanning, while the underlying `FoodLogEntry` records remain independent and can be edited or removed from detail dialogs.

## Keep Today as a Dense Dashboard

The Today page favours a compact dashboard shape: one greeting/avatar identity block, a dense overview with daily balance bars on the left and weekly activity plus pinned personal trackers on the right, then a three-column Today panel for Ration, Hydration, and Activity. The standalone full-width tracker section was removed to keep the upper dashboard dense.

Pinned personal trackers use compact rows in the overview column. Desktop keeps the Activity summary fixed and bounds only the tracker-list region to roughly three rows with its own subtle scroll when needed. Mobile shows the first three pinned trackers and a View all action rather than introducing nested scrolling.

## Use localStorage for Hydration

Hydration entries are stored under `health-tracker-pwa.hydration-entries.v1`, and hydration preferences are stored under `health-tracker-pwa.hydration-preferences.v1`. Hydration remains on Today because it is a daily log, not a reusable food catalogue.

## Separate Plain Water from Total Fluids

Tap water, still water, and unsweetened sparkling water count as plain water. Soda and other drinks count toward total fluids but are not labelled as water. The general guide is approximately 1.5-2.0 L of drinks per day, and the target remains editable.

## Count Caloric Drinks Once

Caloric drinks contribute to Today nutrition totals from hydration entries directly. The app does not create duplicate food-log entries for drinks, so editing or removing a drink updates both fluid and nutrition totals from the same record.

Reusable drink records may live in the unified food library as `FoodItem` records with `logDestination: "hydration"`. Their library card creates a `HydrationEntry`, not a `FoodLogEntry`, so reusable drinks can be searched and reused without double-counting calories.

## Split Food and Beverage Browsing

The Foods catalogue uses separate scrollable Food and Beverage filter rows so drink-specific destinations such as Coffee / tea, Water, Juice, and Milk / dairy are visible without mixing them into ordinary food categories. Contextual `+ Add` actions use the current group to preconfigure the simplified create form as a food, meal, or drink.

## Keep Personal Ratings Subjective

Reusable foods, meals, and drinks may store a 1-5 `userRating` as personal preference only. Ratings are not health scores, nutrition quality scores, or medical advice. Food packs preserve the pack creator's rating separately as `creatorRating` so imported packs do not overwrite the importing user's own rating.

## Hide Library Items Non-Destructively

Item-level browsing visibility is stored outside seed records under `health-tracker-pwa.library-visibility.v1` using stable keys such as `food:<id>` and `meal:<id>`. Hiding removes an item from default browsing and category views, but it remains searchable, usable, referenced by meals, and available for historical log snapshots. Undo and Manage hidden items restore visibility without deleting data.

## Use Compact Daily Metric Bars on Today

Today uses compact horizontal bars for calories, protein, fibre, hydration, saturated fat, and sodium. The reusable SVG torus component remains available elsewhere, but the Today dashboard uses denser rows. Protein, fibre, and hydration are goals. Saturated fat and sodium are labelled as upper limits, and filling those bars is not presented as desirable. Calories are a neutral daily reference.

## Use Local Calendar Boundaries

Calendar preferences are stored under `health-tracker-pwa.calendar-preferences.v1`, with Monday as the default week start and Sunday available in Settings. Weeks start at local 00:00 on the selected weekday; they are not anchored to installation or first use.

The app shell runs a small client-side local-calendar watcher. It schedules the next check for just after local midnight and also checks on focus, visibility restoration, and `pageshow` so browser sleep or suspended timers do not leave Today showing yesterday's day-scoped data. When the local date changes it dispatches `health-tracker:local-day-changed`; listeners reload local browser state without deleting or rewriting historical records.

## Keep Daily Fortunes Local and Optional

The Today fortune cookie is a compact optional delight feature. It stores only local state under `health-tracker-pwa.daily-fortune.v1`: an anonymous browser seed, local date key, revealed fortune ID, reveal time, and recent fortune IDs. The selected phrase is derived from the browser seed and local date with a stable hash, then advanced when possible to avoid IDs used in the recent history.

A fortune is marked revealed only when the user presses the cookie button. Reopening it during the same local day shows the same phrase, and the existing local-day watcher clears the revealed state on the next day. The feature intentionally has no streaks, notifications, countdowns, sharing prompt, penalties, or network requests.

## Keep Legacy Weight Storage for Recovery

Weight slot settings are stored under `health-tracker-pwa.weight-measurement-slots.v1`, and readings are stored under `health-tracker-pwa.weight-readings.v2`. The old key `health-tracker-pwa.weight-entries.v1` is preserved for migration safety.

## Migrate Weight Into Measurements Without Deleting History

Existing morning and evening records are first migrated once into v2 readings and linked to the default Morning and Evening slots. Generic Measurements then migrates those slots/readings once into `health-tracker-pwa.measurement-variables.v1` and `health-tracker-pwa.measurement-readings.v1` with marker, colour, active/archive, primary, date, time, value, and notes preserved. The old nested and v2 records are not erased.

## Separate Measurements from Personal Trackers

Measurements are point-in-time variables such as Weight, Height, Waist, or Hair length. Cumulative behaviours such as steps, caffeine, cigarettes, alcohol, screen time, and workout sessions remain Personal trackers because they aggregate behaviour over a day, week, or month.

Pinned tracker rows use a generic `+` action rather than showing the configured increment. The `+` opens a manual-value dialog; `quickIncrement` remains part of the tracker model only as a suggested/default value for entry.

## Graph One Measurement Unit at a Time

The Measurements graph displays only the selected variable, so incompatible units such as kg and cm are never overlaid on one axis. A single reading displays as one point; multiple readings form a trend. Latest, averages, changes, min and max use the selected variable's unit.

The measurement variable selector is a single non-wrapping horizontal strip. Only that strip scrolls when too many variables exist, and the selected chip is scrolled into view so the graph panel is not squeezed or overlapped.

## Archive Measurements Before Destructive Deletion

Archived measurement variables disappear from the ordinary chip row but preserve readings and remain restorable in Manage. Deleting a variable with readings requires an explicit destructive choice. Deleting an empty user-created variable is supported, and the final active variable cannot be accidentally removed.

User-created measurement chips expose a compact remove control so test variables can be cleaned up without entering Manage. Empty variables can be removed after a compact confirmation. Variables with readings default to Archive, with permanent deletion requiring a second explicit confirmation. If removal would leave no active measurement, the default Weight variable is restored or created as the active primary fallback.

## Use localStorage for Nutrition Targets

Nutrition targets are stored in `localStorage` under `health-tracker-pwa.nutrition-targets.v1`. Recommendation form inputs are stored separately under `health-tracker-pwa.recommendation-profile.v1` so the form remains filled after reloads.

## Use localStorage for Activity

Activity entries are stored under `health-tracker-pwa.activity-entries.v1`, templates under `health-tracker-pwa.activity-templates.v1`, and the weekly activity plan under `health-tracker-pwa.activity-preferences.v1`. These records are separate from food logs, weight records, profile settings, and nutrition targets.

## Estimate Active Energy, Not Food Allowance

Activity uses estimated active energy rather than "calories burned." Estimates are never automatically added to food targets, never used to create net calories, and never used to recommend food restriction or food rewards.

## Exclude Resting Energy from Activity Estimates

MET estimates use `max(MET - 1, 0) * 3.5 * weightKg / 200 * durationMinutes`. Subtracting one MET prevents normal resting energy from being presented as exercise energy.

## Snapshot Activity Weight

Activity estimates snapshot the weight used when the entry is created or recalculated. The source priority is latest primary weight on or before the activity date, then morning weight, then recommendation-profile weight, then no estimate. Later weight edits do not rewrite historical activity entries.

## Keep Strength Energy Simple

Strength training can record sets, repetitions, load, and exercise notes, but active-energy estimates use session duration and intensity. The app does not calculate one-repetition maximums or convert lifted kilograms into calories.

## Keep Activity Insights Neutral

Activity insights are deterministic and limited. They can mention weekly plan progress, recent inactivity, strength days, and protein context after strength training, but they do not alter calorie or protein targets and do not use punishment, reward, streak-loss, or compensation language.

Insights appear on Today only, where they can support the daily dashboard without duplicating the Activity page. Today shows at most one compact dismissible insight at a time, and dismissal is scoped to the current local date so the message can return on a later day when still relevant.

## Make Activity Weekly-First

The Activity page is for reviewing weekly activity, quick logging, reusing saved workouts, and browsing recent history. It no longer includes a prominent Today summary, permanent insights panel, always-visible weekly-plan form, or full history list in the default page flow. Today remains the place for today's activity records; Activity uses weekly context so rest days do not read as underperformance.

Desktop Activity overview follows the Measurements pattern: compact recent rows sit on the left, while the weekly statistics, graph, navigation, and Edit plan action sit on the right. Mobile keeps the weekly graph before recent activity.

The weekly plan remains activity-specific rather than a global Setting. It opens from `Edit plan` inside the weekly overview and saves planned moderate-equivalent minutes, planned strength days, and activity-insight visibility under the existing activity-preferences key.

## Snapshot Structured Workouts

Activity templates can be simple or structured saved workouts. Structured workouts store ordered workout steps, but logging one still creates a single `ActivityEntry`; active-energy estimation remains based on duration, intensity, activity type, and weight snapshot rather than sets, repetitions, or load.

When a structured workout is logged, the entry stores a workout snapshot containing the performed workout name and steps. Editing, archiving, or deleting the reusable workout later does not rewrite historical activity entries.

Starter workouts are general examples that users copy into their saved workouts before editing or logging. They are not installed automatically and do not overwrite user-created templates.

## Keep Profile Focus Contextual

The optional profile focus is recommendation context only. It does not automatically change nutrition targets, create calorie deficits or surpluses, or generate body-size advice.

## Separate Foods from Meal Templates

Food items are reusable atomic components with serving and nutrition metadata. Meal templates reference food item IDs plus quantities so substitutions like two versus three eggs, half versus full chilli-crab toast, or black versus white coffee do not duplicate every ingredient.

## Present One Unified Food Library

The Foods page presents one user-facing catalogue instead of separate Saved meals, Individual foods, and Starter packs tabs. `FoodItem` and `MealTemplate` remain separate internal types because meal templates, Build a plate, nutrition calculations, and historical food-log snapshots depend on that distinction.

## Group Library Entries with collectionName

Foods and meal templates include an optional `collectionName` string for lightweight grouping by place or collection. There is no separate collection table yet. Older localStorage entries safely read this as `null`, while imported seed entries receive default groups only when they are seed items and the existing collection is empty.

## Keep Category Separate from Collection

Food items include a lightweight `category` for generic food type, while `collectionName` remains the visible place, restaurant, store, or personal group. For example, a reusable cafe lunch can be `restaurant-meal` in category and keep the cafe name in collection. Older records that do not contain `category` are read safely and inferred conservatively without duplicating or replacing stored entries.

The catalogue normalizes broad display groups without rewriting stored user data. User-created collection names remain available through search, cards, and details.

## Use a Responsive Library Grid

Saved meals and individual foods use a compact card grid: one column on phones, two columns from medium widths, and three columns on larger desktop widths. Group sections are expanded by default and collapse only in component state.

## Version Seed Packs

The public distribution ships with one optional neutral starter pack, `wellcanvas-starter-foods-v1`. It contains a small set of generic foods and drinks for first-run exploration and is imported only by explicit user action. Personal or regional libraries should be exported and distributed separately as food packs so new users do not inherit someone else's catalogue.

## Compose Plates from Components

Build a plate stores selected starch, vegetables, protein, extras, sauces, and preparation choices as ordinary meal-template components. Saved plates become normal `MealTemplate` records, and logged plates use the existing food-log nutrition snapshot system.

## Use Transparent Fallback Estimates

Quick meal estimate is for unfamiliar meals. It combines broad base, protein, vegetable, preparation, and sauce components, then applies amount consumed. Venue changes the uncertainty percentage only; it does not classify the meal. The fullness note is private context and never changes nutrition.

Quick snack estimate is for fast snack logging when the exact brand is unknown. It uses category-specific calorie densities rather than a universal 500 kcal per 100 g value: chips, cookies, chocolate, sweets, ice cream, fried snacks, pastries, and other snacks each have their own density and uncertainty. When a seeded generic snack matches the selected category, all nutrients scale from that item; when only calories are known, other nutrients remain `null`.

## Avoid Permanent Food Scores

The product may show factual nutrition-signal badges from explicit thresholds, but it does not create good/bad labels, letter grades, traffic lights, or a single health score. Red is reserved for destructive actions and errors.

## Populate Restaurants Gradually

Restaurant entries should be added gradually from a user's actual orders, photographs, menus, or nutrition labels rather than guessed in advance or bundled as someone else's default library.

## Keep Missing Nutrition Distinct from Zero

Nutrition values allow unknown nutrients to remain `null`. Meal totals are considered incomplete when any component lacks complete nutrition; missing values are not counted as zero.

## Make Creation Progressive

Creating a new food, meal, or drink requires only a name. Serving, nutrition, metadata, and meal components are optional progressive disclosures. New manual estimates default to `missing` when no nutrition is supplied and `estimated` when partial nutrition is typed; manual estimates are never labelled official by default.

## Separate Private Backups from Food Packs

A WellCanvas backup is a private portable copy of local WellCanvas browser state and may include personal settings plus history. A WellCanvas food pack is shareable catalogue data only: reusable foods, drinks, meals, metadata, nutrition, creator ratings, and meal dependencies. Food packs must not include profile data, daily history, measurements, trackers, hydration history, or activity history.

The v0.1 ZIP implementation runs client-side and stores entries without compression so export/import works offline once the app is loaded. Backup restore validates the manifest before writing and asks for explicit confirmation before replacing current local WellCanvas keys.

## Track Nutrition Confidence

Food entries use four statuses: official, estimated, user-confirmed, and missing. Official means restaurant or manufacturer source; estimated means derived from description, photo, or generic reference; user-confirmed means reviewed or corrected by the user.

## Show Estimates as Approximate

Estimated food and meal calorie totals use an approximation symbol. Official values are displayed without the symbol. Mixed meals containing estimated components are treated as estimated, and totals remain calculated from component foods rather than hard-coded.

## Use AI as a Manual Bridge

The app does not call an AI API. It prepares a structured prompt for copy/paste, validates pasted JSON, rejects unknown or duplicate IDs and invalid nutrition values, and requires explicit approval before applying updates.

Reference photos can support this manual bridge, but they are never copied into the prompt automatically. The prompt states that a reference photo exists and the user must attach it manually in the external ChatGPT conversation.

Foods has two manual AI flows: refinement of existing items, and `Add from AI` for importing new personal foods and optional meals. The import flow uses schema version `health-tracker-library-import-v1`, validates each food or meal independently, keeps unknown nutrients as `null`, detects likely duplicates by normalized name/collection/serving, and never overwrites official, user-confirmed, or seed data without explicit user choice.

## Put Library Tools After the Catalogue

Build a plate, quick estimates, manual add, starter-pack management, nutrition-label explanations, personal-library guidance, and duplicate-copy review live below the main catalogue under Library tools. Hydration is intentionally absent from Foods because hydration is a Today-page daily log.

## Review Duplicate Copies Explicitly

Likely accidental `Copy` entries are detected only when the clone points to an existing original, nutrition/components are unchanged, the name differs only by copy suffixes, and the copy is not referenced by meals or logs. The app offers Keep, Rename, or Delete copy, but it never deletes reusable records automatically. Historical food-log snapshots remain independent.

## Anchor Details and Editors Inline

Food and meal details, duplicate/edit panels, and review panels open in the card or page-action context that launched them. Page-level tools such as Build a plate and Quick snack open below the toolbar, while card-level panels open inside the clicked card so the user does not jump to the end of the page.

## Preserve Historical Logs During Corrections

Manual nutrition corrections update the reusable food-library item for future logging only. Existing food-log entries keep their stored nutrition snapshots and are not recalculated silently.

## Store Review Photos in IndexedDB

Review photos are compressed to a sensible maximum dimension in the browser and stored in IndexedDB database `health-tracker-pwa.reference-photos`, object store `photos`. Food and meal records keep only the photo record ID and metadata in localStorage so large image data is not placed in localStorage.

## Review Later Without Changing Nutrition

The "Doesn't look right?" workflow can mark foods or meals for later with a reason, note, and optional reference photo. This sets review metadata and a neutral badge, but it does not modify nutrition until the user manually corrects values or approves validated AI output.

## Store Food Log Snapshots

Food logs are stored under `health-tracker-pwa.food-log-entries.v1`. Each entry stores a nutrition snapshot and optional component snapshots, so future edits to the food library do not silently change historical logged meals.

## Derive Today Totals from Logs

Today totals are calculated from the current local calendar day's log entries. Known numeric values are summed, missing nutrients remain unknown, and incomplete totals are labelled instead of treating missing values as zero.

## Notify Same-Tab Food Log Writes

Food-log helpers dispatch `health-tracker:food-log-changed` after successful localStorage writes. Today listens to that event as well as the native `storage` event, because native storage notifications do not fire in the same browser tab that performed the write.

## Make Food Library Logging One-Click

Food-library card buttons use `Add today` for the common path. Meal templates immediately log one meal using the template meal type. Individual foods immediately log one serving using local-time meal-type inference. Optional precision paths such as Add with options or Add by grams remain in overflow menus. The button shows `Adding...` and then `✓ Added` only after the new log entry is verified in storage.

## Keep Today as a Compact Dashboard

Today shows Ration, Hydration, and Activity as compact dashboard columns with one integrated add action per section. Default rows stay scannable; timestamps, serving detail, edit, remove, and add-another controls move into detail dialogs opened from the information control.

## Keep Library Items Separate from Logs

Removing a log entry removes only that dated entry. It does not delete the reusable food item or meal template that was used to create the snapshot.

## Offer Two Target Modes

Settings supports manual targets and recommended starting targets. Manual editing always remains available, including after generated values have been copied into saved targets.

## Estimate Maintenance Only

Recommended calories estimate maintenance intake only. The app does not calculate deficits, weight-loss speed, target body weight, or exercise calories to eat back.

## Keep Automatic Targets Adult-Only

Automatic numerical recommendations are only generated for adults aged 18 or older. If the user is under 18 or marks that standard recommendations may not apply, the app explains the limitation calmly and leaves manual targets available.

## Recommendation Assumptions

Calories use the Mifflin-St Jeor resting-energy equation with broad movement and exercise categories. Activity factors range from 1.20 to 1.65 and are derived conservatively from daily movement plus exercise amount. Exercise type affects protein only.

## Use App Router Defaults

The project follows the standard Next.js App Router structure generated by `create-next-app`, with `src/app` routes and `@/*` imports.

## No External UI Library

The shell uses Tailwind CSS and semantic HTML only. This keeps the prototype readable and avoids early dependency decisions.

## Normalize Button Intent

Buttons use a small shared style system for primary accent actions, primary dark save actions, neutral outline secondary actions, quiet tertiary actions, and destructive red actions. Ordinary adjacent buttons keep visible gaps and rounded corners; only deliberate segmented selectors may visually join controls.

## Use Shared Spacing and Radius Tokens

WellCanvas uses one small set of CSS custom properties for page gutters, section/card/control radii, section/card padding, grid gaps, section gaps, and bottom-navigation clearance. Route content is padded by the app shell so pages keep consistent side gutters and final controls remain above the fixed bottom navigation.

Major surfaces use the section radius and padding tokens, while repeated item cards use the card radius and card padding tokens. Food-library groups keep padded headers and padded card grids inside one rounded section surface, and modals/menus use viewport-safe widths without clipping menus or focus rings through parent overflow rules.

## Use Overlay Toasts for Transient Feedback

Transient confirmations and informational messages use the global toast provider mounted in the app shell. Toasts are fixed near the top centre of the viewport, safe-area aware, semi-transparent, and rendered above modals without occupying document flow, so they do not shift page content.

The toast system shows one active toast at a time, suppresses near-duplicate messages, pauses dismissal while hovered or keyboard-focused, and respects reduced-motion preferences through opacity-only transitions. Success, information, warning, and error types include icons plus text rather than relying on colour alone.

Undo is included only when the app retains enough information to perform a real inverse action, such as removing a just-added log entry or restoring a hidden library item. Field validation and malformed-import errors remain inline where the user is editing the data.

## Use Compact Settings Cards

Settings uses four collapsed cards by default: Profile, Daily targets, Appearance and calendar, and About WellCanvas. Detailed forms open progressively instead of all being visible at once. The profile card reuses the existing recommendation-profile storage for age, height, weight, and energy equation so no competing personal measurement store is created.

Settings is reserved for global preferences. Measurements are managed on the Measurements page, and Personal trackers are managed through their creation/details flows, so Settings no longer duplicates those entry points.

Daily targets combines nutrition and hydration in one card. Manual targets and recommended targets are mutually exclusive editors; both can always be cancelled or closed. The old hydration `targetMode` preference remains readable for compatibility, but Settings now treats hydration as one saved numerical daily target.

Appearance and Calendar share one Settings card. Reset appearance restores the visual defaults only and does not reset the saved week-start preference.

The About page uses one cohesive article panel with section headings and subtle separators instead of separate dashboard cards for every paragraph.

## Store Photo Crop Metadata

Profile-photo repositioning is stored as `photoPositionX`, `photoPositionY`, and `photoZoom` on the local profile record. The original preset or IndexedDB-uploaded image is not destructively cropped; the same object-position and zoom metadata are applied wherever the circular avatar is shown.

## Use One Shared Avatar

Profile previews use a shared avatar component so Today, Settings, and the app shell apply the same preset/uploaded image source and crop metadata. The profile editor keeps image and form changes as draft state until "Save profile"; Cancel restores the last saved crop and profile display fields. Pointer drag, horizontal-position slider, vertical-position slider, and zoom slider all update the same draft crop metadata.

## Map Profile Crop to Real Overflow

Profile-photo positioning uses measured natural image dimensions and measured circular viewport dimensions. The image first scales to the minimum cover crop, then `photoZoom` applies additional zoom relative to that cover scale. Horizontal and vertical positions map from 0 to 100 across the actual pixel overflow in each axis. If an axis has no overflow, that axis does not pretend to move.

## Align Profile Photo Controls

Profile photo actions are presented as one readable 2 x 2 control grid: Replace photo, Use preset, Remove photo, and Reset position. Preset state is shown as a small factual badge rather than a focus-looking button style.

## Rank Active Food Search Before Recent Items

The Today Add food modal shows Recent, Saved meals, and Saved foods when the query is empty. Once the user types, Search results move directly under the input and Recent no longer appears above them.

## Weight Food Search Fields Explicitly

Food search normalizes case, whitespace, punctuation, apostrophes, and diacritics for matching only. Scores prioritize exact and prefix item-name matches, then whole-word and contained name matches, then collection and brand, then serving label. Description, source, assumptions, and component names are low-weight fallback fields, so incidental text cannot outrank an intentional name match such as Banana for `ban`.

## Bottom Navigation First

The primary navigation is fixed at the bottom because the product is intended for quick daily phone use.

## No Automatic Diet Reaction from Hydration or Weight

Hydration completion, multiple daily weight readings, evening weight, and single-day weight movement do not automatically change calorie or nutrition targets. Normal within-day variation is not described as fat gain or fat loss.

## Summarize Activity Weekly on Today

Today uses a compact weekly Activity summary instead of prominent daily-only activity boxes. The local calendar week starts on Monday. The summary counts sessions, active days, total minutes, moderate-equivalent minutes, strength days, and estimated active energy from existing ActivityEntry records. It does not modify nutrition targets or imply that rest days are failures.

## Use Generic Custom Trackers

Personal trackers are implemented as a generic local model rather than separate hard-coded systems for steps, sleep, caffeine, cigarettes, alcohol, or arbitrary behavioural quantities. Trackers store a kind, period, aggregation, target or maximum, quick increment, icon key, colour key, pin state, and enabled state. Entries store local date, local time, value, and note.

## Separate Goal, Upper-Limit, and Log-Only Semantics

Goal trackers represent quantities the user may want to reach. Upper-limit trackers represent quantities the user may not want to exceed and must use recorded/remaining language rather than completion language. Log-only trackers show values without target progress. Zero is valid for a goal or maximum, so UI and calculations must avoid division-by-zero assumptions.

## Aggregate Custom Trackers by Period

Custom tracker values are calculated with one shared pure aggregation utility. Sum adds values, average averages values, latest uses the latest local date/time value, and count counts entries. Daily trackers use the selected local date; weekly trackers use the selected local week; monthly trackers use the local calendar month from its first day through its final day.

Tracker entries are raw atomic records and remain the source of truth. `occurredAt` determines the period an entry belongs to, while `createdAt` records when it was entered into WellCanvas. Existing entries without `occurredAt` are normalized from their saved local `date` and `time`, preserving old IDs and storage keys. Period history is derived on demand from entries so retroactive adds, edits, and removals recalculate current and historical daily, weekly, or monthly totals without destructive rollover.

Tracker detail history belongs inside the details modal rather than the Today card. Current and previous periods expose their entries with Edit and Remove actions, and lightweight CSV export can download either the selected period or the tracker’s complete raw history.

## Keep Reduction Trackers Neutral

Cigarette and alcohol templates are optional and are not installed automatically. They are described only as reduction or abstinence tracking, use upper-limit semantics, and never encourage consumption or use celebratory completion language.

## Pin Only a Few Trackers to Today

Today uses compact pinned-tracker rows under the weekly Activity card. Desktop bounds only the row list when many are pinned; mobile shows the first three rows and a View all action. Tracker quick-add writes independent entries rather than merging records, and Undo removes only the just-created entry.

## Treat Customize Today as Presentation Only

Customize Today hides or shows modules without mutating their data. The Nutrition module owns Daily balance plus the Ration and Hydration lower sections; the Activity module owns Activity this week plus the lower Activity log section; Personal trackers owns only the pinned tracker dashboard block. Food, hydration, activity, and tracker records remain accessible through their normal pages and storage keys.

## Use a Compact Measurements Card

The `/weight` route remains for compatibility, but the visible page is Measurements. It uses one reusable measurement-card structure with header actions, entry controls, selected variable chips, compact summary metrics, and a Trend/Averages mode switch.

Migrated Morning weight is labelled simply as `Weight` in the interface while preserving the migrated ID and all reading relationships. The entry flow is a snapshot form ordered Value, Date, Time, optional note, and `Save snapshot`; summaries are shown above the graph beside the Trend/Averages control instead of duplicating beneath the form.

## Select One Measurement Variable for Entry

Measurements no longer renders a full input panel for every active variable. Enabled variables appear as compact chips, and the selected chip controls the single entry row. The `+ Add measurement` control opens a modal so ordinary entry does not rearrange the page.

## Move Measurement Administration to Modals

Measurement history and administration are not permanent page sections. `List` opens readings for the selected variable and includes a variable switcher. `Manage` opens variable administration for primary status, active/archive state, order, colour, marker, name, unit, and deletion without showing administrative controls during routine entry.

## Avoid Exaggerated Measurement Charts

Measurement charts use observed min/max values with padding. When all visible readings are identical, the chart uses a small symmetric display range and a flat line or single point so exact values remain visible without implying a meaningful trend.

## Neutral Nutrition Language

The interface uses target, progress, and upper-limit language. It does not label foods morally.

## Render Local App Icons Directly

Generated WellCanvas PNG icons are small local UI assets, so they use a plain `img` wrapper rather than Next image optimisation. The shared icon component has fixed dimensions, transparent output, and no React error-state fallback; visible fallback behaviour belongs in the caller, such as the app shell deciding between a hydrated profile avatar and the WellCanvas app icon.

## Keep Hydration-Sensitive Defaults Stable

Client components that depend on localStorage should render stable defaults during hydration and load saved browser state through effects or refresh paths. Today follows this for activity preferences so the server and first client render do not disagree about weekly activity target text.

## Apply Radius to Painted Today Surfaces

Rounded-corner fixes must target the element that owns the visible background, border, or shadow. Today keeps dashboard grid containers transparent and applies section or card radii directly to Daily balance, Activity this week, Personal trackers, Ration, Hydration, Activity, and related secondary surfaces.

## Prefer Plaques Over Floating Section Islands

Dense dashboard areas should use one major rounded plaque with internal sections before creating more standalone cards. Foods uses one catalogue plaque for all visible library groups, with group headers as subtle internal plaques. Today uses one overview plaque and one log plaque, with internal dividers for Ration, Hydration, Activity, and optional insight content.

## Keep PWA Icon Padding Separate from UI Branding

The generated WellCanvas app icon keeps generous transparent padding for installed-app use. In-app branding uses a separate cropped `wellcanvas-ui.png` copy so the visible artwork reads clearly in the upper identity area without changing manifest icon files.

Browser-tab favicons use an even tighter dedicated crop (`wellcanvas-favicon-tight.png` and generated 16/32/48 px PNGs) because favicon slots are much smaller than installed-app icons. The 180/192/512 px PWA assets keep their safer padding and are not replaced by the tab-specific crop.

## Use One Stable Page Header

Main routes use a shared `PageHeader` component with a fixed avatar slot, reserved local-date line, optional subtitle slot, and optional trailing action. Today supplies its greeting and fortune button through this structure; other routes supply the page title and stop rendering separate identity, eyebrow, and duplicate title rows. This keeps the first content panel at a more consistent vertical position during client-side navigation.

## Keep Food Editing Out of Catalogue Grids

Reusable food and meal editors must open in the modal/sheet layer, not inside a food card, group subsection, or catalogue grid. This preserves browsing layout, keeps editor fields usable, and ensures overflow menus close before larger editing workflows begin. Details can remain read-only modals with an explicit Edit action that opens the same full editor.

Meal totals can either be calculated from components or manually overridden. Component recalculation requires preview and confirmation, and manual override values are not silently overwritten when components change. Historical food-log snapshots are not rewritten by library edits.

## Clarify Activity Creation Outcomes

Manual Activity creation separates logging from template creation: `Add today` creates one activity entry only, `Add today & save` creates one entry plus one reusable template, and `Save` creates or updates a reusable template without adding anything to Today. If the combined action logs successfully but template saving fails, the logged entry is preserved and retrying the save path must not create a second activity log.

## Use Timestamp-Based Background Rotation

Built-in backgrounds are the 11 local nature PNGs under `/backgrounds`. Automatic rotation is calculated from a persisted `rotationStartTimestamp`, selected starting background, enabled background IDs, and one of the allowed hour intervals. This keeps tabs, reloads, focus recovery, and laptop sleep consistent without frequent polling or random selection.

## Preserve Background Compatibility

The existing appearance storage key remains `health-tracker-pwa.appearance.v1`. Legacy bundled background IDs such as `background-1` through `background-5` normalize safely to `nature-01`; other appearance preferences such as accent, dimming, and panel transparency are preserved.
