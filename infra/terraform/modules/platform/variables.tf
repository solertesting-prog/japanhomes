variable "name" {
  description = "Prefix for every resource, e.g. jpt-staging."
  type        = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,24}$", var.name))
    error_message = "Use 3-25 lower-case letters, digits or dashes."
  }
}

variable "environment" {
  description = "staging or production. Production enables Multi-AZ, deletion protection and longer retention."
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "az_count" {
  description = "Availability zones used (2 or 3)."
  type        = number
  default     = 2
}

variable "domain_name" {
  description = "Public host name served by the load balancer, e.g. staging.example.jp."
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate for domain_name in the same region."
  type        = string
}

variable "allowed_ingress_cidrs" {
  description = "Who may reach the load balancer. With Cloudflare in front, set its published IP ranges."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "api_image" {
  description = "Full image reference for the API (ECR URL:tag)."
  type        = string
}

variable "migrate_image" {
  description = "Full image reference for the migration task."
  type        = string
}

variable "web_image" {
  description = "Full image reference for the web app (built with API_URL=http://api.<name>.internal:4000)."
  type        = string
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "web_cpu" {
  type    = number
  default = 512
}

variable "web_memory" {
  type    = number
  default = 1024
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "web_desired_count" {
  type    = number
  default = 2
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 50
}

variable "alarm_email" {
  description = "Receives CloudWatch alarms (confirm the SNS subscription email)."
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch retention. One year minimum: audit and incident investigation."
  type        = number
  default     = 365
  validation {
    condition     = var.log_retention_days >= 365
    error_message = "Keep logs at least 365 days."
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "github_repository" {
  description = "owner/repo allowed to deploy through GitHub Actions OIDC (null to skip)."
  type        = string
  default     = null
}

variable "github_oidc_provider_arn" {
  description = "Existing GitHub OIDC provider ARN in the account (one per account); null creates it."
  type        = string
  default     = null
}
