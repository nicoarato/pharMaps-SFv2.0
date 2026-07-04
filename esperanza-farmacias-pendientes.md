# Farmacias Pendientes De Completar En Esperanza

Este archivo sirve para completar farmacias faltantes o mal vinculadas entre:

- el dataset principal de farmacias en Firebase
- el archivo de turnos de Esperanza

Objetivo:

- que cada farmacia de turno exista en Firebase con coordenadas
- que cada alias del turno tenga su `farmaciaName` exacto
- que la app pueda mostrarla en lista y también ubicarla en el mapa

## Formato requerido en Firebase

Cada farmacia debe existir como `Feature` con este formato:

```json
{
  "geometry": {
    "coordinates": [LONGITUD, LATITUD],
    "type": "Point"
  },
  "properties": {
    "address": "DIRECCION",
    "farma_id": "ID_UNICO",
    "localidad": "ESPERANZA",
    "name": "Farmacia NOMBRE",
    "phone": "TELEFONO",
    "provincia": "SANTA FE",
    "version": "1.0",
    "zip_code": "3080"
  },
  "type": "Feature"
}
```

Importante:

- las coordenadas deben estar como `[lng, lat]`
- no usar `[lat, lng]`

## Patron actual de `farma_id`

Del dataset actual de Firebase:

- total de farmacias: `1297`
- IDs tipo `aaa`: desde `aaa001` hasta `aaa197`
- IDs numéricos: desde `198` hasta `1299`

Huecos detectados en la secuencia numérica:

- `344`
- `886`

Recomendación para nuevas altas de Esperanza:

- no reutilizar `344` ni `886`
- seguir desde `1300` en adelante

Propuesta de IDs para pendientes:

- `Marelli` → `1300`
- `Santillan` → `1301`
- `Loureyro` → `1302`
- `Paoli` → `1303`

## Pendientes

### 1. Marelli

Estado actual:

- figura en turnos de Esperanza
- no está cargada correctamente en Firebase para `localidad: ESPERANZA`
- hoy en la app no aparece en mapa porque no se puede resolver

Ubicación en turnos:

- `items[5].farmacias[1]`
- fecha: `2026-07-04`
- alias: `MARELLI`

Dato confirmado para cargar:

```json
{
  "name": "Farmacia MARELLI",
  "address": "S. DE IRIONDO 4150",
  "phone": "(03496) 15520200",
  "localidad": "ESPERANZA",
  "provincia": "SANTA FE",
  "zip_code": "3080",
  "farma_id": "1300",
  "version": "1.0",
  "geometry": {
    "coordinates": [-60.92494312105825, -31.431697500621045],
    "type": "Point"
  }
}
```

Pendiente:

- longitud
- latitud

Cuando exista en Firebase, dejar también:

- `farmaciaName: "Farmacia MARELLI"`

### 2. Santillan

Estado actual:

- alias presente en turnos
- `farmaciaName` vacío
- no aparece match en Firebase

Ubicación en turnos:

- `items[9].farmacias[1]`
- fecha: `2026-07-08`
- alias: `SANTILLAN`

Dato confirmado para cargar:

```json
{
  "name": "Farmacia SANTILLAN",
  "address": "PUEYRREDON 1475",
  "phone": "(03496) 517385",
  "localidad": "ESPERANZA",
  "provincia": "SANTA FE",
  "zip_code": "3080",
  "farma_id": "1301",
  "version": "1.0",
  "geometry": {
    "coordinates": [ -60.928942094976826, -31.445475299161647],
    "type": "Point"
  }
}
```

Pendiente:

- longitud
- latitud

Además completar en turnos:

- `farmaciaName: "Farmacia SANTILLAN"` o el nombre exacto que cargues

### 3. Loureyro

Estado actual:

- alias presente en turnos
- `farmaciaName` vacío
- no aparece match en Firebase

Ubicación en turnos:

- `items[10].farmacias[0]`
- fecha: `2026-07-09`
- alias: `LOUREYRO`

Dato confirmado para cargar:

```json
{
  "name": "Farmacia LOUREYRO",
  "address": "BERUTTI 906",
  "phone": "(03496) 431480 / (03496) 15521020",
  "localidad": "ESPERANZA",
  "provincia": "SANTA FE",
  "zip_code": "3080",
  "farma_id": "1302",
  "version": "1.0",
  "geometry": {
    "coordinates": [-60.92330839090117, -31.44775279782351],
    "type": "Point"
  }
}
```

Pendiente:

- longitud
- latitud

Además completar en turnos:

- `farmaciaName: "Farmacia LOUREYRO"` o el nombre exacto que cargues

### 4. Paoli

Estado actual:

- alias presente en turnos
- `farmaciaName` vacío
- no aparece match exacto en Firebase para Esperanza

Ubicación en turnos:

- `items[10].farmacias[1]`
- fecha: `2026-07-09`
- alias: `PAOLI`

Dato confirmado para cargar:

```json
{
  "name": "Farmacia PAOLI",
  "address": "BERUTTI 1874",
  "phone": "(03496) 15460122",
  "localidad": "ESPERANZA",
  "provincia": "SANTA FE",
  "zip_code": "3080",
  "farma_id": "1303",
  "version": "1.0",
  "geometry": {
    "coordinates": [-60.93309091945396, -31.445510496013924],
    "type": "Point"
  }
}
```

Pendiente:

- longitud
- latitud

Además completar en turnos:

- `farmaciaName: "Farmacia PAOLI"` o el nombre exacto que cargues

## Referencia útil del padrón actual de Esperanza

Estos nombres y direcciones sirven para validar coincidencias al cargar o corregir Firebase:

- `BÄR` → `CASTELLI 1028` → `(03496) 410559 / (03496) 15517044`
- `BARRIOS` → `S. IRIONDO 3043` → `(03496) 421567`
- `BIANCHINI` → `AV. CORDOBA 2725` → `(03496) 15556829 / (03496) 421865`
- `BORGOGNO` → `LEHMANN 2307` → `(03496) 429162 / (03496) 15567650`
- `DONALISIO` → `AVELLANEDA 1937` → `(03496) 422797`
- `FARMACIA JERARQUICOS` → `SARMIENTO 2307` → `(03496) 423482`
- `FAVARIN` → `RIVADAVIA 1494` → `(03496) 420771`
- `FERREYRA` → `GRAL. PAZ 3498` → `(03496) 423394`
- `FORTI` → `GUEMES 595` → `(03496) 410050`
- `FUENTES` → `MORENO 742` → `(03496) 426365 / (03496) 15561229`
- `GAMBOA` → `BELGRANO 2324` → `(03496) 422345`
- `HILAS` → `MITRE 2725` → `(03496) 410485`
- `LIMACHE` → `AV. CORDOBA 1624` → `(03496) 420088`
- `LONGONI` → `SAAVEDRA 1806` → `(03496) 425313 / (03496) 15652727`
- `LOUREYRO` → `BERUTTI 906` → `(03496) 431480 / (03496) 15521020`
- `MORELLI` → `RIVADAVIA 2002` → `(03496) 420912`
- `MARELLI` → `S. DE IRIONDO 4150` → `(03496) 15520200`
- `PAOLI` → `BERUTTI 1874` → `(03496) 15460122`
- `PERIN` → `LAVALLE 2098` → `(03496) 420446 / (03496) 15561791`
- `PIERUCCIONI` → `BALCARCE 1605` → `(03496) 424024`
- `RIERA` → `SIMON DE IRIONDO 3298` → `(03496) 464651`
- `SAD` → `SARMIENTO 2041` → `(03496) 421106`
- `SAUGY` → `AV. COLONIZADORES 09` → `(03496) 426922 / (03496) 15556951`
- `SANTILLAN` → `PUEYRREDON 1475` → `(03496) 517385`
- `SCHNEIDER C` → `AV. COLONIZADORES 957` → `(03496) 424704`
- `SCHNEIDER S` → `AV. CORDOBA 2251` → `(03496) 420834 / (03496) 15557210`
- `TARDIOLI` → `AV. ARGENTINA 1290` → `(03496) 423268`
- `TKACZYK` → `A. CASTELLANOS 782` → `(03496) 421999 / (03496) 15461600`
- `ZEHNDER` → `CULLEN 1332` → `(03496) 411555 / (03496) 15579215`
- `ZEBALLOS` → `RIVADAVIA 2669` → `(03496) 421755 / (03496) 15515420`
- `ZUQUELLI` → `AUFRANC 1447` → `(03496) 420466`
- `MUTUAL BOMBEROS` → `SARMIENTO 2255` → `(03496) 420074 / (03496) 15650359`

## Después de completar Firebase

Actualizar también los `farmaciaName` en:

- [`src/assets/data/turnos-esperanza.json`](/Users/nicoarato/Documents/github-projects/pharMaps-SFv2.0/src/assets/data/turnos-esperanza.json)

Valores pendientes:

- `items[5].farmacias[1].farmaciaName`
- `items[9].farmacias[1].farmaciaName`
- `items[10].farmacias[0].farmaciaName`
- `items[10].farmacias[1].farmaciaName`

## Criterio horario de Esperanza

Los turnos se interpretan así:

- desde `08:00` del día publicado
- hasta `08:00` del día siguiente

Ejemplo:

- turno del `2026-07-04`
- activo desde `2026-07-04T08:00:00-03:00`
- hasta `2026-07-05T08:00:00-03:00`
