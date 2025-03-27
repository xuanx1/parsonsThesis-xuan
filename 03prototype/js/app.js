import { combinedCoordinates } from './sea_coord.js';

// main map
const app = d3
  .select("#app")
  .html("")
  .style("position", "fixed")
  .style("inset", "0")
  .style("padding", "0")
  .style("overflow", "hidden");

mapboxgl.accessToken = 'pk.eyJ1IjoieHVhbngxMTEiLCJhIjoiY201dWhwZ2diMTg3dTJrcHRrZGx0eXc4diJ9.6k2pJftWF7A8MMzcVbWshg';
const map = new mapboxgl.Map({
  container: 'map',
  zoom: 4,
  center: [110.0, 5.0], // center of Southeast Asia
  pitch: 60,
  bearing: 40,
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  attributionControl: false,
  maxBounds: [
    [90.0, -15.0], // sw corner bounding box
    [140.0, 25.0]  // ne corner bounding box

    // [91.0, -12.0], // sw corner bounding box
    // [142.0, -12.0], // se corner bounding box
    // [142.0, 30.0], // ne corner bounding box
    // [91.0, 30.0], // nw corner bounding box
    // [91.0, -12.0] // sw corner bounding box
  ],
  minZoom: 1,
  maxZoom: 14
});
map.addControl(new mapboxgl.AttributionControl({
  compact: true,
  customAttribution: '© Mapbox © OpenStreetMap',
}));

// remove country names
map.on('style.load', () => {
  map.getStyle().layers.forEach((layer) => {
    if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  });

  // remove country borders
  map.getStyle().layers.forEach((layer) => {
    if (layer.type === 'line' && layer.id.includes('border')) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  });
});

// Add zoom controls separately
const zoomInButton = document.createElement('button');
zoomInButton.textContent = '+';
zoomInButton.style.position = 'absolute';
zoomInButton.style.top = '10px';
zoomInButton.style.right = '10px';
zoomInButton.style.zIndex = '1000';
zoomInButton.style.width = '30px';
zoomInButton.style.height = '30px';
zoomInButton.style.borderRadius = '20px';
zoomInButton.style.backgroundColor = '#fff';
zoomInButton.style.border = '1px solid #ccc';
zoomInButton.style.cursor = 'pointer';
document.body.appendChild(zoomInButton);

const zoomOutButton = document.createElement('button');
zoomOutButton.textContent = '-';
zoomOutButton.style.position = 'absolute';
zoomOutButton.style.top = '50px';
zoomOutButton.style.right = '10px';
zoomOutButton.style.zIndex = '1000';
zoomOutButton.style.width = '30px';
zoomOutButton.style.height = '30px';
zoomOutButton.style.borderRadius = '20px';
zoomOutButton.style.backgroundColor = '#fff';
zoomOutButton.style.border = '1px solid #ccc';
zoomOutButton.style.cursor = 'pointer';
document.body.appendChild(zoomOutButton);

// Zoom in and out functionality
zoomInButton.addEventListener('click', () => {
  map.zoomIn();
});

zoomOutButton.addEventListener('click', () => {
  map.zoomOut();
});


// compass control
const compassControl = new mapboxgl.NavigationControl({ showZoom: false, visualizePitch: true });
compassControl._container.style.borderRadius = '50%';
compassControl._container.style.overflow = 'hidden';
const compassContainer = document.createElement('div');
compassContainer.style.position = 'absolute';
compassContainer.style.top = '90px';
compassContainer.style.right = '10px';
compassContainer.style.zIndex = '1000';

document.body.appendChild(compassContainer);

compassContainer.appendChild(compassControl.onAdd(map));


// scale
const scaleControl = new mapboxgl.ScaleControl({ minWidth: 200, maxWidth: 300, unit: 'metric' });
map.addControl(scaleControl);

// scale style
const scaleElement = document.querySelector('.mapboxgl-ctrl-scale');
if (scaleElement) {
  scaleElement.style.backgroundColor = 'transparent';
  scaleElement.style.border = '1px solid white';
  scaleElement.style.color = 'white';
  scaleElement.style.fontSize = '12px';


  // convert to ft
  const updateScale = () => {
    const kmText = scaleElement.textContent;
    const kmMatch = kmText.match(/([\d.]+)\s*km/);
    if (kmMatch) {
      const kmValue = parseFloat(kmMatch[1]);
      const feetValue = Math.round(kmValue * 3280.84 / 1000) * 1000; // convert km to feet and round to nearest 1000
      scaleElement.textContent = `${kmValue} km ${feetValue} ft`;
    }
  };

  // Update scale on map move + zoom
  map.on('move', updateScale);
  map.on('zoom', updateScale);

  updateScale();
}


// outline SEA
map.on('load', () => {
  map.addSource('countries', {
    type: 'vector',
    url: 'mapbox://mapbox.country-boundaries-v1'
  });

  map.addLayer({
    id: 'highlight-sea',
    type: 'line',
    source: 'countries',
    'source-layer': 'country_boundaries',
    paint: {
      'line-color': '#ffffff',
      'line-width': 0.5
    },
    filter: ['in', 'iso_3166_1_alpha_3', 'IDN', 'VNM', 'LAO', 'BRN', 'THA', 'MMR', 'PHL', 'KHM', 'TLS', 'SGP', 'MYS']
  });

  // Black out the rest of the world
  map.addLayer({
    id: 'black-world',
    type: 'fill',
    source: 'countries',
    'source-layer': 'country_boundaries',
    paint: {
      'fill-color': '#000000',
      'fill-opacity': 0.7
    },
    filter: ['all',
      ['!in', 'iso_3166_1_alpha_3', 'IDN', 'VNM', 'LAO', 'BRN', 'THA', 'MMR', 'PHL', 'KHM', 'TLS', 'SGP', 'MYS', 'CHN', 'RUS', 'JPN', 'IND', 'PAK', 'KOR', 'ARG', 'BTN', 'IND']
    ]
  });

  // Highlight China and Russia with 0.5 opacity
  map.addLayer({
    id: 'highlight-china-russia',
    type: 'fill',
    source: 'countries',
    'source-layer': 'country_boundaries',
    paint: {
      'fill-color': '#000000',
      'fill-opacity': 0.4
    },
    filter: ['in', 'iso_3166_1_alpha_3', 'CHN', 'RUS', 'JPN', 'IND', 'PAK', 'KOR', 'ARG', 'BTN', 'IND']
  });
});




map.on('style.load', () => {
  map.addSource('mapbox-dem', {
    'type': 'raster-dem',
    'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
    'tileSize': 512,
    'maxzoom': 14
  });
  // add 3d terrain
  map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 2 });  
});

// inset map container
const insetContainer = document.createElement('div');
insetContainer.id = 'inset-map';
insetContainer.style.position = 'absolute';
insetContainer.style.width = '300px';
insetContainer.style.height = '150px';
insetContainer.style.bottom = '10px';
insetContainer.style.right = '10px';
insetContainer.style.border = '2px solid #ccc';
insetContainer.style.zIndex = '1000';
document.body.appendChild(insetContainer);

// Map inset highlighting SEA white and the rest in dark grey
const insetMap = new mapboxgl.Map({
  container: 'inset-map',
  style: 'mapbox://styles/mapbox/dark-v10',
  center: map.getCenter(),
  zoom: 0.1,
  interactive: false,
  attributionControl: false
});

// remove logo from the inset map
const insetLogoElement = document.querySelector('#inset-map .mapboxgl-ctrl-logo');
if (insetLogoElement) {
  insetLogoElement.style.display = 'none'; // Hide the logo
}

// Set label font color to light grey
insetMap.on('style.load', () => {
  insetMap.getStyle().layers.forEach((layer) => {
    if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
      insetMap.setPaintProperty(layer.id, 'text-color', '#d3d3d3'); // Light grey
    }
  });
});

insetMap.on('load', () => {
  insetMap.addSource('countries', {
    type: 'vector',
    url: 'mapbox://mapbox.country-boundaries-v1'
  });
  console.log(insetMap.getStyle().layers);

  insetMap.addLayer({
    id: 'rest-world',
    type: 'fill',
    source: 'countries',
    'source-layer': 'country_boundaries',
    paint: {
      'fill-color': '#2b2b2b',
      'fill-opacity': 0.6
    },
    filter: ['!in', 'iso_3166_1_alpha_3', 'IDN', 'VNM', 'LAO', 'BRN', 'THA', 'MMR', 'PHL', 'KHM', 'TLS', 'SGP', 'MYS']
  });

  insetMap.addLayer({
    id: 'highlight-sea',
    type: 'fill',
    source: 'countries',
    'source-layer': 'country_boundaries',
    paint: {
      'fill-color': '#ffffff',
      'fill-opacity': 0.6
    },
    filter: ['in', 'iso_3166_1_alpha_3', 'IDN', 'LAO', 'BRN', 'THA', 'MMR', 'KHM', 'TLS', 'SGP', 'MYS']
  });

  insetMap.addLayer({
    id: 'highlight-philippines-vietnam',
    type: 'fill',
    source: 'countries',
    'source-layer': 'country_boundaries',
    paint: {
      'fill-color': '#ffffff',
      'fill-opacity': 0.4
    },
    filter: ['in', 'iso_3166_1_alpha_3', 'PHL', 'VNM']
  });

  insetMap.moveLayer('highlight-sea', 'country-label');
  insetMap.moveLayer('highlight-philippines-vietnam', 'country-label');
  insetMap.moveLayer('rest-world', 'country-label');
});

map.on('move', () => {
  insetMap.setCenter(map.getCenter());
  insetMap.setZoom(map.getZoom() - 4);
});


// Adj map container ht to follow win ht
const resizeMap = () => {
  const mapContainer = document.getElementById('map');
  if (mapContainer) {
    mapContainer.style.height = `${window.innerHeight}px`;
  }
};
window.addEventListener('resize', resizeMap);
resizeMap();



  // origin-destination UI + dropdown suggestions
  const originInput = document.createElement("input");
  originInput.type = "text";
  originInput.placeholder = " Origin";
  originInput.style.position = "absolute";
  originInput.style.top = "10px";
  originInput.style.left = "10px";
  originInput.style.zIndex = "1000";
  originInput.style.width = "250px";
  originInput.style.borderRadius = "20px";
  originInput.style.padding = "5px";
  document.body.appendChild(originInput);

  const enableClickButton = document.createElement("button");
  enableClickButton.textContent = "Pinpoint Origin";
  enableClickButton.style.position = "absolute";
  enableClickButton.style.top = "10px";
  enableClickButton.style.left = "270px";
  enableClickButton.style.zIndex = "1000";
  document.body.appendChild(enableClickButton);

  const okButton = document.createElement("button");
  okButton.textContent = "OK";
  okButton.style.position = "absolute";
  okButton.style.top = "10px";
  okButton.style.left = "400px";
  okButton.style.zIndex = "1000";
  okButton.style.display = "none";
  document.body.appendChild(okButton);

  let clickEnabled = false;
  let originMarker = null; // Store the marker for the origin

  enableClickButton.addEventListener("click", () => {
    clickEnabled = true;
    okButton.style.display = "block";
  });

  okButton.addEventListener("click", () => {
    clickEnabled = false;
    okButton.style.display = "none";
  });

  map.on('click', (event) => {
    if (clickEnabled) {
      const coordinates = event.lngLat;

      // Remove the previous marker if it exists
      if (originMarker) {
        originMarker.remove();
      }

      // Add a new marker for the origin
      originMarker = new mapboxgl.Marker({ color: "blue" })
        .setLngLat([coordinates.lng, coordinates.lat])
        .addTo(map);

      // Update the origin input with the clicked location's coordinates
      originInput.value = `Lat: ${coordinates.lat.toFixed(4)}, Lng: ${coordinates.lng.toFixed(4)}`;
    }
  });



  const originClearButton = document.createElement("img");
  originClearButton.src = "images/cross.svg";
  originClearButton.style.filter = "grayscale(100%)";
  originClearButton.alt = "Clear";
  originClearButton.style.position = "absolute";
  originClearButton.style.top = "18px";
  originClearButton.style.left = "235px";
  originClearButton.style.zIndex = "1000";
  originClearButton.style.cursor = "pointer";
  originClearButton.style.display = "none";
  originClearButton.style.width = "16px";
  originClearButton.style.height = "16px";
  originClearButton.addEventListener("click", () => {
    originInput.value = "";
    originClearButton.style.display = "none";

    // Close the dropdown if it is open
    originSuggestionBox.style.display = "none";
  });
  document.body.appendChild(originClearButton);

  originInput.addEventListener("input", () => {
    originClearButton.style.display = originInput.value ? "block" : "none";
  });

  const destinationInput = document.createElement("input");
  destinationInput.type = "text";
  destinationInput.placeholder = " Destination";
  destinationInput.style.position = "absolute";
  destinationInput.style.top = "60px";
  destinationInput.style.left = "10px";
  destinationInput.style.zIndex = "1000";
  destinationInput.style.width = "250px";
  destinationInput.style.borderRadius = "20px";
  destinationInput.style.padding = "5px";
  document.body.appendChild(destinationInput);

  const enableDestinationClickButton = document.createElement("button");
  enableDestinationClickButton.textContent = "Pinpoint Destination";
  enableDestinationClickButton.style.position = "absolute";
  enableDestinationClickButton.style.top = "60px";
  enableDestinationClickButton.style.left = "270px";
  enableDestinationClickButton.style.zIndex = "1000";
  document.body.appendChild(enableDestinationClickButton);

  const destinationOkButton = document.createElement("button");
  destinationOkButton.textContent = "OK";
  destinationOkButton.style.position = "absolute";
  destinationOkButton.style.top = "60px";
  destinationOkButton.style.left = "400px";
  destinationOkButton.style.zIndex = "1000";
  destinationOkButton.style.display = "none";
  document.body.appendChild(destinationOkButton);

  let destinationClickEnabled = false;
  let destinationMarker = null; // Store the marker for the destination

  enableDestinationClickButton.addEventListener("click", () => {
    destinationClickEnabled = true;
    destinationOkButton.style.display = "block";
  });

  destinationOkButton.addEventListener("click", () => {
    destinationClickEnabled = false;
    destinationOkButton.style.display = "none";
  });

  map.on('click', (event) => {
    if (destinationClickEnabled) {
      const coordinates = event.lngLat;

      // Remove the previous marker if it exists
      if (destinationMarker) {
        destinationMarker.remove();
      }

      // Add a new marker for the destination
      destinationMarker = new mapboxgl.Marker({ color: "red" })
        .setLngLat([coordinates.lng, coordinates.lat])
        .addTo(map);

      // Update the destination input with the clicked location's coordinates
      destinationInput.value = `Lat: ${coordinates.lat.toFixed(4)}, Lng: ${coordinates.lng.toFixed(4)}`;
    }
  });



  const destinationClearButton = document.createElement("img");
  destinationClearButton.src = "images/cross.svg";
  destinationClearButton.style.filter = "grayscale(100%)";
  destinationClearButton.alt = "Clear";
  destinationClearButton.style.position = "absolute";
  destinationClearButton.style.top = "68px";
  destinationClearButton.style.left = "225px";
  destinationClearButton.style.zIndex = "1000";
  destinationClearButton.style.cursor = "pointer";
  destinationClearButton.style.display = "none"; 
  destinationClearButton.style.width = "36px";
  destinationClearButton.style.height = "16px";
  destinationClearButton.addEventListener("click", () => {
    destinationInput.value = "";
    destinationClearButton.style.display = "none"; 

    // Close the dropdown if it is open
    destinationSuggestionBox.style.display = "none";
  });
  document.body.appendChild(destinationClearButton);

  destinationInput.addEventListener("input", () => {
    destinationClearButton.style.display = destinationInput.value ? "block" : "none";
  });

  const originSuggestionBox = document.createElement("div");
  originSuggestionBox.style.position = "absolute";
  originSuggestionBox.style.top = "35px";
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
  destinationSuggestionBox.style.top = "85px";
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
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&bbox=90,-15,140,25`;
    fetch(url)
      .then(response => response.json())
      .then(data => {
        const locations = data.features.map(feature => ({
          name: feature.place_name,
          coordinates: feature.center
        }));
        callback(locations);
      })
      .catch(error => console.error("Error fetching locations:", error));
  }

  function handleInput(inputElement, suggestionBox, pinColor) {
    inputElement.addEventListener("input", (event) => {
      const query = event.target.value.toLowerCase();
      suggestionBox.innerHTML = "";
      suggestionBox.style.display = "none";

      if (query.length > 0) {
        fetchLocations(query, (locations) => {
          if (locations.length > 0) {
            suggestionBox.style.display = "block";
            locations.forEach(location => {
              const suggestionItem = document.createElement("div");
              suggestionItem.textContent = location.name;
              suggestionItem.style.padding = "5px";
              suggestionItem.style.cursor = "pointer";
              suggestionItem.style.color = "#2b2b2b"; // Dark grey
              suggestionItem.addEventListener("click", () => {
                inputElement.value = location.name;
                suggestionBox.style.display = "none";

                // Drop a pin on the map
                new mapboxgl.Marker({ color: pinColor })
                  .setLngLat(location.coordinates)
                  .addTo(map);

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

  handleInput(originInput, originSuggestionBox, "blue"); // Blue pin for origin
  handleInput(destinationInput, destinationSuggestionBox, "red"); // Red pin for destination





  const geojsonFiles = [
    'data/th/hotosm_tha_airports_points_geojson.geojson', 
    'data/th/hotosm_tha_railways_lines_geojson.geojson', 
    'data/th/hotosm_tha_sea_ports_points_geojson.geojson', 
  ];

  map.on('style.load', () => {
    geojsonFiles.forEach((file) => {
      fetch(file)
        .then(response => response.json())
        .then((geojson) => {
          map.addSource(file, {
            type: 'geojson',
            data: geojson
          });

          const isLine = file.includes('railways') || file.includes('roads');
          const layerType = isLine ? 'line' : 'circle';

          const paintOptions = file.includes('sea_ports')
            ? {
                'circle-radius': 4,
                'circle-color': '#0000ff', // Blue for seaports
                'circle-opacity': 0.3
              }
            : file.includes('airports')
            ? {
                'circle-radius': 4,
                'circle-color': '#ffff00', // Yellow for airports
                'circle-opacity': 0.3
              }
            : file.includes('railways')
            ? {
                'line-color': '#ff0000', // Red for railways
                'line-width': 3,
                'line-opacity': 0.7
              }
            : file.includes('roads')
            ? {
                'line-color': '#ffa500', // Orange for roads
                'line-width': 3,
                'line-opacity': 0.7
              }
            : {};

          map.addLayer({
            id: `${file}-layer`,
            type: layerType,
            source: file,
            paint: paintOptions
          });
        })
        .catch((error) => {
          console.error(`Failed to load ${file}:`, error);
        });
    });
  });

  // legend
  const legendContainer = document.createElement('div');
  legendContainer.style.position = 'absolute';
  legendContainer.style.bottom = '170px';
  legendContainer.style.right = '25px';
  legendContainer.style.zIndex = '1000';

  legendContainer.style.fontSize = '12px';
  legendContainer.style.color = '#2b2b2b';

  const legendTitle = document.createElement('div');
  legendTitle.style.marginBottom = '5px';
  legendContainer.appendChild(legendTitle);

  const legendItems = [
    { color: '#0000ff', label: 'Seaports' },
    { color: '#ffff00', label: 'Airports' },
    { color: '#ff0000', label: 'Railways' },
    { color: '#ffa500', label: 'Roads' }
  ];

  legendItems.forEach(item => {
    const legendItem = document.createElement('div');
    legendItem.style.display = 'flex';
    legendItem.style.alignItems = 'center';
    legendItem.style.marginBottom = '10px';

    const colorBox = document.createElement('div');
    colorBox.style.width = '12px';
    colorBox.style.height = '12px';
    colorBox.style.backgroundColor = item.color;
    colorBox.style.marginRight = '7px';
    legendItem.appendChild(colorBox);

    const label = document.createElement('span');
    label.textContent = item.label;
    label.style.color = 'white'; 
    legendItem.appendChild(label);

    legendContainer.appendChild(legendItem);
  });

  document.body.appendChild(legendContainer);



  // roads Mapbox
  map.on('load', () => {

    map.addLayer({
      id: 'filtered-roads-layer',
      type: 'line',
      source: {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v8'
      },
      'source-layer': 'road',
      paint: {
        'line-color': '#ffa500', // orange
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          4, 1, // Thin lines at low zoom levels
          10, 3   // Thicker lines at higher zoom levels
        ],
        'line-opacity': 0.6
      },
      filter: ['within', {
        type: 'Polygon',
        coordinates: combinedCoordinates, 
      }]
    });
  });


  // coastlines
  map.on('load', () => {
    map.addSource('sea-coastline', {
      type: 'geojson',
      data: 'data/earth-coastlines.geo.json',
    });

    map.addLayer({
      id: 'sea-coastline-layer',
      type: 'line',
      source: 'sea-coastline',
      paint: {
        'line-color': '#00ffff', // Cyan color for coastline
        'line-width': 1,
        'line-opacity': 0.8,
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

    coastlineToggleContainer
      .append("img")
      .attr("src", "images/coast.svg")
      .attr("alt", "Coastline")
      .style("margin", "5px")
      .style("padding", "5px")
      .style("cursor", "pointer")
      .style("width", "30px")
      .style("height", "30px")
      .style("border", "1px solid #ccc")
      .style("border-radius", "50%")
      .style("background-color", "#00ffff")
      .style("filter", "invert(100%) sepia(100%) saturate(1000%) hue-rotate(180deg) brightness(100%) contrast(100%)")
      .on("click", () => {
        const visibility = map.getLayoutProperty('sea-coastline-layer', 'visibility');
        if (visibility === 'visible') {
          map.setLayoutProperty('sea-coastline-layer', 'visibility', 'none');
        } else {
          map.setLayoutProperty('sea-coastline-layer', 'visibility', 'visible');
        }
      });
  });


  // 100 years earthquake 1923 - 2024
  d3.json("data/worldQuakesMiles.json").then((data) => {
    console.log(data);

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

    map.on('load', () => {
      map.addSource('earthquakes', {
        type: 'geojson',
        data: geoData,
      });

      map.addLayer({
        id: 'earthquake-points',
        type: 'circle',
        source: 'earthquakes',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 0, 4, 5, 5],
          'circle-color': '#ff7900', // Orange
          'circle-opacity': 0.3,
          // 'circle-stroke-width': 1,
          'circle-stroke-color': '#ff7900', // Orange
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

    earthquakeToggleContainer
      .append("img")
      .attr("src", "images/quake.svg")
      .attr("alt", "Earthquakes")
      .style("margin", "5px")
      .style("padding", "5px")
      .style("cursor", "pointer")
      .style("width", "30px")
      .style("height", "30px")
      .style("border", "1px solid #ccc")
      .style("border-radius", "50%")
      .style("background-color", "#ff7900")
      .style("filter", "invert(100%) sepia(100%) saturate(1000%) hue-rotate(0deg) brightness(100%) contrast(100%)")
      .on("click", () => {
      const visibility = map.getLayoutProperty('earthquake-points', 'visibility');
      if (visibility === 'visible') {
        map.setLayoutProperty('earthquake-points', 'visibility', 'none');
      } else {
        map.setLayoutProperty('earthquake-points', 'visibility', 'visible');
      }
      });
  });




  // 100 years tsunami 1923 - 2024
  d3.tsv("data/tsunami.tsv").then((data) => {
    console.log(data);

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

    map.on('load', () => {
            map.addSource('tsunami', {
                    type: 'geojson',
                    data: geoData,
            });

            // tsunami pt
            map.addLayer({
                id: 'tsunami-points',
                type: 'circle',
                source: 'tsunami',
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 0, 4, 10, 20],
                    'circle-color': '#6dbefe', // Teal #00be9d
                    'circle-opacity': 0.4,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#6dbefe', // Teal
                },
            });

            // toggle tsunami
            const toggleContainer = d3
                .select("body") // Changed from "#app" to "body" to ensure it is appended to the correct container
                .append("div")
                .style("position", "absolute")
                .style("top", "125px")
                .style("right", "5px")
                .style("z-index", "1000");

            toggleContainer
              .append("img")
              .attr("src", "images/tsunami.svg")
              .attr("alt", "Tsunami")
              .style("margin", "5px")
              .style("padding", "5px")
              .style("cursor", "pointer")
              .style("width", "30px")
              .style("height", "30px")
              .style("border", "1px solid #ccc")
              .style("border-radius", "50%")
              .style("background-color", "#008080")
              .style("filter", "invert(100%) sepia(100%) saturate(1000%) hue-rotate(180deg) brightness(100%) contrast(100%)") // Apply color filter
              .on("click", () => {
                const visibility = map.getLayoutProperty('tsunami-points', 'visibility');
                if (visibility === 'visible') {
                  map.setLayoutProperty('tsunami-points', 'visibility', 'none');
                } else {
                  map.setLayoutProperty('tsunami-points', 'visibility', 'visible');
                }
              });
    });
});

  // 2024 average humidity heatmap
    // const humidityFiles = [
    //   'data/humidity/humidity_jan.tif',
    //   'data/humidity/humidity_feb.tif',
    //   'data/humidity/humidity_mar.tif',
    //   'data/humidity/humidity_apr.tif',
    //   'data/humidity/humidity_may.tif',
    //   'data/humidity/humidity_jun.tif',
    //   'data/humidity/humidity_jul.tif',
    //   'data/humidity/humidity_aug.tif',
    //   'data/humidity/humidity_sep.tif',
    //   'data/humidity/humidity_oct.tif',
    //   'data/humidity/humidity_nov.tif',
    //   'data/humidity/humidity_dec.tif'
    // ];

    // map.on("load", () => {
    //   map.addSource("geotiff-layer", {
    //   type: "raster",
    //   tiles: ["data/humidity/humidity_jan.tif"],
    //   tileSize: 256,
    //   });
    
    //   map.addLayer({
    //   id: "geotiff-layer",
    //   type: "raster",
    //   source: "geotiff-layer",
    //   paint: {
    //     "raster-opacity": 0.8,
    //   },
    //   });

    //   // Ensure the layer is visible
    //   const visibility = map.getLayoutProperty('geotiff-layer', 'visibility');
    //   if (visibility !== 'visible') {
    //   map.setLayoutProperty('geotiff-layer', 'visibility', 'visible');
    //   }
    // });

  
    // // Add heatmap layer for average humidity
    // map.addSource('average-humidity', {
    //   type: 'geojson',
    //   data: 'data/average_humidity.geojson', // Replace with your processed GeoJSON file
    // });

    // map.addLayer({
    //   id: 'average-humidity-heatmap',
    //   type: 'heatmap',
    //   source: 'average-humidity',
    //   paint: {
    //     'heatmap-weight': ['interpolate', ['linear'], ['get', 'humidity'], 0, 0, 100, 1],
    //     'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
    //     'heatmap-color': [
    //       'interpolate',
    //       ['linear'],
    //       ['heatmap-density'],
    //       0, 'rgba(33,102,172,0)',
    //       0.2, 'rgb(103,169,207)',
    //       0.4, 'rgb(209,229,240)',
    //       0.6, 'rgb(253,219,199)',
    //       0.8, 'rgb(239,138,98)',
    //       1, 'rgb(178,24,43)'
    //     ],
    //     'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
    //     'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 9, 0]
    //   }
    // });


  

//indexes processing
function normalize(value, min, max) {
    return (value - min) / (max - min);
}

function invertScore(score) {
  return 1 - score;
}





// //index - tsi
// function calculateTSI(elevation, distanceFromCoast, tsunamiCount) {
//   let elevationScore = normalize(elevation, 0, 100); // 0-100m elevation
//   let coastlineScore = normalize(distanceFromCoast, 0, 10); // 0-10 km from coast
//   let tsunamiScore = normalize(tsunamiCount, 0, 20); // 0-20 historical tsunamis

//   return (0.2 * elevationScore) + (0.4 * coastlineScore) + (0.4 * invertScore(tsunamiScore));
// }

// // Mock functions to retrieve data for the route
// function getElevationForRoute(start, end) {
//   // Simulate elevation data retrieval based on coordinates
//   const elevationData = {
//     "default": 50, // Default elevation in meters
//     "specific": [
//       { start: [110.0, 5.0], end: [120.0, 10.0], elevation: 80 },
//       { start: [100.0, 0.0], end: [110.0, 5.0], elevation: 30 }
//     ]
//   };

//   const match = elevationData.specific.find(
//     (entry) =>
//       JSON.stringify(entry.start) === JSON.stringify(start) &&
//       JSON.stringify(entry.end) === JSON.stringify(end)
//   );

//   return match ? match.elevation : elevationData.default;
// }

// function getDistanceFromCoastForRoute(start, end) {
//   // Simulate distance from coast data retrieval based on coordinates
//   const distanceData = {
//     "default": 5, // Default distance in kilometers
//     "specific": [
//       { start: [110.0, 5.0], end: [120.0, 10.0], distance: 8 },
//       { start: [100.0, 0.0], end: [110.0, 5.0], distance: 3 }
//     ]
//   };

//   const match = distanceData.specific.find(
//     (entry) =>
//       JSON.stringify(entry.start) === JSON.stringify(start) &&
//       JSON.stringify(entry.end) === JSON.stringify(end)
//   );

//   return match ? match.distance : distanceData.default;
// }

// function getHistoricalTsunamiCountForRoute(start, end) {
//   // Simulate tsunami count data retrieval based on coordinates
//   const tsunamiData = {
//     "default": 3, // Default tsunami count
//     "specific": [
//       { start: [110.0, 5.0], end: [120.0, 10.0], count: 5 },
//       { start: [100.0, 0.0], end: [110.0, 5.0], count: 1 }
//     ]
//   };

//   const match = tsunamiData.specific.find(
//     (entry) =>
//       JSON.stringify(entry.start) === JSON.stringify(start) &&
//       JSON.stringify(entry.end) === JSON.stringify(end)
//   );

//   return match ? match.count : tsunamiData.default;
// }

// // Use the origin and destination coordinates from the input fields
// const originValue = originInput.value;
// const destinationValue = destinationInput.value;

// if (originValue && destinationValue) {
//   const originMatch = originValue.match(/Lat:\s*([\d.-]+),\s*Lng:\s*([\d.-]+)/);
//   const destinationMatch = destinationValue.match(/Lat:\s*([\d.-]+),\s*Lng:\s*([\d.-]+)/);

//   if (originMatch && destinationMatch) {
//     const start = [parseFloat(originMatch[2]), parseFloat(originMatch[1])];
//     const end = [parseFloat(destinationMatch[2]), parseFloat(destinationMatch[1])];

//     let elevation = getElevationForRoute(start, end);
//     let distanceFromCoast = getDistanceFromCoastForRoute(start, end);
//     let tsunamiCount = getHistoricalTsunamiCountForRoute(start, end);
//     let tsi = calculateTSI(elevation, distanceFromCoast, tsunamiCount);
//     console.log("Tsunami Risk Index (TSI):", tsi.toFixed(2));
//   } else {
//     console.error("Invalid coordinates. Please ensure the inputs are in the correct format.");
//   }
// } else {
//   console.error("Please enter both origin and destination.");
// }




// function calculateSDI(distanceFromSeismicZone, elevation, distanceFromCoast, humidity) {
//   let seismicScore = normalize(distanceFromSeismicZone, 0, 150); // >150km = safer
//   let elevationScore = normalize(elevation, 0, 100); // 0-100m elevation
//   let coastlineScore = normalize(distanceFromCoast, 0, 10); // 0-10 km
//   let humidityScore = normalize(humidity, 50, 100); // 50% to 100% relative humidity

//   return (0.4 * seismicScore) + (0.25 * elevationScore) + (0.2 * coastlineScore) + (0.15 * invertScore(humidityScore));
// }

// let distanceFromSeismicZone = getDistanceFromSeismicZoneForRoute(start, end);
// // let elevation = getElevationForRoute(start, end);
// // let distanceFromCoast = getDistanceFromCoastForRoute(start, end);
// let humidity = getHumidityForRoute(start, end);
// let sdi = calculateSDI(distanceFromSeismicZone, elevation, distanceFromCoast, humidity);
// console.log("Structure Durability Index (SDI):", sdi.toFixed(2));


// function calculateE2I(landUseChange, biodiversityImpact) {
//   let landUseScore = normalize(landUseChange, 0, 30); // 0-30% land change
//   let biodiversityScore = normalize(biodiversityImpact, 0, 30); // 0-30% species loss

//   return (0.55 * invertScore(landUseScore)) + (0.45 * invertScore(biodiversityScore));
// }

// let landUseChange = getLandUseChangeForRoute(start, end);
// let biodiversityImpact = getBiodiversityImpactForRoute(start, end);
// let e2i = calculateE2I(landUseChange, biodiversityImpact);
// console.log("Environmental Impact Index (E2I):", e2i.toFixed(2));


// function calculateOPI(elevation, networkDensity, urbanProximity, populationDensity) {
//   let elevationScore = normalize(elevation, 10, 50); // Optimal range 10-50m
//   let networkScore = normalize(networkDensity, 0, 5); // km/km²
//   let urbanScore = normalize(urbanProximity, 0, 50); // 0-50 km from urban area
//   let populationScore = normalize(populationDensity, 500, 5000); // 500-5000 people/km²

//   return (0.24 * elevationScore) + (0.28 * networkScore) + (0.24 * urbanScore) + (0.24 * populationScore);
// }

// // let elevation = getElevationForRoute(start, end);
// let networkDensity = getNetworkDensityForRoute(start, end);
// let urbanProximity = getUrbanProximityForRoute(start, end);
// let populationDensity = getPopulationDensityForRoute(start, end);

// let opi = calculateOPI(elevation, networkDensity, urbanProximity, populationDensity);
// console.log("Operability Index (OPI):", opi.toFixed(2));


// function calculatePEI(populationDensity, landArea, gdpPerCapita) {
//   let populationScore = normalize(populationDensity, 500, 5000); // 500-5000 people/km²
//   let landAreaScore = normalize(Math.log(landArea), Math.log(10), Math.log(1000)); // Normalize log-scaled land area
//   let gdpScore = normalize(gdpPerCapita, 5000, 40000); // $5,000 - $40,000 USD

//   return (0.35 * populationScore) + (0.25 * landAreaScore) + (0.40 * gdpScore);
// }

// //let populationDensity = getPopulationDensityForRoute(start, end);
// let landArea = getLandAreaForRoute(start, end);
// let gdpPerCapita = getGDPPerCapitaForRoute(start, end);
// let pei = calculatePEI(populationDensity, landArea, gdpPerCapita);
// console.log("Population-Economic Importance Index (PEI):", pei.toFixed(2));

// function calculateFFI(tsi, sdi, e2i, opi, pei) {
//   let ffi = (0.20 * tsi) + (0.20 * sdi) + (0.15 * e2i) + (0.25 * opi) + (0.20 * pei);
//   console.log("Final Feasibility Index (FFI):", ffi.toFixed(2));
//   return ffi;
// }




// Draw 3x rail line - 1 colour for each line, but same set of origin and destination - green for highest e2i , orange for hightest ffi, blue for opi - when line appear, grey out everything in the map!

  // Route button to draw the land route between origin and destination with path avoiding high elevations, staying at least 10km away from the coastline, and ensuring all points are on land
  const routeButton = document.createElement("button");
  routeButton.textContent = "Draw Route";
  routeButton.style.position = "absolute";
  routeButton.style.top = "110px";
  routeButton.style.left = "10px";
  routeButton.style.zIndex = "1000";
  document.body.appendChild(routeButton);

  // loading bar
  const loadingBar = document.createElement("div");
  loadingBar.style.position = "absolute";
  loadingBar.style.top = "0";
  loadingBar.style.left = "0";
  loadingBar.style.width = "0";
  loadingBar.style.height = "3px";
  loadingBar.style.backgroundColor = "#00ff00";
  loadingBar.style.zIndex = "1001";
  loadingBar.style.transition = "width 0.3s ease";
  document.body.appendChild(loadingBar);

  routeButton.addEventListener("click", async () => {
    const originValue = originInput.value;
    const destinationValue = destinationInput.value;

    if (!originValue || !destinationValue) {
      alert("Please enter both origin and destination.");
      return;
    }

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
    map.once('sourcedata', () => {
      clearInterval(interval);
      loadingBar.style.width = "100%";
      setTimeout(() => {
        loadingBar.style.display = "none";
      }, 5000);
    });

    // Parse coord from the input fields
    const originMatch = originValue.match(/Lat:\s*([\d.-]+),\s*Lng:\s*([\d.-]+)/);
    const destinationMatch = destinationValue.match(/Lat:\s*([\d.-]+),\s*Lng:\s*([\d.-]+)/);

    if (originMatch && destinationMatch) {
      const originCoords = [parseFloat(originMatch[2]), parseFloat(originMatch[1])];
      const destinationCoords = [parseFloat(destinationMatch[2]), parseFloat(destinationMatch[1])];

      // Fn to calculate a curved path avoiding high elevations, staying between 10m and 50m elevation, at least 10km away from the coastline, and ensuring all points are on land
      async function calculateCurvedPath(start, end) {
        const path = [];
        const stepCount = 100; // Number of steps to divide the path
        const curveFactor = 0.3; // Factor to add curvature to the path
        const irregularityFactor = 0.05; // Factor to add irregularities to the path

        for (let i = 0; i <= stepCount; i++) {
          const t = i / stepCount;
          const lng = start[0] * (1 - t) + end[0] * t;
          const lat = start[1] * (1 - t) + end[1] * t;

          // Add curvature by offsetting the midpoint
          const curveOffset = Math.sin(Math.PI * t) * curveFactor;
          const irregularityOffsetLng = (Math.random() - 0.5) * irregularityFactor;
          const irregularityOffsetLat = (Math.random() - 0.5) * irregularityFactor;

          // Add variation to move slightly left or right
          const lateralOffset = (Math.random() - 0.5) * 0.01; // Small lateral variation

          const curvedLng = lng + curveOffset * (end[1] - start[1]) + irregularityOffsetLng + lateralOffset;
          const curvedLat = lat - curveOffset * (end[0] - start[0]) + irregularityOffsetLat;

          // Simulate elevation, coastline distance, and land checks
          const elevation = await getElevationAtPoint([curvedLng, curvedLat]);


          if (elevation < 10 || elevation > 50 ) {
        // Adjust path to avoid unsuitable elevation, proximity to the coastline, or water
        const adjustedLat = curvedLat - 0.01; // Move slightly south
        const adjustedLng = curvedLng + 0.05; // Move slightly east
        path.push([adjustedLng, adjustedLat]);
          } else {
        path.push([curvedLng, curvedLat]);
          }
        }

        return path;
      }

      // Function to get elevation data from Mapbox for a given point
      const getElevationAtPoint = async (coordinates) => {
        const url = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${coordinates[0]},${coordinates[1]}.json?layers=contour&limit=1&access_token=${mapboxgl.accessToken}`;
        try {
          const response = await fetch(url);
          const data = await response.json();
          if (data.features && data.features.length > 0) {
        return data.features[0].properties.ele; // Return elevation value
          } else {
        return 0; // Default to 0 if no elevation data is found
          }
        } catch (error) {
          console.error("Error fetching elevation data:", error);
          return 0; // Default to 0 in case of an error
        }
      };

      // Function to calculate distance from the coastline


      // Function to check if a point is on land
      const isPointOnLand = async (coordinates) => {
        const url = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${coordinates[0]},${coordinates[1]}.json?layers=landuse&limit=1&access_token=${mapboxgl.accessToken}`;
        try {
          const response = await fetch(url);
          const data = await response.json();
          return data.features && data.features.length > 0; // Return true if the point is on land
        } catch (error) {
          console.error("Error checking if point is on land:", error);
          return false; // Default to false in case of an error
        }
      };

      // Generate curved path avoiding high elevations, staying at least 10km away from the coastline, and ensuring all points are on land
      const routeCoordinates = await calculateCurvedPath(originCoords, destinationCoords);

      // Add the route to map
      const route = {
        type: "LineString",
        coordinates: routeCoordinates,
      };

      if (map.getSource("route")) {
        map.getSource("route").setData({
          type: "Feature",
          geometry: route,
        });
      } else {
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: route,
          },
        });

        if (!map.getLayer("route-layer")) {
          map.addLayer({
            id: "route-layer",
            type: "line",
            source: "route",
            paint: {
              "line-color": "#00ff00", // Green route
              "line-width": 4,
              "line-opacity": 0.8,
            },
          });
        }
      }

      // buffer around the route
      const buffer = turf.buffer(route, 0.05, { units: "kilometers" });
      if (map.getSource("route-buffer")) {
        map.getSource("route-buffer").setData(buffer);
      } else {
        map.addSource("route-buffer", {
          type: "geojson",
          data: buffer,
        });

        if (!map.getLayer("route-buffer-layer")) {
          map.addLayer({
            id: "route-buffer-layer",
            type: "fill",
            source: "route-buffer",
            paint: {
              "fill-color": "#00ff00",
              "fill-opacity": 0.2,
            },
          });
        }
      }

      // Zoom to route
      const bounds = new mapboxgl.LngLatBounds();
      route.coordinates.forEach((coord) => bounds.extend(coord));
      map.fitBounds(bounds, { padding: 50 });

      // Hide the loading bar after the route is loaded
      loadingBar.style.width = "100%";
      setTimeout(() => {
        loadingBar.style.display = "none";
      }, 300);
    } else {
      alert("Invalid coordinates. Please ensure the inputs are in the correct format.");
      loadingBar.style.display = "none"; // Hide the loading bar in case of an error
    }
  });



  


// function generateReport(routeData) {
//   let report = JSON.stringify(routeData, null, 2);
//   let blob = new Blob([report], {type: "application/json"});
//   let url = URL.createObjectURL(blob);
//   let a = document.createElement("a");
//   a.href = url;
//   a.download = "rail_feasibility_report.json";
//   a.click();
// }

// <button onclick="generateReport(routeData)">Download Report</button>


