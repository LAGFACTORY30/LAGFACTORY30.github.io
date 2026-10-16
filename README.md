Jordan's Apocalypse Z — 3D Campaign Prototype
A browser-based, first-person zombie survival prototype built with Three.js. It is designed to be hosted as a static site on GitHub Pages and does not require a server or build step.
Files
- index.html — menu, mission briefing, HUD, and UI.
- style.css — visual styling and responsive/touch layout.
- game.js — Three.js scene, city, movement, shooting, zombies, weapons, and game state.
Deploy on GitHub Pages
1. Download and unzip jordans_apocalypse_z_3d.zip.
2. Open your GitHub repository.
3. Upload index.html, style.css, game.js, and README.md into the repository's published root folder. Keep all three code files beside each other.
4. Commit the changes.
5. In GitHub, open Settings → Pages. Under Build and deployment, choose Deploy from a branch, select your branch (usually main) and folder (/(root)), then save.
6. Wait for the Pages deployment to finish, then open your site and do a hard refresh (Ctrl+Shift+R).
Controls
- W A S D — move
- Mouse — look around (click the game canvas to capture the mouse)
- Left click — fire
- R — reload
- 1 / 2 — switch pistol / rifle
- Shift — sprint
- Esc — release mouse / pause; click the game again to resume
- Touchscreens: virtual movement stick, drag on the right side to look, FIRE and reload buttons
Important notes
- This is a 3D prototype, not a finished AAA game. Models are assembled from simple 3D geometry. The next quality jump would be adding licensed/own 3D character and weapon models, animations, textures, and recorded audio.
- Three.js is loaded from jsDelivr, and fonts are loaded from Google Fonts. The first load needs an internet connection.
- GitHub Pages serves static files, so no backend is needed.
- If the game shows a blank screen, open Chrome DevTools → Console and check for module/network errors. Make sure the repository paths are exactly index.html, style.css, and game.js, including capitalization. A CDN or network blocker can also prevent Three.js from loading.
- For Chromebook performance, shadows are disabled on touch devices and the renderer limits pixel ratio to 1.5.
