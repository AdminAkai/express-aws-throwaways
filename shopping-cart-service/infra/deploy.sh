#!/usr/bin/env bash
# Builds the Lambda bundle, uploads it to S3, and deploys/updates the stack.
#
# Usage:
#   LAMBDA_CODE_BUCKET=my-deploy-artifacts-bucket ./infra/deploy.sh [env-name]
#
# Prereqs:
#   - AWS CLI configured (`aws configure` or env vars/SSO)
#   - An S3 bucket that already exists in the target account/region to hold
#     the deployment package (create one with: aws s3 mb s3://<bucket-name>)
set -euo pipefail

ENVIRONMENT_NAME="${1:-dev}"
STACK_NAME="cart-service-${ENVIRONMENT_NAME}"
BUCKET="${LAMBDA_CODE_BUCKET:?Set LAMBDA_CODE_BUCKET to an existing S3 bucket for deployment artifacts}"
KEY="shopping-cart-service/${ENVIRONMENT_NAME}/lambda.zip"

cd "$(dirname "$0")/.."

echo "==> Building Lambda bundle"
npm run build:lambda
(cd build && rm -f lambda.zip && zip -q -r lambda.zip lambda.js)

echo "==> Uploading to s3://${BUCKET}/${KEY}"
aws s3 cp build/lambda.zip "s3://${BUCKET}/${KEY}"

echo "==> Deploying stack ${STACK_NAME}"
aws cloudformation deploy \
  --template-file infra/template.yaml \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      EnvironmentName="$ENVIRONMENT_NAME" \
      LambdaCodeS3Bucket="$BUCKET" \
      LambdaCodeS3Key="$KEY"

echo "==> Stack outputs"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs" \
  --output table
