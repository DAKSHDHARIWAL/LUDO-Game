# Ludo Royale — complete playable starter

A polished, no-dependency browser game using HTML, CSS and JavaScript, with an optional Python local server.

## Run on macOS
1. Extract `Ludo_Royale_Complete.zip`.
2. Open Terminal and change into the extracted folder, for example:
   `cd ~/Downloads/ludo_ultimate`
3. Run:
   `python3 server.py`
4. Open `http://localhost:8000` in Safari or Chrome.

You can also double-click `index.html` to open it directly in a modern browser.

## Features
- Responsive game UI and animated selectable tokens
- Four colors, four tokens per player
- Random dice shared equally by all colors
- Six required to bring a token out of the yard
- Shared loop and colored home lanes
- Exact roll required to finish
- Captures and safe squares
- Bonus turn on a six, capture, or finish
- Three consecutive sixes forfeit the turn
- Red vs three bot opponents, with Easy / Normal / Hard difficulty
- Local four-player hot-seat mode
- Sound toggle, rules dialog, new-game control, win screen

## Files
- `index.html`: page structure
- `style.css`: responsive styling
- `game.js`: rules, game state, bots, rendering and interactions
- `server.py`: optional local server
- `README.md`: setup and overview

## Notes
This is a self-contained learning project and requires no npm packages. Dice results are random for all colors; Red's strategy is not secretly guaranteed to win.
