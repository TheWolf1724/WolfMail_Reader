# 01 — Qué es Fable 5 y qué parte es transferible a Opus 4.8

## Las tres capas de un "Claude funcionando"

Cuando trabajas con Claude Code, lo que percibes como "el modelo" son en realidad
tres capas apiladas:

```
┌─────────────────────────────────────────────────┐
│ CAPA 3: Contexto de la sesión                   │  ← 100% transferible
│  CLAUDE.md, memoria, historial, ficheros leídos │
├─────────────────────────────────────────────────┤
│ CAPA 2: Harness + instrucciones de sistema      │  ← ~90% transferible
│  Prompt de sistema, herramientas, permisos,     │
│  estilos de salida, hooks, subagentes           │
├─────────────────────────────────────────────────┤
│ CAPA 1: El modelo (pesos, entrenamiento)        │  ← 0% transferible
│  Capacidad de razonamiento bruta, conocimiento, │
│  seguimiento de instrucciones                   │
└─────────────────────────────────────────────────┘
```

**Capa 1 (el "cerebro" literal):** son los pesos de la red neuronal. Fable 5 es un
modelo de la familia Claude 5, un escalón por encima de Opus en capacidad. Sus
detalles internos (arquitectura, datos, técnicas de entrenamiento) son propietarios
y no públicos — ni siquiera el propio modelo los conoce. Esta capa NO se puede
copiar. Punto.

**Capa 2 (el sistema operativo del modelo):** las instrucciones de sistema que
recibe el modelo en cada sesión. Aquí vive la mayor parte de la "personalidad
operativa" de Fable: cómo comunica, cuándo planifica, cómo verifica, cómo usa
herramientas. Esta capa es casi toda texto, y el texto se copia. Este kit es,
esencialmente, esa capa destilada.

**Capa 3 (lo que sabe de ti y tu proyecto):** memoria persistente, CLAUDE.md del
proyecto, contexto acumulado. Totalmente transferible y, en la práctica, es donde
más rendimiento se gana o se pierde en el día a día.

## Por qué esto importa: el mito del "modelo listo"

Un Opus 4.8 con buenas instrucciones, buen CLAUDE.md y disciplina de verificación
**supera de forma consistente** a un Fable 5 usado a pelo con prompts vagos.
La diferencia de capacidad entre modelos punteros es real pero pequeña comparada
con la diferencia entre "contexto bueno" y "contexto malo".

Las ganancias, ordenadas de mayor a menor impacto real:

| Fuente de rendimiento | Impacto | Cómo se consigue |
|---|---|---|
| Contexto correcto y suficiente | Enorme | CLAUDE.md por proyecto, memoria, describir bien la tarea |
| Disciplina de verificación | Enorme | Exigir ejecutar/probar antes de dar algo por hecho |
| Instrucciones de comportamiento | Grande | El CLAUDE-global.md de este kit |
| Gestión de contexto (no saturarlo) | Grande | Subagentes para búsquedas, sesiones limpias por tarea |
| Calibración de esfuerzo | Media | Plan mode para lo complejo, directo para lo simple |
| Diferencia bruta Fable↔Opus | Media-pequeña | No se puede transferir |

## Qué hace diferente a Fable 5, en la práctica observable

Esto es lo que se percibe al usar Fable 5, y de aquí salen las reglas del kit:

1. **Calibra el esfuerzo a la tarea.** No escribe tres párrafos para responder
   "¿qué puerto usa este servicio?". No hace un plan formal para renombrar una
   variable. Pero ante una migración de base de datos, para, explora, planifica
   y presenta el plan antes de tocar nada.

2. **Lidera con la conclusión.** Su primera frase responde a la pregunta. Los
   detalles vienen después, para quien los quiera.

3. **No abandona a mitad.** Si un test falla, lo arregla y relanza. Si le falta
   información, la busca él mismo. Solo devuelve el turno cuando la tarea está
   completa o está bloqueado por algo que solo el usuario puede decidir.

4. **Verifica en vez de suponer.** No dice "esto debería funcionar" — lo ejecuta
   y reporta el resultado real, incluidos los fallos, sin maquillarlos.

5. **Paraleliza.** Lanza búsquedas y lecturas independientes a la vez. Delega
   exploraciones amplias a subagentes para no quemar su propio contexto.

6. **Se relee antes de terminar.** Si su último párrafo es una promesa ("ahora
   voy a...") en vez de un hecho consumado, sigue trabajando.

7. **Comunica en prosa limpia.** Sin cadenas de flechas, sin jerga inventada
   sobre la marcha, sin tablas para todo. Frases completas, términos técnicos
   con nombre propio.

Cada uno de estos puntos está desarrollado en los docs 02–07, y todos están
codificados como instrucciones en `plantillas/CLAUDE-global.md`.

## Limitaciones que hay que aceptar

- Opus 4.8 seguirá instrucciones complejas algo peor que Fable 5: conviene que
  las instrucciones sean más cortas, más imperativas y con ejemplos.
- En razonamiento muy profundo (algoritmos complejos, debugging de varias capas)
  la diferencia de capa 1 se nota. Mitigación: trocear el problema, usar plan
  mode, pedir verificación adversarial, y darle a Opus la disciplina interna
  de razonamiento del doc 11 (hipótesis que discriminan, auto-refutación,
  sé/asumo/adivino) con el thinking siempre activo.
- Ninguna instrucción compensa un contexto pobre. El 80% del "hazlo lo más
  inteligente posible" se juega en darle buen contexto.
