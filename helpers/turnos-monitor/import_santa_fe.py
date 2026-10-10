"""Conciliación de lecturas OCR; conserva alternativas y nunca oculta dudas."""
import argparse
import calendar
import copy
import json
import re
import unicodedata
from collections import Counter
from datetime import date, timedelta, datetime
from difflib import SequenceMatcher
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
TARGET = ROOT.parents[1] / "src/assets/data/turnos-colegio-agosto-2026.json"
LABELS = "PRIMER SEGUNDO TERCER CUARTO QUINTO SEXTO SEPTIMO OCTAVO NOVENO DECIMO UNDECIMO DUODECIMO".split()
MONTHS = "ENERO FEBRERO MARZO ABRIL MAYO JUNIO JULIO AGOSTO SEPTIEMBRE OCTUBRE NOVIEMBRE DICIEMBRE".split()


def norm(text):
    return re.sub(r"[^A-Z0-9]", "", "".join(c for c in unicodedata.normalize("NFKD", text.upper()) if not unicodedata.combining(c)))


def similarity(a, b):
    return SequenceMatcher(None, norm(a), norm(b)).ratio()


def dates(text, year, month):
    result = []
    for day, number in re.findall(r"(?<!\d)(\d{1,2})\s*/\s*(\d{1,2})(?!\d)", text):
        day, number = int(day), int(number)
        # El afiche incluye rangos que cruzan los límites del mes/año.
        actual_year = year - 1 if month == 1 and number == 12 else year + 1 if month == 12 and number == 1 else year
        try:
            result.append(date(actual_year, number, day))
        except ValueError:
            return []
    return result


def range_pairs(text, year, month):
    found = dates(text, year, month)
    if len(found) % 2 or not found:
        return ()
    pairs = tuple(zip(found[::2], found[1::2]))
    return pairs if all(end - start == timedelta(days=1) for start, end in pairs) else ()


def ranges(pairs):
    return [{"desde": f"{start}T08:00:00-03:00", "hasta": f"{end}T08:00:00-03:00"} for start, end in pairs]


def rank(text, catalog):
    # Los puntos separan nombre y dirección. Si OCR pierde los puntos,
    # evaluar prefijos del nombre y corroborar con dirección/teléfono.
    first = re.split(r"\.{2,}|[—_]", text)[0].strip()
    tokens = re.findall(r"[\wÁÉÍÓÚáéíóú]+", first)
    candidates = []
    digits = re.sub(r"\D", "", text)
    numbers = set(re.findall(r"\b\d{3,5}\b", text))
    for pharmacy in catalog:
        length = len(pharmacy["nombre"].split())
        name_score = max((similarity(" ".join(tokens[:n]), pharmacy["nombre"]) for n in range(1, min(len(tokens), length + 1) + 1)), default=0)
        address_numbers = re.findall(r"\b\d{3,5}\b", pharmacy["direccion"])
        address = bool((address_numbers and any(value in numbers for value in address_numbers)) or norm(pharmacy["direccion"]) in norm(text))
        phones = [re.sub(r"\D", "", p) for p in pharmacy["telefono"].split("/")]
        phone = any(len(p) >= 6 and p in digits for p in phones)
        score = .65 * name_score + .20 * address + .15 * phone
        candidates.append({"nombre": pharmacy["nombre"], "score": round(score, 4),
                           "nameSimilarity": round(name_score, 4), "addressMatches": address, "phoneMatches": phone})
    return sorted(candidates, key=lambda item: item["score"], reverse=True)[:5]


def merge_lines(block):
    rows = []
    for reading in block["readings"]:
        for line in reading["lines"]:
            y = (line["bbox"]["y0"] + line["bbox"]["y1"]) / 2
            row = next((r for r in rows if abs(r["y"] - y) < 14), None)
            if row is None:
                row = {"y": y, "readings": []}
                rows.append(row)
            row["readings"].append({"method": reading["method"], "text": line["text"].strip(),
                                    "confidence": line["confidence"], "bbox": line["bbox"]})
    # PSM 11 divide una misma fila en varios segmentos: recomponer por X.
    for row in rows:
        combined = []
        for method in sorted(set(r["method"] for r in row["readings"])):
            parts = sorted((r for r in row["readings"] if r["method"] == method), key=lambda r: r["bbox"]["x0"])
            combined.append({"method": method, "text": " ".join(r["text"] for r in parts),
                             "confidence": sum(r["confidence"] for r in parts) / len(parts)})
        row["readings"] = combined
    return sorted(rows, key=lambda row: row["y"])


def reconcile(ocr, month, catalog):
    year, number = map(int, month.split("-"))
    issues, details, turns = [], [], []
    header = norm(ocr["header"]["text"])
    if header != MONTHS[number - 1] + str(year):
        issues.append({"type": "month", "readings": [ocr["header"]["text"]], "expected": month})
    if norm(ocr.get("locality", {}).get("text", "")) != "SANTAFE":
        issues.append({"type": "layout", "message": "No se reconoció la etiqueta SANTA FE"})
    if len(ocr["blocks"]) != 12 or sorted(b["id"] for b in ocr["blocks"]) != list(range(1, 13)):
        issues.append({"type": "layout", "message": "Se requieren exactamente 12 bloques distintos"})
    lookup = {p["nombre"]: p for p in catalog}
    for block in ocr["blocks"]:
        turn = {"turno": LABELS[block["id"] - 1] + " TURNO", "rangos": [], "farmacias": []}
        rows = merge_lines(block)
        for band in block.get("inkBands", []):
            center = (band["y0"] + band["y1"]) / 2
            if not any(abs(row["y"] - center) <= 20 for row in rows):
                issues.append({"type": "unread-row", "block": block["id"], "band": band,
                               "message": "Hay tinta en una fila que ninguna lectura OCR reconoció"})
        detail = {"id": block["id"], "image": block["image"], "rows": [], "dateReadings": []}
        detail["ignoredBorders"] = []
        header_rows, pharmacy_rows, notes = [], [], []
        for row in rows:
            texts = [r["text"] for r in row["readings"]]
            crop_height = ocr["rendered"]["height"] * block["region"]["h"]
            touches_edge = any(line["bbox"]["x0"] == 0 and abs((line["bbox"]["y0"] + line["bbox"]["y1"]) / 2 - row["y"]) < 14
                               for reading in block["readings"] for line in reading["lines"])
            if row["y"] > crop_height * .94 and touches_edge:
                detail["ignoredBorders"].append(row)
                continue
            if row["y"] < 165:
                header_rows.append(row)
            elif any(norm(t).startswith(("LAFARM", "LAFAR", "LAFAM", "AFARM")) for t in texts):
                notes.append(row)
            elif any(re.search(r"\d{3}", t) for t in texts):
                pharmacy_rows.append(row)
            elif any(re.search(r"[A-Za-zÁÉÍÓÚáéíóú]{4,}", t) for t in texts):
                issues.append({"type": "unclassified-row", "block": block["id"], "readings": texts})
        for method in sorted(set(r["method"] for row in header_rows for r in row["readings"])):
            text = " ".join(r["text"] for row in header_rows for r in row["readings"] if r["method"] == method)
            parsed = range_pairs(text, year, number)
            detail["dateReadings"].append({"method": method, "text": text, "pairs": [[str(a), str(b)] for a, b in parsed]})
        votes = Counter(tuple(tuple(p) for p in r["pairs"]) for r in detail["dateReadings"] if r["pairs"])
        selected = votes.most_common(1)
        if selected and selected[0][1] >= 2 and len(selected[0][0]) in (2, 3):
            turn["rangos"] = ranges([(date.fromisoformat(a), date.fromisoformat(b)) for a, b in selected[0][0] if a.startswith(month)])
        else:
            issues.append({"type": "dates", "block": block["id"], "alternatives": detail["dateReadings"]})
        resolved_names = set()
        # Las direcciones partidas se unen solo si no se reconoce un nombre nuevo
        # y el teléfono de la continuación confirma la farmacia de la fila anterior.
        merged = []
        for row in pharmacy_rows:
            current_best = [rank(r["text"], catalog)[0] for r in row["readings"]]
            if merged and all(c["nameSimilarity"] < .75 for c in current_best):
                previous_best = rank(merged[-1]["readings"][0]["text"], catalog)[0]
                p = lookup[previous_best["nombre"]]
                phones = [re.sub(r"\D", "", v) for v in p["telefono"].split("/")]
                if any(any(len(v) >= 6 and v in re.sub(r"\D", "", r["text"]) for v in phones) for r in row["readings"]):
                    for previous in merged[-1]["readings"]:
                        continuation = next((r for r in row["readings"] if r["method"] == previous["method"]), None)
                        if continuation:
                            previous["text"] += " " + continuation["text"]
                    merged[-1]["continuation"] = row
                    continue
            merged.append(row)
        pharmacy_rows = merged
        for row in pharmacy_rows:
            row["alternatives"] = []
            best_by_name = {}
            support = Counter()
            for reading in row["readings"]:
                ranked = rank(reading["text"], catalog)
                row["alternatives"].append({**reading, "candidates": ranked})
                if ranked:
                    support[ranked[0]["nombre"]] += 1
                for candidate in ranked:
                    if candidate["score"] > best_by_name.get(candidate["nombre"], {}).get("score", -1):
                        best_by_name[candidate["nombre"]] = candidate
            ranked = sorted(best_by_name.values(), key=lambda c: c["score"], reverse=True)
            first = ranked[0] if ranked else {}
            margin = first.get("score", 0) - (ranked[1]["score"] if len(ranked) > 1 else 0)
            best_name_similarity = max((c["nameSimilarity"] for r in row["alternatives"] for c in r["candidates"] if c["nombre"] == first.get("nombre")), default=0)
            resolved = bool(first and best_name_similarity >= .82 and first["score"] >= .80 and margin >= .10
                            and support[first["nombre"]] >= 2 and (first["addressMatches"] or first["phoneMatches"]))
            row["resolved"] = first["nombre"] if resolved else None
            row["candidateSummary"] = ranked[:5]
            if resolved and first["nombre"] not in resolved_names:
                resolved_names.add(first["nombre"])
                turn["farmacias"].append(copy.deepcopy(lookup[first["nombre"]]))
                if not first["addressMatches"]:
                    issues.append({"type": "address", "block": block["id"], "nombre": first["nombre"], "readings": row["alternatives"]})
                if not first["phoneMatches"]:
                    issues.append({"type": "phone", "block": block["id"], "nombre": first["nombre"], "readings": row["alternatives"]})
            else:
                issues.append({"type": "pharmacy" if not resolved else "duplicate-pharmacy", "block": block["id"],
                               "y": row["y"], "readings": row["alternatives"], "candidates": ranked[:5]})
            detail["rows"].append(row)
        detail["notes"] = notes
        for note in notes:
            alternatives = []
            for reading in note["readings"]:
                pairs = range_pairs(reading["text"], year, number)
                text = norm(reading["text"])
                matched = [name for name in resolved_names if norm(name) in text]
                # Abreviatura usada por el afiche, sin confundir con Burgués Romano.
                if "WBURGUES" in text and "Wagner Burgues" in resolved_names:
                    matched = ["Wagner Burgues"]
                if pairs and len(matched) == 1:
                    alternatives.append((matched[0], tuple((str(a), str(b)) for a, b in pairs)))
            votes = Counter(alternatives)
            if votes and votes.most_common(1)[0][1] >= 2:
                (name, pairs), _ = votes.most_common(1)[0]
                restricted = ranges([(date.fromisoformat(a), date.fromisoformat(b)) for a, b in pairs])
                if all(r in turn["rangos"] for r in restricted):
                    next(p for p in turn["farmacias"] if p["nombre"] == name)["soloRangos"] = restricted
                    note["resolved"] = {"nombre": name, "soloRangos": restricted}
                else:
                    issues.append({"type": "exception-dates", "block": block["id"], "readings": note["readings"]})
            else:
                issues.append({"type": "exception", "block": block["id"], "readings": note["readings"],
                               "alternatives": alternatives})
        if not pharmacy_rows:
            issues.append({"type": "empty-block", "block": block["id"]})
        details.append(detail)
        turns.append(turn)
    starts = [r["desde"][:10] for t in turns for r in t["rangos"] if r["desde"].startswith(month)]
    expected = {f"{month}-{day:02}" for day in range(1, calendar.monthrange(year, number)[1] + 1)}
    if set(starts) != expected or len(starts) != len(set(starts)):
        issues.append({"type": "coverage", "missing": sorted(expected - set(starts)), "duplicates": [d for d, n in Counter(starts).items() if n > 1]})
    item = {"localidad": "Santa Fe", "mes": month, "turnos": turns,
            "fuente": {"tipo": "pdf-ocr-validado" if not issues else "pdf-ocr-candidato",
                       "fechaReferencia": month, "nota": "OCR en tres variantes; nombres conciliados con catálogo, restricciones de fechas y revisión de alternativas."}}
    return item, {"month": month, "status": "validated" if not issues else "needs-review", "issues": issues, "blocks": details,
                  "metrics": {"rows": sum(len(b["rows"]) for b in details), "resolvedRows": sum(bool(r["resolved"]) for b in details for r in b["rows"]),
                              "exceptions": sum(len(b["notes"]) for b in details), "resolvedExceptions": sum(bool(n.get("resolved")) for b in details for n in b["notes"])}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="turnos-report/santa-fe-ocr/ocr.json")
    parser.add_argument("--month", default=datetime.now(ZoneInfo("America/Argentina/Cordoba")).strftime("%Y-%m"))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    folder = Path(args.input).parent
    folder.mkdir(parents=True, exist_ok=True)
    try:
        catalog = json.loads((ROOT / "santa-fe-farmacias.json").read_text())
        candidate, report = reconcile(json.loads(Path(args.input).read_text()), args.month, catalog)
        existing = json.loads(TARGET.read_text())
        old = next((x for x in existing if x["localidad"] == "Santa Fe" and x["mes"] == args.month), None)
        report["changed"] = old is None or old["turnos"] != candidate["turnos"]
        report["applied"] = False
        (folder / "candidate.json").write_text(json.dumps(candidate, ensure_ascii=False, indent=2) + "\n")
        if args.apply and report["status"] == "validated" and report["changed"]:
            if any(x["mes"] > args.month for x in existing if x["localidad"] == "Santa Fe"):
                raise ValueError("No reemplazar calendarios posteriores")
            updated = [x for x in existing if not (x["localidad"] == "Santa Fe" and x["mes"] == args.month)] + [candidate]
            tmp = TARGET.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n")
            tmp.replace(TARGET)
            report["applied"] = True
    except (ValueError, OSError, KeyError, IndexError) as error:
        report = {"status": "error", "error": str(error), "changed": False, "applied": False}
    (folder / "review.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    lines = ["# Lectura del afiche de Santa Fe", "", f"Estado: {report['status']}", "",
             "Las puntuaciones son similitudes de texto, no probabilidades de acierto.", ""]
    for issue in report.get("issues", []):
        lines.extend([f"## {issue['type']} — bloque {issue.get('block', 'general')}", "",
                      "```json", json.dumps(issue, ensure_ascii=False, indent=2), "```", ""])
    (folder / "review.md").write_text("\n".join(lines) + "\n")
    # Las dudas no bloquean el procesamiento: preparar evidencia para un PR borrador.
    if report["status"] == "needs-review":
        review_dir = ROOT.parents[1] / "turnos-review/santa-fe" / args.month
        review_dir.mkdir(parents=True, exist_ok=True)
        summary = {k: v for k, v in report.items() if k != "blocks"}
        summary["sourcePdf"] = json.loads(Path(args.input).read_text())["source"]
        (review_dir / "review.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
        (review_dir / "README.md").write_text("Candidato incompleto para revisión; no se importa en la app.\n\n" + "\n".join(lines))
        (review_dir / "candidate.json").write_text(json.dumps(candidate, ensure_ascii=False, indent=2) + "\n")
        for block in {issue.get("block") for issue in report["issues"]} - {None}:
            image = folder / f"turno-{block}.png"
            if image.exists():
                import shutil
                shutil.copyfile(image, review_dir / image.name)
    print(json.dumps({k: v for k, v in report.items() if k not in ("blocks", "issues")}, ensure_ascii=False, indent=2))
    print(f"Dudas: {len(report.get('issues', []))}; informe: {folder / 'review.md'}")
    if report["status"] == "error":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
