import importlib.util
import pathlib
import unittest

# Load the hyphenated module by path (can't `import build-metros`).
_spec = importlib.util.spec_from_file_location(
    "build_metros", pathlib.Path(__file__).parent / "build-metros.py"
)
bm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bm)


class TestPureHelpers(unittest.TestCase):
    def test_wiki_url_simple(self):
        self.assertEqual(bm.wiki_url("Denver"), "https://en.wikipedia.org/wiki/Denver")

    def test_wiki_url_spaces_become_underscores(self):
        self.assertEqual(
            bm.wiki_url("Salt Lake City"),
            "https://en.wikipedia.org/wiki/Salt_Lake_City",
        )

    def test_upsert_params_order_and_length(self):
        entry = {
            "id": "denver-co",
            "cbsa": "19740",
            "name": "Denver-Aurora-Centennial, CO",
            "short": "Denver",
            "states": ["CO"],
            "pop": 2986000,
            "rpp": {"overall": 1.0, "housing": 2.0, "goods": 3.0, "otherServices": 4.0},
            "politics": 18.0,
            "aqi": 42.0,
            "rent": 1850,
        }
        p = bm.metro_upsert_params(entry)
        self.assertEqual(len(p), 16)
        self.assertEqual(p[0], "denver-co")
        self.assertEqual(p[1], "19740")
        self.assertEqual(p[4], ["CO"])
        self.assertEqual(p[6], 1.0)
        self.assertEqual(p[9], 4.0)
        self.assertEqual(p[10], 18.0)
        self.assertIsNone(p[11])
        self.assertEqual(p[13], 42.0)
        self.assertEqual(p[15], 1850)  # rent

    def test_latest_value_walks_back_past_blank_months(self):
        date_cols = [3, 4, 5]
        self.assertEqual(bm.latest_value(["x", "y", "z", "1700.4", "1801.6", ""], date_cols), 1802)
        self.assertIsNone(bm.latest_value(["x", "y", "z", "", "", ""], date_cols))


if __name__ == "__main__":
    unittest.main()
