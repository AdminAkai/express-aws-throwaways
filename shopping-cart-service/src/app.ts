import express, { Express } from "express";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { cartRouter } from "./routes/cartRoutes";

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/carts", cartRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
