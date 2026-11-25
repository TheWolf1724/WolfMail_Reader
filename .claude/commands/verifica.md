---
description: Verificación completa de los cambios recientes — escalera hasta end-to-end + revisión adversarial
---

Verifica los cambios recientes de este repo ($ARGUMENTS si se indica un
alcance; si no, el diff sin commitear o el último commit).

Sube la escalera completa y reporta en qué peldaño queda cada cosa:

1. **Estático:** lint / typecheck / compilación del proyecto (los comandos de
   CLAUDE.md; si no hay, detecta el tooling).
2. **Tests:** suite existente. Si el cambio añadió lógica sin test que la
   cubra, señálalo como hueco (y proponme añadirlo).
3. **End-to-end:** ejercita el flujo real afectado — arranca la app, llama al
   endpoint, corre el script con datos reales — y observa el comportamiento.
   Este peldaño no es opcional para cambios no triviales.
4. **Bordes:** entrada vacía/nula/malformada, 0/1/máximo elementos, y los
   call sites del código tocado (¿alguno se rompe con la nueva firma o
   comportamiento?).
5. **Adversarial:** lanza el subagente `verificador` con el encargo de
   REFUTAR el cambio, y espera su veredicto.

Informe final: veredicto por peldaño con la evidencia observada (no "debería
funcionar"), huecos encontrados, y riesgo residual si algo no se pudo probar.
No arregles nada sin decírmelo antes: primero el informe.
