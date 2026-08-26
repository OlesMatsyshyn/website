# WellCanvas

Your health tracker, stored locally and shaped by you.

WellCanvas is a free, local-first, open-source tracker for food, hydration,
activity, measurements and personal habits.

Core principles:

- No registration
- Local-first
- No advertising
- Free
- MIT licensed
- Portable backups
- Shareable food packs
- Customisable

Personal health records are browser-local and are not contained in the source
repository. A new installation starts clean unless a user imports their own
WellCanvas backup or a reusable food pack.

## Development

```bash
npm install
npm run dev
```

The development server normally runs at `http://localhost:3000`.

## Production Static Build

```bash
npm run build
```

The static export is generated in:

```text
out/
```

The `out/` directory is generated output and is ignored by Git by default.
Deploy its contents to static hosting. If hosting WellCanvas under a subpath
such as `/WellCanvas/`, configure the host and Next.js asset base path together
before building so icons, backgrounds, manifest and route assets resolve from
that subpath.

## Data Portability

`WellCanvas-backup-YYYY-MM-DD.zip` is a private portable copy of local
WellCanvas browser state. Restoring a backup replaces the current local state
after validation and confirmation.

Food packs are separate shareable ZIP files. They contain reusable catalogue
items only and exclude profile data, daily logs, measurements, trackers,
hydration history and activity history.

## Licence

Licensed under the MIT License. You may use, copy, modify, distribute and
commercially reuse the software subject to the licence terms.
