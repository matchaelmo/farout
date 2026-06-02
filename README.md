# FAROUT NYC Mapbox Starter

This is a beginner-friendly version of your FAROUT mockup. The design and branding stay the same: dark theme, forest green `#2D6A4F`, volcano orange `#D94F00`, sand `#F5F0E8`, Barlow Condensed headings, and the floating left panel with **Explore**, **My Route**, and **Trail AI** tabs.

## What each file does

- `index.html` — the page structure: map container, top nav, floating panel, tabs, legend, and route bar.
- `style.css` — all visual styling and FAROUT brand colors. You can treat this as the design file.
- `app.js` — the live app behavior: Mapbox map setup, NYC bike lane loading, route planning, geocoding, pins, and lane breakdown.
- `config.js` — the only file a first-time builder needs to edit at first. Paste your free Mapbox public token here.

## Step 1: Get a free Mapbox API key

1. Go to [mapbox.com](https://www.mapbox.com/) and create a free account.
2. After signing in, open your Mapbox tokens page: <https://account.mapbox.com/access-tokens/>.
3. Copy your **Default public token**. It starts with `pk.`.
4. Open `config.js`.
5. Replace this placeholder:

   ```js
   window.FAROUT_MAPBOX_TOKEN = 'PASTE_YOUR_MAPBOX_PUBLIC_TOKEN_HERE';
   ```

   with your token:

   ```js
   window.FAROUT_MAPBOX_TOKEN = 'pk.your-real-token-here';
   ```

6. Save the file and refresh the browser.

> Tip: A Mapbox `pk...` token is meant to be used in browser apps. When you publish the app, restrict the token to your website URL in the Mapbox dashboard.

## Step 2: Run the app locally

Because browsers can block some map/data requests when opening files directly, run a tiny local server from this folder:

```bash
python3 -m http.server 8000
```

Then open this in your browser:

```text
http://localhost:8000
```

## Step 3: Confirm the real NYC bike lanes loaded

The app loads NYC DOT bike route data from NYC Open Data:

```text
https://data.cityofnewyork.us/resource/mzxg-pwib.geojson?$limit=50000
```

The lanes are color-coded for the FAROUT safety legend:

- Protected / greenway / path style lanes: `#2D9E5A`
- Painted / conventional bike lanes: `#378ADD`
- Shared / sharrow / signed routes: `#7F77DD`

The dataset uses many descriptive fields, so `app.js` classifies each line by reading the feature text and matching words like “protected,” “greenway,” “standard,” “shared,” and “sharrow.”

## Step 4: Plan a real route

1. Click **My Route**.
2. Type a starting place, for example: `Times Square`.
3. Type a destination, for example: `Brooklyn Bridge Park`.
4. Keep **Bike** selected.
5. Click **Plan My Route →**.

The app will:

- Geocode both places with Mapbox.
- Request real Mapbox Directions using the cycling profile.
- Draw the route on the map.
- Add start and destination pins.
- Estimate route time and distance.
- Estimate how much of the bike route is protected, painted, shared, or unmapped by matching the route geometry against NYC Open Data bike lane line segments.

## Notes for first-time builders

- If the map does not appear, check that `config.js` contains your real Mapbox public token and that it starts with `pk.`.
- If bike lanes do not appear, NYC Open Data may be temporarily slow. The route planner can still work with Mapbox.
- If a place is not found, add “NYC” or a borough name to the search, like `Astoria Park Queens NYC`.
- The lane breakdown is a helpful estimate, not a legal or safety guarantee. Always follow posted street signs and conditions.
