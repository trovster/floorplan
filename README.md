# Floorplan

An interactive floorplan of a two-storey house, at [floorplan.trovster.com](https://floorplan.trovster.com).

You can view each floor as a flat plan or as an isometric 3D model, and switch the lights and devices from the plan, the model or a side drawer. It is drawn in the [ISO-GLOW](https://isoglow.dev) style: dark hairline drawings where only what is switched on glows.

## What it does

- **Two floors.** ▲ ▼, or the arrow keys, move between the ground and first floor.
- **Plan and 3D.** The plan is a top-down drawing. The 3D view is isometric: drag to orbit, right-drag to pan, scroll to zoom. In 3D, the outside walls nearest the camera drop low, like a dollhouse, so you can see into every room from any angle. Press V to switch views.
- **Lights and devices.** Click a device's button, or the lamp, TV or stairs in the 3D model, to switch it.
  - Lit lamps glow and cast a pool of light on their room's floor, and the windows of lit rooms glow at night.
  - The robot vacuum drives round the kitchen when it is started.
  - Doors open and close when clicked.
- **Drawer.** The ☰ button or D opens it. It has every device by floor and room, switches for each room, All on / All off, and the glow colour.
- **Day / Night / Auto.** Day is the light theme and turns the lights off. Night is the dark theme and turns them on. Auto follows the time of day.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page: controls, drawer and the import map for three.js |
| `floorplan.js` | Everything else: the house, the furniture, devices, views and interaction |
| `floorplan.css` | Theme tokens for light and dark, controls, drawer and labels |
| `vendor/three/` | The parts of [three.js](https://threejs.org) r160 the page uses (MIT licence, included) |
| `CNAME` | The custom domain for GitHub Pages |

### How the house is described

The house is traced from the estate agent's floor plan. Every wall, door, window, room and piece of furniture is given in pixels of that drawing, at 141 px per metre. The first floor is drawn 1,117 px to the right of the ground floor, as on the original.

The data is near the top of `floorplan.js`:
- `PLAN` lists each floor's slab, outside walls, inside walls, windows, doors and rooms.
- `buildGround` and `buildFirst` place the furniture and the light fittings.
- `DEVICES` lists the switchable devices and which room each is in.

Heights are in metres. The outside walls are cut at 1.05 m and the inside walls at 0.75 m.

### Connecting real devices

`floorplan.js` exposes `window.floorplan` and fires a `floorplan:ready` event when it has loaded. Another script can use it to show real device states and to control real devices:

- `applyState({ id, state, attributes })` updates a device.
- `remote(devices, on)` is called before a switch changes.
- Setting `live` to `true` stops Day / Night / Auto from switching lights; they then only change the theme.
- Setting `night` overrides the clock for Auto.

This site has no such connection: switches only change the page.

## Running it locally

The page loads three.js as ES modules from `./vendor`, so it needs to be served over HTTP rather than opened as a file:

```sh
npm start        # python3 -m http.server 8000, then open http://localhost:8000
```

## Updating three.js

three.js is installed with npm and only the files the page needs are copied into `vendor/`:

```sh
npm install three@<version> --save-dev --save-exact
npm run vendor
```

The page is tested with three.js r160. Later versions split `three.module.js` into two files, so check the `vendor` script copies everything when you upgrade.

## Deploying

GitHub Pages serves the repository's `main` branch as it is, with no build step. `CNAME` points the site at `floorplan.trovster.com`. The DNS for that name needs a CNAME record pointing to `trovster.github.io`.

## Credits

- Visual style: [ISO-GLOW](https://isoglow.dev).
- 3D rendering: [three.js](https://threejs.org), MIT licence.
