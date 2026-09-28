# Optional Integrations

Infrastructure for features whose package may not be installed. Nothing here
knows what a user is; it only knows how to load something that might be absent.

```text
optional
├── optional.util.ts        loadOptional, built on createRequire
├── optional.provider.ts    createOptionalProvider, may resolve to null
├── optional-packages.ts    the registry: package, env flag, install command
└── transports/             the package-free mail and webhook implementations
```

## Rules

- **No static import of an optional package.** A bare `import` is resolved at
  build time, so a missing package is a build failure instead of a disabled
  feature. Load it with `loadOptional()`.
- **`null` is a value, not an error.** Providers resolve to `null` and consumers
  branch on it. Throwing at resolution time would make an unused feature a
  startup failure.
- **Type an optional package with `typeof import('x')`.** That is a type-only
  construct, so it needs no runtime import and fails to compile only if the code
  is wrong, not if the package is missing.
- **The registry is the single list.** Add the package, the env flag and the
  install command to `optional-packages.ts`; `optional-packages.spec.ts` then
  guards the new entry against a static import.
- **Prefer no package.** Telegram, Slack and the development mailer are a few
  lines over `node:https` and a Map. A dependency is a permanent cost for every
  deployment, including the ones that never use the feature.

## Adding a provider transport

1. Add the package to `OPTIONAL_PACKAGES` with its feature, env flag and install
   command.
2. Reference the specifier as a string in your factory. Never import it.
3. Handle the `null` branch and pick a fallback, then test that branch.
4. Document the feature, package, env flag and install command in
   `docs/optional-integrations.md`.
