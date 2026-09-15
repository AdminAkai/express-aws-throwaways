#!/usr/bin/env bash
# Creates the CartItems table against DynamoDB Local (see `npm run local:db:up`).
# Mirrors the key schema defined in infra/template.yaml so local dev matches prod.
set -euo pipefail

TABLE_NAME="${CART_TABLE_NAME:-CartItems-dev}"
ENDPOINT="${DYNAMODB_ENDPOINT:-http://localhost:8000}"

aws dynamodb create-table \
  --endpoint-url "$ENDPOINT" \
  --region us-east-1 \
  --table-name "$TABLE_NAME" \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  2>&1 | grep -v "ResourceInUseException" || true

echo "Table '$TABLE_NAME' ready at $ENDPOINT"
