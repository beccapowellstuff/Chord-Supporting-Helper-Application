# ChordCanvas Roadmap

This roadmap collects the feature ideas discussed so far and groups them by practical priority.

Priority guide:

- `Must`: strong next-step work that directly improves the core product
- `Should`: valuable follow-on work that fits the product well
- `Could`: interesting future work, but lower urgency or higher complexity/risk

| Category | Name | Desc | Why | Priority |
|---|---|---|---|---|
| Core | Suggestion Engine Overhaul | Rework the non-AI suggestion engine so it gives better theory-based results, stronger mood alignment, clearer reasons, and more useful in-key, related, and out-of-key options. | This is currently the biggest weak spot in the app and would make the product feel much smarter and more musically helpful. | Must |
| Core | Duplicate / Insert / Split Chord | Add sequence editing tools so a selected chord can be duplicated, a new chord can be inserted before or after it, or a longer chord can be split into shorter parts. | This makes the `Chord Sequence` much faster to shape and edit, especially now that durations are beat-based. | Must |
| Core | Transpose Progression | Allow the whole progression to be transposed up or down, either by semitone steps or by moving to a new root key. | This makes experimentation much faster and helps users explore the same progression idea in other tonal centers. | Must |
| Core | Playback Styles | Add playback modes such as `Block`, `Arpeggio Up`, `Arpeggio Down`, and `Strum`, while still respecting saved voicings where possible. | This would make playback feel more musical and expressive without turning the app into a DAW. | Must |
| Core | Save to MIDI | Export the current progression to a MIDI file using the stored durations, tempo, time signature, voicings, sustain, and velocities where possible. | MIDI export is useful, controlled, and a natural bridge to other music tools without the complexity of MIDI import, and it is also part of the app's real workflow value for your own tooling. | Must |
| AI | AI Suggestion Button | Add an optional AI-powered suggestion button that can comment on or extend the progression without replacing the standard engine. | This is a desired product direction and should sit beside the standard engine as an explicitly optional creative tool. | Must |
| AI | Local LLM / Bring-Your-Own AI Support | Explore optional local-LLM or user-supplied API-key support for AI features rather than building the core app around paid AI calls. This may mean moving toward a local app or hybrid app model instead of remaining purely a website. | This looks like the most realistic path to keeping AI optional while avoiding ongoing cost pressure, and it may shape the app architecture later. | Must |
| AI | Free AI Engine Exploration | Investigate whether there is a realistic free AI path for optional suggestions, while keeping the standard app fully usable without AI. | Cost matters, and even if free options are imperfect, this is important enough to keep as a product goal rather than a side curiosity. | Must |
| Supporting | Chord Chart Print Mode | Add a clean, printable chord-chart or lead-sheet style view that can be printed or saved to PDF from the browser. | This gives users a practical output format and fits the progression-focused nature of the app. | Should |
| Supporting | Staff View | Add a read-only staff-style view of the progression, focused on presentation rather than notation editing. | This could give users a more traditional music-reading view and support print or PDF output. | Should |
| Supporting | Guitar Chord / Diagram View | Add a guitar-friendly view, such as chord boxes or chord-chart style diagrams, for the progression. | This would broaden the app's usefulness for guitar players without changing the core progression-builder workflow. | Should |
| Supporting | Progression Pathways | Offer grouped next-step routes such as `Resolve`, `Darken`, `Brighten`, `Add tension`, or `Go somewhere unexpected` instead of only raw chord suggestions. | This would make the suggestion experience feel more musical and intention-driven. | Should |
| Supporting | Section Labels / Repeats / Structure Marking | Let users mark groups of chords with structural labels such as `Intro`, `Verse`, `Chorus`, and `Bridge`, and later support simple notation ideas such as repeats or similar sequence directions. | This would help organise larger song ideas and make printable or performance views more practical without turning the app into a full arrangement editor. | Should |
| Supporting | Variation Snapshots | Allow users to keep multiple saved progression variants such as `Version A` and `Version B` inside the same idea flow. | This supports experimentation without losing earlier versions of a progression. | Should |
| Supporting | Progression Notes | Add a simple notes field for the progression, such as lyric ideas, arrangement reminders, or theory comments. | This would help users keep context around an idea without bloating the sequence UI. | Could |
| Supporting | Load MIDI | Import a MIDI file into the app in a controlled way, ideally with a limited single-track or harmony-first interpretation flow. | This could be useful, but it carries a lot of complexity around multiple tracks, melody content, bad chord detection, and ambiguous source material. | Could |
