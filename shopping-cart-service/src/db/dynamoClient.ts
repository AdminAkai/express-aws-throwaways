import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// In Lambda, credentials and region come from the execution environment -
// no explicit config needed. Locally, DYNAMODB_ENDPOINT points this at
// DynamoDB Local instead of real AWS (see docker-compose.yml).
const baseClient = new DynamoDBClient({
  ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
});

export const ddbDocClient = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export const CART_TABLE_NAME = process.env.CART_TABLE_NAME ?? "CartItems-dev";
