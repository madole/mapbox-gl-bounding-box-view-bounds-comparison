import mapbox from "mapbox-gl";
import syncMaps from "./syncMaps";
import "./style.css";
import "mapbox-gl/dist/mapbox-gl.css";
import bboxPolygon from "@turf/bbox-polygon";
import mapboxgl from "mapbox-gl";
import { BBox, Feature, Polygon } from "geojson";

// @ts-ignore
mapbox.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;

const MIN_ZOOM_FOR_LG_PITCH = 14;
const MAX_PITCH_LG = 60;
const MAX_PITCH_SM = 45;

const mapA = new mapbox.Map({
  container: "map-a",
  style: "mapbox://styles/mapbox/streets-v11",
  center: [151, -33.5],
  zoom: 9,
  maxPitch: MAX_PITCH_LG,
});

const mapB = new mapbox.Map({
  container: "map-b",
  style: "mapbox://styles/mapbox/streets-v11",
  center: [151, -33.5],
  zoom: 7,
  maxPitch: MAX_PITCH_LG,
  interactive: false,
});

// Sync bounding box and view bounds layers of mapA to mapB
function syncViewBoundsAndBBoxLayers() {
  const boundingBox = mapA.getBounds().toArray().flat() as BBox;
  const polygon = bboxPolygon(boundingBox);
  const bboxSource = mapB.getSource("bbox");
  if (bboxSource?.type === "geojson") {
    bboxSource.setData(polygon);
  }
  const viewBoundsSource = mapB.getSource("viewBounds");
  if (viewBoundsSource?.type === "geojson") {
    viewBoundsSource.setData(buildViewBoundsGeoJSON(mapA));
  }
}

// get a geojson rectangle for the current map's view
const buildViewBoundsGeoJSON = (map: mapboxgl.Map): Feature<Polygon> => {
  const canvas = map.getCanvas();
  const { width, height } = canvas;
  const trueWidth = width / window.devicePixelRatio;
  const trueHeight = height / window.devicePixelRatio;

  const cUL = map.unproject([0, 0]).toArray();
  const cUR = map.unproject([trueWidth, 0]).toArray();
  const cLR = map.unproject([trueWidth, trueHeight]).toArray();
  const cLL = map.unproject([0, trueHeight]).toArray();
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[cUL, cUR, cLR, cLL, cUL]],
    },
  };
};
// wait for both maps to be loaded before syncing
mapA.on("load", () => {
  mapB.on("load", () => {
    // initialise map sync
    syncMaps(mapA, mapB);

    // add map controls to mapA
    mapA.addControl(
      new mapbox.NavigationControl({
        visualizePitch: true,
      }),
      "top-left"
    );

    // sync view bounds and bbox layers when map A moves
    mapA.on("moveend", () => {
      syncViewBoundsAndBBoxLayers();
    });

    // set up bounding box layer
    const boundingBox = mapA.getBounds().toArray().flat() as BBox;
    const polygon = bboxPolygon(boundingBox);
    mapB.addSource("bbox", {
      type: "geojson",
      data: polygon,
    });

    mapB.addLayer({
      id: "bbox",
      type: "line",
      source: "bbox",
      paint: {
        "line-color": "#ff0000",
        "line-width": 4,
      },
    });

    mapB.addLayer({
      id: "bbox-label",
      type: "symbol",
      source: "bbox",
      layout: {
        "text-field": "Map A Bounding Box",
        "symbol-placement": "line",
        "text-offset": [0, -1],
        "text-size": 12,
      },
      paint: {
        "text-color": "#ff0000",
      },
    });

    // set up view bounds layer
    mapB.addSource("viewBounds", {
      type: "geojson",
      data: buildViewBoundsGeoJSON(mapA),
    });

    // symbol layer with the text - MapA bounding box
    mapB.addLayer({
      id: "viewBounds-label",
      type: "symbol",
      source: "viewBounds",
      layout: {
        "text-field": "Map A View Bounds",
        "symbol-placement": "line",
        "text-offset": [0, -1],
        "text-size": 12,
      },
      paint: {
        "text-color": "#0000ff",
      },
    });

    mapB.addLayer({
      id: "viewBounds",
      type: "line",
      source: "viewBounds",
      paint: {
        "line-color": "#0000ff",
        "line-width": 4,
      },
    });

    mapA.on("moveend", () => {
      const zoom = mapA.getZoom();
      const pitch = mapA.getPitch();
      if (zoom > MIN_ZOOM_FOR_LG_PITCH) {
        mapA.setMaxPitch(MAX_PITCH_LG);
      } else {
        function setMaxPitch45() {
          mapA.setMaxPitch(MAX_PITCH_SM);
        }

        if (pitch > MAX_PITCH_SM) {
          mapA.flyTo({
            center: mapA.getCenter(),
            pitch: MAX_PITCH_SM,
            duration: 200,
          });
          // let animation finish before setting max pitch
          setTimeout(setMaxPitch45, 200);
        } else {
          setMaxPitch45();
        }
      }
    });
  });
});
