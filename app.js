const NYC_BIKE_ROUTES_URL = 'https://data.cityofnewyork.us/resource/mzxg-pwib.geojson?$limit=50000';
const NYC_BOUNDS = [[-74.35, 40.45], [-73.65, 40.95]];
const LANE_COLORS = {
  protected: '#2D9E5A',
  painted: '#378ADD',
  shared: '#7F77DD',
  unknown: '#378ADD'
};
const LANE_LABELS = {
  protected: 'Protected lane',
  painted: 'Painted lane',
  shared: 'Shared street',
  unknown: 'Bike lane'
};

let carFree = true;
let map;
let bikeLaneSegments = [];
let startMarker;
let endMarker;
let bikeLaneData = { type: 'FeatureCollection', features: [] };

function toggleCar(){
  carFree = !carFree;
  document.getElementById('carToggle').classList.toggle('off', !carFree);
  document.getElementById('carLabel').textContent = carFree ? 'Car-Free ON' : 'Car Options ON';
}

function switchTab(name, btn){
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['explore', 'route', 'trail'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === name ? 'block' : 'none';
  });
}

function pickVibe(btn){
  document.querySelectorAll('.vibe-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function pickEnergy(btn){
  btn.parentElement.querySelectorAll('.energy-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function showResults(){
  document.getElementById('results-wrap').style.display = 'block';
}

function selectResult(card, dist, time, elev, mode){
  document.querySelectorAll('.result-card').forEach(c => c.classList.remove('active-card'));
  card.classList.add('active-card');
  document.getElementById('routeInfo').classList.add('show');
  document.getElementById('ri-dist').textContent = dist;
  document.getElementById('ri-time').textContent = time;
  document.getElementById('ri-elev').textContent = elev;
  document.getElementById('ri-mode').textContent = mode;
}

function getToken(){
  return window.FAROUT_MAPBOX_TOKEN || '';
}

function hasToken(){
  const token = getToken();
  return token && !token.includes('PASTE_YOUR_MAPBOX_PUBLIC_TOKEN_HERE');
}

function initMap(){
  if (!hasToken()) return;

  mapboxgl.accessToken = getToken();
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-73.985, 40.735],
    zoom: 11.6,
    maxBounds: NYC_BOUNDS
  });

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

  map.on('load', async () => {
    document.getElementById('mapLoading').style.display = 'none';
    addRouteLayers();
    await loadBikeLanes();
  });
}

function addRouteLayers(){
  map.addSource('farout-route', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  map.addLayer({
    id: 'farout-route-glow',
    type: 'line',
    source: 'farout-route',
    paint: {
      'line-color': '#52B788',
      'line-width': 9,
      'line-opacity': 0.2,
      'line-blur': 3
    }
  });

  map.addLayer({
    id: 'farout-route-line',
    type: 'line',
    source: 'farout-route',
    paint: {
      'line-color': '#52B788',
      'line-width': 4,
      'line-dasharray': [1, 1.3]
    }
  });
}

async function loadBikeLanes(){
  setRouteStatus('Loading real NYC bike lanes from NYC Open Data…');
  try {
    const response = await fetch(NYC_BIKE_ROUTES_URL);
    if (!response.ok) throw new Error('NYC Open Data returned ' + response.status);
    const data = await response.json();
    bikeLaneData = prepareBikeLaneData(data);
    bikeLaneSegments = flattenBikeLaneSegments(bikeLaneData);
    addBikeLaneLayers(bikeLaneData);
    setRouteStatus('NYC bike lanes loaded. Type a start and destination to plan a real route.');
  } catch (error) {
    console.error(error);
    setRouteStatus('Bike lane data could not load yet. The map and directions can still work.', true);
  }
}

function prepareBikeLaneData(data){
  return {
    type: 'FeatureCollection',
    features: (data.features || [])
      .filter(feature => feature.geometry)
      .map(feature => ({
        ...feature,
        properties: {
          ...(feature.properties || {}),
          safety: classifyLane(feature.properties || {})
        }
      }))
  };
}

function addBikeLaneLayers(data){
  map.addSource('nyc-bike-lanes', { type: 'geojson', data });

  map.addLayer({
    id: 'nyc-bike-lanes-casing',
    type: 'line',
    source: 'nyc-bike-lanes',
    paint: {
      'line-color': '#111613',
      'line-width': 5,
      'line-opacity': 0.75
    }
  });

  map.addLayer({
    id: 'nyc-bike-lanes-colored',
    type: 'line',
    source: 'nyc-bike-lanes',
    paint: {
      'line-color': [
        'match', ['get', 'safety'],
        'protected', LANE_COLORS.protected,
        'painted', LANE_COLORS.painted,
        'shared', LANE_COLORS.shared,
        LANE_COLORS.unknown
      ],
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 15, 4],
      'line-opacity': 0.88
    }
  });

  map.on('click', 'nyc-bike-lanes-colored', event => {
    const props = event.features[0].properties || {};
    const label = LANE_LABELS[props.safety] || 'Bike lane';
    const street = props.street || props.streetname || props.stname || props.name || props.segmentid || 'NYC bike route';
    new mapboxgl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(`<div class="lane-popup-title">${escapeHtml(label)}</div><div>${escapeHtml(street)}</div>`)
      .addTo(map);
  });

  map.on('mouseenter', 'nyc-bike-lanes-colored', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'nyc-bike-lanes-colored', () => { map.getCanvas().style.cursor = ''; });
}

function classifyLane(properties){
  const text = Object.values(properties).join(' ').toLowerCase();
  if (/protected|greenway|cycle\s*track|cycletrack|path|off.?street|bridge|buffered/.test(text)) return 'protected';
  if (/shared|sharrow|signed route|bike route|shared lane/.test(text)) return 'shared';
  if (/standard|conventional|lane|striped|painted/.test(text)) return 'painted';
  return 'unknown';
}

async function showRoute(){
  if (!hasToken()) {
    setRouteStatus('First paste your free Mapbox public token into config.js, then refresh the page.', true);
    return;
  }

  const startText = document.getElementById('startInput').value.trim();
  const endText = document.getElementById('endInput').value.trim();
  if (!startText || !endText) {
    setRouteStatus('Please type both a starting point and a destination.', true);
    return;
  }

  const activeMode = document.querySelector('#travelModes .energy-btn.active');
  const profile = activeMode?.dataset.mode || 'cycling';
  const modeLabel = activeMode?.textContent.replace(/[^A-Za-z]/g, '') || 'Bike';

  setRouteStatus('Finding those places and asking Mapbox for real directions…');
  setRouteButtonDisabled(true);

  try {
    const [start, end] = await Promise.all([geocodePlace(startText), geocodePlace(endText)]);
    const route = await getDirections(start.center, end.center, profile);
    drawRoute(route.geometry, start.center, end.center);

    const totalMiles = metersToMiles(route.distance);
    const minutes = Math.max(1, Math.round(route.duration / 60));
    const breakdown = profile === 'cycling' ? calculateLaneBreakdown(route.geometry.coordinates) : null;
    renderRouteResult(start.place_name, end.place_name, totalMiles, minutes, modeLabel, breakdown);

    document.getElementById('routeInfo').classList.add('show');
    document.getElementById('ri-dist').textContent = totalMiles.toFixed(1) + ' mi';
    document.getElementById('ri-time').textContent = minutes + ' min';
    document.getElementById('ri-elev').textContent = breakdown ? breakdown.bestLabel : '—';
    document.getElementById('ri-mode').textContent = modeLabel;
    setRouteStatus('Route ready on the map. Lane breakdown is estimated by matching the route to NYC Open Data bike lane segments.');
  } catch (error) {
    console.error(error);
    setRouteStatus(error.message || 'Something went wrong while planning the route.', true);
  } finally {
    setRouteButtonDisabled(false);
  }
}

async function geocodePlace(query){
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set('access_token', getToken());
  url.searchParams.set('bbox', NYC_BOUNDS.flat().join(','));
  url.searchParams.set('proximity', '-73.985,40.735');
  url.searchParams.set('limit', '1');

  const response = await fetch(url);
  if (!response.ok) throw new Error('Mapbox geocoding returned ' + response.status);
  const data = await response.json();
  if (!data.features?.length) throw new Error(`I could not find “${query}” in NYC. Try adding “NYC” or a borough.`);
  return data.features[0];
}

async function getDirections(start, end, profile){
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${start.join(',')};${end.join(',')}`);
  url.searchParams.set('access_token', getToken());
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('steps', 'true');

  const response = await fetch(url);
  if (!response.ok) throw new Error('Mapbox directions returned ' + response.status);
  const data = await response.json();
  if (!data.routes?.length) throw new Error('Mapbox could not find a route between those places.');
  return data.routes[0];
}

function drawRoute(geometry, start, end){
  map.getSource('farout-route').setData({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry }]
  });

  startMarker?.remove();
  endMarker?.remove();
  startMarker = new mapboxgl.Marker({ element: createMarker('start', '📍 Start') }).setLngLat(start).addTo(map);
  endMarker = new mapboxgl.Marker({ element: createMarker('end', '🏁 Destination') }).setLngLat(end).addTo(map);

  const bounds = geometry.coordinates.reduce((mapBounds, coord) => mapBounds.extend(coord), new mapboxgl.LngLatBounds(start, start));
  map.fitBounds(bounds.extend(end), { padding: { top: 95, right: 80, bottom: 120, left: 360 }, maxZoom: 15 });
}

function createMarker(type, label){
  const marker = document.createElement('div');
  marker.className = 'farout-marker';
  marker.innerHTML = `<div class="pin-dot ${type}"></div><div class="pin-label">${label}</div>`;
  return marker;
}

function renderRouteResult(startName, endName, miles, minutes, modeLabel, breakdown){
  const safeStart = escapeHtml(shortPlaceName(startName));
  const safeEnd = escapeHtml(shortPlaceName(endName));
  const lines = breakdown ? breakdown.items.map(item => (
    `<div>→ <span style="color:${LANE_COLORS[item.type]};">${LANE_LABELS[item.type]}</span> · ${item.miles.toFixed(1)} mi</div>`
  )).join('') : '<div>→ Lane matching is shown for bike routes only.</div>';
  const tag = breakdown ? breakdown.tag : 'Mapped route';

  document.getElementById('route-result').style.display = 'block';
  document.getElementById('route-result').innerHTML = `
    <div class="section-label">Your route breakdown</div>
    <div class="result-card active-card">
      <div class="result-name" style="margin-bottom:0.6rem;">📍 ${safeStart} → 🏁 ${safeEnd}</div>
      <div class="result-meta"><span>🚲 ${miles.toFixed(1)} mi total</span><span>⏱ ${minutes} min</span></div>
      <div class="route-breakdown">${lines}</div>
      <div class="result-tags"><span class="rtag bike">${escapeHtml(tag)}</span><span class="rtag bike">Real Mapbox route</span></div>
    </div>`;
}

function flattenBikeLaneSegments(data){
  const segments = [];
  data.features.forEach(feature => {
    const groups = geometryToLineGroups(feature.geometry);
    groups.forEach(line => {
      for (let index = 1; index < line.length; index++) {
        const a = line[index - 1];
        const b = line[index];
        segments.push({
          a,
          b,
          type: feature.properties.safety || 'unknown',
          minLng: Math.min(a[0], b[0]) - 0.001,
          maxLng: Math.max(a[0], b[0]) + 0.001,
          minLat: Math.min(a[1], b[1]) - 0.001,
          maxLat: Math.max(a[1], b[1]) + 0.001
        });
      }
    });
  });
  return segments;
}

function geometryToLineGroups(geometry){
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

function calculateLaneBreakdown(routeCoords){
  const totals = { protected: 0, painted: 0, shared: 0, unknown: 0 };
  for (let index = 1; index < routeCoords.length; index++) {
    const a = routeCoords[index - 1];
    const b = routeCoords[index];
    const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const segmentMeters = distanceMeters(a, b);
    const laneType = nearestLaneType(midpoint) || 'unknown';
    totals[laneType] += segmentMeters;
  }

  const items = ['protected', 'painted', 'shared', 'unknown']
    .map(type => ({ type, miles: metersToMiles(totals[type]) }))
    .filter(item => item.miles >= 0.05);
  const best = items.reduce((winner, item) => item.miles > winner.miles ? item : winner, { type: 'unknown', miles: 0 });
  const protectedShare = metersToMiles(totals.protected) / Math.max(0.1, items.reduce((sum, item) => sum + item.miles, 0));
  const tag = protectedShare >= 0.5 ? 'Mostly protected' : best.type === 'unknown' ? 'Mixed streets' : `Mostly ${LANE_LABELS[best.type].toLowerCase()}`;

  return {
    items: items.length ? items : [{ type: 'unknown', miles: metersToMiles(totalLineMeters(routeCoords)) }],
    bestLabel: LANE_LABELS[best.type] || 'Bike lane',
    tag
  };
}

function nearestLaneType(point){
  let bestType = null;
  let bestDistance = 45;
  bikeLaneSegments.forEach(segment => {
    if (point[0] < segment.minLng || point[0] > segment.maxLng || point[1] < segment.minLat || point[1] > segment.maxLat) return;
    const meters = pointToSegmentMeters(point, segment.a, segment.b);
    if (meters < bestDistance) {
      bestDistance = meters;
      bestType = segment.type;
    }
  });
  return bestType;
}

function pointToSegmentMeters(point, a, b){
  const latMeters = 111320;
  const lngMeters = Math.cos(point[1] * Math.PI / 180) * 111320;
  const px = point[0] * lngMeters;
  const py = point[1] * latMeters;
  const ax = a[0] * lngMeters;
  const ay = a[1] * latMeters;
  const bx = b[0] * lngMeters;
  const by = b[1] * latMeters;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceMeters(a, b){
  const R = 6371000;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLng = (b[0] - a[0]) * Math.PI / 180;
  const lat1 = a[1] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function totalLineMeters(coords){
  return coords.slice(1).reduce((sum, coord, index) => sum + distanceMeters(coords[index], coord), 0);
}

function metersToMiles(meters){
  return meters / 1609.344;
}

function shortPlaceName(name){
  return name.split(',').slice(0, 2).join(',');
}

function setRouteStatus(message, isError = false){
  const status = document.getElementById('routeStatus');
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function setRouteButtonDisabled(isDisabled){
  const routeButton = document.querySelector('#tab-route .go-btn');
  routeButton.disabled = isDisabled;
  routeButton.textContent = isDisabled ? 'Planning…' : 'Plan My Route →';
}

function escapeHtml(value){
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

const aiReplies = [
  "Love it! For a chill morning ride I'd suggest the Hudson Greenway — 8 miles of protected lane, zero cars, incredible river views. Want me to map it?",
  "Got it! If you're up for a quick escape, Cold Spring via Metro-North is perfect — 90 min from Grand Central, river valley views, back for dinner. Should I plan the full trip?",
  "A friends ride sounds amazing 🙌 Prospect Park loop is great for groups — flat, scenic, 3.5 miles. I can add a coffee stop halfway. Want that route?",
  "For pure nature vibes, Inwood Hill Park is seriously underrated — ancient forest, caves, herons, and zero tourists. 1 train to Dyckman, 5 min walk. Want directions?"
];
let replyIdx = 0;
function sendChat(){
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  const wrap = document.getElementById('chatWrap');
  const u = document.createElement('div');
  u.style.display = 'flex';
  u.style.justifyContent = 'flex-end';
  u.innerHTML = `<div class="chat-bubble user">${escapeHtml(msg)}</div>`;
  wrap.appendChild(u);
  input.value = '';
  setTimeout(() => {
    const a = document.createElement('div');
    a.innerHTML = `<div class="chat-name">🍃 Trail</div><div class="chat-bubble ai">${aiReplies[replyIdx % aiReplies.length]}</div>`;
    wrap.appendChild(a);
    replyIdx++;
    wrap.scrollTop = wrap.scrollHeight;
  }, 700);
  wrap.scrollTop = wrap.scrollHeight;
}

initMap();
