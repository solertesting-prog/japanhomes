resource "aws_sns_topic" "alarms" {
  name              = "${var.name}-alarms"
  kms_master_key_id = aws_kms_key.main.arn
  tags              = local.tags
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

locals {
  alarms = {
    alb-5xx = {
      description = "Load balancer returned 5xx errors"
      namespace   = "AWS/ApplicationELB"
      metric      = "HTTPCode_ELB_5XX_Count"
      stat        = "Sum"
      threshold   = 10
      comparison  = "GreaterThanOrEqualToThreshold"
      dimensions  = { LoadBalancer = aws_lb.this.arn_suffix }
    }
    web-5xx = {
      description = "Web tasks returned 5xx errors"
      namespace   = "AWS/ApplicationELB"
      metric      = "HTTPCode_Target_5XX_Count"
      stat        = "Sum"
      threshold   = 10
      comparison  = "GreaterThanOrEqualToThreshold"
      dimensions  = { LoadBalancer = aws_lb.this.arn_suffix }
    }
    web-unhealthy = {
      description = "Unhealthy web targets"
      namespace   = "AWS/ApplicationELB"
      metric      = "UnHealthyHostCount"
      stat        = "Maximum"
      threshold   = 1
      comparison  = "GreaterThanOrEqualToThreshold"
      dimensions  = { LoadBalancer = aws_lb.this.arn_suffix, TargetGroup = aws_lb_target_group.web.arn_suffix }
    }
    api-cpu = {
      description = "API CPU above 85%"
      namespace   = "AWS/ECS"
      metric      = "CPUUtilization"
      stat        = "Average"
      threshold   = 85
      comparison  = "GreaterThanOrEqualToThreshold"
      dimensions  = { ClusterName = aws_ecs_cluster.this.name, ServiceName = aws_ecs_service.api.name }
    }
    db-cpu = {
      description = "Database CPU above 80%"
      namespace   = "AWS/RDS"
      metric      = "CPUUtilization"
      stat        = "Average"
      threshold   = 80
      comparison  = "GreaterThanOrEqualToThreshold"
      dimensions  = { DBInstanceIdentifier = aws_db_instance.this.identifier }
    }
    db-storage = {
      description = "Database free storage below 5 GiB"
      namespace   = "AWS/RDS"
      metric      = "FreeStorageSpace"
      stat        = "Minimum"
      threshold   = 5 * 1024 * 1024 * 1024
      comparison  = "LessThanOrEqualToThreshold"
      dimensions  = { DBInstanceIdentifier = aws_db_instance.this.identifier }
    }
    waf-blocked = {
      description = "WAF rate limit blocking traffic"
      namespace   = "AWS/WAFV2"
      metric      = "BlockedRequests"
      stat        = "Sum"
      threshold   = 500
      comparison  = "GreaterThanOrEqualToThreshold"
      dimensions  = { WebACL = aws_wafv2_web_acl.this.name, Rule = "rate-limit-per-ip", Region = local.region }
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "this" {
  for_each            = local.alarms
  alarm_name          = "${var.name}-${each.key}"
  alarm_description   = each.value.description
  namespace           = each.value.namespace
  metric_name         = each.value.metric
  statistic           = each.value.stat
  dimensions          = each.value.dimensions
  period              = 300
  evaluation_periods  = 1
  threshold           = each.value.threshold
  comparison_operator = each.value.comparison
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  tags                = local.tags
}
