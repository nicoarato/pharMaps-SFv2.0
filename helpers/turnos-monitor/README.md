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

## Importación de Santa Fe

El workflow instala las dependencias aisladas de `helpers/turnos-ocr` y renderiza
el PDF a escala 3. Comprueba mes y etiqueta de localidad y recorta los 12 bloques
de Santa Fe. Para cada bloque obtiene tres lecturas: original, binarizada y texto
disperso. Conserva página completa, recortes, coordenadas, textos y confianza OCR.
Un control independiente de bandas de tinta señala filas que el OCR haya omitido.

```sh
npm ci --prefix helpers/turnos-ocr
node helpers/turnos-ocr/scripts/extract-santa-fe.mjs archivo.pdf turnos-report/santa-fe-ocr
python3 helpers/turnos-monitor/import_santa_fe.py
```

El conciliador usa nombres del catálogo `santa-fe-farmacias.json`, dirección y
teléfono, acuerdo entre lecturas y separación entre candidatos. No hereda fechas
ni pertenencia a grupos de un mes anterior. Reconstruye los rangos de 08:00 a 08:00
y las restricciones de farmacias que atienden solo en una de las fechas del grupo.
Conserva separadamente las direcciones que continúan en otra línea y las notas.
Se exige cobertura completa del mes y ausencia de días y farmacias duplicados.
Los puntajes de similitud no son probabilidades calibradas de acierto.

Una duda **no detiene la lectura de otros bloques**. Genera `candidate.json`,
`review.json` y `review.md`, incluyendo todas las variantes de OCR y los cinco
mejores candidatos del catálogo por lectura. No se garantiza enumerar todas las
interpretaciones posibles. Los casos sin texto también se señalan con su recorte.
El artifact de Actions incluye el PDF original y toda la evidencia.

Con dudas, la app conserva sus datos, pero el workflow abre un PR borrador con
el candidato parcial, informes y recortes pertinentes en `turnos-review/santa-fe/`.
Con todas las validaciones superadas, `--apply` actualiza solo Santa Fe para el
mes correspondiente en el JSON compartido, conservando Santo Tomé y otros meses,
y propone ese cambio en un PR borrador. No publica ni integra automáticamente.
Si el candidato coincide con los datos actuales, no crea una actualización vacía.

Validación inicial con el afiche de octubre de 2026: 146/146 filas de farmacias,
7/7 restricciones de fechas y todos los rangos coinciden con los datos manuales
existentes. También se prueba una farmacia desconocida para verificar continuidad
del procesamiento y conservación de alternativas. Este resultado sobre un solo
mes no demuestra un 99,9 % de precisión futura. Faltan afiches adicionales para
medir generalización y ajustar recortes si el diseño cambia; la API de medios de
WordPress rechazó la consulta pública de archivos anteriores con HTTP 401.
