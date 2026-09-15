import request from "supertest";
import { createApp } from "../src/app";

// This exercises validation + routing without touching DynamoDB, so it
// runs anywhere with no AWS credentials or docker required. Full request
// flow (including the DynamoDB calls) is meant to be tested against
// DynamoDB Local - see README "Local development" for that loop.
describe("shopping cart app", () => {
  const app = createApp();

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("404s on unknown routes", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
  });

  it("rejects POST /carts/:userId/items missing required fields", async () => {
    const res = await request(app).post("/carts/u1/items").send({ productId: "sku-1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/productName/);
  });

  it("rejects a negative unitPriceCents", async () => {
    const res = await request(app)
      .post("/carts/u1/items")
      .send({ productId: "sku-1", productName: "Widget", unitPriceCents: -5, quantity: 1 });
    expect(res.status).toBe(400);
  });
});
