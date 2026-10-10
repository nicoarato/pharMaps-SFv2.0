# Consulta mensual de turnos

Primera etapa: monitorear Santa Fe y Esperanza, descargar las publicaciones y
compararlas con la referencia obtenida el 10 de octubre de 2026. Rosario queda
fuera porque ya existe el calendario anual.

## Ejecutar

```sh
python3 helpers/turnos-monitor/check.py
```

Requiere Python 3.9+, curl, base de zonas horarias y acceso a Internet. Usa IPv4
y hasta dos reintentos por descarga ante fallos transitorios. No instala
dependencias. Escribe HTML, PDF de Santa Fe, texto del calendario de Esperanza,
`report.json` y `summary.md` en `turnos-report/` (ignorado por Git).

## GitHub Actions

El workflow `Consultar turnos Santa Fe y Esperanza` ejecuta la consulta del día
1 al 5 a las 09:17 de Argentina; GitHub puede retrasar la ejecución. También
permite ejecución manual y una prueba por push a `automation/consulta-turnos`.
La programación se activa al integrar el workflow a la rama predeterminada.
Ver el resumen y descargar el artifact en la pestaña Actions; se conserva 14 días.

`changed` significa diferencia respecto de `baseline.json`, no confirmación de
un calendario válido o nuevo. Se compara el contenido del PDF y el bloque de
turnos de Esperanza; se ignoran cambios ajenos al calendario de esa ciudad.
La referencia no se actualiza automáticamente: después de revisar un cambio,
actualizar los hashes de `baseline.json` con los del informe aprobado.
Un error en cualquiera de las fuentes marca la ejecución como fallida, guardando
el informe de ambas. Esta prueba no envía mensajes ni modifica/publica datos.

Pendiente para una siguiente etapa: extracción/OCR de Santa Fe, validación de
mes, días completos y nombres, y generación de JSON y Pull Requests. Los enlaces
o formatos pueden cambiar y requerir ajustes. En repositorios públicos GitHub
puede desactivar la programación después de 60 días sin actividad.

## Resultado de la prueba del 10/10/2026

Ambas fuentes funcionaron localmente. En dos ejecuciones de GitHub Actions,
Esperanza devolvió las 31 fechas de octubre. Santa Fe agotó el tiempo de conexión
HTTPS, incluso con IPv4 y reintentos. No se ha confirmado la causa: podría ser
una restricción de red del sitio o un problema de ruta desde los runners.
El diagnóstico posterior comparó DNS, HTTP/HTTPS, con/sin www y descarga directa
del PDF desde Linux y macOS en GitHub. Ambos resolvieron a 135.181.16.98 y todos
los accesos dieron HTTP 200. Otro runner Linux siguió fallando: el comportamiento
depende del servidor o su ruta de conexión, sin causa exacta confirmada.

Se cambió la consulta a `macos-latest` y la ejecución completa
https://github.com/nicoarato/pharMaps-SFv2.0/actions/runs/38072908932
finalizó correctamente: PDF de octubre de Santa Fe y calendario de octubre de
Esperanza coincidentes con la referencia local. Esto prueba acceso y detección,
no la corrección de los turnos del PDF ni disponibilidad futura garantizada.

Para repetir el diagnóstico: `python3 helpers/turnos-monitor/diagnose.py`, o usar
el workflow manual `Diagnosticar acceso a fuentes de turnos`. Las sondas reportan
los fallos en el JSON; que el job de diagnóstico termine correctamente no implica
que todas las URLs hayan respondido (revisar `http_code` y `exitCode`).

## Importación de Esperanza

`python3 helpers/turnos-monitor/import_esperanza.py` valida el calendario
descargado y genera un candidato en `turnos-report/esperanza-candidate.json`.
Con `--apply` también reemplaza el JSON local, únicamente si todos los controles
pasan y hay diferencias de contenido (la fecha de consulta sola no genera cambios).
`--month YYYY-MM` permite una prueba histórica; Actions usa el mes actual argentino.

Se exige coincidencia del encabezado y las fechas con el mes esperado, todos los
días del mes, fechas y farmacias sin duplicados, nombres reconocidos y no reemplazar
un calendario de un mes posterior. Los turnos se generan de 08:00 a 08:00, incluyendo
el cambio de mes/año. El catálogo explícito es `esperanza-farmacias.json`; incluye
los nombres usados actualmente en la app. La variante Tkaczyck se mapea a TKACZYK.
Nombres nuevos o ambiguos requieren revisar y ampliar el catálogo, sin adivinarlos.

Actions ejecuta las pruebas y la importación aun cuando Santa Fe falle, para que
las consultas sean independientes. Si Esperanza no pudo descargarse o validarse,
no crea cambios. En ejecuciones manuales/programadas válidas, abre o actualiza un
PR borrador con únicamente `turnos-esperanza.json`, usando el token de GitHub.
Debe estar habilitada la opción de permitir a GitHub Actions crear Pull Requests
en Settings > Actions > General. Los pushes de la rama de prueba solo verifican
la generación; no crean PR de datos. No hay integración ni despliegue automático.

La fuente de octubre tiene `Dolnalisio / Barrios` el día 12; nuestros datos actuales
dicen `Bar / Barrios`. A partir de la indicación del usuario se agregó la equivalencia
explícita Dolnalisio → DONALISIO. El candidato sigue la fuente para ese día; la
diferencia con los datos actuales debe revisarse en el PR antes de publicar.

Pruebas: `python3 -m unittest discover -s helpers/turnos-monitor -p 'test_*.py'`.
