# aki

A cross-platform **book reader** for **PDF** and **EPUB** files, built with Next.js + Capacitor for **Android** and **iOS**.

## Features

- Read **PDF** and **EPUB** files on your phone
- Runs offline — books are stored locally on-device
- Native Android & iOS builds from a single shared codebase
- Static web export for easy web deployment

## Tech Stack

- [Next.js](https://nextjs.org) — UI framework (static export)
- [Capacitor](https://capacitorjs.com) — native Android/iOS wrapper
- [Tailwind CSS](https://tailwindcss.com) — styling

## Project Layout

```
app/            Next.js application
android/        Native Android project
ios/            Native iOS project
public/         Static assets
out/            Built static export (gitignored)
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- For native builds: Android Studio / Xcode

### Install

```bash
pnpm install
```

### Run the web app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build the static export

```bash
pnpm build
```

Generates the static site into `out/`.

### Sync native platforms

```bash
pnpm cap:sync        # builds static export, then runs `cap sync`
```

Then open the native project:

```bash
npx cap open android
npx cap open ios
```

## Release Pipeline

GitHub Actions (`.github/workflows/release.yml`) builds and packages:

- **Android** — debug APK on every run; signed release AAB on `v*` tags
- **iOS** — signed archive + IPA export on `v*` tags

Triggers on tag push (`v1.0.0`, ...) or manual `workflow_dispatch`.

> Note: iOS release signing on CI requires Apple certificates/provisioning profiles. See the workflow's required repository secrets.

## License

[MIT](LICENSE)