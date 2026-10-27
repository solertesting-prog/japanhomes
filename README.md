# Japan Property Token

Plataforma de inversión en participaciones económicas tokenizadas sobre inmuebles japoneses.

> **Prototipo.** Todas las propiedades, cifras, entidades y documentos son **datos DEMO ficticios**. Los módulos regulados (dinero real, emisión en mainnet, distribuciones, mercado secundario) están **desactivados por diseño** hasta contar con validación jurídica en Japón. Lee [`docs/LEGAL_MODEL.md`](docs/LEGAL_MODEL.md) antes que nada.

## Qué hay hoy

| Área | Estado |
|---|---|
| Arquitectura, stack, red blockchain | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Modelo legal conceptual Japón + matriz de módulos | [`docs/LEGAL_MODEL.md`](docs/LEGAL_MODEL.md) |
| Seguridad | [`docs/SECURITY.md`](docs/SECURITY.md) |
| Dominio financiero (dinero entero, métricas, simulador, escenarios, reparto exacto) | `packages/shared` — 39 tests |
| Gates regulatorios (flag + referencia de aprobación; bloqueados no activables) | `packages/shared/src/regulatory.ts` |
| Modelo de datos: 46 tablas, enums, índices | `packages/database/prisma/schema.prisma` |
| Migraciones + invariantes SQL (sobreventa, ledger, audit log, four-eyes…) | `packages/database/prisma/migrations` — 13 tests SQL |
| Seed DEMO: 12 propiedades en 6 ciudades, roles y permisos | `packages/database/src/seed*.ts` |
| API NestJS: catálogo con filtros, ficha, simulador, estadísticas, salud, OpenAPI | `apps/api` |
| Web Next.js: home, marketplace, ficha con simulador, EN/JA/ES | `apps/web` |
| Design system (botones, badges, campos, iconos) | `packages/ui` |
| Docker, docker-compose, CI | `infra/docker`, `.github/workflows` |

Pendiente (siguientes fases): autenticación y MFA, KYC mock, suscripciones simuladas, dashboard del inversor, panel admin, distribuciones, contratos ERC-3643, despliegue AWS. Detalle en `docs/ARCHITECTURE.md` §9.

## Requisitos

- Node.js 22 y pnpm 10 (`corepack enable`)
- Docker (para PostgreSQL 16 y Redis 7)

## Puesta en marcha

```bash
cp .env.example .env            # y rellena IP_HASH_SECRET con: openssl rand -hex 32
pnpm install                    # genera pnpm-lock.yaml: haz commit de él
pnpm infra:up                   # PostgreSQL + Redis
pnpm db:generate
pnpm db:migrate                 # aplica init + invariantes
pnpm --filter @jpt/database test:invariants   # opcional: prueba las restricciones
pnpm db:seed                    # 12 propiedades DEMO
pnpm dev                        # API :4000 (OpenAPI en /docs) + web :3000
```

Solo frontend, sin base de datos:

```bash
JPT_DATA_SOURCE=demo pnpm --filter @jpt/web dev
```

Todo en contenedores: `docker compose -f infra/docker/docker-compose.yml up --build`.

## Pruebas

```bash
pnpm --filter @jpt/shared test        # dominio financiero, consultas, gates
pnpm --filter @jpt/api test           # HTTP de la API con repositorio en memoria
pnpm --filter @jpt/database test:invariants
pnpm typecheck
```

## API (v1)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/properties` | Búsqueda: `q, city, prefecture, type, funding, rental, priceMin, priceMax, minInvestmentMax, yieldMinBps, sort, page, pageSize` |
| GET | `/v1/properties/:slug` | Ficha completa |
| POST | `/v1/properties/:slug/simulate` | `{ "amount": "100000" }` → tokens, comisiones, participación y 3 escenarios |
| GET | `/v1/stats` | Cifras de plataforma calculadas de la BD |
| GET | `/v1/regulatory/modules` | Estado de cada módulo regulado |
| GET | `/health/live`, `/health/ready` | Salud |

Convenciones: dinero en JPY entero como **cadena** (`"30000000"`), tasas en puntos básicos (`512` = 5,12 %).

## Despliegue (resumen)

1. Imágenes `apps/api/Dockerfile` y `apps/web/Dockerfile` → ECR.
2. RDS PostgreSQL 16 (Multi-AZ, cifrado, PITR), ElastiCache Redis, S3 privado + KMS, Secrets Manager.
3. ECS Fargate: servicio `api` (ejecuta `prisma migrate deploy` como tarea previa) y servicio `web`.
4. Cloudflare delante (WAF, rate limit, TLS); el API solo acepta tráfico desde el balanceador.
5. `NODE_ENV=production`, `JPT_ALLOW_INDEXING=false` hasta el lanzamiento, ningún `JPT_ENABLE_*` regulado sin aprobación.

La infraestructura como código (Terraform) llega en la Fase 7.

## Requisitos legales pendientes

Ver la lista completa y las preguntas para el despacho japonés en [`docs/LEGAL_MODEL.md`](docs/LEGAL_MODEL.md) §7. Ninguna estructura está aprobada.
