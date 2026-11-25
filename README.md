# TEMPLATE — Plantilla de repositorio para proyectos con Claude Code

Plantilla de GitHub para arrancar proyectos donde Claude Code trabaja en
"modo Fable": la capa de comportamiento de Claude Fable 5 (razonamiento,
verificación, comunicación, memoria) destilada como instrucciones para
exprimir al máximo cualquier modelo, incluido Opus 4.8.

## Qué te da un repo creado desde esta plantilla

- **`CLAUDE.md`** — el contrato de funcionamiento que Claude lee en cada
  sesión: comportamiento modo Fable + protocolos de inicio/fin de sesión +
  enrutado de memoria.
- **`PROMPT-BASE.md`** — el prompt fundacional: defines el proyecto en 10
  secciones y Claude ejecuta un protocolo de arranque profesional
  (entrevista de huecos → propuesta técnica → plan por fases → esqueleto
  verificado).
- **Memoria dual** — `memoria/plantilla/` (lecciones sobre cómo debe
  trabajar Claude, reutilizables en cualquier proyecto) separada de
  `memoria/proyecto/` (decisiones y estado de ESTE proyecto). Claude sabe
  cuál usar mediante una regla de enrutado (doc 08).
- **Bucle de mejora** — lo aprendido se promociona: recuerdo → regla del
  repo → plantilla original. Cada proyecto mejora la plantilla para el
  siguiente.
- **Comandos** — los protocolos como slash commands: `/panel` (banner con
  comandos, expertos y estado), `/retomar` (abrir sesión), `/cierre`
  (cerrar sesión y enrutar memoria), `/verifica` (escalera de verificación
  completa), `/orquesta` (repartir un encargo entre los expertos),
  `/sincroniza-plantilla` (bucle de mejora). El hábito clave:
  abrir con `/retomar`, cerrar con `/cierre`.
- **Panel de agentes expertos** — cada área tiene su especialista minucioso
  con checklist propia. Técnicos: `arquitecto`, `backend`, `frontend`,
  `datos`, `seguridad`, `calidad` (diseño de tests), `tester` (orquesta la
  suite), `robustez` (fallos opacos), `rendimiento`, `devops`, `ia`, y de
  nicho `movil`, `i18n`, `datos-bi` (solo si el proyecto va de eso). De
  producto y negocio:
  `diseno` (web/UX/UI), `marca` (logos/identidad), `gestor`, `asesor`,
  `ideas`, `contabilidad`, `legal`, `rrhh`, `compras`, `marketing`,
  `redactor`, `documentador` (entrega docs en DOCX/PDF/HTML). De apoyo:
  `explorador` y `verificador`. Claude orquesta: reparte por áreas,
  paraleliza lo independiente e integra (doc 10).
- **Coste cero por defecto** — todo proyecto nacido de la plantilla asume
  gasto CERO (solo tiers gratuitos, sin nada que facture) salvo que digas lo
  contrario explícitamente. Regla en `CLAUDE.md` y en el arranque de
  `PROMPT-BASE.md`; `arquitecto` y `devops` la vigilan al diseñar y `compras`
  es su guardián ante cualquier contratación.
- **`docs/`** — `00` explica la plantilla misma (sobrevive dentro de cada
  proyecto hijo cuando el arranque reescribe el README); `01`-`11`, la
  doctrina completa de cada disciplina — incluido el `11`, cómo razona Fable
  dentro del thinking y cómo activarlo en Opus.
- **`.github/`** — plantilla de PR con checklist de verificación y memoria, y
  un `workflows/ci.yml.example` (CI desactivado por defecto: no gasta minutos
  de Actions hasta que lo renombres a `ci.yml` y lo adaptes a tu stack).
- **`plantillas/`** — extras opcionales para el uso global: CLAUDE.md global
  para `~/.claude`, CLAUDE.md por proyecto, output style y settings
  recomendados (guía en `INSTALACION.md`).

## Uso

### Crear un proyecto nuevo

**Vía A — desde GitHub:** **Use this template → Create a new repository**
(requiere haber marcado "Template repository" en Settings) y clona el repo
nuevo a tu carpeta de trabajo.

**Vía B — flujo local (trabajar en carpeta y subir después):**

```bash
# 1. Copia local desde la plantilla e historial limpio:
git clone git@github.com:TheWolf1724/Template.git mi-proyecto
cd mi-proyecto
rm -rf .git && git init -b main

# 2. Fija TU identidad en el repo (para que la autoría sea solo tuya):
git config user.name "TheWolf1724"
git config user.email "145658463+TheWolf1724@users.noreply.github.com"

git add -A && git commit -m "Proyecto nuevo desde la plantilla TEMPLATE"

# 3. Trabaja en local con normalidad. Cuando toque publicar:
gh repo create mi-proyecto --private --source=. --push
```

No borres `memoria/plantilla/ORIGEN.md`: es el ancla que permite a
`/sincroniza-plantilla` devolver mejoras a la plantilla. Y ojo con el paso 2:
al hacer `git init` la identidad vuelve a la global de tu equipo (que puede
ser tu correo de trabajo) — fijar la local deja los commits a nombre de tu
cuenta de GitHub, no de otra. Claude nunca se añade como coautor.

**En ambas vías, el arranque es el mismo:**

1. Abre el repo con Claude Code y **cuéntale tu proyecto** — vale cualquier
   señal de arranque ("empecemos", "quiero hacer una app que..."): Claude lee
   `CLAUDE.md` automáticamente en cada sesión y ese contrato dispara solo el
   protocolo de `PROMPT-BASE.md`. Rellenar antes la PARTE 1 a mano es
   opcional (ayuda, pero no hace falta: Claude vuelca lo que le cuentes y
   entrevista solo los huecos).
2. Si no sabes responder algo, el experto del área te lo explica con
   opciones; si sigues sin saberlo, decide él como asesor experto y lo deja
   registrado como decisión revisable.
3. A partir de ahí, trabajo normal: Claude mantiene `memoria/` al día y tú
   retomas cualquier sesión con `/retomar` o "¿por dónde íbamos?".

### Publicar esta plantilla en GitHub (una sola vez)

```bash
cd Template
gh repo create Template --private --source=. --push
# o: crea el repo vacío en la web, luego
# git remote add origin git@github.com:TU_USUARIO/Template.git
# git push -u origin main
```

Después, en GitHub: **Settings → marcar "Template repository"**. Eso activa
el botón "Use this template".

### Mantener la plantilla viva

Cuando en un proyecto se acumulen recuerdos confirmados en
`memoria/plantilla/`, dile a Claude "sincroniza la plantilla": propondrá
llevar esas mejoras (docs y reglas de CLAUDE.md) al repo-plantilla vía PR.
Detalle del bucle en `docs/08-memoria-dual-y-mejora-continua.md`.

## Estructura

```
├── CLAUDE.md                  ← contrato de funcionamiento (Claude lo lee siempre)
├── PROMPT-BASE.md             ← prompt fundacional del proyecto
├── README.md                  ← este fichero (reescríbelo para TU proyecto)
├── INSTALACION.md             ← uso alternativo: aplicar el modo Fable globalmente
├── memoria/
│   ├── plantilla/             ← memoria DE LA PLANTILLA (mejoras de comportamiento)
│   │   └── MEMORIA.md
│   └── proyecto/              ← memoria DEL PROYECTO (decisiones, estado)
│       ├── MEMORIA.md
│       └── ESTADO.md          ← "¿por dónde íbamos?" — primero en leerse
├── docs/                      ← 00 = qué es la plantilla + doctrina (01-11)
├── plantillas/                ← extras opcionales (global, output style, settings)
├── .github/                   ← plantilla de PR + CI stub inerte (ci.yml.example)
└── .claude/
    ├── settings.json          ← hook SessionStart: inyecta ESTADO.md al abrir sesión
    ├── agents/                ← 28 expertos: técnicos (arquitecto, backend,
    │                            frontend, datos, seguridad, calidad, tester,
    │                            robustez, rendimiento, devops, ia + nicho
    │                            movil, i18n, datos-bi), negocio (diseno, marca,
    │                            gestor, asesor, ideas, contabilidad, legal,
    │                            rrhh, compras, marketing, redactor,
    │                            documentador) + apoyo (explorador, verificador)
    └── commands/              ← /panel, /retomar, /cierre, /verifica,
                                 /orquesta, /sincroniza-plantilla
```

## Aclaración honesta

Fable 5 y Opus 4.8 son modelos distintos: los pesos no se transfieren. Lo que
esta plantilla transfiere es la **capa de comportamiento** — que en la
práctica pesa más que la diferencia bruta entre modelos punteros: un Opus
bien instruido y con buen contexto supera a un Fable usado con prompts vagos.
El detalle de qué es transferible y qué no, en
`docs/01-que-es-transferible.md`.
