# Quantum Connect Four - Premium Web Arcade

A visually stunning, responsive, and fully featured web-based Connect Four game. It features Pass & Play local multiplayer, an advanced Minimax AI with Alpha-Beta pruning, highly detailed physical sound synthesis using the Web Audio API, and an local network (LAN) multiplayer coordinator.

![Quantum Connect Four Mockup](https://raw.githubusercontent.com/nanogy98-ai/friendly-noether/main/red-connect-four-token.png) *(Displays token assets)*

---

## 🚀 Features

* **3D Blue Plastic Board**: Designed to emulate the physical Connect Four board with beveled cell rings (using radial gradients) and custom drop animations with physical easing and bouncing.
* **Custom Token Integration**: Integrates the high-resolution red and yellow token PNG files directly into the grid.
* **Advanced Minimax AI**: Features a selectable difficulty mode (Easy, Medium, Hard). The Hard AI uses a depth-5 Minimax search with Alpha-Beta pruning, optimized by center-column priority sorting, to play a highly defensive and strategic game.
* **Physical Audio Synthesis**: Built with the browser's native **Web Audio API** (zero file downloads).
  * **Layer 1**: A highpass-filtered white noise buffer to simulate the scraping sound of plastic sliding down the grid.
  * **Layer 2 & 3**: A pitch-swept triangle oscillator (3kHz -> 600Hz) and a bandpass-filtered noise snap to simulate the sharp "clack" when the chip impacts the bottom.
  * **Resonance Scaling**: Drop scraping durations and impact frequencies scale dynamically based on the landing row depth to sync perfectly with animations.
* **All-Time Scores Registry**: Saves scores per player name globally in `localStorage`. Shows total match scores alongside the session scores.
* **Timer & Hint Helpers**: Includes a count-up session timer and a **Hint** button which uses the Minimax AI to evaluate the best column and flashes its indicator arrow.
* **LAN Multiplayer**: Coordinates real-time matches over your local area network (LAN) using a lightweight Python API backend.

---

## 📦 How to Play on Your Local Network (LAN)

The game coordinates real-time play between multiple devices on the same Wi-Fi or local network using a state-sharing server.

1. **Start the Coordinator on Your Mac**:
   Open a terminal in the project directory and run:
   ```bash
   python3 server.py
   ```
2. **Find Your Share Link**:
   * Open the game in your browser at `http://localhost:8000/`.
   * Click the **Gear icon** in the top right to open the **Game Settings** drawer.
   * Copy the **LAN Share Link** (e.g. `http://192.168.0.46:8000/`) or show the **QR Code** to your friend.
3. **Connect & Play**:
   * Have your friend scan the QR code or navigate to the share link on their phone/tablet/laptop.
   * In the settings drawer, choose your roles: one device selects **Red (P1)** and the other selects **Yellow (P2)**.
   * The board will synchronize moves, scores, names, and turns in real-time across both screens!

---

## ⚡ Hosting on Vercel

If you deploy this repository to **Vercel**:

* **Pass & Play** and **Vs Quantum AI** modes will work perfectly out of the box because they run entirely in the browser client-side.
* **LAN Multiplayer Mode** will not function on Vercel's standard static hosting because Vercel runs stateless serverless functions and cannot run `server.py` as a persistent background daemon. To play network matches, run the server locally on your Mac as described above.
