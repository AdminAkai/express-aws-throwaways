# shopping-cart-service

Throwaway project #1 in an ecommerce microservices series: a shopping cart
API. TypeScript + Express, running as a single Lambda behind an API Gateway
HTTP API, backed by DynamoDB. Deployed with a hand-written CloudFormation
template (no SAM) so every piece of the Lambda/API Gateway/DynamoDB wiring
is visible.

## What this is practicing

- **API Gateway (HTTP API) -> Lambda proxy integration**: one Lambda, one
  `ANY /{proxy+}` route. Express (via `serverless-http`) owns the actual
  routing - API Gateway's job here is just TLS, the public endpoint, and
  invoking the function.
- **DynamoDB single-table-style design**: one table, generic `pk`/`sk`,
  even though this service only has one entity today. `pk = USER#<id>`,
  `sk = ITEM#<productId>`, queried with `Query` on `pk` to fetch a whole
  cart in one request. Atomic `ADD` for quantity increments so concurrent
  "add to cart" clicks don't clobber each other.
- **CloudFormation from scratch**: `AWS::Lambda::Function`,
  `AWS::IAM::Role` (least-privilege - only the 5 DynamoDB actions this
  service needs, scoped to one table ARN), `AWS::ApiGatewayV2::*`,
  `AWS::Lambda::Permission` (the piece people usually forget - without it
  API Gateway can't invoke the function), `AWS::DynamoDB::Table`.

Next projects in the series are expected to add an **order service** and
an **inventory/catalog service**, with **EventBridge** connecting them
(e.g. this cart service could eventually publish a `CartCheckedOut` event
that the order service consumes) - deliberately left out of round one to
keep the core Lambda/API Gateway/DynamoDB loop clean first.

## API

| Method | Path                          | Body                                                          | Notes                                  |
|--------|-------------------------------|-----------------------------------------------------------------|-----------------------------------------|
| GET    | `/health`                     | -                                                                 | liveness check                          |
| GET    | `/carts/:userId`               | -                                                                 | full cart + computed totals             |
| POST   | `/carts/:userId/items`         | `{productId, productName, unitPriceCents, quantity}`             | adds item, or increments if already present |
| PATCH  | `/carts/:userId/items/:productId` | `{quantity}`                                                   | sets exact quantity; `0` removes the item |
| DELETE | `/carts/:userId/items/:productId` | -                                                                | removes one line item                   |
| DELETE | `/carts/:userId`               | -                                                                 | empties the whole cart                  |

### Example requests

```bash
BASE=http://localhost:3000   # or the ApiEndpoint stack output once deployed

curl -X POST "$BASE/carts/user-1/items" \
  -H 'content-type: application/json' \
  -d '{"productId":"sku-123","productName":"Enamel Pin","unitPriceCents":1200,"quantity":2}'

curl "$BASE/carts/user-1"

curl -X PATCH "$BASE/carts/user-1/items/sku-123" \
  -H 'content-type: application/json' \
  -d '{"quantity":5}'

curl -X DELETE "$BASE/carts/user-1/items/sku-123"

curl -X DELETE "$BASE/carts/user-1"
```

## Local development

```bash
npm install
cp .env.example .env

# DynamoDB Local in Docker, so you can iterate without touching real AWS
npm run local:db:up
npm run local:db:create-table

npm run dev   # ts-node-dev, restarts on save, http://localhost:3000
```

Run the (DynamoDB-free) unit tests any time with `npm test`.

When you're done with the local loop: `npm run local:db:down`.

## Deploying to AWS

You need an S3 bucket to hold the Lambda zip (CloudFormation can't inline a
few-hundred-KB Node bundle directly into a template). Create one once per
account/region if you don't already have a scratch deploy bucket:

```bash
aws s3 mb s3://<your-name>-cfn-deploy-artifacts
```

Then:

```bash
LAMBDA_CODE_BUCKET=<your-name>-cfn-deploy-artifacts npm run deploy
# equivalent to: LAMBDA_CODE_BUCKET=... ./infra/deploy.sh dev
```

This bundles `src/lambda.ts` with esbuild, zips it, uploads it to S3, and
runs `aws cloudformation deploy`. It prints the stack outputs when done,
including `ApiEndpoint` - hit that instead of localhost:

```bash
curl https://<api-id>.execute-api.<region>.amazonaws.com/carts/user-1
```

Deploying again (after a code change) re-runs the same command - it's a
normal CloudFormation stack update.

### Tearing it down

This is a throwaway project - don't leave it running up DynamoDB/Lambda
charges (both are pay-per-use and cheap at low volume, but still):

```bash
npm run destroy
# equivalent to: ./infra/destroy.sh dev
```

That deletes the whole stack (table, function, API, role, log group). The
tiny Lambda zip left in your S3 bucket is not deleted automatically - the
script prints the command to remove it if you want a completely clean
slate.

## Project layout

```
src/
  app.ts              Express app factory (routes + middleware wiring)
  server.ts            local dev entrypoint (app.listen)
  lambda.ts            Lambda entrypoint (same app, via serverless-http)
  routes/cartRoutes.ts  route handlers + request validation
  db/                   DynamoDB client + repository (all the AWS SDK calls live here)
  middleware/            error -> HTTP status mapping
infra/
  template.yaml         CloudFormation template
  deploy.sh / destroy.sh
scripts/
  build-lambda.mjs       esbuild bundling for the Lambda zip
  create-local-table.sh  creates the table against DynamoDB Local
```

## Known simplifications (it's a throwaway project, not production)

- No auth - `userId` is just a path parameter, not verified against
  anything. A real service would derive it from a JWT/Cognito claim.
- No product/price validation against a real catalog - the caller supplies
  `unitPriceCents` directly. A real cart service would look prices up from
  an inventory/catalog service rather than trusting the client.
- `clearCart` deletes items one at a time rather than batching - fine at
  cart-sized item counts, would want `BatchWriteItem`/`TransactWriteItems`
  at larger scale.
