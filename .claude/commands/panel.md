---
description: Mostrar el panel del proyecto — banner con comandos, expertos, estado actual y siguiente paso
---

Muestra el panel del proyecto. Lee primero `memoria/proyecto/ESTADO.md`
(estado y siguiente paso) y comprueba con un vistazo a `git log -1` si hay
actividad posterior no reflejada. Después imprime el banner rellenando los
huecos con la información REAL leída (no inventes; si algo no existe, dilo
en su hueco):

```
╔═════════════════════════════════════════════════════════════════════╗
║                 TEMPLATE · Panel del proyecto                       ║
╠═════════════════════════════════════════════════════════════════════╣
║ PROYECTO   <nombre, o "SIN DEFINIR — usa PROMPT-BASE.md">           ║
║ ESTADO     <resumen de ESTADO.md en una línea>                      ║
║ SIGUIENTE  <siguiente paso de ESTADO.md en una línea>               ║
╠═════════════════════════════════════════════════════════════════════╣
║ COMANDOS                                                            ║
║   /panel                → este panel                                ║
║   /retomar              → abrir sesión donde se quedó               ║
║   /cierre               → cerrar sesión (estado + memoria)          ║
║   /verifica [alcance]   → escalera de verificación completa         ║
║   /orquesta <encargo>   → repartir trabajo entre los expertos       ║
║   /sincroniza-plantilla → promocionar mejoras a la plantilla        ║
╠═════════════════════════════════════════════════════════════════════╣
║ AGENTES EXPERTOS (delego por área y cadencia — ver CLAUDE.md)       ║
║   arquitecto  → software          backend      → servidor/APIs      ║
║   frontend    → interfaz          datos        → BD/migraciones     ║
║   seguridad   → auditoría         calidad      → diseño de tests    ║
║   tester      → orquesta pruebas  robustez     → fallos opacos      ║
║   rendimiento → eficiencia        devops       → infra/deploy       ║
║   ia          → IA/LLMs           movil        → apps móviles*      ║
║   i18n        → multiidioma*      datos-bi     → análisis/BI*       ║
║   diseno      → web/UX/UI         marca        → identidad/logos    ║
║   gestor      → planificación     asesor       → negocio            ║
║   ideas       → lluvia de ideas   contabilidad → finanzas           ║
║   legal       → legal/RGPD        rrhh         → personas           ║
║   compras     → proveedores       marketing    → captación/SEO      ║
║   redactor    → textos            documentador → docs/DOCX/PDF      ║
║   explorador  → búsqueda          verificador  → refutación         ║
║   (*) de nicho: solo si el proyecto va de eso                       ║
╠═════════════════════════════════════════════════════════════════════╣
║ FICHEROS CLAVE                                                      ║
║   PROMPT-BASE.md              → definición fundacional              ║
║   memoria/proyecto/ESTADO.md  → ¿por dónde íbamos?                  ║
║   memoria/{proyecto,plantilla}/MEMORIA.md → índices de memoria      ║
╚═════════════════════════════════════════════════════════════════════╝
```

La sección AGENTES EXPERTOS se contrasta con la realidad: lista los
ficheros de `.claude/agents/` y, si hay agentes nuevos o eliminados que
el recuadro de arriba no refleja, regenera esa sección con los reales
(nombre + área breve sacada de su `description`).

Ajusta el ancho del recuadro si hace falta para que los contenidos reales
quepan alineados. Tras el banner, UNA frase: qué recomiendas hacer ahora
(normalmente el siguiente paso de ESTADO.md, o arrancar PROMPT-BASE.md si el
proyecto está sin definir).
