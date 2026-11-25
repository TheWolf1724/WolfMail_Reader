---
description: Cierre de sesión — actualizar ESTADO.md, enrutar recuerdos nuevos y dejar el repo retomable
---

Ejecuta el protocolo de cierre de sesión:

1. **ESTADO.md** — actualiza `memoria/proyecto/ESTADO.md`:
   - "Estado actual" reescrito (máximo 5 líneas; sobrescribe, no acumules).
   - "Siguiente paso" concreto y accionable — que un "retomar" en frío pueda
     empezar por ahí sin preguntar nada.
   - Decisiones de hoy con fecha absoluta y porqué; callejones sin salida si
     los hubo; una línea en el registro cronológico.
2. **Enrutado de memoria** — repasa la sesión buscando hechos duraderos:
   decisiones con porqué, correcciones del usuario, gotchas del entorno,
   patrones que funcionaron o fallaron. Para cada uno aplica el test
   *"¿serviría en otro proyecto de la plantilla?"*: sí → recuerdo en
   `memoria/plantilla/`, no → `memoria/proyecto/`. Actualiza los índices.
   No guardes lo que el repo ya registra ni trivialidades de la conversación.
3. **Repo retomable** — `git status`: si hay trabajo terminado y verificado
   sin commitear, proponme commitearlo (no lo hagas sin confirmación). El
   commit lo firma el dueño del repo, sin `Co-Authored-By` ni atribución a IA
   (regla en CLAUDE.md). Si hay trabajo a medias, que ESTADO.md lo diga
   explícitamente.
4. **Informe final** — en 3-6 frases: qué quedó hecho y verificado, qué quedó
   a medias, qué recuerdos guardaste y dónde, y cuál es el siguiente paso.
