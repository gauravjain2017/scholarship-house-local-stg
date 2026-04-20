const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  GetCommand,
} = require('@aws-sdk/lib-dynamodb');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamo = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'properties';
const backendConstants = require('../../backend_constants');

const JWT_SECRET = backendConstants.authentication.JWT_SECRET;

function getUserFromEvent(event) {
  const authHeader =
    event.headers?.Authorization || event.headers?.authorization;

  if (!authHeader) return null;

  const token = authHeader.split(' ')[1];
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/* ---------------- CREATE DEAL ---------------- */

exports.createDeal = async (event) => {
  const id = randomUUID();

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const item = {
    id,
    status: 'pending',
    submittedAt: new Date().toISOString(),

    title: body.title,
    description: body.description,
    category: body.category?.toLowerCase() || null,
    price: Number(body.price),

    streetAddress: body.streetAddress,
    addressLine2: body.addressLine2 || null,
    city: body.city,
    stateRegion: body.stateRegion,
    postalCode: body.postalCode,

    bedrooms: Number(body.bedrooms),
    bathrooms: Number(body.bathrooms),
    squareFootage: Number(body.squareFootage),
    yearBuilt: Number(body.yearBuilt),

    interiorImages: body.interiorImages || [],
    exteriorImages: body.exteriorImages || [],
    additionalImages: body.additionalImages || [],

    submitterEmail: body.email?.toLowerCase() || null,
    submitterFullName: body.fullName || null,

    priorityFirstAccess: body.priorityFirstAccess === true,
    doneForYou: false,
    fiftyFiftyPartner: false,
  };

  await dynamo.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, id }),
  };
};

/* ---------------- GET PUBLISHED DEALS ---------------- */

exports.getPublishedDeals = async (event) => {
  const user = getUserFromEvent(event);

  const isAdmin = user?.role === 'admin';
  const isTeamMember = user?.role === 'team_member';
  const hasPriority = user?.priority === true;
  const hasPartnership = user?.partnership === true;
  const hasTurnkey = user?.turnkey === true;

  const result = await dynamo.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: '#s = :published',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':published': 'published' },
    })
  );

  let items = result.Items || [];

  // Filter based on property type permissions
  if (!isAdmin && !isTeamMember) {
    items = items.filter((deal) => {
      // Check Priority access
      if (deal.priorityFirstAccess === true && !hasPriority) {
        return false;
      }
      // Check Partnership access
      if (deal.fiftyFiftyPartner === true && !hasPartnership) {
        return false;
      }
      // Check Turnkey access
      if (deal.turnkeyFurnished && deal.turnkeyFurnished !== 'NOT_FURNISHED' && !hasTurnkey) {
        return false;
      }
      return true;
    });
  }

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(items),
  };
};

/* ---------------- GET DEAL BY ID ---------------- */

exports.getDealById = async (event) => {
  const dealId = event.pathParameters?.id;
  if (!dealId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing deal id' }),
    };
  }

  const user = getUserFromEvent(event);
  const isAdmin = user?.role === 'admin';
  const isTeamMember = user?.role === 'team_member';
  const hasPriority = user?.priority === true;
  const hasPartnership = user?.partnership === true;
  const hasTurnkey = user?.turnkey === true;

  const result = await dynamo.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: dealId },
    })
  );

  const deal = result.Item;
  if (!deal) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Deal not found' }),
    };
  }

  // Check property type access permissions
  if (!isAdmin && !isTeamMember) {
    if (deal.priorityFirstAccess === true && !hasPriority) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Priority access required' }),
      };
    }
    if (deal.fiftyFiftyPartner === true && !hasPartnership) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Partnership access required' }),
      };
    }
    if (deal.turnkeyFurnished && deal.turnkeyFurnished !== 'NOT_FURNISHED' && !hasTurnkey) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Turnkey access required' }),
      };
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(deal),
  };
};
