# public/audio

Folder-based audio styles. Every folder uses the **same base filenames**.

```
original/    raw recordings (source of truth) + optional .mid metadata
strings/     string-orchestra renders
electronic/  synth / electronic renders
funny/       toy marimba / xylophone renders
```

- The app plays `/audio/<style>/<file>` and falls back to `/audio/original/<file>`
  when a styled file is missing.
- `.mid` files are not played by the app — they are the source for the style
  renderer (`scripts/render_styles.py`).
- Styled folders are generated; see the repo root `README.md` for how to
  (re)generate and validate them.
