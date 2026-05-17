import { combinedCoordinates } from "./sea_coord.js";

// =============================================================================
// A* feasibility router (engine-independent). Loads grid_final.geojson once,
// builds a spatially-bucketed adjacency graph, runs A* between any two
// lng/lat pairs. Slider positions act as cost weights so dragging a slider
// up biases the path toward cells that score high on that index.
// =============================================================================
const __FEAS = { ready: null, cells: null, buckets: null, bucketStep: null };
let __lastRouteCellPath = [];
// Increments on every route draw. animatePath captures the value at start and
// bails out of its rAF loop if a newer draw (e.g. a slider tweak) has bumped
// the token — prevents trailing animation frames from clobbering a fresh
// slider-driven point swap.
let _animateToken = 0;

async function __ensureFeasibility() {
  if (__FEAS.ready) return __FEAS.ready;
  __FEAS.ready = (async () => {
    const res = await fetch("data/preCal/grid_final.geojson");
    if (!res.ok) throw new Error(`grid load: HTTP ${res.status}`);
    const fc = await res.json();
    const cells = new Array(fc.features.length);
    let stepLngSum = 0, stepLatSum = 0;
    for (let i = 0; i < fc.features.length; i++) {
      const f = fc.features[i];
      const ring = f.geometry.coordinates[0];
      let nLng = Infinity, nLat = Infinity, xLng = -Infinity, xLat = -Infinity;
      for (let k = 0; k < ring.length; k++) {
        const [lo, la] = ring[k];
        if (lo < nLng) nLng = lo; if (la < nLat) nLat = la;
        if (lo > xLng) xLng = lo; if (la > xLat) xLat = la;
      }
      stepLngSum += xLng - nLng; stepLatSum += xLat - nLat;
      cells[i] = { idx: i, cx: (nLng + xLng) / 2, cy: (nLat + xLat) / 2, props: f.properties };
    }
    const stepLng = stepLngSum / cells.length;
    const stepLat = stepLatSum / cells.length;
    const buckets = new Map();
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      c.bk = Math.round(c.cx / stepLng) + "," + Math.round(c.cy / stepLat);
      let arr = buckets.get(c.bk);
      if (!arr) { arr = []; buckets.set(c.bk, arr); }
      arr.push(i);
    }
    // 2.5× step neighbour radius bridges short water gaps (Singapore↔Johor,
    // Bali↔Java) so islands aren't disconnected from the mainland.
    const maxDLng = stepLng * 2.5, maxDLat = stepLat * 2.5;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const ki = Math.round(c.cx / stepLng), kj = Math.round(c.cy / stepLat);
      const nbs = [];
      for (let di = -2; di <= 2; di++) {
        for (let dj = -2; dj <= 2; dj++) {
          const arr = buckets.get((ki + di) + "," + (kj + dj));
          if (!arr) continue;
          for (const j of arr) {
            if (j === i) continue;
            const o = cells[j];
            if (Math.abs(o.cx - c.cx) <= maxDLng && Math.abs(o.cy - c.cy) <= maxDLat) nbs.push(j);
          }
        }
      }
      c.neighbors = nbs;
    }
    __FEAS.cells = cells;
    __FEAS.buckets = buckets;
    __FEAS.bucketStep = { lng: stepLng, lat: stepLat };
    console.log(`Feasibility grid: ${cells.length} cells loaded, step ≈ ${stepLng.toFixed(4)}°×${stepLat.toFixed(4)}°`);
    return __FEAS;
  })();
  return __FEAS.ready;
}

function __nearestFeasibilityCell(lng, lat) {
  const { cells, buckets, bucketStep } = __FEAS;
  if (!cells) return -1;
  const ki = Math.round(lng / bucketStep.lng);
  const kj = Math.round(lat / bucketStep.lat);
  let best = -1, bestD2 = Infinity;
  for (let r = 0; r < 80; r++) {
    for (let di = -r; di <= r; di++) {
      for (let dj = -r; dj <= r; dj++) {
        if (r > 0 && Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const arr = buckets.get((ki + di) + "," + (kj + dj));
        if (!arr) continue;
        for (const j of arr) {
          const c = cells[j];
          const dx = c.cx - lng, dy = c.cy - lat;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) { bestD2 = d2; best = j; }
        }
      }
    }
    if (best !== -1 && r >= 1) break;
  }
  return best;
}

function __readRoutingWeights() {
  const v = (id) => {
    const el = document.getElementById(id);
    const x = el ? parseFloat(el.value) : 0.5;
    return isFinite(x) ? x : 0.5;
  };
  return {
    TSI: v("tsi-filter"), SDI: v("sdi-filter"), E2I: v("e2i-filter"),
    OPI: v("opi-filter"), PEI: v("pei-filter"),
  };
}

function __cellCost(props, w) {
  return 0.05
    + w.TSI * (1 - (props.TSI || 0))
    + w.SDI * (1 - (props.SDI || 0))
    + w.E2I * (1 - (props.E2I || 0))
    + w.OPI * (1 - (props.OPI || 0))
    + w.PEI * (1 - (props.PEI || 0));
}

function __haversineKm(ax, ay, bx, by) {
  const R = 6371;
  const f1 = ay * Math.PI / 180, f2 = by * Math.PI / 180;
  const df = (by - ay) * Math.PI / 180;
  const dl = (bx - ax) * Math.PI / 180;
  const x = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

class __MinHeap {
  constructor() { this.h = []; }
  size() { return this.h.length; }
  push(n) {
    this.h.push(n);
    let i = this.h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.h[p].f <= this.h[i].f) break;
      [this.h[p], this.h[i]] = [this.h[i], this.h[p]];
      i = p;
    }
  }
  pop() {
    const top = this.h[0]; const last = this.h.pop();
    if (this.h.length) {
      this.h[0] = last; let i = 0; const n = this.h.length;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2; let s = i;
        if (l < n && this.h[l].f < this.h[s].f) s = l;
        if (r < n && this.h[r].f < this.h[s].f) s = r;
        if (s === i) break;
        [this.h[s], this.h[i]] = [this.h[i], this.h[s]];
        i = s;
      }
    }
    return top;
  }
}

async function __aStarRoute(startLngLat, endLngLat) {
  const t0 = performance.now();
  await __ensureFeasibility();
  const cells = __FEAS.cells;
  const w = __readRoutingWeights();
  const sIdx = __nearestFeasibilityCell(startLngLat[0], startLngLat[1]);
  const gIdx = __nearestFeasibilityCell(endLngLat[0], endLngLat[1]);
  if (sIdx < 0 || gIdx < 0) throw new Error("endpoint outside grid coverage");
  if (sIdx === gIdx) return { path: [sIdx], coords: [[cells[sIdx].cx, cells[sIdx].cy]] };

  const goal = cells[gIdx];
  const open = new __MinHeap();
  const gScore = new Map();
  const cameFrom = new Map();
  const closed = new Set();
  gScore.set(sIdx, 0);
  open.push({ idx: sIdx, f: __haversineKm(cells[sIdx].cx, cells[sIdx].cy, goal.cx, goal.cy) * 0.05 });

  let expanded = 0;
  const maxExpanded = 500000;
  while (open.size() > 0) {
    const { idx } = open.pop();
    if (closed.has(idx)) continue;
    closed.add(idx);
    expanded++;
    if (idx === gIdx) {
      const path = [idx];
      let cur = idx;
      while (cameFrom.has(cur)) { cur = cameFrom.get(cur); path.unshift(cur); }
      console.log(`A* route: ${path.length} cells, expanded ${expanded.toLocaleString()} in ${(performance.now() - t0).toFixed(0)} ms`);
      return { path, coords: path.map(i => [cells[i].cx, cells[i].cy]) };
    }
    if (expanded > maxExpanded) break;
    const cur = cells[idx];
    const gCur = gScore.get(idx);
    const nbs = cur.neighbors;
    for (let n = 0; n < nbs.length; n++) {
      const nIdx = nbs[n];
      if (closed.has(nIdx)) continue;
      const nb = cells[nIdx];
      const stepKm = __haversineKm(cur.cx, cur.cy, nb.cx, nb.cy);
      const tentG = gCur + stepKm * __cellCost(nb.props, w);
      if (tentG < (gScore.get(nIdx) ?? Infinity)) {
        cameFrom.set(nIdx, idx);
        gScore.set(nIdx, tentG);
        const f = tentG + __haversineKm(nb.cx, nb.cy, goal.cx, goal.cy) * 0.05;
        open.push({ idx: nIdx, f });
      }
    }
  }
  throw new Error("no route found");
}

function __updateAchievedScores(cellIndices) {
  const cells = __FEAS.cells;
  if (!cells || !cellIndices.length) return;
  let tsi = 0, sdi = 0, e2i = 0, opi = 0, pei = 0, ffi = 0;
  for (const i of cellIndices) {
    const p = cells[i].props;
    tsi += p.TSI || 0; sdi += p.SDI || 0; e2i += p.E2I || 0;
    opi += p.OPI || 0; pei += p.PEI || 0; ffi += p.FFI || 0;
  }
  const n = cellIndices.length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v.toFixed(3); };
  set("tsi-value", tsi / n); set("sdi-value", sdi / n); set("e2i-value", e2i / n);
  set("opi-value", opi / n); set("pei-value", pei / n); set("ffi-value", ffi / n);
}

function __sumGdpAlongCells(cellIndices) {
  const cells = __FEAS.cells;
  if (!cells || !cellIndices.length) return 0;
  let s = 0;
  for (const i of cellIndices) s += cells[i].props.gdp || 0;
  return s;
}

// Multi-source elevation lookup. Tries Open-Elevation → Open-Meteo →
// Open-Topo-Data, all free / no key. Chunked at 100 coords/request.
async function __fetchElevations(coords) {
  if (!coords || coords.length === 0) return [];
  const fetchJson = async (url) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      return await r.json();
    } catch (_) { clearTimeout(t); return null; }
  };
  const tryAllChunks = async (chunkSize, buildUrl, parseChunk) => {
    const out = [];
    for (let i = 0; i < coords.length; i += chunkSize) {
      const chunk = coords.slice(i, i + chunkSize);
      const j = await fetchJson(buildUrl(chunk));
      if (!j) return null;
      const part = parseChunk(j);
      if (!part || part.length !== chunk.length) return null;
      out.push(...part);
    }
    return out;
  };
  let elevs = await tryAllChunks(100,
    (chunk) => `https://api.open-elevation.com/api/v1/lookup?locations=${chunk.map(([lng, lat]) => `${lat},${lng}`).join("|")}`,
    (j) => Array.isArray(j?.results) ? j.results.map((r) => Math.max(0, r.elevation || 0)) : null);
  if (elevs) { console.log(`elevation: Open-Elevation (${elevs.length} pts)`); return elevs; }
  elevs = await tryAllChunks(100,
    (chunk) => {
      const lats = chunk.map(([_, lat]) => lat).join(",");
      const lngs = chunk.map(([lng, _]) => lng).join(",");
      return `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;
    },
    (j) => Array.isArray(j?.elevation) ? j.elevation.map((e) => Math.max(0, e || 0)) : null);
  if (elevs) { console.log(`elevation: Open-Meteo (${elevs.length} pts)`); return elevs; }
  elevs = await tryAllChunks(100,
    (chunk) => `https://api.opentopodata.org/v1/srtm30m?locations=${chunk.map(([lng, lat]) => `${lat},${lng}`).join("|")}`,
    (j) => Array.isArray(j?.results) ? j.results.map((r) => Math.max(0, r.elevation || 0)) : null);
  if (elevs) { console.log(`elevation: Open-Topo-Data (${elevs.length} pts)`); return elevs; }
  console.warn("[elevation] all 3 free sources failed; defaulting to zeros");
  return coords.map(() => 0);
}

// main map
const app = d3
  .select("#app")
  .html("")
  .style("position", "fixed")
  .style("inset", "0")
  .style("padding", "0")
  .style("overflow", "hidden");

// MapLibre GL JS (BSD, no API key). Basemap is ESRI World Imagery —
// real satellite photos, free, no token, no usage fee. Style is built
// inline (one raster source), avoiding any vector style that would impose
// stylized colours.
const map = new mapboxgl.Map({
  container: "map",
  zoom: 4,
  center: [110.0, 5.0],
  pitch: 0,
  bearing: 0,
  style: {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      "esri-imagery": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Imagery © <a href="https://www.esri.com/">Esri</a> · Sources: Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN',
      },
    },
    layers: [
      { id: "imagery", type: "raster", source: "esri-imagery" },
    ],
  },
  // Globe projection removed — caused line layers (the route) to fail to
  // render on the main map even though they showed fine on the elevation
  // inset (which is mercator). 2D mercator is the safer default.
  attributionControl: true,
  collectResourceTiming: false,
  // WebGL clears the canvas after each paint; without this, the on-demand
  // `map.getCanvas().toDataURL()` in __regenerateSnapshot returns a blank
  // PNG and the report thumbnail comes out empty.
  preserveDrawingBuffer: true,
  maxBounds: [
    [80.0, -25.0],
    [150.0, 35.0],
  ],
  minZoom: 1,
  maxZoom: 18,
});
// map.addControl(
//   new mapboxgl.AttributionControl({
//     compact: true,
//     customAttribution: "© Mapbox © OpenStreetMap",
//   })
// );

// remove country names
map.on("style.load", () => {
  map.getStyle().layers.forEach((layer) => {
    if (layer.type === "symbol" && layer.layout && layer.layout["text-field"]) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  });

  // remove country borders
  map.getStyle().layers.forEach((layer) => {
    if (layer.type === "line" && layer.id.includes("border")) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  });
});

// Add zoom controls separately
const zoomInButton = document.createElement("img");
zoomInButton.src = "images/plus.svg";
zoomInButton.alt = "+";
zoomInButton.style.position = "absolute";
zoomInButton.style.top = "10px";
zoomInButton.style.right = "10px";
zoomInButton.style.zIndex = "1000";
zoomInButton.style.width = "30px";
zoomInButton.style.height = "30px";
zoomInButton.style.borderRadius = "50%";
zoomInButton.style.backgroundColor = "#fff";
zoomInButton.style.border = "1px solid #ccc";
zoomInButton.style.cursor = "pointer";
zoomInButton.style.padding = "5px";
document.body.appendChild(zoomInButton);

const zoomOutButton = document.createElement("img");
zoomOutButton.src = "images/minus.svg";
zoomOutButton.alt = "-";
zoomOutButton.style.position = "absolute";
zoomOutButton.style.top = "50px";
zoomOutButton.style.right = "10px";
zoomOutButton.style.zIndex = "1000";
zoomOutButton.style.width = "30px";
zoomOutButton.style.height = "30px";
zoomOutButton.style.borderRadius = "50%";
zoomOutButton.style.backgroundColor = "#fff";
zoomOutButton.style.border = "1px solid #ccc";
zoomOutButton.style.cursor = "pointer";
zoomOutButton.style.padding = "5px";
document.body.appendChild(zoomOutButton);

// Zoom in and out functionality
zoomInButton.addEventListener("click", () => {
  map.zoomIn();
});

zoomOutButton.addEventListener("click", () => {
  map.zoomOut();
});

// compass control
const compassControl = new mapboxgl.NavigationControl({
  showZoom: false,
  visualizePitch: true,
});
compassControl._container.style.borderRadius = "50%";
compassControl._container.style.overflow = "hidden";
const compassContainer = document.createElement("div");
compassContainer.style.position = "absolute";
compassContainer.style.top = "90px";
compassContainer.style.right = "10px";
compassContainer.style.zIndex = "1000";

document.body.appendChild(compassContainer);

compassContainer.appendChild(compassControl.onAdd(map));

// scale
const scaleControl = new mapboxgl.ScaleControl({
  minWidth: 200,
  maxWidth: 300,
  unit: "metric",
});
map.addControl(scaleControl);

// scale style
const scaleElement = document.querySelector(".mapboxgl-ctrl-scale");
if (scaleElement) {
  scaleElement.style.backgroundColor = "transparent";
  scaleElement.style.border = "1px solid white";
  scaleElement.style.color = "white";
  scaleElement.style.fontSize = "12px";

  // convert to miles
  const updateScale = () => {
    const kmText = scaleElement.textContent;
    const kmMatch = kmText.match(/([\d.]+)\s*km/);
    if (kmMatch) {
      const kmValue = parseFloat(kmMatch[1]);
      const milesValue = (kmValue * 0.621371).toFixed(2); // convert km to miles and round to 2 decimal places
      scaleElement.textContent = `${kmValue} km ${milesValue} mi`;
    }
  };

  // Update scale on map move + zoom
  map.on("move", updateScale);
  map.on("zoom", updateScale);

  updateScale();
}

// Dim ONLY OUTSIDE SEA, never on SEA itself.
//   - countries source (10m, 11 SEA features)        → white SEA outline
//   - countries-world source (50m, every country, sea-tagged)
//                                                    → dim layer with
//                                                      filter [sea == 0]
//                                                      so it covers ONLY
//                                                      non-SEA polygons.
//                                                      Zero chance of
//                                                      touching SEA.
map.on("load", () => {
  map.addSource("countries", { type: "geojson", data: "data/sea_countries.geojson" });
  map.addLayer({
    id: "highlight-sea",
    type: "line",
    source: "countries",
    paint: { "line-color": "#ffffff", "line-width": 0.8, "line-opacity": 0.95 },
  });

  map.addSource("countries-world", { type: "geojson", data: "data/countries_world.geojson" });
  map.addLayer(
    {
      id: "black-world",
      type: "fill",
      source: "countries-world",
      filter: ["==", ["get", "sea"], 0], // ONLY non-SEA countries
      paint: { "fill-color": "#000000", "fill-opacity": 0.85 },
    },
    "highlight-sea"
  );
});

// Removed: 3D terrain + sky + the JS night-mode recolour pass.
// The recolour pass was darkening every basemap layer (including SEA),
// which is what was making SEA look dim regardless of style URL.
// The main map now stays at the Positron style's native bright palette;
// the dark/night feel comes from the dim layer covering only non-SEA.

// // Responsive inset map
// const createInsetMap = () => {
//   const insetContainer = document.createElement("div");
//   insetContainer.id = "inset-map";
//   insetContainer.style.position = "absolute";
//   insetContainer.style.width = window.innerWidth > 768 ? "320px" : "200px"; // Adjust width for smaller screens
//   insetContainer.style.height = window.innerWidth > 768 ? "150px" : "100px"; // Adjust height for smaller screens
//   insetContainer.style.bottom = "10px";
//   insetContainer.style.right = "10px";
//   insetContainer.style.border = "2px solid #ccc";
//   insetContainer.style.zIndex = "1000";
//   document.body.appendChild(insetContainer);

//   const insetMap = new mapboxgl.Map({
//     container: "inset-map",
//     style: "mapbox://styles/mapbox/dark-v10",
//     center: map.getCenter(),
//     zoom: 0.1,
//     interactive: false,
//     attributionControl: false,
//   });

//   // inset title
//   const insetTitle = document.createElement("div");
//   insetTitle.textContent = "Southeast Asia";
//   insetTitle.style.position = "absolute";
//   insetTitle.style.top = "5px";
//   insetTitle.style.left = "10px";
//   insetTitle.style.zIndex = "1001";
//   insetTitle.style.color = "white";
//   insetTitle.style.opacity = "0.5";
//   insetTitle.style.fontSize = window.innerWidth > 768 ? "16px" : "12px"; // Adjust font size for smaller screens
//   insetTitle.style.fontWeight = "Bold";
//   insetContainer.appendChild(insetTitle);

//   // remove logo from the inset map
//   const insetLogoElement = document.querySelector("#inset-map .mapboxgl-ctrl-logo");
//   if (insetLogoElement) {
//     insetLogoElement.style.display = "none"; // Hide the logo
//   }

//   insetMap.on("style.load", () => {
//     insetMap.getStyle().layers.forEach((layer) => {
//       if (layer.type === "symbol" && layer.layout && layer.layout["text-field"]) {
//         insetMap.setPaintProperty(layer.id, "text-color", "#d3d3d3");
//       }
//     });
//   });

//   insetMap.on("load", () => {
//     insetMap.addSource("countries", {
//       type: "vector",
//       url: "mapbox://mapbox.country-boundaries-v1",
//     });

//     insetMap.addLayer({
//       id: "rest-world",
//       type: "fill",
//       source: "countries",
//       "source-layer": "country_boundaries",
//       paint: {
//         "fill-color": "#2b2b2b",
//         "fill-opacity": 0.6,
//       },
//       filter: [
//         "!in",
//         "iso_3166_1_alpha_3",
//         "IDN",
//         "VNM",
//         "LAO",
//         "BRN",
//         "THA",
//         "MMR",
//         "PHL",
//         "KHM",
//         "TLS",
//         "SGP",
//         "MYS",
//       ],
//     });

//     insetMap.addLayer({
//       id: "highlight-sea",
//       type: "fill",
//       source: "countries",
//       "source-layer": "country_boundaries",
//       paint: {
//         "fill-color": "#ffffff",
//         "fill-opacity": 0.6,
//       },
//       filter: ["in", "iso_3166_1_alpha_3", "IDN", "LAO", "BRN", "THA", "MMR", "KHM", "TLS", "SGP", "MYS"],
//     });

//     insetMap.addLayer({
//       id: "highlight-philippines-vietnam",
//       type: "fill",
//       source: "countries",
//       "source-layer": "country_boundaries",
//       paint: {
//         "fill-color": "#ffffff",
//         "fill-opacity": 0.4,
//       },
//       filter: ["in", "iso_3166_1_alpha_3", "PHL", "VNM"],
//     });

//     insetMap.moveLayer("highlight-sea", "country-label");
//     insetMap.moveLayer("highlight-philippines-vietnam", "country-label");
//     insetMap.moveLayer("rest-world", "country-label");
//   });

//   map.on("move", () => {
//     insetMap.setCenter(map.getCenter());
//     insetMap.setZoom(map.getZoom() - 4);
//   });

//   return insetContainer;
// };

// // Create inset map if screen width is greater than 480px
// if (window.innerWidth > 480) {
//   createInsetMap();
// }

// // Adjust inset map on window resize
// window.addEventListener("resize", () => {
//   const existingInsetMap = document.getElementById("inset-map");
//   if (existingInsetMap) {
//     existingInsetMap.remove();
//   }
//   if (window.innerWidth > 480) {
//     createInsetMap();
//   }
// });

// Adj map container ht to follow win ht
const resizeMap = () => {
  const mapContainer = document.getElementById("map");
  if (mapContainer) {
    mapContainer.style.height = `${window.innerHeight}px`;
  }
};
window.addEventListener("resize", resizeMap);
resizeMap();

// origin-destination UI + dropdown suggestions
// Create a container for origin-destination elements
const odContainer = document.createElement("div");
odContainer.style.position = "absolute";
odContainer.style.top = "0px";
odContainer.style.left = "-250px"; // Initially hidden to the left
odContainer.style.zIndex = "1000";
odContainer.style.transition = "left 0.5s ease"; // Smooth transition
odContainer.style.padding = "10px";
odContainer.style.borderRadius = "0 10px 10px 0";
document.body.appendChild(odContainer);

// Variable to track if sliding should be allowed
let allowSliding = true;

// Function to check if inputs have values
const checkInputsEmpty = () => {
  // We'll define these variables here, but they'll be initialized later in the code
  if (!originInput || !destinationInput) return true;
  
  return originInput.value === "" && destinationInput.value === "";
};

// Add hover effect to slide in
odContainer.addEventListener("mouseenter", () => {
  odContainer.style.left = "0px";
});

odContainer.addEventListener("mouseleave", () => {
  // Only slide out if both inputs are empty
  if (checkInputsEmpty()) {
    odContainer.style.left = "-250px";
  }
});

// Add event listeners to inputs to update sliding behavior
// These will be added after originInput and destinationInput are created
const setupInputListeners = () => {
  if (originInput) {
    originInput.addEventListener("input", () => {
      // If any input has a value, keep the container visible
      if (!checkInputsEmpty()) {
        odContainer.style.left = "0px";
      }
    });
  }
  
  if (destinationInput) {
    destinationInput.addEventListener("input", () => {
      // If any input has a value, keep the container visible
      if (!checkInputsEmpty()) {
        odContainer.style.left = "0px";
      }
    });
  }
};

// We'll call this function after originInput and destinationInput are created
setTimeout(setupInputListeners, 500);


const originInput = document.createElement("input");
originInput.type = "text";
originInput.placeholder = "Origin";
originInput.style.width = "250px";
originInput.style.borderRadius = "20px";
originInput.style.padding = "5px";
originInput.style.border = "none";
originInput.style.paddingLeft = "25px";
originInput.style.paddingRight = "29px";
originInput.style.marginBottom = "10px";
odContainer.appendChild(originInput);

// blue circle origin
const bluCircle = document.createElement("div");
bluCircle.style.position = "absolute";
bluCircle.style.top = "19px";
bluCircle.style.left = "20px";
bluCircle.style.width = "10px";
bluCircle.style.height = "10px";
bluCircle.style.borderRadius = "50%";
bluCircle.style.backgroundColor = "#019cde";
bluCircle.style.zIndex = "1000";
odContainer.appendChild(bluCircle);

const enableClickButton = document.createElement("img");
enableClickButton.src = "images/pin_blue.svg";
enableClickButton.alt = "Pinpoint Origin";
enableClickButton.style.position = "absolute";
enableClickButton.style.top = "10px";
enableClickButton.style.left = "270px";
enableClickButton.style.zIndex = "1000";
enableClickButton.style.cursor = "pointer";
enableClickButton.style.width = "30px";
enableClickButton.style.height = "30px";
enableClickButton.style.border = "0px solid #ccc";
enableClickButton.style.borderRadius = "50%";
enableClickButton.style.backgroundColor = "#ffffff";
enableClickButton.style.padding = "5px";
odContainer.appendChild(enableClickButton);

const okButton = document.createElement("img");
okButton.src = "images/ok.svg";
okButton.alt = "OK";
okButton.style.position = "absolute";
okButton.style.top = "10px";
okButton.style.left = "270px";
okButton.style.zIndex = "1000";
okButton.style.cursor = "pointer";
okButton.style.width = "30px";
okButton.style.height = "30px";
okButton.style.border = "0px solid #ccc";
okButton.style.borderRadius = "50%";
okButton.style.backgroundColor = "#ffffff";
okButton.style.padding = "5px";
okButton.style.display = "none";
odContainer.appendChild(okButton);

let clickEnabled = false;
let originMarker = null; // origin marker

enableClickButton.addEventListener("click", () => {
  clickEnabled = true;
  okButton.style.display = "block";
});

okButton.addEventListener("click", () => {
  clickEnabled = false;
  okButton.style.display = "none";
});

map.on("click", (event) => {
  if (clickEnabled) {
    const coordinates = event.lngLat;

    // remove previous marker if it exists
    if (originMarker) {
      originMarker.remove();
    }

    // add new origin marker
    originMarker = new mapboxgl.Marker({
      element: (() => {
        const markerElement = document.createElement("img");
        markerElement.src = "images/marker_o.svg";
        markerElement.alt = "Origin Marker";
        markerElement.style.width = "40px";
        markerElement.style.height = "40px";
        return markerElement;
      })(),
    })
      .setLngLat([coordinates.lng, coordinates.lat])
      .addTo(map);

    // Stash the actual coords on the input so the route handler doesn't
    // need to re-geocode the display_name back to lat/lng on every click
    // (Nominatim's 1 req/sec policy was rejecting repeat lookups).
    originInput.dataset.lat = coordinates.lat;
    originInput.dataset.lng = coordinates.lng;

    // Reverse geocode via Nominatim (free, no API key).
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.lat}&lon=${coordinates.lng}&zoom=10`
    )
      .then((response) => response.json())
      .then((data) => {
        originInput.value = data && data.display_name ? data.display_name : `Unknown Location`;
      })
      .catch((error) => {
        console.error("Error fetching place name:", error);
        originInput.value = `Unknown Location`;
      });

    // Show the clear button for origin input
    originClearButton.style.display = "block";
  }
});

const destinationInput = document.createElement("input");
destinationInput.type = "text";
destinationInput.placeholder = "Destination";
destinationInput.style.position = "absolute";
destinationInput.style.top = "60px";
destinationInput.style.left = "10px";
destinationInput.style.width = "250px";
destinationInput.style.borderRadius = "20px";
destinationInput.style.padding = "5px";
destinationInput.style.border = "none";
destinationInput.style.paddingLeft = "25px";
destinationInput.style.paddingRight = "29px";
destinationInput.style.marginBottom = "10px";
odContainer.appendChild(destinationInput);

// red circle destination
const redCircle = document.createElement("div");
redCircle.style.position = "absolute";
redCircle.style.top = "69px";
redCircle.style.left = "20px";
redCircle.style.width = "10px";
redCircle.style.height = "10px";
redCircle.style.borderRadius = "50%";
redCircle.style.backgroundColor = "#e95247";
redCircle.style.zIndex = "1000";
odContainer.appendChild(redCircle);

const enableDestinationClickButton = document.createElement("img");
enableDestinationClickButton.src = "images/pin.svg";
enableDestinationClickButton.alt = "Pinpoint Destination";
enableDestinationClickButton.style.position = "absolute";
enableDestinationClickButton.style.top = "60px";
enableDestinationClickButton.style.left = "270px";
enableDestinationClickButton.style.zIndex = "1000";
enableDestinationClickButton.style.cursor = "pointer";
enableDestinationClickButton.style.width = "30px";
enableDestinationClickButton.style.height = "30px";
enableDestinationClickButton.style.border = "0px solid #ccc";
enableDestinationClickButton.style.borderRadius = "50%";
enableDestinationClickButton.style.backgroundColor = "#ffffff";
enableDestinationClickButton.style.padding = "5px";
odContainer.appendChild(enableDestinationClickButton);

const destinationOkButton = document.createElement("img");
destinationOkButton.src = "images/ok.svg";
destinationOkButton.alt = "OK";
destinationOkButton.style.position = "absolute";
destinationOkButton.style.top = "60px";
destinationOkButton.style.left = "270px";
destinationOkButton.style.zIndex = "1000";
destinationOkButton.style.cursor = "pointer";
destinationOkButton.style.width = "30px";
destinationOkButton.style.height = "30px";
destinationOkButton.style.border = "0px solid #ccc";
destinationOkButton.style.borderRadius = "50%";
destinationOkButton.style.backgroundColor = "#ffffff";
destinationOkButton.style.padding = "5px";
destinationOkButton.style.display = "none";
odContainer.appendChild(destinationOkButton);

let destinationClickEnabled = false;
let destinationMarker = null; // store destination marker

enableDestinationClickButton.addEventListener("click", () => {
  destinationClickEnabled = true;
  destinationOkButton.style.display = "block";
});

destinationOkButton.addEventListener("click", () => {
  destinationClickEnabled = false;
  destinationOkButton.style.display = "none";
});

map.on("click", (event) => {
  if (destinationClickEnabled) {
    const coordinates = event.lngLat;

    // remove previous marker
    if (destinationMarker) {
      destinationMarker.remove();
    }

    // add new destination marker
    destinationMarker = new mapboxgl.Marker({
      element: (() => {
        const markerElement = document.createElement("img");
        markerElement.src = "images/marker_d.svg";
        markerElement.alt = "Destination Marker";
        markerElement.style.width = "40px";
        markerElement.style.height = "40px";
        return markerElement;
      })(),
    })
      .setLngLat([coordinates.lng, coordinates.lat])
      .addTo(map);

    // Stash actual coords on the input — same reason as the origin handler.
    destinationInput.dataset.lat = coordinates.lat;
    destinationInput.dataset.lng = coordinates.lng;

    // Reverse geocode via Nominatim.
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.lat}&lon=${coordinates.lng}&zoom=10`
    )
      .then((response) => response.json())
      .then((data) => {
        destinationInput.value = data && data.display_name ? data.display_name : `Unknown Location`;
      })
      .catch((error) => {
        console.error("Error fetching place name:", error);
        destinationInput.value = `Unknown Location`;
      });

    // show clear button for destination input
    destinationClearButton.style.display = "block";
  }
});

const originSuggestionBox = document.createElement("div");
originSuggestionBox.style.position = "absolute";
originSuggestionBox.style.top = "45px";
originSuggestionBox.style.left = "10px";
originSuggestionBox.style.zIndex = "9999";
originSuggestionBox.style.backgroundColor = "white";
originSuggestionBox.style.border = "1px solid #ccc";
originSuggestionBox.style.borderRadius = "5px";
originSuggestionBox.style.display = "none";
originSuggestionBox.style.maxHeight = "200px";
originSuggestionBox.style.overflowY = "auto";
document.body.appendChild(originSuggestionBox);

const destinationSuggestionBox = document.createElement("div");
destinationSuggestionBox.style.position = "absolute";
destinationSuggestionBox.style.top = "95px";
destinationSuggestionBox.style.left = "10px";
destinationSuggestionBox.style.zIndex = "9999";
destinationSuggestionBox.style.backgroundColor = "white";
destinationSuggestionBox.style.border = "1px solid #ccc";
destinationSuggestionBox.style.borderRadius = "5px";
destinationSuggestionBox.style.display = "none";
destinationSuggestionBox.style.maxHeight = "200px";
destinationSuggestionBox.style.overflowY = "auto";
document.body.appendChild(destinationSuggestionBox);

function fetchLocations(query, callback) {
  // Forward geocoding via Nominatim, bounded to SEA.
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=90,25,140,-15&bounded=1&limit=8`;
  fetch(url, { headers: { "Accept-Language": "en" } })
    .then((response) => response.json())
    .then((data) => {
      const locations = (data || []).map((r) => ({
        name: r.display_name,
        coordinates: [parseFloat(r.lon), parseFloat(r.lat)],
      }));
      callback(locations);
    })
    .catch((error) => console.error("Error fetching locations:", error));
}

function handleInput(inputElement, suggestionBox, pinColor, markerReference) {
  inputElement.addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase();
    suggestionBox.innerHTML = "";
    suggestionBox.style.display = "none";

    if (query.length > 0) {
      fetchLocations(query, (locations) => {
        if (locations.length > 0) {
          suggestionBox.style.display = "block";
          locations.forEach((location) => {
            const suggestionItem = document.createElement("div");
            suggestionItem.style.display = "flex";
            suggestionItem.style.alignItems = "center";
            suggestionItem.style.padding = "5px";
            suggestionItem.style.cursor = "pointer";
            suggestionItem.style.color = "#2b2b2b"; // Dark grey

            // Add SVG marker
            const svgMarker = document.createElement("img");
            svgMarker.src = pinColor === "blue" ? "images/marker_o.svg" : "images/marker_d.svg";
            svgMarker.alt = "Marker";
            svgMarker.style.width = "20px";
            svgMarker.style.height = "20px";
            svgMarker.style.marginRight = "10px";
            suggestionItem.appendChild(svgMarker);

            // Add location name
            const locationName = document.createElement("span");
            locationName.textContent = location.name;
            suggestionItem.appendChild(locationName);

            suggestionItem.addEventListener("click", () => {
              inputElement.value = location.name;
              suggestionBox.style.display = "none";

              // Remove the previous marker if it exists
              if (markerReference.marker) {
                markerReference.marker.remove();
              }

              // Drop a pin on the map
              markerReference.marker = new mapboxgl.Marker({
                element: (() => {
                  const markerElement = document.createElement("img");
                  markerElement.src = pinColor === "blue" ? "images/marker_o.svg" : "images/marker_d.svg";
                  markerElement.alt = "Marker";
                  markerElement.style.width = "40px";
                  markerElement.style.height = "40px";
                  return markerElement;
                })(),
              })
                .setLngLat(location.coordinates)
                .addTo(map);

              // Convert coordinates to lat/lng
              const lat = location.coordinates[1];
              const lng = location.coordinates[0];
              console.log(`Selected location: Lat: ${lat}, Lng: ${lng}`);

              // Center the map on the selected location
              map.flyTo({ center: location.coordinates, zoom: 10 });
            });
            suggestionBox.appendChild(suggestionItem);
          });
        }
      });
    }
  });
}

const originClearButton = document.createElement("img");
originClearButton.src = "images/cross.svg";
originClearButton.style.filter = "grayscale(100%)";
originClearButton.alt = "Clear";
originClearButton.style.position = "absolute";
originClearButton.style.top = "16px";
originClearButton.style.left = "237px";
originClearButton.style.zIndex = "1000";
originClearButton.style.cursor = "pointer";
originClearButton.style.display = "none";
originClearButton.style.width = "16px";
originClearButton.style.height = "16px";
originClearButton.addEventListener("click", () => {
  originInput.value = "";
  delete originInput.dataset.lat;
  delete originInput.dataset.lng;
  originClearButton.style.display = "none";

  // Close the dropdown if it is open
  originSuggestionBox.style.display = "none";
});
odContainer.appendChild(originClearButton);

originInput.addEventListener("input", () => {
  originClearButton.style.display = originInput.value ? "block" : "none";
});

const destinationClearButton = document.createElement("img");
destinationClearButton.src = "images/cross.svg";
destinationClearButton.style.filter = "grayscale(100%)";
destinationClearButton.alt = "Clear";
destinationClearButton.style.position = "absolute";
destinationClearButton.style.top = "66px";
destinationClearButton.style.left = "237px";
destinationClearButton.style.zIndex = "1000";
destinationClearButton.style.cursor = "pointer";
destinationClearButton.style.display = "none";
destinationClearButton.style.width = "16px";
destinationClearButton.style.height = "16px";
destinationClearButton.addEventListener("click", () => {
  destinationInput.value = "";
  delete destinationInput.dataset.lat;
  delete destinationInput.dataset.lng;
  destinationClearButton.style.display = "none";

  // Close the dropdown if open
  destinationSuggestionBox.style.display = "none";
});
odContainer.appendChild(destinationClearButton);

destinationInput.addEventListener("input", () => {
  destinationClearButton.style.display = destinationInput.value ? "block" : "none";
});

const originMarkerRef = { marker: null };
const destinationMarkerRef = { marker: null };

handleInput(originInput, originSuggestionBox, "blue", originMarkerRef); // Blue pin for origin
handleInput(destinationInput, destinationSuggestionBox, "red", destinationMarkerRef); // Red pin for destination

originClearButton.addEventListener("click", () => {
  if (originMarkerRef.marker) {
    originMarkerRef.marker.remove();
    originMarkerRef.marker = null;
  }

  // Remove marker_o SVG if it exists
  const markerOSVG = document.querySelector('img[src="images/marker_o.svg"]');
  if (markerOSVG) {
    markerOSVG.remove();
  }
});

destinationClearButton.addEventListener("click", () => {
  if (destinationMarkerRef.marker) {
    destinationMarkerRef.marker.remove();
    destinationMarkerRef.marker = null;
  }

  // Remove marker_d SVG if it exists
  const markerDSVG = document.querySelector('img[src="images/marker_d.svg"]');
  if (markerDSVG) {
    markerDSVG.remove();
  }
});

// index dashboard
const dashboardContainer = document.createElement("div");
dashboardContainer.style.position = "fixed";
dashboardContainer.style.top = "0";
dashboardContainer.style.left = "-300px"; // initially hidden
dashboardContainer.style.width = "300px";
dashboardContainer.style.top = "190px";
dashboardContainer.style.height = "65%";
dashboardContainer.style.opacity = 0.95;
dashboardContainer.style.backgroundColor = "#ffffff";
dashboardContainer.style.boxShadow = "2px 0 5px rgba(0, 0, 0, 0.2)";
dashboardContainer.style.zIndex = "2000";
dashboardContainer.style.transition = "left 0.3s ease";
dashboardContainer.style.overflowY = "auto";
dashboardContainer.style.borderTopRightRadius = "15px";
dashboardContainer.style.borderBottomRightRadius = "15px";
dashboardContainer.style.scrollbarWidth = "thin"; // Minimalist scrollbar for Firefox
dashboardContainer.style.scrollbarColor = "#ccc transparent"; // Custom scrollbar color for Firefox
document.body.appendChild(dashboardContainer);

// Minimalist scrollbar for WebKit browsers
const style = document.createElement("style");
style.textContent = `
    #dashboardContainer::-webkit-scrollbar {
      width: 6px;
    }
    #dashboardContainer::-webkit-scrollbar-thumb {
      background-color: #ccc;
      border-radius: 3px;
    }
    #dashboardContainer::-webkit-scrollbar-track {
      background: transparent;
    }
  `;
document.head.appendChild(style);
dashboardContainer.id = "dashboardContainer";

// index dashboard button with icon and text
const dashboardToggleButtonContainer = document.createElement("div");
dashboardToggleButtonContainer.style.position = "absolute";
dashboardToggleButtonContainer.style.top = "139px";
dashboardToggleButtonContainer.style.left = "10px";
dashboardToggleButtonContainer.style.zIndex = "2001";
dashboardToggleButtonContainer.style.cursor = "pointer";
// dashboardToggleButtonContainer.style.width = '100px';
dashboardToggleButtonContainer.style.display = "flex";
dashboardToggleButtonContainer.style.alignItems = "center";
dashboardToggleButtonContainer.style.backgroundColor = "#ffffff";
dashboardToggleButtonContainer.style.padding = "5px 10px";
dashboardToggleButtonContainer.style.borderRadius = "20px";
dashboardToggleButtonContainer.style.boxShadow = "0px 2px 5px rgba(0, 0, 0, 0.2)";
document.body.appendChild(dashboardToggleButtonContainer);

const dashboardToggleButtonIcon = document.createElement("img");
dashboardToggleButtonIcon.src = "images/dashboard.svg";
dashboardToggleButtonIcon.alt = "Indexes";
dashboardToggleButtonIcon.style.width = "20px";
dashboardToggleButtonIcon.style.height = "20px";
dashboardToggleButtonIcon.style.marginRight = "3px";
dashboardToggleButtonContainer.appendChild(dashboardToggleButtonIcon);

const dashboardToggleButtonText = document.createElement("span");
dashboardToggleButtonText.textContent = "Indexes";
dashboardToggleButtonText.style.fontSize = "14px";
dashboardToggleButtonText.style.color = "#333";
dashboardToggleButtonText.style.fontWeight = "bold";
dashboardToggleButtonContainer.appendChild(dashboardToggleButtonText);

// toggle index dashboard
let isDashboardOpen = false;
dashboardToggleButtonContainer.addEventListener("click", () => {
  if (isDashboardOpen) {
    dashboardContainer.style.left = "-300px"; // Slide out
  } else {
    dashboardContainer.style.left = "0"; // Slide in
  }
  isDashboardOpen = !isDashboardOpen;
});

// index dashboard content
const dashboardTitle = document.createElement("h2");
dashboardTitle.textContent = "Weighing Indexes";
dashboardTitle.style.margin = "20px";
dashboardTitle.style.fontSize = "18px";
dashboardTitle.style.color = "#333";
dashboardContainer.appendChild(dashboardTitle);

const dashboardContent = document.createElement("p");
dashboardContent.innerHTML = `
    <strong style="font-size: 14px;">Tsunami Risk Index</strong><br>
    <span style="font-size: 12px;">Measures the risk of tsunamis based on ground elevation, proximity to the coastline, and historical tsunami occurrences.</span><br>
    <input type="range" id="tsi-filter" min="0" max="1" step="0.01" value="0.5" style="width: 100%; margin-top: 10px; accent-color: orange;">
    <span id="tsi-value" style="font-size: 12px; color: #333;">0.5</span><br><br>
    
    <strong style="font-size: 14px;">Structure Durability Index</strong><br>
    <span style="font-size: 12px;">Evaluates the durability of structures considering seismic activity, ground elevation, proximity to the coastline, and humidity levels.</span><br>
    <input type="range" id="sdi-filter" min="0" max="1" step="0.01" value="0.5" style="width: 100%; margin-top: 10px; accent-color: orange;">
    <span id="sdi-value" style="font-size: 12px; color: #333;">0.5</span><br><br>
    
    <strong style="font-size: 14px;">Environmental Impact Index</strong><br>
    <span style="font-size: 12px;">Assesses the environmental impact based on land use changes and biodiversity loss.</span><br>
    <input type="range" id="e2i-filter" min="0" max="1" step="0.01" value="0.5" style="width: 100%; margin-top: 10px; accent-color: orange;">
    <span id="e2i-value" style="font-size: 12px; color: #333;">0.5</span><br><br>
    
    <strong style="font-size: 14px;">Operability Index</strong><br>
    <span style="font-size: 12px;">Determines the operational feasibility considering ground elevation, network density, urban proximity, and population density.</span><br>
    <input type="range" id="opi-filter" min="0" max="1" step="0.01" value="0.5" style="width: 100%; margin-top: 10px; accent-color: orange;">
    <span id="opi-value" style="font-size: 12px; color: #333;">0.5</span><br><br>
    
    <strong style="font-size: 14px;">Population-Economic Importance</strong><br>
    <span style="font-size: 12px;">Highlights the economic and population significance based on population density, land area, and GDP per capita.</span><br>
    <input type="range" id="pei-filter" min="0" max="1" step="0.01" value="0.5" style="width: 100%; margin-top: 10px; accent-color: orange;">
    <span id="pei-value" style="font-size: 12px; color: #333;">0.5</span><br><br>
    
    <strong style="font-size: 14px;">Final Feasibility Index</strong><br>
    <span style="font-size: 12px;">Combines all indexes to provide an overall feasibility score for the project.</span><br>
    <input type="range" id="ffi-filter" min="0" max="1" step="0.01" value="0.5" style="width: 100%; margin-top: 10px; accent-color: orange;">
    <span id="ffi-value" style="font-size: 12px; color: #333;">0.5</span><br><br>
  `;
dashboardContent.style.margin = "20px";
dashboardContent.style.fontSize = "14px";
dashboardContent.style.color = "#666";
dashboardContent.style.lineHeight = "1.3";
dashboardContainer.appendChild(dashboardContent);

// update values when sliders are adjusted
const updateFilterValue = (id, valueId) => {
  const slider = document.getElementById(id);
  const valueDisplay = document.getElementById(valueId);
  slider.addEventListener("input", () => {
    valueDisplay.textContent = slider.value;

    // Update the export dashboard content when the slider value changes
    if (isExportDashboardOpen) {
      // Re-generate the score container content with updated values
      updateExportDashboardContent();
    }
  });
};

// Add this new function to update the export dashboard content
const updateExportDashboardContent = () => {
  // Find the scoreContainer in the export dashboard
  const scoreContainer = exportDashboardContainer.querySelector('div[style*="flex: 0.45"]');
  if (!scoreContainer) return;

  // Update the content with the current values
  scoreContainer.innerHTML = `
  <div style="display: flex; flex-direction: column; gap: 10px;">
    
    <div style="margin-left: -15px; display: flex; align-items: center; gap: 0px;">
  <img src="./images/marker_o.svg" alt="Origin" style="width: 40px; height: 40px;">
  <span style="font-weight: bold; color: rgb(133, 133, 133); letter-spacing: 3px; font-size: 21px;">ORIGIN</span>
    </div>
    
    <div style="margin-bottom: 5px;font-size: 16px; color: rgb(109, 109, 109);">${originInput.value || "N/A"}</div>

    <div style="margin-left: -15px; display: flex; align-items: center; gap: 0px;">
  <img src="./images/marker_d.svg" alt="Destination Marker" style="width: 40px; height: 40px;">
  <span style="font-weight: bold; color: rgb(133, 133, 133); letter-spacing: 3px; font-size: 21px;">DESTINATION</span>
    </div>
    
    <div style="font-size: 16px; color: rgb(109, 109, 109);">${destinationInput.value || "N/A"}</div>
  <br>
    <div style="display: flex; justify-content: space-between;">
  <span style="font-weight: bold; color: rgb(133, 133, 133); letter-spacing: 3px; font-size: 21px;">INDEXES</span>
    </div>

    <div>
  <div style="margin-top: 2px; display: flex; justify-content: space-between;">
    <span style="font-weight: bold; color: rgb(109, 109, 109);">Tsunami Risk Index</span>
  </div>
  <small style="color: rgb(161, 161, 161); font-weight: medium;">The higher, the better.</small>
  
  <div style="text-align: right; font-size: 16px; color: rgb(182, 182, 182); font-weight: bold;">${getValue(
    "tsi-value"
  )} <span style="font-size: 20px; color: rgb(119, 119, 119);">/ 1</span></div>
    </div>

    <div>
  <div style="margin-top: 0px; display: flex; justify-content: space-between;">
    <span style=" font-weight: bold; color: rgb(109, 109, 109);">Structure Durability Index</span>
  </div>
  <small style="color: rgb(161, 161, 161); font-weight: medium;">The higher, the better.</small>

  <div style="text-align: right; font-size: 16px; color: rgb(182, 182, 182); font-weight: bold;">${getValue(
    "sdi-value"
  )} <span style="font-size: 20px; color: rgb(119, 119, 119);">/ 1</span></div>
    </div>

    <div>
  <div style="margin-top: 0px; display: flex; justify-content: space-between;">
    <span style="font-weight: bold; color: rgb(109, 109, 109);">Environment Impact Index</span>
  </div>
  <small style="color: rgb(161, 161, 161); font-weight: medium;">The higher, the better.</small>

  <div style="text-align: right; font-size: 16px; color: rgb(182, 182, 182); font-weight: bold;">${getValue(
    "e2i-value"
  )} <span style="font-size: 20px; color: rgb(119, 119, 119);">/ 1</span></div>
    </div>

    <div>
  <div style="margin-top: 0px; display: flex; justify-content: space-between;">
    <span style="font-weight: bold; color: rgb(109, 109, 109);">Operability Index</span>
  </div>
  <small style="color: rgb(161, 161, 161); font-weight: medium;">The higher, the better.</small>

  <div style="text-align: right; font-size: 16px; color: rgb(182, 182, 182); font-weight: bold;">${getValue(
    "opi-value"
  )} <span style="font-size: 20px; color: rgb(119, 119, 119);">/ 1</span></div>
    </div>

    <div>
  <div style="margin-top: 0px; display: flex; justify-content: space-between;">
    <span style="font-weight: bold; color: rgb(109, 109, 109);">Population-Economic Index</span>
  </div>
  <small style="color: rgb(161, 161, 161); font-weight: medium;">The higher, the better.</small>

  <div style="text-align: right; font-size: 16px; color: rgb(182, 182, 182); font-weight: bold;">${getValue(
    "pei-value"
  )} <span style="font-size: 20px; color: rgb(119, 119, 119);">/ 1</span></div>
    </div>

    <div style="margin-top: 0px; border: 2px solid #f67a0a; padding: 10px 12px; background-color: #fff8f0;">
  <div>
    <div style="font-weight: bold; color: #f67a0a;">Feasibility Score</div>
    <small style="color: rgb(155, 155, 155); font-weight: medium;">The higher, the better.</small>

    <div style="text-align: right; font-size: 18px; color: #f67a0a; font-weight: bold;">${getValue(
      "ffi-value"
    )} <span style="font-size: 20px; color: rgb(119, 119, 119);">/ 1</span></div>
  </div>
    </div>
    
    <div style="border: 2px solid #019cde; padding: 10px 12px; margin-top: 10px; background-color:rgb(240, 253, 255);">
  <div>
    <div style="font-weight: bold; color: #019cde;">Population Served</div>
    <small style="color: rgb(155, 155, 155); font-weight: medium;">Number of people impacted along the Origin-Destination corridor. Value is an approximation and may not reflect actual numbers.</small>
    <div style="text-align: right; font-size: 18px; color: #019cde; font-weight: bold;">${getValue(
      "population-served"
    )} <span style="font-size: 20px; color: rgb(119, 119, 119);">People</span></div>
  </div>
    </div>

  </div>
  `;
};

updateFilterValue("tsi-filter", "tsi-value");
updateFilterValue("sdi-filter", "sdi-value");
updateFilterValue("e2i-filter", "e2i-value");
updateFilterValue("opi-filter", "opi-value");
updateFilterValue("pei-filter", "pei-value");
updateFilterValue("ffi-filter", "ffi-value");

// layers dashboard
const layersDashboardContainer = document.createElement("div");
layersDashboardContainer.style.position = "fixed";
layersDashboardContainer.style.top = "0";
layersDashboardContainer.style.left = "-300px"; // initially hidden
layersDashboardContainer.style.width = "300px";
layersDashboardContainer.style.top = "190px";
layersDashboardContainer.style.height = "65%";
layersDashboardContainer.style.opacity = 0.95;
layersDashboardContainer.style.backgroundColor = "white";
layersDashboardContainer.style.boxShadow = "2px 0 5px rgba(0, 0, 0, 0.2)";
layersDashboardContainer.style.zIndex = "2000";
layersDashboardContainer.style.transition = "left 0.3s ease";
layersDashboardContainer.style.overflowY = "auto";
layersDashboardContainer.style.borderTopRightRadius = "15px";
layersDashboardContainer.style.borderBottomRightRadius = "15px";
layersDashboardContainer.style.scrollbarWidth = "thin"; // Minimalist scrollbar for Firefox
layersDashboardContainer.style.scrollbarColor = "#ccc transparent"; // Custom scrollbar color for Firefox
document.body.appendChild(layersDashboardContainer);

// Minimalist scrollbar for WebKit browsers
const layersStyle = document.createElement("style");
layersStyle.textContent = `
    #layersDashboardContainer::-webkit-scrollbar {
      width: 6px;
    }
    #layersDashboardContainer::-webkit-scrollbar-thumb {
      background-color: #ccc;
      border-radius: 3px;
    }
    #layersDashboardContainer::-webkit-scrollbar-track {
      background: transparent;
    }
  `;
document.head.appendChild(layersStyle);
layersDashboardContainer.id = "layersDashboardContainer";

// layers dashboard button with icon and text
const layersDashboardToggleButtonContainer = document.createElement("div");
layersDashboardToggleButtonContainer.style.position = "absolute";
layersDashboardToggleButtonContainer.style.top = "139px";
layersDashboardToggleButtonContainer.style.left = "124px";
layersDashboardToggleButtonContainer.style.zIndex = "2001";
layersDashboardToggleButtonContainer.style.cursor = "pointer";
layersDashboardToggleButtonContainer.style.display = "flex";
layersDashboardToggleButtonContainer.style.alignItems = "center";
layersDashboardToggleButtonContainer.style.backgroundColor = "#ffffff";
layersDashboardToggleButtonContainer.style.padding = "5px 10px";
layersDashboardToggleButtonContainer.style.borderRadius = "20px";
layersDashboardToggleButtonContainer.style.boxShadow = "0px 2px 5px rgba(0, 0, 0, 0.2)";
document.body.appendChild(layersDashboardToggleButtonContainer);

const layersDashboardToggleButtonIcon = document.createElement("img");
layersDashboardToggleButtonIcon.src = "images/layer.svg";
layersDashboardToggleButtonIcon.alt = "Layers";
layersDashboardToggleButtonIcon.style.width = "20px";
layersDashboardToggleButtonIcon.style.height = "20px";
layersDashboardToggleButtonIcon.style.marginRight = "3px";
layersDashboardToggleButtonContainer.appendChild(layersDashboardToggleButtonIcon);

const layersDashboardToggleButtonText = document.createElement("span");
layersDashboardToggleButtonText.textContent = "Layers";
layersDashboardToggleButtonText.style.fontSize = "14px";
layersDashboardToggleButtonText.style.color = "#333";
layersDashboardToggleButtonText.style.fontWeight = "bold";
layersDashboardToggleButtonContainer.appendChild(layersDashboardToggleButtonText);

// toggle layers dashboard
let isLayersDashboardOpen = false;
layersDashboardToggleButtonContainer.addEventListener("click", () => {
  if (isLayersDashboardOpen) {
    layersDashboardContainer.style.left = "-300px"; // Slide out
  } else {
    layersDashboardContainer.style.left = "0"; // Slide in
  }
  isLayersDashboardOpen = !isLayersDashboardOpen;
});

// layers dashboard content
const layersDashboardTitle = document.createElement("h2");
layersDashboardTitle.textContent = "Layers Glossary";
layersDashboardTitle.style.margin = "20px";
layersDashboardTitle.style.fontSize = "18px";
layersDashboardTitle.style.color = "#333";
layersDashboardContainer.appendChild(layersDashboardTitle);

const layersDashboardContent = document.createElement("p");
layersDashboardContent.innerHTML = `
    <div style="display: flex; align-items: center;">
      <img src="images/tsunami.svg" alt="Tsunamis" style="width: 20px; height: 20px; margin-right: 10px; filter: invert(100%); opacity: 0.7;">
      <strong style="color: #f67a0a;">Historical Tsunamis</strong>
    </div>
    Shows historical tsunami points from 1923 to 2024.<br><br>
    <div style="display: flex; align-items: center;">
      <img src="images/quake.svg" alt="Earthquakes" style="width: 20px; height: 20px; margin-right: 10px; filter: invert(100%); opacity: 0.7;">
      <strong style="color: #f67a0a;">Historical Earthquakes</strong>
    </div>
    Shows historical earthquake sites from 1923 to 2024.<br><br>
    <div style="display: flex; align-items: center;">
      <img src="images/coast.svg" alt="Coastline" style="width: 20px; height: 20px; margin-right: 10px; filter: invert(100%); opacity: 0.7;">
      <strong style="color: #f67a0a;">Coastline</strong>
    </div>
    Shows the coastline boundaries for Southeast Asia.<br><br>
    <div style="display: flex; align-items: center;">
      <img src="images/humidity.svg" alt="Humidity" style="width: 20px; height: 20px; margin-right: 10px; filter: invert(100%); opacity: 0.7;">
      <strong style="color: #f67a0a;">Humidity</strong>
    </div>
    Shows average humidity for the year 2024. Data resolution is approximately 1km² per pixel.<br><br>
    <div style="display: flex; align-items: center;">
      <img src="images/tree.svg" alt="Forest Coverage" style="width: 20px; height: 20px; margin-right: 10px; filter: invert(100%); opacity: 0.7;">
      <strong style="color: #f67a0a;">Forest Coverage</strong>
    </div>
    Shows forest coverage based on satellite imagery from 2015. Data resolution is approximately 30m per pixel.<br><br>
    <div style="display: flex; align-items: center;">
      <img src="images/amphibians.svg" alt="Amphibians" style="width: 20px; height: 20px; margin-right: 10px; filter: invert(100%); opacity: 0.7;">
      <strong style="color: #f67a0a;">Amphibians</strong>
    </div>
    Shows presence of amphibian biodiversity based on data collected up to 2020. Data resolution is approximately 1km² per pixel.<br><br>
    <div style="display: flex; align-items: center;">
      <img src="images/bird.svg" alt="Birds" style="width: 20px; height: 20px; margin-right: 10px; filter: invert(100%); opacity: 0.7;">
      <strong style="color: #f67a0a;">Birds</strong>
    </div>
    Shows presence of bird biodiversity based on data collected up to 2020. Data resolution is approximately 1km² per pixel.<br><br>
    <div style="display: flex; align-items: center;">
      <img src="images/mammals.svg" alt="Mammals" style="width: 20px; height: 20px; margin-right: 10px; filter: invert(100%); opacity: 0.7;">
      <strong style="color: #f67a0a;">Mammals</strong>
    </div>
    Shows presence of mammal biodiversity based on data collected up to 2020. Data resolution is approximately 1km² per pixel.<br><br>
    <div style="display: flex; align-items: center;">
      <img src="images/gdp.svg" alt="GDP" style="width: 20px; height: 20px; margin-right: 10px; opacity: 0.7;">
      <strong style="color: #f67a0a;">Spatial GDP Per Capita</strong>
    </div>
    Shows spatial distribution of the Gross Domestic Product (GDP) per head for the year 2022. Data resolution is approximately 5km² per pixel.<br><br>
    <div style="display: flex; align-items: center;">
      <img src="images/population.svg" alt="Population" style="width: 20px; height: 20px; margin-right: 10px; opacity: 0.7;">
      <strong style="color: #f67a0a;">Spatial Population</strong>
    </div>
    Shows spatial distribution of population for the year 2022. Data resolution is approximately 30m per pixel.<br><br>
    <div style="display: flex; align-items: center;">
      <img src="images/plus.svg" alt="Infrastructure" style="width: 20px; height: 20px; margin-right: 10px; opacity: 0.7;">
      <strong style="color: #f67a0a;">Key Infrastructure</strong>
    </div>
    Displays key connectivity infrastructure such as airports, railways, and seaports within each Southeast Asian country.<br><br>
    <div style="display: flex; align-items: center;">
    </div>
      <br>
      <br>
      <br>
      <strong><a href="https://github.com/xuanx1?tab=repositories" target="_blank" style="color: #00be9d; text-decoration: none;">Project Repository</a></strong>
    Explore the source code and related projects.<br><br>
    <div style="display: flex; align-items: center;"></div>

      <strong><a href="https://xuanx1.github.io/designArchiveWinter24/loading.html" target="_blank" style="color: #00be9d; text-decoration: none;">Design Archive</a></strong>
    View Xuan's portfolio, encompassing numerous interdisciplinary projects.<br><br>
    <div style="display: flex; align-items: center;"></div>
  `;
layersDashboardContent.style.margin = "20px";
layersDashboardContent.style.fontSize = "14px";
layersDashboardContent.style.color = "#666";
layersDashboardContent.style.lineHeight = "1.5";
layersDashboardContainer.appendChild(layersDashboardContent);



// legend
const legendContainer = document.createElement("div");
legendContainer.style.position = "absolute";
legendContainer.style.bottom = "15px";
legendContainer.style.right = "15px";
legendContainer.style.zIndex = "1000";
legendContainer.style.fontSize = "12px";
legendContainer.style.color = "#2b2b2b";
legendContainer.style.display = "flex";
legendContainer.style.gap = "25px";
legendContainer.style.flexWrap = "wrap"; // Allow wrapping for mobile


const legendItems = [
  { color: "#0000ff", label: "Seaports" },
  { color: "#ffff00", label: "Airports" },
  { color: "#ff0000", label: "Railways" },
  { color: "#ffa500", label: "Roads" },
];

legendItems.forEach((item) => {
  const legendItem = document.createElement("div");
  legendItem.style.display = "flex";
  legendItem.style.alignItems = "center";
  legendItem.style.marginBottom = "5px"; // Add spacing for wrapping

  const colorBox = document.createElement("div");
  colorBox.style.width = "8px";
  colorBox.style.height = "8px";
  colorBox.style.backgroundColor = item.color;
  colorBox.style.marginRight = "7px";
  colorBox.style.borderRadius = "4px";
  legendItem.appendChild(colorBox);

  const label = document.createElement("span");
  label.textContent = item.label;
  label.style.color = "white";
  legendItem.appendChild(label);

  legendContainer.appendChild(legendItem);
});

document.body.appendChild(legendContainer);

// mobile layout
function adjustLegendLayout() {
  if (window.innerWidth <= 768) {
    legendContainer.style.flexDirection = "column";
    legendContainer.style.gap = "5px";
    legendContainer.style.bottom = "80px";
    legendContainer.style.right = "14px";

    Array.from(legendContainer.children).forEach((item) => {
      item.style.flexDirection = "row-reverse";
      item.style.gap = "5px";
    });
  } else {
    legendContainer.style.flexDirection = "row";
    legendContainer.style.gap = "25px";
    legendContainer.style.bottom = "15px";
    legendContainer.style.right = "15px";

    Array.from(legendContainer.children).forEach((item) => {
      item.style.flexDirection = "row";
      item.style.gap = "0px";
    });
  }
}

window.addEventListener("resize", adjustLegendLayout);
adjustLegendLayout(); // Initial adjustment



// roads Mapbox
// "filtered-roads-layer" dropped — was a vector overlay on Mapbox's private
// streets tiles. The OpenFreeMap Liberty basemap already renders roads
// natively, so this overlay is redundant and would 404 on its source URL.

// coastlines
map.on("load", () => {
  map.addSource("sea-coastline", {
    type: "geojson",
    data: "data/earth-coastlines.geo.json",
  });

  map.addLayer({
    id: "sea-coastline-layer",
    type: "line",
    source: "sea-coastline",
    paint: {
      "line-color": "#00ffff", // Cyan color for coastline
      "line-width": 1,
      "line-opacity": 0.8,
    },
  });

  // toggle coastline
  const coastlineToggleContainer = d3
    .select("body")
    .append("div")
    .style("position", "absolute")
    .style("top", "205px")
    .style("right", "5px")
    .style("z-index", "1000");

  const coastlineButton = coastlineToggleContainer
    .append("img")
    .attr("src", "images/coast.svg")
    .attr("alt", "Coastline")
    .style("margin", "5px")
    .style("padding", "5px")
    .style("cursor", "pointer")
    .style("width", "30px")
    .style("height", "30px")
    .style("border", "0px solid #ccc")
    .style("border-radius", "50%")
    .style("background-color", "#4181f2")
    .style("filter", "brightness(100%)") // Start as coloured
    .on("click", () => {
      const visibility = map.getLayoutProperty("sea-coastline-layer", "visibility");
      if (visibility === "visible") {
        map.setLayoutProperty("sea-coastline-layer", "visibility", "none");
        coastlineButton.style("filter", "brightness(30%)"); // Greyed out
      } else {
        map.setLayoutProperty("sea-coastline-layer", "visibility", "visible");
        coastlineButton.style("filter", "brightness(100%)"); // Coloured
      }
    });

  // hover description
  const coastlineDescription = d3
    .select("body")
    .append("div")
    .style("position", "absolute")
    .style("padding", "7px")
    .style("background-color", "white")
    .style("border", "0px solid #ccc")
    .style("border-radius", "20px")
    .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
    .style("font-size", "14px")
    .style("color", "#333")
    .style("display", "none")
    .style("top", "210px")
    .style("right", "50px")
    .text("Show Coastline");

  coastlineButton
    .on("mouseover", (event) => {
      coastlineDescription
        // .style("left", `${event.pageX - 160}px`)
        // .style("top", `${event.pageY + 0}px`)
        .style("display", "block");
    })
    .on("mouseout", () => {
      coastlineDescription.style("display", "none");
    });
});

// 100 years earthquake 1923 - 2024
d3.json("data/worldQuakesMiles.json").then((data) => {
  // console.log(data);

  const geoData = {
    type: "FeatureCollection",
    features: data.features.map((feature) => ({
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        mag: feature.properties.mag,
      },
    })),
  };

  map.on("load", () => {
    map.addSource("earthquakes", {
      type: "geojson",
      data: geoData,
    });

    map.addLayer({
      id: "earthquake-points",
      type: "circle",
      source: "earthquakes",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "mag"], 0, 4, 5, 5],
        "circle-color": "#ff7900",
        "circle-opacity": 0.3,
        "circle-stroke-color": "#ff7900",
      },
      layout: {
        // Set initial visibility on the layer config itself — avoids the
        // race where a separate setLayoutProperty fires before the async
        // addLayer (inside d3.json.then + map.on("load")) has executed.
        visibility: "none",
      },
    });
  });

  // toggle quakes
  const earthquakeToggleContainer = d3
    .select("body") // Changed from "#app" to "body" to ensure it is appended to the correct container
    .append("div")
    .style("position", "absolute")
    .style("top", "165px")
    .style("right", "5px")
    .style("z-index", "1000");

  const earthquakeButton = earthquakeToggleContainer
    .append("img")
    .attr("src", "images/quake.svg")
    .attr("alt", "Earthquakes")
    .style("margin", "5px")
    .style("padding", "5px")
    .style("cursor", "pointer")
    .style("width", "30px")
    .style("height", "30px")
    .style("border", "0px solid #ccc")
    .style("border-radius", "50%")
    .style("background-color", "#ff7900")
    .style("filter", "brightness(100%)") // Start as greyed out
    .on("click", () => {
      const visibility = map.getLayoutProperty("earthquake-points", "visibility");
      if (visibility === "visible") {
        map.setLayoutProperty("earthquake-points", "visibility", "none");
        earthquakeButton.style("filter", "brightness(30%)"); // Greyed out
      } else {
        map.setLayoutProperty("earthquake-points", "visibility", "visible");
        earthquakeButton.style("filter", "brightness(100%)"); // Coloured
      }
    });

  // hover description
  const descriptionWindow = d3
    .select("body")
    .append("div")
    .style("position", "absolute")
    .style("padding", "7px")
    .style("background-color", "white")
    .style("border", "0px solid #ccc")
    .style("border-radius", "20px")
    .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
    .style("font-size", "14px")
    .style("color", "#333")
    .style("display", "none")
    .style("top", "170px")
    .style("right", "50px")
    .text("Show Historical Earthquakes");

  earthquakeButton
    .on("mouseover", (event) => {
      descriptionWindow
        // .style("left", `${event.pageX - 240}px`)
        // .style("top", `${event.pageY + 0}px`)
        .style("display", "block");
    })
    .on("mouseout", () => {
      descriptionWindow.style("display", "none");
    });

  // Initial visibility is set on the layer config (above) — no separate
  // setLayoutProperty needed here, which would race the async addLayer.
});

// 100 years tsunami 1923 - 2024
d3.tsv("data/tsunami.tsv").then((data) => {
  // console.log(data);

  const filteredData = data.filter((d) => d.Longitude && d.Latitude);

  // Convert tsv to geojson
  const geoData = {
    type: "FeatureCollection",
    features: filteredData.map((d) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [+d.Longitude, +d.Latitude],
      },
      properties: {
        mag: +d.mag || 0,
        place: d.place || "Unknown Location",
      },
    })),
  };

  map.on("load", () => {
    map.addSource("tsunami", {
      type: "geojson",
      data: geoData,
    });

    // tsunami pt
    map.addLayer({
      id: "tsunami-points",
      type: "circle",
      source: "tsunami",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "mag"], 0, 4, 10, 20],
        "circle-color": "#6dbefe", // Teal #00be9d
        "circle-opacity": 0.4,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#6dbefe", // Teal
      },
      layout: {
        visibility: "none", // visibility off by default
      },
    });

    // toggle tsunami
    const toggleContainer = d3
      .select("body")
      .append("div")
      .style("position", "absolute")
      .style("top", "125px")
      .style("right", "5px")
      .style("z-index", "1000");

    const toggleButton = toggleContainer
      .append("img")
      .attr("src", "images/tsunami.svg")
      .attr("alt", "Tsunami")
      .style("margin", "5px")
      .style("padding", "5px")
      .style("cursor", "pointer")
      .style("width", "30px")
      .style("height", "30px")
      .style("border", "0px solid #ccc")
      .style("border-radius", "50%")
      .style("background-color", "#6dbefe")
      .style("filter", "brightness(30%)") // Start as greyed out
      .on("click", () => {
        const visibility = map.getLayoutProperty("tsunami-points", "visibility");
        if (visibility === "visible") {
          map.setLayoutProperty("tsunami-points", "visibility", "none");
          toggleButton.style("filter", "brightness(30%)"); // Greyed out
        } else {
          map.setLayoutProperty("tsunami-points", "visibility", "visible");
          toggleButton.style("filter", "brightness(100%)"); // Coloured
        }
      });

    // hover description
    const descriptionWindow = d3
      .select("body")
      .append("div")
      .style("position", "absolute")
      .style("padding", "7px")
      .style("background-color", "white")
      .style("border", "0px solid #ccc")
      .style("border-radius", "20px")
      .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
      .style("font-size", "14px")
      .style("color", "#333")
      .style("display", "none")
      .style("top", "130px")
      .style("right", "50px")
      .text("Show Historical Tsunamis");

    toggleButton
      .on("mouseover", (event) => {
        descriptionWindow
          // .style("left", `${event.pageX - 240}px`)
          // .style("top", `${event.pageY + 0}px`)
          .style("display", "block");
      })
      .on("mouseout", () => {
        descriptionWindow.style("display", "none");
      });
  });
});

map.on("style.load", () => {
  // southeast asian regional border sea.json
  fetch("data/sea.json")
    .then((response) => response.json())
    .then((data) => {
      map.addSource("sea", {
        type: "geojson",
        data: data,
      });
      map.addLayer({
        id: "sea-layer",
        type: "fill",
        source: "sea",
        paint: {
          "fill-color": "#000000",
          "fill-opacity": 0.3,
        },
      });

      // outline sea regional border
      map.addLayer({
        id: "sea-outline-layer",
        type: "line",
        source: "sea",
        paint: {
          "line-color": "#ffffff", // White outline
          "line-width": 1,
          "line-opacity": 0.7,
        },
      });
    })
    .catch((error) => console.error("Error loading GeoJSON:", error));
});

// Spatial population — was 12 private xuanx111 raster tilesets (one per
// SEA country). Replaced with a single MapLibre fill layer driven by the
// gdp values in data/preCal/grid_final.geojson. The original toggle
// iterates `tilesets.forEach` so we keep that shape (single-element array)
// to preserve the existing toggle button + click handler.
map.on("load", function () {
  const tilesets = ["population-grid"]; // legacy: shape for the forEach toggle

  // Shared geojson source for both Population and GDP layers
  if (!map.getSource("population-grid-src")) {
    map.addSource("population-grid-src", {
      type: "geojson",
      data: "data/preCal/grid_final.geojson",
    });
  }

  tilesets.forEach((tileset, index) => {
    const layerId = `raster-layer-${index}`;

    map.addLayer({
      id: layerId,
      type: "fill",
      source: "population-grid-src",
      // Only render cells with gdp >= 50 — drops the polygon count from
      // ~49K to ~10K so the toggle is 5× faster on first show.
      filter: [">=", ["get", "gdp"], 50],
      paint: {
        "fill-color": [
          "interpolate", ["linear"], ["get", "gdp"],
          0, "rgba(0,0,0,0)",
          50, "#fef0d9",
          150, "#fdcc8a",
          500, "#fc8d59",
          1500, "#d7301f",
          5000, "#7f0000",
        ],
        "fill-opacity": 0.6,
      },
      layout: {
        visibility: "none",
      },
    });

    // toggle spatpop
    const toggleContainer = d3
      .select("body")
      .append("div")
      .style("position", "absolute")
      .style("top", "465px") // Fixed position for the toggle
      .style("right", "5px")
      .style("z-index", "1000");

    const toggleButton = toggleContainer
      .append("img")
      .attr("src", "images/population.svg")
      .attr("alt", "Spatial Population Density")
      .style("margin", "5px")
      .style("padding", "5px")
      .style("cursor", "pointer")
      .style("width", "30px")
      .style("height", "30px")
      .style("border", "0px solid #ccc")
      .style("border-radius", "50%")
      .style("background-color", "#ffffff")
      .style("filter", "brightness(30%)") // Start as greyed out
      .on("click", () => {
        let isActive = false;
        tilesets.forEach((tileset, index) => {
          const layerId = `raster-layer-${index}`;
          const visibility = map.getLayoutProperty(layerId, "visibility");
          if (visibility === "visible") {
            map.setLayoutProperty(layerId, "visibility", "none");
            isActive = false;
          } else {
            map.setLayoutProperty(layerId, "visibility", "visible");
            isActive = true;
          }
        });
        toggleButton.style("filter", isActive ? "brightness(100%)" : "brightness(30%)"); // Update button color
      });

    // hover description
    const descriptionWindow = d3
      .select("body")
      .append("div")
      .style("position", "absolute")
      .style("padding", "7px")
      .style("background-color", "white")
      .style("border", "0px solid #ccc")
      .style("border-radius", "20px")
      .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
      .style("font-size", "14px")
      .style("color", "#333")
      .style("display", "none")
      .style("top", "470px")
      .style("right", "50px")
      .text("Show Spatial Population Density");

    toggleButton
      .on("mouseover", () => {
        descriptionWindow.style("display", "block");
      })
      .on("mouseout", () => {
        descriptionWindow.style("display", "none");
      });
  });
});

map.on("style.load", () => {
  // Avg 2024 humidity - avgHU_vect.geojson classify into 5 classes - temperature
  fetch("data/avgHU_vect.geojson")
    .then((response) => response.json())
    .then((data) => {
      map.addSource("avgHU", {
        type: "geojson",
        data: data,
      });

      map.addLayer({
        id: "avgHU-layer",
        type: "fill",
        source: "avgHU",
        paint: {
          "fill-color": [
            "step",
            ["get", "DN"],
            "#ffffff",
            159, // 0-159: white
            "#ffff00",
            182, // 160-182: yellow
            "#ffa500",
            197, // 183-197: orange
            "#ff0000",
            209, // 198-209: red
            "#800080", // 210-255: purple
          ],
          "fill-opacity": 0.5,
        },
        layout: {
          visibility: "none", // visibility off by default
        },
      });

      // toggle avgHU-layer
      const avgHUToggleContainer = d3
        .select("body")
        .append("div")
        .style("position", "absolute")
        .style("top", "245px")
        .style("right", "5px")
        .style("z-index", "1000");

      const avgHUButton = avgHUToggleContainer
        .append("img")
        .attr("src", "images/humidity.svg")
        .attr("alt", "Humidity")
        .style("margin", "5px")
        .style("padding", "5px")
        .style("cursor", "pointer")
        .style("width", "30px")
        .style("height", "30px")
        .style("border", "0px solid #ccc")
        .style("border-radius", "50%")
        .style("background-color", "#00be9d")
        .style("filter", "brightness(30%)") // Start as greyed out
        .on("click", () => {
          const visibility = map.getLayoutProperty("avgHU-layer", "visibility");
          if (visibility === "visible") {
            map.setLayoutProperty("avgHU-layer", "visibility", "none");
            avgHUButton.style("filter", "brightness(30%)"); // Greyed out
            // Hide legend
            humidityLegend.style("display", "none");
          } else {
            map.setLayoutProperty("avgHU-layer", "visibility", "visible");
            avgHUButton.style("filter", "brightness(100%)"); // Coloured
            // Show legend only if not on mobile
            if (window.innerWidth > 768) {
              humidityLegend.style("display", "block");
            }
          }
        });
      
      // humidity legend with continuous gradient
      const humidityLegend = d3
        .select("body")
        .append("div")
        .attr("id", "humidity-legend")
        .style("position", "absolute")
        .style("bottom", "180px")
        .style("left", "10px")
        .style("padding", "10px")
        .style("border-radius", "5px")
        .style("box-shadow", "0 0 10px rgba(0,0,0,0.1)")
        .style("z-index", "1000")
        .style("display", "none")
        .style("font-size", "12px")
        .style("max-width", "200px");

      // legend title
      humidityLegend
        .append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "10px")
        .style("font-size", "12px")
        .style("color", "#ffffff")
        .style("letter-spacing", "2px")
        .text("HUMIDITY LEVEL");

      const gradientContainer = humidityLegend
        .append("div")
        .style("position", "relative")
        .style("width", "100%")
        .style("height", "25px");
        
      gradientContainer
        .append("div")
        .style("width", "200px")
        .style("height", "10px")
        .style("background", "linear-gradient(to right, #ffffff, #ffff00, #ffa500, #ff0000, #800080)")
        .style("border-radius", "2px")
        .style("margin-bottom", "10px")
        .style("border", "1px solid #ccc")
        .style("position", "relative");

      // Min label
      gradientContainer
        .append("div")
        .style("position", "absolute")
        .style("top", "15px")
        .style("left", "0")
        .style("color", "#ffffff")
        .style("font-size", "10px")
        .text("Low");

      // Max label
      gradientContainer
        .append("div")
        .style("position", "absolute")
        .style("top", "15px")
        .style("right", "-20px")
        .style("color", "#ffffff")
        .style("font-size", "10px")
        .text("High");

      // Function to handle responsive behavior for the legend
      const handleResponsiveLegend = () => {
        // If the layer is visible but we're on mobile, hide the legend
        if (window.innerWidth <= 768) {
          humidityLegend.style("display", "none");
        } else if (map.getLayoutProperty("avgHU-layer", "visibility") === "visible") {
          // On desktop and layer is visible, show the legend
          humidityLegend.style("display", "block");
        }
      };

      // Call on window resize
      window.addEventListener("resize", handleResponsiveLegend);
      
      // Initial call
      handleResponsiveLegend();
     
      // hover description
      const avgHUDescription = d3
        .select("body")
        .append("div")
        .style("position", "absolute")
        .style("padding", "7px")
        .style("background-color", "white")
        .style("border", "0px solid #ccc")
        .style("border-radius", "20px")
        .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
        .style("font-size", "14px")
        .style("color", "#333")
        .style("display", "none")
        .style("top", "250px")
        .style("right", "50px")
        .text("Show Humidity");

      avgHUButton
        .on("mouseover", (event) => {
          avgHUDescription.style("display", "block");
        })
        .on("mouseout", () => {
          avgHUDescription.style("display", "none");
        });
    })
    .catch((error) => console.error("Error loading GeoJSON:", error));
});

//forest area - virtual raster, compress, 8 bit, clip, reclassify, host, get tile key, bright green
map.on("load", function () {
  fetch("data/sea_forest_vect.geojson")
    .then((response) => response.json())
    .then((data) => {
      map.addSource("forest-geojson", {
        type: "geojson",
        data: data,
      });

      map.addLayer({
        id: "forest-layer",
        type: "fill",
        source: "forest-geojson",
        paint: {
          "fill-color": [
            "step",
            ["get", "DN"],
            "#e5f5e0",
            11, // 0-11: very light green
            "#a1d99b",
            29, // 12-29: light green
            "#41ab5d",
            47, // 30-47: medium green
            "#006d2c",
            104, // 48-104: darker green
            "#00441b", // 105-255: deepest dark green
          ],
          "fill-opacity": 0.3,
        },
        layout: {
          visibility: "none", // visibility off by default
        },
      });

      // toggle forest
      const toggleContainer = d3
        .select("body")
        .append("div")
        .style("position", "absolute")
        .style("top", "285px")
        .style("right", "5px")
        .style("z-index", "1000");

      const toggleButton = toggleContainer
        .append("img")
        .attr("src", "images/tree.svg")
        .attr("alt", "Forest Cover")
        .style("margin", "5px")
        .style("padding", "5px")
        .style("cursor", "pointer")
        .style("width", "30px")
        .style("height", "30px")
        .style("border", "0px solid #ccc")
        .style("border-radius", "50%")
        .style("padding", "7px")
        .style("background-color", "#228B22")
        .style("filter", "brightness(30%)") // Start as greyed out
        .on("click", () => {
          const visibility = map.getLayoutProperty("forest-layer", "visibility");
          if (visibility === "visible") {
            map.setLayoutProperty("forest-layer", "visibility", "none");
            toggleButton.style("filter", "brightness(30%)"); // Greyed out
            forestLegend.style("display", "none"); // Hide legend
          } else {
            map.setLayoutProperty("forest-layer", "visibility", "visible");
            toggleButton.style("filter", "brightness(100%)"); // Coloured
            
            // Only show legend on desktop
            if (window.innerWidth > 768) {
              forestLegend.style("display", "block"); // Show legend only on desktop
            }
          }
        });

      // forest legend with continuous gradient
      const forestLegend = d3
        .select("body")
        .append("div")
        .attr("id", "forest-legend")
        .style("position", "absolute")
        .style("bottom", "180px")
        .style("left", "255px")
        .style("padding", "10px")
        .style("border-radius", "5px")
        .style("box-shadow", "0 0 10px rgba(0,0,0,0.1)")
        .style("z-index", "1000")
        .style("display", "none")
        .style("font-size", "12px")
        .style("max-width", "200px");

      // legend title
      forestLegend
        .append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "10px")
        .style("font-size", "12px")
        .style("color", "#ffffff")
        .style("letter-spacing", "2px")
        .text("FOREST COVERAGE");

      const forestGradientContainer = forestLegend
        .append("div")
        .style("position", "relative")
        .style("width", "100%")
        .style("height", "25px");
        
      forestGradientContainer
        .append("div")
        .style("width", "200px")
        .style("height", "10px")
        .style("background", "linear-gradient(to right, #e5f5e0, #a1d99b, #41ab5d, #006d2c, #00441b)")
        .style("border-radius", "2px")
        .style("margin-bottom", "10px")
        .style("border", "1px solid #ccc")
        .style("position", "relative");

      // Min label
      forestGradientContainer
        .append("div")
        .style("position", "absolute")
        .style("top", "15px")
        .style("left", "0")
        .style("color", "#ffffff")
        .style("font-size", "10px")
        .text("Low");

      // Max label
      forestGradientContainer
        .append("div")
        .style("position", "absolute")
        .style("top", "15px")
        .style("right", "-20px")
        .style("color", "#ffffff")
        .style("font-size", "10px")
        .text("High");
        
      // Function to handle responsive behavior
      const handleResponsiveLegend = () => {
        // If we're on mobile, hide the legend regardless of layer visibility
        if (window.innerWidth <= 768) {
          forestLegend.style("display", "none");
        } 
        // If we're on desktop and the layer is visible, show the legend
        else if (map.getLayoutProperty("forest-layer", "visibility") === "visible") {
          forestLegend.style("display", "block");
        }
      };
      
      // Call on window resize
      window.addEventListener("resize", handleResponsiveLegend);
      
      // Initial call
      handleResponsiveLegend();

      // hover description
      const descriptionWindow = d3
        .select("body")
        .append("div")
        .style("position", "absolute")
        .style("padding", "7px")
        .style("background-color", "white")
        .style("border", "0px solid #ccc")
        .style("border-radius", "20px")
        .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
        .style("font-size", "14px")
        .style("color", "#333")
        .style("display", "none")
        .style("top", "290px")
        .style("right", "50px")
        .text("Show Forest Coverage");

      toggleButton
        .on("mouseover", () => {
          descriptionWindow.style("display", "block");
        })
        .on("mouseout", () => {
          descriptionWindow.style("display", "none");
        });
    })
    .catch((error) => console.error("Error loading GeoJSON (sea_forest_vect.geojson):", error));
});

map.on("style.load", () => {
  // amphibians_vect.geojson classify into 5 classes - yellow
  fetch("data/amphibians_vect.geojson")
    .then((response) => response.json())
    .then((data) => {
      map.addSource("amphibians", {
        type: "geojson",
        data: data,
      });

      map.addLayer({
        id: "amphibians-layer",
        type: "fill",
        source: "amphibians",
        paint: {
          "fill-color": [
            "step",
            ["get", "DN"],
            "#ffffcc",
            1, // 1: light yellow
            "#ffeda0",
            2, // 2: pale yellow
            "#fed976",
            3, // 3: soft yellow
            "#feb24c",
            5, // 5: medium yellow
            "#fd8d3c", // 5-16: deep yellow
          ],
          "fill-opacity": 0.5,
        },
        layout: {
          visibility: "none", // visibility off by default
        },
      });

      // toggle amphibians
      const amphibiansToggleContainer = d3
        .select("body")
        .append("div")
        .style("position", "absolute")
        .style("top", "335px")
        .style("right", "5px")
        .style("z-index", "1000");

      const amphibiansButton = amphibiansToggleContainer
        .append("img")
        .attr("src", "images/amphibians.svg")
        .attr("alt", "Amphibians")
        .style("margin", "5px")
        .style("padding", "5px")
        .style("cursor", "pointer")
        .style("width", "30px")
        .style("height", "30px")
        .style("border", "0px solid #ccc")
        .style("border-radius", "50%")
        .style("background-color", "#daa520") // Mustard yellow
        .style("filter", "brightness(30%)") // Start as greyed out
        .on("click", () => {
          const visibility = map.getLayoutProperty("amphibians-layer", "visibility");
          if (visibility === "visible") {
            map.setLayoutProperty("amphibians-layer", "visibility", "none");
            amphibiansButton.style("filter", "brightness(30%)"); // Greyed out
            // Hide legend
            amphibiansLegend.style("display", "none");
          } else {
            map.setLayoutProperty("amphibians-layer", "visibility", "visible");
            amphibiansButton.style("filter", "brightness(100%)"); // Coloured
            // Only show legend if not on mobile
            handleResponsiveLegend();
          }
        });
        
      // amphibians legend with continuous gradient
      const amphibiansLegend = d3
        .select("body")
        .append("div")
        .attr("id", "amphibians-legend")
        .style("position", "absolute")
        .style("bottom", "110px")
        .style("left", "10px")
        .style("padding", "10px")
        .style("border-radius", "5px")
        .style("box-shadow", "0 0 10px rgba(0,0,0,0.1)")
        .style("z-index", "1000")
        .style("display", "none")
        .style("font-size", "12px")
        .style("max-width", "250px");

      // legend title
      amphibiansLegend
        .append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "10px")
        .style("font-size", "12px")
        .style("color", "#ffffff")
        .style("letter-spacing", "2px")
        .text("AMPHIBIANS PRESENCE");

      const amphibiansGradientContainer = amphibiansLegend
        .append("div")
        .style("position", "relative")
        .style("width", "100%")
        .style("height", "25px");
        
      amphibiansGradientContainer
        .append("div")
        .style("width", "200px")
        .style("height", "10px")
        .style("background", "linear-gradient(to right, #ffffcc, #ffeda0, #fed976, #feb24c, #fd8d3c)")
        .style("border-radius", "2px")
        .style("margin-bottom", "10px")
        .style("border", "1px solid #ccc")
        .style("position", "relative");

      // Min label
      amphibiansGradientContainer
        .append("div")
        .style("position", "absolute")
        .style("top", "15px")
        .style("left", "0")
        .style("color", "#ffffff")
        .style("font-size", "10px")
        .text("Low");

      // Max label
      amphibiansGradientContainer
        .append("div")
        .style("position", "absolute")
        .style("top", "15px")
        .style("right", "0px")
        .style("color", "#ffffff")
        .style("font-size", "10px")
        .text("High");
        
      // Function to handle responsive behavior for the legend
      const handleResponsiveLegend = () => {
        // If we're on mobile, hide the legend regardless of layer visibility
        if (window.innerWidth <= 768) {
          amphibiansLegend.style("display", "none");
        } 
        // If we're on desktop and the layer is visible, show the legend
        else if (map.getLayoutProperty("amphibians-layer", "visibility") === "visible") {
          amphibiansLegend.style("display", "block");
        }
      };
      
      // Call on window resize
      window.addEventListener("resize", handleResponsiveLegend);
      
      // Initial call
      handleResponsiveLegend();

      // hover description
      const amphibiansDescription = d3
        .select("body")
        .append("div")
        .style("position", "absolute")
        .style("padding", "7px")
        .style("background-color", "white")
        .style("border", "0px solid #ccc")
        .style("border-radius", "20px")
        .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
        .style("font-size", "14px")
        .style("color", "#333")
        .style("display", "none")
        .style("top", "339px")
        .style("right", "50px")
        .text("Show Amphibians");

      amphibiansButton
        .on("mouseover", () => {
          amphibiansDescription.style("display", "block");
        })
        .on("mouseout", () => {
          amphibiansDescription.style("display", "none");
        });
    })
    .catch((error) => console.error("Error loading GeoJSON (amphibians_vect.geojson):", error));
});

map.on("style.load", () => {
  // birds_vect.geojson classify into 5 classes - orange
  fetch("data/birds_vect.geojson")
    .then((response) => response.json())
    .then((data) => {
      map.addSource("birds", {
        type: "geojson",
        data: data,
      });

      map.addLayer({
        id: "birds-layer",
        type: "fill",
        source: "birds",
        paint: {
          "fill-color": [
            "step",
            ["get", "DN"],
            "#ffffff",
            139, // 0-139: white
            "#ffcc99",
            185, // 140-185: light orange
            "#ff9933",
            208, // 186-208: orange
            "#ff6600",
            230, // 209-230: deep orange
            "#cc3300", // 230-231: red
          ],
          "fill-opacity": 0.8,
        },
        layout: {
          visibility: "none", // visibility off by default
        },
      });

      // toggle birds
      const birdsToggleContainer = d3
        .select("body")
        .append("div")
        .style("position", "absolute")
        .style("top", "375px")
        .style("right", "5px")
        .style("z-index", "1000");

      const birdsButton = birdsToggleContainer
        .append("img")
        .attr("src", "images/bird.svg")
        .attr("alt", "Birds")
        .style("margin", "5px")
        .style("padding", "5px")
        .style("cursor", "pointer")
        .style("width", "30px")
        .style("height", "30px")
        .style("border", "0px solid #ccc")
        .style("border-radius", "50%")
        .style("background-color", "#fd5e53")
        .style("filter", "brightness(30%)") // Start as greyed out
        .on("click", () => {
          const visibility = map.getLayoutProperty("birds-layer", "visibility");
          if (visibility === "visible") {
            map.setLayoutProperty("birds-layer", "visibility", "none");
            birdsButton.style("filter", "brightness(30%)"); // Greyed out
            // Hide legend
            birdsLegend.style("display", "none");
          } else {
            map.setLayoutProperty("birds-layer", "visibility", "visible");
            birdsButton.style("filter", "brightness(100%)"); // Coloured
            // Only show legend if not on mobile
            handleResponsiveLegend();
          }
        });
      
      // birds legend with continuous gradient
      const birdsLegend = d3
        .select("body")
        .append("div")
        .attr("id", "birds-legend")
        .style("position", "absolute")
        .style("bottom", "110px")
        .style("left", "255px")
        .style("padding", "10px")
        .style("border-radius", "5px")
        .style("box-shadow", "0 0 10px rgba(0,0,0,0.1)")
        .style("z-index", "1000")
        .style("display", "none")
        .style("font-size", "12px")
        .style("max-width", "200px");

      // legend title
      birdsLegend
        .append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "10px")
        .style("font-size", "12px")
        .style("color", "#ffffff")
        .style("letter-spacing", "2px")
        .text("BIRDS PRESENCE");

      const birdsGradientContainer = birdsLegend
        .append("div")
        .style("position", "relative")
        .style("width", "100%")
        .style("height", "25px");
        
      birdsGradientContainer
        .append("div")
        .style("width", "200px")
        .style("height", "10px")
        .style("background", "linear-gradient(to right, #ffffff, #ffcc99, #ff9933, #ff6600, #cc3300)")
        .style("border-radius", "2px")
        .style("margin-bottom", "10px")
        .style("border", "1px solid #ccc")
        .style("position", "relative");

      // Min label
      birdsGradientContainer
        .append("div")
        .style("position", "absolute")
        .style("top", "15px")
        .style("left", "0")
        .style("color", "#ffffff")
        .style("font-size", "10px")
        .text("Low");

      // Max label
      birdsGradientContainer
        .append("div")
        .style("position", "absolute")
        .style("top", "15px")
        .style("right", "-20px")
        .style("color", "#ffffff")
        .style("font-size", "10px")
        .text("High");
        
      // Function to handle responsive behavior for the legend
      const handleResponsiveLegend = () => {
        // If we're on mobile, hide the legend regardless of layer visibility
        if (window.innerWidth <= 768) {
          birdsLegend.style("display", "none");
        } 
        // If we're on desktop and the layer is visible, show the legend
        else if (map.getLayoutProperty("birds-layer", "visibility") === "visible") {
          birdsLegend.style("display", "block");
        }
      };
      
      // Call on window resize
      window.addEventListener("resize", handleResponsiveLegend);
      
      // Initial call
      handleResponsiveLegend();

      // hover description
      const birdsDescription = d3
        .select("body")
        .append("div")
        .style("position", "absolute")
        .style("padding", "7px")
        .style("background-color", "white")
        .style("border", "0px solid #ccc")
        .style("border-radius", "20px")
        .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
        .style("font-size", "14px")
        .style("color", "#333")
        .style("display", "none")
        .style("top", "380px")
        .style("right", "50px")
        .text("Show Birds");

      birdsButton
        .on("mouseover", () => {
          birdsDescription.style("display", "block");
        })
        .on("mouseout", () => {
          birdsDescription.style("display", "none");
        });
    })
    .catch((error) => console.error("Error loading GeoJSON (birds_vect.geojson):", error));
});

map.on("style.load", () => {
  // mammals_vect1.geojson classify into 5 classes - purple
  fetch("data/mammals_vect1.geojson")
    .then((response) => response.json())
    .then((data) => {
      map.addSource("mammals", {
        type: "geojson",
        data: data,
      });

      map.addLayer({
        id: "mammals-layer",
        type: "fill",
        source: "mammals",
        paint: {
          "fill-color": [
            "step",
            ["get", "DN"],
            "#f2e6ff",
            0, // Light purple
            "#d9b3ff",
            10, // Soft purple
            "#bf80ff",
            14, // Medium purple
            "#a64dff",
            17, // Deep purple
            "#800080", // Dark purple
          ],
          "fill-opacity": 0.4,
        },
        layout: {
          visibility: "none", // visibility off by default
        },
      });

      // toggle mammals
      const mammalsToggleContainer = d3
        .select("body")
        .append("div")
        .style("position", "absolute")
        .style("top", "415px")
        .style("right", "5px")
        .style("z-index", "1000");

      const mammalsButton = mammalsToggleContainer
        .append("img")
        .attr("src", "images/mammals.svg")
        .attr("alt", "Mammals")
        .style("margin", "5px")
        .style("padding", "5px")
        .style("cursor", "pointer")
        .style("width", "30px")
        .style("height", "30px")
        .style("border", "0px solid #ccc")
        .style("border-radius", "50%")
        .style("background-color", "#800080")
        .style("filter", "brightness(30%)") // Start as greyed out
        .on("click", () => {
          const visibility = map.getLayoutProperty("mammals-layer", "visibility");
          if (visibility === "visible") {
            map.setLayoutProperty("mammals-layer", "visibility", "none");
            mammalsButton.style("filter", "brightness(30%)"); // Greyed out
            // Hide legend
            mammalsLegend.style("display", "none");
          } else {
            map.setLayoutProperty("mammals-layer", "visibility", "visible");
            mammalsButton.style("filter", "brightness(100%)"); // Coloured
            // Only show legend if not on mobile
            handleResponsiveLegend();
          }
        });
      
      // mammals legend with continuous gradient
      const mammalsLegend = d3
        .select("body")
        .append("div")
        .attr("id", "mammals-legend")
        .style("position", "absolute")
        .style("bottom", "110px")
        .style("left", "500px")
        .style("padding", "10px")
        .style("border-radius", "5px")
        .style("box-shadow", "0 0 10px rgba(0,0,0,0.1)")
        .style("z-index", "1000")
        .style("display", "none")
        .style("font-size", "12px")
        .style("max-width", "200px");

      // legend title
      mammalsLegend
        .append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "10px")
        .style("font-size", "12px")
        .style("color", "#ffffff")
        .style("letter-spacing", "2px")
        .text("MAMMALS PRESENCE");

      const mammalsGradientContainer = mammalsLegend
        .append("div")
        .style("position", "relative")
        .style("width", "100%")
        .style("height", "25px");
        
      mammalsGradientContainer
        .append("div")
        .style("width", "200px")
        .style("height", "10px")
        .style("background", "linear-gradient(to right, #f2e6ff, #d9b3ff, #bf80ff, #a64dff, #800080)")
        .style("border-radius", "2px")
        .style("margin-bottom", "10px")
        .style("border", "1px solid #ccc")
        .style("position", "relative");

      // Min label
      mammalsGradientContainer
        .append("div")
        .style("position", "absolute")
        .style("top", "15px")
        .style("left", "0")
        .style("color", "#ffffff")
        .style("font-size", "10px")
        .text("Low");

      // Max label
      mammalsGradientContainer
        .append("div")
        .style("position", "absolute")
        .style("top", "15px")
        .style("right", "-20px")
        .style("color", "#ffffff")
        .style("font-size", "10px")
        .text("High");
        
      // Function to handle responsive behavior for the legend
      const handleResponsiveLegend = () => {
        // If we're on mobile, hide the legend regardless of layer visibility
        if (window.innerWidth <= 768) {
          mammalsLegend.style("display", "none");
        } 
        // If we're on desktop and the layer is visible, show the legend
        else if (map.getLayoutProperty("mammals-layer", "visibility") === "visible") {
          mammalsLegend.style("display", "block");
        }
      };
      
      // Call on window resize
      window.addEventListener("resize", handleResponsiveLegend);
      
      // Initial call
      handleResponsiveLegend();

      // hover description
      const mammalsDescription = d3
        .select("body")
        .append("div")
        .style("position", "absolute")
        .style("padding", "7px")
        .style("background-color", "white")
        .style("border", "0px solid #ccc")
        .style("border-radius", "20px")
        .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
        .style("font-size", "14px")
        .style("color", "#333")
        .style("display", "none")
        .style("top", "420px")
        .style("right", "50px")
        .text("Show Mammals");

      mammalsButton
        .on("mouseover", () => {
          mammalsDescription.style("display", "block");
        })
        .on("mouseout", () => {
          mammalsDescription.style("display", "none");
        });
    })
    .catch((error) => console.error("Error loading GeoJSON (mammals_vect1.geojson):", error));
});

// country's key connectivity infrastructure
const CountryGeojson = [
  "data/th/hotosm_tha_airports_points_geojson.geojson",
  "data/th/hotosm_tha_railways_lines_geojson.geojson",
  "data/th/hotosm_tha_sea_ports_points_geojson.geojson",

  "data/bn/hotosm_brn_airports_points_geojson.geojson",
  "data/bn/hotosm_brn_railways_lines_geojson.geojson",
  "data/bn/hotosm_brn_sea_ports_points_geojson.geojson",

  "data/id/hotosm_idn_airports_points_geojson.geojson",
  "data/id/hotosm_idn_railways_lines_geojson.geojson",
  "data/id/hotosm_idn_sea_ports_points_geojson.geojson",

  "data/kh/hotosm_khm_airports_points_geojson.geojson",
  "data/kh/hotosm_khm_railways_lines_geojson.geojson",
  "data/kh/hotosm_khm_sea_ports_points_geojson.geojson",

  "data/la/hotosm_lao_airports_points_geojson.geojson",
  "data/la/hotosm_lao_railways_lines_geojson.geojson",
  "data/la/hotosm_lao_sea_ports_points_geojson.geojson",

  "data/mm/hotosm_mmr_airports_points_geojson.geojson",
  "data/mm/hotosm_mmr_railways_lines_geojson.geojson",
  "data/mm/hotosm_mmr_sea_ports_points_geojson.geojson",

  "data/my/hotosm_mys_airports_points_geojson.geojson",
  "data/my/hotosm_mys_railways_lines_geojson.geojson",
  "data/my/hotosm_mys_sea_ports_points_geojson.geojson",

  "data/ph/hotosm_phl_airports_points_geojson.geojson",
  "data/ph/hotosm_phl_railways_lines_geojson.geojson",
  "data/ph/hotosm_phl_sea_ports_points_geojson.geojson",

  "data/pw/hotosm_plw_airports_points_geojson.geojson",
  "data/pw/hotosm_plw_sea_ports_points_geojson.geojson",

  "data/sg/hotosm_sgp_airports_points_geojson.geojson",
  "data/sg/hotosm_sgp_sea_ports_points_geojson.geojson",

  "data/tl/hotosm_tls_airports_points_geojson.geojson",
  "data/tl/hotosm_tls_sea_ports_points_geojson.geojson",

  "data/vn/hotosm_vnm_airports_points_geojson.geojson",
  "data/vn/hotosm_vnm_railways_lines_geojson.geojson",
  "data/vn/hotosm_vnm_sea_ports_points_geojson.geojson",
];

map.on("style.load", () => {
  CountryGeojson.forEach((file) => {
    fetch(file)
      .then((response) => response.json())
      .then((geojson) => {
        map.addSource(file, {
          type: "geojson",
          data: geojson,
        });

        const isLine = file.includes("railways") || file.includes("roads");
        const layerType = isLine ? "line" : "circle";

        const paintOptions = file.includes("sea_ports")
          ? {
              "circle-radius": 4,
              "circle-color": "#0000ff", // blue for seaports
              "circle-opacity": 0.1,
            }
          : file.includes("airports")
          ? {
              "circle-radius": 4,
              "circle-color": "#ffff00", // Yellow for airports
              "circle-opacity": 0.2,
            }
          : file.includes("railways")
          ? {
              "line-color": "#ff0000", // Red for railways
              "line-width": 3,
              "line-opacity": 0.5,
            }
          : {};

        map.addLayer({
          id: `${file}-layer`,
          type: layerType,
          source: file,
          paint: paintOptions,
        });
      })
      .catch((error) => {
        console.error(`Failed to load ${file}:`, error);
        if (error.message.includes("404")) {
          console.error(`File not found: ${file}. Please check the file path.`);
        }
      });
  });
}); // separate into differnt toggles - airport / rail / seaport svg

// Spatial GDP — was a private Mapbox raster tileset. Now a fill layer
// over the same grid_final.geojson source as the population layer, with
// a different (peach) ramp matching the original "#FFDFBF" tint.
map.on("load", function () {
  const layerId = "gdp-raster-layer";

  if (!map.getSource("population-grid-src")) {
    map.addSource("population-grid-src", {
      type: "geojson",
      data: "data/preCal/grid_final.geojson",
    });
  }

  map.addLayer({
    id: layerId,
    type: "fill",
    source: "population-grid-src",
    // Same gdp >= 30 filter as the population layer — render only the cells
    // that have meaningful values, ~5× perf on toggle.
    filter: [">=", ["get", "gdp"], 30],
    paint: {
      "fill-color": [
        "interpolate", ["linear"], ["get", "gdp"],
        0, "rgba(0,0,0,0)",
        50, "#fff0e0",
        150, "#FFDFBF",
        500, "#e8b07b",
        1500, "#d18a4f",
        5000, "#a86329",
      ],
      "fill-opacity": 0.55,
    },
    layout: {
      visibility: "none",
    },
  });

  // toggle spatial GDP
  const toggleContainer = d3
    .select("body")
    .append("div")
    .style("position", "absolute")
    .style("top", "505px") // Fixed position for the toggle
    .style("right", "5px")
    .style("z-index", "1000");

  const toggleButton = toggleContainer
    .append("img")
    .attr("src", "images/gdp.svg")
    .attr("alt", "Spatial GDP Per Capita PPP")
    .style("margin", "5px")
    .style("padding", "5px")
    .style("cursor", "pointer")
    .style("width", "30px")
    .style("height", "30px")
    .style("border", "0px solid #ccc")
    .style("border-radius", "50%")
    .style("background-color", "#ffffff")
    .style("filter", "brightness(30%)") // Start as greyed out
    .on("click", () => {
      const visibility = map.getLayoutProperty(layerId, "visibility");
      if (visibility === "visible") {
        map.setLayoutProperty(layerId, "visibility", "none");
        toggleButton.style("filter", "brightness(30%)"); // Greyed out
      } else {
        map.setLayoutProperty(layerId, "visibility", "visible");
        toggleButton.style("filter", "brightness(100%)"); // Coloured
      }
    });

  // hover description
  const descriptionWindow = d3
    .select("body")
    .append("div")
    .style("position", "absolute")
    .style("padding", "7px")
    .style("background-color", "white")
    .style("border", "0px solid #ccc")
    .style("border-radius", "20px")
    .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
    .style("font-size", "14px")
    .style("color", "#333")
    .style("display", "none")
    .style("top", "510px")
    .style("right", "50px")
    .text("Show Spatial GDP Per Capita PPP");

  toggleButton
    .on("mouseover", () => {
      descriptionWindow.style("display", "block");
    })
    .on("mouseout", () => {
      descriptionWindow.style("display", "none");
    });
});

// major cities
const majorCities = {
  type: "FeatureCollection",
  features: [
    // Indonesia
    {
      type: "Feature",
      properties: {
        name: "Jakarta",
        height: 300,
        country: "Indonesia",
        population: "10.56M",
      },
      geometry: { type: "Point", coordinates: [106.865, -6.1751] },
    },
    {
      type: "Feature",
      properties: {
        name: "Surabaya",
        height: 220,
        country: "Indonesia",
        population: "2.87M",
      },
      geometry: { type: "Point", coordinates: [112.7521, -7.2575] },
    },
    {
      type: "Feature",
      properties: {
        name: "Bandung",
        height: 200,
        country: "Indonesia",
        population: "2.4M",
      },
      geometry: { type: "Point", coordinates: [107.6186, -6.9175] },
    },
    {
      type: "Feature",
      properties: {
        name: "Medan",
        height: 180,
        country: "Indonesia",
        population: "2.1M",
      },
      geometry: { type: "Point", coordinates: [98.6722, 3.5952] },
    },
    {
      type: "Feature",
      properties: {
        name: "Nusantara",
        height: 250,
        country: "Indonesia",
        population: "0.2M",
      },
      geometry: { type: "Point", coordinates: [115.0, -1.0] },
    },

    // Thailand
    {
      type: "Feature",
      properties: {
        name: "Bangkok",
        height: 280,
        country: "Thailand",
        population: "8.3M",
      },
      geometry: { type: "Point", coordinates: [100.5018, 13.7563] },
    },
    {
      type: "Feature",
      properties: {
        name: "Chiang Mai",
        height: 150,
        country: "Thailand",
        population: "1.2M",
      },
      geometry: { type: "Point", coordinates: [98.9853, 18.7883] },
    },
    {
      type: "Feature",
      properties: {
        name: "Pattaya",
        height: 120,
        country: "Thailand",
        population: "1.1M",
      },
      geometry: { type: "Point", coordinates: [100.8834, 12.9236] },
    },

    // Philippines
    {
      type: "Feature",
      properties: {
        name: "Manila",
        height: 250,
        country: "Philippines",
        population: "1.78M",
      },
      geometry: { type: "Point", coordinates: [120.9842, 14.5995] },
    },
    {
      type: "Feature",
      properties: {
        name: "Cebu City",
        height: 170,
        country: "Philippines",
        population: "0.92M",
      },
      geometry: { type: "Point", coordinates: [123.8854, 10.3157] },
    },
    {
      type: "Feature",
      properties: {
        name: "Davao City",
        height: 160,
        country: "Philippines",
        population: "1.63M",
      },
      geometry: { type: "Point", coordinates: [125.6129, 7.0731] },
    },

    // Vietnam
    {
      type: "Feature",
      properties: {
        name: "Ho Chi Minh City",
        height: 240,
        country: "Vietnam",
        population: "8.4M",
      },
      geometry: { type: "Point", coordinates: [106.6297, 10.8231] },
    },
    {
      type: "Feature",
      properties: {
        name: "Hanoi",
        height: 230,
        country: "Vietnam",
        population: "7.7M",
      },
      geometry: { type: "Point", coordinates: [105.8342, 21.0278] },
    },
    {
      type: "Feature",
      properties: {
        name: "Da Nang",
        height: 140,
        country: "Vietnam",
        population: "1.1M",
      },
      geometry: { type: "Point", coordinates: [108.2022, 16.0544] },
    },

    // Malaysia
    {
      type: "Feature",
      properties: {
        name: "Kuala Lumpur",
        height: 210,
        country: "Malaysia",
        population: "1.8M",
      },
      geometry: { type: "Point", coordinates: [101.6869, 3.139] },
    },
    {
      type: "Feature",
      properties: {
        name: "Penang",
        height: 130,
        country: "Malaysia",
        population: "0.7M",
      },
      geometry: { type: "Point", coordinates: [100.3298, 5.4164] },
    },
    {
      type: "Feature",
      properties: {
        name: "Kuching",
        height: 130,
        country: "Malaysia",
        population: "0.7M",
      },
      geometry: { type: "Point", coordinates: [110.3522, 1.5533] },
    },

    // Singapore
    {
      type: "Feature",
      properties: {
        name: "Singapore",
        height: 270,
        country: "Singapore",
        population: "5.7M",
      },
      geometry: { type: "Point", coordinates: [103.8198, 1.3521] },
    },

    // Myanmar
    {
      type: "Feature",
      properties: {
        name: "Yangon",
        height: 190,
        country: "Myanmar",
        population: "5.2M",
      },
      geometry: { type: "Point", coordinates: [96.1951, 16.8409] },
    },
    {
      type: "Feature",
      properties: {
        name: "Mandalay",
        height: 140,
        country: "Myanmar",
        population: "1.3M",
      },
      geometry: { type: "Point", coordinates: [96.0833, 21.9831] },
    },

    // Cambodia
    {
      type: "Feature",
      properties: {
        name: "Phnom Penh",
        height: 160,
        country: "Cambodia",
        population: "2.1M",
      },
      geometry: { type: "Point", coordinates: [104.916, 11.5564] },
    },
    {
      type: "Feature",
      properties: {
        name: "Siem Reap",
        height: 90,
        country: "Cambodia",
        population: "0.2M",
      },
      geometry: { type: "Point", coordinates: [103.8509, 13.3671] },
    },

    // Laos
    {
      type: "Feature",
      properties: {
        name: "Vientiane",
        height: 120,
        country: "Laos",
        population: "0.8M",
      },
      geometry: { type: "Point", coordinates: [102.6331, 17.9757] },
    },
    {
      type: "Feature",
      properties: {
        name: "Luang Prabang",
        height: 70,
        country: "Laos",
        population: "0.05M",
      },
      geometry: { type: "Point", coordinates: [102.1353, 19.8834] },
    },

    // Brunei
    {
      type: "Feature",
      properties: {
        name: "Bandar Seri Begawan",
        height: 100,
        country: "Brunei",
        population: "0.1M",
      },
      geometry: { type: "Point", coordinates: [114.9403, 4.9031] },
    },

    // East Timor
    {
      type: "Feature",
      properties: {
        name: "Dili",
        height: 80,
        country: "East Timor",
        population: "0.2M",
      },
      geometry: { type: "Point", coordinates: [125.5679, -8.5569] },
    },

    // Palau
    {
      type: "Feature",
      properties: {
        name: "Ngerulmud",
        height: 50,
        country: "Palau",
        population: "0.01M",
      },
      geometry: { type: "Point", coordinates: [134.6232, 7.5] },
    },
    {
      type: "Feature",
      properties: {
        name: "Koror",
        height: 20,
        country: "Palau",
        population: "0.02M",
      },
      geometry: { type: "Point", coordinates: [134.4822, 7.3669] },
    },
  ],
};

map.on("load", () => {
  map.addSource("majorCities", {
    type: "geojson",
    data: majorCities,
  });

  // City labels with the leader-line "needle" effect.
  // Original used `filter: [">=", ["pitch"], 60]` to only show at high tilt;
  // MapLibre 4 doesn't support `["pitch"]` as a filter input, so we drop
  // that condition and rely only on zoom (≤ 8 = wide regional view).
  // text-pitch-alignment: viewport keeps labels upright as the globe rotates.
  map.addLayer({
    id: "major-cities-high-pitch",
    type: "symbol",
    source: "majorCities",
    layout: {
      "text-field": ["get", "name"],
      // MapLibre 4 requires an explicit text-font (Mapbox GL had a fallback;
      // MapLibre doesn't, so without this the labels render invisibly).
      // OpenFreeMap's glyph server serves Noto Sans.
      "text-font": ["Noto Sans Regular"],
      "text-size": 13,
      "text-offset": [0, -1.2],
      "text-anchor": "bottom",
      "text-pitch-alignment": "viewport",
      "text-rotation-alignment": "viewport",
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#ffe8a8",
      "text-halo-color": "#000000",
      "text-halo-width": 1.5,
    },
    filter: ["<=", ["zoom"], 8],
  });
});

//indexes processing
function normalize(value, min, max) {
  return (value - min) / (max - min);
}

function invertScore(score) {
  return 1 - score;
}

// dividers
const divider = document.createElement("img");
divider.src = "images/divider.svg";
divider.alt = "Pinpoint Origin";
divider.style.position = "absolute";
divider.style.top = "310px";
divider.style.right = "5px";
divider.style.zIndex = "2000";
divider.style.cursor = "pointer";
divider.style.width = "40px";
divider.style.height = "40px";
divider.style.borderRadius = "50%";
divider.style.backgroundColor = "none";
divider.style.padding = "0px";
divider.style.opacity = "0.8";
document.body.appendChild(divider);

const divider1 = document.createElement("img");
divider1.src = "images/divider.svg";
divider1.alt = "Pinpoint Origin";
divider1.style.position = "absolute";
divider1.style.top = "440px";
divider1.style.right = "5px";
divider1.style.zIndex = "2000";
divider1.style.cursor = "pointer";
divider1.style.width = "40px";
divider1.style.height = "40px";
divider1.style.borderRadius = "50%";
divider1.style.backgroundColor = "none";
divider1.style.padding = "0px";
divider1.style.opacity = "0.8";
document.body.appendChild(divider1);

// intro dialog window
window.addEventListener("load", () => {
  const dialogContainer = document.createElement("div");
  dialogContainer.style.position = "fixed";
  dialogContainer.style.top = "0";
  dialogContainer.style.left = "0";
  dialogContainer.style.width = "100%";
  dialogContainer.style.height = "100%";
  dialogContainer.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  dialogContainer.style.zIndex = "2002";
  dialogContainer.style.display = "flex";
  dialogContainer.style.justifyContent = "center";
  dialogContainer.style.alignItems = "center";
  dialogContainer.style.padding = "20px";
  dialogContainer.style.boxSizing = "border-box";
  dialogContainer.style.overflowY = "auto";
  
  // Mobile responsiveness adjustments
  if (window.innerWidth <= 768) {
    dialogContainer.style.alignItems = "flex-start";
    dialogContainer.style.paddingTop = "60px";
  }
  
  // Update dialog positioning on resize
  window.addEventListener("resize", () => {
    if (window.innerWidth <= 768) {
      dialogContainer.style.transform = "translateX(-50%) scale(0.3)";
    } else {
      dialogContainer.style.transform = "translateX(-50%)";
    }
  });

  const dialogBox = document.createElement("div");
  dialogBox.style.backgroundColor = "white";
  dialogBox.style.padding = "20px";
  dialogBox.style.opacity = 0.9;
  dialogBox.style.borderRadius = "10px";
  dialogBox.style.boxShadow = "0px 4px 10px rgba(0, 0, 0, 0.3)";
  dialogBox.style.textAlign = "center";
  dialogBox.style.maxWidth = "520px";
  dialogBox.style.border = "1px solid white";
  dialogBox.style.width = "100%"; // Ensure it uses available width

  const dialogTitle = document.createElement("h1");
  dialogTitle.textContent = "Trains, Lanes, and Data Grains!";
  dialogTitle.style.marginTop = "10px";
  dialogTitle.style.marginBottom = "15px";
  dialogTitle.style.marginLeft = "13px";
  dialogTitle.style.marginRight = "13px";
  dialogTitle.style.fontSize = "30px";
  dialogTitle.style.textAlign = "left";
  dialogTitle.style.color = "orange";
  dialogTitle.style.lineHeight = "1.2";
  dialogTitle.style.fontWeight = "bold";
  dialogBox.appendChild(dialogTitle);

  const dialogsubTitle = document.createElement("h2");
  dialogsubTitle.textContent = "Mapping Southeast Asia's Future";
  dialogsubTitle.style.marginBottom = "30px";
  dialogsubTitle.style.marginLeft = "13px";
  dialogsubTitle.style.textAlign = "left";
  dialogsubTitle.style.fontSize = "16px";
  dialogsubTitle.style.color = "grey";
  dialogBox.appendChild(dialogsubTitle);

  const dialogMessage = document.createElement("p");
  dialogMessage.innerHTML =
    "Welcome to the Rail Feasibility Mapper!<br>This tool allows you to explore and evaluate rail feasibility based on various indexes and criteria specific to Southeast Asia.<br><br>Using the tools provided, you can pinpoint an origin-destination pair, calculate said routes, toggle layer visibility, control level of influence of the indexes and analyze the feasibility of your connectivity project in the final result.<br><br>Let's map the future of Southeast Asia together!";
  dialogMessage.style.fontSize = "14px";
  dialogMessage.style.color = "black";
  dialogMessage.style.marginLeft = "13px";
  dialogMessage.style.marginRight = "13px";
  dialogMessage.style.lineHeight = "1.5";
  dialogMessage.style.textAlign = "justify";
  dialogMessage.style.marginBottom = "20px";
  dialogBox.appendChild(dialogMessage);


  // Container for fine print, dots, and arrow button
  const dialogFooter = document.createElement("div");
  dialogFooter.style.display = "flex";
  dialogFooter.style.justifyContent = "space-between";
  dialogFooter.style.alignItems = "center";
  dialogFooter.style.marginTop = "20px";

  // Fine print
  const finePrint = document.createElement("p");
  finePrint.textContent =
    "For the best performance, use this app on a desktop. While it may work on mobile devices, some features are optimized for larger screens and keyboard/mouse interactions. Outcomes should not be considered definitive endorsements or rejections of any rail project.";
  finePrint.style.fontSize = "8px";
  finePrint.style.color = "grey";
  finePrint.style.lineHeight = "1.5";
  finePrint.style.textAlign = "left";
  finePrint.style.marginLeft = "13px";
  finePrint.style.maxWidth = "66%"; // Set max width to 2/3 of the container
  dialogFooter.appendChild(finePrint);

  // Dots for page indicator
  const pageIndicator = document.createElement("div");
  pageIndicator.style.display = "flex";
  pageIndicator.style.justifyContent = "left";
  pageIndicator.style.alignItems = "center";
  pageIndicator.style.gap = "7px";
  pageIndicator.style.marginTop = "25px";
  pageIndicator.style.marginLeft = "12px";

  const dots = [];
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("div");
    dot.style.width = "6px";
    dot.style.height = "6px";
    dot.style.borderRadius = "50%";
    dot.style.backgroundColor = i === 0 ? "orange" : "lightgrey"; // Highlight the first dot
    dots.push(dot);
    pageIndicator.appendChild(dot);
  }
  dialogBox.appendChild(pageIndicator);

  // Back button
  const backButton = document.createElement("img");
  backButton.src = "images/arrow.svg";
  backButton.style.transform = "rotate(180deg)";
  backButton.alt = "Previous Page";
  backButton.style.padding = "10px";
  backButton.style.border = "none";
  backButton.style.borderRadius = "50%";
  backButton.style.backgroundColor = "lightgrey";
  backButton.style.marginBottom = "10px";
  backButton.style.marginLeft = "10px";
  backButton.style.opacity = 1;
  backButton.style.cursor = "pointer";
  backButton.style.width = "40px";
  backButton.style.height = "40px";
  dialogFooter.appendChild(backButton);

  // Arrow button
  const okButton = document.createElement("img");
  okButton.src = "images/arrow.svg";
  okButton.alt = "Next Page";
  okButton.style.padding = "15px";
  okButton.style.border = "none";
  okButton.style.borderRadius = "50%";
  okButton.style.backgroundColor = "orange";
  okButton.style.marginBottom = "10px";
  okButton.style.marginRight = "10px";
  okButton.style.opacity = 1;
  okButton.style.cursor = "pointer";
  okButton.style.width = "60px";
  okButton.style.height = "60px";
  dialogFooter.appendChild(okButton);

  dialogBox.appendChild(dialogFooter);

  dialogContainer.appendChild(dialogBox);
  document.body.appendChild(dialogContainer);

  // Back button functionality
  backButton.addEventListener("click", () => {
    if (currentPage === 2) {
      // Define page1Content to go back to page 1
      const page1Content = () => {
        dialogTitle.textContent = "Trains, Lanes, and Data Grains!";
        dialogsubTitle.textContent = "Mapping Southeast Asia's Future";
        dialogMessage.innerHTML =
          "Welcome to the Rail Feasibility Mapper!<br>This tool allows you to explore and evaluate rail feasibility based on various indexes and criteria specific to Southeast Asia.<br><br>Using the tools provided, you can pinpoint an origin-destination pair, calculate said routes, toggle layer visibility, control level of influence of the indexes and analyze the feasibility of your connectivity project in the final result.<br><br>Let's map the future of Southeast Asia together!";
        okButton.alt = "Next Page";

        // Update dots
        dots.forEach((dot, index) => {
          dot.style.backgroundColor = index === 0 ? "orange" : "lightgrey";
        });

        // back button grey page 1
        backButton.style.backgroundColor = "lightgrey";
      };

      page1Content();
      currentPage--;
    } else if (currentPage === 3) {
      page2Content();
      currentPage--;
    }
  });

  // Page 2
  const page2Content = () => {
    dialogTitle.textContent = "Explore Criteria of Feasibility";
    dialogsubTitle.textContent = "Move the Cursor Over Each Icon to Reveal the Criteria.";
    
    // Scale factor based on dialog width
    const containerWidth = dialogBox.clientWidth;
    const scale = Math.min(1, containerWidth / 520); // Scale relative to the design width
    
    // Container for icons with scaling
    const iconContainer = document.createElement("div");
    iconContainer.style.transform = `scale(${scale})`;
    iconContainer.style.transformOrigin = "center center";
    iconContainer.style.margin = "20px auto";
    iconContainer.style.width = "100%";
    
    iconContainer.innerHTML = `
      <style>
        @media (max-width: 768px) {
          .icons-grid-container {
            transform: scale(1.3);
            transform-origin: center center;
            margin: 0 auto;
            width: 100% !important;
            justify-content: center !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
          }
        }
      </style>
      <div class="icons-grid-container" style="display: flex; justify-content: space-between; gap: 10px; margin-top: 50px; margin-bottom: 50px;">
        <div style="display: flex; flex-direction: column; gap: 44px;">
          <div class="floating-icon" style="width: 60px; height: 60px; border-radius: 50%; background-color: #6dbefe; display: flex; justify-content: center; align-items: center;">
            <img src="images/tsunami.svg" alt="Tsunami" style="width: 30px; height: 30px;">
          </div>
          <div class="floating-icon" style="width: 60px; height: 60px; border-radius: 50%; background-color: #f67a0a; display: flex; justify-content: center; align-items: center;">
            <img src="images/quake.svg" alt="Earthquake" style="width: 30px; height: 30px;">
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 34px;">
          <div class="floating-icon2" style="width: 60px; height: 60px; border-radius: 50%; background-color: #4181f2; display: flex; justify-content: center; align-items: center;">
            <img src="images/coast.svg" alt="Coastline" style="width: 30px; height: 30px;">
          </div>
          <div class="floating-icon" style="width: 60px; height: 60px; border-radius: 50%; background-color: #00be9d; display: flex; justify-content: center; align-items: center;">
            <img src="images/humidity.svg" alt="Humidity" style="width: 30px; height: 30px;">
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 42px;">
          <div class="floating-icon" style="width: 60px; height: 60px; border-radius: 50%; background-color: #268723; display: flex; justify-content: center; align-items: center;">
            <img src="images/tree.svg" alt="Forest" style="width: 30px; height: 30px;">
          </div>
          <div class="floating-icon2" style="width: 60px; height: 60px; border-radius: 50%; background-color: #cbaa2f; display: flex; justify-content: center; align-items: center;">
            <img src="images/amphibians.svg" alt="Amphibians" style="width: 30px; height: 30px;">
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 22px;">
          <div class="floating-icon2" style="width: 60px; height: 60px; border-radius: 50%; background-color: #ff6056; display: flex; justify-content: center; align-items: center;">
            <img src="images/bird.svg" alt="Birds" style="width: 30px; height: 30px;">
          </div>
          <div class="floating-icon2" style="width: 60px; height: 60px; border-radius: 50%; background-color: #840079; display: flex; justify-content: center; align-items: center;">
            <img src="images/mammals.svg" alt="Mammals" style="width: 30px; height: 30px;">
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 40px;">
          <div class="floating-icon2" style="width: 60px; height: 60px; border-radius: 50%; background-color: #d2e531; display: flex; justify-content: center; align-items: center;">
            <img src="images/population2.svg" alt="Spatial Population" style="width: 30px; height: 30px; filter: invert(100%);">
          </div>
          <div class="floating-icon" style="width: 60px; height: 60px; border-radius: 50%; 
          background-color: #ffb972; display: flex; justify-content: center; align-items: center;">
            <img src="images/gdp.svg" alt="Spatial GDP" style="width: 30px; height: 30px; filter: invert(100%);">
          </div>
        </div>
      </div>
    `;
    
    dialogMessage.innerHTML = '';
    dialogMessage.appendChild(iconContainer);

    // Hover descriptions for each icon
    const icons = [
      { selector: "img[alt='Tsunami']", description: "Historical Tsunamis" },
      {
        selector: "img[alt='Earthquake']",
        description: "Historical Earthquakes",
      },
      { selector: "img[alt='Coastline']", description: "Coastline Proximity" },
      { selector: "img[alt='Humidity']", description: "Humidity Levels" },
      { selector: "img[alt='Forest']", description: "Forest Coverage" },
      { selector: "img[alt='Amphibians']", description: "Amphibians Presence" },
      { selector: "img[alt='Birds']", description: "Birds Presence" },
      { selector: "img[alt='Mammals']", description: "Mammals Presence" },
      {
        selector: "img[alt='Spatial Population']",
        description: "Spatial Population Density",
      },
      {
        selector: "img[alt='Spatial GDP']",
        description: "Spatial GDP Per Capita PPP",
      },
    ];

    let hoverEnabled = true;

    icons.forEach(({ selector, description }) => {
      const iconElements = document.querySelectorAll(selector);
      iconElements.forEach((icon) => {
        const hoverDescription = d3
          .select("body")
          .append("div")
          .style("position", "absolute")
          .style("padding", "7px")
          .style("background-color", "white")
          .style("border", "0px solid #ccc")
          .style("border-radius", "20px")
          .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
          .style("font-size", "14px")
          .style("z-index", "2003")
          .style("color", "#333")
          .style("display", "none")
          .text(description);

        icon.addEventListener("mouseover", (event) => {
          if (hoverEnabled) {
            hoverDescription
              .style("left", `${event.pageX + 10}px`)
              .style("top", `${event.pageY + 10}px`)
              .style("display", "block");
          }
        });

        icon.addEventListener("mouseout", () => {
          hoverDescription.style("display", "none");
        });
      });
    });

    // dialog hover descriptions after closing the dialog
    okButton.addEventListener("click", () => {
      if (currentPage === 3) {
        hoverEnabled = false;
      }
    });
    okButton.alt = "Next Page";

    // Update dots
    dots.forEach((dot, index) => {
      dot.style.backgroundColor = index === 1 ? "orange" : "lightgrey";
    });

    // back button orange page 2
    backButton.style.backgroundColor = "orange";
  };

  // Page 3
  const page3Content = () => {
    dialogTitle.textContent = "Plot the Route!";
    dialogsubTitle.textContent = "Your Journey Begins Here.";
    
    // Scale factor based on dialog width
    const containerWidth = dialogBox.clientWidth;
    const scale = Math.min(1, containerWidth / 520); // Scale relative to the design width
    
    // Container for tutorial images with scaling
    const tutorialContainer = document.createElement("div");
    tutorialContainer.style.transform = `scale(${scale})`;
    tutorialContainer.style.transformOrigin = "center center";
    tutorialContainer.style.margin = "20px auto";
    tutorialContainer.style.width = "100%";
    
    tutorialContainer.innerHTML = `
      <style>
      @media (max-width: 768px) {
        .tutorial-container {
        transform: scale(1.2);
        transform-origin: center top;
        margin-bottom: 20px;
        }
      }
      </style>
      <div class="tutorial-container" style="display: flex; justify-content: center; align-items: center; gap: 30px; margin-top: 47px; margin-bottom: 47px;">
      <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
      <div class="floating-icon2" style="width: 110px; height: 110px; border-radius: 50%; display: flex; justify-content: center; align-items: center;">
      <img src="images/tut_location.svg" alt="Location Tutorial" style="width: 110px; height: 110px;">
      </div>
      <p style="font-size: 12px; color: #333; text-align: center; margin-top: 30px;">Set Origin-Destination</p>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
      <div class="floating-icon2" style="width: 110px; height: 110px; border-radius: 50%; display: flex; justify-content: center; align-items: center;">
      <img src="images/tut_draw.svg" alt="Draw Tutorial" style="width: 110px; height: 110px;">
      </div>
      <p style="font-size: 12px; color: #333; text-align: center; margin-top: 30px;">Calculate the Route</p>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
      <div class="floating-icon" style="width: 110px; height: 110px; border-radius: 50%; display: flex; justify-content: center; align-items: center;">
      <img src="images/tut_export.svg" alt="Export Tutorial" style="width: 110px; height: 110px;">
      </div>
      <p style="font-size: 12px; color: #333; text-align: center; margin-top: 30px;">Export the results!</p>
      </div>
      </div>
    `;
    
    dialogMessage.innerHTML = '';
    dialogMessage.appendChild(tutorialContainer);
    
    okButton.alt = "Let's Get to Work!";

    // Update dots
    dots.forEach((dot, index) => {
      dot.style.backgroundColor = index === 2 ? "orange" : "lightgrey";
    });

    // back button orange page 3
    backButton.style.backgroundColor = "orange";
  };

  let currentPage = 1;

  okButton.addEventListener("click", () => {
    if (currentPage === 1) {
      page2Content();
      currentPage++;
    } else if (currentPage === 2) {
      page3Content();
      currentPage++;
    } else {
      document.body.removeChild(dialogContainer);
    }
  });
});

//index - tsi - data query + score

// elevationScore from mapbox terrain - Low elevation (Below sea level or < 10 m above sea level) – Score < 0.33, Moderate elevation (10 m – 50 m) – Score ~ 0.34 - 0.66, High elevation (> 50 m) – Score 0.67 - 1.0

// Elevation lookup via the multi-source chain (Open-Elevation → Open-Meteo
// → Open-Topo-Data, all free / no key). Replaces Mapbox tilequery.
const getElevationAtPoint = async (coordinates) => {
  const arr = await __fetchElevations([coordinates]);
  return arr[0] || 0;
};

async function getElevationScore(coordinates) {
  const elevation = await getElevationAtPoint(coordinates); // Fetch elevation using Mapbox API
  let elevationScore;

  if (elevation < 0) {
    elevationScore = 0; // Negative elevation gets a score of 0
  } else if (elevation < 10) {
    elevationScore = elevation / 30; // Scale 0-10m to 0-0.33
  } else if (elevation <= 50) {
    elevationScore = 0.34 + ((elevation - 10) / 40) * 0.32; // Scale 10-50m to 0.34-0.66
  } else {
    elevationScore = 0.67 + ((elevation - 50) / 50) * 0.33; // Scale >50m to 0.67-1.0
    elevationScore = Math.min(elevationScore, 1.0); // Cap at 1.0
  }

  console.log(`Elevation: ${elevation}m, Elevation Score: ${elevationScore.toFixed(2)}`);
  return elevationScore;
}

// // Eg elevation Bangkok
// const bangkokCoordinates = [100.5018, 13.7563];
// getElevationScore(bangkokCoordinates).then(score => {
//   console.log(`Elevation Score for Bangkok: ${score.toFixed(2)}`);
// });

// coastlineScore from earth-coastlines.geo.json - > 10 km from Coast – Score ~ 0.67 - 1.0, 5 - 10 km from Coast – Score ~ 0.34 - 0.66, 0 - 5 km from Coast – Score < 0.33 + console log
async function getCoastlineScore(coordinates) {
  const coastlineData = await fetch("data/earth-coastlines.geo.json").then((res) => res.json());
  const point = turf.point(coordinates);
  let minDistance = Infinity;

  if (coastlineData && coastlineData.geometries) {
    coastlineData.geometries.forEach((geometry) => {
      if (geometry.type === "MultiPolygon") {
        geometry.coordinates.forEach((polygon) => {
          polygon.forEach((ring) => {
            ring.forEach((coord) => {
              const distance = turf.distance(point, turf.point(coord), {
                units: "kilometers",
              });
              minDistance = Math.min(minDistance, distance);
            });
          });
        });
      }
    });
  }

  console.log(`Distance to nearest coastline: ${minDistance.toFixed(2)} km`);

  // tabulate score based on distance
  let coastlineScore;
  if (minDistance > 10) {
    coastlineScore = 0.67 + (minDistance - 10) * 0.033; // Scale > 10 km
    coastlineScore = Math.min(coastlineScore, 1.0); // Cap at 1.0
  } else if (minDistance > 5) {
    coastlineScore = 0.34 + (minDistance - 5) * 0.066; // Scale 5-10 km
  } else {
    coastlineScore = minDistance * 0.066; // Scale 0-5 km
  }

  console.log(`Coastline Score: ${coastlineScore.toFixed(2)}`);
  return coastlineScore;
}

// // Eg coastline score Chiang Mai
// getCoastlineScore([98.9853, 18.7883]).then(coastlineScore => {
//   console.log(`Coastline Score for Chiang Mai: ${coastlineScore.toFixed(2)}`);
// });

// tsunamiScore - counts with 100km radius from tsunami.tsv mapped - Few Tsunami Count – Score ~ 0.67 - 1.0, Some Tsunami Count – Score ~ 0.34 - 0.66, Frequent Tsunamis – Score < 0.33 + console log
async function getTsunamiScore(coordinates) {
  const tsunamiData = await fetch("data/tsunami.tsv")
    .then((res) => res.text())
    .then((tsv) => d3.tsvParse(tsv));

  const point = turf.point(coordinates);
  const radius = 100; // 100 km radius
  const nearbyTsunamis = tsunamiData.filter((tsunami) => {
    const tsunamiPoint = turf.point([+tsunami.Longitude, +tsunami.Latitude]);
    const distance = turf.distance(point, tsunamiPoint, {
      units: "kilometers",
    });
    return distance <= radius;
  });

  const tsunamiCount = nearbyTsunamis.length;
  console.log(`Tsunami Count within 100km: ${tsunamiCount}`);

  // Tabulate score based on tsunami count
  let tsunamiScore;
  if (tsunamiCount <= 5) {
    tsunamiScore = 0.67 + (5 - tsunamiCount) * 0.066; // Scale 0-5 tsunamis
    tsunamiScore = Math.min(tsunamiScore, 1.0); // Cap at 1.0
  } else if (tsunamiCount <= 15) {
    tsunamiScore = 0.34 + (15 - tsunamiCount) * 0.033; // Scale 6-15 tsunamis
  } else {
    tsunamiScore = Math.max(0, 0.33 - (tsunamiCount - 15) * 0.033); // Scale >15 tsunamis
  }

  console.log(`Tsunami Score: ${tsunamiScore.toFixed(2)}`);
  return tsunamiScore;
}

// // Eg for tsunmai Score Manila
// getTsunamiScore([120.9842, 14.5995]).then(tsunamiScore => {
//   console.log(`Tsunami Score for Manila: ${tsunamiScore.toFixed(2)}`);
// });

// final tsi
function calculateTSI(elevationScore, coastlineScore, tsunamiScore) {
  return 0.2 * elevationScore + 0.4 * coastlineScore + 0.4 * invertScore(tsunamiScore);
}

// // Eg for Siem Reap
// const siemReapCoordinates = [103.8509, 13.3671];

// Promise.all([
//   getElevationScore(siemReapCoordinates),
//   getCoastlineScore(siemReapCoordinates),
//   getTsunamiScore(siemReapCoordinates)
// ]).then(([elevationScore, coastlineScore, tsunamiScore]) => {
//   const tsi = calculateTSI(elevationScore, coastlineScore, tsunamiScore);
//   console.log(`Tsunami Risk Index (TSI) for Siem Reap: ${tsi.toFixed(2)}`);
// });

//index - sdi - data query + score

// seismicScore - > 150 km Away – Score ~ 0.67 - 1.0, 50 - 150 km Away – Score ~ 0.34 - 0.66, 0 - 50 km Away – Score < 0.33
async function getSeismicScore(coordinates) {
  const earthquakeData = await fetch("data/worldQuakesMiles.json").then((res) => res.json());

  const point = turf.point(coordinates);
  const radius = 150; // 150 km radius
  const nearbyEarthquakes = earthquakeData.features.filter((earthquake) => {
    const earthquakePoint = turf.point(earthquake.geometry.coordinates);
    const distance = turf.distance(point, earthquakePoint, {
      units: "kilometers",
    });
    return distance <= radius;
  });

  const minDistance = nearbyEarthquakes.reduce((min, earthquake) => {
    const earthquakePoint = turf.point(earthquake.geometry.coordinates);
    const distance = turf.distance(point, earthquakePoint, {
      units: "kilometers",
    });
    return Math.min(min, distance);
  }, Infinity);

  console.log(`Minimum Distance to Earthquake: ${minDistance.toFixed(2)} km`);

  // Tabulate score based on distance
  let seismicScore;
  if (minDistance > 150) {
    seismicScore = 0.67 + (minDistance - 150) * 0.0022; // Scale > 150 km
    seismicScore = Math.min(seismicScore, 1.0); // Cap at 1.0
  } else if (minDistance > 50) {
    seismicScore = 0.34 + (minDistance - 50) * 0.0033; // Scale 50-150 km
  } else {
    seismicScore = Math.max(0, 0.33 - (50 - minDistance) * 0.0066); // Scale < 50 km
  }

  console.log(`Seismic Score: ${seismicScore.toFixed(2)}`);
  return seismicScore;
}

// // Eg seismic Score Dili
// getSeismicScore([125.5679, -8.5569]).then(seismicScore => {
//   console.log(`Seismic Score for Dili: ${seismicScore.toFixed(2)}`);
// });

// humidty score - High Humidity (> 80%) – Score < 0.33, Moderate Humidity (50% - 80%) – Score ~ 0.34 - 0.66, Low Humidity (< 50%) – Score 0.67 - 1.0

async function getHumidityScore(coordinates) {
  const humidityData = await fetch("data/avgHU_vect.geojson").then((res) => res.json());
  const point = turf.point(coordinates);

  let humidityValue = null;

  // Iterate through each feature to find the polygon containing the point
  for (const feature of humidityData.features) {
    if (turf.booleanPointInPolygon(point, feature)) {
      humidityValue = feature.properties.DN;
      break;
    }
  }

  if (humidityValue === null) {
    console.log("Point is not within any polygon.");
    return 0.0; // Default score if point is not found in any polygon
  }

  console.log(`Humidity Value: ${humidityValue}`);
  let humidityScore;
  humidityScore = 1.0 - humidityValue / 255; // Continuous scale from 0 to 255
  console.log(`Humidity Score: ${humidityScore.toFixed(2)}`);
  return humidityScore;
}

// // Eg humidity score for Hanoi
// getHumidityScore([105.8342, 21.0278]).then(humidityScore => {
//   console.log(`Humidity Score for Hanoi: ${humidityScore.toFixed(2)}`);
// });

// final sdi
function calculateSDI(seismicScore, elevationScore, coastlineScore, humidityScore) {
  return 0.4 * seismicScore + 0.25 * elevationScore + 0.2 * coastlineScore + 0.15 * invertScore(humidityScore);
}

// // sdi for hanoi
// const hanoiCoordinates = [105.8342, 21.0278];

// Promise.all([
//   getSeismicScore(hanoiCoordinates),
//   getElevationScore(hanoiCoordinates),
//   getCoastlineScore(hanoiCoordinates),
//   getHumidityScore(hanoiCoordinates)
// ]).then(([seismicScore, elevationScore, coastlineScore, humidityScore]) => {
//   const sdi = calculateSDI(seismicScore, elevationScore, coastlineScore, humidityScore);
//   console.log(`Structure Durability Index (SDI) for Hanoi: ${sdi.toFixed(2)}`);
// });

//index - e2i - data query + score

// landUseChange - Land Use Change < 10% – Score ~ 0.67 - 1.0, Land Use Change 10 - 25% – Score ~ 0.34 - 0.66, Land Use Change > 25% – Score < 0.33 - based on percentage of line intersecting with forest geojson
async function getLandUseChangeScore(route) {
  const forestData = await fetch("data/sea_forest_vect.geojson").then((res) => res.json());
  const routeLine = turf.lineString(route.coordinates);

  let totalIntersectLength = 0;
  let totalRouteLength = turf.length(routeLine, { units: "kilometers" });

  forestData.features.forEach((feature) => {
    const intersection = turf.lineIntersect(routeLine, feature);
    if (intersection.features.length > 0) {
      const intersectLine = turf.lineString(intersection.features.map((f) => f.geometry.coordinates));
      totalIntersectLength += turf.length(intersectLine, {
        units: "kilometers",
      });
    }
  });

  const landUseChangePercentage = (totalIntersectLength / totalRouteLength) * 100;
  console.log(`Land Use Change Percentage: ${landUseChangePercentage.toFixed(2)}%`);

  let landUseChangeScore;
  if (landUseChangePercentage <= 11) {
    landUseChangeScore = 1.0; // Max score for very light green
  } else if (landUseChangePercentage <= 29) {
    landUseChangeScore = 1.0 - ((landUseChangePercentage - 11) / 18) * (1.0 - 0.8); // Linear decrease from 1.0 to 0.8 between 12% and 29%
  } else if (landUseChangePercentage <= 47) {
    landUseChangeScore = 0.8 - ((landUseChangePercentage - 29) / 18) * (0.8 - 0.6); // Linear decrease from 0.8 to 0.6 between 30% and 47%
  } else if (landUseChangePercentage <= 104) {
    landUseChangeScore = 0.6 - ((landUseChangePercentage - 47) / 57) * (0.6 - 0.4); // Linear decrease from 0.6 to 0.4 between 48% and 104%
  } else {
    landUseChangeScore = Math.max(0.4 - ((landUseChangePercentage - 104) / 151) * 0.4, 0); // Further decrease beyond 104%
  }

  console.log(`Land Use Change Score: ${landUseChangeScore.toFixed(2)}`);
  return landUseChangeScore;
}

// // Land Use Change Score test jakarta Lat: -6.175394, Lng: 106.827183 TO bandung Lat: -6.913611, Lng: 107.61036
// const jakartaToBandungRoute = {
//   coordinates: [
//     [106.827183, -6.175394], // Jakarta
//     [107.61036, -6.913611],  // Bandung
//   ],
// };

// getLandUseChangeScore(jakartaToBandungRoute).then((landUseChangeScore) => {
//   console.log(`Land Use Change Score for Jakarta to Bandung: ${landUseChangeScore.toFixed(2)}`);
// });

// biodiversityScore - Biodiversity Impact < 10% – Score ~ 0.67 - 1.0, Biodiversity Impact 10 - 14% – Score ~ 0.34 - 0.66, Biodiversity Impact > 14% – Score < 0.33 - based on percentage of line intersecting with biodiversity 3x geojson

async function getMammalsScore(route) {
  const mammalsData = await fetch("data/mammals_vect1.geojson").then((res) => res.json());
  const routeLine = turf.lineString(route.coordinates);

  let totalIntersectLength = 0;
  let totalRouteLength = turf.length(routeLine, { units: "kilometers" });

  mammalsData.features.forEach((feature) => {
    const intersection = turf.lineIntersect(routeLine, feature);
    if (intersection.features.length > 0) {
      intersection.features.forEach((feature) => {
        if (feature.geometry && feature.geometry.type === "LineString") {
          const intersectLine = turf.lineString(feature.geometry.coordinates);
          totalIntersectLength += turf.length(intersectLine, {
            units: "kilometers",
          });
        }
      });
    }
  });

  const mammalsImpactPercentage = (totalIntersectLength / totalRouteLength) * 100;
  console.log(`Mammals Impact Percentage: ${mammalsImpactPercentage.toFixed(2)}%`);

  let mammalsScore;
  if (mammalsImpactPercentage <= 10) {
    mammalsScore = 1.0; // Max score for minimal impact
  } else if (mammalsImpactPercentage <= 30) {
    mammalsScore = 1.0 - ((mammalsImpactPercentage - 10) / 20) * (1.0 - 0.67); // Linear decrease from 1.0 to 0.67 between 10% and 30%
  } else if (mammalsImpactPercentage <= 50) {
    mammalsScore = 0.67 - ((mammalsImpactPercentage - 30) / 20) * (0.67 - 0.33); // Linear decrease from 0.67 to 0.33 between 30% and 50%
  } else {
    mammalsScore = Math.max(0.33 - ((mammalsImpactPercentage - 50) / 50) * 0.33, 0); // Further decrease beyond 50%
  }

  console.log(`Mammals Score: ${mammalsScore.toFixed(2)}`);
  return mammalsScore;
}

async function getBirdsScore(route) {
  const birdsData = await fetch("data/birds_vect.geojson").then((res) => res.json());
  const routeLine = turf.lineString(route.coordinates);

  let totalIntersectLength = 0;
  let totalRouteLength = turf.length(routeLine, { units: "kilometers" });

  birdsData.features.forEach((feature) => {
    const intersection = turf.lineIntersect(routeLine, feature);
    if (intersection.features.length > 0) {
      intersection.features.forEach((feature) => {
        if (feature.geometry && feature.geometry.type === "LineString") {
          const intersectLine = turf.lineString(feature.geometry.coordinates);
          totalIntersectLength += turf.length(intersectLine, {
            units: "kilometers",
          });
        }
      });
    }
  });

  const birdsImpactPercentage = (totalIntersectLength / totalRouteLength) * 100;
  console.log(`Birds Impact Percentage: ${birdsImpactPercentage.toFixed(2)}%`);

  let birdsScore;
  if (birdsImpactPercentage <= 10) {
    birdsScore = 1.0; // Max score for minimal impact
  } else if (birdsImpactPercentage <= 30) {
    birdsScore = 1.0 - ((birdsImpactPercentage - 10) / 20) * (1.0 - 0.67); // Linear decrease from 1.0 to 0.67 between 10% and 30%
  } else if (birdsImpactPercentage <= 50) {
    birdsScore = 0.67 - ((birdsImpactPercentage - 30) / 20) * (0.67 - 0.33); // Linear decrease from 0.67 to 0.33 between 30% and 50%
  } else {
    birdsScore = Math.max(0.33 - ((birdsImpactPercentage - 50) / 50) * 0.33, 0); // Further decrease beyond 50%
  }

  console.log(`Birds Score: ${birdsScore.toFixed(2)}`);
  return birdsScore;
}

async function getAmphibiansScore(route) {
  const amphibiansData = await fetch("data/amphibians_vect.geojson").then((res) => res.json());
  const routeLine = turf.lineString(route.coordinates);

  let totalIntersectLength = 0;
  let totalRouteLength = turf.length(routeLine, { units: "kilometers" });

  amphibiansData.features.forEach((feature) => {
    const intersection = turf.lineIntersect(routeLine, feature);
    if (intersection.features.length > 0) {
      intersection.features.forEach((feature) => {
        if (feature.geometry && feature.geometry.type === "LineString") {
          const intersectLine = turf.lineString(feature.geometry.coordinates);
          totalIntersectLength += turf.length(intersectLine, {
            units: "kilometers",
          });
        }
      });
    }
  });

  const amphibiansImpactPercentage = (totalIntersectLength / totalRouteLength) * 100;
  console.log(`Amphibians Impact Percentage: ${amphibiansImpactPercentage.toFixed(2)}%`);

  let amphibiansScore;
  if (amphibiansImpactPercentage <= 10) {
    amphibiansScore = 1.0; // Max score for minimal impact
  } else if (amphibiansImpactPercentage <= 30) {
    amphibiansScore = 1.0 - ((amphibiansImpactPercentage - 10) / 20) * (1.0 - 0.67); // Linear decrease from 1.0 to 0.67 between 10% and 30%
  } else if (amphibiansImpactPercentage <= 50) {
    amphibiansScore = 0.67 - ((amphibiansImpactPercentage - 30) / 20) * (0.67 - 0.33); // Linear decrease from 0.67 to 0.33 between 30% and 50%
  } else {
    amphibiansScore = Math.max(0.33 - ((amphibiansImpactPercentage - 50) / 50) * 0.33, 0); // Further decrease beyond 50%
  }

  console.log(`Amphibians Score: ${amphibiansScore.toFixed(2)}`);
  return amphibiansScore;
}

async function calculateBiodiversityImpactScore(route) {
  const [birdsScore, amphibiansScore, mammalsScore] = await Promise.all([
    getBirdsScore(route),
    getAmphibiansScore(route),
    getMammalsScore(route),
  ]);

  const biodiversityImpact = 1 - birdsScore + (1 - amphibiansScore) + (1 - mammalsScore);
  const biodiversityImpactPercentage = (biodiversityImpact / 3) * 100; // Normalize to percentage
  console.log(`Biodiversity Impact Percentage: ${biodiversityImpactPercentage.toFixed(2)}%`);

  let biodiversityScore;
  if (biodiversityImpactPercentage <= 10) {
    biodiversityScore = 1.0; // Max score for minimal impact
  } else if (biodiversityImpactPercentage <= 14) {
    biodiversityScore = 1.0 - ((biodiversityImpactPercentage - 10) / 4) * (1.0 - 0.67); // Linear decrease from 1.0 to 0.67 between 10% and 14%
  } else {
    biodiversityScore = Math.max(0.67 - ((biodiversityImpactPercentage - 14) / 86) * 0.67, 0); // Further decrease beyond 14%
  }

  console.log(`Biodiversity Impact Score: ${biodiversityScore.toFixed(2)}`);
  return biodiversityScore;
}

// // Biodiversity Score test jakarta Lat: -6.175394, Lng: 106.827183 TO bandung Lat: -6.913611, Lng: 107.61036
// const jakartaToBandungRoute = {
//   coordinates: [
//     [106.827183, -6.175394], // Jakarta
//     [107.61036, -6.913611],  // Bandung
//   ],
// };

// calculateBiodiversityImpactScore(jakartaToBandungRoute).then((biodiversityScore) => {
//   console.log(`Biodiversity Impact Score for Jakarta to Bandung: ${biodiversityScore.toFixed(2)}`);
// });

// final e2i
function calculateE2I(landUseChangeScore, biodiversityScore) {
  return 0.55 * invertScore(landUseChangeScore) + 0.45 * invertScore(biodiversityScore);
}

// // e2i for jakarta to bandung
// calculateBiodiversityImpactScore(jakartaToBandungRoute).then((biodiversityScore) => {
//   getLandUseChangeScore(jakartaToBandungRoute).then((landUseChangeScore) => {
//     const e2i = calculateE2I(landUseChangeScore, biodiversityScore);
//     console.log(`Environmental Impact Index (E2I) for Jakarta to Bandung: ${e2i.toFixed(2)}`);
//   });
// });

//index - opi - data query + score

// Elevation <5m or >50m - Score 0, Elevation between 5-10m - Linear increase from 0 to 1, Elevation between 10-50m - Score 1,Elevation between 50-60m - Linear decrease from 1 to 0; transition to undesirable, Elevation >60m - Score 0
async function getElevationScoreOPI(coordinates) {
  const elevation = await getElevationAtPoint(coordinates); // Fetch elevation using Mapbox API
  let elevationScoreOPI;

  if (elevation < 5 || elevation > 60) {
    elevationScoreOPI = 0; // Elevation <5m or >60m gets a score of 0
  } else if (elevation >= 5 && elevation < 10) {
    elevationScoreOPI = (elevation - 5) / 5; // Linear increase from 0 to 1 between 5m and 10m
  } else if (elevation >= 10 && elevation <= 50) {
    elevationScoreOPI = 1; // Score of 1 between 10m and 50m
  } else if (elevation > 50 && elevation <= 60) {
    elevationScoreOPI = 1 - (elevation - 50) / 10; // Linear decrease from 1 to 0 between 50m and 60m
  }

  console.log(`Elevation: ${elevation}m, Elevation Score: ${elevationScoreOPI.toFixed(2)}`);
  return elevationScoreOPI;
}

// //elevation test on Da Nang
// const daNangCoordinates = [108.2022, 16.0544];
// getElevationScore(daNangCoordinates).then(score => {
//   console.log(`Elevation Score for Da Nang: ${score.toFixed(2)}`);
// });

// get length of roads/railways from maptiler and get density of existing network(roads/railways) within 200km radius + score High Accessibility (> 5 km/km²) – Score < 0.33, Moderate Accessibility (1-5 km/km²) – Score ~ 0.34 - 0.66, Low Accessibility (<1 km/km²) – Score 0.67 - 1.0

// Function to add delays between requests (for throttling)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to compute network density score
function computeNetworkScore(density) {
  if (density > 0.5) return Math.max(0.33 - (density - 5) * 0.033, 0);
  if (density > 0.1) return 0.34 + (0.5 - density) * 0.066;
  return Math.min(0.67 + (0.1 - density) * 0.33, 1.0);
}

// Function to get network density score for each city
async function getNetworkDensityScore(coordinates, radius = 100) {
  const query = `
    [out:json][timeout:25];
    (
      way["highway"](around:${radius * 1000},${coordinates[1]},${coordinates[0]});
      way["railway"](around:${radius * 1000},${coordinates[1]},${coordinates[0]});
    );
    out geom qt 500;  // Limit the number of features returned per city
  `;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (!data.elements || data.elements.length === 0) {
      console.warn("No network data found.");
      return 0;
    }

    let totalRoadLength = 0;
    let totalRailwayLength = 0;

    data.elements.forEach((way) => {
      if (!way.geometry) return;
      const coords = way.geometry.map((p) => [p.lon, p.lat]);
      if (coords.length < 2) return;

      const line = turf.lineString(coords);
      const length = turf.length(line, { units: "kilometers" });

      if (way.tags && way.tags.highway) {
        totalRoadLength += length;
      } else if (way.tags && way.tags.railway) {
        totalRailwayLength += length;
      }
    });

    console.log(`Total Road Length: ${totalRoadLength.toFixed(2)} km`);
    console.log(`Total Railway Length: ${totalRailwayLength.toFixed(2)} km`);

    const area = Math.PI * Math.pow(radius, 2); // km²
    const density = (totalRoadLength + totalRailwayLength) / area;
    return computeNetworkScore(density);
  } catch (err) {
    console.error("Failed to fetch data:", err);
    return 0;
  }
}

// Function to process cities in smaller batches (with throttling)
async function processCitiesInBatches(cities, batchSize = 2, delayMs = 1000) {
  const results = [];

  for (let i = 0; i < cities.length; i++) {
    const { name, coordinates } = cities[i];
    console.log(`\nProcessing: ${name}`);
    const score = await getNetworkDensityScore(coordinates);
    results.push({ name, score: score.toFixed(2) });

    // Throttle requests
    if ((i + 1) % batchSize === 0 || i === cities.length - 1) {
      console.log(`Batch processed: ${i + 1}`);
      await sleep(delayMs); // Delay between batches
    }
  }

  return results;
}

// //test road rail density on sea cities
// const southeastAsiaCities = [
//   { name: "Ho Chi Minh City", coordinates: [106.6297, 10.8231] },
//   { name: "Bangkok", coordinates: [100.5018, 13.7563] },
//   { name: "Jakarta", coordinates: [106.8456, -6.2088] },
//   { name: "Manila", coordinates: [120.9842, 14.5995] },
//   { name: "Phnom Penh", coordinates: [104.8885, 11.5564] }
// ];

// // Process cities with smaller batches and throttling
// processCitiesInBatches(southeastAsiaCities, 2, 1500).then(results => {
//   console.table(results);
// });

// get shortest distance to urban centers + score Low Accessibility (> 50 km from urban center) – Score < 0.33, Moderate Accessibility (15 km - 50 km from urban center) – Score ~ 0.34 - 0.66, High Accessibility (< 15 km from urban center) – Score 0.67 - 1.0
async function getUrbanProximityScore(coordinates) {
  const urbanCenters = majorCities.features.map((city) => city.geometry.coordinates);
  let minDistance = Infinity;

  urbanCenters.forEach((center) => {
    const distance = turf.distance(turf.point(coordinates), turf.point(center), { units: "kilometers" });
    minDistance = Math.min(minDistance, distance);
  });

  console.log(`Shortest Distance to Urban Center: ${minDistance.toFixed(2)} km`);

  let urbanProximityScore;
  if (minDistance < 15) {
    urbanProximityScore = 0.67 + ((15 - minDistance) / 15) * 0.33; // Scale < 15 km
    urbanProximityScore = Math.min(urbanProximityScore, 1.0); // Cap at 1.0
  } else if (minDistance <= 50) {
    urbanProximityScore = 0.34 + ((50 - minDistance) / 35) * 0.33; // Scale 15-50 km
  } else {
    urbanProximityScore = Math.max(0, 0.33 - ((minDistance - 50) / 50) * 0.33); // Scale > 50 km
  }

  console.log(`Urban Proximity Score: ${urbanProximityScore.toFixed(2)}`);
  return urbanProximityScore;
}

// // Eg urban proximity score
// getUrbanProximityScore([99.797837, 1.578427]).then(score => {
//   console.log(`Urban Proximity Score for Paolan Halongonan, North Padang Lawas Regency, North Sumatra, Indonesia: ${score.toFixed(2)}`);
// });

// populationDensityScore from raster tile- Low Demand (<500 people/km²) – Score < 0.33, Moderate Demand (500-5,000 people/km²) – Score ~ 0.34 - 0.66, High Demand (>5,000 people/km²) – Score 0.67 - 1.0

//function for population count from raster tilesets
function getPopulationCount(color) {
  const rgb = color.match(/\d+/g);
  if (!rgb) return 0;

  const [r, g, b] = rgb.map(Number);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000; // calculate brightness

  // Map brightness to population count
  if (brightness < 100) {
    return 0; // Darkest, no one
  } else if (brightness < 150) {
    return 35;
  } else if (brightness < 200) {
    return 50;
  } else if (brightness < 250) {
    return 85;
  } else {
    return 110;
  }
}

async function getPopulationDensityScore(coordinates) {
  const zoomLevel = 12; // Adjust zoom level as needed
  const [lng, lat] = coordinates;
  const radiusKm = 20;
  const radiusPixels = Math.ceil((radiusKm * 256) / (40075 / Math.pow(2, zoomLevel))); // Convert radius to pixels

  const tilesets = [
    "xuanx111.3josh1wj",
    "xuanx111.cuxcvnbr",
    "xuanx111.520thek8",
    "xuanx111.96iq0mqw",
    "xuanx111.d8izfyg0",
    "xuanx111.9vhjaglf",
    "xuanx111.9unpgwbt",
    "xuanx111.0156dejf",
    "xuanx111.0nyni93u",
    "xuanx111.a8vrhntz",
    "xuanx111.26ax1s7t",
    "xuanx111.agopr4of",
  ];

  for (const tilesetId of tilesets) {
    const tileX = Math.floor(((lng + 180) / 360) * Math.pow(2, zoomLevel));
    const tileY = Math.floor(
      ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
        Math.pow(2, zoomLevel)
    );

    const url = `https://api.mapbox.com/v4/${tilesetId}/${zoomLevel}/${tileX}/${tileY}@2x.pngraw?access_token=${mapboxgl.accessToken}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        // console.warn(`Tileset ${tilesetId} not found for coordinates.`);
        continue; // Skip to the next tileset if this one fails
      }

      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);

      const canvas = document.createElement("canvas");
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;

      const context = canvas.getContext("2d");
      context.drawImage(imageBitmap, 0, 0);

      const centerX = Math.floor((((lng + 180) % 360) / 360) * imageBitmap.width);
      const centerY = Math.floor(
        ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
          imageBitmap.height
      );

      let totalPopulation = 0;
      let pixelCount = 0;

      for (let x = -radiusPixels; x <= radiusPixels; x++) {
        for (let y = -radiusPixels; y <= radiusPixels; y++) {
          const pixelX = centerX + x;
          const pixelY = centerY + y;

          if (pixelX >= 0 && pixelX < imageBitmap.width && pixelY >= 0 && pixelY < imageBitmap.height) {
            const distance = Math.sqrt(x * x + y * y);
            if (distance <= radiusPixels) {
              const pixelData = context.getImageData(pixelX, pixelY, 1, 1).data;
              const color = `rgb(${pixelData[0]},${pixelData[1]},${pixelData[2]})`;

              totalPopulation += getPopulationCount(color);
              pixelCount++;
            }
          }
        }
      }

      const areaKm2 = Math.PI * Math.pow(radiusKm, 2); // Area of the circle in km²
      const populationDensity = totalPopulation / areaKm2;

      console.log(`Total Population: ${totalPopulation}`);
      console.log(`Population Density: ${populationDensity.toFixed(2)} people/km²`);

      let populationDensityScore;
      if (populationDensity < 500) {
        populationDensityScore = (populationDensity / 500) * 0.33; // Scale < 500 people/km²
      } else if (populationDensity <= 5000) {
        populationDensityScore = 0.34 + ((populationDensity - 500) / 4500) * 0.32; // Scale 500-5,000 people/km²
      } else {
        populationDensityScore = Math.min(0.67 + ((populationDensity - 5000) / 5000) * 0.33, 1.0); // Scale > 5,000 people/km²
      }

      console.log(`Population Density Score from tileset ${tilesetId}: ${populationDensityScore.toFixed(2)}`);
      return populationDensityScore; // Return the score from the first matching tileset
    } catch (error) {
      console.error(`Error fetching population density from tileset ${tilesetId}:`, error);
    }
  }

  console.warn("No matching tileset found for the given coordinates.");
  return 0.0; // Default score if no tileset matches
}

// // test population density score on singapore
// getPopulationDensityScore([103.8198, 1.3521]).then(score => {
//   console.log(`Population Density Score for Singapore: ${score.toFixed(2)}`);
// });

// // test population density score on hue
// getPopulationDensityScore([107.5909, 16.4637]).then(score => {
//   console.log(`Population Density Score for Hue: ${score.toFixed(2)}`);
// });

// // test population density score on jakarta
// getPopulationDensityScore([106.8456, -6.2088]).then(score => {
//   console.log(`Population Density Score for Jakarta: ${score.toFixed(2)}`);
// });

// final opi
function calculateOPI(elevationScoreOPI, computeNetworkScore, urbanProximityScore, populationDensityScore) {
  return (
    0.24 * elevationScoreOPI + 0.28 * computeNetworkScore + 0.24 * urbanProximityScore + 0.24 * populationDensityScore
  );
}

// // test opi jakarta
// const jakartaCoordinates = [106.8456, -6.2088];

// Promise.all([
//   getElevationScoreOPI(jakartaCoordinates),
//   getNetworkDensityScore(jakartaCoordinates),
//   getUrbanProximityScore(jakartaCoordinates),
//   getPopulationDensityScore(jakartaCoordinates)
// ]).then(([elevationScoreOPI, networkDensityScore, urbanProximityScore, populationDensityScore]) => {
//   const opi = calculateOPI(elevationScoreOPI, networkDensityScore, urbanProximityScore, populationDensityScore);
//   console.log(`Operability Index (OPI) for Jakarta: ${opi.toFixed(2)}`);
// });

//index - pei - data query + score
// // landArea - 20km radius of coordinates and points along the route
// async function getLandArea(coordinates) {
//   const radius = 20; // 20 km radius
//   const area = Math.PI * Math.pow(radius, 2); // Area of the circle in km²
//   console.log(`Land Area within ${radius} km radius: ${area.toFixed(2)} km²`);
//   return area;
// }

// // get land area on medan
// const medanCoordinates = [98.6722, 3.5952];
// const landArea = getLandArea(medanCoordinates);
// console.log(`Land Area for Medan: ${landArea.toFixed(2)} km²`);

// gdp score - use brightness of raster tilesets(const tileset = 'xuanx111.409ps0ou') to get gdp per capita - Low Economic Importance (< $5,000 USD) – Score < 0.33, Moderate Economic Importance ($5,000 - $40,000 USD) – Score ~ 0.34 - 0.66, High Economic Importance (> $40,000 USD) – Score 0.67 - 1.0

async function getGDPScore(coordinates) {
  const gdpData = await fetch("data/testData/spatgdp.geojson").then((res) => res.json());
  const point = turf.point(coordinates);

  let gdpValue = null;

  // Iterate through each feature to find the polygon containing the point
  for (const feature of gdpData.features) {
    if (turf.booleanPointInPolygon(point, feature)) {
      gdpValue = feature.properties.DN;
      break;
    }
  }

  if (gdpValue === null) {
    console.log("Point is not within any polygon.");
    return 0.0; // Default score if point is not found in any polygon
  }

  console.log(`GDP Value (DN): ${gdpValue}`);

  // Tabulate score based on DN value (0-238 classified into 5 classes of GDP value)
  let gdpScore;

  if (gdpValue <= 47) {
    gdpScore = 1.0; // Class 1: High economic importance
  } else if (gdpValue <= 94) {
    gdpScore = 0.8; // Class 2: Moderately high economic importance
  } else if (gdpValue <= 141) {
    gdpScore = 0.6; // Class 3: Moderate economic importance
  } else if (gdpValue <= 188) {
    gdpScore = 0.4; // Class 4: Low economic importance
  } else {
    gdpScore = 0.2; // Class 5: Very low economic importance
  }

  console.log(`GDP Score: ${gdpScore.toFixed(2)}`);
  return gdpScore;
}

// // test gdp score on Kuala Lumpur
// getGDPScore([101.6869, 3.1390]).then(score => {
//   console.log(`GDP Score for Kuala Lumpur: ${score.toFixed(2)}`);
// });

// // test gdp score on medan
// getGDPScore([98.6722, 3.5952]).then(score => {
//   console.log(`GDP Score for Medan: ${score.toFixed(2)}`);
// });

// final pei Population-Economic Importance Index (PEI)
function calculatePEI(populationDensityScore, gdpScore) {
  return 0.35 * 0.25 * populationDensityScore + 0.4 * gdpScore;
}

// // test pei on medan
// const medanCoordinates = [98.6722, 3.5952];
// Promise.all([
//   getPopulationDensityScore(medanCoordinates),
//   getGDPScore(medanCoordinates)
// ]).then(([populationDensityScore, gdpScore]) => {
//   const pei = calculatePEI(populationDensityScore, gdpScore);
//   console.log(`Population-Economic Importance Index (PEI) for Medan: ${pei.toFixed(2)}`);
// });

// final feasibility index
function calculateFFI(tsi, sdi, e2i, opi, pei) {
  let ffi = 0.2 * tsi + 0.2 * sdi + 0.15 * e2i + 0.25 * opi + 0.2 * pei;
  console.log("Final Feasibility Index (FFI):", ffi.toFixed(2));
  return ffi;
}

// // test ffi kl
// const klCoordinates = [101.6869, 3.1390];

// Promise.all([
//   getElevationScore(klCoordinates),
//   getCoastlineScore(klCoordinates),
//   getTsunamiScore(klCoordinates),
//   getSeismicScore(klCoordinates),
//   getHumidityScore(klCoordinates),
//   getPopulationDensityScore(klCoordinates),
//   getGDPScore(klCoordinates)
// ]).then(([elevationScore, coastlineScore, tsunamiScore, seismicScore, humidityScore, populationDensityScore, gdpScore]) => {
//   const tsi = calculateTSI(elevationScore, coastlineScore, tsunamiScore);
//   const sdi = calculateSDI(seismicScore, elevationScore, coastlineScore, humidityScore);
//   const pei = calculatePEI(populationDensityScore, gdpScore);

//   const ffi = calculateFFI(tsi, sdi, 0, 0, pei); // Assuming e2i and opi are 0 for simplicity
//   console.log(`Final Feasibility Index (FFI) for Kuala Lumpur: ${ffi.toFixed(2)}`);
// });

// Route button to draw
const routeButton = document.createElement("img");
routeButton.src = "images/draw.svg";
routeButton.alt = "Draw Route";
routeButton.style.position = "absolute";
routeButton.style.top = "139px";
routeButton.style.left = "230px";
routeButton.style.zIndex = "1000";
routeButton.style.cursor = "pointer";
routeButton.style.width = "30px";
routeButton.style.height = "30px";
routeButton.style.border = "0px solid #ccc";
routeButton.style.borderRadius = "50%";
routeButton.style.backgroundColor = "#ffffff";
routeButton.style.padding = "5px";
document.body.appendChild(routeButton);

// hover description
const routeDescription = d3
  .select("body")
  .append("div")
  .style("position", "absolute")
  .style("padding", "7px")
  .style("background-color", "white")
  .style("border", "0px solid #ccc")
  .style("border-radius", "20px")
  .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
  .style("font-size", "14px")
  .style("color", "#333")
  .style("display", "none")
  .style("top", "139px")
  .style("z-index", "1005")
  .style("left", "270px")
  .text("Calculate Route");

routeButton.addEventListener("mouseover", () => {
  routeDescription.style("display", "block");
});

routeButton.addEventListener("mouseout", () => {
  routeDescription.style("display", "none");
});

// reset button - hide on mobile
const resetButton = document.createElement("img");
resetButton.src = "images/restart.svg";
resetButton.alt = "Reset Route";
resetButton.style.position = "absolute";
resetButton.style.top = "10px";
resetButton.style.right = "50px";
resetButton.style.zIndex = "1000";
resetButton.style.cursor = "pointer";
resetButton.style.width = "30px";
resetButton.style.height = "30px";
resetButton.style.border = "0px solid #ccc";
resetButton.style.borderRadius = "50%";
resetButton.style.backgroundColor = "#ffffff";
resetButton.style.padding = "7px";

function updateResetButtonVisibility() {
  if (window.innerWidth < 768) {
    resetButton.style.display = "block"; 
  } else {
    resetButton.style.display = "block";
  }
}

updateResetButtonVisibility();

window.addEventListener('resize', updateResetButtonVisibility);

document.body.appendChild(resetButton);

resetButton.addEventListener("click", () => {
  const confirmReset = confirm(
    "Are you sure you want to reset all settings? It is highly advisable to export a report as a PDF before resetting as it will not be possible to undo this action."
  );
  // if user cancels, do nothing
  if (!confirmReset) return;

  // remove routes
  // if (map.getLayer("e2i-path-layer")) {
  //   map.removeLayer("e2i-path-layer");
  // }
  // if (map.getSource("e2i-path")) {
  //   map.removeSource("e2i-path");
  // }
  if (map.getLayer("ffi-path-layer")) {
    map.removeLayer("ffi-path-layer");
  }
  if (map.getLayer("ffi-path-casing")) {
    map.removeLayer("ffi-path-casing");
  }
  if (map.getSource("ffi-path")) {
    map.removeSource("ffi-path");
  }
  // if (map.getLayer("opi-path-layer")) {
  //   map.removeLayer("opi-path-layer");
  // }
  // if (map.getSource("opi-path")) {
  //   map.removeSource("opi-path");
  // }

  // remove route hovers
  // map.off("mouseenter", "e2i-path-layer");
  // map.off("mouseleave", "e2i-path-layer");
  map.off("mouseenter", "ffi-path-layer");
  map.off("mouseleave", "ffi-path-layer");
  // map.off("mouseenter", "opi-path-layer");
  // map.off("mouseleave", "opi-path-layer");

  // clear origin and destination inputs (and their stashed coords)
  originInput.value = "";
  destinationInput.value = "";
  delete originInput.dataset.lat;
  delete originInput.dataset.lng;
  delete destinationInput.dataset.lat;
  delete destinationInput.dataset.lng;

  // remove origin and destination markers
  if (originMarkerRef.marker) {
    originMarkerRef.marker.remove();
    originMarkerRef.marker = null;
  }
  if (destinationMarkerRef.marker) {
    destinationMarkerRef.marker.remove();
    destinationMarkerRef.marker = null;
  }

  // clear total distance, origin, destination, index value, elevation profile, map markers in route report
  distanceContainer.innerHTML = "Total Distance N/A";
  const originElement = scoreContainer.querySelector('div:nth-child(2)');
  const destinationElement = scoreContainer.querySelector('div:nth-child(4)');
  if (originElement) originElement.textContent = "N/A";
  if (destinationElement) destinationElement.textContent = "N/A";

  const tsiValueElement = document.getElementById("tsi-value");
  const sdiValueElement = document.getElementById("sdi-value");
  const e2iValueElement = document.getElementById("e2i-value");
  const opiValueElement = document.getElementById("opi-value");
  const peiValueElement = document.getElementById("pei-value");
  const ffiValueElement = document.getElementById("ffi-value");
  const populationServedElement = document.getElementById("population-served");

  if (tsiValueElement) tsiValueElement.textContent = "0.5";
  if (sdiValueElement) sdiValueElement.textContent = "0.5";
  if (e2iValueElement) e2iValueElement.textContent = "0.5";
  if (opiValueElement) opiValueElement.textContent = "0.5";
  if (peiValueElement) peiValueElement.textContent = "0.5";
  if (ffiValueElement) ffiValueElement.textContent = "0.5";
  if (populationServedElement) populationServedElement.textContent = "N/A";

  const chartCanvas = elevationChartContainer.querySelector("canvas");
  if (chartCanvas) {
    const chart = Chart.getChart(chartCanvas);
    if (chart) {
      chart.data.datasets[0].data = []; // clear the line only
      chart.update(); // update chart
    }
  }


  // reset coordinates table
  const populateCoordinatesTable = () => {
    tableBody.innerHTML = "";
    
    const ffiPath = map.getSource("ffi-path")?._data?.geometry?.coordinates || [];
    
    if (ffiPath.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.textContent = "No path coordinates available";
      emptyCell.colSpan = 3;
      emptyCell.style.textAlign = "center";
      emptyCell.style.padding = "8px";
      emptyCell.style.color = "#666";
      emptyRow.appendChild(emptyCell);
      tableBody.appendChild(emptyRow);
    }
  };

  populateCoordinatesTable();


  const oldMarkers = document.querySelectorAll(".elevation-marker");
  oldMarkers.forEach((marker) => marker.remove());


  // remove any route drawn in the report map
  if (elevationMap.getLayer("ffi-path-layer")) {
    elevationMap.removeLayer("ffi-path-layer");
  }
  if (elevationMap.getSource("ffi-path")) {
    elevationMap.removeSource("ffi-path");
  }

 
  // remove marker_d and marker_o SVGs if they exist
  const markerDSVG = document.querySelector('img[src="images/marker_d.svg"]');
  if (markerDSVG) {
    markerDSVG.remove();
  }
  const markerOSVG = document.querySelector('img[src="images/marker_o.svg"]');
  if (markerOSVG) {
    markerOSVG.remove();
  }

  // reset map view to center of Southeast Asia
  map.flyTo({
    center: [110.0, 5.0],
    zoom: 4,
    pitch: 60,
    bearing: 50,
  });

  // reset visibility of all layers to default
  const layersToReset = [
    "earthquake-points",
    "tsunami-points",
    "avgHU-layer",
    "amphibians-layer",
    "birds-layer",
    "mammals-layer",
    "gdp-raster-layer",
    "forest-raster-layer",
    ...Array.from({ length: 12 }, (_, i) => `raster-layer-${i}`),
  ];
  layersToReset.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", "none");
    }
  });

  // coastline and earthquake visible
  if (map.getLayer("sea-coastline-layer")) {
    map.setLayoutProperty("sea-coastline-layer", "visibility", "visible");
  }
  if (map.getLayer("earthquake-points")) {
    map.setLayoutProperty("earthquake-points", "visibility", "visible");
  }

  // reset toggle buttons to default - greyed, except coastline and earthquake buttons
  d3.selectAll("img")
    .filter(function () {
      const altText = d3.select(this).attr("alt");
      return (
        altText !== "Draw Route" &&
        altText !== "Pinpoint Origin" &&
        altText !== "Pinpoint Destination" &&
        altText !== "+" &&
        altText !== "-" &&
        altText !== "Reset Route" &&
        altText !== "OK" &&
        altText !== "Coastline" &&
        altText !== "Earthquakes" &&
        altText !== "Indexes" &&
        altText !== "Layers" &&
        altText !== "Close Report" &&
        altText !== "Export Report"
      );
    })
    .style("filter", "brightness(30%)");

  // ensure coastline and earthquake buttons remain active
  d3.selectAll("img")
    .filter(function () {
      const altText = d3.select(this).attr("alt");
      return altText === "Coastline" || altText === "Earthquakes";
    })
    .style("filter", "brightness(100%)");
});

// hover description
const resetDescription = d3
  .select("body")
  .append("div")
  .style("position", "absolute")
  .style("padding", "7px")
  .style("background-color", "white")
  .style("border", "0px solid #ccc")
  .style("border-radius", "20px")
  .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
  .style("font-size", "14px")
  .style("color", "#333")
  .style("display", "none")
  .style("top", "10px")
  .style("right", "90px")
  .text("Reset All Settings");

resetButton.addEventListener("mouseover", () => {
  resetDescription.style("display", "block");
});

resetButton.addEventListener("mouseout", () => {
  resetDescription.style("display", "none");
});

// export button - change to 100% brightness when a line is drawn
const exportButton = document.createElement("img");
exportButton.src = "images/export.svg";
exportButton.alt = "Export Report";
exportButton.style.position = "absolute";
exportButton.style.top = "49px";
exportButton.style.right = "50px";
exportButton.style.zIndex = "1000";
exportButton.style.cursor = "pointer";
exportButton.style.width = "30px";
exportButton.style.height = "30px";
exportButton.style.border = "0px solid #ccc";
exportButton.style.borderRadius = "50%";
exportButton.style.backgroundColor = "#ffffff";
exportButton.style.padding = "7px";
exportButton.style.filter = "brightness(30%)"; // Initially greyed out
document.body.appendChild(exportButton);

// hover description
const exportDescription = d3
  .select("body")
  .append("div")
  .style("position", "absolute")
  .style("padding", "7px")
  .style("background-color", "white")
  .style("border", "0px solid #ccc")
  .style("border-radius", "20px")
  .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
  .style("font-size", "14px")
  .style("color", "#333")
  .style("display", "none")
  .style("top", "49px")
  .style("right", "90px")
  .text("Show Route Report");

exportButton.addEventListener("mouseover", () => {
  exportDescription.style("display", "block");
});

exportButton.addEventListener("mouseout", () => {
  exportDescription.style("display", "none");
});

// Change brightness to 100% when routes are loaded
map.on("sourcedata", () => {
  if (map.getSource("ffi-path") || map.getSource("e2i-path") || map.getSource("opi-path")) {
    setTimeout(() => {
      exportButton.style.filter = "brightness(100%)"; // Set to full brightness
    }, 5000); // 5s delay
  }
});






// Create a container for the buttons
const controlButtonGroup = document.createElement("div");
controlButtonGroup.style.position = "fixed";
controlButtonGroup.style.top = "128px";
controlButtonGroup.style.left = "-210px"; // Start hidden
controlButtonGroup.style.display = "flex";
controlButtonGroup.style.gap = "17px";
controlButtonGroup.style.borderRadius = "0 10px 10px 0";
controlButtonGroup.style.padding = "10px";
controlButtonGroup.style.zIndex = "2000";
controlButtonGroup.style.transition = "left 0.3s ease";
document.body.appendChild(controlButtonGroup);

// Move the buttons into the container
controlButtonGroup.appendChild(dashboardToggleButtonContainer);
controlButtonGroup.appendChild(layersDashboardToggleButtonContainer);
controlButtonGroup.appendChild(routeButton);

// Reset positioning since they're now in a flex container
dashboardToggleButtonContainer.style.position = "static";
dashboardToggleButtonContainer.style.top = "auto";
dashboardToggleButtonContainer.style.left = "auto";

layersDashboardToggleButtonContainer.style.position = "static";
layersDashboardToggleButtonContainer.style.top = "auto";
layersDashboardToggleButtonContainer.style.left = "auto";

routeButton.style.position = "static";
routeButton.style.top = "auto";
routeButton.style.left = "auto";

// Function to update button group position based on dashboard state
const updateButtonGroupPosition = () => {
  controlButtonGroup.style.left = (isDashboardOpen || isLayersDashboardOpen) ? "0" : "-250px";
};

// Add hover functionality
controlButtonGroup.addEventListener("mouseenter", () => {
  if (!isDashboardOpen && !isLayersDashboardOpen) {
    controlButtonGroup.style.left = "0";
  }
});

controlButtonGroup.addEventListener("mouseleave", () => {
  if (!isDashboardOpen && !isLayersDashboardOpen) {
    controlButtonGroup.style.left = "-210px";
  }
});

// Add listeners to update button group position after dashboard state changes
dashboardToggleButtonContainer.addEventListener("click", () => {
  // Wait for the existing click handler to update isDashboardOpen
  setTimeout(updateButtonGroupPosition, 10);
});

layersDashboardToggleButtonContainer.addEventListener("click", () => {
  // Wait for the existing click handler to update isLayersDashboardOpen
  setTimeout(updateButtonGroupPosition, 10);
});





// loading bar
const loadingBar = document.createElement("div");
loadingBar.style.position = "absolute";
loadingBar.style.top = "0";
loadingBar.style.left = "0";
loadingBar.style.width = "0";
loadingBar.style.height = "3px";
loadingBar.style.backgroundColor = "#f67a0a";
loadingBar.style.zIndex = "1001";
loadingBar.style.transition = "width 0.3s ease";
document.body.appendChild(loadingBar);








// routeButton.addEventListener("click", async () => {
//   const originValue = originInput.value;
//   const destinationValue = destinationInput.value;

//   if (!originValue || !destinationValue) {
//     alert("Please enter both the origin and destination.");
//     return;
//   }

//   // Show loading bar
//   loadingBar.style.width = "0";
//   loadingBar.style.display = "block";

//   // update the loading bar length until route appear
//   const interval = setInterval(() => {
//     const currentWidth = parseFloat(loadingBar.style.width);
//     if (currentWidth < 90) {
//       loadingBar.style.width = `${currentWidth + 10}%`;
//     }
//   }, 100);

//   // complete the loading bar when the route is added
//   map.once("sourcedata", () => {
//     clearInterval(interval);
//     loadingBar.style.width = "100%";
//     setTimeout(() => {
//       loadingBar.style.display = "none";
//     }, 5000);
//   });

//   // Parse coord from the input fields
//   const originMatch =
//     originValue.match(/Lat:\s*([\d.-]+),\s*Lng:\s*([\d.-]+)/) || (await fetchLocationCoordinates(originValue));
//   const destinationMatch =
//     destinationValue.match(/Lat:\s*([\d.-]+),\s*Lng:\s*([\d.-]+)/) ||
//     (await fetchLocationCoordinates(destinationValue));

//   async function fetchLocationCoordinates(locationName) {
//     const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
//       locationName
//     )}.json?access_token=${mapboxgl.accessToken}`;
//     try {
//       const response = await fetch(url);
//       const data = await response.json();
//       if (data.features && data.features.length > 0) {
//         const [lng, lat] = data.features[0].center;
//         return { 1: lat, 2: lng }; // Mimic regex match object
//       }
//     } catch (error) {
//       console.error("Error fetching coordinates for location:", error);
//     }
//     return null;
//   }

//   if (originMatch && destinationMatch) {
//     const originCoords = [parseFloat(originMatch[2]), parseFloat(originMatch[1])];
//     const destinationCoords = [parseFloat(destinationMatch[2]), parseFloat(destinationMatch[1])];

//     // Draw 3x rail line - 1 colour for each line, but from same set of origin and destination - green for highest e2i , orange for hightest ffi, blue for opi - each line is calculated based on the indexes, default at 0.5 and line will change when the user adjust the values of the indexes. and ensure all coordinates in the route to be only within sea.json and maximmum with 1km outwards offset - use bezier curve to draw the line

//     async function calculateCurvedPath(start, end) {
//       console.log("Starting calculation of curved path...");
//       const path = [];
//       const stepCount = 20;
//       const curveFactor = 0.5;
//       const irregularityFactor = 0.1;

//       console.log("Fetching sea.json data...");
//       const seaData = await fetch("data/sea.json").then((res) => res.json());
//       console.log("Sea data fetched successfully.");

//       console.log("Creating buffer around sea.json boundary...");
//       const bufferedSea = turf.buffer(seaData, 1, { units: "kilometers" }); // 1km buffer sea.json
//       const seaPolygon = bufferedSea.features[0]; // get 1st polygon from FeatureCollection
//       console.log("Buffer created successfully.");

//       console.log("Generating path points...");
//       for (let i = 0; i <= stepCount; i++) {
//         const t = i / stepCount;
//         const lng = start[0] * (1 - t) + end[0] * t;
//         const lat = start[1] * (1 - t) + end[1] * t;

//         // Add curvature by offsetting the midpoint
//         const curveOffset = Math.sin(Math.PI * t) * curveFactor * (1 + Math.sin(5 * Math.PI * t) * 0.2); // sine wave variation
//         const irregularityOffsetLng = (Math.random() - 0.5) * irregularityFactor;
//         const irregularityOffsetLat = (Math.random() - 0.5) * irregularityFactor;

//         const curvedLng = lng + curveOffset * (end[1] - start[1]) + irregularityOffsetLng;
//         const curvedLat = lat - curveOffset * (end[0] - start[0]) + irregularityOffsetLat;

//         const point = turf.point([curvedLng, curvedLat]);

//         // Ensure the point is within the sea.json boundary
//         if (turf.booleanPointInPolygon(point, seaPolygon)) {
//           console.log(`Point ${i} is within the boundary: [${curvedLng}, ${curvedLat}]`);
//           path.push([curvedLng, curvedLat]);
//         } else {
//           console.log(`Point ${i} is outside the boundary and will be skipped: [${curvedLng}, ${curvedLat}]`);
//         }
//       }

//       console.log("Path generation completed.");
//       return path;
//     }

//     // async function calculateCurvedPath(start, end) {
//     //   console.log("Starting calculation of optimal FFI path...");
//     //   const path = [start]; // Start with the origin point
      
//     //   // Load the SEA boundary data for validation
//     //   console.log("Fetching sea.json data...");
//     //   const seaData = await fetch("data/sea.json").then((res) => res.json());
//     //   console.log("Sea data fetched successfully.");

//     //   // Create buffer around sea.json boundary for valid area
//     //   console.log("Creating buffer around sea.json boundary...");
//     //   const bufferedSea = turf.buffer(seaData, 1, { units: "kilometers" }); // 1km buffer
//     //   const seaPolygon = bufferedSea.features[0]; // get 1st polygon from FeatureCollection
//     //   console.log("Buffer created successfully.");

//     //   // Load the precomputed grid points with FFI values
//     //   console.log("Loading grid FFI data...");
//     //   const gridData = await fetch("data/preCal/grid_final.geojson")
//     //     .then((res) => res.json())
//     //     .catch((error) => {
//     //       console.error("Error loading grid FFI data:", error);
//     //       return { features: [] }; // Return empty features if file not found
//     //     });
      
//     //   if (!gridData.features || gridData.features.length === 0) {
//     //     console.warn("No grid FFI data found, falling back to direct path");
//     //     // If no grid data, just return direct start-end path
//     //     return [start, end];
//     //   }
      
//     //   console.log(`Loaded ${gridData.features.length} grid points with FFI values`);
      
//     //   // Extract points with their FFI values, calculating centroids where needed
//     //   const gridPoints = gridData.features.map(feature => {
//     //     // Get coordinates - if it's not a point, calculate the centroid
//     //     let coordinates;
//     //     if (feature.geometry.type === 'Point') {
//     //       coordinates = feature.geometry.coordinates;
//     //     } else {
//     //       // For other geometry types (Polygon, MultiPolygon, etc.), calculate centroid
//     //       const centroid = turf.centroid(feature);
//     //       coordinates = centroid.geometry.coordinates;
//     //     }
        
//     //     return {
//     //       coordinates,
//     //       ffi: feature.properties.ffi || 0.5 // Default to 0.5 if FFI not available
//     //     };
//     //   });
      
//     //   // Calculate direct distance between start and end
//     //   const directDistance = turf.distance(turf.point(start), turf.point(end), {units: 'kilometers'});
      
//     //   // Find top 3 best intermediate points (closest to both origin and destination + high FFI)
//     //   const bestIntermediatePoints = gridPoints
//     //     .map(point => {
//     //       // Calculate distances from point to start and end
//     //       const distToStart = turf.distance(turf.point(point.coordinates), turf.point(start), {units: 'kilometers'});
//     //       const distToEnd = turf.distance(turf.point(point.coordinates), turf.point(end), {units: 'kilometers'});
          
//     //       // Calculate centrality: how close the point is to direct path between origin-destination
//     //       // A value close to 1 means the point is on the direct line between start and end
//     //       const centrality = (distToStart + distToEnd) / directDistance;
          
//     //       // Calculate a composite score: higher FFI is better, lower centrality is better
//     //       const compositeScore = (point.ffi * 0.6) + ((2 - centrality) * 0.4);
          
//     //       return {
//     //         ...point,
//     //         distToStart,
//     //         distToEnd,
//     //         centrality,
//     //         compositeScore
//     //       };
//     //     })
//     //     // Filter out points that are outside SEA boundary
//     //     .filter(point => {
//     //       const pointFeature = turf.point(point.coordinates);
//     //       return turf.booleanPointInPolygon(pointFeature, seaPolygon);
//     //     })
//     //     // Sort by composite score, highest first
//     //     .sort((a, b) => b.compositeScore - a.compositeScore)
//     //     // Take the top 3
//     //     .slice(0, 3);
      
//     //   console.log("Top 3 best intermediate points:");
//     //   bestIntermediatePoints.forEach((point, index) => {
//     //     console.log(`Point ${index + 1}: [${point.coordinates[0].toFixed(4)}, ${point.coordinates[1].toFixed(4)}]`);
//     //     console.log(`  FFI: ${point.ffi.toFixed(2)}, Distance to Origin: ${point.distToStart.toFixed(2)}km, Distance to Destination: ${point.distToEnd.toFixed(2)}km`);
//     //   });
      
//     //   // Current point is the start
//     //   let currentPoint = start;
//     //   let remainingPoints = [...gridPoints];
//     //   const maxPoints = 20; // Maximum number of intermediate points to use
//     //   let pointCount = 0;
      
//     //   // Define search parameters
//     //   const maxSearchRadius = 100; // km, maximum search radius
//     //   const initialSearchRadius = 20; // km, initial search radius
//     //   let searchRadius = initialSearchRadius;
//     //   const searchRadiusIncrement = 10; // km, how much to increase search radius if no points found
      
//     //   // While we haven't reached close to the destination
//     //   while (pointCount < maxPoints && turf.distance(turf.point(currentPoint), turf.point(end), {units: 'kilometers'}) > searchRadius) {
//     //     // Check if we need to terminate the search (getting too close to end)
//     //     if (turf.distance(turf.point(currentPoint), turf.point(end), {units: 'kilometers'}) < searchRadius * 1.5) {
//     //       console.log("Close enough to destination - adding endpoint");
//     //       path.push(end);
//     //       break;
//     //     }
        
//     //     // Find points within search radius
//     //     let nearbyPoints = remainingPoints.filter(pt => {
//     //       const distance = turf.distance(turf.point(currentPoint), turf.point(pt.coordinates), {units: 'kilometers'});
//     //       return distance < searchRadius && distance > 0; // Ensure we're not selecting the same point
//     //     });
        
//     //     // If no points found in radius, increase search radius
//     //     if (nearbyPoints.length === 0) {
//     //       searchRadius += searchRadiusIncrement;
//     //       console.log(`No points found within ${searchRadius - searchRadiusIncrement}km, increasing radius to ${searchRadius}km`);
          
//     //       // If search radius becomes too large, stop the search
//     //       if (searchRadius > maxSearchRadius) {
//     //         console.log(`Search radius (${searchRadius}km) exceeded maximum (${maxSearchRadius}km) - adding endpoint`);
//     //         path.push(end);
//     //         break;
//     //       }
//     //       continue;
//     //     }
        
//     //     // Sort by FFI value (highest first)
//     //     nearbyPoints.sort((a, b) => b.ffi - a.ffi);
        
//     //     // Get the point with highest FFI
//     //     const bestPoint = nearbyPoints[0];
        
//     //     // Validate the point is within SEA boundary
//     //     const pointFeature = turf.point(bestPoint.coordinates);
//     //     if (!turf.booleanPointInPolygon(pointFeature, seaPolygon)) {
//     //       console.log(`Point ${bestPoint.coordinates} is outside SEA boundary, skipping`);
//     //       // Remove this point from consideration
//     //       remainingPoints = remainingPoints.filter(pt => pt !== bestPoint);
//     //       continue;
//     //     }
        
//     //     // Add to path and update current point
//     //     path.push(bestPoint.coordinates);
//     //     console.log(`Added point [${bestPoint.coordinates}] with FFI ${bestPoint.ffi.toFixed(2)}`);
        
//     //     // Update for next iteration
//     //     currentPoint = bestPoint.coordinates;
//     //     // Remove used point to avoid cycles
//     //     remainingPoints = remainingPoints.filter(pt => pt !== bestPoint);
//     //     pointCount++;
        
//     //     // Reset search radius for next point
//     //     searchRadius = initialSearchRadius;
//     //   }
      
//     //   // Make sure we end at the destination
//     //   if (path[path.length - 1][0] !== end[0] || path[path.length - 1][1] !== end[1]) {
//     //     path.push(end);
//     //   }
      
//     //   console.log(`Path generated with ${path.length} points`);
//     //   return path;
//     // }

//     const getPopulationCountFromRoute = async () => {
//       const ffiPath = map.getSource("ffi-path")?._data?.geometry?.coordinates || [];
//       if (ffiPath.length === 0) {
//         console.log("No route available to calculate population count.");
//         return "0.0";
//       }
  

//       // Use the tilesets that contain population data
//       const tilesets = [
//         "xuanx111.3josh1wj", "xuanx111.cuxcvnbr", "xuanx111.520thek8", 
//         "xuanx111.96iq0mqw", "xuanx111.d8izfyg0", "xuanx111.9vhjaglf", 
//         "xuanx111.9unpgwbt", "xuanx111.0156dejf", "xuanx111.0nyni93u", 
//         "xuanx111.a8vrhntz", "xuanx111.26ax1s7t", "xuanx111.agopr4of"
//       ];
      
//       let totalPopulation = 0;
//       const zoomLevel = 12;
      
//       // Sample points along the route to reduce API calls
//       const samplePoints = ffiPath.filter((_, index) => index % 3 === 0);
      
//       for (const coord of samplePoints) {
//         const [lng, lat] = coord;
        
//         for (const tilesetId of tilesets) {
//           try {
//             const tileX = Math.floor(((lng + 180) / 360) * Math.pow(2, zoomLevel));
//             const tileY = Math.floor(
//               ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
//                 Math.pow(2, zoomLevel)
//             );
            
//             const url = `https://api.mapbox.com/v4/${tilesetId}/${zoomLevel}/${tileX}/${tileY}@2x.pngraw?access_token=${mapboxgl.accessToken}`;
//             const response = await fetch(url);
            
//             if (!response.ok) continue;
            
//             const blob = await response.blob();
//             const imageBitmap = await createImageBitmap(blob);
            
//             const canvas = document.createElement("canvas");
//             canvas.width = imageBitmap.width;
//             canvas.height = imageBitmap.height;
            
//             const context = canvas.getContext("2d");
//             context.drawImage(imageBitmap, 0, 0);
            
//             const centerX = Math.floor((((lng + 180) % 360) / 360) * imageBitmap.width);
//             const centerY = Math.floor(
//               ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
//                 imageBitmap.height
//             );
            
//             // Sample a small area around the point
//             let localPopulation = 0;
//             const radius = 10; // Sample within 10km radius
            
//             for (let x = -radius; x <= radius; x++) {
//               for (let y = -radius; y <= radius; y++) {
//                 const pixelX = centerX + x;
//                 const pixelY = centerY + y;
                
//                 // Check if pixel is within the image bounds AND within radius
//                 if (pixelX >= 0 && pixelX < imageBitmap.width && pixelY >= 0 && pixelY < imageBitmap.height) {
//                   const distance = Math.sqrt(x * x + y * y);
//                   if (distance <= radius) {
//                     const pixelData = context.getImageData(pixelX, pixelY, 1, 1).data;
//                     const color = `rgb(${pixelData[0]},${pixelData[1]},${pixelData[2]})`;
                    
//                     // Use the existing population count function
//                     localPopulation += getPopulationCount(color);
//                   }
//                 }
//               }
//             }
            
//             totalPopulation += localPopulation;
//             break; // Found a valid tileset, move to next coordinate
//           } catch (error) {
//             console.error(`Error processing coordinate [${lng}, ${lat}]:`, error);
//           }
//         }
//       }
      
//       // Scale the population based on sampling and corridor width
//       const samplingFactor = ffiPath.length / samplePoints.length;
//       const corridorWidth = 10; //
//       totalPopulation = Math.floor(Math.random() * (700000 - 10000 + 1)) + 10000;
//       // totalPopulation *= samplingFactor * corridorWidth;

//       console.log(`Estimated Population Along Route: ${Math.round(totalPopulation)}`);
      
//       // Normalize to a 0-1 scale for display
//       const populationScore = Math.min(totalPopulation / 1000000, 1).toFixed(2);
      
//       // population value as integer
//       const populationInteger = Math.round(totalPopulation);
      
//       // Format commas
//       const formattedPopulation = populationInteger.toLocaleString();
      
//       // hidden element to store value
//       const populationServedElement = document.getElementById('population-served') || document.createElement('span');
//       populationServedElement.id = 'population-served';
//       populationServedElement.textContent = formattedPopulation;
//       populationServedElement.style.display = 'none';
      
//       if (!document.getElementById('population-served')) {
//         document.body.appendChild(populationServedElement);
//       }
      
//       return populationScore;
//     };

//     async function drawRailLines(origin, destination) {
//       // Calculate paths for each index
//       // const e2iPath = await calculateCurvedPath(origin, destination);
//       const ffiPath = await calculateCurvedPath(origin, destination);
//       // const opiPath = await calculateCurvedPath(origin, destination);

//       // Add paths to the map
//       const paths = [
//         // { id: "e2i-path", color: "#00ff00", coordinates: e2iPath }, // Green for e2i
//         { id: "ffi-path", color: "rgb(145, 255, 0)", coordinates: ffiPath }, // Orange for ffi
//         // { id: "opi-path", color: "#0000ff", coordinates: opiPath }, // Blue for opi
//       ];

//       paths.forEach(({ id, color, coordinates }) => {
//         if (map.getSource(id)) {
//           map.getSource(id).setData({
//             type: "Feature",
//             geometry: { type: "LineString", coordinates },
//           });
//         } else {
//           map.addSource(id, {
//             type: "geojson",
//             data: {
//               type: "Feature",
//               geometry: { type: "LineString", coordinates },
//             },
//           });

//           map.addLayer({
//             id: `${id}-layer`,
//             type: "line",
//             source: id,
//             paint: {
//               "line-color": color,
//               "line-width": 4,
//               "line-opacity": 0.8,
//             },
//           });
//         }

//         // hover details for each line - add index value and total distance
//         map.on("mouseenter", `${id}-layer`, (e) => {
//           map.getCanvas().style.cursor = "pointer";

//           const coordinates = e.features[0].geometry.coordinates;
//           const distance = turf.length(turf.lineString(coordinates), { units: "kilometers" }).toFixed(2);

//           const popup = new mapboxgl.Popup({
//             closeButton: false,
//             closeOnClick: false,
//           })
//             .setLngLat(e.lngLat)
//             .setHTML(
//               `
//               <strong style="color:rgb(59, 59, 59);">Index Values</strong><br>
//               <strong>TSI </strong> ${document.getElementById("tsi-value").textContent}<br>
//               <strong>SDI </strong> ${document.getElementById("sdi-value").textContent}<br>
//               <strong>E2I </strong> ${document.getElementById("e2i-value").textContent}<br>
//               <strong>OPI </strong> ${document.getElementById("opi-value").textContent}<br>
//               <strong>PEI </strong> ${document.getElementById("pei-value").textContent}<br>
//               <strong>Distance </strong> ${distance} km
//             `
//             )
//             .addTo(map);

//           const popupElement = popup.getElement();
//           Object.assign(popupElement.style, {
//             padding: "10px",
//             borderRadius: "10px",
//             fontSize: "14px",
//             color: "#333",
//             shadow: "0px 2px 5px rgba(0, 0, 0, 0.5)",
//           });

//           console.log(`Path ID: ${id}, Distance: ${distance} km`);

//           map.on("mouseleave", `${id}-layer`, () => {
//             map.getCanvas().style.cursor = "";
//             popup.remove();
//           });
//         });
//       });
      
//       // Calculate population count after drawing the route
//       await getPopulationCountFromRoute();
      
//       // Update export dashboard if it's open
//       if (isExportDashboardOpen) {
//         updateExportDashboardContent();
//       }
//     }

//     // Call drawRailLines when the route button is clicked
//     routeButton.addEventListener("click", async () => {
//       const originValue = originInput.value;
//       const destinationValue = destinationInput.value;

//       if (!originValue || !destinationValue) {
//         alert("Please enter both the origin and destination.");
//         return;
//       }

//       const originMatch =
//         originValue.match(/Lat:\s*([\d.-]+),\s*Lng:\s*([\d.-]+)/) || (await fetchLocationCoordinates(originValue));
//       const destinationMatch =
//         destinationValue.match(/Lat:\s*([\d.-]+),\s*Lng:\s*([\d.-]+)/) ||
//         (await fetchLocationCoordinates(destinationValue));

//       if (originMatch && destinationMatch) {
//         const originCoords = [parseFloat(originMatch[2]), parseFloat(originMatch[1])];
//         const destinationCoords = [parseFloat(destinationMatch[2]), parseFloat(destinationMatch[1])];

//         await drawRailLines(originCoords, destinationCoords);
//       } else {
//         alert("Invalid coordinates. Please ensure the inputs are in the correct format.");
//       }
//     });

//     // Update rail lines dynamically when sliders are adjusted
//     const sliders = ["e2i-filter", "ffi-filter", "opi-filter", "tsi-filter", "sdi-filter", "pei-filter"];
//     sliders.forEach((sliderId) => {
//       document.getElementById(sliderId).addEventListener("input", async () => {
//         const originValue = originInput.value;
//         const destinationValue = destinationInput.value;

//         if (!originValue || !destinationValue) return;

//         const originMatch =
//           originValue.match(/Lat:\s*([\d.-]+),\s*Lng:\s*([\d.-]+)/) || (await fetchLocationCoordinates(originValue));
//         const destinationMatch =
//           destinationValue.match(/Lat:\s*([\d.-]+),\s*Lng:\s*([\d.-]+)/) ||
//           (await fetchLocationCoordinates(destinationValue));

//         if (originMatch && destinationMatch) {
//           const originCoords = [parseFloat(originMatch[2]), parseFloat(originMatch[1])];
//           const destinationCoords = [parseFloat(destinationMatch[2]), parseFloat(destinationMatch[1])];

//           await drawRailLines(originCoords, destinationCoords);
//         }
//       });
//     });

//     // Zoom to route
//     if (map.getSource("ffi-path")) {
//       const ffiPathData = map.getSource("ffi-path")._data;
//       const bounds = turf.bbox(ffiPathData);
//       map.fitBounds(bounds, { padding: 100, maxZoom: 6 });
//     }

//     // Hide the loading bar after the route is loaded
//     loadingBar.style.width = "100%";
//     setTimeout(() => {
//       loadingBar.style.display = "none";
//     }, 100);
//   } else {
//     alert("Invalid coordinates. Please ensure the inputs are in the correct format.");
//     loadingBar.style.display = "none"; // Hide the loading bar in case of an error
//   }
// });










routeButton.addEventListener("click", async () => {
  const originValue = originInput.value;
  const destinationValue = destinationInput.value;

  if (!originValue || !destinationValue) {
    alert("Please enter both the origin and destination.");
    return;
  }

  // Disable export button during animation
  exportButton.style.filter = "brightness(30%)";
  exportButton.style.cursor = "not-allowed";

  // Show loading bar
  loadingBar.style.width = "0";
  loadingBar.style.display = "block";

  // update the loading bar length until route appear
  const interval = setInterval(() => {
    const currentWidth = parseFloat(loadingBar.style.width);
    if (currentWidth < 90) {
      loadingBar.style.width = `${currentWidth + 10}%`;
    }
  }, 100);

  // complete the loading bar when the route is added
  map.once("sourcedata", () => {
    clearInterval(interval);
    loadingBar.style.width = "100%";
    setTimeout(() => {
      loadingBar.style.display = "none";
    }, 5000);
  });

  // Parse coord from the input fields.
  // Priority: stashed dataset (set when the user dropped a marker) → explicit
  // "Lat: X, Lng: Y" text → forward-geocode the place name via Nominatim.
  // Falling all the way through to Nominatim every click was flaky once we
  // exceeded their 1-req/sec policy.
  const fromDataset = (input) => {
    const lat = parseFloat(input.dataset.lat);
    const lng = parseFloat(input.dataset.lng);
    return isFinite(lat) && isFinite(lng) ? { 1: lat, 2: lng } : null;
  };
  const originMatch =
    fromDataset(originInput) ||
    originValue.match(/Lat:\s*([\d.-]+),\s*Lng:\s*([\d.-]+)/) ||
    (await fetchLocationCoordinates(originValue));
  const destinationMatch =
    fromDataset(destinationInput) ||
    destinationValue.match(/Lat:\s*([\d.-]+),\s*Lng:\s*([\d.-]+)/) ||
    (await fetchLocationCoordinates(destinationValue));

  async function fetchLocationCoordinates(locationName) {
    // Forward geocode via Nominatim, bounded to SEA.
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      locationName
    )}&viewbox=90,25,140,-15&bounded=1&limit=1`;
    try {
      const response = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        return { 1: lat, 2: lng }; // Mimic regex match object
      }
    } catch (error) {
      console.error("Error fetching coordinates for location:", error);
    }
    return null;
  }

  if (originMatch && destinationMatch) {
    const originCoords = [parseFloat(originMatch[2]), parseFloat(originMatch[1])];
    const destinationCoords = [parseFloat(destinationMatch[2]), parseFloat(destinationMatch[1])];

    // Real router: A* over the pre-computed feasibility grid. Slider
    // positions act as cost weights (see __cellCost). Drag PEI up → route
    // bends through populated cells. Drag E2I up → it skirts biodiversity.
    // Falls back to the original curve+jitter if the grid can't load.
    async function calculateCurvedPath(start, end) {
      try {
        const result = await __aStarRoute(start, end);
        __lastRouteCellPath = result.path;
        __updateAchievedScores(result.path);
        return [start, ...result.coords, end];
      } catch (err) {
        console.warn("A* router failed, falling back to curve:", err);
        __lastRouteCellPath = [];
        const path = [];
        const stepCount = 20, curveFactor = 0.5, irregularityFactor = 0.1;
        const seaData = await fetch("data/sea.json").then((res) => res.json());
        const bufferedSea = turf.buffer(seaData, 1, { units: "kilometers" });
        const seaPolygon = bufferedSea.features[0];
        for (let i = 0; i <= stepCount; i++) {
          const t = i / stepCount;
          const lng = start[0] * (1 - t) + end[0] * t;
          const lat = start[1] * (1 - t) + end[1] * t;
          const curveOffset = Math.sin(Math.PI * t) * curveFactor * (1 + Math.sin(5 * Math.PI * t) * 0.2);
          const offLng = (Math.random() - 0.5) * irregularityFactor;
          const offLat = (Math.random() - 0.5) * irregularityFactor;
          const curvedLng = lng + curveOffset * (end[1] - start[1]) + offLng;
          const curvedLat = lat - curveOffset * (end[0] - start[0]) + offLat;
          const point = turf.point([curvedLng, curvedLat]);
          if (turf.booleanPointInPolygon(point, seaPolygon)) path.push([curvedLng, curvedLat]);
        }
        return path;
      }
    }

    const getPopulationCountFromRoute = async () => {
      // Sum gdp over the cells the A* route passes through (set in
      // calculateCurvedPath via __lastRouteCellPath). Replaces the original
      // 12-tileset sampling — deterministic, free, no API calls.
      if (!__lastRouteCellPath || __lastRouteCellPath.length === 0) {
        console.log("No A* cell path available to estimate population.");
        return "0";
      }
      const POP_CALIBRATION = 100; // 1 gdp unit ≈ 100 residents (rough)
      const gdpSum = __sumGdpAlongCells(__lastRouteCellPath);
      const totalPopulation = Math.round(gdpSum * POP_CALIBRATION);
      const formattedPopulation = totalPopulation.toLocaleString();
      console.log(`Estimated population along route: ${formattedPopulation} (gdp sum ${gdpSum.toFixed(0)} × ${POP_CALIBRATION})`);

      const populationServedElement = document.getElementById('population-served') || document.createElement('span');
      populationServedElement.id = 'population-served';
      populationServedElement.textContent = formattedPopulation;
      populationServedElement.style.display = 'none';
      if (!document.getElementById('population-served')) {
        document.body.appendChild(populationServedElement);
      }
      return populationServedElement.textContent;
    };

    // Function to animate path drawing.
    // Mirrors the Leaflet reveal: line grows from origin → destination while
    // a dot rides the leading edge. Internally uses `line-gradient` driven by
    // setPaintProperty (cheap, paint-only, synchronous) — that's the only
    // way to get a smooth reveal on a MapLibre line, because feeding it
    // progressively-longer LineStrings via setData triggers async worker
    // re-tessellation that batches into a single visible "snap".
    // A monotonic token lets a slider update mid-animation cancel the loop.
    function animatePath(sourceId, coordinates, color) {
      const myToken = ++_animateToken;
      return new Promise(resolve => {
        const animationDuration = 5000; // 5 s total — same as Leaflet
        const layerId = `${sourceId}-layer`;
        const transparent = "rgba(0,0,0,0)";
        const lineColor = color || "#00ff66";
        const totalPoints = coordinates.length;

        // Set up the traveling dot
        if (!map.getSource('traveling-dot')) {
          map.addSource('traveling-dot', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'Point', coordinates: coordinates[0] } }
          });
          map.addLayer({
            id: 'traveling-dot-layer',
            type: 'circle',
            source: 'traveling-dot',
            paint: {
              'circle-radius': 6,
              'circle-color': '#ffffff',
              'circle-stroke-width': 2,
              'circle-stroke-color': lineColor,
            }
          });
        } else {
          map.getSource('traveling-dot').setData({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: coordinates[0] }
          });
          map.setLayoutProperty('traveling-dot-layer', 'visibility', 'visible');
        }
        // Keep the dot above the route line.
        if (map.getLayer('traveling-dot-layer')) map.moveLayer('traveling-dot-layer');

        const startTime = performance.now();
        function frame(now) {
          if (myToken !== _animateToken) { resolve(); return; }
          const t = Math.min(1, (now - startTime) / animationDuration);

          // Reveal: visible from 0 → t, transparent from t → 1.
          // Clamp t away from exactly 0/1 to avoid degenerate step stops.
          const cut = Math.max(0.0001, Math.min(0.9999, t));
          map.setPaintProperty(layerId, "line-gradient", [
            "step", ["line-progress"],
            lineColor,
            cut,
            transparent,
          ]);

          // Move the dot to the leading edge.
          const dotIdx = Math.min(totalPoints - 1, Math.floor(t * totalPoints));
          if (map.getSource('traveling-dot')) {
            map.getSource('traveling-dot').setData({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: coordinates[dotIdx] }
            });
          }

          if (t < 1) {
            requestAnimationFrame(frame);
          } else {
            // Done — gradient solid green end-to-end (so later slider
            // updates that just setData the new coords stay visible), hide
            // the traveling dot.
            map.setPaintProperty(layerId, "line-gradient", [
              "step", ["line-progress"], lineColor, 1, lineColor,
            ]);
            if (map.getLayer('traveling-dot-layer')) {
              map.setLayoutProperty('traveling-dot-layer', 'visibility', 'none');
            }
            populateCoordinatesTable();
            resolve();
          }
        }

        requestAnimationFrame(frame);
      });
    }

    // Enhanced function to draw route on elevation map
    async function drawRouteOnElevationMap(coordinates) {
      console.log("Drawing route on elevation map...");

      // Ensure the elevation map is ready
      return new Promise((resolve) => {
        let _retries = 0;
        function addRouteToElevationMap() {
          // Style-loaded is enough — `.loaded()` also waits for every tile
          // (terrarium DEM + imagery), which can keep returning false during
          // ongoing fitBounds animations and spam the retry loop forever.
          if (!elevationMap || !elevationMap.isStyleLoaded()) {
            if (_retries++ > 50) { console.warn("elevationMap never reached style-loaded; giving up"); resolve(); return; }
            setTimeout(addRouteToElevationMap, 200);
            return;
          }
          
          try {
            console.log("Elevation map ready, adding route...");
            
            // Remove existing layer and source if they exist
            if (elevationMap.getLayer("ffi-path-layer")) {
              elevationMap.removeLayer("ffi-path-layer");
            }
            
            if (elevationMap.getSource("ffi-path")) {
              elevationMap.removeSource("ffi-path");
            }
            
            // Force resize to ensure map is properly sized
            elevationMap.resize();
            
            // Add the path to the elevation map
            elevationMap.addSource("ffi-path", {
              type: "geojson",
              data: {
                type: "Feature",
                geometry: { type: "LineString", coordinates }
              }
            });
            
            elevationMap.addLayer({
              id: "ffi-path-layer",
              type: "line",
              source: "ffi-path",
              paint: {
                "line-color": " #f67a0a",
                "line-width": 4,
                "line-opacity": 0.8
              }
            });
            
            // Create a proper bounding box for the path
            const bounds = turf.bbox({
              type: "Feature",
              geometry: { type: "LineString", coordinates }
            });
            
            // Add padding and fit bounds
            elevationMap.fitBounds(bounds, { 
              padding: {top: 50, bottom: 50, left: 50, right: 50},
              linear: false,
              duration: 1000
            });
            
            // Wait for the map to finish moving before resolving
            elevationMap.once('moveend', () => {
              console.log("Elevation map route added successfully");
              resolve();
            });
            
            // Safety timeout in case moveend doesn't fire
            setTimeout(resolve, 2000);
          } catch (error) {
            console.error("Error adding route to elevation map:", error);
            resolve(); // Still resolve to continue execution
          }
        }
        
        // Start the process
        addRouteToElevationMap();
      });
    }

    async function drawRailLines(origin, destination) {
      console.log("[route] drawRailLines start", { origin, destination });
      // Calculate paths for each index
      let ffiPath;
      try {
        ffiPath = await calculateCurvedPath(origin, destination);
        console.log("[route] calculateCurvedPath returned", ffiPath?.length, "coords");
      } catch (err) {
        console.error("[route] calculateCurvedPath threw:", err);
        return;
      }
      if (!ffiPath || ffiPath.length === 0) {
        console.warn("[route] empty path — nothing to draw");
        return;
      }

      // Mirror the Leaflet version: single bright-green line, no dark casing,
      // 5 px width, rounded caps/joins, animated draw with a traveling dot.
      const paths = [
        { id: "ffi-path", color: "#00ff66", coordinates: ffiPath },
      ];

      for (const { id, color, coordinates } of paths) {
        map.off("mouseenter", `${id}-layer`);
        map.off("mouseleave", `${id}-layer`);

        // First draw (no existing source) → animate the line in.
        // Subsequent calls (slider tweaks) → just swap in the new coords so
        // the user sees the path morph, not a full reset + re-animation.
        const isFirstDraw = !map.getSource(id);
        const fullLine = {
          type: "Feature",
          geometry: { type: "LineString", coordinates },
        };

        try {
          if (isFirstDraw) {
            // lineMetrics: true is required for the line-progress expression
            // we use in line-gradient to reveal the line during animation.
            map.addSource(id, { type: "geojson", lineMetrics: true, data: fullLine });
            map.addLayer({
              id: `${id}-layer`,
              type: "line",
              source: id,
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": color, // fallback when no gradient is active
                "line-width": 5,
                "line-opacity": 1,
                // Start fully hidden — animatePath ticks the cutoff up.
                "line-gradient": [
                  "step", ["line-progress"],
                  "rgba(0,0,0,0)",
                  0.0001, "rgba(0,0,0,0)",
                ],
              },
            });
            console.log("[route] first draw, animating", `${id}-layer`, "points:", coordinates.length);
          } else {
            // Just swap in the new coords. Gradient was left fully revealed
            // at the end of the initial animation, so the new line is
            // immediately visible end-to-end.
            map.getSource(id).setData(fullLine);
            console.log("[route] update existing", `${id}-layer`, "points:", coordinates.length);
          }
          // Force the route above any toggleable overlay added later.
          if (map.getLayer(`${id}-layer`)) map.moveLayer(`${id}-layer`);
        } catch (err) {
          console.error("[route] add/reset source/layer threw:", err);
          return;
        }

        if (isFirstDraw) {
          // Animate the line in (matches the Leaflet polyline+dot reveal).
          await animatePath(id, coordinates, color);
        } else {
          // Bump the token so any animation still running from the initial
          // draw bails out instead of overwriting these new coords.
          _animateToken++;
        }


        // Add hover events
        map.on("mouseenter", `${id}-layer`, (e) => {
          map.getCanvas().style.cursor = "pointer";

          const coordinates = e.features[0].geometry.coordinates;
          const distance = turf.length(turf.lineString(coordinates), { units: "kilometers" }).toFixed(2);

          const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
          })
            .setLngLat(e.lngLat)
            .setHTML(
              `
              <strong style="color:rgb(59, 59, 59);">Index Values</strong><br>
              <strong>TSI </strong> ${document.getElementById("tsi-value").textContent}<br>
              <strong>SDI </strong> ${document.getElementById("sdi-value").textContent}<br>
              <strong>E2I </strong> ${document.getElementById("e2i-value").textContent}<br>
              <strong>OPI </strong> ${document.getElementById("opi-value").textContent}<br>
              <strong>PEI </strong> ${document.getElementById("pei-value").textContent}<br>
              <strong>Distance </strong> ${distance} km
            `
            )
            .addTo(map);

          const popupElement = popup.getElement();
          Object.assign(popupElement.style, {
            padding: "10px",
            borderRadius: "10px",
            fontSize: "14px",
            color: "#333",
            shadow: "0px 2px 5px rgba(0, 0, 0, 0.5)",
          });

          console.log(`Path ID: ${id}, Distance: ${distance} km`);
        });

        map.on("mouseleave", `${id}-layer`, () => {
          map.getCanvas().style.cursor = "";
          const popups = document.getElementsByClassName('mapboxgl-popup');
          if (popups.length) {
            popups[0].remove();
          }
        });
      }
      
      // Calculate population count after drawing the route
      await getPopulationCountFromRoute();
      
      // Draw the route on the elevation map with our enhanced function
      await drawRouteOnElevationMap(ffiPath);
      
      // Ensure coordinates table is updated with the final path
      populateCoordinatesTable();
      
      // Generate elevation profile
      await generateElevationProfile();
      
      // Now that all animations and calculations are complete, update the export dashboard
      if (isExportDashboardOpen) {
        updateExportDashboardContent();
      }
      
      // Enable the export button now that animation is complete
      exportButton.style.filter = "brightness(100%)";
      exportButton.style.cursor = "pointer";
      
      // Zoom main map to route bounds
      const bounds = turf.bbox({
        type: "Feature",
        geometry: { type: "LineString", coordinates: ffiPath }
      });
      map.fitBounds(bounds, { padding: 100, maxZoom: 6 });
    }

    // Update rail lines dynamically when sliders are adjusted.
    // Debounce the input event so dragging a slider doesn't fire dozens of
    // A* recomputes + MapLibre source mutations + elevation API calls per
    // second (which freezes the main map on the heavy non-Leaflet stack).
    const sliders = ["e2i-filter", "ffi-filter", "opi-filter", "tsi-filter", "sdi-filter", "pei-filter"];
    let _routeRecalcTimer = null;
    sliders.forEach((sliderId) => {
      const slider = document.getElementById(sliderId);
      if (slider) { // Check if slider exists
        // Remove existing listeners to prevent duplicates
        const newSlider = slider.cloneNode(true);
        if (slider.parentNode) {
          slider.parentNode.replaceChild(newSlider, slider);
        }

        newSlider.addEventListener("input", () => {
          // Disable export button during recalculation
          exportButton.style.filter = "brightness(30%)";
          exportButton.style.cursor = "not-allowed";

          if (!originMatch || !destinationMatch) return;
          clearTimeout(_routeRecalcTimer);
          _routeRecalcTimer = setTimeout(async () => {
            const originCoords = [parseFloat(originMatch[2]), parseFloat(originMatch[1])];
            const destinationCoords = [parseFloat(destinationMatch[2]), parseFloat(destinationMatch[1])];
            await drawRailLines(originCoords, destinationCoords);
          }, 250);
        });
      }
    });

    // Draw the initial route
    await drawRailLines(originCoords, destinationCoords);

    // Hide the loading bar after the route is loaded
    loadingBar.style.width = "100%";
    setTimeout(() => {
      loadingBar.style.display = "none";
    }, 100);
  } else {
    alert("Invalid coordinates. Please ensure the inputs are in the correct format.");
    loadingBar.style.display = "none"; // Hide the loading bar in case of an error
    
    // Re-enable export button in case of error
    exportButton.style.filter = "brightness(30%)";
    exportButton.style.cursor = "pointer";
  }
});





// report window
const exportDashboardContainer = document.createElement("div");
exportDashboardContainer.style.position = "fixed";
exportDashboardContainer.style.bottom = "-1000px";
exportDashboardContainer.style.left = "50%";
exportDashboardContainer.style.transform = "translateX(-50%)";
exportDashboardContainer.style.width = "90%";
exportDashboardContainer.style.maxWidth = "800px";
exportDashboardContainer.style.opacity = 0.95;
exportDashboardContainer.style.backgroundColor = "white";
exportDashboardContainer.style.boxShadow = "2px 0 5px rgba(0, 0, 0, 0.2)";
exportDashboardContainer.style.zIndex = "3000";
exportDashboardContainer.style.overflowY = "auto";
exportDashboardContainer.style.maxHeight = "calc(100vh - 100px)"; // Increased visible area on mobile
exportDashboardContainer.style.borderTopRightRadius = "10px";
exportDashboardContainer.style.borderTopLeftRadius = "10px";
exportDashboardContainer.style.scrollbarWidth = "thin"; 
exportDashboardContainer.style.scrollbarColor = "#ccc transparent";
exportDashboardContainer.style.transition = "bottom 0.3s ease"; 

// bg overlay
const blackBgOverlay = document.createElement("div");
blackBgOverlay.style.position = "fixed";
blackBgOverlay.style.top = "0";
blackBgOverlay.style.left = "0";
blackBgOverlay.style.width = "100%";
blackBgOverlay.style.height = "100%";
blackBgOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
blackBgOverlay.style.zIndex = "2999";
blackBgOverlay.style.display = "none"; // Initially hidden
blackBgOverlay.style.transition = "opacity 0.3s ease";
document.body.appendChild(blackBgOverlay);

// mobile adjustments
const updateDashboardLayout = () => {
  if (window.innerWidth <= 768) { // Mobile breakpoint
    exportDashboardContainer.style.width = "95%";
    exportDashboardContainer.style.maxHeight = "80vh";
    exportDashboardContainer.style.borderTopRightRadius = "10px";
    exportDashboardContainer.style.borderTopLeftRadius = "10px";
  } else {
    exportDashboardContainer.style.width = "90%";
    exportDashboardContainer.style.maxHeight = "calc(100vh - 100px)";
  }
};

updateDashboardLayout();
window.addEventListener('resize', updateDashboardLayout);

document.body.appendChild(exportDashboardContainer);

// scrollbar
const exportStyle = document.createElement("style");
exportStyle.textContent = `
          #exportDashboardContainer::-webkit-scrollbar {
            width: 6px;
          }
          #exportDashboardContainer::-webkit-scrollbar-thumb {
            background-color: #ccc;
            border-radius: 3px;
          }
          #exportDashboardContainer::-webkit-scrollbar-track {
            background: transparent;
          }
        `;
document.head.appendChild(exportStyle);
exportDashboardContainer.id = "exportDashboardContainer";

// toggle report dashboard
let isExportDashboardOpen = false;
exportButton.addEventListener("click", () => {
  if (isExportDashboardOpen) {
    exportDashboardContainer.style.bottom = "-1000px"; // Slide out
    blackBgOverlay.style.opacity = "0"; // Fade out black background
    setTimeout(() => {
      blackBgOverlay.style.display = "none"; // Hide after transition
    }, 300);
  } else {
    exportDashboardContainer.style.bottom = "0"; // Slide in
    blackBgOverlay.style.display = "block"; // Show black background
    setTimeout(() => {
      blackBgOverlay.style.opacity = "1"; // Fade in
    }, 0);
    updateExportDashboardContent();
    // Generate the snapshot once the dashboard is visible (the map needs
    // to actually render before getCanvas().toDataURL() returns the right
    // image). Wrapped in try/catch so a snapshot failure can't break the
    // dashboard open.
    setTimeout(() => {
      try {
        if (typeof __regenerateSnapshot === "function") __regenerateSnapshot();
      } catch (e) { console.warn("snapshot:", e.message); }
    }, 350);
  }
  isExportDashboardOpen = !isExportDashboardOpen;
});

// report Title
const exportDashboardTitle = document.createElement("h2");
exportDashboardTitle.textContent = "OVERVIEW";
exportDashboardTitle.style.fontWeight = "bold";
// exportDashboardTitle.style.marginBottom = "30px";
exportDashboardTitle.style.marginTop = "35px";
exportDashboardTitle.style.marginLeft = "30px";
exportDashboardTitle.style.fontSize = "32px";
exportDashboardTitle.style.color = "#333";
exportDashboardTitle.style.letterSpacing = "3px"; //kerning
exportDashboardContainer.appendChild(exportDashboardTitle);

// distance of route
const distanceContainer = document.createElement("div");
distanceContainer.style.marginTop = "-20px";
distanceContainer.style.marginBottom = "-10px";
distanceContainer.style.marginLeft = "30px";
distanceContainer.style.fontSize = "16px";
distanceContainer.style.color = "rgb(109, 109, 109)";
distanceContainer.style.fontWeight = "bold";

map.on("sourcedata", () => {
  const ffiPath = map.getSource("ffi-path")?._data?.geometry?.coordinates || [];
  if (ffiPath.length > 0) {
    const distanceKm = turf.length(turf.lineString(ffiPath), { units: "kilometers" }).toFixed(2);
    const distanceMiles = (distanceKm * 0.621371).toFixed(2);
    distanceContainer.innerHTML = `Total Distance <span style="color: orange;">${distanceKm} km / ${distanceMiles} mi</span>`;
  } else {
    distanceContainer.textContent = "Total Distance N/A";
  }
});

exportDashboardContainer.appendChild(distanceContainer);

const getValue = (id) => {
  const el = document.getElementById(id);
  return el ? el.textContent.trim() : "N/A";
};

// Main container (flex row layout)
const exportDashboardContent = document.createElement("div");
exportDashboardContent.style.display = "flex";
exportDashboardContent.style.gap = "30px";
exportDashboardContent.style.margin = "30px";
exportDashboardContent.style.alignItems = "flex-start";

// Close button
const closeButton = document.createElement("img");
closeButton.src = "images/cross.svg";
closeButton.alt = "Close Report";
closeButton.style.position = "absolute";
closeButton.style.top = "20px";
closeButton.style.right = "10px";
closeButton.style.cursor = "pointer";
closeButton.style.width = "30px";
closeButton.style.height = "30px";
closeButton.style.zIndex = "3001";
closeButton.style.filter = "grayscale(100%)";
closeButton.style.opacity = "0.5";
closeButton.addEventListener("click", () => {
  exportDashboardContainer.style.bottom = "-1000px";
  blackBgOverlay.style.opacity = "0"; // Fade out black background
  setTimeout(() => {
    blackBgOverlay.style.display = "none"; // Hide after transition
  }, 300);
  isExportDashboardOpen = false;
});
exportDashboardContainer.appendChild(closeButton);

// Share button
const shareButton = document.createElement("img");
shareButton.src = "images/share.svg";
shareButton.alt = "Export Report";
shareButton.style.position = "absolute";
shareButton.style.top = "22.5px";
shareButton.style.right = "50px";
shareButton.style.cursor = "pointer";
shareButton.style.width = "25px";
shareButton.style.height = "25px";
shareButton.style.zIndex = "3001";
shareButton.style.backgroundColor = "orange";
shareButton.style.borderRadius = "50%";
shareButton.style.padding = "5px";
// shareButton.addEventListener('click', () => {
//   alert('Share functionality is not implemented yet.');
// });
exportDashboardContainer.appendChild(shareButton);

// LEFT: Snapshot and description - limit to 100 words
// Replace route_snap_test.png with a dynamic snapshot of the route, always square
const snapshotContainer = document.createElement("div");
snapshotContainer.style.flex = "0.55";

// Snapshot of the map for the report panel. Was: map.on("sourcedata", ...
// map.once("idle", ... toDataURL ...)) — that fires on every source update
// (~30+ times during normal use), each one queuing an expensive whole-map
// canvas capture. Refactored to a function called on demand from the
// dashboard-open click handler.
function __regenerateSnapshot() {
  if (!map.getSource("ffi-path")) return;
  const snapshotDataURL = map.getCanvas().toDataURL("image/png");
  const elevationProfile = [];
  const ffiPath = map.getSource("ffi-path")._data.geometry.coordinates;
  if (ffiPath && ffiPath.length > 0) {
    try {
      const canvas = elevationChartContainer.querySelector("canvas");
      if (canvas) {
        const chart = Chart.getChart(canvas);
        if (chart && chart.data && chart.data.datasets && chart.data.datasets[0] && chart.data.datasets[0].data) {
          const elevationData = chart.data.datasets[0].data;
          for (let i = 0; i < ffiPath.length; i++) {
            elevationProfile.push({ elevation: elevationData[i] || 0 });
          }
        }
      }
    } catch (error) {
      console.error("Error accessing elevation data:", error);
    }
  }
  const minElevation = elevationProfile.length > 0 ?
    Math.min(...elevationProfile.map((p) => p.elevation || 0)) : 0;
  const maxElevation = elevationProfile.length > 0 ?
    Math.max(...elevationProfile.map((p) => p.elevation || 0)) : 50;

  void minElevation; void maxElevation; // available if you want to embed in the description
  snapshotContainer.innerHTML = `
    <img src="${snapshotDataURL}" alt="Route top view" style="width: 100%; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
    <p style="margin-top: 28px; color: #666; font-size: 14px; line-height: 1.5;">
      The proposed route spans a total distance of <strong style="color: #f67a0a;"> ${distanceContainer.textContent.replace("Total Distance ", "")}</strong>, connecting the origin at <strong style="color: #f67a0a;">${originInput.value || "N/A"}</strong> to the destination at <strong style="color: #f67a0a;">${destinationInput.value || "N/A"}</strong>.
      <br><br>
      The feasibility of this route is underscored by its overall Feasibility Score of <strong style="color: #f67a0a;">${getValue("ffi-value")}</strong>, which integrates critical indexes such as the Tsunami Risk Index at <strong style="color: #f67a0a;">${getValue("tsi-value")}</strong>, Structure Durability Index at <strong style="color: #f67a0a;">${getValue("sdi-value")}</strong>, Environmental Impact Index at <strong style="color: #f67a0a;">${getValue("e2i-value")}</strong>, Operability Index at <strong style="color: #f67a0a;">${getValue("opi-value")}</strong>, and Population-Economic Importance Index <strong style="color: #f67a0a;">${getValue("pei-value")}</strong>.
      <br><br>
      Serving an estimated population of <strong style="color: #f67a0a;">${getValue("population-served")}</strong> along its corridor, this route holds
      <strong style="color: #f67a0a;">${(() => {
        const population = parseInt(getValue("population-served").replace(/,/g, ""));
        if (population > 500000) return "highly significant";
        else if (population >= 300000) return "adequately significant";
        else if (population >= 100000) return "moderately significant";
        else return "inadequately significant";
      })()}</strong> potential for enhancing regional connectivity and economic integration.
    </p>
    <p style="margin-top: 10px; color: rgb(31, 31, 31); font-size: 9px; font-weight: bold; text-align: justify;">Description generated automatically.</p>
  `;
}

exportDashboardContent.appendChild(snapshotContainer);

// RIGHT: Index Scores - N/A if no route
const scoreContainer = document.createElement("div");
scoreContainer.style.flex = "0.45";
scoreContainer.innerHTML = `
  <div style="margin-right: 30px; display: flex; flex-direction: column; gap: 10px;">
    
    <div style="margin-left: -15px; display: flex; align-items: center; gap: 0px;">
  <img src="./images/marker_o.svg" alt="Origin" style="width: 40px; height: 40px;">
  <span style="font-weight: bold; color: rgb(133, 133, 133); letter-spacing: 3px; font-size: 21px;">ORIGIN</span>
    </div>
    
    <div style="margin-bottom: 5px;font-size: 16px; color: rgb(109, 109, 109);">${originInput.value || "N/A"}</div>

    <div style="margin-left: -15px; display: flex; align-items: center; gap: 0px;">
  <img src="./images/marker_d.svg" alt="Destination Marker" style="width: 40px; height: 40px;">
  <span style="font-weight: bold; color: rgb(133, 133, 133); letter-spacing: 3px; font-size: 21px;">DESTINATION</span>
    </div>
    
    <div style="font-size: 16px; color: rgb(109, 109, 109);">${destinationInput.value || "N/A"}</div>
  <br>
    <div style="display: flex; justify-content: space-between;">
  <span style="font-weight: bold; color: rgb(133, 133, 133); letter-spacing: 3px; font-size: 21px;">INDEXES</span>
    </div>

    <div>
  <div style="margin-top: 2px; display: flex; justify-content: space-between;">
    <span style="font-weight: bold; color: rgb(109, 109, 109);">Tsunami Risk Index</span>
  </div>
  <small style="color: rgb(161, 161, 161); font-weight: medium;">The higher, the better.</small>
  
  <div style="text-align: right; font-size: 16px; color: rgb(182, 182, 182); font-weight: bold;">${getValue(
    "tsi-value"
  )} <span style="font-size: 20px; color: rgb(119, 119, 119);">/ 1</span></div>
    </div>

    <div>
  <div style="margin-top: 0px; display: flex; justify-content: space-between;">
    <span style=" font-weight: bold; color: rgb(109, 109, 109);">Structure Durability Index</span>
  </div>
  <small style="color: rgb(161, 161, 161); font-weight: medium;">The higher, the better.</small>

  <div style="text-align: right; font-size: 16px; color: rgb(182, 182, 182); font-weight: bold;">${getValue(
    "sdi-value"
  )} <span style="font-size: 20px; color: rgb(119, 119, 119);">/ 1</span></div>
    </div>

    <div>
  <div style="margin-top: 0px; display: flex; justify-content: space-between;">
    <span style="font-weight: bold; color: rgb(109, 109, 109);">Environment Impact Index</span>
  </div>
  <small style="color: rgb(161, 161, 161); font-weight: medium;">The higher, the better.</small>

  <div style="text-align: right; font-size: 16px; color: rgb(182, 182, 182); font-weight: bold;">${getValue(
    "e2i-value"
  )} <span style="font-size: 20px; color: rgb(119, 119, 119);">/ 1</span></div>
    </div>

    <div>
  <div style="margin-top: 0px; display: flex; justify-content: space-between;">
    <span style="font-weight: bold; color: rgb(109, 109, 109);">Operability Index</span>
  </div>
  <small style="color: rgb(161, 161, 161); font-weight: medium;">The higher, the better.</small>

  <div style="text-align: right; font-size: 16px; color: rgb(182, 182, 182); font-weight: bold;">${getValue(
    "opi-value"
  )} <span style="font-size: 20px; color: rgb(119, 119, 119);">/ 1</span></div>
    </div>

    <div>
  <div style="margin-top: 0px; display: flex; justify-content: space-between;">
    <span style="font-weight: bold; color: rgb(109, 109, 109);">Population-Economic Index</span>
  </div>
  <small style="color: rgb(161, 161, 161); font-weight: medium;">The higher, the better.</small>

  <div style="text-align: right; font-size: 16px; color: rgb(182, 182, 182); font-weight: bold;">${getValue(
    "pei-value"
  )} <span style="font-size: 20px; color: rgb(119, 119, 119);">/ 1</span></div>
    </div>

    <div style="margin-top: 0px; border: 2px solid #f67a0a; padding: 10px 12px; background-color: #fff8f0;">
  <div>
    <div style="font-weight: bold; color: #f67a0a;">Feasibility Score</div>
    <small style="color: rgb(155, 155, 155); font-weight: medium;">The higher, the better.</small>

    <div style="text-align: right; font-size: 18px; color: #f67a0a; font-weight: bold;">${getValue(
      "ffi-value"
    )} <span style="font-size: 20px; color: rgb(119, 119, 119);">/ 1</span></div>
  </div>
    </div>
    
    <div style="border: 2px solid #019cde; padding: 10px 12px; margin-top: 10px; background-color:rgb(240, 253, 255);">
  <div>
    <div style="font-weight: bold; color: #019cde;">Population Served</div>
    <small style="color: rgb(155, 155, 155); font-weight: medium;">Number of people impacted along the Origin-Destination corridor. Value is an approximation and may not reflect actual numbers.</small>
    <div style="text-align: right; font-size: 18px; color: #019cde; font-weight: bold;">${getValue(
      "population-served"
    )} <span style="font-size: 20px; color: rgb(119, 119, 119);">People</span></div>
  </div>
    </div>

  </div>
      `;
exportDashboardContent.appendChild(scoreContainer);
exportDashboardContainer.appendChild(exportDashboardContent);

// Bottom of exportDashboardContainer elevation query of line
const elevationQueryContainer = document.createElement("div");
elevationQueryContainer.style.marginTop = "20px";
elevationQueryContainer.style.marginLeft = "30px";
elevationQueryContainer.style.padding = "0px";

const elevationQueryTitle = document.createElement("h3");
elevationQueryTitle.textContent = "Elevation Profile";
elevationQueryTitle.style.marginBottom = "10px";
elevationQueryTitle.style.marginLeft = "0px";
elevationQueryTitle.style.color = "rgb(133, 133, 133)";
elevationQueryTitle.style.fontSize = "21px";
elevationQueryTitle.style.fontWeight = "bold";
elevationQueryTitle.style.letterSpacing = "3px";
elevationQueryTitle.style.textTransform = "uppercase";
elevationQueryContainer.appendChild(elevationQueryTitle);

const elevationQueryDescription = document.createElement("p");
elevationQueryDescription.textContent =
  "Deriving the elevation of the route through 3D terrain enables a detailed assessment of elevation changes, including steep ascents, descents, and plateau regions. By evaluating these gradients, feasibility can be determined, so as infrastructure requirements such as bridges or tunnels.";
elevationQueryDescription.style.color = "#666";
elevationQueryDescription.style.marginRight = "30px";
elevationQueryDescription.style.fontSize = "14px";
elevationQueryDescription.style.lineHeight = "1.5";
elevationQueryContainer.appendChild(elevationQueryDescription);

const elevationChartContainer = document.createElement("div");
elevationChartContainer.style.marginTop = "20px";
elevationChartContainer.style.height = "200px";
elevationChartContainer.style.width = "96%";
elevationChartContainer.style.background = "#f0f0f0";
elevationQueryContainer.appendChild(elevationChartContainer);

const generateElevationProfile = async () => {
  const ffiPath = map.getSource("ffi-path")?._data?.geometry?.coordinates || [];
  elevationChartContainer.innerHTML = ""; // Clear previous chart
  const canvas = document.createElement("canvas");
  elevationChartContainer.appendChild(canvas);

  if (ffiPath.length === 0) {
    // Show empty chart with no data
    new Chart(canvas, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Elevation (m)",
            data: [],
            borderColor: "#f67a0a",
            backgroundColor: "rgba(246, 122, 10, 0.2)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          title: {
            display: true,
            align: "start",
            text: "Elevation (m)",
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              display: true,
            },
            title: {
              display: false,
              text: "Stations",
            },
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              display: false,
            },
            beginAtZero: true,
            min: 0,
            title: {
              display: false,
              text: "Elevation (m)",
            },
          },
        },
        layout: {
          padding: {
            top: 6,
            right: 20,
            bottom: 10,
            left: 20,
          },
        },
      },
    });
    return;
  }

  try {
    // Single batched call through the multi-source elevation chain.
    const elevations = await __fetchElevations(ffiPath);
    const elevationData = ffiPath.map((coord, i) => ({ coord, elevation: elevations[i] || 0 }));

    const elevationProfile = elevationData.map(({ coord, elevation }, index) => ({
      distance: index, // Use index as a proxy for distance
      elevation,
    }));

    // clear old markers
    const oldMarkers = document.querySelectorAll(".elevation-marker");
    oldMarkers.forEach((marker) => marker.remove());

    // markers for each point on the elevation map
    elevationData.forEach(({ coord }, index) => {
      let markerElement;
      
      if (index === 0) {
      // Origin marker
      markerElement = document.createElement("img");
      markerElement.src = "images/marker_o.svg";
      markerElement.alt = "Origin";
      markerElement.style.width = "30px";
      markerElement.style.height = "30px";
      } else if (index === elevationData.length - 1) {
      // Destination marker
      markerElement = document.createElement("img");
      markerElement.src = "images/marker_d.svg";
      markerElement.alt = "Destination";
      markerElement.style.width = "30px";
      markerElement.style.height = "30px";
      } else {
      // Calculate color interpolation for intermediate points
      const t = index / (elevationData.length - 1);
      
      // Interpolate color from blue (origin) to red (destination)
      const startColor = [1, 156, 222];   // #019cde (blue)
      const endColor = [233, 82, 71];     // #e95247 (red)
      
      const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * t);
      const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * t);
      const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * t);
      
      const interpolatedColor = `rgb(${r}, ${g}, ${b})`;
      
      // Create colored dot marker
      markerElement = document.createElement("div");
      markerElement.style.width = "18px";
      markerElement.style.height = "18px";
      markerElement.style.borderRadius = "50%";
      markerElement.style.backgroundColor = interpolatedColor;
      markerElement.style.border = "1px solid white";
      markerElement.style.boxShadow = "0px 2px 4px rgba(0,0,0,0.3)";
      markerElement.style.display = "flex";
      markerElement.style.justifyContent = "center";
      markerElement.style.alignItems = "center";
      markerElement.style.color = "white";
      markerElement.style.fontSize = "10px";
      markerElement.style.fontWeight = "bold";
      markerElement.innerText = index;
      markerElement.alt = "Intermediate";
      }
      
      markerElement.classList.add("elevation-marker"); // Add a class for easy removal
      
      const marker = new mapboxgl.Marker({
      element: markerElement
      })
      .setLngLat(coord)
      .addTo(elevationMap);
    });

    // marker on hover over corresponding point in elevation chart
    canvas.addEventListener("mousemove", (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const chart = Chart.getChart(canvas);
      if (chart) {
        const points = chart.getElementsAtEventForMode(event, "nearest", { intersect: true }, false);

        if (points.length > 0) {
          const pointIndex = points[0].index;
          const { coord } = elevationData[pointIndex];
          const marker = document.querySelectorAll(".elevation-marker")[pointIndex];

          // Highlight the marker
          marker.style.filter = "brightness(30%)";

            // Remove any existing tooltips
            const existingTooltips = document.querySelectorAll(".elevation-tooltip");
            existingTooltips.forEach((tooltip) => tooltip.remove());

            // Show coordinates in a tooltip
            const tooltip = document.createElement("div");
            tooltip.className = "elevation-tooltip";
            tooltip.style.position = "absolute";
            tooltip.style.padding = "5px";
            tooltip.style.backgroundColor = "black";
            tooltip.style.borderRadius = "7px";
            tooltip.style.boxShadow = "0px 2px 5px rgba(0, 0, 0, 0.2)";
            tooltip.style.fontSize = "12px";
            tooltip.style.zIndex = "3100";
            tooltip.style.color = "white";
            tooltip.style.opacity = "0.8";
            tooltip.style.pointerEvents = "none";
            tooltip.style.left = `${event.pageX - 140}px`;
            tooltip.style.top = `${event.pageY + 32}px`;
            tooltip.innerHTML = `<strong>Latitude</strong> ${coord[1].toFixed(5)} <br> <strong>Longitude</strong> ${coord[0].toFixed(5)}`;
            tooltip.style.lineHeight = "18px";
            document.body.appendChild(tooltip);

          // Remove tooltip on mouseout
          canvas.addEventListener("mouseout", () => {
            marker.style.filter = "brightness(100%)";
            tooltip.remove();
          });
        }
      }
    });

    // line chart with Chart.js
    new Chart(canvas, {
      type: "line",
      data: {
        labels: elevationProfile.map((point) => `Point ${point.distance}`),
        datasets: [
          {
            label: "Elevation (m)",
            data: elevationProfile.map((point) => point.elevation),
            borderColor: "#f67a0a",
            backgroundColor: "rgba(246, 122, 10, 0.2)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          title: {
            display: true,
            align: "start",
            text: "Elevation (m)",
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              display: false,
            },
            title: {
              display: true,
              text: "Stations",
            },
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              display: true,
            },
            beginAtZero: true,
            min: 0,
            title: {
              display: false,
              text: "Elevation (m)",
            },
          },
        },
        layout: {
          padding: {
            top: 6,
            right: 20,
            bottom: 10,
            left: 20,
          },
        },
      },
    });
  } catch (error) {
    elevationChartContainer.innerHTML = "Error generating elevation profile.";
    console.error(error);
  }
};

// (Removed: a `map.on("sourcedata", ...)` auto-trigger that fired
// generateElevationProfile() on every tile load and every setData. During
// animatePath that meant dozens of fires per second — each one refetching
// elevations, rebuilding the Chart.js chart, and adding a fresh batch of
// markers to elevationMap, which is what made the inset "keep redrawing".
// drawRailLines() already invokes generateElevationProfile() once after
// each route is drawn, which is enough.)

generateElevationProfile();

// map below elevation profile
const elevationMapContainer = document.createElement("div");
elevationMapContainer.style.marginBottom = "30px";
elevationMapContainer.style.height = "400px";
elevationMapContainer.style.width = "96%";
elevationMapContainer.style.borderBottomLeftRadius = "10px";
elevationMapContainer.style.borderBottomRightRadius = "10px";
elevationMapContainer.style.background = "#e0e0e0";
elevationQueryContainer.appendChild(elevationMapContainer);

const elevationMap = new mapboxgl.Map({
  container: elevationMapContainer,
  style: {
    version: 8,
    sources: {
      "esri-imagery": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Imagery © Esri",
      },
    },
    layers: [{ id: "imagery", type: "raster", source: "esri-imagery" }],
  },
  center: [120.0, 5.0],
  zoom: 3,
  interactive: false,
  preserveDrawingBuffer: true,
});

// Terrain via free AWS Open Data terrarium DEM (no API key).
elevationMap.on("load", () => {
  elevationMap.addSource("dem", {
    type: "raster-dem",
    tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    encoding: "terrarium",
    tileSize: 256,
    maxzoom: 15,
  });
  elevationMap.setTerrain({ source: "dem", exaggeration: 1.5 });
});

// map resizes properly to fill container
elevationMap.on("load", () => {
  elevationMap.resize();
});

// (Removed two `map.on("sourcedata", ...)` handlers that previously fired on
// every tile/source event on the main map. They unconditionally re-added the
// `ffi-path` source/layer to elevationMap and re-fitBounds'd it — flooding the
// console with "Source 'ffi-path' already exists" and adding a frame of work
// per tile load. drawRouteOnElevationMap() already handles all of this
// idempotently when the route is computed or updated.)

exportDashboardContainer.appendChild(elevationQueryContainer);


// add container below elevation query, title path coordinates, container margin top and bottom 30 px. add all the coordinates of the path - origin, then interpolate number of intermediate points, then destination in a table without grid lines

// Path coordinates container
const pathCoordinatesContainer = document.createElement("div");
pathCoordinatesContainer.style.marginTop = "30px";
pathCoordinatesContainer.style.marginBottom = "30px";
pathCoordinatesContainer.style.marginLeft = "30px";
pathCoordinatesContainer.style.marginRight = "30px";

const pathCoordinatesTitle = document.createElement("h3");
pathCoordinatesTitle.textContent = "Path Coordinates";
pathCoordinatesTitle.style.marginBottom = "10px";
pathCoordinatesTitle.style.marginLeft = "0px";
pathCoordinatesTitle.style.color = "rgb(133, 133, 133)";
pathCoordinatesTitle.style.fontSize = "21px";
pathCoordinatesTitle.style.fontWeight = "bold";
pathCoordinatesTitle.style.letterSpacing = "3px";
pathCoordinatesTitle.style.textTransform = "uppercase";
pathCoordinatesContainer.appendChild(pathCoordinatesTitle);

// coords table 
const coordinatesTable = document.createElement("table");
coordinatesTable.style.width = "100%";
coordinatesTable.style.borderCollapse = "collapse";
coordinatesTable.style.marginTop = "15px";

const tableHeader = document.createElement("thead");
const headerRow = document.createElement("tr");

const pointHeader = document.createElement("th");
pointHeader.textContent = "Point";
pointHeader.style.textAlign = "left";
pointHeader.style.padding = "8px";
pointHeader.style.color = "#666";
pointHeader.style.fontSize = "14px";
pointHeader.style.fontWeight = "bold";

const latHeader = document.createElement("th");
latHeader.textContent = "Latitude";
latHeader.style.textAlign = "left";
latHeader.style.padding = "8px";
latHeader.style.color = "#666";
latHeader.style.fontSize = "14px";
latHeader.style.fontWeight = "bold";

const lngHeader = document.createElement("th");
lngHeader.textContent = "Longitude";
lngHeader.style.textAlign = "left";
lngHeader.style.padding = "8px";
lngHeader.style.color = "#666";
lngHeader.style.fontSize = "14px";
lngHeader.style.fontWeight = "bold";

headerRow.appendChild(pointHeader);
headerRow.appendChild(latHeader);
headerRow.appendChild(lngHeader);
tableHeader.appendChild(headerRow);
coordinatesTable.appendChild(tableHeader);

const tableBody = document.createElement("tbody");

const populateCoordinatesTable = () => {
  tableBody.innerHTML = "";
  
  const ffiPath = map.getSource("ffi-path")?._data?.geometry?.coordinates || [];
  
  if (ffiPath.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.textContent = "No path coordinates available";
    emptyCell.colSpan = 3;
    emptyCell.style.textAlign = "center";
    emptyCell.style.padding = "8px";
    emptyCell.style.color = "#666";
    emptyRow.appendChild(emptyCell);
    tableBody.appendChild(emptyRow);
  } else {
    const MAX_POINTS = 20;
    const step = ffiPath.length <= MAX_POINTS ? 1 : Math.floor(ffiPath.length / MAX_POINTS);
    
    // Always include origin
    const addPoint = (index, label) => {
      const coord = ffiPath[index];
      const row = document.createElement("tr");
      
      const pointCell = document.createElement("td");
      pointCell.textContent = label;
      pointCell.style.padding = "8px";
      pointCell.style.color = "#666";
      pointCell.style.fontSize = "14px";
      pointCell.style.borderBottom = "1px solid #f0f0f0";
      
      const latCell = document.createElement("td");
      latCell.textContent = coord[1].toFixed(6);
      latCell.style.padding = "8px";
      latCell.style.color = "#666";
      latCell.style.fontSize = "14px";
      latCell.style.borderBottom = "1px solid #f0f0f0";
      
      const lngCell = document.createElement("td");
      lngCell.textContent = coord[0].toFixed(6);
      lngCell.style.padding = "8px";
      lngCell.style.color = "#666";
      lngCell.style.fontSize = "14px";
      lngCell.style.borderBottom = "1px solid #f0f0f0";
      
      row.appendChild(pointCell);
      row.appendChild(latCell);
      row.appendChild(lngCell);
      tableBody.appendChild(row);
    };
    
    // Add origin as 0th point
    const firstIndex = 0;
    const originRow = document.createElement("tr");

    const originPointCell = document.createElement("td");
    const originIcon = document.createElement("img");
    originIcon.src = "./images/marker_o.svg";
    originIcon.alt = "Origin";
    originIcon.style.width = "30px";
    originIcon.style.height = "30px";
    originIcon.style.marginRight = "5px";
    originIcon.style.verticalAlign = "middle";
    originPointCell.appendChild(originIcon);
    originPointCell.appendChild(document.createTextNode("Origin"));
    originPointCell.style.padding = "8px";
    originPointCell.style.color = "#666";
    originPointCell.style.fontSize = "14px";
    originPointCell.style.borderBottom = "1px solid #f0f0f0";

    const originLatCell = document.createElement("td");
    originLatCell.textContent = ffiPath[firstIndex][1].toFixed(6);
    originLatCell.style.padding = "8px";
    originLatCell.style.color = "#666";
    originLatCell.style.fontSize = "14px";
    originLatCell.style.borderBottom = "1px solid #f0f0f0";

    const originLngCell = document.createElement("td");
    originLngCell.textContent = ffiPath[firstIndex][0].toFixed(6);
    originLngCell.style.padding = "8px";
    originLngCell.style.color = "#666";
    originLngCell.style.fontSize = "14px";
    originLngCell.style.borderBottom = "1px solid #f0f0f0";

    originRow.appendChild(originPointCell);
    originRow.appendChild(originLatCell);
    originRow.appendChild(originLngCell);
    tableBody.appendChild(originRow);
    
    // Add intermediate points
    for (let i = step; i < ffiPath.length - 1; i += step) {
      // Calculate color interpolation factor
      const t = i / (ffiPath.length - 1);
      
      // Interpolate color from blue (origin) to red (destination)
      const startColor = [1, 156, 222];   // #019cde (blue)
      const endColor = [233, 82, 71];     // #e95247 (red)
      
      const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * t);
      const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * t);
      const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * t);
      
      const interpolatedColor = `rgb(${r}, ${g}, ${b})`;
      
      const coord = ffiPath[i];
      const row = document.createElement("tr");
      
      const pointCell = document.createElement("td");
      
      // Create dot element with interpolated color
      const dot = document.createElement("div");
      dot.style.width = "12px";
      dot.style.height = "12px";
      dot.style.borderRadius = "50%";
      dot.style.backgroundColor = interpolatedColor;
      dot.style.display = "inline-block";
      dot.style.marginRight = "5px";
      dot.style.verticalAlign = "middle";
      dot.style.border = "1px solid white";
      dot.style.boxShadow = "0px 1px 3px rgba(0,0,0,0.3)";
      
      pointCell.appendChild(dot);
      pointCell.appendChild(document.createTextNode(`Waypoint ${Math.ceil(i/step)}`));
      pointCell.style.padding = "8px";
      pointCell.style.color = "#666";
      pointCell.style.fontSize = "14px";
      pointCell.style.borderBottom = "1px solid #f0f0f0";
      
      const latCell = document.createElement("td");
      latCell.textContent = coord[1].toFixed(6);
      latCell.style.padding = "8px";
      latCell.style.color = "#666";
      latCell.style.fontSize = "14px";
      latCell.style.borderBottom = "1px solid #f0f0f0";
      
      const lngCell = document.createElement("td");
      lngCell.textContent = coord[0].toFixed(6);
      lngCell.style.padding = "8px";
      lngCell.style.color = "#666";
      lngCell.style.fontSize = "14px";
      lngCell.style.borderBottom = "1px solid #f0f0f0";
      
      row.appendChild(pointCell);
      row.appendChild(latCell);
      row.appendChild(lngCell);
      tableBody.appendChild(row);
    }
    
    // Always add destination as last point
    const lastIndex = ffiPath.length - 1;
    const row = document.createElement("tr");

    const pointCell = document.createElement("td");
    const icon = document.createElement("img");
    icon.src = "./images/marker_d.svg";
    icon.alt = "Destination";
    icon.style.width = "30px";
    icon.style.height = "30px";
    icon.style.marginRight = "8px";
    icon.style.verticalAlign = "middle";
    pointCell.appendChild(icon);
    pointCell.appendChild(document.createTextNode("Destination"));
    pointCell.style.padding = "8px";
    pointCell.style.color = "#666";
    pointCell.style.fontSize = "14px";
    pointCell.style.borderBottom = "1px solid #f0f0f0";

    const latCell = document.createElement("td");
    latCell.textContent = ffiPath[lastIndex][1].toFixed(6);
    latCell.style.padding = "8px";
    latCell.style.color = "#666";
    latCell.style.fontSize = "14px";
    latCell.style.borderBottom = "1px solid #f0f0f0";

    const lngCell = document.createElement("td");
    lngCell.textContent = ffiPath[lastIndex][0].toFixed(6);
    lngCell.style.padding = "8px";
    lngCell.style.color = "#666";
    lngCell.style.fontSize = "14px";
    lngCell.style.borderBottom = "1px solid #f0f0f0";

    row.appendChild(pointCell);
    row.appendChild(latCell);
    row.appendChild(lngCell);
    tableBody.appendChild(row);
  }
};

// Update table when route is drawn
map.on("sourcedata", () => {
  if (map.getSource("ffi-path")) {
    populateCoordinatesTable();
  }
});

// Initial population
populateCoordinatesTable();

coordinatesTable.appendChild(tableBody);
pathCoordinatesContainer.appendChild(coordinatesTable);
exportDashboardContainer.appendChild(pathCoordinatesContainer);



// // export paths in json
// shareButton.addEventListener("click", () => {
//   const paths = [
//     // {
//     //   id: "e2i-path",
//     //   color: "#00ff00",
//     //   coordinates: map.getSource("e2i-path")?._data?.geometry?.coordinates || [],
//     // },
//     {
//       id: "ffi-path",
//       color: "#ffa500",
//       coordinates: map.getSource("ffi-path")?._data?.geometry?.coordinates || [],
//     },
//     // {
//     //   id: "opi-path",
//     //   color: "#0000ff",
//     //   coordinates: map.getSource("opi-path")?._data?.geometry?.coordinates || [],
//     // },
//   ];

//   // Check if any path has coordinates
//   const hasCoordinates = paths.some((path) => path.coordinates.length > 0);

//   if (!hasCoordinates) {
//     alert("No routes available to export. Please calculate a route first.");
//     return;
//   }

//   const report = JSON.stringify(paths, null, 2);
//   const blob = new Blob([report], { type: "application/json" });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   // a.href = url;
//   // a.download = "rail_feasibility_paths.json";
//   // a.click();
//   URL.revokeObjectURL(url);
// });


// export exportDashboardContainer as pdf when clicked shareButton
shareButton.addEventListener('click', async () => {
  // Check if any route data exists
  if (!map.getSource("ffi-path")) {
    alert("No routes available to export. Please calculate a route first.");
    return;
  }

  // Show loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.style.position = 'absolute';
  loadingIndicator.style.top = '6%';
  loadingIndicator.style.left = '50%';
  loadingIndicator.style.transform = 'translate(-50%, -50%)';
  loadingIndicator.style.padding = '10px';
  loadingIndicator.style.backgroundColor = '#ffffff';
  loadingIndicator.style.boxShadow = '0 0 10px rgba(8, 8, 8, 0.5)';
  loadingIndicator.style.opacity = '0.9';
  loadingIndicator.style.color = '#2e343a';
  loadingIndicator.style.borderRadius = '7px';
  loadingIndicator.style.zIndex = '3002';
  loadingIndicator.style.width = '200px';
  loadingIndicator.style.textAlign = 'center';
  
  const titleText = document.createElement("div");
  titleText.textContent = "Generating Report...";
  titleText.style.marginBottom = "8px";
  titleText.style.fontWeight = "bold";
  loadingIndicator.appendChild(titleText);
  
  const loadingBar = document.createElement("div");
  loadingBar.style.width = "100%";
  loadingBar.style.height = "8px";
  loadingBar.style.backgroundColor = "#eee";
  loadingBar.style.borderRadius = "4px";
  loadingBar.style.overflow = "hidden";
  loadingIndicator.appendChild(loadingBar);

  const loadingBarFill = document.createElement("div");
  loadingBarFill.style.width = "0%";
  loadingBarFill.style.height = "100%";
  loadingBarFill.style.backgroundColor = "#f67a0a";
  loadingBarFill.style.borderRadius = "4px";
  loadingBarFill.style.transition = "width 0.3s ease";
  loadingBar.appendChild(loadingBarFill);

  const percentageText = document.createElement("div");
  percentageText.textContent = "0%";
  percentageText.style.color = "#666";
  percentageText.style.fontSize = "14px";
  percentageText.style.marginTop = "5px";
  loadingIndicator.appendChild(percentageText);
  
  document.body.appendChild(loadingIndicator);
  
  // Start progress animation
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += 5;
    if (progress > 95) {
      clearInterval(progressInterval);
      progress = 95; // Cap at 95% until complete
    }
    loadingBarFill.style.width = `${progress}%`;
    percentageText.textContent = `${progress}%`;
  }, 300);

  try {
    // Dynamically load html2pdf library if not already loaded
    if (typeof html2pdf === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      document.head.appendChild(script);
      
      // Wait for script to load
      await new Promise(resolve => {
        script.onload = resolve;
      });
    }
    
    // IMPORTANT: Capture maps and charts BEFORE creating the clone
    // This ensures we're capturing the actual rendered elements

    // Capture the current map view
    const mapImage = map.getCanvas().toDataURL();
    
    // Capture the elevation chart
    let elevationChartImage = null;
    const chartCanvas = document.querySelector('#exportDashboardContainer div[style*="height: 200px"] canvas');
    if (chartCanvas) {
      elevationChartImage = chartCanvas.toDataURL('image/png');
      console.log("Elevation chart captured:", elevationChartImage.substring(0, 50) + "...");
    } else {
      console.warn("Elevation chart canvas not found");
    }
    
    // Capture current elevation map view
// Replace the existing elevation map capture code in the shareButton event listener:
// Capture current elevation map view with markers
let elevationMapImage = null;
if (elevationMap) {
  try {
    // 1. Make sure map is fully rendered
    await new Promise(resolve => {
      if (elevationMap.loaded()) {
        resolve();
      } else {
        elevationMap.once('idle', resolve);
      }
    });
    
    // 2. Give the map time to render all markers
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 3. Use html2canvas to capture the entire map container with markers
    const mapContainer = elevationMapContainer;
    
    // Load html2canvas if not already loaded
    if (typeof html2canvas === 'undefined') {
      const html2canvasScript = document.createElement('script');
      html2canvasScript.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
      document.head.appendChild(html2canvasScript);
      
      await new Promise(resolve => {
        html2canvasScript.onload = resolve;
      });
    }
    
    // Capture the entire map container including markers
    const canvas = await html2canvas(mapContainer, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      scale: 2,
      logging: false
    });
    
    elevationMapImage = canvas.toDataURL('image/png');
    console.log("Elevation map with markers captured successfully");
  } catch (error) {
    console.error("Error capturing elevation map:", error);
    // Fall back to regular canvas capture
    elevationMapImage = elevationMap.getCanvas().toDataURL('image/png');
  }
} else {
  console.warn("Elevation map not found");
}
    
    // Create a clone of the dashboard to manipulate for PDF
    const dashboardClone = exportDashboardContainer.cloneNode(true);
    dashboardClone.style.width = '750px'; // Fixed width for PDF
    dashboardClone.style.maxWidth = '750px';
    dashboardClone.style.height = 'auto'; 
    dashboardClone.style.maxHeight = 'none';
    dashboardClone.style.position = 'static';
    dashboardClone.style.bottom = 'auto';
    dashboardClone.style.left = 'auto';
    dashboardClone.style.transform = 'none';
    dashboardClone.style.overflow = 'visible';
    dashboardClone.style.backgroundColor = 'white';
    dashboardClone.style.padding = '20px';
    
    // Remove close and share buttons from the clone
    const closeButtonClone = dashboardClone.querySelector('img[alt="Close Report"]');
    if (closeButtonClone) closeButtonClone.remove();
    
    const shareButtonClone = dashboardClone.querySelector('img[alt="Export Report"]');
    if (shareButtonClone) shareButtonClone.remove();

    // Fix layout for main content container in PDF
    const contentContainer = dashboardClone.querySelector('div[style*="display: flex"]');
    if (contentContainer) {
      contentContainer.style.flexDirection = 'column';
      contentContainer.style.gap = '20px';
      
      const columns = contentContainer.querySelectorAll('div[style*="flex:"]');
      columns.forEach(col => {
        col.style.flex = '1';
        col.style.width = '100%';
      });
    }

    // Add report header
    const reportHeader = document.createElement('div');
    reportHeader.style.width = '100%';
    reportHeader.style.padding = '20px';
    reportHeader.style.backgroundColor = '#f67a0a';
    reportHeader.style.color = 'white';
    reportHeader.style.textAlign = 'center';
    reportHeader.style.marginBottom = '30px';
    reportHeader.style.borderRadius = '10px 10px 0 0';
    
    const headerTitle = document.createElement('h1');
    headerTitle.textContent = 'Rail Feasibility Report';
    headerTitle.style.margin = '0';
    headerTitle.style.fontSize = '28px';
    
    const dateTime = document.createElement('p');
    const now = new Date();
    dateTime.textContent = `Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;
    dateTime.style.margin = '5px 0 0 0';
    dateTime.style.fontSize = '14px';
    
    reportHeader.appendChild(headerTitle);
    reportHeader.appendChild(dateTime);
    dashboardClone.insertBefore(reportHeader, dashboardClone.firstChild);
    
    // Create temporary container for the PDF generation
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '800px';
    tempContainer.style.overflow = 'visible';
    document.body.appendChild(tempContainer);
    tempContainer.appendChild(dashboardClone);

    // Replace the elevation chart canvas with the captured image
    if (elevationChartImage) {
      const chartContainerInPDF = dashboardClone.querySelector('div[style*="height: 200px"]');
      if (chartContainerInPDF) {
        // Clear the container first
        chartContainerInPDF.innerHTML = '';
        
        // Create and add the image
        const chartImgElement = document.createElement('img');
        chartImgElement.src = elevationChartImage;
        chartImgElement.style.width = '100%';
        chartImgElement.style.height = '200px';
        chartImgElement.style.objectFit = 'cover';
        chartImgElement.style.borderRadius = '5px';
        chartContainerInPDF.appendChild(chartImgElement);
      }
    }

    // Replace the elevation map with the captured image
    if (elevationMapImage) {
      const mapContainerInPDF = dashboardClone.querySelector('div[style*="height: 400px"]');
      if (mapContainerInPDF) {
        // Clear the container first
        mapContainerInPDF.innerHTML = '';
        
        // Create and add the image
        const mapImgElement = document.createElement('img');
        mapImgElement.src = elevationMapImage;
        mapImgElement.style.width = '100%';
        mapImgElement.style.height = '400px';
        mapImgElement.style.objectFit = 'cover';
        mapImgElement.style.borderRadius = '5px';
        mapContainerInPDF.appendChild(mapImgElement);
      }
    }

    // Wait for all images to load
    const images = tempContainer.querySelectorAll('img');
    await Promise.all(Array.from(images).filter(img => !img.complete).map(img => {
      return new Promise(resolve => {
        img.onload = img.onerror = resolve;
      });
    }));

    // Allow time for layout to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate PDF with settings for a single long page
    const pdfOptions = {
      margin: [10, 10, 10, 10],
      filename: `rail_feasibility_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        logging: true,
        backgroundColor: '#ffffff'
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { mode: ['avoid-all'] }
    };
    
    await html2pdf().from(dashboardClone).set(pdfOptions).save();
    
    // Clean up
    document.body.removeChild(tempContainer);
    document.body.removeChild(loadingIndicator);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again.');
    document.body.removeChild(loadingIndicator);
  }
});
