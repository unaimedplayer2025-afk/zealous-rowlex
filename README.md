# ZEALOUS SHOOTER — Rowlex vs Evil

A browser remake of **Zealous Shooter** (Valor Quest). You play as **Rowlex**, a dark-green armored sphere robot, fighting a swarm of dripping purple brain creatures under a black-hole mountain sky. The final boss is **Evil** — 666 HP. Body shots deal 1 damage. Headshots deal 111.

Play: **https://unaimedplayer2025-afk.github.io/zealous-rowlex/**  
or open `index.html` from any static web server (ES modules need http, not `file://`). `python3 -m http.server 8770` works locally.

Title screen: first tap or key unlocks the title theme; the second starts the game.

## Controls

- **WASD** (or arrows) move
- **Left mouse** click and hold to fire continually
- **Enter** pauses — any key resumes
- **Esc** quits back to the title
- **M** or the speaker button mutes
- Phone: left-side stick to move, FIRE button to shoot

The game speeds up as your score rises. Beat your Best Score, or take Evil down. The Good Game screen shows your score, best (in red), and Evil's remaining HP.

## Music

OGG plus an MP3 fallback, picked with `canPlayType`. Audio unlocks on the first tap or key, and **M** mutes.

- `audio/title-theme.{ogg,mp3}` — title / Good Game bed, from **THE RIFT & THE REACH** title theme
- There is no gameplay music bed in this build (sound effects still play). To add one later, drop `audio/gameplay.{ogg,mp3}` in the `audio/` folder and set `MUSIC.game` in `src/audio.js`.

## Flags

`?boss` starts the fight with Evil already arriving. `?lowfx` skips bloom. `?seed=` makes the run reproducible.
