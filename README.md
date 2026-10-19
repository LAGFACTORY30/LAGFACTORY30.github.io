# JETSTORM — Open-World Flight Simulator

A browser-based 3D jet flying prototype built with Three.js. Designed for static hosting on GitHub Pages; no build step or server is required.

## Features

- Three selectable aircraft with different speed and handling characteristics.
- Procedurally shaped island terrain, coastal water, forests, a town, airbase, hangars, clouds, and elevated navigation checkpoints.
- Chase camera and cockpit-style camera.
- Flight HUD with airspeed, altitude, heading, checkpoint distance, and a navigation radar.
- Momentum-based flight controls, bank-to-turn steering, afterburner, pause, and flight trim.
- Responsive interface for desktop and smaller screens.

## Run / deploy

The site loads Three.js as an ES module from jsDelivr and fonts from Google Fonts, so an internet connection is required when loading the game.

1. Keep `index.html`, `style.css`, and `game.js` together in the repository's published root folder.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**, choose `main` and `/(root)`, then save.
4. Open the published Pages URL after deployment completes and refresh the page.

## Controls

- **W / Up Arrow** — pitch up
- **S / Down Arrow** — pitch down
- **A / Left Arrow** — bank left
- **D / Right Arrow** — bank right
- **Shift** — afterburner
- **C** — switch chase / cockpit camera
- **Space** — flight trim reset
- **P / Escape** — pause or resume
- **H** — return to hangar

## Notes

This is a playable browser prototype, not a full commercial flight simulator. The aircraft and environment are assembled from procedural 3D geometry rather than high-detail licensed models. Terrain, flight handling, and scale are simplified for accessibility and performance. The first load requires access to the Three.js CDN.
