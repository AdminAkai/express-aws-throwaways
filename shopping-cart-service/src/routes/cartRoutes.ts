import { NextFunction, Request, Response, Router } from "express";
import * as cartRepository from "../db/cartRepository";
import { AddItemInput, ValidationError } from "../types";

export const cartRouter = Router();

// wraps an async handler so rejected promises reach the error middleware
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`"${field}" is required and must be a non-empty string`);
  }
  return value;
}

function requirePositiveInt(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`"${field}" must be a non-negative integer`);
  }
  return value;
}

// GET /carts/:userId - full cart with computed totals
cartRouter.get(
  "/:userId",
  asyncHandler(async (req, res) => {
    const cart = await cartRepository.getCart(req.params.userId);
    res.json(cart);
  }),
);

// POST /carts/:userId/items - add an item, or increment quantity if it's
// already in the cart
cartRouter.post(
  "/:userId/items",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const input: AddItemInput = {
      productId: requireString(body.productId, "productId"),
      productName: requireString(body.productName, "productName"),
      unitPriceCents: requirePositiveInt(body.unitPriceCents, "unitPriceCents"),
      quantity: requirePositiveInt(body.quantity ?? 1, "quantity"),
    };
    if (input.quantity === 0) {
      throw new ValidationError('"quantity" must be at least 1 when adding an item');
    }
    const item = await cartRepository.addItem(req.params.userId, input);
    res.status(201).json(item);
  }),
);

// PATCH /carts/:userId/items/:productId - set an exact quantity.
// quantity: 0 removes the item (same effect as DELETE).
cartRouter.patch(
  "/:userId/items/:productId",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const quantity = requirePositiveInt(body.quantity, "quantity");
    const { userId, productId } = req.params;

    if (quantity === 0) {
      await cartRepository.removeItem(userId, productId);
      res.status(204).send();
      return;
    }
    const item = await cartRepository.setItemQuantity(userId, productId, quantity);
    res.json(item);
  }),
);

// DELETE /carts/:userId/items/:productId - remove a single line item
cartRouter.delete(
  "/:userId/items/:productId",
  asyncHandler(async (req, res) => {
    await cartRepository.removeItem(req.params.userId, req.params.productId);
    res.status(204).send();
  }),
);

// DELETE /carts/:userId - empty the whole cart
cartRouter.delete(
  "/:userId",
  asyncHandler(async (req, res) => {
    await cartRepository.clearCart(req.params.userId);
    res.status(204).send();
  }),
);
