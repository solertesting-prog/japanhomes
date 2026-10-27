# Modelo legal conceptual — Japón

> **Esto no es asesoramiento jurídico ni fiscal.** Es el marco con el que está diseñado el software para que un abogado japonés especializado (金融商品取引法 / 不動産特定共同事業法) y un asesor fiscal puedan validarlo o corregirlo. Ninguna estructura de este documento está aprobada. Cada punto marcado **[VALIDAR]** necesita opinión profesional antes de activar el módulo correspondiente.

## 1. Principio rector: el token no es la escritura

Comprar un token **no** convierte al inversor en titular registral (登記) del inmueble. El software modela siete capas separadas y nunca las mezcla:

| Capa | Qué es | Dónde vive en el sistema |
|---|---|---|
| Inmueble | El edificio y el suelo | `properties` |
| Titular registral | Quien figura en el registro: un banco fiduciario (信託銀行) o una SPV | `property_ownerships` (`TRUSTEE_TITLE` / `LEGAL_TITLE`) + `legal_entities` |
| Vehículo | Fideicomiso, contrato TK o contrato 不特法 que canaliza la renta | `token_offerings.legalStructure`, `legal_entities` (`ISSUER_SPV`) |
| Derecho económico del inversor | Participación proporcional en renta distribuible y en el producto de venta | `token_offerings.economicRights`, `investments` |
| Registro de titulares | El libro legal de beneficiarios / socios TK (受益者名簿 / 匿名組合員名簿) | `investments` (fuente de verdad off-chain) |
| Representación digital | El token ERC-3643 que refleja ese registro | `token_contracts`, `token_allocations`, `wallets` |
| Contratos | Contrato de inversión, términos de emisión, divulgación de riesgos | `property_documents` + `order_document_acceptances` (hash SHA-256 de lo aceptado) |

Decisión de diseño: **el registro legal manda; la blockchain lo refleja**. Si ambos divergen (error de minteo, wallet perdida), se corrige el token conforme al registro mediante acciones administrativas autorizadas (`forcedTransfer`, `recoveryAddress` de ERC-3643) con multisig y rastro de auditoría. **[VALIDAR]** que el contrato de inversión reconozca esta jerarquía.

## 2. Contexto normativo verificado (octubre 2026)

- Los tokens que dan derecho a beneficios se regulan bajo la **Ley de Instrumentos Financieros y Bolsa (FIEA)** como *derechos transferibles registrados electrónicamente* (電子記録移転権利), no como criptoactivos de la Payment Services Act. Quien ofrece, coloca o intermedia estos tokens debe estar registrado como Financial Instruments Business Operator. ([Guía del Gobierno Metropolitano de Tokio](https://www.sp.metro.tokyo.lg.jp/startupandglobalfinancialcity/book/guidebook-digital/pageindices/index53.html))
- Desde el **1 de noviembre de 2024**, las participaciones de 不動産特定共同事業 tokenizadas (不特ST) quedan, en principio, bajo la FIEA como participaciones de esquemas de inversión colectiva, normalmente como 電子記録移転権利. Los operadores 不特法 que las comercializan necesitan además el registro FIEA correspondiente. ([MLIT, PDF](https://www.mlit.go.jp/totikensangyo/const/content/001841322.pdf))
- En el ejercicio fiscal 2025 la gran mayoría de los security tokens inmobiliarios japoneses (≈85 %, unos ¥140.800 millones) fueron **derechos de beneficiario de fideicomiso**; los TK fueron marginales (≈¥1.400 millones). El mercado secundario START de Osaka Digital Exchange tenía ocho tokens negociándose a marzo de 2026. ([Nomura, abril 2026](https://www.nomuraholdings.com/en/news/nr/bstr20260402.html))
- Ejemplo real de estructura fiduciaria: emisión sobre un inmueble en Ichigaya con banco fiduciario como emisor y custodio de claves, SPV como beneficiaria, una sociedad de valores como colocadora, unidades de ¥100.000 y solicitud prevista a START. ([Tosei, 2024](https://www.toseicorp.co.jp/english/news/2024/20240524_1353.html))

Conclusión práctica: **en Japón no se "lanza un token"; se coloca un valor a través de entidades con licencia**. El software debe poder funcionar como plataforma tecnológica detrás de esas entidades.

## 3. Estructuras evaluadas

### A. Derecho de beneficiario de fideicomiso tokenizado (信託受益権) — *recomendada para edificios*
- Banco fiduciario ostenta el título registral; la SPV o el originador es beneficiario inicial; los inversores adquieren derechos de beneficiario tokenizados.
- Pros: estructura dominante en el mercado, custodia y registro por entidad regulada, camino a START.
- Contras: requiere banco fiduciario y sociedad de valores (Type I) dispuestos; tamaño mínimo de operación alto; costes fijos.
- Encaje en el software: `TRUST_BENEFICIARY_INTEREST`; `property_ownerships` registra al fiduciario (`TRUSTEE_TITLE`) y a la SPV (`TRUST_BENEFICIARY`).

### B. GK–TK (合同会社 + 匿名組合)
- Una SPV (GK) tiene el inmueble —habitualmente vía fideicomiso para no caer en 不特法— y los inversores son socios TK con derecho a beneficios.
- Pros: flexible, habitual en real estate privado, apta para tickets pequeños.
- Contras: la participación TK tokenizada es 電子記録移転権利 → colocación por intermediario registrado; si la GK tiene el inmueble directamente puede activarse 不特法. **[VALIDAR]**
- Retención fiscal sobre distribuciones TK (tipo general del 20,42 % para residentes y no residentes, salvo convenio). **[VALIDAR con asesor fiscal]**

### C. 不動産特定共同事業 (不特法)
- Un operador con licencia MLIT/prefectural administra el inmueble para varios inversores. Pensado para activos pequeños y akiya.
- Desde 11/2024, la versión tokenizada exige también cumplimiento FIEA.
- Encaje: `TOKUTEI_KYODO_JIGYO`; la entidad `TOKUTEI_KYODO_OPERATOR` debe constar con su licencia en `legal_entities.licenses`.

### D. TMK (特定目的会社) con participaciones preferentes
- Más pesada (plan de liquidación de activos, registro). Útil para carteras grandes. Incluida en el modelo de datos, no en la hoja de ruta inicial.

## 4. Inversores internacionales

Este es el punto más delicado del producto.

1. **Ley japonesa.** Muchas ofertas japonesas de ST se limitan a residentes con cuenta de valores en la sociedad colocadora. **[VALIDAR]** si el intermediario elegido acepta no residentes y con qué KYC.
2. **Ley del país del inversor.** Ofrecer un valor a un residente en España/UE activa su normativa (Reglamento de Folletos, MiFID II, comercialización transfronteriza); a un residente en EE. UU., la Securities Act (Reg S / Reg D). Japón no "pasaporta" la oferta. **[VALIDAR por jurisdicción objetivo]**
3. **Control de cambios (外為法).** Ciertas inversiones de no residentes en inmuebles japoneses llevan obligaciones de reporte. **[VALIDAR]**
4. **Fiscalidad.** Retenciones en Japón, convenios de doble imposición y tributación en el país de residencia. **[VALIDAR]**

El software lo refleja con `investor_eligibilities` (jurisdicción, categoría, reglas aplicadas, versión del reglamento) y el módulo `CROSS_BORDER_INVESTORS`, apagado por defecto. Una suscripción guarda una instantánea de elegibilidad (`subscription_orders.eligibilitySnapshot`) como prueba.

## 5. Otras obligaciones

| Ámbito | Norma | Impacto en el software |
|---|---|---|
| KYC/AML | Ley de Prevención de Transferencia de Ingresos Criminales (犯罪収益移転防止法) | `kyc_verifications`, `kyc_checks` (sanciones, PEP), revisión manual, conservación de registros |
| Datos personales | APPI, incluida la transferencia internacional | PII cifrada (`*Enc`), consentimiento `CROSS_BORDER_DATA_TRANSFER` versionado |
| Pagos | Payment Services Act | Pagos solo vía proveedor autorizado; **stablecoins bloqueadas** (`STABLECOIN_PAYMENTS`) |
| Intermediación inmobiliaria | 宅地建物取引業法 | La plataforma no intermedia compraventas de inmuebles; lo hace la SPV/originador con licencia **[VALIDAR]** |
| Publicidad | FIEA (publicidad de instrumentos financieros), normas de la Japan STO Association | Sin rentabilidades garantizadas; proyecciones etiquetadas; riesgos visibles junto a cifras |

## 6. Matriz de funcionalidades

Implementada en código en `packages/shared/src/regulatory.ts`. Un módulo regulado solo se enciende con **flag + referencia de aprobación legal**; los bloqueados no se pueden encender por configuración.

| Módulo | Nivel | Estado por defecto |
|---|---|---|
| Catálogo de propiedades DEMO | Prototipo | Activo |
| Simulador de inversión | Prototipo | Activo |
| Suscripciones simuladas (pago mock) | Prototipo | Activo |
| KYC con proveedor real | Requiere validación jurídica | Apagado |
| Inversores no residentes | Requiere validación jurídica | Apagado |
| Comercialización a inversores reales | Requiere licencia | Apagado |
| Suscripciones con dinero real | Requiere licencia | Apagado |
| Emisión de tokens en mainnet | Requiere licencia | Apagado |
| Distribución de rentas reales | Requiere licencia | Apagado |
| Pagos en stablecoins | **Bloqueado** | No activable |
| Mercado secundario | **Bloqueado** | No activable (además, `CHECK isSimulated = true` en BD) |

Barreras adicionales en base de datos:
- Una oferta no-demo no puede pasar a `COMING_SOON/OPEN/FUNDED/CLOSED` sin `legalApprovalRef`.
- Las órdenes del mercado secundario solo pueden ser simuladas.

## 7. Preguntas para el despacho japonés

1. ¿Qué estructura (A, B o C) recomiendan para tickets de ¥50.000–¥100.000 sobre activos de ¥20–250 M?
2. ¿Puede la plataforma operar como proveedor tecnológico sin registro FIEA si toda solicitud la realiza un Type I FIBO socio? ¿Qué funciones de la web (fichas, simulador, captación de leads) cruzan la línea de "solicitud"?
3. ¿Requisitos para aceptar no residentes (UE, EE. UU., LatAm)? ¿Debe limitarse a inversores profesionales/cualificados?
4. Obligaciones de 外為法 para inversores no residentes en estas estructuras.
5. ¿Es aceptable que el registro off-chain prevalezca sobre el token, y cómo redactarlo?
6. Requisitos de custodia de claves si la plataforma ofrece wallets custodiadas.
7. Régimen de retención y certificados fiscales en cada estructura.
8. Requisitos para un futuro mercado secundario: START (PTS), transferencias bilaterales aprobadas, o ninguno.
9. Contenido obligatorio del documento de emisión y de la divulgación de riesgos; idiomas exigibles.
10. Conservación de registros (KYC, órdenes, comunicaciones) y plazos.
