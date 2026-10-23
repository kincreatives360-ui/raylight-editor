from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("har_candidates.py")
SPEC = importlib.util.spec_from_file_location("har_candidates", MODULE_PATH)
assert SPEC and SPEC.loader
har_candidates = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(har_candidates)


class HarCandidatesTest(unittest.TestCase):
    def test_ranks_json_fetch_and_redacts_secret_query(self) -> None:
        entry = {
            "_resourceType": "fetch",
            "request": {
                "method": "GET",
                "url": "https://example.com/api/items?limit=10&token=secret",
                "headers": [{"name": "Cookie", "value": "sid=secret"}],
            },
            "response": {
                "status": 200,
                "headers": [{"name": "Content-Type", "value": "application/json"}],
                "content": {"mimeType": "application/json", "text": '[{"id": 1}]', "size": 11},
            },
        }
        result = har_candidates.rank_entry(entry, 0)
        self.assertGreaterEqual(result["score"], 10)
        self.assertIn("limit=<redacted>", result["url"])
        self.assertIn("token=<redacted>", result["url"])
        self.assertNotIn("secret", json.dumps(result))
        self.assertEqual(result["response_shape"], "list[1]")
        self.assertIn("cookie", result["auth_signals"])

        shown = har_candidates.rank_entry(entry, 0, show_params=True)
        self.assertIn("limit=10", shown["url"])
        self.assertIn("token=<redacted>", shown["url"])
        self.assertNotIn("secret", json.dumps(shown))

    def test_penalizes_static_assets(self) -> None:
        entry = {
            "_resourceType": "image",
            "request": {"method": "GET", "url": "https://example.com/logo.png", "headers": []},
            "response": {"status": 200, "content": {"mimeType": "image/png", "size": 100}},
        }
        self.assertLess(har_candidates.rank_entry(entry, 0)["score"], 0)

    def test_loads_valid_har(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "capture.har"
            path.write_text(json.dumps({"log": {"entries": []}}), encoding="utf-8")
            self.assertEqual(har_candidates.load_entries(path), [])


if __name__ == "__main__":
    unittest.main()
