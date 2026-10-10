import copy
import json
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


if __name__ == "__main__":
    unittest.main()
