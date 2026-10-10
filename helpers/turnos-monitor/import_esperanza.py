"""Genera turnos de Esperanza únicamente después de validar el mes completo."""
import argparse
import calendar
import json
import re
import unicodedata
from datetime import date, timedelta, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
TARGET = ROOT.parents[1] / "src/assets/data/turnos-esperanza.json"
MONTHS = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split()


def normalize(name):
    text = unicodedata.normalize("NFKD", name)
    return re.sub(r"[^A-Z0-9]", "", "".join(c for c in text if not unicodedata.combining(c)).upper())


def convert(text, month, registry, retrieved):
    if not re.fullmatch(r"20\d{2}-(0[1-9]|1[0-2])", month):
        raise ValueError("Mes esperado inválido")
    year, number = map(int, month.split("-"))
    header = re.match(r"\s*Turnos\s+(\w+)\s+(20\d{2})\s*", text, re.I)
    if not header or header[1].lower() != MONTHS[number - 1] or int(header[2]) != year:
        raise ValueError(f"La publicación no corresponde al mes esperado {month}")
    matches = list(re.finditer(r"\b(\d{2})/(\d{2})/(20\d{2})\b", text))
    if not matches or text[header.end():matches[0].start()].strip():
        raise ValueError("Formato de calendario inesperado")
    lookup = {normalize(alias): (alias, name) for alias, name in registry.items()}
    # Variante ortográfica observada en la fuente; no se usa coincidencia difusa.
    lookup["TKACZYCK"] = lookup["TKACZYK"]
    items, seen, unknown = [], set(), set()
    for index, match in enumerate(matches):
        day = date(int(match[3]), int(match[2]), int(match[1]))
        if day.strftime("%Y-%m") != month or day in seen:
            raise ValueError(f"Fecha ajena al mes o duplicada: {day}")
        seen.add(day)
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        names = text[match.end():end].strip().lstrip("—–-:").strip().split("/")
        pharmacies = []
        for name in names:
            key = normalize(name)
            if key not in lookup:
                unknown.add(name.strip() or "(nombre vacío)")
                continue
            alias, canonical = lookup[key]
            if any(f["alias"] == alias for f in pharmacies):
                raise ValueError(f"Farmacia duplicada el {day}: {alias}")
            pharmacies.append({"alias": alias, "farmaciaName": canonical})
        tomorrow = day + timedelta(days=1)
        items.append({"date": day.isoformat(), "rangos": [{
            "desde": f"{day}T08:00:00-03:00", "hasta": f"{tomorrow}T08:00:00-03:00"
        }], "farmacias": pharmacies})
    expected = {date(year, number, n) for n in range(1, calendar.monthrange(year, number)[1] + 1)}
    if seen != expected:
        raise ValueError("Calendario incompleto; faltan fechas: " + ", ".join(map(str, sorted(expected - seen))))
    if unknown:
        raise ValueError("Farmacias desconocidas; requieren revisión: " + ", ".join(sorted(unknown)))
    return {"source": {"name": "Turismo Esperanza",
        "url": "https://esperanza.tur.ar/2016/12/12/farmacias-de-turno/", "retrievedAt": retrieved},
        "localidad": "ESPERANZA", "turnoHorario": "08:00 a 08:00",
        "items": sorted(items, key=lambda item: item["date"])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="turnos-report/esperanza-calendario.txt")
    parser.add_argument("--month", default=datetime.now(ZoneInfo("America/Argentina/Cordoba")).strftime("%Y-%m"))
    parser.add_argument("--apply", action="store_true", help="Actualizar JSON local si todas las validaciones pasan")
    args = parser.parse_args()
    folder = Path("turnos-report")
    folder.mkdir(exist_ok=True)
    report = {"month": args.month, "status": "error", "changed": False}
    try:
        registry = json.loads((ROOT / "esperanza-farmacias.json").read_text())
        result = convert(Path(args.input).read_text(), args.month, registry,
                         datetime.now(ZoneInfo("America/Argentina/Cordoba")).date().isoformat())
        current = json.loads(TARGET.read_text())
        if any(item["date"][:7] > args.month for item in current["items"]):
            raise ValueError("La importación reemplazaría datos de un mes posterior")
        changed = any(current.get(key) != result[key] for key in ("localidad", "turnoHorario", "items"))
        serialized = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
        (folder / "esperanza-candidate.json").write_text(serialized)
        if args.apply and changed:
            temporary = TARGET.with_suffix(".json.tmp")
            temporary.write_text(serialized)
            temporary.replace(TARGET)
        report.update(status="validated", changed=changed, applied=args.apply and changed, days=len(result["items"]))
    except (ValueError, OSError, KeyError) as error:
        report["error"] = str(error)
    (folder / "esperanza-import.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report["status"] == "error":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
