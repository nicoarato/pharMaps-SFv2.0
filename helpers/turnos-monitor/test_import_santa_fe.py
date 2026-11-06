import copy
import json
import contextlib
import io
import sys
import tempfile
from unittest.mock import patch
import import_santa_fe
import unittest
from pathlib import Path
from import_santa_fe import reconcile, range_pairs, rank

ROOT = Path(__file__).resolve().parent


class SantaFeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ocr = json.loads((ROOT / "fixtures/santa-fe-octubre-2026-ocr.json").read_text())
        cls.catalog = json.loads((ROOT / "santa-fe-farmacias.json").read_text())
        cls.expected = json.loads((ROOT / "fixtures/santa-fe-octubre-2026-expected.json").read_text())

    def test_real_october_calendar(self):
        candidate, report = reconcile(self.ocr, "2026-10", self.catalog)
        self.assertEqual(report["status"], "validated", report["issues"])
        self.assertEqual(candidate["turnos"], self.expected["turnos"])
        self.assertEqual(report["metrics"]["resolvedRows"], 146)
        self.assertEqual(report["metrics"]["resolvedExceptions"], 7)

    def test_confirmed_bordignon_ocr_variant_in_exception(self):
        altered = copy.deepcopy(self.ocr)
        replaced = 0
        for block in altered["blocks"]:
            for reading in block["readings"]:
                for line in reading["lines"]:
                    if "Bordignon" in line["text"] and "sólo" in line["text"]:
                        line["text"] = line["text"].replace("Bordignon", "Bordigrion")
                        replaced += 1
        self.assertGreater(replaced, 0)
        candidate, report = reconcile(altered, "2026-10", self.catalog)
        self.assertEqual(report["status"], "validated", report["issues"])
        self.assertEqual(candidate["turnos"], self.expected["turnos"])

    def test_doubt_keeps_processing_and_alternatives(self):
        altered = copy.deepcopy(self.ocr)
        for reading in altered["blocks"][0]["readings"]:
            for line in reading["lines"]:
                if "2200" in line["text"]:
                    line["text"] = "Farmacia desconocida Dirección 9999 999 9999"
        candidate, report = reconcile(altered, "2026-10", self.catalog)
        self.assertEqual(len(candidate["turnos"]), 12)
        self.assertEqual(report["status"], "needs-review")
        issue = next(i for i in report["issues"] if i["type"] == "pharmacy")
        self.assertEqual(len(issue["readings"]), 3)
        self.assertTrue(issue["candidates"])
        self.assertEqual(report["metrics"]["resolvedRows"], 145)

    def test_wrong_month_and_missing_ink_row(self):
        _, report = reconcile(self.ocr, "2026-11", self.catalog)
        self.assertIn("month", [i["type"] for i in report["issues"]])
        altered = copy.deepcopy(self.ocr)
        altered["blocks"][0]["inkBands"] = [{"y0": 850, "y1": 875}]
        _, report = reconcile(altered, "2026-10", self.catalog)
        self.assertIn("unread-row", [i["type"] for i in report["issues"]])

    def test_new_year_and_invalid_date_pair(self):
        self.assertEqual(str(range_pairs("31/12 al 01/01", 2026, 12)[0][1]), "2027-01-01")
        self.assertEqual(str(range_pairs("31/12 al 01/01", 2027, 1)[0][0]), "2026-12-31")
        self.assertEqual(range_pairs("31/10 al 02/11", 2026, 10), ())


class SantoTomeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ocr = json.loads((ROOT / "fixtures/santo-tome-octubre-2026-ocr.json").read_text())
        cls.catalog = json.loads((ROOT / "santo-tome-farmacias.json").read_text())
        cls.expected = json.loads((ROOT / "fixtures/santo-tome-octubre-2026-expected.json").read_text())

    def test_real_october_calendar(self):
        candidate, report = reconcile(self.ocr, "2026-10", self.catalog, "Santo Tome")
        self.assertEqual(report["status"], "validated", report["issues"])
        self.assertEqual(candidate["localidad"], "Santo Tome")
        self.assertEqual(candidate["turnos"], self.expected["turnos"])
        self.assertEqual(report["metrics"]["resolvedRows"], 29)

    def test_apply_preserves_other_city_and_months(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "data.json"
            ocr_path = Path(folder) / "ocr.json"
            ocr_path.write_text(json.dumps(self.ocr))
            other_city = {"localidad": "Santa Fe", "mes": "2026-10", "turnos": []}
            other_month = {"localidad": "Santo Tome", "mes": "2026-09", "turnos": []}
            target.write_text(json.dumps([other_city, other_month]))
            argv = ["import_santa_fe.py", "--locality", "santo-tome", "--month", "2026-10",
                    "--input", str(ocr_path), "--apply"]
            with patch.object(import_santa_fe, "TARGET", target), patch.object(sys, "argv", argv), contextlib.redirect_stdout(io.StringIO()):
                import_santa_fe.main()
                updated = json.loads(target.read_text())
                self.assertEqual(updated[:2], [other_city, other_month])
                self.assertEqual(updated[2]["turnos"], self.expected["turnos"])
                before = target.read_bytes()
                import_santa_fe.main()
                self.assertEqual(target.read_bytes(), before)
                self.assertFalse(json.loads((Path(folder) / "review.json").read_text())["changed"])

    def test_wrong_month_locality_and_missing_block(self):
        _, report = reconcile(self.ocr, "2026-11", self.catalog, "Santo Tome")
        self.assertEqual(report["status"], "needs-review")
        self.assertIn("month", [i["type"] for i in report["issues"]])
        altered = copy.deepcopy(self.ocr)
        altered["locality"]["text"] = "SANTA FE"
        altered["blocks"].pop()
        _, report = reconcile(altered, "2026-10", self.catalog, "Santo Tome")
        self.assertIn("layout", [i["type"] for i in report["issues"]])
        self.assertIn("coverage", [i["type"] for i in report["issues"]])

    def test_unknown_pharmacy_and_omitted_bottom_row(self):
        altered = copy.deepcopy(self.ocr)
        for reading in altered["blocks"][4]["readings"]:
            for line in reading["lines"]:
                if "Curado" in line["text"]:
                    line["text"] = "Desconocida 9999 9999999"
        candidate, report = reconcile(altered, "2026-10", self.catalog, "Santo Tome")
        self.assertEqual(report["status"], "needs-review")
        self.assertEqual(len(candidate["turnos"]), 9)
        self.assertIn("pharmacy", [i["type"] for i in report["issues"]])
        for reading in altered["blocks"][4]["readings"]:
            reading["lines"] = [line for line in reading["lines"] if "Desconocida" not in line["text"]]
        _, report = reconcile(altered, "2026-10", self.catalog, "Santo Tome")
        self.assertIn("unread-row", [i["type"] for i in report["issues"]])


if __name__ == "__main__":
    unittest.main()
