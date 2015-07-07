/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


var viewerLeft, viewerRight;
var updatingLeft = false, updatingRight = false;
var leftLoaded = false, rightLoaded = false, cleanedModel = false;
 
function initialize() {
 
  // Get our access token from the internal web-service API
 alert(window.location.host);
  $.get('http://' + window.location.host, //+ '/api/token',  //TODO: specify autodesk url because you aren't hosting it on their page but on your localhost
    function (accessToken) {
 
      // Specify our options, including the document ID
// {"token_type":"Bearer","expires_in":1799,"access_token":}
      var options = {};
      options.env = 'AutodeskProduction';
      options.accessToken = "i4gUO3mvI9FIHChkTyBQnhOoiTmt"; //generate this using git bash curl command: $ curl --data "client_id=Xrdqhny2pKxf1MYGK3nO9RqRiG9jwABk&client_secret=52Yg1cS
                                                             //44ovHhxKT&grant_type=client_credentials" https://developer.api.autodesk.com/authentication/v1/authenticate --header "Content-Type: application/x-www-form-urlencoded" -k
      options.document =
       "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6dGVzdGdidWNrdC9nZ2IuZHdm";
 
      // Create and initialize our two 3D viewers
 
      var elem = document.getElementById('viewLeft');
      viewerLeft = new Autodesk.Viewing.Viewer3D(elem, {});
 
      Autodesk.Viewing.Initializer(options, function () {
        viewerLeft.initialize();
        loadDocument(viewerLeft, options.document);
      });
 
      elem = document.getElementById('viewRight');
      viewerRight = new Autodesk.Viewing.Viewer3D(elem, {});
 
      Autodesk.Viewing.Initializer(options, function () {
        viewerRight.initialize();
        loadDocument(viewerRight, options.document);
      });
    }
  );
}
 
function loadDocument(viewer, docId) {
 
  // The viewer defaults to the full width of the container,
  // so we need to set that to 50% to get side-by-side
 
  viewer.container.style.width = '50%';
  viewer.resize();
 
  // Let's zoom in and out of the pivot - the screen
  // real estate is fairly limited - and reverse the
  // zoom direction
 
  viewer.navigation.setZoomTowardsPivot(true);
  viewer.navigation.setReverseZoomDirection(true);
 
  if (docId.substring(0, 4) !== 'urn:')
    docId = 'urn:' + docId;
 
  Autodesk.Viewing.Document.load(docId,
    function (document) {
 
      // Boilerplate code to load the contents
 
      var geometryItems = [];
 
      if (geometryItems.length == 0) {
        geometryItems =
          Autodesk.Viewing.Document.getSubItemsWithProperties(
            document.getRootItem(),
            { 'type': 'geometry', 'role': '3d' },
            true
          );
      }
      if (geometryItems.length > 0) {
        viewer.load(document.getViewablePath(geometryItems[0]));
      }
 
      // Add our custom progress listener and set the loaded
      // flags to false
 
      viewer.addEventListener('progress', progressListener);
      leftLoaded = rightLoaded = false;
    },
    function (errorMsg, httpErrorCode) {
      var container = document.getElementById('viewerLeft');
      if (container) {
        alert('Load error ' + errorMsg);
      }
    }
  );
}
 
// Progress listener to set the view once the data has started
// loading properly (we get a 5% notification early on that we
// need to ignore - it comes too soon)
 
function progressListener(e) {
 
  // If we haven't cleaned this model's materials and set the view
  // and both viewers are sufficiently ready, then go ahead
 
  if (!cleanedModel &&
    ((e.percent > 0.1 && e.percent < 5) || e.percent > 5)) {
 
    if (e.target.clientContainer.id === 'viewLeft')
      leftLoaded = true;
    else if (e.target.clientContainer.id === 'viewRight')
      rightLoaded = true;
 
    if (leftLoaded && rightLoaded && !cleanedModel) {
 
      // Iterate the materials to change any red ones to grey
 
      for (var p in viewerLeft.impl.matman().materials) {
        var m = viewerLeft.impl.matman().materials[p];
        if (m.color.r >= 0.5 && m.color.g == 0 && m.color.b == 0) {
          m.color.r = m.color.g = m.color.b = 0.5;
          m.needsUpdate = true;
        }
      }
      for (var p in viewerRight.impl.matman().materials) {
        var m = viewerRight.impl.matman().materials[p];
        if (m.color.r >= 0.5 && m.color.g == 0 && m.color.b == 0) {
          m.color.r = m.color.g = m.color.b = 0.5;
          m.needsUpdate = true;
        }
      }
 
      // Zoom to the overall view initially
 
      zoomEntirety(viewerLeft);
      setTimeout(function () { transferCameras(true); }, 0);
 
      cleanedModel = true;
    }
  }
  else if (cleanedModel && e.percent > 10) {
 
    // If we have already cleaned and are even further loaded,
    // remove the progress listeners from the two viewers and
    // watch the cameras for updates
 
    unwatchProgress();
 
    watchCameras();
  }
}
 
// Add and remove the pre-viewer event handlers
 
function watchCameras() {
  viewerLeft.addEventListener('cameraChanged', left2right);
  viewerRight.addEventListener('cameraChanged', right2left);
}
 
function unwatchCameras() {
  viewerLeft.removeEventListener('cameraChanged', left2right);
  viewerRight.removeEventListener('cameraChanged', right2left);
}
 
function unwatchProgress() {
  viewerLeft.removeEventListener('progress', progressListener);
  viewerRight.removeEventListener('progress', progressListener);
}
 
// Event handlers for the cameraChanged events
 
function left2right() {
  if (!updatingRight) {
    updatingLeft = true;
    transferCameras(true);
    setTimeout(function () { updatingLeft = false; }, 500);
  }
}
 
function right2left() {
  if (!updatingLeft) {
    updatingRight = true;
    transferCameras(false);
    setTimeout(function () { updatingRight = false; }, 500);
  }
}
 
function transferCameras(leftToRight) {
 
  // The direction argument dictates the source and target
 
  var source = leftToRight ? viewerLeft : viewerRight;
  var target = leftToRight ? viewerRight : viewerLeft;
 
  var pos = source.navigation.getPosition();
  var trg = source.navigation.getTarget();
 
  // Set the up vector manually for both cameras
 
  var upVector = new THREE.Vector3(0, 0, 1);
  source.navigation.setWorldUpVector(upVector);
  target.navigation.setWorldUpVector(upVector);
 
  // Get the new position for the target camera
 
  var up = source.navigation.getCameraUpVector();
 
  // Get the position of the target camera
 
  var newPos = offsetCameraPos(source, pos, trg, leftToRight);
 
  // Save the left-hand camera position: device tilt orbits
  // will be relative to this point
 
  leftPos = leftToRight ? pos : newPos;
 
  // Zoom to the new camera position in the target
 
  zoom(
    target, newPos.x, newPos.y, newPos.z, trg.x, trg.y, trg.z,
    up.x, up.y, up.z
  );
}
 
function offsetCameraPos(source, pos, trg, leftToRight) {
 
  // Get the distance from the camera to the target
 
  var xd = pos.x - trg.x;
  var yd = pos.y - trg.y;
  var zd = pos.z - trg.z;
  var dist = Math.sqrt(xd * xd + yd * yd + zd * zd);
 
  // Use a small fraction of this distance for the camera offset
 
  var disp = dist * 0.04;
 
  // Clone the camera and return its X translated position
 
  var clone = source.autocamCamera.clone();
  clone.translateX(leftToRight ? disp : -disp);
  return clone.position;
}
 
// Model-specific helper to zoom into a specific part of the model
 
function zoomEntirety(viewer) {
  zoom(viewer, -48722.5, -54872, 44704.8, 10467.3, 1751.8, 1462.8);
}
 
// Set the camera based on a position, target and optional up vector
 
function zoom(viewer, px, py, pz, tx, ty, tz, ux, uy, uz) {
 
  // Make sure our up vector is correct for this model
 
  var upVector = new THREE.Vector3(0, 0, 1);
  viewer.navigation.setWorldUpVector(upVector, true);
 
  var up =
    (ux && uy && uz) ? new THREE.Vector3(ux, uy, uz) : upVector;
 
  viewer.navigation.setView(
    new THREE.Vector3(px, py, pz),
    new THREE.Vector3(tx, ty, tz)
  );
  viewer.navigation.setCameraUpVector(up);
}