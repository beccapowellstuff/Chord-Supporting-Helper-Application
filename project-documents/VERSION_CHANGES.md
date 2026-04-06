# Version Changes

This file is a retroactive milestone summary for Vibe Chording from `v0.1.0` through `v0.15.0`.

The early entries were reconstructed from the project's development history and are meant to reflect the main release-level changes, not every individual commit.

## <a id="v0-15-0"></a>v0.15.0

- Refined the Progression Builder layout so sequence transport and keyboard actions share one cleaner toolbar row.
- Added a distinct `Clear chord sequence` action and icon, with safer disabled states and in-app confirmation flow.
- Added richer chord-block hover details showing the full chord name, beat length, sustain state, and voicing summary.
- Fixed manual keyboard chord saves so custom note shapes are preserved exactly without auto-adding a lower bass note.
- Fixed slash-bass recognition so the dedicated bass lane determines the bass note instead of upper keyboard notes forcing labels like `Am/E`.
- Added contextual help popups across Progression Builder, Keyboard, Chord Sequence, Key Explorer, Chord Explorer, and Suggestion Engine.
- Simplified section headers and labels to reduce confusion, including cleaner Key Explorer, Chord Explorer, Suggestion Engine, and Keyboard headings.
- Added a visible sequence key label above the chord blocks and continued polishing toolbar sizing, button states, and sequence UX.

## <a id="v0-14-0"></a>v0.14.0

- Fixed synth initialisation so failed audio startup no longer leaves playback permanently unavailable for the rest of the session.
- Replaced the old placeholder Playwright setup with app-specific browser coverage and strengthened regression checks around key selection, suggestions, and progression playback.
- Added explicit inversion and voicing audition controls to Key Explorer, then reused the same shared bar pattern in Chord Explorer and Suggestion Engine.
- Added beginner-friendly triad voicing presets, progression voicing badges, octave-aware keyboard tooltips, and keyboard display updates that match the actual played notes.
- Improved chord-sequence playback behavior, disabled sequence playback controls when no chords are present, and expanded automated playback tests.
- Added a `Music Demos` menu that auto-lists bundled JSON demo files and renamed the old demo folder/file structure to support multiple demos.
- Added a `New progression` flow with an in-app confirmation UI and follow-up builder polishing around empty states and action placement.
- Fixed top-octave keyboard playback so notes above `C6` no longer collapse to the same sampled pitch.

## <a id="v0-13-0"></a>v0.13.0

- Added `Split` for selected progression chords so longer blocks can be broken into shorter adjacent parts.
- Added new icons for the progression builder.
- Reworked the main sequence and transport controls into compact SVG icon buttons with tooltips and themed styling.
- Added an armable metronome with adjustable volume and dedicated click/thump sounds instead of piano notes.
- Made playback and metronome timing respect the true beat offset and time signature when starting mid-progression.
- Added visible bar numbering across the wrapped progression view, including labels inside long chords where a new bar begins.
- Expanded UI regression coverage for split editing, metronome controls, and cumulative bar markers/tooltips.

## <a id="v0-12-0"></a>v0.12.0

- Added a bundled demo progression loader.
- Added `Play from` so playback can start at the selected chord.
- Added drag-and-drop chord reordering in the `Chord Sequence`.
- Refined note-level velocity editing with `Basic` and `Advanced` modes.
- Updated documentation to match the current product.

## <a id="v0-11-0"></a>v0.11.0

- Added custom voicing capture from the on-screen keyboard.
- Added doubled bass playback for keyboard-captured voicings.
- Added compact bass-lane display beneath the main keyboard.
- Added per-note dynamics editing for stored voicings.
- Added click-to-preview and double-click-to-edit behavior for chord blocks.

## <a id="v0-10-0"></a>v0.10.0

- Added sequence save/load using JSON files.
- Added custom sequence playback controls including stop behavior.
- Added active chord highlighting during playback.
- Added keyboard-based `Add`, `Update`, and `Delete` actions for the builder.
- Improved progression-builder workflow and playback integration.

## <a id="v0-9-0"></a>v0.9.0

- Switched progression editing toward a visual block-based builder.
- Added selected chord editing via a compact edit view.
- Added chord audition directly from the progression sequence.
- Improved sequence playback flow and builder interaction design.
- Reduced dependence on text-first editing.

## <a id="v0-8-0"></a>v0.8.0

- Introduced beat-based chord durations instead of simple bar labels.
- Added tempo and time-signature controls.
- Added duration-based chord widths in the sequence.
- Added beat divider markers and bar-boundary visual cues.
- Moved the builder closer to a compact sequence/timeline workflow.

## <a id="v0-7-0"></a>v0.7.0

- Replaced the primary progression textarea workflow with visual chord blocks.
- Added single-selection behavior for progression items.
- Added a dedicated chord editor path for selected sequence items.
- Preserved compatibility with existing pasted or loaded text progressions.
- Established the structured progression-item model used by later features.

## <a id="v0-6-0"></a>v0.6.0

- Fixed major standard Suggestion Engine rendering issues.
- Corrected `[object Object]` suggestion-card bugs.
- Improved progression parsing for standard theory-based suggestions.
- Added regression coverage around progression-based suggestions.
- Stabilised the non-AI suggestion path before larger builder work.

## <a id="v0-5-0"></a>v0.5.0

- Added progression input and early progression playback support.
- Improved chord recognition and keyboard-driven progression entry.
- Added friendlier keyboard actions and cleaner progression workflow labels.
- Began separating exploration, progression, and suggestion workflows.
- Continued moving the app from single-chord use toward progression support.

## <a id="v0-4-0"></a>v0.4.0

- Added audio playback for chords and basic harmonic exploration.
- Added chord exploration controls and UI refinements.
- Expanded the app beyond static theory reference into interactive use.
- Improved the writing workflow around hearing chord choices quickly.

## <a id="v0-3-0"></a>v0.3.0

- Added the first working suggestion-engine flow.
- Added feeling-based chord suggestions.
- Added progression parsing foundations for theory-aware suggestions.
- Began shaping the app around "what could come next?" rather than only theory display.

## <a id="v0-2-0"></a>v0.2.0

- Expanded key and mode support.
- Added richer theory views including diatonic chord context and Roman numerals.
- Improved the visual theory panel and key-awareness of the app.
- Made the tool more useful as a reference and exploration aid.

## <a id="v0-1-0"></a>v0.1.0

- Initial foundation for what is now Vibe Chording.
- Added interactive key selection.
- Added the Circle of Fifths-driven starting workflow.
- Established the browser-based music-theory tool concept and core UI shell.
