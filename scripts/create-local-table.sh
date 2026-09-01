#!/usr/bin/env bash
# Creates the Linky single table in DynamoDB Local. Idempotent.
set -euo pipefail

ENDPOINT="${LINKY_DDB_ENDPOINT:-http://localhost:8000}"
TABLE="${LINKY_TABLE_NAME:-linky-local}"

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-fakeMyKeyId}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-fakeSecretAccessKey}"
export AWS_REGION="${AWS_REGION:-us-east-1}"

if aws dynamodb describe-table \
     --endpoint-url "$ENDPOINT" \
     --table-name "$TABLE" >/dev/null 2>&1; then
  echo "Table $TABLE already exists at $ENDPOINT"
  exit 0
fi

aws dynamodb create-table \
  --endpoint-url "$ENDPOINT" \
  --table-name "$TABLE" \
  --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
  --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager

echo "Created table $TABLE at $ENDPOINT"
