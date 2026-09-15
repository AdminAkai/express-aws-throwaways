#!/usr/bin/env bash
# Tears down the stack so nothing keeps billing after you're done poking at it.
#
# Usage: ./infra/destroy.sh [env-name]
set -euo pipefail

ENVIRONMENT_NAME="${1:-dev}"
STACK_NAME="cart-service-${ENVIRONMENT_NAME}"

echo "==> Deleting stack ${STACK_NAME}"
aws cloudformation delete-stack --stack-name "$STACK_NAME"

echo "==> Waiting for deletion to finish (this can take a minute or two)"
aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME"

echo "==> Stack ${STACK_NAME} deleted."
echo "    Note: the Lambda zip uploaded to your LAMBDA_CODE_BUCKET is NOT deleted by this script -"
echo "    it's cheap to leave (a few KB), but delete it manually if you want a clean slate:"
echo "      aws s3 rm s3://\$LAMBDA_CODE_BUCKET/shopping-cart-service/${ENVIRONMENT_NAME}/lambda.zip"
