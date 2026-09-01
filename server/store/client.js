const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// Module scope so the connection pool is reused across warm Lambda invocations.
const base = new DynamoDBClient(
  process.env.LINKY_DDB_ENDPOINT
    ? { endpoint: process.env.LINKY_DDB_ENDPOINT }
    : {}
);

const doc = DynamoDBDocumentClient.from(base, {
  marshallOptions: { removeUndefinedValues: true },
});

function tableName() {
  const name = process.env.LINKY_TABLE_NAME;
  if (!name) throw new Error('LINKY_TABLE_NAME is not set');
  return name;
}

function userPk(googleId) {
  return `USER#${googleId}`;
}

function linkSk(id) {
  return `LINK#${id}`;
}

const PROFILE_SK = 'PROFILE';
const LINK_PREFIX = 'LINK#';

module.exports = { doc, tableName, userPk, linkSk, PROFILE_SK, LINK_PREFIX };
