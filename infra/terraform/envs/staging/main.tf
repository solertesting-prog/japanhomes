terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  # Remote state (S3 with native locking). Values come from backend.hcl:
  #   terraform init -backend-config=backend.hcl
  backend "s3" {}
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { Project = "japan-property-token", Environment = "staging" }
  }
}

module "platform" {
  source = "../../modules/platform"

  name                  = "jpt-staging"
  environment           = "staging"
  domain_name           = var.domain_name
  certificate_arn       = var.certificate_arn
  allowed_ingress_cidrs = var.allowed_ingress_cidrs
  alarm_email           = var.alarm_email
  github_repository     = var.github_repository

  api_image     = var.api_image
  migrate_image = var.migrate_image
  web_image     = var.web_image

  api_desired_count = 1
  web_desired_count = 1
  db_instance_class = "db.t4g.small"
}
