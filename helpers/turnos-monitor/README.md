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

Los workflows `Consultar turnos Esperanza` y `Consultar turnos Santa Fe y Santo Tomé`
se ejecutan de forma independiente a las 09:17 de Argentina: Esperanza del día
1 al 5, y el Colegio todos los días para mantener el respaldo diario. GitHub puede
retrasar la ejecución. Ambos permiten ejecución manual y una prueba por push
a `automation/consulta-turnos`. Cada uno consulta únicamente su fuente y guarda
su propio artifact. El segundo descarga el afiche compartido del Colegio: por ahora
importa Santa Fe y Santo Tomé con validaciones y candidatos independientes.

Para consultar una sola fuente localmente, usar `check.py --source esperanza` o
`check.py --source santa-fe`; sin argumentos se consultan ambas fuentes.
La programación se activa al integrar el workflow a la rama predeterminada.
Ver el resumen y descargar el artifact en la pestaña Actions; se conserva 14 días.

`changed` significa diferencia respecto de `baseline.json`, no confirmación de
un calendario válido o nuevo. Se compara el contenido del PDF y el bloque de
turnos de Esperanza; se ignoran cambios ajenos al calendario de esa ciudad.
La referencia no se actualiza automáticamente: después de revisar un cambio,
actualizar los hashes de `baseline.json` con los del informe aprobado.
Un error de consulta marca únicamente el workflow de esa fuente como fallido.
La consulta guarda informes; los pasos posteriores pueden proponer datos en un PR borrador.

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

Actions ejecuta la consulta, las pruebas y la importación de Esperanza en su propio
workflow, independiente de Santa Fe y Santo Tomé. Si Esperanza no pudo descargarse o validarse,
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

Con dudas, la app conserva sus datos. Los candidatos, informes y recortes se
guardan exclusivamente en `turnos-report/`, dentro del artifact de Actions.
Los PR de datos incluyen únicamente el JSON validado de la app. Si no cambia
ningún dato validado, no se abre un PR solo para revisión.
Con todas las validaciones superadas, `--apply` actualiza la localidad seleccionada para el
mes correspondiente en el JSON compartido, conservando la otra localidad y otros meses,
y propone ese cambio en un PR borrador. No publica ni integra automáticamente.
Si el candidato coincide con los datos actuales, no crea una actualización vacía.

Validación inicial con el afiche de octubre de 2026: 146/146 filas de farmacias,
7/7 restricciones de fechas y todos los rangos coinciden con los datos manuales
existentes. También se prueba una farmacia desconocida para verificar continuidad
del procesamiento y conservación de alternativas. Este resultado sobre un solo
mes no demuestra un 99,9 % de precisión futura. Faltan afiches adicionales para
medir generalización y ajustar recortes si el diseño cambia; la API de medios de
WordPress rechazó la consulta pública de archivos anteriores con HTTP 401.

La ejecución completa en GitHub del extractor y conciliador también fue exitosa:
https://github.com/nicoarato/pharMaps-SFv2.0/actions/runs/38074301958
con 146 filas resueltas, siete restricciones resueltas, cero dudas y ningún cambio
de datos necesario para octubre.

## Importación de Santo Tomé

El workflow del Colegio también recorta los nueve bloques de la franja derecha
bajo SANTO TOMÉ y obtiene tres lecturas OCR. Usa un catálogo propio,
`santo-tome-farmacias.json`, sin reutilizar grupos ni fechas de meses anteriores.

```sh
node helpers/turnos-ocr/scripts/extract-santa-fe.mjs archivo.pdf turnos-report/santo-tome-ocr santo-tome
python3 helpers/turnos-monitor/import_santa_fe.py --locality santo-tome --input turnos-report/santo-tome-ocr/ocr.json --apply
```

Se validan mes, localidad, nueve bloques, rangos de 24 horas, cobertura completa,
nombres, direcciones, teléfonos y filas de tinta sin lectura. Las dudas conservan
los datos publicados y generan evidencia en el artifact de Actions.
El PR compartido incluye únicamente el JSON con las actualizaciones validadas.
Los datos de octubre de Santo Tomé se usan como referencia de prueba: nueve grupos,
29 farmacias y todas las fechas deben coincidir con los datos revisados existentes.
Un cambio de diseño del afiche puede requerir ajustar los recortes.

## Respaldo diario: El Litoral

Si la descarga/OCR falla o el afiche no corresponde al mes vigente, el workflow
consulta `https://servicios.ellitoral.com/seccion/farmacias/` para Santa Fe y
`https://servicios.ellitoral.com/seccion/farmacias-de-turno-santo-tome` para Santo Tomé.
Las páginas publican hoy y mañana; no proporcionan cobertura de todo el mes.

`import_litoral.py --locality santa-fe --apply` y la variante `--locality santo-tome`
validan localidad, fecha de hoy en Argentina, continuidad de las fechas, horario,
nombres sin duplicados y coincidencia de dirección o teléfono con el catálogo.
Se usan las fechas visibles: el atributo `datetime` observado invierte día y mes.
Las discrepancias de contacto se informan sin sobrescribir los datos del catálogo.
Una fecha desactualizada, farmacia desconocida o fila incompleta impide la importación.

Cada fecha se incorpora como rango de 08:00 a 08:00 en el JSON existente. Se conservan
otras fechas, meses y localidades; un calendario ya revisado tiene prioridad sobre
el respaldo. La fuente queda identificada como `html-litoral-diario` y su cobertura
como parcial. Un afiche vigente con dudas mantiene su circuito de revisión, sin
reemplazarlo silenciosamente por esta fuente secundaria.

El Action se ejecuta a diario y abre/actualiza el mismo PR borrador. Las actualizaciones
requieren revisar e integrar el PR para publicarse; no hay merge automático.
El artifact contiene el HTML, los candidatos y `*-litoral-import.json`, y el resumen
de Actions detalla la fuente utilizada y las advertencias. Fallos en la consulta/OCR
principal son recuperables; si el respaldo tampoco valida, el job queda fallido.

Pruebas del respaldo basadas en las páginas reales del 02/11/2026: 11 y 12 farmacias
de Santa Fe, tres y tres de Santo Tomé, rechazo de fechas antiguas y datos desconocidos,
prioridad del PDF y acumulación de fechas sin borrar datos existentes.
