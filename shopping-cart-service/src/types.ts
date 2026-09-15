export interface CartItem {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  addedAt: string;
  updatedAt: string;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
}

export interface AddItemInput {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
}

export interface UpdateItemInput {
  quantity: number;
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
