# CLAUDE.md — <NOMBRE DEL PROYECTO>

<!--
Plantilla de CLAUDE.md por proyecto. Cópiala a la raíz del repo y rellena.
REGLA: todo lo que escribas aquí ocupa contexto en CADA sesión. Sé denso:
solo lo que el modelo no puede deducir leyendo el código, y solo lo que
importa en la mayoría de las sesiones. Máximo ~1 página.
-->

## Qué es esto

<!-- 2-3 frases: qué hace el proyecto, para quién, en qué estado está.
Ej.: "API REST de gestión de obras. En producción. Stack: Python 3.12 +
FastAPI + Postgres 16. Cliente principal: la app móvil interna." -->

## Comandos clave

<!-- Los que el modelo va a necesitar. Verificados, no de memoria. -->

```bash
# Arrancar en desarrollo:
# Tests:
# Lint / typecheck:
# Build / deploy:
```

## Arquitectura en 5 líneas

<!-- Solo lo NO obvio: dónde está el punto de entrada, cómo fluye una
petición, qué módulo manda. Si el código lo dice solo, no lo repitas. -->

## Reglas de este proyecto

<!-- Restricciones que el código no muestra. Ejemplos del tipo de cosa
que va aquí (borra y pon las tuyas): -->

- <!-- "No tocar el módulo X sin avisar: lo consume el sistema Y externo." -->
- <!-- "Los tests de integración necesitan la BD local levantada (comando arriba)." -->
- <!-- "Aquí NO se usa Docker: el servidor de producción no lo tiene." -->
- <!-- "Coste cero: solo servicios/planes gratuitos; cualquier gasto requiere
  autorización explícita." (déjala salvo que este proyecto tenga presupuesto) -->
- <!-- "Idioma del código y comentarios: inglés. Idioma con el usuario: español." -->

## Verificación estándar

<!-- Cómo se comprueba que un cambio funciona en ESTE proyecto.
Ej.: "1) pytest, 2) arrancar con make dev, 3) probar el endpoint tocado
con curl. Un cambio sin los tres pasos no está terminado." -->

## Trampas conocidas

<!-- Gotchas que han costado tiempo. Ej.: "El hot-reload no recoge cambios
en config/, hay que reiniciar a mano." -->

## Estado y memoria

<!-- Si usas documento de estado, decláralo:
"El estado del trabajo en curso vive en NOTAS.md. Léelo al empezar la sesión
y actualízalo al terminar (estado actual, siguiente paso, decisiones)." -->
