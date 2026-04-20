// Helper to create successful API Gateway response
exports.createResponse = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token,X-Amz-User-Agent',
      'Access-Control-Expose-Headers': 'ETag',
    },
    body: JSON.stringify(body),
  };
};

// Helper to create error API Gateway response
exports.createErrorResponse = (statusCode, message, error = null) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token,X-Amz-User-Agent',
      'Access-Control-Expose-Headers': 'ETag',
    },
    body: JSON.stringify({
      message,
      ...(error && { error }),
    }),
  };
};
