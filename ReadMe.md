# Battleship

A browser Battleship game against a computer bot, built with plain HTML, CSS and JavaScript.

## How to play

1. Open `index.html` in a browser (or serve the folder, e.g. `npx http-server`).
2. Place your 9 vessels on your board — click to place, **R** or right-click to rotate, or hit **Random**.
   Vessels can't touch each other, not even diagonally.
3. Pick the bot difficulty (Easy / Normal / Hard) and press **Start Game**.
4. Click the enemy board to fire. A hit lets you fire again; a miss passes the turn to the bot.
5. Right-click an enemy cell to flag it as empty. Water around a sunk vessel is marked automatically.
6. Sink the whole enemy fleet to win.

## Fleet

| Vessel | Size | Count |
| --- | --- | --- |
| Carrier | 5 | 1 |
| Battleship | 4 | 1 |
| Submarine | 3 | 1 |
| Destroyer | 2 | 1 |
| Patrol Boat | 1 | 5 |

## Bot difficulty

- **Easy** – fires at random.
- **Normal** – fires at random until it hits, then hunts the rest of that ship.
- **Hard** – works out where the remaining ships are most likely to be and fires there.

## Music

Background music is optional: put a file named `backgroundMusic0.mp3` next to `index.html` and a music button appears once the game starts.
