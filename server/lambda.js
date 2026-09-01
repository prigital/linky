const serverlessExpress = require('@codegenie/serverless-express');

const buildApp = require('./app');
const { getConfig } = require('./config');

let handlerPromise = null;

function init() {
  if (handlerPromise) return handlerPromise;

  handlerPromise = (async function () {
    // Pull the secret once per execution environment, before serving, so the
    // OAuth strategy registration is warm by the first request.
    await getConfig();
    return serverlessExpress({ app: buildApp() });
  })().catch(function (err) {
    handlerPromise = null; // never cache a failure
    throw err;
  });

  return handlerPromise;
}

exports.handler = async function (event, context) {
  const handle = await init();
  return handle(event, context);
};
