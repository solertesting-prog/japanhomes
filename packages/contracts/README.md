# @jpt/contracts — tokens permisionados (modelo ERC-3643)

Contratos de la Fase 4. **Solo testnet.** Ningún despliegue con valor real sin socio licenciado, aprobación legal y auditoría independiente.

| Contrato | Papel ERC-3643 | Qué hace |
|---|---|---|
| `IdentityRegistry` | Identity Registry | Cartera → inversor verificado (`investorId` opaco, país ISO numérico, caducidad del KYC). Sin datos personales on-chain. Varias carteras por inversor. |
| `Compliance` | Modular Compliance | Reglas por oferta: transferencias secundarias **apagadas por defecto**, lock-up, países permitidos, máximo de tenedores y máximo por inversor. Lleva la contabilidad por inversor. |
| `PropertyToken` | Token | ERC-20 con 0 decimales y `maxSupply` = `totalTokens` de la oferta. Emisión, `batchMint`, reembolso (`burn`), congelación total/parcial, pausa, `forcedTransfer` y `recoveryAddress` del agente. |

Simplificación frente a T-REX: el agente KYC escribe la atestación en el registro en lugar de usar ONCHAINID con claims. **[VALIDAR]** con el socio/abogado (ver `docs/LEGAL_MODEL.md`).

Las rentas **no** pasan por el contrato: se pagan fuera de la cadena a partir de una foto de tenedores (`recordDate` de la distribución en la base de datos).

## Uso

```sh
sh scripts/deps.sh          # OpenZeppelin v5.4.0 y forge-std v1.11.0 en lib/
forge build --sizes
forge test -vv              # unitarios, fuzz e invariantes
```

Sin Foundry instalado (Windows), con Docker:

```sh
docker run --rm -v "$PWD:/work" -w /work ghcr.io/foundry-rs/foundry:stable "sh scripts/deps.sh && forge test -vv"
```

Despliegue en testnet: ver la cabecera de `script/DeployOffering.s.sol` (se niega a ejecutarse en Ethereum o Base mainnet).

## Pendiente

- Worker de asignación (API → `batchMint` vía custodio) e indexador de eventos para conciliar con la base de datos.
- Slither y revisión de seguridad externa.
