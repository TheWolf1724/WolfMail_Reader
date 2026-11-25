# 06 — Subagentes y paralelismo: multiplicar capacidad sin quemar contexto

Una de las claves menos obvias del rendimiento de Fable: trata su propio
contexto como un recurso escaso y delega todo lo que puede.

## Por qué importa el contexto

El contexto (la ventana de trabajo del modelo) se degrada al llenarse:
- Cada fichero leído entero "para ver qué hay" son miles de tokens de ruido.
- El ruido diluye la atención sobre lo importante.
- Un contexto saturado = respuestas peores al final de la sesión, justo cuando
  más se ha invertido.

La solución de Fable: **el trabajo de volumen se delega; la conclusión se
queda.**

## Paralelismo básico (sin subagentes)

Llamadas a herramientas independientes entre sí → en un solo bloque, a la vez:

- Leer 3 ficheros que no dependen uno de otro → 3 lecturas paralelas.
- Buscar 2 patrones distintos → 2 greps paralelos.
- Regla: solo se serializa cuando el resultado de una llamada determina los
  parámetros de la siguiente.

Esto solo ya reduce el tiempo de las fases de exploración a la mitad o menos.

## Subagentes: cuándo sí y cuándo no

Un subagente es otra instancia del modelo con contexto propio que hace un
encargo y devuelve solo su informe final. Lo que el subagente lee NO ocupa
contexto del agente principal.

**Delegar a subagente cuando:**
- La búsqueda es amplia: "¿dónde se maneja X en este repo?" implica abrir
  10-30 ficheros que no quieres en tu contexto.
- Hay varias exploraciones independientes → varios subagentes EN PARALELO.
- La tarea es verificar adversarialmente algo que tú mismo hiciste (un
  contexto limpio no hereda tus sesgos).

**NO delegar cuando:**
- Es un dato puntual y sabes dónde está → grep directo, más rápido.
- El resultado necesita TODO el detalle, no la conclusión (p.ej. vas a editar
  ese fichero: léelo tú).
- Ya delegaste esa misma búsqueda → esperar, no duplicar.

## Cómo escribir el encargo a un subagente

El subagente no ve tu conversación: solo recibe el prompt. Un buen encargo:

1. **Contexto mínimo suficiente:** qué proyecto, qué se busca, por qué.
2. **Criterio de éxito explícito:** "devuelve la lista de ficheros y línea
   exacta donde se registra cada handler".
3. **Formato de vuelta:** "solo rutas y una frase por hallazgo, sin volcar
   código completo".
4. **Alcance acotado:** "no propongas cambios, solo localiza".

❌ "Mira el tema de la autenticación"
✅ "En el repo /home/user/api, localiza dónde se validan los tokens JWT:
   fichero y línea de (1) la verificación de firma, (2) la comprobación de
   expiración, (3) el middleware que lo aplica a las rutas. Devuelve solo
   rutas:línea y una frase por punto."

## Patrones de multi-agente que valen la pena

- **Exploración en abanico:** 3-5 subagentes buscando el mismo objetivo por
  ángulos distintos (por nombre de fichero, por contenido, por convención).
  Útil cuando un solo ángulo puede no encontrarlo todo.
- **Verificación adversarial:** tras un cambio importante, un subagente con el
  encargo explícito de REFUTAR: "intenta demostrar que este cambio rompe algo".
  Encuentra fallos que el autor no ve porque un contexto limpio no comparte
  los supuestos del autor.
- **Revisión por dimensiones:** un subagente busca bugs de corrección, otro
  problemas de rendimiento, otro huecos de tests — en paralelo — y luego se
  consolidan los hallazgos.

## La regla del retorno

El informe del subagente vuelve al agente principal, NO al usuario. El agente
principal debe **retransmitir lo que importa** en su propio mensaje final — no
asumir que el usuario vio nada.

## Réplica con Opus

Claude Code trae esto de serie (herramienta Agent / Task con tipos como
Explore y general-purpose). Lo único que necesita Opus son las instrucciones
de CUÁNDO usarlo — que es exactamente lo que codifica la plantilla
`CLAUDE-global.md` — y opcionalmente los agentes personalizados de
`.claude/agents/` (ya instalados en los proyectos de la plantilla; para
tenerlos globales, cópialos a `~/.claude/agents/` — ver INSTALACION.md).
