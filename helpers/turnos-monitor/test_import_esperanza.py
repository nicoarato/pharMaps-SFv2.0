import calendar
import unittest
from import_esperanza import convert

REGISTRY = {"HILAS": "Farmacia HILAS", "TKACZYK": "Farmacia TKACZYK"}


def source(year=2026, month=10, name="Hilas"):
    title = {10: "Octubre", 2: "Febrero", 12: "Diciembre"}[month]
    return f"Turnos {title} {year} " + " ".join(
        f"{day:02}/{month:02}/{year} — {name}" for day in range(1, calendar.monthrange(year, month)[1] + 1))


class ImportTests(unittest.TestCase):
    def test_full_month_and_year_rollover(self):
        result = convert(source(month=12), "2026-12", REGISTRY, "2026-12-01")
        self.assertEqual(len(result["items"]), 31)
        self.assertEqual(result["items"][-1]["rangos"][0]["hasta"], "2027-01-01T08:00:00-03:00")

    def test_leap_year(self):
        self.assertEqual(len(convert(source(2028, 2), "2028-02", REGISTRY, "2028-02-01")["items"]), 29)

    def test_invalid_calendars(self):
        cases = [source(name="Dolnalisio"), source() + " 31/10/2026 Hilas",
                 source().replace("10/10/2026 — Hilas", ""), source(name="Hilas / Hilas"),
                 source().replace("01/10/2026", "01/11/2026"), source(month=12)]
        for text in cases:
            with self.subTest(text=text[:70]), self.assertRaises(ValueError):
                convert(text, "2026-10", REGISTRY, "2026-10-01")

    def test_explicit_spelling_variant(self):
        result = convert(source(name="Tkaczyck"), "2026-10", REGISTRY, "2026-10-01")
        self.assertEqual(result["items"][0]["farmacias"][0]["alias"], "TKACZYK")


if __name__ == "__main__":
    unittest.main()
