# Ruta a Farmacia de Turno Mas Cercana - Spec

## Objetivo

Permitir que el usuario encuentre rapidamente la farmacia de turno mas cercana a su ubicacion y pueda ver como llegar.

La primera version debe priorizar utilidad, bajo costo y baja complejidad. La ruta interna por calles puede ser una mejora posterior si se valida el uso.

## Casos de Uso

### Caso principal

1. El usuario entra al mapa.
2. Selecciona "De turno".
3. Toca una accion como "Mas cercana" o "Ir a la mas cercana".
4. La app pide permiso de ubicacion si no lo tiene.
5. La app calcula la farmacia de turno mas cercana.
6. El mapa centra la farmacia y muestra el popup.
7. La app ofrece una accion "Como llegar".

### Caso secundario

El usuario selecciona una farmacia de turno manualmente y toca "Como llegar" desde el popup.

## Opciones de Implementacion

### Opcion A: Distancia recta + enlace externo

Calcular la farmacia mas cercana usando distancia en linea recta entre el usuario y cada farmacia de turno. Luego ofrecer abrir Google Maps con origen actual y destino farmacia.

Ventajas:
- Simple.
- No consume Mapbox Directions API.
- Baja complejidad.
- Funciona bien como MVP.

Desventajas:
- No muestra ruta dentro de la app.
- La distancia no representa calles reales.

### Opcion B: Linea recta interna

Dibujar una linea `LineString` entre la ubicacion del usuario y la farmacia seleccionada.

Ventajas:
- Muy simple de dibujar en Mapbox.
- Se puede actualizar en tiempo real si cambia la ubicacion.
- No requiere API de rutas.

Desventajas:
- No representa el camino real.
- Puede confundir si parece una ruta por calles.

### Opcion C: Ruta real inicial con Mapbox Directions

Usar Mapbox Directions API para obtener una ruta por calles entre ubicacion del usuario y farmacia.

Flujo:
- Obtener ubicacion del usuario.
- Calcular farmacia de turno mas cercana.
- Pedir ruta a Mapbox Directions.
- Dibujar la ruta como capa `line`.
- Mostrar distancia y tiempo estimado.

Ventajas:
- Experiencia mas completa.
- Muestra camino real.
- Permite mostrar ETA y distancia.

Desventajas:
- Consume API.
- Mayor complejidad.
- Requiere manejar errores de red y limites.

### Opcion D: Ruta real dinamica

Actualizar la ruta cuando el usuario se mueve.

Ventajas:
- Mejor experiencia de navegacion dentro de la app.

Desventajas:
- Puede consumir muchas llamadas a Directions API.
- Requiere throttling.
- Requiere decidir cuando recalcular.
- No conviene para primera version.

## Recomendacion

Implementar en dos etapas:

### Etapa 1 - MVP

- Calcular farmacia de turno mas cercana por distancia recta.
- Centrar mapa en la farmacia.
- Abrir popup.
- Dibujar una linea recta sutil entre usuario y farmacia, si visualmente suma.
- Agregar boton "Como llegar" que abre Google Maps.

Esta etapa valida si la accion "mas cercana" tiene valor real.

### Etapa 2 - Ruta interna real

- Integrar Mapbox Directions API.
- Dibujar ruta por calles.
- Mostrar distancia y tiempo estimado.
- Agregar boton "Actualizar ruta".

### Etapa 3 - Ruta dinamica

- Recalcular ruta solo si:
  - pasaron al menos 30 a 60 segundos, o
  - el usuario se movio mas de 50 a 100 metros, o
  - el usuario se alejo claramente de la ruta.

No recalcular en cada movimiento GPS.

## UX Propuesta

### Boton Principal

Ubicacion sugerida:
- En el panel de acciones del mapa, visible cuando hay turnos.

Texto:
- "Mas cercana"

Estados:
- Normal: permite buscar la farmacia de turno mas cercana.
- Cargando: obteniendo ubicacion.
- Sin permisos: mostrar mensaje para habilitar ubicacion.
- Sin turnos: ocultar o deshabilitar.

### Popup

Cuando se abre la farmacia mas cercana, mostrar:

- Badge: "Mas cercana de turno"
- Distancia aproximada.
- Boton: "Como llegar"

### Mapa

Si se dibuja una linea:
- Usar color celeste, consistente con el halo de turno.
- No hacerla demasiado gruesa.
- Evitar que parezca ruta real si es linea recta.

## Datos Necesarios

Para cada farmacia:
- `name`
- `address`
- `phone`
- `geometry.coordinates`
- estado `turno`

Para usuario:
- latitud
- longitud
- timestamp de ubicacion

## Calculo de Distancia

Usar formula Haversine para distancia recta.

Entrada:
- `[lngUsuario, latUsuario]`
- `[lngFarmacia, latFarmacia]`

Salida:
- distancia en metros o kilometros.

## Apertura de Google Maps

URL sugerida:

```text
https://www.google.com/maps/dir/?api=1&destination={lat},{lng}
```

Opcionalmente incluir origen:

```text
https://www.google.com/maps/dir/?api=1&origin={latUsuario},{lngUsuario}&destination={latFarmacia},{lngFarmacia}
```

## Ruta con Mapbox Directions

Endpoint conceptual:

```text
https://api.mapbox.com/directions/v5/mapbox/driving/{lngUsuario},{latUsuario};{lngFarmacia},{latFarmacia}?geometries=geojson&overview=full&access_token={token}
```

La respuesta devuelve:
- geometria GeoJSON
- distancia
- duracion

La geometria se dibuja como source/layer:

- source: `ruta-farmacia-source`
- layer: `ruta-farmacia-layer`
- type: `line`

## Consideraciones Tecnicas

### Permisos

Manejar:
- usuario acepta ubicacion
- usuario rechaza ubicacion
- ubicacion no disponible
- timeout

### Performance

No recalcular rutas reales en cada movimiento.

### Costos

La version con Google Maps externo y distancia recta no agrega costo de API.

La version con Mapbox Directions puede aumentar consumo segun uso.

### Privacidad

No guardar ubicacion del usuario en backend.

Usarla solo en memoria para calcular distancia/ruta.

## Criterios de Aceptacion MVP

- El usuario puede tocar "Mas cercana".
- La app pide ubicacion si hace falta.
- La app identifica una farmacia de turno.
- El mapa centra esa farmacia.
- Se abre el popup de la farmacia.
- Se muestra distancia aproximada.
- Existe accion "Como llegar".
- Si no hay permisos, se informa claramente.
- Si no hay turnos, no rompe la UI.

## Pendientes de Decision

- Agregar o no una linea recta visual en MVP.
- Usar solo Google Maps externo o sumar Mapbox Directions desde la primera version.
- Donde ubicar el boton "Mas cercana" en mobile.
- Si el popup debe mostrar distancia siempre o solo al venir desde la accion.
