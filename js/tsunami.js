
  

    d3.tsv("data/tsunami.tsv").then((data) => {
        console.log(data);

        // Filter out entries with invalid or missing coordinates
        const filteredData = data.filter((d) => d.Longitude && d.Latitude);

        // Convert TSV data to GeoJSON format
        const geoData = {
                type: "FeatureCollection",
                features: filteredData.map((d) => ({
                        type: "Feature",
                        geometry: {
                                type: "Point",
                                coordinates: [+d.Longitude, +d.Latitude], // Ensure Longitude/Latitude are numbers
                        },
                        properties: {
                                mag: +d.mag || 0, // Ensure magnitude is a number, default to 0 if missing
                                place: d.place || "Unknown Location",
                        },
                })),
        };

        // Add the GeoJSON data as a source
        map.on('load', () => {
                map.addSource('tsunami', {
                        type: 'geojson',
                        data: geoData,
                });

                // Add a circle layer for the tsunami points
                map.addLayer({
                        id: 'tsunami-points',
                        type: 'circle',
                        source: 'tsunami',
                        paint: {
                                'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 0, 4, 10, 20],
                                'circle-color': '#ff7900',
                                'circle-opacity': 0.6,
                                'circle-stroke-width': 1,
                                'circle-stroke-color': '#ff7900',
                        },
                });

                // Add popups on click
                map.on('click', 'tsunami-points', (e) => {
                        const coordinates = e.features[0].geometry.coordinates.slice();
                        const { place, mag } = e.features[0].properties;

                        new mapboxgl.Popup()
                                .setLngLat(coordinates)
                                .setHTML(`
                                        <span style="font-family: 'Open Sans'; font-weight: regular; font-size: 10px;">Location
                                        <br/></span> <span style="font-family: 'Open Sans'; font-weight: bold; font-size: 14px; color: #ff7900;">${place}</span>
                                        <br/>
                                        <br/>
                                        <span style="font-family: 'Open Sans'; font-weight: regular; font-size: 10px;">Magnitude</span>
                                        <br/>
                                        <span style="font-family: 'Open Sans'; font-weight: bold; font-size: 14px; color: #ff7900;">${mag}</span>
                                `)
                                .addTo(map);
                });

                // Change the cursor to a pointer when hovering over points
                map.on('mouseenter', 'tsunami-points', () => {
                        map.getCanvas().style.cursor = 'pointer';
                });

                // Reset the cursor when leaving points
                map.on('mouseleave', 'tsunami-points', () => {
                        map.getCanvas().style.cursor = '';
                });

                // Add a toggle button
                const toggleContainer = d3
                        .select("#app")
                        .append("div")
                        .style("position", "absolute")
                        .style("top", "10px")
                        .style("right", "10px")
                        .style("z-index", "1000");

                toggleContainer
                        .append("button")
                        .text("Toggle Tsunami")
                        .style("margin", "5px")
                        .style("padding", "5px 10px")
                        .style("cursor", "pointer")
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

