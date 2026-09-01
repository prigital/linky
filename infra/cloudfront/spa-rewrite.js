// Viewer-request function on the DEFAULT (S3) behavior only.
//
// This exists instead of distribution-level CustomErrorResponses. Custom error
// responses apply to EVERY cache behavior, so mapping 403/404 to /index.html
// with status 200 would rewrite the API's legitimate
// 404 {"error":"Link not found"} into an HTML page with status 200, and the
// client's `res.ok` check would report a failed delete as a success.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);

  // No dot in the final segment means it is an app route, not an asset.
  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }

  return request;
}
