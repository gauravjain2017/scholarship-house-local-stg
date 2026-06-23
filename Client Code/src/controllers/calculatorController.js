const { dynamoDB, TABLES } = require('../config/aws');
const {
  PutCommand,
  DeleteCommand,
  UpdateCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');

const saveCalculation = async (req, res) => {
  try {
    const { client_email, type } = req.body;
    const payload = req.body;
    const now = new Date().toISOString();

    if (!client_email) {
      return res.status(400).json({
        error: 'Client email is required',
      });
    }

    if (!type) {
      return res.status(400).json({
        error: 'Type is required',
      });
    }

    const result = await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.JV_CALCULATOR,
        Key: {
          client_email,
          type,
        },
        UpdateExpression: `
          SET #payload = :payload,
              updatedAt = :updatedAt,
              createdAt = if_not_exists(createdAt, :createdAt)
        `,
        ExpressionAttributeNames: {
          '#payload': 'payload',
        },
        ExpressionAttributeValues: {
          ':payload': payload,
          ':updatedAt': now,
          ':createdAt': now,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Calculation saved successfully',
      data: result.Attributes,
    });
  } catch (err) {
    console.error('❌ saveCalculation failed:', err);

    return res.status(500).json({
      success: false,
      error: 'Failed to save calculation',
      details: err.message,
    });
  }
};

const getCalculationsByClientEmail = async (req, res) => {
  try {

    const { client_email, type } = req.params;

    console.log('client_email:', client_email);
    console.log('type:', type);
    // const { client_email } = req.query;

    if (!client_email) {
      return res.status(400).json({
        error: 'Client email is required',
      });
    }

    // const result = await dynamoDB.send(
    //   new QueryCommand({
    //     TableName: TABLES.JV_CALCULATOR,
    //     KeyConditionExpression: 'client_email = :client_email',
    //     ExpressionAttributeValues: {
    //       ':client_email': client_email,
    //     },
    //   })
    // );
    const result = await dynamoDB.send(
      new QueryCommand({
        TableName: TABLES.JV_CALCULATOR,
        KeyConditionExpression:
          '#client_email = :client_email AND #type = :type',
        ExpressionAttributeNames: {
          '#client_email': 'client_email',
          '#type': 'type',
        },
        ExpressionAttributeValues: {
          ':client_email': client_email,
          ':type': type,
        },
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Calculations retrieved successfully',
      data: result.Items,
    });
  } catch (err) {
    console.error('❌ getCalculationsByClientEmail failed:', err);

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve calculations',
      details: err.message,
    });
  }
};

module.exports = {
  saveCalculation,
  getCalculationsByClientEmail,
};
