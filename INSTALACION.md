# Instalación global (uso alternativo)

> **Nota:** si creas tu proyecto desde esta plantilla de GitHub, no necesitas
> nada de esto — el `CLAUDE.md` raíz, la memoria y los agentes ya vienen en el
> repo (ver `README.md`). Esta guía es para el uso alternativo: aplicar el
> modo Fable **globalmente** a todas tus sesiones de Claude Code, también en
> proyectos que no usen la plantilla.

Cómo aplicar el kit para que Opus 4.8 trabaje en "modo Fable". Los pasos 1 y 2
dan el 90% del beneficio; el resto es refinamiento. Los comandos `cp` se
ejecutan desde la raíz de tu clon de la plantilla, esté donde esté.

> **No lo instales dos veces:** si un proyecto nace de la plantilla, su
> `CLAUDE.md` ya contiene estas reglas — instalar además el global (paso 1) y
> el output style (paso 3) las cargaría por duplicado o triplicado en cada
> sesión, puro desperdicio de contexto. En proyectos de la plantilla manda el
> `CLAUDE.md` del proyecto; el global es para los proyectos que no la usan.

## Paso 1 — Instrucciones globales (el núcleo)

```bash
# Si NO tienes ~/.claude/CLAUDE.md:
cp plantillas/CLAUDE-global.md ~/.claude/CLAUDE.md

# Si YA lo tienes: abre ambos y fusiona a mano (no sobrescribas el tuyo).
```

Esto aplica el comportamiento a TODAS las sesiones de Claude Code, en
cualquier proyecto y con cualquier modelo.

## Paso 2 — CLAUDE.md por proyecto

En cada proyecto donde trabajes:

```bash
cp plantillas/proyecto/CLAUDE.md /ruta/del/proyecto/CLAUDE.md
```

Y **rellénalo** — la plantilla vacía no hace nada; el valor está en los
comandos verificados, las reglas del proyecto y las trampas conocidas.
Alternativa: en el proyecto, ejecuta `/init` y luego añade las secciones de
la plantilla que falten.

## Paso 3 — Estilo de salida (opcional)

```bash
mkdir -p ~/.claude/output-styles
cp plantillas/output-style-fable.md ~/.claude/output-styles/fable.md
```

Y en Claude Code: `/output-style fable`. Nota: parte de esto ya está en el
CLAUDE.md global del paso 1; el output style lo refuerza porque se inyecta
como parte del prompt de sistema.

## Paso 4 — Subagentes personalizados (opcional)

```bash
mkdir -p ~/.claude/agents
# Los de apoyo (los más útiles en cualquier proyecto):
cp .claude/agents/explorador.md .claude/agents/verificador.md ~/.claude/agents/
# O el panel completo de expertos:
# cp .claude/agents/*.md ~/.claude/agents/
```

Con esto Opus puede delegar exploraciones al `explorador` y pedir revisión
adversarial al `verificador` (y, si copias el panel completo, delegar por
áreas como en los proyectos de la plantilla). La fuente canónica de los
agentes es `.claude/agents/` de este repo — no hay copias que mantener.

## Paso 5 — Ajustes (opcional)

Mira `plantillas/settings-ejemplo.json` y fusiona lo que te interese con tu
`~/.claude/settings.json`. Lo relevante:

- `"model": "opus"` — Opus para todo. `"opusplan"` — Opus planifica, Sonnet
  ejecuta (más barato, sorprendentemente bueno con buen plan).
- `"alwaysThinkingEnabled": true` — razonamiento extendido siempre activo.
  Es de los ajustes que más acercan Opus a Fable en problemas duros.
- `"outputStyle": "fable"` — deja fijo el estilo del paso 3.

## Paso 6 — Hábitos de uso (esto no se instala, se practica)

Las instrucciones hacen la mitad; la otra mitad es cómo pides las cosas:

1. **Contexto en la petición:** "arregla el login" rinde peor que "el login
   falla con error 500 al usar contraseñas con ñ; sospecho del encoding;
   el handler está en auth/". Cada dato que das es exploración que ahorras.
2. **Plan mode para lo grande:** Shift+Tab (o `/plan`) antes de tareas
   grandes. Revisar el plan 2 minutos ahorra rehacer trabajo 30.
3. **Sesión limpia por tarea:** `/clear` al cambiar de tema. El contexto
   arrastrado degrada más de lo que parece.
4. **Pide verificación explícita cuando importe:** "y pruébalo end-to-end
   antes de darlo por hecho" activa el nivel máximo de la escalera del doc 07.
5. **Da feedback una vez, pídele que lo recuerde:** cuando corrijas algo
   ("aquí no usamos Docker"), añade "apúntalo en el CLAUDE.md del proyecto"
   y no tendrás que repetirlo nunca.
6. **Razonamiento extra bajo demanda:** si no activas thinking global, pedir
   "piénsalo a fondo" / "think hard" en el prompt aumenta el presupuesto de
   razonamiento en esa petición. Qué hace el modelo con ese presupuesto (y
   qué debería hacer): `docs/11-razonamiento-extendido.md`.

## Verificación de la instalación

Abre una sesión nueva de Claude Code en cualquier proyecto y haz una pregunta
simple ("¿qué hace este script?"). Comportamiento esperado en modo Fable:
respuesta en prosa directa, sin tablas ni encabezados, con la conclusión en la
primera frase. Luego pide un cambio pequeño: debe explorar, editar, ejecutar
algo para verificar y reportar el estado real. Si hace las dos cosas, el kit
está funcionando.
