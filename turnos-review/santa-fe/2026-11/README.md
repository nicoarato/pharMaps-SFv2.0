Candidato incompleto para revisión; no se importa en la app.

# Lectura del afiche de Santa Fe

Estado: needs-review

Las puntuaciones son similitudes de texto, no probabilidades de acierto.

## month — bloque general

```json
{
  "type": "month",
  "readings": [
    "OCTUBRE 2026\n"
  ],
  "expected": "2026-11"
}
```

## exception-dates — bloque 1

```json
{
  "type": "exception-dates",
  "block": 1,
  "readings": [
    {
      "method": "binarizado",
      "text": "La farmacia Azanza estará de turno sólo del 02/10 al 03/10.",
      "confidence": 95.0
    },
    {
      "method": "disperso",
      "text": "La farmacia Azanza estará de turno sólo del 02/10 al 03/10.",
      "confidence": 95.0
    },
    {
      "method": "original",
      "text": "La farmacia Azanza estará de turno sólo del 02/10 al 03/10.",
      "confidence": 95.0
    }
  ]
}
```

## exception-dates — bloque 2

```json
{
  "type": "exception-dates",
  "block": 2,
  "readings": [
    {
      "method": "binarizado",
      "text": "La farmacia Bordignon estará de tumo sólo del 03/10 al 04/10.",
      "confidence": 93.0
    },
    {
      "method": "disperso",
      "text": "La farmacia Bordignon estará de turno sólo del 03/10 al 04/10.",
      "confidence": 94.0
    },
    {
      "method": "original",
      "text": "La farmacia Bordignon estará de turno sólo del 03/10 al 04/10.",
      "confidence": 94.0
    }
  ]
}
```

## exception-dates — bloque 3

```json
{
  "type": "exception-dates",
  "block": 3,
  "readings": [
    {
      "method": "binarizado",
      "text": "La farmacia Asirari estará de turno sólo del 04/10 al 05/10.",
      "confidence": 92.0
    },
    {
      "method": "disperso",
      "text": "La farmacia Asinari estará de turno sólo del 04/10 al 05/10.",
      "confidence": 94.0
    },
    {
      "method": "original",
      "text": "La farmacia Asinari estará de turno sólo del 04/10 al 05/10.",
      "confidence": 94.0
    }
  ]
}
```

## exception-dates — bloque 9

```json
{
  "type": "exception-dates",
  "block": 9,
  "readings": [
    {
      "method": "binarizado",
      "text": "a farmacia García estará de tuno sólo del 10/10 al 11/10.",
      "confidence": 72.0
    },
    {
      "method": "disperso",
      "text": "a farmacia García estará de turno sólo del 10/10 al 11/10.",
      "confidence": 82.0
    },
    {
      "method": "original",
      "text": "a farmacia García estará de turno sólo del 10/10 al 11/10.",
      "confidence": 82.0
    }
  ]
}
```

## exception-dates — bloque 10

```json
{
  "type": "exception-dates",
  "block": 10,
  "readings": [
    {
      "method": "binarizado",
      "text": "La farmacia Bosch estará de turno sólo del 11/10al 12/10.",
      "confidence": 89.0
    },
    {
      "method": "disperso",
      "text": "La farmacia Bosch estará de turno sólo del 11/10 al 12/10.",
      "confidence": 92.0
    },
    {
      "method": "original",
      "text": "La farmacia Bosch estará de turno sólo del 11/10 al 12/10.",
      "confidence": 92.0
    }
  ]
}
```

## exception-dates — bloque 12

```json
{
  "type": "exception-dates",
  "block": 12,
  "readings": [
    {
      "method": "binarizado",
      "text": "La farm. W.Burgués estará de turno sólo del 01/10 al 02/10.",
      "confidence": 93.0
    },
    {
      "method": "disperso",
      "text": "La farm. W.Burgués estará de turno sólo del 01/10 al 02/10.",
      "confidence": 95.0
    },
    {
      "method": "original",
      "text": "La farm. W.Burgués estará de turno sólo del 01/10 al 02/10.",
      "confidence": 95.0
    }
  ]
}
```

## exception-dates — bloque 12

```json
{
  "type": "exception-dates",
  "block": 12,
  "readings": [
    {
      "method": "binarizado",
      "text": "La farmacia Zentner estará de turno sólo del 01/10 al 02/10.",
      "confidence": 95.0
    },
    {
      "method": "disperso",
      "text": "La farmacia Zentner estará de turno sólo del 01/10 al 02/10.",
      "confidence": 93.0
    },
    {
      "method": "original",
      "text": "La farmacia Zentner estará de turno sólo del 01/10 al 02/10.",
      "confidence": 93.0
    }
  ]
}
```

## coverage — bloque general

```json
{
  "type": "coverage",
  "missing": [
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
    "2026-11-08",
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
    "2026-11-15",
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
    "2026-11-22",
    "2026-11-23",
    "2026-11-24",
    "2026-11-25",
    "2026-11-26",
    "2026-11-27",
    "2026-11-28",
    "2026-11-29",
    "2026-11-30"
  ],
  "duplicates": []
}
```
