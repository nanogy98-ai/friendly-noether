# Connect Four - Premium Web Arcade

A responsive browser Connect Four game with pass-and-play, computer opponents, private friend rooms, move history, optional engine feedback, persistent scores, custom token art, and synthesized arcade audio.

![Red Connect Four token](https://raw.githubusercontent.com/nanogy98-ai/friendly-noether/main/red-connect-four-token.png)

---

## Features

* **Arcade board presentation**: A blue plastic-style board with beveled holes, drop animations, highlights, and win celebrations.
* **Custom token assets**: Optimized red and yellow WebP artwork is used for in-board pieces, with CSS gradients as a fallback.
* **Pass & Play**: Local two-player play on one device.
* **Vs Computer**: Four strengths use a Web Worker search engine with alpha-beta pruning, iterative deepening, and a bounded thinking time.
* **Move Coach**: Optional post-move engine feedback for immediate wins, missed blocks, threats, and stronger alternatives.
* **Move history**: Rebuilds correctly across new games, undo, and restored sessions.
* **Persistent state**: Session scores, all-time player wins, names, timer, active board, and difficulty are saved in `localStorage`.
* **Resilient private rooms**: Share a six-hour Firebase room link or paste its unguessable room code. Authenticated room state, scores, clocks, and presence survive refreshes and temporary disconnects.
* **Accessible controls**: Board columns are keyboard-focusable controls with labels, dialogs trap focus, and move/results are announced through live regions.

---

## Run Locally

This is a static web app. From the project directory:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

You can also deploy the files to any static host. Pass & Play and computer modes run fully in the browser. Online friend matches use Firebase Realtime Database and require the rules in `database.rules.json`.

---

## Online Friend Match

1. Open Settings.
2. Choose **Play with a Friend**.
3. Host copies the generated invitation link or room code.
4. Guest opens the invitation link or pastes the room code and connects.

The host controls shared match settings and the authoritative board and clock state. Players receive anonymous Firebase identities, and a temporary disconnect pauses play until both players return. Online rooms are secure casual matches, not server-refereed competitive sessions.

---

## Tests

The regression suite uses Node's built-in test runner:

```bash
node --test tests/game-regressions.test.mjs
```

The tests cover game rules, engine tactics, state restoration, score rollback, legacy-name migration, timer persistence, round cancellation, authoritative online snapshots, reconnect hydration, and online timeouts.
