# Vibe Chording

Vibe Chording is a browser-based music idea tool for building chord progressions, exploring keys, and shaping harmonic direction without handing authorship over to AI.

Current version: [v0.12.0](./VERSION_CHANGES.md#v0-12-0)  
Full history: [Version Changes](./VERSION_CHANGES.md)

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

- Progression Builder
  - visual `Chord Sequence` made from compact chord blocks
  - drag-and-drop chord reordering
  - click a block to audition it
  - double-click a block to edit it
  - beat-based chord durations
  - tempo and time-signature controls
  - per-chord sustain
  - per-chord custom voicing capture from the keyboard
  - per-note velocity editing with `Basic` and `Advanced` modes
  - save progression to JSON
  - load progression from JSON
  - load bundled demo progression

- Keyboard workflow
  - identify chords from selected notes
  - add a recognised chord to the sequence
  - update a selected sequence chord from the keyboard
  - delete a selected sequence chord
  - compact bass lane display for low doubled bass notes

- Playback
  - play a single chord
  - play the whole sequence
  - play from the selected chord
  - stop playback mid-sequence
  - active chord highlighting during playback
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

The app is still intentionally lightweight. The core files are:

| File | Purpose |
|---|---|
| `index.html` | Main UI shell |
| `styles.css` | App styling |
| `js/app.js` | Entry point, state, event wiring |
| `js/progressionBuilder.js` | Chord sequence model, save/load, block rendering, edit popover |
| `js/playgroundKeyboard.js` | Sequence keyboard and bass-lane UI |
| `js/engine.js` | Suggestion engine and progression parsing |
| `js/ui.js` | Shared rendering for theory and suggestion UI |
| `js/playback.js` | Progression and chord playback flow |
| `js/synth.js` | Tone.js sampler wrapper |
| `js/chordNotes.js` | Note, interval, chord, and MIDI helpers |
| `js/chordVoicing.js` | Generated voicing logic |
| `js/theory.js` | Key, mode, chord, and transition data generation |
| `js/dataLoader.js` | Loads data files and assembles app data |
| `data/` | Mood, theory, and description data |
| `c-ionian-progression.json` | Bundled demo progression |

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

## Release Milestones

These link to the retroactive version summary file:

- [v0.12.0](./VERSION_CHANGES.md)

## Vibe Coding Note

This project is being built with AI support as part of a vibe-coding workflow, and that is intentional rather than hidden.

I do have programming experience, though my experience in Javascript and CSS is not great. I am using AI to help write, refactor, debug, and iterate on parts of this project much faster than I could alone, especially since I work full time and have many many other hobbies (ADHD is fun like that). Sometimes it means parts of the code are rough, in transition, or being actively reworked as the right workflow emerges.

So:
- if you are interested in vibe coding, this project may be useful or interesting to follow
- if you strongly dislike AI-assisted development, you should know up front that AI is part of how this project is being built

## Contributing

Useful feedback includes:

- theory corrections
- suggestion quality feedback
- progression-builder workflow ideas
- playback and voicing issues
- practical musician-first feature ideas

## Summary

Vibe Chording is a progression-focused music support tool for people who want help with harmony, direction, and exploration while still making the creative decisions themselves.
