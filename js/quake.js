
// // heatmap? Toggle button to show/hide heat map layer?

// // Toggle button to show/hide quake layer

// d3.json("data/worldQuakesMiles.json").then((data) => {
//   console.log(data);

//   const geoData = {
//     type: "FeatureCollection",
//     features: data.features.map((feature) => ({
//       type: "Feature",
//       geometry: feature.geometry,
//       properties: {
//         mag: feature.properties.mag,
//       },
//     })),
//   };

//   map.on('load', () => {
//     map.addSource('earthquakes', {
//       type: 'geojson',
//       data: geoData,
//     });

//     map.addLayer({
//       id: 'earthquake-points',
//       type: 'circle',
//       source: 'earthquakes',
//       paint: {
//         'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 0, 4, 5, 5],
//         'circle-color': '#ff7900', // Orange
//         'circle-opacity': 0.3,
//         // 'circle-stroke-width': 1,
//         'circle-stroke-color': '#ff7900', // Orange
//       },
//     });
//   });

//   // toggle quakes
//   const earthquakeToggleContainer = d3
//     .select("body") // Changed from "#app" to "body" to ensure it is appended to the correct container
//     .append("div")
//     .style("position", "absolute")
//     .style("top", "165px")
//     .style("right", "5px")
//     .style("z-index", "1000");

//   earthquakeToggleContainer
//     .append("img")
//     .attr("src", "images/quake.svg")
//     .attr("alt", "Earthquakes")
//     .style("margin", "5px")
//     .style("padding", "5px")
//     .style("cursor", "pointer")
//     .style("width", "30px")
//     .style("height", "30px")
//     .style("border", "1px solid #ccc")
//     .style("border-radius", "50%")
//     .style("background-color", "#ff7900")
//     .style("filter", "invert(100%) sepia(100%) saturate(1000%) hue-rotate(0deg) brightness(100%) contrast(100%)")
//     .on("click", () => {
//     const visibility = map.getLayoutProperty('earthquake-points', 'visibility');
//     if (visibility === 'visible') {
//       map.setLayoutProperty('earthquake-points', 'visibility', 'none');
//     } else {
//       map.setLayoutProperty('earthquake-points', 'visibility', 'visible');
//     }
//     });
// });