variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "domain_name" {
  type = string
}

variable "certificate_arn" {
  type = string
}

variable "allowed_ingress_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

variable "alarm_email" {
  type = string
}

variable "github_repository" {
  type    = string
  default = null
}

# First apply: any placeholder image; releases replace the task definitions.
variable "api_image" {
  type = string
}

variable "migrate_image" {
  type = string
}

variable "web_image" {
  type = string
}
