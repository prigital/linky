// Viewer-request function on the /api/* and /auth/* behaviors.
//
// The AllViewerExceptHostHeader origin request policy strips the viewer Host
// header and CloudFront substitutes the API Gateway origin domain. Without this
// function the Lambda would see
// <api-id>.execute-api.<region>.amazonaws.com as its host and would build an
// OAuth redirect_uri that Google rejects with redirect_uri_mismatch.
//
// This runs before the stripping, and x-forwarded-host is an ordinary header
// that the policy forwards.
function handler(event) {
  var request = event.request;

  if (request.headers.host) {
    request.headers['x-forwarded-host'] = { value: request.headers.host.value };
  }

  return request;
}
