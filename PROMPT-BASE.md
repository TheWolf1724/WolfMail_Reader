# PROMPT BASE — Definición y arranque del proyecto

Este es el prompt fundacional del proyecto. Se usa UNA vez, al principio, y
queda en el repo como acta de nacimiento del proyecto.

**Cómo usarlo (humano):** rellena las secciones de la PARTE 1 — las que sepas;
deja `?` en las que no. Luego dile a Claude: *"Lee PROMPT-BASE.md y arranca la
definición del proyecto"*. Claude completará los huecos entrevistándote y
ejecutará la PARTE 2.

---

## PARTE 1 — Definición (rellena el humano)

### 1. Visión en una frase

<!-- Qué es y para qué existe. Ej.: "Una app interna que centraliza los
partes de obra para que oficina deje de recibirlos por WhatsApp." -->

### 2. Problema que resuelve

<!-- El dolor concreto de hoy. Cómo se hace ahora y por qué es malo.
Un proyecto sin problema claro es un proyecto que se abandona. -->

### 3. Usuarios

<!-- Quién lo usa, cuántos son, qué nivel técnico tienen, en qué dispositivo
o entorno. "Yo mismo" también es una respuesta válida. -->

### 4. Alcance

**Dentro (v1):**
<!-- Las 3-7 capacidades sin las cuales no sirve. Numeradas. -->

**Fuera (explícitamente NO, por ahora):**
<!-- Tan importante como lo de dentro. Lo que se descarta a propósito
para no dispersarse. -->

### 5. Requisitos no funcionales

<!-- Solo los que apliquen de verdad:
- Rendimiento (¿cuántos usuarios/datos? ¿qué es "lento"?)
- Seguridad/privacidad (¿datos sensibles? ¿autenticación?)
- Disponibilidad (¿puede caerse una noche o no?)
- Idiomas, accesibilidad, offline... -->

### 6. Stack y restricciones técnicas

<!-- Lo impuesto vs. lo abierto:
- Impuesto: "tiene que correr en el servidor X que ya tenemos", "sin Docker".
- Abierto: "el framework me da igual, elige tú y justifica".
Si todo está abierto, dilo: Claude propondrá stack con justificación.
COSTE: por defecto, coste CERO — solo servicios y planes gratuitos, sin nada
que facture. Si aquí no dices lo contrario, esa es la restricción firme; si
aceptas gasto, dilo explícito y con techo ("hasta X €/mes en Y"). -->

### 7. Integraciones y dependencias externas

<!-- APIs de terceros, sistemas existentes con los que debe hablar,
ficheros/formatos que debe leer o producir. -->

### 8. Criterios de éxito

<!-- ¿Cómo sabremos que la v1 está TERMINADA y que FUNCIONA?
Medibles si se puede. Ej.: "los 4 encargados registran partes una semana
sin volver a WhatsApp". -->

### 9. Riesgos y miedos

<!-- Lo que te preocupa que salga mal: técnico, de adopción, de tiempo.
Claude debe tenerlos en cuenta al diseñar. -->

### 10. Plazos y prioridad

<!-- ¿Hay fecha? ¿Qué es antes: rápido, barato o completo? Elige dos. -->

---

## PARTE 2 — Protocolo de arranque (lo ejecuta Claude)

El protocolo se dispara ante CUALQUIER señal de arranque, sin frase mágica:
"lee PROMPT-BASE", "empecemos", "lee la base", o simplemente que el usuario
describa lo que quiere construir estando el proyecto SIN DEFINIR. Si el
usuario contó su proyecto en el chat en vez de rellenar la PARTE 1, vuelca
tú su descripción en la PARTE 1 y entrevista solo los huecos restantes.
TODO el protocolo es automático — no esperes más instrucciones. Sigue estos
pasos EN ORDEN:

0. **Panel de bienvenida.** Lo PRIMERO que muestras es el banner del comando
   `/panel` (formato exacto en `.claude/commands/panel.md`): comandos
   disponibles, agentes expertos, ficheros clave y estado actual. Así el
   usuario ve de un vistazo todo lo que este repo pone a su disposición.
   Inmediatamente después, sin esperar respuesta, continúa con el paso 1.

1. **Auditoría de la definición.** Lee la PARTE 1. Lista los huecos (`?`,
   secciones vacías, contradicciones, ambigüedades que cambian el diseño).
   Entrevista al usuario SOLO sobre esos huecos — preguntas concretas, con
   opciones y tu recomendación, de una en una o en grupos pequeños. No
   preguntes lo que tenga default razonable: proponlo y sigue. Al terminar,
   VUELCA las respuestas acordadas en la PARTE 1 (sustituyendo los `?`):
   lo que se congele después debe ser el acta completa, no un fichero de
   huecos cuyas respuestas murieron en la conversación.

   **Escalera del «no sé»** — si el usuario no sabe responder una pregunta:
   (a) el experto del área se la explica en llano, con 2-3 opciones, sus
   consecuencias y una recomendación; (b) si sigue sin saberlo, ese experto
   DECIDE como asesor experto — elige lo que mejor sirve al proyecto, lo
   registra en memoria como decisión revisable con su porqué, y se coordina
   con los demás expertos que la decisión implique (¿términos y condiciones
   y no sabe qué poner? → `legal` redacta el borrador con `redactor`, sin
   esperar a que el usuario aprenda derecho). Un «no sé» nunca deja un hueco
   vacío ni frena el arranque.

2. **Propuesta técnica.** Con la definición completa — delegando el diseño
   al agente `arquitecto` y consultando a `seguridad` y `devops` si el
   proyecto expone datos o requiere despliegue, y a los expertos de negocio
   pertinentes si el proyecto tiene esa vertiente (`asesor` si la viabilidad
   está en duda, `legal` si publica web o trata datos personales, `marca` y
   `diseno` si tiene cara visible; panel completo en el doc 10) — produce:
   - Stack propuesto con justificación breve (si estaba abierto). Coste CERO
     por defecto: elige solo servicios y planes gratuitos y mantente dentro de
     sus límites; si algo pudiera facturar (tier de pago, límites de un free
     tier, minutos de CI en repo privado), decláralo y no lo asumas sin que el
     usuario lo apruebe explícitamente.
   - Arquitectura inicial: módulos, flujo de datos, esquema de datos si aplica.
   - Plan por fases: la fase 1 debe producir algo USABLE de extremo a
     extremo, aunque sea mínimo (vertical, no horizontal).
   - Estrategia de verificación: cómo se probará cada fase.
   - Riesgos técnicos con mitigación.
   Presenta esto y ESPERA aprobación. No escribas código todavía.

3. **Materialización.** Tras la aprobación:
   - Rellena la sección "Configuración del proyecto" de `CLAUDE.md` (qué es,
     comandos, arquitectura, reglas, verificación estándar).
   - Reescribe `README.md` para que describa ESTE proyecto (qué es, cómo se
     instala y cómo se usa), no la plantilla. Sustitúyelo sin miedo: la
     explicación de la maquinaria TEMPLATE ya vive en
     `docs/00-la-plantilla.md`.
   - Registra en `memoria/proyecto/` las decisiones tomadas con su porqué
     (un recuerdo por decisión importante) y actualiza su `MEMORIA.md`.
   - Actualiza `memoria/proyecto/ESTADO.md`: el proyecto pasa de SIN DEFINIR
     a "Fase 1 — <descripción>", con el siguiente paso concreto.
   - Congela la PARTE 1 de este fichero: ya no se edita; los cambios de
     alcance futuros se registran como decisiones en la memoria del proyecto.
   - Esqueleto inicial del repo (estructura de carpetas, tooling, "hola
     mundo" verificable) — y verifícalo ejecutándolo.

4. **Arranque de la fase 1.** Con el esqueleto verificado, empieza la fase 1
   del plan aprobado, con el ciclo normal de trabajo (explorar → ejecutar →
   verificar → reportar), la disciplina de memoria de `CLAUDE.md` y la
   delegación por áreas a los agentes expertos (regla en `CLAUDE.md`,
   detalle en `docs/10`).

Regla transversal: en cada paso, lo decidido se escribe (memoria/CLAUDE.md),
no se deja en la conversación. La conversación se pierde; el repo queda.
