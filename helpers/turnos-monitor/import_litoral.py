"""Respaldo diario de El Litoral cuando no hay un afiche del mes vigente."""
import argparse
import copy
import json
import os
import re
import subprocess
from datetime import date, datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

from check import download
from import_santa_fe import MONTHS, ROOT, TARGET, norm, ranges

SOURCES = {
    "santa-fe": ("Santa Fe", "https://servicios.ellitoral.com/seccion/farmacias/"),
    "santo-tome": ("Santo Tome", "https://servicios.ellitoral.com/seccion/farmacias-de-turno-santo-tome"),
}


class Node:
    def __init__(self, tag="", attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def text(self):
        return " ".join(c.text() if isinstance(c, Node) else c for c in self.children)

    def find(self, predicate):
        return ([self] if predicate(self) else []) + [n for c in self.children if isinstance(c, Node) for n in c.find(predicate)]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.root = Node()
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def human_dates(text):
    result = []
    pattern = r"(\d{1,2})\s*[°º]?\s+de\s+(\w+)\s+del?\s+(20\d{2})"
    for day, month, year in re.findall(pattern, text, re.I):
        if norm(month) not in MONTHS:
            raise ValueError("Mes desconocido en El Litoral")
        result.append(date(int(year), MONTHS.index(norm(month)) + 1, int(day)))
    return result


def convert(html, locality, today, catalog):
    page = Page()
    page.feed(html)
    headings = page.root.find(lambda n: n.tag == "h3")
    if not any(norm(n.text()) == "FARMACIASDETURNOEN" + norm(locality) for n in headings):
        raise ValueError("Localidad inesperada en El Litoral")
    dates_by_group = {}
    for key in ("hoy", "siguiente"):
        nodes = page.root.find(lambda n: n.attrs.get("id") == "turno_" + key)
        if len(nodes) != 1:
            raise ValueError("Encabezado de fechas ausente o duplicado")
        text = nodes[0].text()
        if not re.search(r"8:00\s*hs", text):
            raise ValueError("Horario inesperado en El Litoral")
        dates_by_group[key] = human_dates(text)
    current, following = dates_by_group["hoy"], dates_by_group["siguiente"]
    if len(current) != 2 or current[1] != current[0] + timedelta(days=1) or following != [current[1]]:
        raise ValueError("Rangos diarios inesperados en El Litoral")
    if current[0] != today:
        raise ValueError(f"El Litoral está desactualizado: {current[0]}, se esperaba {today}")
    lookup = {norm(p["nombre"]): p for p in catalog}
    turns, warnings = [], []
    for key, start in (("hoy", current[0]), ("siguiente", current[1])):
        rows = page.root.find(lambda n: "farmacias_" + key in n.attrs.get("class", "").split())
        if not rows:
            raise ValueError(f"Sin farmacias para {key}")
        pharmacies, seen = [], set()
        for row in rows:
            fields = []
            for column in range(1, 4):
                nodes = row.find(lambda n: n.attrs.get("id") == f"columna{column}")
                if len(nodes) != 1:
                    raise ValueError("Fila de farmacia incompleta o duplicada")
                fields.append(re.sub(r"\s+", " ", nodes[0].text()).strip())
            name, address, phone = fields
            canonical = lookup.get(norm(name))
            if not canonical or norm(name) in seen:
                raise ValueError(f"Farmacia desconocida o duplicada: {name}")
            digits = re.sub(r"\D", "", phone)
            phones = [re.sub(r"\D", "", p) for p in canonical["telefono"].split("/")]
            phone_match = any(len(p) >= 6 and p in digits for p in phones)
            numbers = re.findall(r"\b\d{3,5}\b", canonical["direccion"])
            address_match = any(n in re.findall(r"\b\d{3,5}\b", address) for n in numbers)
            if not phone_match and not address_match:
                raise ValueError(f"No se pudo corroborar dirección ni teléfono: {name}")
            if not phone_match or not address_match:
                warnings.append({"nombre": canonical["nombre"], "direccionPublicada": address, "telefonoPublicado": phone})
            seen.add(norm(name))
            pharmacy = copy.deepcopy(canonical)
            pharmacy.pop("soloRangos", None)
            pharmacies.append(pharmacy)
        turns.append({"turno": f"El Litoral {start}", "rangos": ranges([(start, start + timedelta(days=1))]), "farmacias": pharmacies})
    return turns, warnings


def merge(existing, locality, turns, url):
    """Sustituir solo fechas del respaldo; conservar las otras fechas y localidades."""
    updated = copy.deepcopy(existing)
    for turn in turns:
        month = turn["rangos"][0]["desde"][:7]
        entry = next((x for x in updated if x["localidad"] == locality and x["mes"] == month), None)
        if entry is not None and entry.get("fuente", {}).get("tipo") != "html-litoral-diario":
            # Un calendario previamente revisado tiene prioridad sobre el respaldo diario.
            continue
        if entry is None:
            entry = {"localidad": locality, "mes": month, "turnos": [], "fuente": {
                "tipo": "html-litoral-diario", "fechaReferencia": month,
                "nota": f"Respaldo diario de El Litoral; cobertura parcial, solo fechas publicadas. {url}"}}
            updated.append(entry)
        start = turn["rangos"][0]["desde"]
        for previous in entry["turnos"]:
            previous["rangos"] = [r for r in previous["rangos"] if r["desde"] != start]
        entry["turnos"] = [t for t in entry["turnos"] if t["rangos"]] + [copy.deepcopy(turn)]
        entry["turnos"].sort(key=lambda t: t["rangos"][0]["desde"])
    return updated


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--locality", choices=SOURCES, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    today = datetime.now(ZoneInfo("America/Argentina/Cordoba")).date()
    locality, url = SOURCES[args.locality]
    folder = Path("turnos-report")
    folder.mkdir(exist_ok=True)
    report = {"localidad": locality, "source": url, "status": "error", "changed": False}
    try:
        pdf_report_path = folder / f"{args.locality}-ocr/review.json"
        pdf = json.loads(pdf_report_path.read_text()) if pdf_report_path.exists() else {}
        month = today.strftime("%Y-%m")
        if pdf.get("month") == month and (pdf.get("status") == "validated" or (
                pdf.get("status") == "needs-review" and not any(i["type"] == "month" for i in pdf.get("issues", [])))):
            report.update(status="pdf-available", note="Se conserva la importación o revisión del afiche vigente")
        else:
            raw = download(url)
            (folder / f"{args.locality}-litoral.html").write_bytes(raw)
            try:
                html = raw.decode("utf-8")
            except UnicodeDecodeError:
                html = raw.decode("cp1252")
            catalog = json.loads((ROOT / f"{args.locality}-farmacias.json").read_text())
            turns, warnings = convert(html, locality, today, catalog)
            existing = json.loads(TARGET.read_text())
            updated = merge(existing, locality, turns, url)
            changed = updated != existing
            serialized = json.dumps(updated, ensure_ascii=False, indent=2) + "\n"
            (folder / f"{args.locality}-litoral-candidate.json").write_text(serialized)
            if args.apply and changed:
                temporary = TARGET.with_suffix(".json.tmp")
                temporary.write_text(serialized)
                temporary.replace(TARGET)
            report.update(status="validated", changed=changed, applied=args.apply and changed,
                          dates=[t["rangos"][0]["desde"][:10] for t in turns], warnings=warnings)
    except (ValueError, OSError, KeyError, subprocess.TimeoutExpired) as error:
        report["error"] = str(error)
    (folder / f"{args.locality}-litoral-import.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
            summary.write(f"\n### Respaldo El Litoral: {locality}\n\n```json\n{json.dumps(report, ensure_ascii=False, indent=2)}\n```\n")
    if report["status"] == "error":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
