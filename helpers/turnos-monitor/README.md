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
