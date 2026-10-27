output "alb_dns_name" {
  description = "Point the domain (or the Cloudflare origin) here."
  value       = aws_lb.this.dns_name
}

output "ecr_repositories" {
  value = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}

output "cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "migrate_task_definition" {
  value = aws_ecs_task_definition.migrate.family
}

output "task_subnets" {
  value = aws_subnet.app[*].id
}

output "api_security_group" {
  description = "Security group for one-off tasks that need the database (migrations)."
  value       = aws_security_group.api.id
}

output "app_secret_arn" {
  description = "Put the application secrets here before the first deploy."
  value       = aws_secretsmanager_secret.app.arn
}

output "documents_bucket" {
  value = aws_s3_bucket.documents.bucket
}

output "web_api_url" {
  description = "Build the web image with --build-arg API_URL=<this>."
  value       = local.api_url
}
