# Connect Four - Premium Web Arcade

A responsive, browser-based Connect Four game with pass-and-play, computer opponents, PeerJS WebRTC friend matches, move history, coach feedback, persistent scores, token art, and synthesized arcade-style audio.

![Red Connect Four token](https://raw.githubusercontent.com/nanogy98-ai/friendly-noether/main/red-connect-four-token.png)

---

## Features

* **Arcade board presentation**: A blue plastic-style board with beveled holes, drop animations, highlights, and win celebrations.
* **Custom token assets**: The red and yellow PNG token files are used for in-board pieces, with CSS gradients as visual fallback.
* **Pass & Play**: Local two-player play on one device.
* **Vs Computer**: Easy, Medium, and Hard computer strengths using Minimax with alpha-beta pruning and center-column move ordering.
* **Move Coach**: Optional post-move feedback for missed wins, missed blocks, strong moves, and inaccurate moves.
* **Move history**: Rebuilds correctly across new games, undo, and restored sessions.
* **Persistent state**: Session scores, all-time player wins, names, timer, active board, and difficulty are saved in `localStorage`.
* **PeerJS online matches**: Share a generated invite link or paste a peer ID to play directly with a friend.
* **Accessible controls**: Board columns are keyboard-focusable controls with labels, and turn/win changes are announced through live regions.

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

You can also deploy the files to any static host. Pass & Play and computer modes run fully in the browser. Online friend matches use PeerJS signaling plus WebRTC data channels, so they depend on browser/network support for peer-to-peer connections.

---

## Online Friend Match

1. Open Settings.
2. Choose **Play with a Friend**.
3. Host copies the generated invite link or peer ID.
4. Guest opens the invite link or pastes the peer ID and connects.

Either player can start a fresh online board; the reset is synchronized to the peer.

---

## Tests

The regression suite uses Node's built-in test runner:

```bash
node --test tests/game-regressions.test.mjs
```

The tests cover the state bugs that matter most for playability: hidden settings groups, first-turn text, move history reset/undo/restore, and saved player names.
