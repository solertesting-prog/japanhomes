# Seguridad

Estado por control: ✅ implementado en el código actual · 🟡 diseñado, se implementa en la fase indicada.

## Aplicación
| Control | Estado |
|---|---|
| Validación estricta de entrada con Zod compartido (API devuelve 400 con detalle por campo) | ✅ |
| Envelope de errores sin trazas ni mensajes de BD; `requestId` en cada respuesta y log | ✅ |
| Helmet, `x-powered-by` desactivado, límite de cuerpo 100 KB | ✅ |
| CORS con lista exacta de orígenes | ✅ |
| Rate limiting global (`@nestjs/throttler`); Redis como almacén en Fase 3 | ✅ / 🟡 |
| Cabeceras web: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy | ✅ (CSP con nonces en Fase 7) |
| Logs JSON con redacción de `authorization`, `cookie`, `set-cookie` | ✅ |
| Consultas solo vía Prisma (parametrizadas); sin SQL dinámico | ✅ |
| Arranque bloqueado si un módulo regulado se activa sin referencia de aprobación | ✅ |
| Sesiones opacas `HttpOnly; Secure; SameSite=Lax`, Argon2id, TOTP, bloqueo por intentos, CSRF double-submit | 🟡 Fase 3 |
| RBAC por permiso y por recurso en backend; el frontend solo oculta | 🟡 Fase 3 (roles y permisos ya sembrados) |
| Documentos privados en S3 con URLs firmadas de corta vida según nivel de acceso | 🟡 Fase 3 |
| Webhooks: firma HMAC verificada, ventana temporal, deduplicación `(provider, eventId)` | 🟡 Fase 3 (esquema listo) |

## Datos
| Control | Estado |
|---|---|
| Dinero en enteros; ningún float | ✅ |
| PII cifrada en aplicación (AES-256-GCM, claves en KMS, `piiKeyVersion` para rotación) | 🟡 columnas `*Enc` listas |
| IPs guardadas como hash con clave, nunca en claro | 🟡 columnas listas |
| Audit log append-only (triggers) y encadenado por hash | ✅ BD / 🟡 escritor en API |
| Ledger de partida doble balanceado e inmutable | ✅ BD |
| Backups RDS automáticos + PITR, copia cifrada en otra región, prueba de restauración trimestral | 🟡 Fase 7 |

## Blockchain y custodia
- Nunca se almacenan claves privadas en la plataforma. Wallets custodiadas → custodio regulado (referencia en `wallets.custodyReference`); autocustodia → prueba de control por firma.
- Roles administrativos de contratos en Safe multisig; acciones críticas (pausa, congelado, transferencia forzosa) solo vía multisig y con registro de auditoría.
- Contratos no actualizables salvo justificación; Slither + tests Foundry en CI; **auditoría independiente obligatoria antes de cualquier despliegue con valor real**.

## Divulgación de vulnerabilidades
Contacto de seguridad y política de divulgación responsable: pendiente de definir antes de abrir el registro de usuarios.
