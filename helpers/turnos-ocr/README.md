# Turnos OCR helper

Herramientas auxiliares para regenerar datos de farmacias de turno desde PDFs o imagenes fuente.

Este helper no es necesario para ejecutar la app. La app solo consume los JSON finales ubicados en `src/assets/data/`.

## Uso

```bash
cd helpers/turnos-ocr
npm install
npm run ocr:pdf -- ../../ruta/al/archivo.pdf docs/ocr-turnos-output.json
npm run ocr:santa-fe -- ../../ruta/al/archivo.pdf docs/turnos-santa-fe-julio-2026.json
```

Luego revisar/normalizar el resultado y copiar solo el JSON final validado a `src/assets/data/`.

## Contenido

- `scripts/`: scripts de OCR y extraccion.
- `docs/`: salidas y referencias generadas durante la extraccion.
- `spa.traineddata`: datos de idioma para OCR en espanol.

Mantener este directorio separado evita sumar dependencias OCR al runtime de la app.
