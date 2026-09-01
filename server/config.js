// Loads runtime configuration, memoized for the life of the process (or the
// Lambda execution environment). In AWS the secret values come from Secrets
// Manager; locally they come from .env via server/index.js.
//
// Deliberately NOT using {{resolve:secretsmanager:...}} in a Lambda environment
// variable: CloudFormation resolves those at deploy time, which would store the
// plaintext in the function configuration and would never pick up a rotation.

let cachedPromise = null;

function getConfig() {
  if (cachedPromise) return cachedPromise;
  cachedPromise = load().catch(function (err) {
    cachedPromise = null; // never cache a failure
    throw err;
  });
  return cachedPromise;
}

async function load() {
  if (!process.env.LINKY_SECRET_ID) {
    return {
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
      jwtSecret: process.env.SESSION_SECRET,
    };
  }

  const {
    SecretsManagerClient,
    GetSecretValueCommand,
  } = require('@aws-sdk/client-secrets-manager');

  const client = new SecretsManagerClient({});
  const out = await client.send(
    new GetSecretValueCommand({ SecretId: process.env.LINKY_SECRET_ID })
  );

  const parsed = JSON.parse(out.SecretString);
  return {
    googleClientId: parsed.GOOGLE_CLIENT_ID,
    googleClientSecret: parsed.GOOGLE_CLIENT_SECRET,
    jwtSecret: parsed.JWT_SECRET,
  };
}

module.exports = { getConfig };
