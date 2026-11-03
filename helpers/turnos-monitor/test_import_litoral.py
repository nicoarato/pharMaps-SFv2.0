import contextlib
import copy
import io
import json
import os
import sys
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch

import import_litoral
from import_litoral import convert, merge, SOURCES

ROOT = Path(__file__).resolve().parent


class LitoralTests(unittest.TestCase):
    def setUp(self):
        self.html = (ROOT / "fixtures/litoral-santa-fe-2026-11-02.html").read_text()
        self.catalog = json.loads((ROOT / "santa-fe-farmacias.json").read_text())
        self.today = date(2026, 11, 2)

    def test_real_pages(self):
        for slug, (locality, _) in SOURCES.items():
            html = (ROOT / f"fixtures/litoral-{slug}-2026-11-02.html").read_text()
            catalog = json.loads((ROOT / f"{slug}-farmacias.json").read_text())
            turns, warnings = convert(html, locality, self.today, catalog)
            self.assertEqual([len(t["farmacias"]) for t in turns], [11, 12] if slug == "santa-fe" else [3, 3])
            self.assertEqual(turns[0]["rangos"][0]["desde"], "2026-11-02T08:00:00-03:00")
            self.assertEqual(turns[1]["rangos"][0]["hasta"], "2026-11-04T08:00:00-03:00")
            if slug == "santo-tome":
                self.assertEqual(turns[0]["farmacias"][1]["direccion"], "25 de Mayo 1878")
                self.assertTrue(any(w["nombre"] == "Firmani" for w in warnings))

    def test_reject_stale_locality_missing_rows_unknown_and_duplicates(self):
        with self.assertRaises(ValueError):
            convert(self.html, "Santa Fe", date(2026, 11, 3), self.catalog)
        with self.assertRaises(ValueError):
            convert(self.html, "Santo Tome", self.today, self.catalog)
        for html in [self.html.replace("Barrientos", "Desconocida"),
                     self.html.replace("Caraballo", "Barrientos"),
                     self.html.replace('class="farmacias_hoy"', 'class="sin-datos"'),
                     self.html.replace('id="columna3"', 'id="sin-telefono"'),
                     self.html.replace("03 de noviembre", "05 de noviembre")]:
            with self.subTest(html=html[:80]), self.assertRaises(ValueError):
                convert(html, "Santa Fe", self.today, self.catalog)
        catalog = copy.deepcopy(self.catalog)
        pharmacy = next(p for p in catalog if p["nombre"] == "Barrientos")
        pharmacy.update(direccion="Calle 999999", telefono="999999999")
        with self.assertRaises(ValueError):
            convert(self.html, "Santa Fe", self.today, catalog)

    def test_accumulates_dates_is_idempotent_and_preserves_official_data(self):
        turns, _ = convert(self.html, "Santa Fe", self.today, self.catalog)
        previous = {"localidad": "Santo Tome", "mes": "2026-10", "turnos": []}
        updated = merge([previous], "Santa Fe", turns[:1], "source")
        updated = merge(updated, "Santa Fe", turns[1:], "source")
        self.assertEqual(updated[0], previous)
        self.assertEqual(len(updated[1]["turnos"]), 2)
        self.assertEqual(merge(updated, "Santa Fe", turns, "source"), updated)
        official = {"localidad": "Santa Fe", "mes": "2026-11", "turnos": [],
                    "fuente": {"tipo": "pdf-ocr-validado"}}
        self.assertEqual(merge([official], "Santa Fe", turns, "source"), [official])

    def test_month_rollover(self):
        turns, _ = convert(self.html, "Santa Fe", self.today, self.catalog)
        turns[0]["rangos"] = [{"desde": "2026-12-31T08:00:00-03:00", "hasta": "2027-01-01T08:00:00-03:00"}]
        turns[1]["rangos"] = [{"desde": "2027-01-01T08:00:00-03:00", "hasta": "2027-01-02T08:00:00-03:00"}]
        self.assertEqual([x["mes"] for x in merge([], "Santa Fe", turns, "source")], ["2026-12", "2027-01"])

    def test_cli_pdf_priority_and_fallback_on_missing_or_old_pdf(self):
        for pdf_status, issues, should_download in [
            ("validated", [], False), ("needs-review", [{"type": "pharmacy"}], False),
            ("needs-review", [{"type": "month"}], True), ("error", [], True),
            (None, [], True),
        ]:
            with self.subTest(status=pdf_status, issues=issues), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                target = root / "data.json"
                target.write_text("[]")
                report_dir = root / "turnos-report/santa-fe-ocr"
                report_dir.mkdir(parents=True)
                if pdf_status:
                    (report_dir / "review.json").write_text(json.dumps({"status": pdf_status, "month": "2026-11", "issues": issues}))
                with patch.object(import_litoral, "TARGET", target), patch.object(import_litoral, "datetime") as clock, \
                        patch.object(sys, "argv", ["import_litoral.py", "--locality", "santa-fe", "--apply"]), \
                        patch.object(import_litoral, "download", return_value=self.html.encode()) as download, \
                        contextlib.redirect_stdout(io.StringIO()):
                    # Path resolution uses chdir; restore even when the import fails.
                    original = Path.cwd()
                    try:
                        os.chdir(root)
                        clock.now.return_value = datetime(2026, 11, 2, 12)
                        import_litoral.main()
                    finally:
                        os.chdir(original)
                    self.assertEqual(download.called, should_download)
                    self.assertEqual(bool(json.loads(target.read_text())), should_download)

    def test_failed_fallback_keeps_published_data(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            target = root / "data.json"
            target.write_text("[]\n")
            before = target.read_bytes()
            original = Path.cwd()
            try:
                os.chdir(root)
                with patch.object(import_litoral, "TARGET", target), \
                        patch.object(import_litoral, "datetime") as clock, \
                        patch.object(sys, "argv", ["import_litoral.py", "--locality", "santa-fe", "--apply"]), \
                        patch.object(import_litoral, "download", return_value=self.html.encode()), \
                        contextlib.redirect_stdout(io.StringIO()):
                    clock.now.return_value = datetime(2026, 11, 3, 12)
                    with self.assertRaises(SystemExit):
                        import_litoral.main()
                self.assertEqual(target.read_bytes(), before)
                report = json.loads((root / "turnos-report/santa-fe-litoral-import.json").read_text())
                self.assertEqual(report["status"], "error")
            finally:
                os.chdir(original)


if __name__ == "__main__":
    unittest.main()
