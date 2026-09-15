import "dotenv/config";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`shopping-cart-service listening on http://localhost:${port}`);
  console.log(`  table: ${process.env.CART_TABLE_NAME ?? "CartItems-dev"}`);
  console.log(`  dynamodb endpoint: ${process.env.DYNAMODB_ENDPOINT ?? "(real AWS)"}`);
});
