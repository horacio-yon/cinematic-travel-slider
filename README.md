# Cinematic Travel Slider — Codea con Horacio

A fullscreen, build-free travel experience made with semantic HTML, CSS and modern JavaScript. Four local photographic landscapes, a static traveler and a card-to-fullscreen reveal form one continuous scene.

## Open the project

Open `index.html` directly in a modern browser. No installation, Node server, build step or Internet connection is required. Keep `css/`, `js/` and `assets/` next to the HTML file.

## Explore and enter

The page starts in **browse** mode with Patagonia Express selected and the Patagonia landscape behind the carousel.

- Click a card to enter that exact destination immediately. It expands from its current position; clicking a card never advances to its neighbor.
- Use a bottom indicator to select a destination without opening it.
- Use Previous / Next or the Left / Right arrow keys to navigate.
- Drag horizontally with the mouse, swipe on touchscreens, or scroll with a mouse wheel / trackpad.
- Home selects Patagonia; End selects Vulcan Hunt.
- Navigation actions center the selected card in approximately 550 ms. They never open a landscape or change the background, traveler lighting, cinematic phrase or expedition statistics.
- Press **ENTER THE LANDSCAPE ↗** to explicitly open the selected destination. The selected photograph expands from its measured card rectangle to fill the screen.
- Press **EXPLORE DESTINATIONS ↔** or Escape to return to the carousel. The opened photograph remains behind it.
- Navigation in immersive mode returns to the carousel and selects the requested card. Another explicit card click or press of **ENTER THE LANDSCAPE ↗** is required to open it.
- The top-right reset selects Patagonia and returns to the carousel; it does not automatically replace the opened landscape.

All controls are native buttons and work with Tab and Enter / Space. Enter / Space on a card opens that exact card; Enter / Space on the dedicated entry button opens the selected card. Reduced-motion preferences disable ambient animations and shorten programmed transitions.

## State and animation ownership

`TravelSlider` in `js/app.js` separates:

| Member | Responsibility |
| --- | --- |
| `selectedIndex` | Card currently selected in the carousel. |
| `openedIndex` | Photograph, phrase, lighting and statistics currently displayed. |
| `selectDestination(index)` | Selection, card layout, counter, indicators and selected-destination label. |
| `enterDestination(index = selectedIndex)` | Explicit card / button entry, image preparation, measured fullscreen reveal and scene updates. |
| `returnToBrowse()` | Restore the cards without changing the opened scene. |
| `layoutCards(index, mode, duration)` | Position fixed card slots, animate the shared circular track and retarget from the current rendered frame. |
| `view` | `browse`, `entering`, `immersed` or `returning`. |
| `busy` | Protect cinematic entry and return sequences. Card selection remains interruptible. |

The carousel moves a shared track across repeated offscreen copies of the same four destinations. At a complete loop it rebases to an identical copy, so no visible card crosses the deck or jumps from one edge to the other. Copies reuse the existing photographs and are excluded from duplicate keyboard / screen-reader navigation. Rapid selections replace pending animations from their current rendered position instead of adding an animation queue. Navigation during entry keeps the requested selection and returns to browse after the current reveal; it never starts another reveal. The entry button is disabled during entry / return. Metrics and the cinematic phrase always belong to `openedIndex`; the card counter and indicators always belong to `selectedIndex`.

## Files

```text
cinematic-travel-slider/
├── index.html
├── README.md
├── css/styles.css
├── js/app.js
└── assets/images/
    ├── patagonia.png
    ├── arctic.png
    ├── tundra.png
    ├── vulcan.png
    ├── traveler.png
    └── asset-notes.md
```

The original visual references are preserved in the sibling `../referencias/` directory. Images are original AI-generated photographic compositions. Destinations and route statistics are illustrative; asset provenance and prompts are documented in `assets/images/asset-notes.md`.

## Edit destinations

Edit the `destinations` array at the beginning of `js/app.js` to change names, phrases, locations, metrics and lighting. The matching image path is `assets/images/<slug>.png`. The current composition and navigation are designed for four destinations.

## Manual verification

1. Reload the page: four cards are available and the entry button is visible.
2. Navigate right three times, then left. Selection and indicators change; the Patagonia background and metrics stay stable.
3. Drag / swipe, use indicators and the trackpad. No reveal should start. Click a card: that exact card should open, even if it was not selected. Return to browse afterwards.
4. Make several rapid selections. The latest selected card should end in the center.
5. Press the entry button: only that selected card expands into its landscape, with matching phrase and metrics.
6. Return using the explore button. The opened background must remain unchanged.
7. Select another card with an arrow or an indicator: the background and metrics must still belong to the previously opened destination.
8. Press the entry button again. Repeat for all four destinations.
9. From immersive mode, press an arrow: the carousel should return without opening another landscape.
10. Test Tab, Enter / Space, Escape, Home, End, touch input and reduced motion. Inspect the browser console for unexpected errors.
