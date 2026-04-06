# Vibe Chording

Vibe Chording is a browser-based music idea tool for building chord progressions, exploring keys, and shaping harmonic direction without handing authorship over to AI.

Current version: [v0.15.0](https://beccapowellstuff.github.io/Chord-Supporting-Helper-Application/project-documents/version-changes.html#v0-15-0)  
Full history: [Version Changes](https://beccapowellstuff.github.io/Chord-Supporting-Helper-Application/project-documents/version-changes.html)
Project status: [GitHub Project Board](https://github.com/users/beccapowellstuff/projects/1/views/2)

Public-facing product name: `Vibe Chording`  
Current repository name: `Chord-Supporting-Helper-Application`

## What It Does

Vibe Chording helps you:

- pick a key and mode visually
- explore the diatonic chords and theory behind that key
- build a progression as visual chord blocks instead of raw text
- hear chords, progressions, and custom voicings immediately
- shape duration, sustain, dynamics, and playback behavior
- use a non-AI suggestion engine for next-chord ideas

The goal is not to write music for you. The goal is to support the writing process with theory-aware, musician-first tools.

## What Works Right Now

- Interactive key selection
  - visual key root selector
  - mode switching
  - relative and parallel key display
  - diatonic chord and Roman numeral reference

- Chord exploration
  - chord playback
  - chord root and bass-root exploration
  - slash chord support
  - shared inversion and voicing audition controls across Key Explorer, Chord Explorer, and Suggestion Engine

- Progression Builder
  - visual `Chord Sequence` made from compact chord blocks
  - drag-and-drop chord reordering
  - click a block to audition it
  - double-click a block to edit it
  - duplicate, insert, split, and delete sequence blocks from the builder controls
  - beat-based chord durations
  - tempo and time-signature controls
  - visible bar numbering across wrapped blocks, including long chords that cross into a new bar
  - per-chord sustain
  - per-chord custom voicing capture from the keyboard
  - visible inversion and voicing shorthand on progression blocks
  - per-note velocity editing with `Basic` and `Advanced` modes
  - save progression to JSON
  - load progression from JSON
  - load bundled demo progression from a `Music Demos` menu
  - in-app clear-sequence confirmation
  - hover tooltips for full chord name, length, sustain, and voicing details

- Keyboard workflow
  - identify chords from selected notes
  - add a recognised chord to the sequence
  - update a selected sequence chord from the keyboard
  - delete a selected sequence chord
  - compact bass lane display for low doubled bass notes
  - note-plus-octave tooltips on keys
  - exact manual voicing save without auto-adding a lower bass note
  - slash-bass recognition driven only by the dedicated bass lane

- Playback
  - play a single chord
  - play the whole sequence
  - play from the selected chord
  - stop playback mid-sequence
  - active chord highlighting during playback
  - armable metronome with adjustable volume and downbeat accent
  - custom stored voicings used during preview and sequence playback

- Suggestion Engine (Still in Alpha)
  - theory-first, non-AI suggestion path
  - mood/feeling input
  - progression-aware parsing
  - grouped suggestions such as in-key, related, and out-of-key color options
  - still MVP and still being refined

## Getting Started

### Live Demo

**[Open Vibe Chording on GitHub Pages](https://beccapowellstuff.github.io/Chord-Supporting-Helper-Application/)**

### Run Locally

This app loads JSON data files, so it should be served through a local web server.

Option 1: Python

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

Option 2: Node.js

```bash
npx http-server
```

Then open the local URL it prints.

Option 3: VS Code Live Server

Right-click `index.html` and choose `Open with Live Server`.

## Quick Workflow

1. Pick a key root and mode.
2. Explore the theory panel and chord options.
3. Use the keyboard or chord explorer to add chords to the `Chord Sequence`.
4. Click blocks to preview them, or drag to reorder the progression.
5. Double-click a block to edit beats, sustain, and voicing settings.
6. Use the Suggestion Engine when you want theory-based next-step ideas.
7. Save the progression or load the built-in demo to experiment quickly.

## Project Structure

The app is still intentionally lightweight, but the repo now has a few clearer working areas:

```text
Chord-Supporting-Helper-Application/
|- index.html
|- styles.css
|- package.json
|- README.md
|- js/
|  |- app.js
|  |- progressionBuilder.js
|  |- playgroundKeyboard.js
|  |- engine.js
|  |- ui.js
|  |- playback.js
|  |- synth.js
|  |- chordNotes.js
|  |- chordVoicing.js
|  |- theory.js
|  |- dataLoader.js
|  `- rootSelector.js
|- data/
|- graphics/
|- assets/
|- samples/
|- Music Demos/
|- tests/
|- scripts/
|- project-documents/
|- .github/
|  `- workflows/
`- .codex/
   `- skills/
```

| Path | Purpose |
|---|---|
| `index.html` | Main app shell and layout |
| `styles.css` | Global styling for the app UI |
| `js/app.js` | Main entry point, startup flow, app state, and event wiring |
| `js/progressionBuilder.js` | Progression builder model, block rendering, editing, and save/load behavior |
| `js/playgroundKeyboard.js` | On-screen keyboard, note selection, and manual voicing capture |
| `js/engine.js` | Suggestion engine logic and progression parsing |
| `js/ui.js` | Shared UI rendering helpers for theory and suggestion views |
| `js/playback.js` | Chord and progression playback orchestration |
| `js/synth.js` | Tone.js sampler setup and note-trigger helpers |
| `js/chordNotes.js` | Chord, interval, note, and MIDI utility helpers |
| `js/chordVoicing.js` | Voicing generation and inversion-related logic |
| `js/theory.js` | Key, mode, scale, chord, and transition data generation |
| `js/dataLoader.js` | Loads the JSON data files and assembles runtime data |
| `js/rootSelector.js` | Shared root-note selector UI behavior |
| `data/` | Static app data such as keys, modes, moods, and chord descriptions |
| `graphics/` | App icons, branding images, favicon, and source artwork files |
| `assets/` | Extra brand/supporting visual assets |
| `samples/` | Audio sample files used by playback |
| `Music Demos/` | Bundled progression demo JSON files shown in the Demo menu |
| `tests/` | Playwright end-to-end coverage plus syntax-check helpers |
| `scripts/` | Project automation scripts such as release cleanup |
| `project-documents/` | Roadmap, release history, acknowledgements, and other project-facing docs |
| `.github/workflows/` | GitHub Actions automation |
| `.codex/` | Repo-local Codex workflow/skill configuration |

Generated or local-support folders you may also see:

| Path | Purpose |
|---|---|
| `node_modules/` | Installed development dependencies |
| `playwright-report/` | Generated Playwright HTML reports |
| `test-results/` | Generated test output and artifacts |

## Browser Support

Vibe Chording is built with standard web technologies and should work in modern Chrome, Firefox, Safari, and Edge.

Notes:

- mobile is not a focus yet; desktop is the current priority
- Safari audio cannot be fully verified under Playwright automation
- real browser testing is still preferred for audio behavior

## Design Philosophy

Vibe Chording is being built around a few principles:

- help the musician, do not replace the musician
- make theory usable, not intimidating
- keep progression building hands-on and visual
- allow AI later only as an optional extra, not the core workflow
- support experimentation without turning into a full DAW

The app still uses circle-of-fifths style theory relationships in the background, but the current key picker is not presented as a literal circle UI anymore. In the docs, it is better described as a visual key selector.

## Vibe Coding Note

This project is being built with AI support as part of a vibe-coding workflow, and that is intentional rather than hidden.

I do have programming experience, though my experience in Javascript and CSS is not great. I am using AI to help write, refactor, debug, and iterate on parts of this project much faster than I could alone, especially since I work full time and have many many other hobbies (ADHD is fun like that). Sometimes it means parts of the code are rough, in transition, or being actively reworked as the right workflow emerges.

So:
- if you are interested in vibe coding, this project may be useful or interesting to follow
- if you strongly dislike AI-assisted development, you should know up front that AI is part of how this project is being built

## Thanks

Vibe Chording has already benefited from thoughtful feedback, bug reports, UI observations, and general encouragement while it has been evolving.

Special thanks currently go to the people acknowledged in [THANKS.md](./project-documents/THANKS.md).

## Contributing

Useful feedback includes:

- theory corrections
- suggestion quality feedback
- progression-builder workflow ideas
- playback and voicing issues
- practical musician-first feature ideas

## Summary

Vibe Chording is a progression-focused music support tool for people who want help with harmony, direction, and exploration while still making the creative decisions themselves.
