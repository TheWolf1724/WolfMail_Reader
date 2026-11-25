# 10 — El panel de expertos: delegación por áreas

El doc 06 explica los subagentes como herramienta (contexto, paralelismo).
Este doc explica el **panel de expertos**: un equipo fijo de especialistas,
cada uno minucioso en su área, con el agente principal como orquestador.

## Por qué expertos y no un generalista para todo

Tres razones, por orden de peso:

1. **Minuciosidad por checklist.** Cada experto lleva grabada la checklist
   de su área (el backend piensa en idempotencia y fallos de terceros; el de
   datos, en consumidores del esquema y vuelta atrás; el de calidad, en
   tests que no pueden fallar). Un generalista con prisa se salta
   exactamente esos puntos. El experto no puede: son su encargo.
2. **Contexto limpio por área.** El experto de frontend no arrastra los 40k
   tokens de la investigación de la migración de datos. Trabaja enfocado.
3. **Paralelismo real.** Backend, frontend y tests de una misma feature
   pueden avanzar a la vez si los contratos están definidos primero.

## El equipo

| Agente | Área | ¿Modifica código? |
|---|---|---|
| `arquitecto` | Diseño, contratos, esquemas, trade-offs | No — diseña y decide |
| `backend` | Servidor, APIs, servicios, integraciones | Sí |
| `frontend` | Interfaz, componentes, estado de UI, UX | Sí |
| `datos` | Esquema, migraciones, consultas, integridad | Sí (con paranoia) |
| `seguridad` | Auditoría defensiva de código y config | No — informa |
| `calidad` | Diseña qué probar y escribe los casos; audita huecos | Solo tests |
| `tester` | Infraestructura de la suite, siembra y orquesta su ejecución | Sí (tests e infra de test) |
| `robustez` | Errores no contemplados, excepciones tragadas, mensajes opacos | Sí (manejo de errores) |
| `rendimiento` | Perfilado, cuellos de botella, eficiencia de recursos | Sí (optimización medida) |
| `devops` | Build, CI/CD, deploy, entornos | Sí (producción: jamás sin confirmación) |
| `ia` | Integración de LLMs, prompts, evaluación, costes | Sí |
| `diseno` | Diseño web, UX/UI, sistema visual, accesibilidad | Sí (capa visual) |
| `marca` | Identidad visual: logos, paleta, tipografía, guía | Sí (entregables de marca) |
| `gestor` | Planificación: tareas, dependencias, riesgos, seguimiento | No — planifica |
| `asesor` | Negocio: viabilidad, priorización, decisiones de rumbo | No — analiza y recomienda |
| `ideas` | Lluvia de ideas: divergencia y convergencia con criterio | No — genera opciones |
| `contabilidad` | Finanzas: caja, costes, impuestos, presupuestos | No — orienta (vinculante: asesor colegiado) |
| `legal` | RGPD, licencias, contratos, propiedad intelectual | No — orienta y redacta borradores |
| `rrhh` | Puestos, selección, onboarding, desempeño | No — orienta (vinculante: gestoría) |
| `compras` | Proveedores, coste total, alternativas gratuitas | No — evalúa (guardián del coste cero) |
| `marketing` | Captación, posicionamiento, SEO, contenidos, medición | No — estrategia y planes |
| `redactor` | Textos de web/producto, guías, emails, calidad de prosa | Sí (solo textos) |
| `documentador` | Documentación como sistema; exporta a DOCX/PDF/HTML | Sí (docs y entregables) |
| `movil` | Apps iOS/Android, ciclo de vida, permisos, tiendas | Sí (solo en proyectos móviles) |
| `i18n` | Multiidioma: catálogos, formatos locales, RTL, plurales | Sí (solo en proyectos multiidioma) |
| `datos-bi` | Métricas, informes, cuadros de mando sobre datos existentes | Sí (análisis y reporting) |
| `explorador` | Búsqueda amplia de solo lectura | No |
| `verificador` | Refutación adversarial de cambios | No |

Los expertos no técnicos siguen las mismas reglas de encargo e informe que
los técnicos, con una salvedad honesta: `contabilidad`, `legal` y `rrhh`
orientan con rigor pero NO sustituyen al profesional colegiado — todo lo
vinculante lo marcan explícitamente para confirmación profesional.

## Cadencia de activación: cada experto, solo cuando debe

Un panel grande solo funciona si no se convoca entero cada vez. La regla
(operativa en `CLAUDE.md`) distingue cuatro cadencias:

| Cadencia | Quiénes | Cuándo actúan |
|---|---|---|
| Recurrentes | `verificador`, `calidad`, `tester`, `robustez`, `seguridad`, `documentador` | Sin que nadie los pida: tras cambios importantes, con cada funcionalidad, sembrando y corriendo pruebas, cazando fallos opacos, antes de publicar, cuando la doc queda atrás |
| Guardianes | `legal`, `compras`, `arquitecto` | Saltan solos ante su evento: publicar/tratar datos, contratar/comprar, cambio estructural |
| De área | `backend`, `frontend`, `datos`, `devops`, `ia`, `rendimiento`, `diseno`, `redactor`, `gestor` | Cuando el encargo toca su área — automático, pero solo entonces |
| Bajo demanda | `marca`, `asesor`, `ideas`, `contabilidad`, `rrhh`, `marketing`, y los de nicho `movil`, `i18n`, `datos-bi` | Solo si la tarea es de su materia o el usuario los llama |

El antipatrón a evitar en ambas direcciones: convocar a `rrhh` para un bug de
CSS o al `movil` en una web (ruido y coste) y hacer tú "por encima" el trabajo
sustancial de un área que tiene experto (pérdida de minuciosidad). La cadencia
dice cuándo; el umbral de trivialidad dice si. Los de nicho (`movil`, `i18n`,
`datos-bi`) son el caso extremo de "bajo demanda": no existen para el proyecto
hasta que su materia es, explícitamente, el trabajo.

## La escalera del «no sé»

El panel también existe para cuando el USUARIO no sabe algo. Ante una
pregunta que no sabe responder ("¿qué pongo en los términos y condiciones?",
"¿SQLite o Postgres?"):

1. **El experto explica:** el agente del área se la traduce a llano — 2-3
   opciones, qué implica cada una, y una recomendación.
2. **El experto decide:** si el usuario sigue sin saberlo, el experto toma la
   iniciativa como asesor experto: elige lo que mejor sirve al proyecto, lo
   registra en memoria como decisión revisable (con su porqué), y se coordina
   con los demás expertos que la decisión arrastre — los términos y
   condiciones los redacta `legal` con `redactor`, sin esperar a que el
   usuario aprenda derecho.

La regla de fondo: un «no sé» del usuario es un encargo para el panel, nunca
un bloqueo del proyecto ni una tarea devuelta al usuario.

## El patrón de orquestación para una feature

```
                        ┌─ arquitecto ─┐
  ENCARGO ──────────────┤  (contratos) ├──────────────┐
                        └──────────────┘              │
                               │ contratos definidos  │
                ┌──────────────┼──────────────┐       │
                ▼              ▼              ▼       │ en paralelo
            backend        frontend       calidad     │
                └──────────────┼──────────────┘       │
                               ▼                      │
                        ORQUESTADOR integra           │
                               │                      │
                ┌──────────────┼──────────────┐       │
                ▼              ▼              ▼       │ en paralelo
           verificador     seguridad      /verifica   │
                └──────────────┼──────────────┘       │
                               ▼                      ▼
                        informe al usuario + memoria
```

En prosa: el arquitecto define primero los contratos (lo único que bloquea);
con contratos claros, los implementadores trabajan en paralelo; el
orquestador integra; y la verificación (adversarial + seguridad si aplica)
también va en paralelo. Para un cambio pequeño el diagrama se colapsa a "un
experto + verificación", y para un typo, a nada — el umbral está en
CLAUDE.md.

## El arte del encargo (lo que decide la calidad del resultado)

El experto no ve la conversación: su mundo es el encargo. Un encargo
profesional tiene cuatro partes:

1. **Contexto:** qué proyecto es, qué parte toca, dónde está lo relevante
   (rutas), y las restricciones de CLAUDE.md que le apliquen.
2. **Contrato:** qué debe cumplir su pieza — la firma del endpoint, el
   esquema acordado, el comportamiento esperado. Si el arquitecto lo
   definió, se pega literal en el encargo.
3. **Criterio de éxito:** cómo sabrá él mismo que terminó (incluida la
   verificación que debe ejecutar — los expertos entregan verificado).
4. **Formato de vuelta:** qué debe contener su informe.

Antipatrón clásico: encargos que se solapan ("backend, haz el endpoint y de
paso ajusta la UI") — cada área a su experto, y lo que cruza áreas lo
coordina el orquestador con el contrato en la mano.

## Conflictos entre expertos

Cuando dos informes chocan (seguridad pide bloquear lo que UX pide facilitar,
datos veta la consulta que backend necesita), el orquestador NO promedia:
identifica el trade-off real, decide con las prioridades del proyecto
(PROMPT-BASE/CLAUDE.md) y registra la decisión en memoria. Si el conflicto
toca una prioridad que el usuario no ha definido, es de las pocas preguntas
que merecen interrumpirle.

## Personalizar el panel

Cada proyecto puede añadir expertos propios en `.claude/agents/` (por
ejemplo `experto-facturacion` en un ERP, con las reglas fiscales del dominio
en su prompt) o afinar los existentes al stack real. La estructura del
fichero: frontmatter con `name`, `description` (de ella depende que el
orquestador sepa cuándo delegarle) y opcionalmente `tools` (limitar a
lectura para los que no deben tocar código); el cuerpo, con su checklist
minuciosa y el formato de su informe. Un experto de dominio bien escrito es
de las mejoras que más merecen subirse a la plantilla si se generaliza.
