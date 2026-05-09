## TASK-002 - TypeScript baseline build fix

- Selected task: TASK-002, priority critical, dependency TASK-001 is done.
- Reproduced failure with `npm run build`: `src/adapters/text/textCacher.ts(7,53): error TS1501: This regular expression flag is only available when targeting 'es2018' or later.`
- Root cause: `tsconfig.json` had `target: "es6"`, while `regexYaml` in `src/adapters/text/textCacher.ts` uses the `s` (`dotAll`) regular expression flag. The production esbuild config already targets `es2020`.
- Minimal change: updated `tsconfig.json` target from `es6` to `es2018`; no Navigator runtime code was changed.
- Verification: `npm run build` completed successfully. Output was written to `undefined/main.js`, `undefined/styles.css`, and `undefined/manifest.json` because `buildDir` is not set for this command in the current shell; TASK-003 covers stabilizing the dev build output path.
- Obsidian reload: `obsidian plugin:reload id=make-md-spaces` completed with no CLI output.
- Obsidian errors after reload: existing runtime errors remain:
  - `TypeError: Cannot read properties of undefined (reading 'settings')` in make-md-spaces settings tab path.
  - `URIError: URI malformed` in make-md-spaces path/cache handling.
