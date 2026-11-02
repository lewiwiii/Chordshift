# Chordshift

Convert chord presets between [Trackbout Ripchord](https://trackbout.com/ripchord) (`.rpc`) and [Scaler](https://www.scalerplugin.com/) (`.xml`). The web app converts files in the browser, supports multi-file batches, and downloads multiple results as a ZIP. Files are never uploaded.

## Run locally

```sh
npm install
npm run build
```

Serve the `demo/` directory with any static web server, or run `npm run build` as the Vercel build command and use `demo` as the output directory. `vercel.json` already configures these settings.

## Use the command line

```sh
node index.mjs preset.rpc another-preset.xml --start 48
```

Converted files are written beside their source. The optional `--start` MIDI note sets the first generated Ripchord trigger when converting Scaler files (default `48`, C3).

## Conversion notes

- Ripchord chord names and trigger notes are retained when converting to Scaler-compatible XML where the format allows it.
- Scaler files do not store trigger notes; Ripchord triggers are generated sequentially from the configured MIDI note.
- Chord names are detected with [Tonal](https://github.com/tonaljs/tonal).
