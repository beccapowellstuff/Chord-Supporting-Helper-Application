# Chord Supporting Helper Application

A browser-based music idea tool designed to help musicians find the next part of a chord progression without handing the whole creative process over to AI.

This project focuses on providing harmonic guidance, visual theory support, and musical prompts that can help break creative stalls while still leaving the real writing decisions in the hands of the musician.

---

## Getting Started

### Try it now

The easiest way to explore the tool is through GitHub Pages. No setup required — just open it and start using it.

**[Live Demo](https://beccapowellstuff.github.io/Chord-Supporting-Helper-Application/)**

### Run it locally

The application loads music theory data from JSON files, so you'll need to run a local server. Everything else is self-contained — no build process or extra dependencies beyond that.

**Option 1: Python (simplest if you have Python installed)**

From the project directory, run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

**Option 2: Node.js**

```bash
npx http-server
```

Then look for the local URL it provides (usually `http://localhost:8080`).

**Option 3: VS Code Live Server extension**

If you have the Live Server extension installed, right-click `index.html` and select "Open with Live Server."

That's really it — pick whichever option works easiest for you and you're all set.

### Browser support

This tool is built with standard web technologies and should work on all modern browsers (Chrome, Firefox, Safari, Edge).

I'm using Playwright for browser testing during development to help catch issues early.

Mobile phone doesn't work right now - I am focusing on getting the functionality working to start with and then will rework the UI for mobile version.

**Known issue:** Audio doesn't play in Safari when running through Playwright (browser automation). I've tested this with isolated audio code and confirmed it's a Playwright/WebKit limitation, not an issue with the application itself. The app should work fine in real Safari on a Mac — I just don't have one to verify it. If you test it on real Safari or hit any other browser issues, let me know.

### Quick workflow

To get a feel for how it works, here's the basic flow:

1. **Pick a key** — Click a key on the Circle of Fifths
2. **See your options** — The diatonic chords for that key appear in the theory panel
3. **Select a chord** — This becomes your current harmonic position
4. **Get ideas** — Use the feeling selector to get next chord suggestions based on the mood you're going for
5. **Build from there** — Pick the suggestion that feels right and keep building

The tool is built to support exploration, not to force outcomes. Try things, see what works, and use the theory as a guide rather than a rulebook.

### Project structure

The files are organized pretty simply:

- **`index.html`** — The UI and layout
- **`styles.css`** — Visual design and styling
- **`js/`** — Application logic (key selection, chord mapping, suggestions, audio, etc.)
- **`data/`** — Music theory data (key definitions, chords, moods, descriptions)

If you want to understand how something works, the `js/` folder is where the application logic lives, and `data/` is where the music theory information comes from.

---

## Vibe Coding

This project is being built using vibe coding.

I do have programming experience, but my JavaScript and HTML knowledge is limited, and with a full time job I do not always have the time or energy to properly learn everything before building. Because of that, this project is a mix of experimentation, problem solving, and learning as I go.

That means some parts of the code are rough. Some areas are messy, some decisions were made quickly to keep momentum going, and some parts will almost certainly be reworked later.

As I continue working on it, I plan to clean things up, improve the structure, and break larger sections into more sensible modules where they clearly belong.

So yes, this is a vibe coded project. If that alone puts you off, this repository probably will not be for you. But if you are interested in a project that is being built, tested, learned through, and gradually improved in public, then that is exactly what this is.

---

## What it does

Chord Supporting Helper Application is a music theory and progression support tool built around an interactive Circle of Fifths.

At the moment, it allows the user to:

- Select a key from the Circle of Fifths
- View key information such as relative and parallel keys
- See the diatonic chords for the selected key
- View Roman numeral functions for those chords
- Explore possible next chord ideas based on the current harmonic context
- Use feeling-based suggestions to guide the next move in a progression

The aim is not to write music for the user. The aim is to support the creative process by offering ideas, structure, and theory-aware prompts when the next step is not obvious.

---

## Why this exists

In my experience, a lot of music tools either do too little or try to do too much.

Some tools are just static theory charts.  
Some AI tools try to generate everything for you.  
Some larger applications do far more than I want, when all I really want is help finding the next useful idea to build on.

This project is meant to sit somewhere in the middle.

It is for musicians who want help with direction, transition, colour, and harmonic possibility, while still keeping authorship and musical judgement for themselves.

It is not intended to supply melodies. For me, once I have a chord structure I like, melodies can come on top of that. Other musicians work the other way around and start with melody first. This tool is mainly aimed at the harmony side of writing.

The goal is to help answer questions like:

- What chord could come next here?
- What would make this feel sadder, stronger, darker, softer, or more unresolved?
- What are the natural harmonic options in this key?
- What might be a slightly less obvious move that still makes musical sense?

---

## How it works

The current version is built around a few core ideas.

### 1. Interactive Circle of Fifths

The app displays an interactive Circle of Fifths that lets the user pick a key visually.

This provides a simple and familiar way to move through related keys and understand harmonic relationships.

### 2. Key-aware chord mapping

Once a key is selected, the app loads the diatonic chords for that key and maps them to their harmonic functions, such as:

- I
- ii
- iii
- IV
- V
- vi
- vii°

This gives the user both the chord names and the theory meaning behind them.

### 3. Theory reference panel

The app shows a quick key summary, including:

- The current key
- Relative key
- Parallel key
- Diatonic chord table
- Roman numeral functions
- Functional labels such as tonic, dominant, subdominant, and so on

This helps the tool act as both a writing aid and a learning/reference tool.

### 4. Suggestion engine

The current suggestion system uses harmonic transition rules and function-based weighting.

In simple terms, the app:

- Looks at the selected key
- Looks at the current chord
- Finds plausible next chords
- Adjusts suggestions based on the feeling the user wants to aim for

This means the app is not randomly inventing chords. It is using music theory rules and weighted logic to make suggestions that are more musically grounded.

---

## Design philosophy

This project is intentionally not trying to replace composition.

It is built on a few principles:

- Help the musician, do not replace the musician
- Suggest possibilities, do not force outcomes
- Use theory to support creativity
- Keep the process exploratory rather than automated
- Allow room for surprise, taste, and human choice

The long-term intention is to build something that helps musicians move forward when they are stuck, especially in the awkward space between having a nice idea and not knowing what should follow it.

---

## Current features

- Interactive Circle of Fifths
- Key selection
- Relative and parallel key display
- Diatonic chord table
- Roman numeral function display
- Feeling-based next chord suggestions
- A softer visual design intended for easier exploration and reference

---

## Future ideas

This project is still growing, and there are a number of directions it could go.

### Improved progression support

The current model mainly works from a single chord and a target feeling. A stronger next step is to support short progressions so the tool can make better decisions based on context.

At the moment, you can build around a chord, but the system is not yet truly aware of the progression as a whole or the emotional shape created by that progression.

Planned ideas include:

- Entering multiple chords instead of working from a single current chord
- Using progression history to improve next-chord suggestions
- Showing safer options versus more adventurous options
- Better transition scoring based on cadence, tension, and release
- Suggesting short progression continuations rather than only a single next chord

### Scale support

Adding scale-aware support would make the tool more useful melodically as well as harmonically.

Possible additions:

- Scales for each key
- Mode suggestions
- Relative modal colours
- Suggested melodic note pools for a given progression
- Scale overlays tied to the chord currently selected

### Better sound support

The app could become much more practical if the sound side improves.

Possible additions:

- Cleaner playback
- Better instrument sounds
- Different sound sets or timbres
- More realistic chord voicing playback
- Support for layered sound examples
- Chord positioning options

### Bass hangs and root movement ideas

A useful direction is to support the lower harmonic structure, not just the upper chord names.

Possible additions:

- Bass hang suggestions
- Pedal note options
- Alternate bass notes
- Root motion guidance
- Slash chord support
- Suggestions for holding a bass note while harmony shifts above it

### Alternate roots and reharmonisation

Musicians often want to explore the same emotional idea through a different harmonic route.

Possible additions:

- Alternate root note suggestions
- Chord substitution ideas
- Borrowed chord hints
- Parallel key borrowing
- Modal interchange
- Colour chord options

### Smarter suggestion modes

The current feeling system is rule-based. Over time, it may be useful to add more advanced options without giving away full authorship.

Possible additions:

- AI-assisted suggestion ranking rather than AI composition
- More nuanced emotional categories
- Style-sensitive suggestions
- Context-aware progression analysis
- Suggestions based on user-selected mood and harmonic complexity

The important part is that AI should remain supportive, not dominant. The purpose is to offer possibilities, not to generate finished music on behalf of the user.

### Musician-first workflow

Longer term, this tool could become a more complete idea companion for composition.

Possible additions:

- Save favourite progressions
- Compare alternate next-chord paths
- Export progression ideas
- DAW-friendly formats
- MIDI output
- Better visual analysis of harmonic flow

---

## Long-term vision

The long-term goal is to build a musician-first composition support tool.

Not a button that writes songs.

Not a generator that replaces decision-making.

But a tool that helps with:

- the next chord
- the next transition
- the next section
- the next emotional shift
- the next useful idea

This is meant to support people who want to keep ownership of their music while still having intelligent assistance available when they need it.

---

## Status

This project is currently in active development.

The present focus is on:

- improving theory clarity
- improving suggestion quality
- supporting better progression-based input
- expanding the app into a more useful writing companion for real musicians

---

## Contributing

Suggestions, musical feedback, theory corrections, and feature ideas are welcome.

Especially useful feedback includes:

- harmonic edge cases
- theory display issues
- suggestion quality
- progression logic improvements
- practical workflow ideas from real musicians

---

## Summary

Chord Supporting Helper Application is an interactive music support tool for musicians who want help finding what comes next, while still writing the music themselves.

It combines visual theory, harmonic structure, and guided suggestion systems to help users move forward creatively without giving up control of the process.
