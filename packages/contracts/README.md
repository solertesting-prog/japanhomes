# @jpt/contracts — Fase 4 (pendiente)

Este paquete aún no contiene contratos. Diseño acordado (ver `docs/ARCHITECTURE.md` §4):

- **Estándar:** ERC-3643 (T-REX): token permisionado + Identity Registry + Modular Compliance.
- **Toolchain:** Foundry (forge test / fuzz / invariant), OpenZeppelin 5, Slither en CI.
- **Módulos de compliance previstos:** solo inversores en registro de identidad, límite de tenedores, bloqueo temporal (lock-up), países permitidos, pausa global.
- **Administración:** roles `AGENT` y `OWNER` en Safe multisig; `forcedTransfer` y `recoveryAddress` para alinear el token con el registro legal off-chain.
- **Distribuciones:** el contrato **no** recibe rentas. Se usan snapshots (`ERC20Votes`-style checkpoints o bloque de registro indexado) y los pagos van por proveedor autorizado off-chain.
- **Red:** Base Sepolia para testnet; producción según el socio licenciado.
- **Prohibido** desplegar con valor real sin auditoría independiente.
