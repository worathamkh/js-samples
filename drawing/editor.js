var drawingManager;
var selectedShape;
var colors = ['#1E90FF', '#FF1493', '#32CD32', '#FF8C00', '#4B0082'];
var selectedColor;
var colorButtons = {};

function clearSelection() {
  if (selectedShape) {
    selectedShape.setEditable(false);
    selectedShape = null;
  }
}

function setSelection(shape) {
  clearSelection();
  selectedShape = shape;
  shape.setEditable(true);
  selectColor(shape.get('fillColor') || shape.get('strokeColor'));
}

function deleteSelectedShape() {
  if (selectedShape) {
    var id = JSON.stringify(selectedShape.getPath().getArray()).hashCode();
    var i = polylines.findIndex(function(p) {
      return p.id === id;
    });
    polylines.splice(i, 1);
    selectedShape.setMap(null);
  }
}

function selectColor(color) {
  selectedColor = color;
  for (var i = 0; i < colors.length; ++i) {
    var currColor = colors[i];
    colorButtons[currColor].style.border = currColor == color ? '2px solid #789' : '2px solid #fff';
  }

  // Retrieves the current options from the drawing manager and replaces the
  // stroke or fill color as appropriate.
  var polylineOptions = drawingManager.get('polylineOptions');
  polylineOptions.strokeColor = color;
  drawingManager.set('polylineOptions', polylineOptions);

  var rectangleOptions = drawingManager.get('rectangleOptions');
  rectangleOptions.fillColor = color;
  drawingManager.set('rectangleOptions', rectangleOptions);

  var circleOptions = drawingManager.get('circleOptions');
  circleOptions.fillColor = color;
  drawingManager.set('circleOptions', circleOptions);

  var polygonOptions = drawingManager.get('polygonOptions');
  polygonOptions.fillColor = color;
  drawingManager.set('polygonOptions', polygonOptions);
}

function setSelectedShapeColor(color) {
  if (selectedShape) {
    if (selectedShape.type == google.maps.drawing.OverlayType.POLYLINE) {
      selectedShape.set('strokeColor', color);
    } else {
      selectedShape.set('fillColor', color);
    }
  }
}

function makeColorButton(color) {
  var button = document.createElement('span');
  button.className = 'color-button';
  button.style.backgroundColor = color;
  google.maps.event.addDomListener(button, 'click', function() {
    selectColor(color);
    setSelectedShapeColor(color);
  });

  return button;
}

function buildColorPalette() {
  var colorPalette = document.getElementById('color-palette');
  for (var i = 0; i < colors.length; ++i) {
    var currColor = colors[i];
    var colorButton = makeColorButton(currColor);
    colorPalette.appendChild(colorButton);
    colorButtons[currColor] = colorButton;
  }
  selectColor(colors[0]);
}
Array.prototype.pairs = function (func) {
    var pairs = [];
    for (var i = 0; i < this.length - 1; i++) {
        for (var j = i; j < this.length - 1; j++) {
            func([this[i], this[j+1]]);
        }
    }
}
function vtx2str(v) {
  return '(' + v[0] + ', ' + v[1] + ')';
}
String.prototype.hashCode = function(){
  var hash = 0;
  if (this.length == 0) return hash;
  for (i = 0; i < this.length; i++) {
    char = this.charCodeAt(i);
    hash = ((hash<<5)-hash)+char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}
var vertices = [];
// var edges = [];
var polylines = [];
var paths = [];
var expJSON = '';
function distance(u, v) {
  return google.maps.geometry.spherical.computeDistanceBetween(
    new google.maps.LatLng(u.lat, u.lng),
    new google.maps.LatLng(v.lat, v.lng)
  );
}
function veq(u, v) {
  return u.lat === v.lat && u.lng === v.lng;
}
function updateData(newPathGiven, id) {
  var newPath = {
    id: id,
    run: []
  };
  newPathGiven.forEach(function(v) {
    var u = {
      lat: v.lat(),
      lng: v.lng()
    };
    u.id = (u.lat.toString()+u.lng.toString()).hashCode();
    newPath.run.push(u);
  });
  polylines.forEach(function(p) {
    newPath.run.map(function(u) {
      p.run.forEach(function(v) {
        // console.log(JSON.stringify(u), 'vs', JSON.stringify(v));
        var d = distance(u, v);
        // console.log(d);
        if (d < 2) {
          // console.log('same vertex with d(u,v) =', d);
          // console.log('u =', JSON.stringify(u, null, 2));
          // console.log('v =', JSON.stringify(v, null, 2));
          u.lat = v.lat;
          u.lng = v.lng;
          u.id = v.id;
        }
      });
      return u;
    });
  });
  polylines.push(newPath);
  var maybeVertices = [];
  polylines.forEach(function(p) {
    for (var i = 0; i < p.run.length; i++) {
      var hit = false;
      var v = p.run[i];
      // console.log('v =', v);
      // console.log(JSON.stringify(maybeVertices));
      for (var j = 0; j < maybeVertices.length; j++) {
        var u = maybeVertices[j];
        // console.log('u =', u);
        // var d = distance(u, v);
        // if (d < 0.0001) {
        // if (veq(u, v)) {
        if (u.id == v.id) {
          hit = true;
          //console.log('hit!');
          break;
        }
      }
      if (!hit) {
        maybeVertices.push(v);
      }
    }
  });
  paths = [];
  polylines.forEach(function(p) {
    for (var i = 0; i < p.run.length-1; i++) {
      var u = p.run[i], v = p.run[i+1];
      var run = [u, v];
      var d = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(u.lat, u.lng),
          new google.maps.LatLng(v.lat, v.lng));
      // var id = (u.id.toString() + v.id.toString()).hashCode();
      // need to be commutative
      var id = (u.id * v.id).toString().hashCode()
      var path = {
        id: id,
        run: run,
        distance: d,
        safety: {}
      };
      paths.push(path);
    }
  });
  maybeVertices.map(function(v) {
    v.adjPaths = [];
    v.adjVertices = [];
    paths.forEach(function(p) {
      // if (veq(v, p.run[0])) {
      if (v.id == p.run[0].id) {
        v.adjVertices.push(p.run[1].id);
        v.adjPaths.push(p.id);
      // } else if (veq(v, p.run[1])){
      } else if (v.id == p.run[1].id) {
        v.adjVertices.push(p.run[0].id);
        v.adjPaths.push(p.id);
      }
    });
    return v;
  });
  vertices = maybeVertices;
  expJSON = JSON.stringify({
    vertices: vertices,
    paths: paths,
    polylines: polylines
  }, null, 2);
  console.log('#vertices =', vertices.length)
  console.log('#paths =', paths.length)
  console.log('#polylines =', polylines.length)
  document.getElementById('output-area').value = expJSON;
}
function initialize() {
  var map = new google.maps.Map(document.getElementById('map'), {
    zoom: 18,
    center: new google.maps.LatLng(18.7964991, 98.9526191), // CMU Clock Tower
    // center: new google.maps.LatLng(14.080352, 100.603294), // NECTEC Science House
    // mapTypeId: google.maps.MapTypeId.ROADMAP,
    mapTypeId: google.maps.MapTypeId.HYBRID,
    disableDefaultUI: true,
    zoomControl: true
  });

  var polyOptions = {
    strokeWeight: 0,
    fillOpacity: 0.45,
    editable: true
  };
  // Creates a drawing manager attached to the map that allows the user to draw
  // markers, lines, and shapes.
  drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: google.maps.drawing.OverlayType.POLYLINE,
    markerOptions: {
      draggable: true
    },
    polylineOptions: {
      editable: true,
      draggable: true,
      strokeWeight: 5
    },
    rectangleOptions: polyOptions,
    circleOptions: polyOptions,
    polygonOptions: polyOptions,
    map: map
  });

  google.maps.event.addListener(drawingManager, 'overlaycomplete', function(e) {
      if (e.type != google.maps.drawing.OverlayType.MARKER) {
        // Switch back to non-drawing mode after drawing a shape.
        drawingManager.setDrawingMode(null);

      // Add an event listener that selects the newly-drawn shape when the user
      // mouses down on it.
      var newShape = e.overlay;
      newShape.type = e.type;
      // printVertices(e.overlay.getPath().getArray());
      var pathArray = newShape.getPath().getArray();
      var id = JSON.stringify(pathArray).hashCode();
      updateData(pathArray, id);
      google.maps.event.addListener(newShape, 'click', function() {
        setSelection(newShape);
      });
      console.log(google.maps.geometry.spherical.computeLength(newShape.getPath().getArray()));
      google.maps.event.addListener(newShape.getPath(), "insert_at", function(e){
        // console.log('path inserted');
        var i = polylines.findIndex(function(p) {
          return p.id === id;
        });
        polylines.splice(i, 1);
        updateData(newShape.getPath().getArray(), id);
      });
      google.maps.event.addListener(newShape.getPath(), "set_at", function(e){
        console.log('path changed');
        // console.log(JSON.stringify(e, null, 2));
        var i = polylines.findIndex(function(p) {
          return p.id === id;
        });
        polylines.splice(i, 1);
        updateData(newShape.getPath().getArray(), id);
      });
      setSelection(newShape);
    }
  });

  // Clear the current selection when the drawing mode is changed, or when the
  // map is clicked.
  google.maps.event.addListener(drawingManager, 'drawingmode_changed', clearSelection);
  google.maps.event.addListener(map, 'click', clearSelection);
  google.maps.event.addDomListener(document.getElementById('delete-button'), 'click', deleteSelectedShape);

  buildColorPalette();
}
google.maps.event.addDomListener(window, 'load', initialize);

