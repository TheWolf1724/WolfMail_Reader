---
description: Promocionar recuerdos confirmados de memoria/plantilla a reglas y proponer subirlos al repo-plantilla
---

Ejecuta el bucle de mejora de la plantilla (docs/08):

1. Lee `memoria/plantilla/MEMORIA.md` y todos sus recuerdos.
2. Clasifícalos:
   - **Confirmados** (validados por mí o aplicados con éxito varias veces) →
     candidatos a promoción.
   - **Recientes/sin confirmar** → se quedan como están.
   - **Obsoletos o refutados** → candidatos a borrado.
3. Para cada confirmado, proponme la promoción concreta: el texto exacto de
   la regla y dónde iría (sección de CLAUDE.md o doc de docs/). Espera mi
   aprobación antes de editar nada.
4. Aplica las promociones aprobadas; marca esos recuerdos con ✓ en el índice.
5. Lee `memoria/plantilla/ORIGEN.md` (la URL del repo-plantilla y la versión
   heredada; si el fichero falta o está vacío, pregúntame la URL y créalo) y
   proponme llevar las mejoras aprobadas allí (PR o copia de los ficheros
   tocados). No toques el repo-plantilla sin mi confirmación explícita:
   afecta a futuros proyectos.
6. Tras sincronizar, actualiza en `ORIGEN.md` la fecha de la sincronización
   realizada (hijo → plantilla, o plantilla → hijo si trajiste novedades).
7. Informe final: qué se promocionó y a dónde, qué se borró, qué queda
   pendiente de confirmar. Recuerda el presupuesto: CLAUDE.md no debe superar
   ~1 página — cada regla nueva promocionada desplaza su detalle a docs/, y
   si la sección de comportamiento crece sin parar, algo sobra.
