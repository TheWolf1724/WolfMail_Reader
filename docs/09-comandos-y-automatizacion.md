# 09 — Comandos y automatización: protocolos que no dependen de la memoria

La lección detrás de este doc: **una instrucción en CLAUDE.md es una
esperanza; un comando es un botón.** Los protocolos críticos (retomar,
cerrar sesión, verificar) funcionan mejor como slash commands que como
párrafos que el modelo debe recordar aplicar.

## Los comandos incluidos (`.claude/commands/`)

| Comando | Cuándo usarlo | Qué hace |
|---|---|---|
| `/panel` | Cuando quieras orientarte | Banner con comandos, agentes expertos, ficheros clave y estado actual del proyecto |
| `/retomar` | Al empezar una sesión | Lee ESTADO.md y memorias, contrasta con git, reporta dónde estamos y empieza el siguiente paso |
| `/cierre` | Al terminar una sesión o tarea grande | Actualiza ESTADO.md, enruta los recuerdos nuevos a su memoria, deja el repo retomable |
| `/verifica` | Antes de dar algo por terminado | Escalera completa: estático → tests → end-to-end → bordes → revisión adversarial |
| `/orquesta` | Ante una tarea que cruza áreas | Mapa de áreas → arquitecto si hay diseño → expertos en paralelo → integración y verificación del conjunto (el patrón del doc 10 como botón) |
| `/sincroniza-plantilla` | Periódicamente | Promociona recuerdos confirmados a reglas y propone subirlos al repo-plantilla |

El hábito que multiplica: **abrir con `/retomar`, cerrar con `/cierre`.**
Esos dos solos garantizan que la memoria del proyecto nunca se desactualiza,
que es el modo de fallo nº 1 de cualquier sistema de memoria.

Los comandos aceptan argumentos (`$ARGUMENTS`): `/verifica el módulo de auth`
acota el alcance.

## Escribir comandos nuevos

Un fichero markdown en `.claude/commands/<nombre>.md` = el comando
`/<nombre>`. El contenido es el prompt que se ejecuta. Buenas prácticas:

- Frontmatter con `description` de una línea (aparece en el autocompletado).
- Pasos numerados EN ORDEN, con el criterio de éxito de cada uno.
- Explícito sobre lo que NO debe hacer ("no commitees sin confirmación").
- Termina pidiendo un informe concreto: qué reportar y en cuántas frases.

Candidatos típicos según crezca el proyecto: `/deploy` (el ritual de
despliegue exacto de este repo), `/nueva-migracion`, `/release`. Cualquier
secuencia que hayas explicado dos veces en el chat merece ser comando.

## Hooks: automatización dura (opcional, avanzado)

Los comandos los invoca alguien; los **hooks** se disparan solos ante eventos
(inicio de sesión, antes/después de una herramienta, al parar). Se configuran
en `.claude/settings.json` y son la garantía más fuerte: no dependen de nadie.

La plantilla ya trae uno funcionando (`.claude/settings.json`): un hook
`SessionStart` que inyecta `memoria/proyecto/ESTADO.md` en el contexto al
abrir cada sesión — el "¿por dónde íbamos?" deja de ser una instrucción que
el modelo debe recordar y pasa a ser un hecho mecánico.

Ejemplo útil y de bajo riesgo — recordatorio de cierre al terminar sesión con
ESTADO.md desactualizado:

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "test $(find memoria/proyecto/ESTADO.md -mmin -60 2>/dev/null | wc -l) -eq 1 || echo 'AVISO: ESTADO.md lleva >1h sin actualizarse. ¿Toca /cierre?'"
      }]
    }]
  }
}
```

Otros patrones que funcionan: un hook `PostToolUse` sobre Edit/Write que
ejecute el linter del proyecto (feedback inmediato sin gastar un turno), o un
`SessionStart` que imprima el "Siguiente paso" de ESTADO.md.

Precaución: los hooks corren comandos de shell reales en tu máquina y viajan
con el repo. En una plantilla pública, mejor documentados (como aquí) que
activados por defecto — cada proyecto activa los suyos conociendo su entorno.
Para configurarlos con ayuda: pídeselo a Claude, que tiene un skill dedicado
(`update-config`).

## Qué se dejó fuera a propósito

- **Hooks activados por defecto** — riesgo en entornos desconocidos; ver
  arriba.
- **CI de GitHub Actions** — depende del stack, que la plantilla no conoce.
  Cuando el proyecto se defina (PROMPT-BASE), pedir a Claude un workflow de
  CI que ejecute la escalera de verificación es el paso natural.
- **Más comandos genéricos** — cada fichero de contexto tiene coste; la
  plantilla trae los 6 universales y el resto los añade cada proyecto.
