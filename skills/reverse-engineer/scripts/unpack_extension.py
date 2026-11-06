#!/usr/bin/env python3
"""
Unpack a Chrome (.crx) or Firefox (.xpi) extension for static recon.
Usage: python unpack_extension.py <file.crx|file.xpi|file.zip> [outDir]
Writes manifest summary + extracted tree under outDir.
"""
import sys, os, zipfile, json, struct, shutil
from pathlib import Path

def strip_crx(path: Path, tmp: Path):
    """CRX3 has a binary header before the zip. Find PK\x03\x04 and slice."""
    data = path.read_bytes()
    # CRX2/3 magic
    if data[:4] == b"Cr24":
        # find zip local file header
        idx = data.find(b"PK\x03\x04")
        if idx < 0:
            raise SystemExit("No zip payload found in CRX")
        zip_path = tmp / "payload.zip"
        zip_path.write_bytes(data[idx:])
        return zip_path
    # already a zip (xpi or renamed)
    return path

def main():
    if len(sys.argv) < 2:
        print("usage: python unpack_extension.py <file.crx|xpi|zip> [outDir]")
        sys.exit(1)
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(f"ext-{src.stem}")
    out.mkdir(parents=True, exist_ok=True)
    tmp = out / "_tmp"
    tmp.mkdir(exist_ok=True)
    try:
        zpath = strip_crx(src, tmp)
        with zipfile.ZipFile(zpath, "r") as z:
            z.extractall(out / "files")
        man_path = out / "files" / "manifest.json"
        summary = {"source": str(src), "files": []}
        if man_path.exists():
            man = json.loads(man_path.read_text(encoding="utf-8-sig", errors="replace"))
            summary["manifest"] = {
                "name": man.get("name"),
                "version": man.get("version"),
                "manifest_version": man.get("manifest_version"),
                "description": man.get("description"),
                "permissions": man.get("permissions"),
                "host_permissions": man.get("host_permissions"),
                "background": man.get("background"),
                "content_scripts": man.get("content_scripts"),
                "action": man.get("action") or man.get("browser_action"),
                "options_ui": man.get("options_ui"),
                "web_accessible_resources": man.get("web_accessible_resources"),
            }
            (out / "manifest-summary.json").write_text(json.dumps(summary["manifest"], indent=2))
        # file tree
        for root, dirs, files in os.walk(out / "files"):
            for f in files:
                rel = os.path.relpath(os.path.join(root, f), out / "files")
                summary["files"].append(rel)
        (out / "file-list.json").write_text(json.dumps(summary["files"], indent=2))
        print(f"Unpacked to {out}")
        print(f"  manifest: {summary.get('manifest', {}).get('name')} v{summary.get('manifest', {}).get('version')}")
        print(f"  files: {len(summary['files'])}")
        if summary.get("manifest", {}).get("permissions"):
            print(f"  permissions: {summary['manifest']['permissions']}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    main()
