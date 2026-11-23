#!/usr/bin/env python3
"""Package browser assets only; no npm/runtime backend is shipped."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, default=ROOT / "dist")
args = parser.parse_args()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=True)
source = ROOT / "web/public"

with tempfile.TemporaryDirectory(prefix="cy-static-") as tmp:
    staged = Path(tmp) / "static-web"
    staged.mkdir()
    for entry in sorted(source.rglob("*")):
        rel = entry.relative_to(source)
        if entry.is_symlink():
            raise ValueError(f"Refusing to package symlink: {rel}")
        if entry.is_dir():
            continue
        if not str(rel).isascii() or any(part.startswith(".") for part in rel.parts):
            raise ValueError(f"Unexpected public asset path: {rel}")
        # The ZIP opens straight into the game, with no redirect or duplicate HTML.
        if rel.as_posix() == "index.html":
            continue
        dest_rel = Path("index.html") if rel.as_posix() == "playable-v2.html" else rel
        dest = staged / dest_rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(entry, dest)
    if not (staged / "index.html").is_file():
        raise ValueError("Game entry is missing")
    shutil.copyfile(ROOT / "docs/art-manifest.md", staged / "ART-MANIFEST.md")
    (staged / "README.txt").write_text(
        "尘缘问道 · 剑阵万象 — 静态 Web 包\n\n"
        "解压后打开 index.html，或将解压目录完整上传到任意静态托管目录。\n"
        "保留 vendor/ 和 art/ 的相对位置；不需要 Node.js、Python 或后端。\n"
        "旧存档与浏览器、协议、主机名和端口绑定；变更站点前请在游戏内备份云码。\n"
        "DOMPurify 的版本、来源、校验值和许可证见 vendor/；既有美术溯源见 ART-MANIFEST.md。\n",
        encoding="utf-8",
    )
    entries = sorted(p for p in staged.rglob("*") if p.is_file())
    manifest = {"entry": "index.html", "files": [{"path": p.relative_to(staged).as_posix(), "bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in entries]}
    (staged / "package-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    archive = output / "chenyuan-wendao-static.zip"
    # Fixed timestamps and permissions make repeated builds byte-identical.
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for entry in sorted(p for p in staged.rglob("*") if p.is_file()):
            info = zipfile.ZipInfo(entry.relative_to(staged).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, entry.read_bytes())
    with zipfile.ZipFile(archive) as z:
        bad = z.testzip()
        if bad:
            raise ValueError(f"Corrupt ZIP entry: {bad}")
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (output / (archive.name + ".sha256")).write_text(f"{digest}  {archive.name}\n", encoding="ascii")
    # Replace only this builder's staging directory, never arbitrary output contents.
    final_stage = output / "static-web"
    if final_stage.exists():
        if final_stage.is_symlink() or not (final_stage / "package-manifest.json").is_file():
            raise ValueError(f"Refusing to replace an unrecognized staging directory: {final_stage}")
        shutil.rmtree(final_stage)
    shutil.copytree(staged, final_stage)
    print(json.dumps({"zip": str(archive), "bytes": archive.stat().st_size, "sha256": digest, "entry": "index.html", "files": len(manifest["files"]) + 1}))
