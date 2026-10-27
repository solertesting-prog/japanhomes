data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

data "aws_partition" "current" {}

locals {
  production = var.environment == "production"
  azs        = slice(data.aws_availability_zones.available.names, 0, var.az_count)
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region
  namespace  = "${var.name}.internal"
  api_url    = "http://api.${local.namespace}:4000"
  site_url   = "https://${var.domain_name}"
  tags       = merge({ Project = "japan-property-token", Environment = var.environment, ManagedBy = "terraform" }, var.tags)
}
