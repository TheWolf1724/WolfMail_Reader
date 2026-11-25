# 05 — Memoria persistente: recordar entre sesiones

Fable usa una memoria basada en ficheros que sobrevive entre sesiones. Es uno
de sus multiplicadores de rendimiento más potentes y es 100% replicable con
Opus, porque es pura convención de ficheros.

## El diseño

```
~/.claude/projects/<proyecto>/memory/
├── MEMORY.md                  ← índice: una línea por recuerdo (esto se
│                                carga en contexto al empezar cada sesión)
├── preferencias-usuario.md    ← un fichero = un hecho
├── proyecto-migracion-db.md
└── referencia-dashboard.md
```

**MEMORY.md** es solo el índice — una línea por recuerdo con un enlace y un
gancho que permita decidir si es relevante:

```markdown
- [Preferencias de estilo](preferencias-usuario.md) — prosa en español, sin emojis
- [Migración DB en curso](proyecto-migracion-db.md) — Postgres 14→16, falta prod
```

Cada recuerdo es un fichero con frontmatter:

```markdown
---
name: proyecto-migracion-db
description: Estado de la migración Postgres 14→16
type: project
---

La migración de staging terminó el 2026-07-01. Falta producción.
**Decisión tomada:** usar pg_upgrade, no dump/restore (más rápido, ya probado).
Relacionado: [[preferencias-usuario]]
```

## Los cuatro tipos de recuerdo

| Tipo | Qué guarda | Ejemplo |
|---|---|---|
| `user` | Quién es el usuario: rol, nivel, preferencias | "Prefiere explicaciones en español, nivel avanzado en Linux" |
| `feedback` | Correcciones que el usuario ha dado sobre cómo trabajar, con el porqué | "No usar Docker en este proyecto — el servidor no lo tiene" |
| `project` | Estado y decisiones de trabajo en curso no derivables del código | "El bug de amdgpu se mitiga con X; queda probar Y" |
| `reference` | Punteros externos | "El dashboard de métricas está en https://..." |

## Reglas de higiene (las que evitan que la memoria se pudra)

1. **No guardar lo que el repo ya registra:** estructura del código, historial
   git, contenido de CLAUDE.md. La memoria es para lo NO derivable.
2. **Fechas absolutas, nunca relativas:** "el 2026-07-01", no "ayer" (que
   dentro de un mes no significa nada).
3. **Actualizar antes que duplicar:** si ya existe un fichero sobre el tema,
   editarlo; no crear "migracion-db-2.md".
4. **Borrar lo que resulta falso.** Una memoria equivocada es peor que ninguna.
5. **Verificar antes de usar:** un recuerdo refleja lo que era cierto cuando se
   escribió. Si menciona un fichero o flag, comprobar que aún existe antes de
   recomendarlo.
6. **Guardar el PORQUÉ con el feedback:** "el usuario no quiere X" es frágil;
   "no quiere X porque rompe Y" permite generalizar bien.

## Qué merece guardarse (filtro)

Guardar: decisiones tomadas y su razón, estado de proyectos multi-sesión,
preferencias estables del usuario, correcciones recibidas, gotchas del entorno
("esta máquina tiene la GPU con el driver parcheado").

NO guardar: detalles de una conversación puntual, cosas triviales de re-derivar,
código (para eso está el repo), especulaciones.

## Cómo replicarlo con Opus

Opus en Claude Code puede tener el mismo sistema. En el CLAUDE.md global (ver
plantilla) se incluyen las instrucciones para:

1. Al inicio de sesión, leer `MEMORY.md` si existe.
2. Al descubrir un hecho duradero (decisión, preferencia, corrección), escribir
   el fichero de memoria y añadir la línea al índice.
3. Aplicar las reglas de higiene de arriba.

También funciona una versión simplificada: un único `NOTAS.md` por proyecto
donde se apunta estado y decisiones al final de cada sesión. Menos elegante,
pero el 80% del beneficio.

## El patrón "documento de estado" para proyectos largos

Para proyectos que duran semanas: un documento vivo con secciones fijas —

```markdown
# HISTORIAL — <proyecto>
## Estado actual        ← 3-5 líneas: dónde estamos HOY
## Siguiente paso       ← qué toca hacer al retomar
## Decisiones tomadas   ← con fecha y porqué
## Callejones sin salida ← qué se probó y NO funciona (ahorra repetir)
## Registro cronológico ← apéndice, lo menos importante
```

La instrucción clave para el modelo: al retomar («¿por dónde íbamos?»), leer
"Estado actual" y "Siguiente paso" ANTES de proponer nada.
