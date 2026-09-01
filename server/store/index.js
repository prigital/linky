const {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  paginateQuery,
} = require('@aws-sdk/lib-dynamodb');
const { ulid } = require('ulid');

const {
  doc,
  tableName,
  userPk,
  linkSk,
  PROFILE_SK,
  LINK_PREFIX,
} = require('./client');

// Attribute names are aliased throughout. Several of these (name, url) are
// DynamoDB reserved words, and aliasing all of them removes the need to
// remember which.
function isConditionalFailure(err) {
  return (
    err &&
    (err.name === 'ConditionalCheckFailedException' ||
      err.__type === 'ConditionalCheckFailedException')
  );
}

// Strips the pk/sk composite keys so the HTTP response shape matches the
// original SQLite API exactly.
function toApiLink(item) {
  if (!item) return null;
  return {
    id: item.id,
    user_id: item.user_id,
    url: item.url,
    title: item.title === undefined ? null : item.title,
    notes: item.notes === undefined ? null : item.notes,
    category: item.category === undefined ? null : item.category,
    created_at: item.created_at,
  };
}

function toApiUser(item) {
  if (!item) return null;
  return {
    id: item.google_id,
    google_id: item.google_id,
    email: item.email === undefined ? null : item.email,
    name: item.name === undefined ? null : item.name,
    avatar: item.avatar === undefined ? null : item.avatar,
  };
}

async function getUserById(googleId) {
  const out = await doc.send(
    new GetCommand({
      TableName: tableName(),
      Key: { pk: userPk(googleId), sk: PROFILE_SK },
    })
  );
  return toApiUser(out.Item);
}

// Single round trip, replacing the original INSERT OR IGNORE + UPDATE + SELECT.
async function upsertUser({ googleId, email, name, avatar }) {
  const now = new Date().toISOString();
  const out = await doc.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { pk: userPk(googleId), sk: PROFILE_SK },
      UpdateExpression:
        'SET google_id = :g, #email = :e, #name = :n, #avatar = :a, ' +
        'updated_at = :u, created_at = if_not_exists(created_at, :u)',
      ExpressionAttributeNames: {
        '#email': 'email',
        '#name': 'name',
        '#avatar': 'avatar',
      },
      ExpressionAttributeValues: {
        ':g': googleId,
        ':e': email === undefined ? null : email,
        ':n': name === undefined ? null : name,
        ':a': avatar === undefined ? null : avatar,
        ':u': now,
      },
      ReturnValues: 'ALL_NEW',
    })
  );
  return toApiUser(out.Attributes);
}

// ScanIndexForward: false gives newest-first because the ULID in the sort key is
// lexicographically ordered by creation time. Paginated because a single Query
// page caps at 1 MB and the client needs the whole list in one response (search
// and category grouping are client-side).
async function listLinks(googleId) {
  const paginator = paginateQuery(
    { client: doc },
    {
      TableName: tableName(),
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': userPk(googleId),
        ':prefix': LINK_PREFIX,
      },
      ScanIndexForward: false,
    }
  );

  const links = [];
  for await (const page of paginator) {
    for (const item of page.Items || []) {
      links.push(toApiLink(item));
    }
  }
  return links;
}

async function createLink(googleId, { url, title, notes, category }) {
  const id = ulid();
  const item = {
    pk: userPk(googleId),
    sk: linkSk(id),
    id,
    user_id: googleId,
    url,
    title: title || null,
    notes: notes || null,
    category: category || null,
    created_at: new Date().toISOString(),
  };

  await doc.send(
    new PutCommand({
      TableName: tableName(),
      Item: item,
      ConditionExpression: 'attribute_not_exists(pk)',
    })
  );

  return toApiLink(item);
}

// One conditional write instead of the original SELECT-then-UPDATE, which also
// closes the read/write race. Returns null when the link does not exist for
// this user, which the route turns into a 404.
async function updateLink(googleId, id, { url, title, notes, category }) {
  try {
    const out = await doc.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { pk: userPk(googleId), sk: linkSk(id) },
        UpdateExpression:
          'SET #url = :url, #title = :title, #notes = :notes, #category = :category',
        ExpressionAttributeNames: {
          '#url': 'url',
          '#title': 'title',
          '#notes': 'notes',
          '#category': 'category',
        },
        ExpressionAttributeValues: {
          ':url': url,
          ':title': title || null,
          ':notes': notes || null,
          ':category': category || null,
        },
        ConditionExpression: 'attribute_exists(pk)',
        ReturnValues: 'ALL_NEW',
      })
    );
    return toApiLink(out.Attributes);
  } catch (err) {
    if (isConditionalFailure(err)) return null;
    throw err;
  }
}

async function deleteLink(googleId, id) {
  try {
    await doc.send(
      new DeleteCommand({
        TableName: tableName(),
        Key: { pk: userPk(googleId), sk: linkSk(id) },
        ConditionExpression: 'attribute_exists(pk)',
      })
    );
    return true;
  } catch (err) {
    if (isConditionalFailure(err)) return false;
    throw err;
  }
}

module.exports = {
  getUserById,
  upsertUser,
  listLinks,
  createLink,
  updateLink,
  deleteLink,
};
