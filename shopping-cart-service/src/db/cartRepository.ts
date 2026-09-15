import {
  DeleteCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { CART_TABLE_NAME, ddbDocClient } from "./dynamoClient";
import { AddItemInput, Cart, CartItem, NotFoundError } from "../types";

// Single-table style design (one table, generic pk/sk) even though this
// service only owns one entity today - it's the idiom you'll reuse once a
// table holds carts, orders, etc. together.
//   pk = USER#<userId>
//   sk = ITEM#<productId>
const userPk = (userId: string): string => `USER#${userId}`;
const itemSk = (productId: string): string => `ITEM#${productId}`;

interface CartItemRecord extends CartItem {
  pk: string;
  sk: string;
}

function toCartItem(record: CartItemRecord): CartItem {
  const { productId, productName, unitPriceCents, quantity, addedAt, updatedAt } = record;
  return { productId, productName, unitPriceCents, quantity, addedAt, updatedAt };
}

function summarize(userId: string, items: CartItem[]): Cart {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalCents = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  return { userId, items, itemCount, subtotalCents };
}

export async function getCart(userId: string): Promise<Cart> {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: CART_TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": userPk(userId) },
    }),
  );
  const items = ((result.Items ?? []) as CartItemRecord[]).map(toCartItem);
  return summarize(userId, items);
}

// Adds a new line item, or increments quantity if the product is already
// in the cart. Uses an atomic ADD so concurrent requests (double-clicking
// "add to cart") don't lose an update.
export async function addItem(userId: string, input: AddItemInput): Promise<CartItem> {
  const now = new Date().toISOString();
  const result = await ddbDocClient.send(
    new UpdateCommand({
      TableName: CART_TABLE_NAME,
      Key: { pk: userPk(userId), sk: itemSk(input.productId) },
      UpdateExpression:
        "SET productId = :productId, productName = :productName, unitPriceCents = :price, " +
        "updatedAt = :now, addedAt = if_not_exists(addedAt, :now) " +
        "ADD quantity :qty",
      ExpressionAttributeValues: {
        ":productId": input.productId,
        ":productName": input.productName,
        ":price": input.unitPriceCents,
        ":now": now,
        ":qty": input.quantity,
      },
      ReturnValues: "ALL_NEW",
    }),
  );
  return toCartItem(result.Attributes as CartItemRecord);
}

// Sets a line item's quantity to an exact value (used by PATCH). Requires
// the item to already exist - callers should use addItem for the first add.
export async function setItemQuantity(
  userId: string,
  productId: string,
  quantity: number,
): Promise<CartItem> {
  try {
    const result = await ddbDocClient.send(
      new UpdateCommand({
        TableName: CART_TABLE_NAME,
        Key: { pk: userPk(userId), sk: itemSk(productId) },
        UpdateExpression: "SET quantity = :qty, updatedAt = :now",
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeValues: {
          ":qty": quantity,
          ":now": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return toCartItem(result.Attributes as CartItemRecord);
  } catch (err: unknown) {
    if (isConditionalCheckFailed(err)) {
      throw new NotFoundError(`Item ${productId} is not in the cart for user ${userId}`);
    }
    throw err;
  }
}

export async function removeItem(userId: string, productId: string): Promise<void> {
  await ddbDocClient.send(
    new DeleteCommand({
      TableName: CART_TABLE_NAME,
      Key: { pk: userPk(userId), sk: itemSk(productId) },
    }),
  );
}

export async function clearCart(userId: string): Promise<void> {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: CART_TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": userPk(userId) },
      ProjectionExpression: "sk",
    }),
  );
  const items = (result.Items ?? []) as { sk: string }[];
  await Promise.all(
    items.map((item) =>
      ddbDocClient.send(
        new DeleteCommand({
          TableName: CART_TABLE_NAME,
          Key: { pk: userPk(userId), sk: item.sk },
        }),
      ),
    ),
  );
}

export async function getItem(userId: string, productId: string): Promise<CartItem | undefined> {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: CART_TABLE_NAME,
      Key: { pk: userPk(userId), sk: itemSk(productId) },
    }),
  );
  return result.Item ? toCartItem(result.Item as CartItemRecord) : undefined;
}

function isConditionalCheckFailed(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: unknown }).name === "ConditionalCheckFailedException"
  );
}
