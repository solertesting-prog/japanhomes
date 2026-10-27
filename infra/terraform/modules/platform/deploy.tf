# GitHub Actions deploys with short-lived credentials (OIDC), never stored keys.
resource "aws_iam_openid_connect_provider" "github" {
  count           = var.github_repository != null && var.github_oidc_provider_arn == null ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
  tags            = local.tags
}

locals {
  github_oidc_arn = var.github_repository == null ? null : coalesce(var.github_oidc_provider_arn, try(aws_iam_openid_connect_provider.github[0].arn, null))
}

resource "aws_iam_role" "deploy" {
  count = var.github_repository != null ? 1 : 0
  name  = "${var.name}-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = local.github_oidc_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        # Only the protected GitHub environment of the same name may deploy.
        StringLike = { "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:${var.environment}" }
      }
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "deploy" {
  #checkov:skip=CKV_AWS_355:ecr:GetAuthorizationToken and the ECS describe/register actions do not support resource-level permissions; mutating ECS actions are scoped to the cluster by condition.
  #checkov:skip=CKV_AWS_290:Same as above: only unrestrictable actions use "*".
  count = var.github_repository != null ? 1 : 0
  name  = "release"
  role  = aws_iam_role.deploy[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:DescribeImages"
        ]
        Resource = [for r in aws_ecr_repository.this : r.arn]
      },
      { Effect = "Allow", Action = ["kms:GenerateDataKey", "kms:Decrypt"], Resource = [aws_kms_key.main.arn] },
      {
        Effect   = "Allow"
        Action   = ["ecs:DescribeTaskDefinition", "ecs:RegisterTaskDefinition", "ecs:DescribeServices", "ecs:DescribeTasks"]
        Resource = "*"
      },
      {
        Effect    = "Allow"
        Action    = ["ecs:UpdateService", "ecs:RunTask"]
        Resource  = "*"
        Condition = { ArnEquals = { "ecs:cluster" = aws_ecs_cluster.this.arn } }
      },
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = [aws_iam_role.execution.arn, aws_iam_role.api_task.arn, aws_iam_role.web_task.arn]
      },
      { Effect = "Allow", Action = ["logs:GetLogEvents"], Resource = "${aws_cloudwatch_log_group.app["migrate"].arn}:*" }
    ]
  })
}

output "deploy_role_arn" {
  description = "Set as the AWS_DEPLOY_ROLE_ARN variable of the GitHub environment."
  value       = try(aws_iam_role.deploy[0].arn, null)
}
