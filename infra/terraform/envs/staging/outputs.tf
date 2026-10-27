output "platform" {
  value = {
    alb_dns_name            = module.platform.alb_dns_name
    ecr_repositories        = module.platform.ecr_repositories
    cluster_name            = module.platform.cluster_name
    migrate_task_definition = module.platform.migrate_task_definition
    task_subnets            = module.platform.task_subnets
    api_security_group      = module.platform.api_security_group
    app_secret_arn          = module.platform.app_secret_arn
    documents_bucket        = module.platform.documents_bucket
    web_api_url             = module.platform.web_api_url
    deploy_role_arn         = module.platform.deploy_role_arn
  }
}
