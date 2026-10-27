resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = aws_subnet.data[*].id
  tags       = local.tags
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name}-pg16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }
  parameter {
    name  = "log_connections"
    value = "1"
  }
  tags = local.tags
}

resource "aws_iam_role" "rds_monitoring" {
  name = "${var.name}-rds-monitoring"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "monitoring.rds.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# The master password is generated and rotated by RDS in Secrets Manager
# (manage_master_user_password); it never appears in Terraform state.
resource "aws_db_instance" "this" {
  identifier                            = var.name
  engine                                = "postgres"
  engine_version                        = "16"
  instance_class                        = var.db_instance_class
  allocated_storage                     = var.db_allocated_storage_gb
  max_allocated_storage                 = var.db_allocated_storage_gb * 4
  storage_type                          = "gp3"
  storage_encrypted                     = true
  kms_key_id                            = aws_kms_key.main.arn
  db_name                               = "jpt"
  username                              = "jpt_admin"
  manage_master_user_password           = true
  master_user_secret_kms_key_id         = aws_kms_key.main.arn
  db_subnet_group_name                  = aws_db_subnet_group.this.name
  vpc_security_group_ids                = [aws_security_group.db.id]
  parameter_group_name                  = aws_db_parameter_group.this.name
  publicly_accessible                   = false
  multi_az                              = local.production
  backup_retention_period               = local.production ? 35 : 7
  backup_window                         = "17:00-18:00"
  maintenance_window                    = "sun:18:30-sun:19:30"
  copy_tags_to_snapshot                 = true
  deletion_protection                   = local.production
  skip_final_snapshot                   = !local.production
  final_snapshot_identifier             = local.production ? "${var.name}-final" : null
  auto_minor_version_upgrade            = true
  performance_insights_enabled          = true
  performance_insights_kms_key_id       = aws_kms_key.main.arn
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]
  iam_database_authentication_enabled   = true
  tags                                  = local.tags
}

# Application secrets. Terraform creates the container only; the values are put
# once by an operator (see docs/DEPLOYMENT.md) so they never enter state:
#   {"IP_HASH_SECRET": "...", "PII_ENCRYPTION_KEY": "...", "KYC_WEBHOOK_SECRET": "...", "PAYMENT_WEBHOOK_SECRET": "..."}
resource "aws_secretsmanager_secret" "app" {
  #checkov:skip=CKV2_AWS_57:Rotating these needs coordinated steps (re-encrypting PII under a new key version, changing webhook secrets with each provider); runbook in docs/DEPLOYMENT.md.
  name                    = "${var.name}/app"
  description             = "Japan Property Token API secrets"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = local.production ? 30 : 7
  tags                    = local.tags
}
