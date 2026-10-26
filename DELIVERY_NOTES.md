# Raylight Editor replacement delivery

This package contains the entire Raylight source tree with the previously delivered fixes integrated, plus a complete incremental GIF encoder implementation, integrated exporter replacement, and unit tests. The implementation prompt contains a detailed dependency/setup sequence and outstanding engine remediation work.

**Honest scope:** This is **not** a verified complete solution for the entire motion editor. Source files compile syntactically under TypeScript transpilation but the full Vite/Vitest build was not available because npm dependency installation did not complete. Deterministic MP4/WebM offline export, complete audio mixdown, full GPU rendering, browser E2E and performance certification remain outstanding. Do not assume otherwise.

### Existing cross-file fixes carried forward
- `src/storage/projectIO.ts`, `src/storage/projectIO.test.ts`
- `src/model/cloneShot.ts`, `src/model/cloneShot.test.ts`
- `src/store/useProjectStore.ts`, `src/store/shotSplitReferences.test.ts`

### New replacement work in this release
- `src/engine/gifEncoder.ts`: one-frame-at-a-time GIF89a encoding, avoids an array of uncompressed RGBA frames; introduces distributed centisecond delays.
- `src/engine/gifEncoder.test.ts`: basic header/trailer/dimension/timing regressions.
- `src/engine/exporter.ts`: uses the shared incremental encoder; removes older inline GIF build implementation and raw-frame array.

**Limitations:** The palette remains RGB332; color fidelity still requires a better quantizer. GIF encoded bytes still accumulate until Blob finalization. Video export retains MediaRecorder and real-time frame skipping: this is explicitly not fixed. The codebase still requires the full-engine work in `IMPLEMENTATION_PROMPT.md`.

### Local installation
```bash
node --version
npm install --no-audit --no-fund
npm run build
npm test
npm run lint
npm run dev
```

When a package-lock is created, commit it and use `npm ci` subsequently.
