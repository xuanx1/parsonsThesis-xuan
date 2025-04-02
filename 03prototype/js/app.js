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
  bearing: 50,
  style: 'mapbox://styles/mapbox-map-design/claitl3i0002715qm9990tl95',
  attributionControl: false,
  maxBounds: [
    [80.0, -25.0], // sw corner bounding box
    [150.0, 35.0]  // ne corner bounding box
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
const zoomInButton = document.createElement('img');
zoomInButton.src = 'images/plus.svg';
zoomInButton.alt = '+';
zoomInButton.style.position = 'absolute';
zoomInButton.style.top = '10px';
zoomInButton.style.right = '10px';
zoomInButton.style.zIndex = '1000';
zoomInButton.style.width = '30px';
zoomInButton.style.height = '30px';
zoomInButton.style.borderRadius = '50%';
zoomInButton.style.backgroundColor = '#fff';
zoomInButton.style.border = '1px solid #ccc';
zoomInButton.style.cursor = 'pointer';
zoomInButton.style.padding = '5px';
document.body.appendChild(zoomInButton);

const zoomOutButton = document.createElement('img');
zoomOutButton.src = 'images/minus.svg';
zoomOutButton.alt = '-';
zoomOutButton.style.position = 'absolute';
zoomOutButton.style.top = '50px';
zoomOutButton.style.right = '10px';
zoomOutButton.style.zIndex = '1000';
zoomOutButton.style.width = '30px';
zoomOutButton.style.height = '30px';
zoomOutButton.style.borderRadius = '50%';
zoomOutButton.style.backgroundColor = '#fff';
zoomOutButton.style.border = '1px solid #ccc';
zoomOutButton.style.cursor = 'pointer';
zoomOutButton.style.padding = '5px';
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

  // map.addLayer({
  //   id: 'sky',
  //   type: 'sky',
  //   paint: {
  //     'sky-type': 'atmosphere',
  //     'sky-atmosphere-sun': [0.0, 0.0],
  //     'sky-atmosphere-sun-intensity': 0.0, 
  //     'sky-atmosphere-color': '#000000', 
  //     'sky-atmosphere-halo-color': '#000033'
  //   }
  // });
});

// inset map container
const insetContainer = document.createElement('div');
insetContainer.id = 'inset-map';
insetContainer.style.position = 'absolute';
insetContainer.style.width = '320px';
insetContainer.style.height = '150px';
insetContainer.style.bottom = '10px';
insetContainer.style.right = '10px';
insetContainer.style.border = '2px solid #ccc';
insetContainer.style.zIndex = '1000';
document.body.appendChild(insetContainer);

// inset highlighting SEA white
const insetMap = new mapboxgl.Map({
  container: 'inset-map',
  style: 'mapbox://styles/mapbox/dark-v10',
  center: map.getCenter(),
  zoom: 0.1,
  interactive: false,
  attributionControl: false
});

// inset title
const insetTitle = document.createElement('div');
insetTitle.textContent = 'Southeast Asia';
insetTitle.style.position = 'absolute';
insetTitle.style.top = '5px';
insetTitle.style.left = '10px';
insetTitle.style.zIndex = '1001';
insetTitle.style.color = 'white';
insetTitle.style.opacity = '0.5';
insetTitle.style.fontSize = '16px';
insetTitle.style.fontWeight = 'Bold';
// insetTitle.style.textShadow = '1px 1px 2px black';
insetContainer.appendChild(insetTitle);

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
  originInput.placeholder = "Origin";
  originInput.style.position = "absolute";
  originInput.style.top = "10px";
  originInput.style.left = "10px";
  originInput.style.zIndex = "1000";
  originInput.style.width = "250px";
  originInput.style.borderRadius = "20px";
  originInput.style.padding = "5px";
  originInput.style.border = "none";
  originInput.style.paddingLeft = "25px";
  originInput.style.paddingRight = "29px";
  document.body.appendChild(originInput);

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
  document.body.appendChild(bluCircle);

  // 3dots
  const threeDots = document.createElement("img");
  threeDots.src = "images/3dots.svg";
  threeDots.alt = "Pinpoint Origin";
  threeDots.style.position = "absolute";
  threeDots.style.top = "49px";
  threeDots.style.left = "7px";
  threeDots.style.zIndex = "1000";
  threeDots.style.cursor = "pointer";
  threeDots.style.width = "30px";
  threeDots.style.height = "30px";
  threeDots.style.borderRadius = "50%";
  threeDots.style.backgroundColor = "none";
  threeDots.style.padding = "5px";
  document.body.appendChild(threeDots);


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
  document.body.appendChild(enableClickButton);

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
  document.body.appendChild(okButton);

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

  map.on('click', (event) => {
    if (clickEnabled) {
      const coordinates = event.lngLat;

      // remove previous marker if it exists
      if (originMarker) {
        originMarker.remove();
      }

      // add new origin marker 
      originMarker = new mapboxgl.Marker({
        element: (() => {
          const markerElement = document.createElement('img');
          markerElement.src = 'images/marker_o.svg';
          markerElement.alt = 'Origin Marker';
          markerElement.style.width = '40px';
          markerElement.style.height = '40px';
          return markerElement;
        })()
      })
        .setLngLat([coordinates.lng, coordinates.lat])
        .addTo(map);

      // Update the origin input with the clicked location's coordinates
      originInput.value = `Lat: ${coordinates.lat.toFixed(4)}, Lng: ${coordinates.lng.toFixed(4)}`;
    }
  });





  const destinationInput = document.createElement("input");
  destinationInput.type = "text";
  destinationInput.placeholder = "Destination";
  destinationInput.style.position = "absolute";
  destinationInput.style.top = "90px";
  destinationInput.style.left = "10px";
  destinationInput.style.zIndex = "1000";
  destinationInput.style.width = "250px";
  destinationInput.style.borderRadius = "20px";
  destinationInput.style.padding = "5px";
  destinationInput.style.border = "none";
  destinationInput.style.paddingLeft = "25px";
  destinationInput.style.paddingRight = "29px";
  document.body.appendChild(destinationInput);

  // red circle destination
  const redCircle = document.createElement("div");
  redCircle.style.position = "absolute";
  redCircle.style.top = "99px";
  redCircle.style.left = "20px";
  redCircle.style.width = "10px";
  redCircle.style.height = "10px";
  redCircle.style.borderRadius = "50%";
  redCircle.style.backgroundColor = "#e95247";
  redCircle.style.zIndex = "1000";
  document.body.appendChild(redCircle);

  const enableDestinationClickButton = document.createElement("img");
  enableDestinationClickButton.src = "images/pin.svg";
  enableDestinationClickButton.alt = "Pinpoint Destination";
  enableDestinationClickButton.style.position = "absolute";
  enableDestinationClickButton.style.top = "90px";
  enableDestinationClickButton.style.left = "270px";
  enableDestinationClickButton.style.zIndex = "1000";
  enableDestinationClickButton.style.cursor = "pointer";
  enableDestinationClickButton.style.width = "30px";
  enableDestinationClickButton.style.height = "30px";
  enableDestinationClickButton.style.border = "0px solid #ccc";
  enableDestinationClickButton.style.borderRadius = "50%";
  enableDestinationClickButton.style.backgroundColor = "#ffffff";
  enableDestinationClickButton.style.padding = "5px";
  document.body.appendChild(enableDestinationClickButton);

  const destinationOkButton = document.createElement("img");
  destinationOkButton.src = "images/ok.svg";
  destinationOkButton.alt = "OK";
  destinationOkButton.style.position = "absolute";
  destinationOkButton.style.top = "90px";
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
  document.body.appendChild(destinationOkButton);

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

  map.on('click', (event) => {
    if (destinationClickEnabled) {
      const coordinates = event.lngLat;

      // remove previous marker
      if (destinationMarker) {
        destinationMarker.remove();
      }

      // add new destination marker
      destinationMarker = new mapboxgl.Marker({
        element: (() => {
          const markerElement = document.createElement('img');
          markerElement.src = 'images/marker_d.svg';
          markerElement.alt = 'Destination Marker';
          markerElement.style.width = '40px';
          markerElement.style.height = '40px';
          return markerElement;
        })()
      })
        .setLngLat([coordinates.lng, coordinates.lat])
        .addTo(map);

      // update destination input with clicked location's coordinates
      destinationInput.value = `Lat: ${coordinates.lat.toFixed(4)}, Lng: ${coordinates.lng.toFixed(4)}`;
    }
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
  destinationSuggestionBox.style.top = "115px";
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

  function handleInput(inputElement, suggestionBox, pinColor, markerReference) {
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

                // Remove the previous marker if it exists
                if (markerReference.marker) {
                  markerReference.marker.remove();
                }

                // Drop a pin on the map
                markerReference.marker = new mapboxgl.Marker({ color: pinColor })
                  .setLngLat(location.coordinates)
                  .addTo(map);

                // convert coordinates to lat/lng
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

  const destinationClearButton = document.createElement("img");
  destinationClearButton.src = "images/cross.svg";
  destinationClearButton.style.filter = "grayscale(100%)";
  destinationClearButton.alt = "Clear";
  destinationClearButton.style.position = "absolute";
  destinationClearButton.style.top = "96px";
  destinationClearButton.style.left = "225px";
  destinationClearButton.style.zIndex = "1000";
  destinationClearButton.style.cursor = "pointer";
  destinationClearButton.style.display = "none"; 
  destinationClearButton.style.width = "36px";
  destinationClearButton.style.height = "16px";
  destinationClearButton.addEventListener("click", () => {
    destinationInput.value = "";
    destinationClearButton.style.display = "none"; 

    // Close the dropdown if open
    destinationSuggestionBox.style.display = "none";
  });
  document.body.appendChild(destinationClearButton);


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
  });

  destinationClearButton.addEventListener("click", () => {
    if (destinationMarkerRef.marker) {
      destinationMarkerRef.marker.remove();
      destinationMarkerRef.marker = null;
    }
  });

  



  // index dashboard
  const dashboardContainer = document.createElement('div');
  dashboardContainer.style.position = 'fixed';
  dashboardContainer.style.top = '0';
  dashboardContainer.style.left = '-300px'; // initially hidden
  dashboardContainer.style.width = '300px';
  dashboardContainer.style.top = '190px';
  dashboardContainer.style.height = '65%';
  dashboardContainer.style.opacity = 0.95;
  dashboardContainer.style.backgroundColor = '#ffffff';
  dashboardContainer.style.boxShadow = '2px 0 5px rgba(0, 0, 0, 0.2)';
  dashboardContainer.style.zIndex = '2000';
  dashboardContainer.style.transition = 'left 0.3s ease';
  dashboardContainer.style.overflowY = 'auto';
  dashboardContainer.style.borderTopRightRadius = '15px';
  dashboardContainer.style.borderBottomRightRadius = '15px';
  dashboardContainer.style.scrollbarWidth = 'thin'; // Minimalist scrollbar for Firefox
  dashboardContainer.style.scrollbarColor = '#ccc transparent'; // Custom scrollbar color for Firefox
  document.body.appendChild(dashboardContainer);

  // Minimalist scrollbar for WebKit browsers
  const style = document.createElement('style');
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
  dashboardContainer.id = 'dashboardContainer';


  // index dashboard button with icon and text
  const dashboardToggleButtonContainer = document.createElement('div');
  dashboardToggleButtonContainer.style.position = 'absolute';
  dashboardToggleButtonContainer.style.top = '139px';
  dashboardToggleButtonContainer.style.left = '10px';
  dashboardToggleButtonContainer.style.zIndex = '2001';
  dashboardToggleButtonContainer.style.cursor = 'pointer';
  // dashboardToggleButtonContainer.style.width = '100px';
  dashboardToggleButtonContainer.style.display = 'flex';
  dashboardToggleButtonContainer.style.alignItems = 'center';
  dashboardToggleButtonContainer.style.backgroundColor = '#ffffff';
  dashboardToggleButtonContainer.style.padding = '5px 10px';
  dashboardToggleButtonContainer.style.borderRadius = '20px';
  dashboardToggleButtonContainer.style.boxShadow = '0px 2px 5px rgba(0, 0, 0, 0.2)';
  document.body.appendChild(dashboardToggleButtonContainer);

  const dashboardToggleButtonIcon = document.createElement('img');
  dashboardToggleButtonIcon.src = 'images/dashboard.svg';
  dashboardToggleButtonIcon.alt = 'Dashboard';
  dashboardToggleButtonIcon.style.width = '20px';
  dashboardToggleButtonIcon.style.height = '20px';
  dashboardToggleButtonIcon.style.marginRight = '3px';
  dashboardToggleButtonContainer.appendChild(dashboardToggleButtonIcon);

  const dashboardToggleButtonText = document.createElement('span');
  dashboardToggleButtonText.textContent = 'Indexes';
  dashboardToggleButtonText.style.fontSize = '14px';
  dashboardToggleButtonText.style.color = '#333';
  dashboardToggleButtonText.style.fontWeight = 'bold';
  dashboardToggleButtonContainer.appendChild(dashboardToggleButtonText);



  // toggle index dashboard
  let isDashboardOpen = false;
  dashboardToggleButtonContainer.addEventListener('click', () => {
    if (isDashboardOpen) {
      dashboardContainer.style.left = '-300px'; // Slide out
    } else {
      dashboardContainer.style.left = '0'; // Slide in
    }
    isDashboardOpen = !isDashboardOpen;
  });

  // index dashboard content
  const dashboardTitle = document.createElement('h2');
  dashboardTitle.textContent = 'Weighing Indexes';
  dashboardTitle.style.margin = '20px';
  dashboardTitle.style.fontSize = '18px';
  dashboardTitle.style.color = '#333';
  dashboardContainer.appendChild(dashboardTitle);

  const dashboardContent = document.createElement('p');
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
  dashboardContent.style.margin = '20px';
  dashboardContent.style.fontSize = '14px';
  dashboardContent.style.color = '#666';
  dashboardContent.style.lineHeight = '1.3';
  dashboardContainer.appendChild(dashboardContent);

  // update values when sliders are adjusted
  const updateFilterValue = (id, valueId) => {
    const slider = document.getElementById(id);
    const valueDisplay = document.getElementById(valueId);
    slider.addEventListener('input', () => {
      valueDisplay.textContent = slider.value;
    });
  };

  updateFilterValue('tsi-filter', 'tsi-value');
  updateFilterValue('sdi-filter', 'sdi-value');
  updateFilterValue('e2i-filter', 'e2i-value');
  updateFilterValue('opi-filter', 'opi-value');
  updateFilterValue('pei-filter', 'pei-value');
  updateFilterValue('ffi-filter', 'ffi-value');





  // layers dashboard
  const layersDashboardContainer = document.createElement('div');
  layersDashboardContainer.style.position = 'fixed';
  layersDashboardContainer.style.top = '0';
  layersDashboardContainer.style.left = '-300px'; // initially hidden
  layersDashboardContainer.style.width = '300px';
  layersDashboardContainer.style.top = '190px';
  layersDashboardContainer.style.height = '65%';
  layersDashboardContainer.style.opacity = 0.95;
  layersDashboardContainer.style.backgroundColor = 'white';
  layersDashboardContainer.style.boxShadow = '2px 0 5px rgba(0, 0, 0, 0.2)';
  layersDashboardContainer.style.zIndex = '2000';
  layersDashboardContainer.style.transition = 'left 0.3s ease';
  layersDashboardContainer.style.overflowY = 'auto';
  layersDashboardContainer.style.borderTopRightRadius = '15px';
  layersDashboardContainer.style.borderBottomRightRadius = '15px';
  layersDashboardContainer.style.scrollbarWidth = 'thin'; // Minimalist scrollbar for Firefox
  layersDashboardContainer.style.scrollbarColor = '#ccc transparent'; // Custom scrollbar color for Firefox
  document.body.appendChild(layersDashboardContainer);

  // Minimalist scrollbar for WebKit browsers
  const layersStyle = document.createElement('style');
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
  layersDashboardContainer.id = 'layersDashboardContainer';

  // layers dashboard button with icon and text
  const layersDashboardToggleButtonContainer = document.createElement('div');
  layersDashboardToggleButtonContainer.style.position = 'absolute';
  layersDashboardToggleButtonContainer.style.top = '139px';
  layersDashboardToggleButtonContainer.style.left = '124px';
  layersDashboardToggleButtonContainer.style.zIndex = '2001';
  layersDashboardToggleButtonContainer.style.cursor = 'pointer';
  layersDashboardToggleButtonContainer.style.display = 'flex';
  layersDashboardToggleButtonContainer.style.alignItems = 'center';
  layersDashboardToggleButtonContainer.style.backgroundColor = '#ffffff';
  layersDashboardToggleButtonContainer.style.padding = '5px 10px';
  layersDashboardToggleButtonContainer.style.borderRadius = '20px';
  layersDashboardToggleButtonContainer.style.boxShadow = '0px 2px 5px rgba(0, 0, 0, 0.2)';
  document.body.appendChild(layersDashboardToggleButtonContainer);

  const layersDashboardToggleButtonIcon = document.createElement('img');
  layersDashboardToggleButtonIcon.src = 'images/layer.svg';
  layersDashboardToggleButtonIcon.alt = 'Layers';
  layersDashboardToggleButtonIcon.style.width = '20px';
  layersDashboardToggleButtonIcon.style.height = '20px';
  layersDashboardToggleButtonIcon.style.marginRight = '3px';
  layersDashboardToggleButtonContainer.appendChild(layersDashboardToggleButtonIcon);

  const layersDashboardToggleButtonText = document.createElement('span');
  layersDashboardToggleButtonText.textContent = 'Layers';
  layersDashboardToggleButtonText.style.fontSize = '14px';
  layersDashboardToggleButtonText.style.color = '#333';
  layersDashboardToggleButtonText.style.fontWeight = 'bold';
  layersDashboardToggleButtonContainer.appendChild(layersDashboardToggleButtonText);

  // toggle layers dashboard
  let isLayersDashboardOpen = false;
  layersDashboardToggleButtonContainer.addEventListener('click', () => {
    if (isLayersDashboardOpen) {
      layersDashboardContainer.style.left = '-300px'; // Slide out
    } else {
      layersDashboardContainer.style.left = '0'; // Slide in
    }
    isLayersDashboardOpen = !isLayersDashboardOpen;
  });

  // layers dashboard content
  const layersDashboardTitle = document.createElement('h2');
  layersDashboardTitle.textContent = 'Layers Glossary';
  layersDashboardTitle.style.margin = '20px';
  layersDashboardTitle.style.fontSize = '18px';
  layersDashboardTitle.style.color = '#333';
  layersDashboardContainer.appendChild(layersDashboardTitle);

  const layersDashboardContent = document.createElement('p');
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
  layersDashboardContent.style.margin = '20px';
  layersDashboardContent.style.fontSize = '14px';
  layersDashboardContent.style.color = '#666';
  layersDashboardContent.style.lineHeight = '1.5';
  layersDashboardContainer.appendChild(layersDashboardContent);





  // legend
  const legendContainer = document.createElement('div');
  legendContainer.style.position = 'absolute';
  legendContainer.style.bottom = '175px';
  legendContainer.style.right = '15px';
  legendContainer.style.zIndex = '1000';
  legendContainer.style.fontSize = '12px';
  legendContainer.style.color = '#2b2b2b';
  legendContainer.style.display = 'flex';
  legendContainer.style.gap = '25px';

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

    const colorBox = document.createElement('div');
    colorBox.style.width = '8px';
    colorBox.style.height = '8px';
    colorBox.style.backgroundColor = item.color;
    colorBox.style.marginRight = '7px';
    colorBox.style.borderRadius = '4px';
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
      const visibility = map.getLayoutProperty('sea-coastline-layer', 'visibility');
      if (visibility === 'visible') {
        map.setLayoutProperty('sea-coastline-layer', 'visibility', 'none');
        coastlineButton.style("filter", "brightness(30%)"); // Greyed out
      } else {
        map.setLayoutProperty('sea-coastline-layer', 'visibility', 'visible');
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
        layout: {
          'visibility': 'none' // visibility off by default
        }
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
      .style("filter", "brightness(30%)") // Start as greyed out
      .on("click", () => {
      const visibility = map.getLayoutProperty('earthquake-points', 'visibility');
      if (visibility === 'visible') {
        map.setLayoutProperty('earthquake-points', 'visibility', 'none');
        earthquakeButton.style("filter", "brightness(30%)"); // Greyed out
      } else {
        map.setLayoutProperty('earthquake-points', 'visibility', 'visible');
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

    // Set the initial visibility to 'none'
    map.setLayoutProperty('earthquake-points', 'visibility', 'none');
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
              layout: {
                'visibility': 'none' // visibility off by default
              }
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
              const visibility = map.getLayoutProperty('tsunami-points', 'visibility');
              if (visibility === 'visible') {
                map.setLayoutProperty('tsunami-points', 'visibility', 'none');
                toggleButton.style("filter", "brightness(30%)"); // Greyed out
              } else {
                map.setLayoutProperty('tsunami-points', 'visibility', 'visible');
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




map.on('style.load', () => {
// southeast asian regional border sea.json
fetch('data/sea.json')
  .then(response => response.json())
  .then(data => {
    map.addSource('sea', {
      type: 'geojson',
      data: data
    });
    map.addLayer({
      id: 'sea-layer',
      type: 'fill',
      source: 'sea',
      paint: {
        'fill-color': '#000000',
        'fill-opacity': 0.3
      }
    });

    // outline sea regional border
    map.addLayer({
      id: 'sea-outline-layer',
      type: 'line',
      source: 'sea',
      paint: {
        'line-color': '#ffffff', // White outline
        'line-width': 1,
        'line-opacity': 0.7
      }
    });
  })
  .catch(error => console.error('Error loading GeoJSON:', error));
});




// Spatial population https://api.mapbox.com/v4/{tileset_id}/{zoom}/{x}/{y}{@2x}.{format}
map.on('load', function() {
  // xuanx111.3josh1wj, vn
  // xuanx111.cuxcvnbr, bn
  // xuanx111.520thek8, tl
  // xuanx111.96iq0mqw, sg
  // xuanx111.d8izfyg0, pw
  // xuanx111.9vhjaglf, la
  // xuanx111.9unpgwbt, my
  // xuanx111.0156dejf, th
  // xuanx111.0nyni93u, mm
  // xuanx111.a8vrhntz, ph
  // xuanx111.26ax1s7t, kh
  // xuanx111.agopr4of, id
  
  const tilesets = [
      'xuanx111.3josh1wj',
      'xuanx111.cuxcvnbr',
      'xuanx111.520thek8',
      'xuanx111.96iq0mqw',
      'xuanx111.d8izfyg0',
      'xuanx111.9vhjaglf',
      'xuanx111.9unpgwbt',
      'xuanx111.0156dejf',
      'xuanx111.0nyni93u',
      'xuanx111.a8vrhntz',
      'xuanx111.26ax1s7t',
      'xuanx111.agopr4of'
  ];
  
  tilesets.forEach((tileset, index) => {
      const sourceId = `tileset-${index}`;
      const layerId = `raster-layer-${index}`;
  
      map.addSource(sourceId, {
          type: 'raster',
          tiles: [`https://api.mapbox.com/v4/${tileset}/{z}/{x}/{y}@2x.jpg?access_token=` + mapboxgl.accessToken],
          tileSize: 256
      });
  
      map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: { 
              'raster-opacity': 1,
              'raster-brightness-min': 1,
              'raster-brightness-max': 1  
          },
          layout: {
              'visibility': 'none' // visibility off by default
          }
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
        .attr("alt", "Spatial Population")
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
        const visibility = map.getLayoutProperty(layerId, 'visibility');
        if (visibility === 'visible') {
          map.setLayoutProperty(layerId, 'visibility', 'none');
          isActive = false;
        } else {
          map.setLayoutProperty(layerId, 'visibility', 'visible');
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
        .text("Show Spatial Population");

      toggleButton
        .on("mouseover", () => {
          descriptionWindow.style("display", "block");
        })
        .on("mouseout", () => {
          descriptionWindow.style("display", "none");
        });
  });
});

//function for population count from raster tilesets, darker the colour, the more population
function getPopulationCount(color) {
  if (color === '#f7fbff') return 1000; // 1% white
  if (color === '#deebf7') return 10000; // 10% white
  if (color === '#9ecae1') return 40000; // 40% white
  if (color === '#3182bd') return 60000; // 60% white
  if (color === '#08519c') return 80000; // 80% white
  if (color === '#08306b') return 100000; // 100% white
  return 0;
}








map.on('style.load', () => {
// Avg 2024 humidity - avgHU_vect.geojson classify into 5 classes - temperature
fetch('data/avgHU_vect.geojson')
  .then(response => response.json())
  .then(data => {
    map.addSource('avgHU', {
      type: 'geojson',
      data: data
    });

    map.addLayer({
      id: 'avgHU-layer',
      type: 'fill',
      source: 'avgHU',
      paint: {
        'fill-color': [
          'step',
          ['get', 'DN'], 
          '#ffffff', 159,   // 0-159: white
          '#ffff00', 182,   // 160-182: yellow
          '#ffa500', 197,   // 183-197: orange
          '#ff0000', 209,   // 198-209: red
          '#800080'         // 210-255: purple
        ],
        'fill-opacity': 0.5
      },
      layout: {
        'visibility': 'none' // visibility off by default
      }
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
      const visibility = map.getLayoutProperty('avgHU-layer', 'visibility');
      if (visibility === 'visible') {
        map.setLayoutProperty('avgHU-layer', 'visibility', 'none');
        avgHUButton.style("filter", "brightness(30%)"); // Greyed out
      } else {
        map.setLayoutProperty('avgHU-layer', 'visibility', 'visible');
        avgHUButton.style("filter", "brightness(100%)"); // Coloured
      }
      });

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
  .catch(error => console.error('Error loading GeoJSON:', error));
});
  




//forest area - virtual raster, compress, 8 bit, clip, reclassify, host, get tile key, bright green
map.on('load', function() {
  fetch('data/sea_forest_vect.geojson')
    .then(response => response.json())
    .then(data => {
      map.addSource('forest-geojson', {
        type: 'geojson',
        data: data
      });

      map.addLayer({
        id: 'forest-layer',
        type: 'fill',
        source: 'forest-geojson',
        paint: { 
          'fill-color': [
        'step',
        ['get', 'DN'], 
        '#e5f5e0', 11,   // 0-11: very light green
        '#a1d99b', 29,   // 12-29: light green
        '#41ab5d', 47,   // 30-47: medium green
        '#006d2c', 104,  // 48-104: darker green
        '#00441b'        // 105-255: deepest dark green
          ],
          'fill-opacity': 0.3
        },
        layout: {
          'visibility': 'none' // visibility off by default
        }
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
          const visibility = map.getLayoutProperty('forest-layer', 'visibility');
          if (visibility === 'visible') {
            map.setLayoutProperty('forest-layer', 'visibility', 'none');
            toggleButton.style("filter", "brightness(30%)"); // Greyed out
          } else {
            map.setLayoutProperty('forest-layer', 'visibility', 'visible');
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
    .catch(error => console.error('Error loading GeoJSON (sea_forest_vect.geojson):', error));
});






map.on('style.load', () => {
// amphibians_vect.geojson classify into 5 classes - yellow
fetch('data/amphibians_vect.geojson')
  .then(response => response.json())
  .then(data => {
    map.addSource('amphibians', {
      type: 'geojson',
      data: data
    });

    map.addLayer({
      id: 'amphibians-layer',
      type: 'fill',
      source: 'amphibians',
      paint: {
        'fill-color': [
          'step',
          ['get', 'DN'], 
          '#ffffcc', 1,   // 1: light yellow
          '#ffeda0', 2,   // 2: pale yellow
          '#fed976', 3,   // 3: soft yellow
          '#feb24c', 5,   // 5: medium yellow
          '#fd8d3c'       // 5-16: deep yellow
        ],
        'fill-opacity': 0.5
      },
      layout: {
        'visibility': 'none' // visibility off by default
      }
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
      const visibility = map.getLayoutProperty('amphibians-layer', 'visibility');
      if (visibility === 'visible') {
        map.setLayoutProperty('amphibians-layer', 'visibility', 'none');
        amphibiansButton.style("filter", "brightness(30%)"); // Greyed out
      } else {
        map.setLayoutProperty('amphibians-layer', 'visibility', 'visible');
        amphibiansButton.style("filter", "brightness(100%)"); // Coloured
      }
      });

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
  .catch(error => console.error('Error loading GeoJSON (amphibians_vect.geojson):', error));
});





map.on('style.load', () => {
// birds_vect.geojson classify into 5 classes - orange
fetch('data/birds_vect.geojson')
  .then(response => response.json())
  .then(data => {
    map.addSource('birds', {
      type: 'geojson',
      data: data
    });

    map.addLayer({
      id: 'birds-layer',
      type: 'fill',
      source: 'birds',
      paint: {
      'fill-color': [
        'step',
        ['get', 'DN'], 
        '#ffffff', 139,   // 0-139: white
        '#ffcc99', 185,   // 140-185: light orange
        '#ff9933', 208,   // 186-208: orange
        '#ff6600', 230,   // 209-230: deep orange
        '#cc3300'         // 230-231: red
      ],
      'fill-opacity': 0.8
      },
      layout: {
        'visibility': 'none' // visibility off by default
      }
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
      const visibility = map.getLayoutProperty('birds-layer', 'visibility');
      if (visibility === 'visible') {
        map.setLayoutProperty('birds-layer', 'visibility', 'none');
        birdsButton.style("filter", "brightness(30%)"); // Greyed out
      } else {
        map.setLayoutProperty('birds-layer', 'visibility', 'visible');
        birdsButton.style("filter", "brightness(100%)"); // Coloured
      }
      });

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
  .catch(error => console.error('Error loading GeoJSON (birds_vect.geojson):', error));
});



map.on('style.load', () => {
// mammals_vect1.geojson classify into 5 classes - purple
fetch('data/mammals_vect1.geojson')
  .then(response => response.json())
  .then(data => {
    map.addSource('mammals', {
      type: 'geojson',
      data: data
    });

    map.addLayer({
      id: 'mammals-layer',
      type: 'fill',
      source: 'mammals',
      paint: {
      'fill-color': [
        'step',
        ['get', 'DN'], 
        '#f2e6ff', 0,   // Light purple
        '#d9b3ff', 10,  // Soft purple
        '#bf80ff', 14,  // Medium purple
        '#a64dff', 17,  // Deep purple
        '#800080'       // Dark purple
      ],
      'fill-opacity': 0.4
      },
      layout: {
        'visibility': 'none' // visibility off by default
      }
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
      const visibility = map.getLayoutProperty('mammals-layer', 'visibility');
      if (visibility === 'visible') {
        map.setLayoutProperty('mammals-layer', 'visibility', 'none');
        mammalsButton.style("filter", "brightness(30%)"); // Greyed out
      } else {
        map.setLayoutProperty('mammals-layer', 'visibility', 'visible');
        mammalsButton.style("filter", "brightness(100%)"); // Coloured
      }
      });

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
  .catch(error => console.error('Error loading GeoJSON (mammals_vect1.geojson):', error));
});




// country's key connectivity infrastructure
  const CountryGeojson = [
    'data/th/hotosm_tha_airports_points_geojson.geojson', 
    'data/th/hotosm_tha_railways_lines_geojson.geojson', 
    'data/th/hotosm_tha_sea_ports_points_geojson.geojson', 

    'data/bn/hotosm_brn_airports_points_geojson.geojson', 
    'data/bn/hotosm_brn_railways_lines_geojson.geojson', 
    'data/bn/hotosm_brn_sea_ports_points_geojson.geojson', 

    'data/id/hotosm_idn_airports_points_geojson.geojson', 
    'data/id/hotosm_idn_railways_lines_geojson.geojson', 
    'data/id/hotosm_idn_sea_ports_points_geojson.geojson',
     
    'data/kh/hotosm_khm_airports_points_geojson.geojson', 
    'data/kh/hotosm_khm_railways_lines_geojson.geojson', 
    'data/kh/hotosm_khm_sea_ports_points_geojson.geojson', 

    'data/la/hotosm_lao_airports_points_geojson.geojson', 
    'data/la/hotosm_lao_railways_lines_geojson.geojson', 
    'data/la/hotosm_lao_sea_ports_points_geojson.geojson', 

    'data/mm/hotosm_mmr_airports_points_geojson.geojson', 
    'data/mm/hotosm_mmr_railways_lines_geojson.geojson', 
    'data/mm/hotosm_mmr_sea_ports_points_geojson.geojson', 

    'data/my/hotosm_mys_airports_points_geojson.geojson', 
    'data/my/hotosm_mys_railways_lines_geojson.geojson', 
    'data/my/hotosm_mys_sea_ports_points_geojson.geojson', 

    'data/ph/hotosm_phl_airports_points_geojson.geojson',
    'data/ph/hotosm_phl_railways_lines_geojson.geojson',
    'data/ph/hotosm_phl_sea_ports_points_geojson.geojson',

    'data/pw/hotosm_plw_airports_points_geojson.geojson',
    'data/pw/hotosm_plw_sea_ports_points_geojson.geojson',

    'data/sg/hotosm_sgp_airports_points_geojson.geojson',
    'data/sg/hotosm_sgp_sea_ports_points_geojson.geojson',

    'data/tl/hotosm_tls_airports_points_geojson.geojson',
    'data/tl/hotosm_tls_sea_ports_points_geojson.geojson',

    'data/vn/hotosm_vnm_airports_points_geojson.geojson',
    'data/vn/hotosm_vnm_railways_lines_geojson.geojson',
    'data/vn/hotosm_vnm_sea_ports_points_geojson.geojson',
  ];

  map.on('style.load', () => {
    CountryGeojson.forEach((file) => {
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
                'circle-color': '#0000ff', // blue for seaports
                'circle-opacity': 0.1
              }
            : file.includes('airports')
            ? {
                'circle-radius': 4,
                'circle-color': '#ffff00', // Yellow for airports
                'circle-opacity': 0.2
              }
            : file.includes('railways')
            ? {
                'line-color': '#ff0000', // Red for railways
                'line-width': 3,
                'line-opacity': 0.5
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
          if (error.message.includes('404')) {
            console.error(`File not found: ${file}. Please check the file path.`);
          }
        });
    });
  }); // separate into differnt toggles - airport / rail / seaport svg






// Spatial GDP https://api.mapbox.com/v4/{tileset_id}/{zoom}/{x}/{y}{@2x}.{format}
map.on('load', function() {
  const tileset = 'xuanx111.409ps0ou'; // Spatial GDP tileset

  const sourceId = 'gdp-tileset';
  const layerId = 'gdp-raster-layer';

  map.addSource(sourceId, {
    type: 'raster',
    tiles: [`https://api.mapbox.com/v4/${tileset}/{z}/{x}/{y}@2x.jpg?access_token=` + mapboxgl.accessToken],
    tileSize: 256
  });

  map.addLayer({
    id: layerId,
    type: 'raster',
    source: sourceId,
    paint: { 
      'raster-opacity': 1,
      'raster-color' : '#FFDFBF',
      'raster-brightness-min': 0,
    },
    layout: {
      'visibility': 'none' // visibility off by default
    }
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
    .attr("alt", "Spatial GDP")
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
      const visibility = map.getLayoutProperty(layerId, 'visibility');
      if (visibility === 'visible') {
        map.setLayoutProperty(layerId, 'visibility', 'none');
        toggleButton.style("filter", "brightness(30%)"); // Greyed out
      } else {
        map.setLayoutProperty(layerId, 'visibility', 'visible');
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
    .text("Show Spatial GDP");

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
  type: 'FeatureCollection',
  features: [
    // Indonesia
    { type: 'Feature', properties: { name: 'Jakarta', height: 300, country: 'Indonesia', population: '10.56M' }, geometry: { type: 'Point', coordinates: [106.8650, -6.1751] } },
    { type: 'Feature', properties: { name: 'Surabaya', height: 220, country: 'Indonesia', population: '2.87M' }, geometry: { type: 'Point', coordinates: [112.7521, -7.2575] } },
    { type: 'Feature', properties: { name: 'Bandung', height: 200, country: 'Indonesia', population: '2.4M' }, geometry: { type: 'Point', coordinates: [107.6186, -6.9175] } },
    { type: 'Feature', properties: { name: 'Medan', height: 180, country: 'Indonesia', population: '2.1M' }, geometry: { type: 'Point', coordinates: [98.6722, 3.5952] } },
    { type: 'Feature', properties: { name: 'Nusantara', height: 250, country: 'Indonesia', population: '0.2M' }, geometry: { type: 'Point', coordinates: [115.0000, -1.0000] } },
    
    // Thailand
    { type: 'Feature', properties: { name: 'Bangkok', height: 280, country: 'Thailand', population: '8.3M' }, geometry: { type: 'Point', coordinates: [100.5018, 13.7563] } },
    { type: 'Feature', properties: { name: 'Chiang Mai', height: 150, country: 'Thailand', population: '1.2M' }, geometry: { type: 'Point', coordinates: [98.9853, 18.7883] } },
    { type: 'Feature', properties: { name: 'Pattaya', height: 120, country: 'Thailand', population: '1.1M' }, geometry: { type: 'Point', coordinates: [100.8834, 12.9236] } },
    
    // Philippines
    { type: 'Feature', properties: { name: 'Manila', height: 250, country: 'Philippines', population: '1.78M' }, geometry: { type: 'Point', coordinates: [120.9842, 14.5995] } },
    { type: 'Feature', properties: { name: 'Cebu City', height: 170, country: 'Philippines', population: '0.92M' }, geometry: { type: 'Point', coordinates: [123.8854, 10.3157] } },
    { type: 'Feature', properties: { name: 'Davao City', height: 160, country: 'Philippines', population: '1.63M' }, geometry: { type: 'Point', coordinates: [125.6129, 7.0731] } },
    
    // Vietnam
    { type: 'Feature', properties: { name: 'Ho Chi Minh City', height: 240, country: 'Vietnam', population: '8.4M' }, geometry: { type: 'Point', coordinates: [106.6297, 10.8231] } },
    { type: 'Feature', properties: { name: 'Hanoi', height: 230, country: 'Vietnam', population: '7.7M' }, geometry: { type: 'Point', coordinates: [105.8342, 21.0278] } },
    { type: 'Feature', properties: { name: 'Da Nang', height: 140, country: 'Vietnam', population: '1.1M' }, geometry: { type: 'Point', coordinates: [108.2022, 16.0544] } },
    
    // Malaysia
    { type: 'Feature', properties: { name: 'Kuala Lumpur', height: 210, country: 'Malaysia', population: '1.8M' }, geometry: { type: 'Point', coordinates: [101.6869, 3.1390] } },
    { type: 'Feature', properties: { name: 'Penang', height: 130, country: 'Malaysia', population: '0.7M' }, geometry: { type: 'Point', coordinates: [100.3298, 5.4164] } },
    { type: 'Feature', properties: { name: 'Kuching', height: 130, country: 'Malaysia', population: '0.7M' }, geometry: { type: 'Point', coordinates: [110.3522, 1.5533] } },
    
    // Singapore
    { type: 'Feature', properties: { name: 'Singapore', height: 270, country: 'Singapore', population: '5.7M' }, geometry: { type: 'Point', coordinates: [103.8198, 1.3521] } },
    
    // Myanmar
    { type: 'Feature', properties: { name: 'Yangon', height: 190, country: 'Myanmar', population: '5.2M' }, geometry: { type: 'Point', coordinates: [96.1951, 16.8409] } },
    { type: 'Feature', properties: { name: 'Mandalay', height: 140, country: 'Myanmar', population: '1.3M' }, geometry: { type: 'Point', coordinates: [96.0833, 21.9831] } },
    
    // Cambodia
    { type: 'Feature', properties: { name: 'Phnom Penh', height: 160, country: 'Cambodia', population: '2.1M' }, geometry: { type: 'Point', coordinates: [104.9160, 11.5564] } },
    { type: 'Feature', properties: { name: 'Siem Reap', height: 90, country: 'Cambodia', population: '0.2M' }, geometry: { type: 'Point', coordinates: [103.8509, 13.3671] } },
    
    // Laos
    { type: 'Feature', properties: { name: 'Vientiane', height: 120, country: 'Laos', population: '0.8M' }, geometry: { type: 'Point', coordinates: [102.6331, 17.9757] } },
    { type: 'Feature', properties: { name: 'Luang Prabang', height: 70, country: 'Laos', population: '0.05M' }, geometry: { type: 'Point', coordinates: [102.1353, 19.8834] } },
    
    // Brunei
    { type: 'Feature', properties: { name: 'Bandar Seri Begawan', height: 100, country: 'Brunei', population: '0.1M' }, geometry: { type: 'Point', coordinates: [114.9403, 4.9031] } },
    
    // East Timor
    { type: 'Feature', properties: { name: 'Dili', height: 80, country: 'East Timor', population: '0.2M' }, geometry: { type: 'Point', coordinates: [125.5679, -8.5569] } },

    // Palau
    { type: 'Feature', properties: { name: 'Ngerulmud', height: 50, country: 'Palau', population: '0.01M' }, geometry: { type: 'Point', coordinates: [134.6232, 7.5000] } },
    { type: 'Feature', properties: { name: 'Koror', height: 20, country: 'Palau', population: '0.02M' }, geometry: { type: 'Point', coordinates: [134.4822, 7.3669] } }
  ]
};

map.on('load', () => {
  map.addSource('majorCities', {
    type: 'geojson',
    data: majorCities
  });

  // // city labels for low pitch
  // map.addLayer({
  //   id: 'major-cities-low-pitch',
  //   type: 'symbol',
  //   source: 'majorCities',
  //   layout: {
  //     'text-field': ['get', 'name'],
  //     'text-size': 12,
  //     'text-offset': [0, -10],
  //     'text-anchor': 'top'
  //   },
  //   paint: {
  //     'text-color': '#ffffff',
  //     'text-halo-color': '#000000',
  //     'text-halo-width': 1
  //   },
  //   filter: ['all', ['<', ['pitch'], 60], ['<=', ['zoom'], 8]]
  // });

  // city labels for high pitch 
  map.addLayer({
    id: 'major-cities-high-pitch',
    type: 'symbol',
    source: 'majorCities',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 13,
      'text-offset': [0, -10],
      'text-anchor': 'bottom',
      'icon-image': 'leader_line',
      'icon-anchor': 'bottom'
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#000000',
      'text-halo-width': 1
    },
    filter: ['all', ['>=', ['pitch'], 60], ['<=', ['zoom'], 8]]
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

  const dialogBox = document.createElement("div");
  dialogBox.style.backgroundColor = "white";
  dialogBox.style.padding = "20px";
  dialogBox.style.opacity = 0.9;
  dialogBox.style.borderRadius = "10px";
  dialogBox.style.boxShadow = "0px 4px 10px rgba(0, 0, 0, 0.3)";
  dialogBox.style.textAlign = "center";
  dialogBox.style.maxWidth = "520px";
  dialogBox.style.border = "1px solid white";

  const dialogTitle = document.createElement("h1");
  dialogTitle.textContent = "Trains, Lanes, and Data Grains!";
  dialogTitle.style.marginTop = "10px";
  dialogTitle.style.marginBottom = "15px";
  dialogTitle.style.marginLeft = "13px";
  dialogTitle.style.fontSize = "30px";
  dialogTitle.style.textAlign = "left";
  dialogTitle.style.color = "orange";
  dialogBox.appendChild(dialogTitle);

  const dialogsubTitle = document.createElement("h2");
  dialogsubTitle.textContent = "Mapping Southeast Asia’s Future";
  dialogsubTitle.style.marginBottom = "30px";
  dialogsubTitle.style.marginLeft = "13px";
  dialogsubTitle.style.textAlign = "left";
  dialogsubTitle.style.fontSize = "16px";
  dialogsubTitle.style.color = "grey";
  dialogBox.appendChild(dialogsubTitle);

  const dialogMessage = document.createElement("p");
  dialogMessage.innerHTML = "Welcome to the Rail Feasibility Mapper!<br>This tool allows you to explore and evaluate rail feasibility based on various indexes and criteria specific to Southeast Asia.<br><br>Using the tools provided, you can pinpoint an origin-destination pair, calculate said routes, toggle layer visibility, control level of influence of the indexes and analyze the feasibility of your connectivity project in the final result.<br><br>Let's map the future of Southeast Asia together!";
  dialogMessage.style.fontSize = "14px";
  dialogMessage.style.color = "black";
  dialogMessage.style.marginLeft = "13px";
  dialogMessage.style.marginRight = "13px";
  dialogMessage.style.lineHeight = "1.5";
  dialogMessage.style.textAlign = "justify";
  dialogMessage.style.marginBottom = "0px";
  dialogBox.appendChild(dialogMessage);

  // Container for fine print and arrow button
  const dialogFooter = document.createElement("div");
  dialogFooter.style.display = "flex";
  dialogFooter.style.justifyContent = "space-between";
  dialogFooter.style.alignItems = "center";
  dialogFooter.style.marginTop = "20px";

  // Fine print
  const finePrint = document.createElement("p");
  finePrint.textContent = "For the best performance, use this app on a desktop. While it may work on mobile devices, some features are optimized for larger screens and keyboard/mouse interactions. Outcomes should not be considered definitive endorsements or rejections of any rail project.";
  finePrint.style.fontSize = "8px";
  finePrint.style.color = "grey";
  finePrint.style.lineHeight = "1.5";
  finePrint.style.textAlign = "left";
  finePrint.style.marginLeft = "13px";
  finePrint.style.maxWidth = "66%"; // Set max width to 2/3 of the container
  dialogFooter.appendChild(finePrint);

  // Arrow button
  const okButton = document.createElement("img");
  okButton.src = "images/arrow.svg";
  okButton.alt = "Let's Get to Work!";
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
  okButton.addEventListener("click", () => {
    document.body.removeChild(dialogContainer);
  });
  dialogFooter.appendChild(okButton);

  dialogBox.appendChild(dialogFooter);

  dialogContainer.appendChild(dialogBox);
  document.body.appendChild(dialogContainer);
});






// process indexes + setting dashboard - 1. radius for trains based on speed + 2. interval distance/pop threshold for station placement 3. toggle indexes 4. show 3 alternative routes with each index's strengths - ask TA' separates into smaller js file

// success requirements - show indexes + scoring board as success criteria + Justify with population served - in final report +  integrate germini to generate description w// germini

// cover page - explain system swiss cheese

// add tutorial/intructions? 





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
    .style("top", "130px")
    .style("left", "270px")
    .text("Calculate Route");

  routeButton.addEventListener("mouseover", () => {
    routeDescription.style("display", "block");
  });

  routeButton.addEventListener("mouseout", () => {
    routeDescription.style("display", "none");
  });



  // reset button
  const resetButton = document.createElement("img");
  resetButton.src = "images/restart.svg";
  resetButton.alt = "Reset Route";
  resetButton.style.position = "absolute";
  resetButton.style.bottom = "240px";
  resetButton.style.right = "10px";
  resetButton.style.zIndex = "1000";
  resetButton.style.cursor = "pointer";
  resetButton.style.width = "30px";
  resetButton.style.height = "30px";
  resetButton.style.border = "0px solid #ccc";
  resetButton.style.borderRadius = "50%";
  resetButton.style.backgroundColor = "#ffffff";
  resetButton.style.padding = "7px";
  document.body.appendChild(resetButton);

  resetButton.addEventListener("click", () => {
    const confirmReset = confirm("Are you sure you want to reset all settings? It is highly advisable to export a report as a PDF before resetting as it will not be possible to undo this action.");
    // if user cancels, do nothing
    if (!confirmReset) return;

    // remove route and buffer layers
    if (map.getLayer("route-layer")) {
      map.removeLayer("route-layer");
    }
    if (map.getSource("route")) {
      map.removeSource("route");
    }
    if (map.getLayer("route-buffer-layer")) {
      map.removeLayer("route-buffer-layer");
    }
    if (map.getSource("route-buffer")) {
      map.removeSource("route-buffer");
    }

    // clear origin and destination inputs
    originInput.value = "";
    destinationInput.value = "";

    // remove origin and destination markers
    if (originMarkerRef.marker) {
      originMarkerRef.marker.remove();
      originMarkerRef.marker = null;
    }
    if (destinationMarkerRef.marker) {
      destinationMarkerRef.marker.remove();
      destinationMarkerRef.marker = null;
    }

    // reset map view to center of Southeast Asia
    map.flyTo({
      center: [110.0, 5.0], 
      zoom: 4,
      pitch: 60,
      bearing: 50
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
    layersToReset.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", "none");
      }
    });

    // coastline visible
    if (map.getLayer('sea-coastline-layer')) {
      map.setLayoutProperty('sea-coastline-layer', 'visibility', 'visible');
    }
    
    // reset toggle buttons to default - greyed, except coastline button
    d3.selectAll("img")
      .filter(function() {
        const altText = d3.select(this).attr("alt");
        return altText !== "Draw Route" && altText !== "Pinpoint Origin" && altText !== "Pinpoint Destination" && altText !== "+" && altText !== "-" && altText !== "Reset Route" && altText !== "OK" && altText !== "Coastline";
      })
      .style("filter", "brightness(30%)");

    // ensure coastline button remains active
    d3.selectAll("img")
      .filter(function() {
        return d3.select(this).attr("alt") === "Coastline";
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
    .style("bottom", "240px")
    .style("right", "50px")
    .text("Reset All Settings");

  resetButton
    .addEventListener("mouseover", () => {
      resetDescription.style("display", "block");
    });

  resetButton
    .addEventListener("mouseout", () => {
      resetDescription.style("display", "none");
    });

  
  
  
  
  // export button - chaneg to 100% brightness when a line is drawn
  const exportButton = document.createElement("img");
  exportButton.src = "images/export.svg";
  exportButton.alt = "Export Report";
  exportButton.style.position = "absolute";
  exportButton.style.bottom = "200px";
  exportButton.style.right = "10px";
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

  exportButton.addEventListener("click", () => {
    const routeData = map.getSource("route") ? map.getSource("route")._data : null;
    if (!routeData) {
      alert("No route data available to export.");
      return;
    }

    const report = JSON.stringify(routeData, null, 2);
    const blob = new Blob([report], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rail_feasibility_report.json";
    a.click();
    URL.revokeObjectURL(url);
  });

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
    .style("bottom", "200px")
    .style("right", "50px")
    .text("Export Report");

  exportButton
    .addEventListener("mouseover", () => {
      exportDescription.style("display", "block");
    });

  exportButton
    .addEventListener("mouseout", () => {
      exportDescription.style("display", "none");
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

  routeButton.addEventListener("click", async () => {
    const originValue = originInput.value;
    const destinationValue = destinationInput.value;

    if (!originValue || !destinationValue) {
      alert("Please enter both the origin and destination.");
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


      // // Function to check if a point is on land
      // const isPointOnLand = async (coordinates) => {
      //   const url = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${coordinates[0]},${coordinates[1]}.json?layers=landuse&limit=1&access_token=${mapboxgl.accessToken}`;
      //   try {
      //     const response = await fetch(url);
      //     const data = await response.json();
      //     return data.features && data.features.length > 0; // Return true if the point is on land
      //   } catch (error) {
      //     console.error("Error checking if point is on land:", error);
      //     return false; // Default to false in case of an error
      //   }
      // };

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


