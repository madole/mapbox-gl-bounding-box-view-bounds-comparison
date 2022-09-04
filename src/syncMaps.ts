/**
 * Adapted from @mapbox/mapbox-gl-sync-move
 */
import mapboxgl from "mapbox-gl";

function moveToMapPosition(master: mapboxgl.Map, clones: mapboxgl.Map[]) {
  const center = master.getCenter();
  const zoom = master.getZoom();
  const bearing = master.getBearing();

  clones.forEach(function (clone) {
    clone.jumpTo({
      center: center,
      zoom: zoom - 2,
      bearing: bearing,
      pitch: 0,
    });
  });
}

// Sync movements of two maps.
//
// All interactions that result in movement end up firing
// a "move" event. The trick here, though, is to
// ensure that movements don't cycle from one map
// to the other and back again, because such a cycle
// - could cause an infinite loop
// - prematurely halts prolonged movements like
//   double-click zooming, box-zooming, and flying
function syncMaps(mapA: mapboxgl.Map, ...rest: mapboxgl.Map[]) {
  let maps = [mapA, ...rest];

  // Create all the movement functions, because if they're created every time
  // they wouldn't be the same and couldn't be removed.
  let fns: ((
    ev: mapboxgl.MapboxEvent<MouseEvent | TouchEvent | WheelEvent | undefined> &
      mapboxgl.EventData
  ) => void)[] = [];
  maps.forEach(function (map, index) {
    fns[index] = sync.bind(
      null,
      map,
      maps.filter(function (_, i) {
        return i !== index;
      })
    );
  });

  function on() {
    maps.forEach(function (map, index) {
      map.on("move", fns[index]);
    });
  }

  function off() {
    maps.forEach(function (map, index) {
      map.off("move", fns[index]);
    });
  }

  // When one map moves, we turn off the movement listeners
  // on all the maps, move it, then turn the listeners on again
  function sync(master: mapboxgl.Map, clones: mapboxgl.Map[]) {
    off();
    moveToMapPosition(master, clones);
    on();
  }

  on();
  return function () {
    off();
    fns = [];
    maps = [];
  };
}

export default syncMaps;
