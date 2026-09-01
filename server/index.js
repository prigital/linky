// Local entrypoint. The only place dotenv is loaded, so the Lambda bundle never
// attempts a filesystem read for .env.
require('dotenv').config();

const buildApp = require('./app');

const PORT = process.env.PORT || 3001;

buildApp().listen(PORT, function () {
  console.log(`Linky server running on http://localhost:${PORT}`);
});
