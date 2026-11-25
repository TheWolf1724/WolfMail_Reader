# 08 — Memoria dual y mejora continua de la plantilla

Este doc explica el diseño de las dos memorias del repositorio y el bucle que
hace que la plantilla mejore con el uso. Las reglas operativas están en el
`CLAUDE.md` raíz; aquí está el porqué y los casos dudosos.

## El problema que resuelve

Con una sola memoria, se mezclan dos cosas de naturaleza distinta:

- **Lecciones sobre CÓMO trabajar** ("los planes deben incluir riesgos",
  "no asumir que hay tests; comprobar primero") — valen para todos los
  proyectos, y si se quedan enterradas en la memoria de un proyecto, se
  pierden para los demás.
- **Hechos sobre EL proyecto** ("elegimos Postgres", "el deploy es con el
  script X") — solo valen aquí, y contaminarían la plantilla si subieran.

Separarlas permite que las primeras fluyan hacia arriba (a la plantilla) y
las segundas se queden donde deben.

## La regla de enrutado, con casos dudosos

Test: **"¿Le serviría a OTRO proyecto hecho con esta plantilla?"**

| Situación | Destino | Por qué |
|---|---|---|
| "No me des catálogos de opciones, recomienda" | plantilla | Es feedback de comportamiento, universal |
| "Elegimos FastAPI por X" | proyecto | Decisión técnica local |
| "En este servidor no hay Docker" | proyecto | Hecho del entorno local |
| "Antes de proponer Docker, comprueba si el entorno lo tiene" | plantilla | La lección generalizada del hecho anterior |
| "El usuario prefiere respuestas en español" | plantilla | Preferencia de la persona, viaja con ella |
| "El endpoint de pagos es frágil, tocar con cuidado" | proyecto | Solo existe aquí |

El caso mixto es el patrón más valioso: un tropiezo local ("propuse Docker y
aquí no hay") casi siempre esconde una lección general ("comprobar el entorno
antes de proponer herramientas"). Se guardan las dos, cada una en su memoria,
enlazadas con `[[name]]`.

## Los tres niveles de la memoria de plantilla

Un recuerdo de plantilla sube de nivel según se confirma:

```
Nivel 1: RECUERDO         memoria/plantilla/*.md
         Observación reciente, aún sin confirmar.
              │  (el usuario lo valida, o funciona varias veces)
              ▼
Nivel 2: REGLA            CLAUDE.md raíz o docs/
         Instrucción operativa de este repo. El recuerdo
         original se marca ✓ en el índice y se poda después.
              │  (el usuario aprueba "sincronizar la plantilla")
              ▼
Nivel 3: PLANTILLA        el repositorio-plantilla original
         Los próximos proyectos nacen ya con la mejora.
```

Reglas del bucle:

- **Subir de 1 a 2 se PROPONE, no se hace en silencio** — cambiar CLAUDE.md
  cambia el comportamiento de todas las sesiones futuras.
- **Subir de 2 a 3 requiere aprobación explícita** — toca un repo que afecta
  a otros proyectos. Mecánica: PR al repositorio-plantilla (o copia manual de
  los ficheros mejorados de docs/ y CLAUDE.md).
- **La dirección inversa también existe:** al actualizarse la plantilla
  original, un proyecto puede traerse las mejoras (diff de docs/ y de la
  sección de comportamiento del CLAUDE.md; la sección "Configuración del
  proyecto" y las memorias NUNCA se sobrescriben desde la plantilla).

## ESTADO.md vs. MEMORIA.md del proyecto

Conviven dos ficheros en `memoria/proyecto/` con papeles distintos:

- **ESTADO.md** — el "dónde estamos": vivo, se sobrescribe cada sesión,
  responde a "¿por dónde íbamos?" en 10 segundos. Es lo primero que se lee
  al empezar y lo último que se actualiza al terminar.
- **MEMORIA.md + recuerdos** — el "qué sabemos": duradero, acumulativo,
  decisiones con su porqué, gotchas, referencias. No caduca con la sesión.

Síntoma de mal uso: ESTADO.md de 200 líneas (no se está podando) o decisiones
importantes que solo existen en el registro cronológico (no se están
promocionando a recuerdo).

## Higiene compartida por ambas memorias

Las mismas reglas del doc 05: un fichero = un hecho, fechas absolutas,
actualizar antes que duplicar, borrar lo falso, guardar el porqué junto al
qué, verificar que un recuerdo sigue vigente antes de actuar sobre él, y no
guardar lo que el repo ya registra.
