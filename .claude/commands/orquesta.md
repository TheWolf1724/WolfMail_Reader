---
description: Repartir un encargo entre los agentes expertos — arquitecto primero si hay diseño, áreas en paralelo, integración y verificación del conjunto
---

Orquesta este encargo entre los agentes expertos: $ARGUMENTS
(si no se indicó encargo, pídemelo antes de seguir).

1. **Mapa de áreas.** Decide qué áreas toca el encargo — CUALQUIERA del
   panel, técnicas y de negocio: arquitectura, backend, frontend, datos,
   seguridad, calidad, pruebas (tester), robustez, rendimiento, devops, ia,
   diseño web/UX, marca, gestión, negocio, ideas, contabilidad, legal, rrhh,
   compras, marketing, redacción, documentación, y de nicho móvil / i18n /
   análisis-BI solo si el proyecto va de eso (lista completa en CLAUDE.md y
   `.claude/agents/`) — y qué dependencias reales
   hay entre ellas. Enúncialo en 2-3 frases antes de lanzar nada. Umbral: si
   el mapa revela que el encargo es trivial (una línea, config menor), dilo
   y hazlo tú directamente en vez de montar el operativo.
2. **Contratos primero.** Si hay diseño de software nuevo o cambios técnicos
   que cruzan áreas, lanza al `arquitecto` antes que a los implementadores;
   sus contratos (firmas, esquemas, rutas) viajan textualmente dentro de los
   encargos siguientes. En encargos de negocio el papel equivalente lo hace
   quien define el marco (p. ej. `marca` antes que `diseno` y `redactor`;
   `asesor` o `gestor` antes de repartir un plan).
3. **Reparto.** Áreas independientes → sus expertos EN PARALELO, en un solo
   bloque de llamadas. Dependencias reales → en secuencia, pasando el
   contrato. Cada encargo lleva: contexto mínimo suficiente, contrato a
   cumplir, criterio de éxito y qué debe devolver (el experto no ve esta
   conversación).
4. **Integración.** Recibe los informes, resuelve los conflictos entre áreas
   y verifica el CONJUNTO end-to-end — cada experto verificó su parte, pero
   el flujo completo cruzando áreas es tuyo, no de ellos. Si el cambio es
   crítico, remata con el `verificador` (encargo: refutar el conjunto).
5. **Cierre.** Registra en `memoria/proyecto/` las decisiones que traigan los
   informes. Reporte final: qué hizo cada experto (con ficheros:línea), la
   evidencia de verificación del conjunto, y qué queda pendiente o en riesgo.

No hagas tú "por encima" el trabajo de un área: si el mapa dice que un área
tiene trabajo sustancial, su experto lo hace minuciosamente.
