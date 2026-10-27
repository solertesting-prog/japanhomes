#!/usr/bin/env bash
# Rolls one release out to ECS: migration task first, then API and web.
# Required env: CLUSTER, ENV_NAME (e.g. jpt-staging), API_IMAGE, MIGRATE_IMAGE,
#               WEB_IMAGE, TASK_SUBNETS (comma-separated), API_SG
set -euo pipefail

# Registers a new revision of <family> with <image> and prints its ARN.
new_revision() {
  local family="$1" image="$2"
  aws ecs describe-task-definition --task-definition "$family" --query taskDefinition --output json |
    jq --arg img "$image" '.containerDefinitions[0].image = $img
      | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' > /tmp/td.json
  aws ecs register-task-definition --cli-input-json file:///tmp/td.json --query taskDefinition.taskDefinitionArn --output text
}

echo "== migration"
MIGRATE_TD=$(new_revision "${ENV_NAME}-migrate" "$MIGRATE_IMAGE")
TASK=$(aws ecs run-task --cluster "$CLUSTER" --launch-type FARGATE --task-definition "$MIGRATE_TD" \
  --network-configuration "awsvpcConfiguration={subnets=[${TASK_SUBNETS}],securityGroups=[${API_SG}],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' --output text)
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK"
CODE=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK" --query 'tasks[0].containers[0].exitCode' --output text)
if [ "$CODE" != "0" ]; then
  echo "Migration failed (exit $CODE); services were not updated. Logs: /${ENV_NAME}/migrate"
  exit 1
fi

echo "== api"
API_TD=$(new_revision "${ENV_NAME}-api" "$API_IMAGE")
aws ecs update-service --cluster "$CLUSTER" --service api --task-definition "$API_TD" >/dev/null
aws ecs wait services-stable --cluster "$CLUSTER" --services api

echo "== web"
WEB_TD=$(new_revision "${ENV_NAME}-web" "$WEB_IMAGE")
aws ecs update-service --cluster "$CLUSTER" --service web --task-definition "$WEB_TD" >/dev/null
aws ecs wait services-stable --cluster "$CLUSTER" --services web

echo "Release complete: $API_IMAGE"
