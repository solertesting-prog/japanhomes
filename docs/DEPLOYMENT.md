# Despliegue en AWS

Estado: **infraestructura escrita y validada en CI** (`terraform validate`, Checkov sin fallos, imágenes construidas y probadas en modo producción). **Todavía no se ha aplicado contra una cuenta AWS real**; el primer `terraform apply` y el primer despliegue los haremos juntos.

## Arquitectura

```
Internet → (Cloudflare, opcional) → ALB :443 + WAF → web (ECS Fargate, subred app)
                                                       │ /api/* proxy
                                                       ▼
                                          api.jpt-<env>.internal:4000 (ECS Fargate)
                                                       │ TLS
                                                       ▼
                                       RDS PostgreSQL 16 (subred de datos, sin salida a Internet)
```

| Pieza | Detalle |
|---|---|
| Red | VPC con 3 capas por zona: pública (ALB, NAT), app (tareas), datos (RDS, sin ruta a Internet). Flow logs cifrados. Grupo de seguridad por defecto bloqueado. |
| Entrada | ALB solo TLS 1.2/1.3, 80 → 301 a 443, cabeceras inválidas descartadas, logs de acceso en S3. WAF con reglas gestionadas de AWS y límite por IP. |
| Cómputo | ECS Fargate: `web`, `api` y una tarea puntual `migrate`. Despliegues con *circuit breaker* y vuelta atrás automática; autoescalado por CPU. La API no tiene puerto público. |
| Datos | RDS PostgreSQL 16 cifrado con KMS, SSL obligatorio, copias 7 días (staging) / 35 días + Multi-AZ + protección contra borrado (producción), Performance Insights, logs a CloudWatch. |
| Secretos | Contraseña de la BD generada y rotada por RDS en Secrets Manager (nunca pasa por Terraform). Secretos de la aplicación en otro secreto que rellena un operador. Inyectados en las tareas por ECS. |
| Ficheros | Bucket de documentos privado, versionado, SSE-KMS, solo TLS; se sirve con URLs prefirmadas. |
| Imágenes | ECR con etiquetas inmutables, escaneo al subir y cifrado KMS. |
| Observabilidad | Logs de aplicación, WAF y VPC con retención de 1 año; alarmas (5xx, destinos no sanos, CPU de API y BD, almacenamiento, bloqueos del WAF) a un tema SNS por email. |
| Despliegue | GitHub Actions con OIDC (sin claves AWS guardadas), limitado al *environment* protegido de GitHub. |

## Primer despliegue (staging, región Tokio)

1. **Bucket del estado de Terraform** (una vez): bucket S3 versionado y cifrado, p. ej. `jpt-terraform-state-<cuenta>`.
2. **Certificado**: solicita en ACM (misma región) el certificado de `staging.tu-dominio` y valídalo por DNS.
3. **Variables**: en `infra/terraform/envs/staging` copia `terraform.tfvars.example` → `terraform.tfvars` y `backend.hcl.example` → `backend.hcl`, y rellénalos.
4. **Infraestructura**:
   ```sh
   terraform init -backend-config=backend.hcl
   terraform plan -out plan.tfplan     # revisar
   terraform apply plan.tfplan
   ```
5. **Secretos de la aplicación** (una vez; valores aleatorios nuevos, nunca los de desarrollo):
   ```sh
   aws secretsmanager put-secret-value --secret-id jpt-staging/app --secret-string \
     "{\"IP_HASH_SECRET\":\"$(openssl rand -hex 32)\",\"PII_ENCRYPTION_KEY\":\"$(openssl rand -hex 32)\",\"KYC_WEBHOOK_SECRET\":\"$(openssl rand -hex 32)\",\"PAYMENT_WEBHOOK_SECRET\":\"$(openssl rand -hex 32)\"}"
   ```
   Guarda `PII_ENCRYPTION_KEY` también fuera de AWS (gestor de contraseñas de la empresa): sin ella los datos personales cifrados no se pueden leer.
6. **GitHub**: crea el *environment* `staging` (con revisores obligatorios) y sus variables, tomadas de `terraform output platform`:
   `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `ENV_NAME=jpt-staging`, `ECR_REGISTRY=<cuenta>.dkr.ecr.ap-northeast-1.amazonaws.com`, `SITE_URL=https://staging.tu-dominio`, `WEB_API_URL` (salida `web_api_url`), `TASK_SUBNETS` (separadas por comas), `API_SG`.
7. **Desplegar**: Actions → *Deploy* → *Run workflow*. Construye las imágenes, ejecuta las migraciones y solo si terminan bien actualiza API y web; al final comprueba la web y la API.
8. **DNS**: apunta `staging.tu-dominio` al `alb_dns_name` (o al origen en Cloudflare, y entonces limita `allowed_ingress_cidrs` a los rangos IP publicados por Cloudflare).

## Operación

- **Migraciones**: siempre en la tarea `migrate` antes de cambiar los servicios. Las migraciones deben ser compatibles hacia atrás (la versión anterior sigue sirviendo durante el despliegue).
- **Vuelta atrás**: relanza *Deploy* desde el commit anterior o vuelve a la revisión anterior de la definición de tarea; ECS además revierte solo si las tareas nuevas no arrancan.
- **Datos DEMO**: el seed se niega a ejecutarse con `NODE_ENV=production`. En staging solo si se decide mostrar la demo (`JPT_ALLOW_DEMO_SEED=true`, de forma puntual).
- **Rotación de secretos**:
  - Contraseña de la BD: la rota RDS.
  - Secretos de webhooks: cambiar a la vez en el proveedor y en el secreto, y reiniciar la API.
  - `PII_ENCRYPTION_KEY`: requiere recifrar los datos con una nueva versión de clave (el formato ya lleva byte de versión); procedimiento a escribir antes de producción.
  - `IP_HASH_SECRET`: rotable sin migración (solo cambia la correlación de IPs en logs nuevos).

## Coste orientativo de staging

Del orden de **150–250 USD/mes** en `ap-northeast-1`: NAT gateway, ALB, RDS `db.t4g.small`, 2 tareas Fargate pequeñas, WAF y logs. Es una estimación a confirmar con la calculadora de AWS; producción (Multi-AZ, 3 NAT, más tareas) cuesta varias veces más.

## Pendiente antes de producción

- Redis/ElastiCache cuando lleguen las colas (BullMQ) de la Fase 5.
- Copias de la BD en otra región y prueba de restauración documentada.
- Pentest externo y revisión de la configuración de WAF con tráfico real.
- Auditoría de los contratos y decisión sobre custodio antes de cualquier red con valor real.
