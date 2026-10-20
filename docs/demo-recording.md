# Demo recording

The README GIF is a labeled recorded Gemini investigation replay. The approval click is simulated in the capture browser. The recording fixture is not imported by application code and never replaces a failed live investigation.

Start the app, then install optional Python Playwright separately from the app dependencies and use a system Chromium at `/usr/bin/chromium`. The capture script uses a throwaway browser context, intercepts only its own API requests, asserts no page errors, and writes seven frames to ignored `.demo-capture/`:

```bash
python3 scripts/capture-demo.py
```

Encode those frames using FFmpeg (also optional):

```bash
ffmpeg -y -filter_complex_threads 1 -pattern_type glob -framerate 0.5 -i '.demo-capture/*.png' -filter_complex '[0:v]split[a][b];[a]palettegen[p];[b][p]paletteuse' -loop 0 public/demo.gif
```

The capture launches container Chromium with its sandbox disabled for this local, fully intercepted recording only. Run it only against the local app and trusted fixture; it does not configure general browsing or disable TLS verification. The visible recording label must remain on every frame. No model inference or database writes are performed.
