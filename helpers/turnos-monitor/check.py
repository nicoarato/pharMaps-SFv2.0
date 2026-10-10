"""Consulta las fuentes públicas sin modificar los datos de la aplicación."""
import hashlib
import json
import os
import re
import subprocess
from datetime import datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
OUT = Path(os.environ.get("TURNOS_OUTPUT", "turnos-report"))


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1
        if tag == "a":
            self.links.extend(v for k, v in attrs if k == "href" and v)

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def download(url):
    response = subprocess.run([
        "curl", "--ipv4", "--location", "--fail", "--silent", "--show-error",
        "--connect-timeout", "15", "--max-time", "45", "--retry", "2",
        "--retry-delay", "3", "--max-filesize", "20000000",
        "--user-agent", "PharMaps-turnos-monitor/1.0", url,
    ], capture_output=True, timeout=160)
    if response.returncode:
        raise ValueError(response.stderr.decode(errors="replace").strip())
    return response.stdout


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    baseline_path = ROOT / "baseline.json"
    baseline = json.loads(baseline_path.read_text()) if baseline_path.exists() else {}
    report = {"checkedAt": datetime.now(ZoneInfo("America/Argentina/Cordoba")).isoformat(), "sources": []}
    sources = [
        ("santa-fe", "https://colfarsfe.org.ar/"),
        ("esperanza", "https://esperanza.tur.ar/2016/12/12/farmacias-de-turno/"),
    ]
    for city, url in sources:
        result = {"city": city, "url": url}
        try:
            html = download(url)
            (OUT / f"{city}.html").write_bytes(html)
            page = Page()
            page.feed(html.decode("utf-8"))
            if city == "santa-fe":
                links = sorted(set(urljoin(url, unescape(link)) for link in page.links
                                   if re.search(r"afiche.*turnos.*\.pdf(?:\?|$)", link, re.I)))
                if not links:
                    raise ValueError("No se encontró el afiche de turnos; revisar la fuente")
                documents = []
                for index, link in enumerate(links):
                    if urlparse(link).hostname != "colfarsfe.org.ar":
                        raise ValueError("El PDF apunta a un dominio inesperado")
                    pdf = download(link)
                    if not pdf.startswith(b"%PDF-"):
                        raise ValueError("El archivo descargado no es un PDF")
                    (OUT / f"santa-fe-{index}.pdf").write_bytes(pdf)
                    documents.append({"url": link, "sha256": hashlib.sha256(pdf).hexdigest()})
                result["documents"] = documents
                fingerprint = json.dumps(documents, sort_keys=True).encode()
                result["note"] = "PDF detectado; mes, contenido y turnos requieren revisión/OCR."
            else:
                text = re.sub(r"\s+", " ", " ".join(page.parts))
                start = re.search(r"Turnos\s+[A-Za-zÁÉÍÓÚáéíóú]+\s+20\d{2}", text)
                end = text.find("CONTACTOS DE LAS FARMACIAS", start.start() if start else 0)
                if not start or end < start.end():
                    raise ValueError("No se reconoció el calendario de Esperanza")
                calendar = text[start.start():end].strip()
                dates = sorted(set(re.findall(r"\b\d{2}/\d{2}/20\d{2}\b", calendar)))
                if not dates:
                    raise ValueError("Calendario sin fechas reconocibles")
                (OUT / "esperanza-calendario.txt").write_text(calendar + "\n")
                result.update(title=start.group(), dates=dates)
                result["note"] = "Fechas detectadas; validar mes, cobertura y nombres antes de importar."
                fingerprint = calendar.encode()
            result["sha256"] = hashlib.sha256(fingerprint).hexdigest()
            previous = baseline.get(city)
            result["status"] = "baseline-missing" if not previous else "unchanged" if previous == result["sha256"] else "changed"
        except Exception as error:
            result.update(status="error", error=str(error))
        report["sources"].append(result)
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    lines = ["## Consulta de turnos: Santa Fe y Esperanza", "", f"Consulta: {report['checkedAt']}", "",
             "Comparación contra la referencia inicial. No se actualizan los JSON ni se confirma vigencia automáticamente.", ""]
    for source in report["sources"]:
        lines.append(f"- {source['city']}: **{source['status']}** — {source.get('title', source.get('error', source.get('note', '')))}")
        for document in source.get("documents", []):
            lines.append(f"  - PDF: {document['url']}")
    summary = "\n".join(lines) + "\n"
    (OUT / "summary.md").write_text(summary)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as file:
            file.write(summary)
    print(summary)
    if any(source["status"] == "error" for source in report["sources"]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
