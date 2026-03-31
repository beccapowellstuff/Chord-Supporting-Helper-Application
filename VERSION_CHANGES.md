# Version Changes

This file is a retroactive milestone summary for Vibe Chording from `v0.1.0` through `v0.12.0`.

The early entries were reconstructed from the project’s development history and are meant to reflect the main release-level changes, not every individual commit.

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
- Began shaping the app around “what could come next?” rather than only theory display.

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
