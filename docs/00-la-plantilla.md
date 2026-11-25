# 00 — La plantilla TEMPLATE (qué es esta maquinaria)

Este repositorio nació de la plantilla TEMPLATE. Si estás leyendo esto
dentro de un proyecto ya definido, este doc explica la maquinaria que el
proyecto trae de serie — el `README.md` habla del proyecto; de la plantilla
habla este fichero.

## Qué trae un repo nacido de la plantilla

- **`CLAUDE.md`** — el contrato de funcionamiento que Claude lee en cada
  sesión: comportamiento modo Fable, protocolos de inicio/fin de sesión,
  enrutado de memoria y la restricción de coste cero por defecto.
- **`PROMPT-BASE.md`** — el prompt fundacional: el humano define el proyecto
  en 10 secciones y Claude ejecuta el protocolo de arranque (entrevista de
  huecos → propuesta técnica → plan por fases → esqueleto verificado). Tras
  el arranque queda congelado como acta de nacimiento.
- **Memoria dual** — `memoria/plantilla/` (lecciones sobre cómo debe trabajar
  Claude, reutilizables en cualquier proyecto) separada de `memoria/proyecto/`
  (decisiones y estado de ESTE proyecto). Regla de enrutado en `CLAUDE.md`;
  detalle en el doc 08.
- **Comandos** — `/panel`, `/retomar`, `/cierre`, `/verifica`, `/orquesta`,
  `/sincroniza-plantilla` (en `.claude/commands/`). El hábito clave: abrir
  con `/retomar`, cerrar con `/cierre`. Detalle en el doc 09.
- **Agentes expertos** — técnicos (`arquitecto`, `backend`, `frontend`,
  `datos`, `seguridad`, `calidad`, `tester`, `robustez`, `rendimiento`,
  `devops`, `ia`, y de nicho `movil`, `i18n`, `datos-bi`), de producto y
  negocio
  (`diseno`, `marca`, `gestor`, `asesor`, `ideas`, `contabilidad`, `legal`,
  `rrhh`, `compras`, `marketing`, `redactor`, `documentador`) y de apoyo
  (`explorador`, `verificador`), en
  `.claude/agents/`. Claude orquesta; los expertos ejecutan su área.
  Detalle en el doc 10.
- **Coste cero por defecto** — el proyecto asume gasto CERO (solo tiers
  gratuitos) salvo indicación explícita del usuario. Regla en `CLAUDE.md`.
- **`.github/`** — plantilla de PR con checklist de verificación, y
  `workflows/ci.yml.example` (CI desactivado: renómbralo a `ci.yml` y
  adáptalo a tu stack cuando quieras activarlo; en repo privado consume de
  la cuota gratuita de Actions).
- **`docs/`** — la doctrina completa: los docs 01–11 explican el porqué de
  cada regla de `CLAUDE.md` (el 11, cómo razona Fable dentro del thinking).
- **`plantillas/`** — extras para el uso alternativo (aplicar el modo Fable
  globalmente en `~/.claude/`): CLAUDE.md global, CLAUDE.md por proyecto,
  output style, settings de ejemplo y los agentes de apoyo. Guía en
  `INSTALACION.md`.

## El bucle de mejora

Lo aprendido no se queda en el proyecto: recuerdo en `memoria/plantilla/` →
regla en `CLAUDE.md`/docs → (con `/sincroniza-plantilla` y permiso del
usuario) el repositorio-plantilla original. Cada proyecto mejora la plantilla
para el siguiente. Detalle en el doc 08.

## Aclaración honesta

Fable 5 y Opus 4.8 son modelos distintos: los pesos no se transfieren. Lo que
la plantilla transfiere es la **capa de comportamiento** — que en la práctica
pesa más que la diferencia bruta entre modelos punteros: un Opus bien
instruido y con buen contexto supera a un Fable usado con prompts vagos. El
detalle de qué es transferible y qué no, en el doc 01.
