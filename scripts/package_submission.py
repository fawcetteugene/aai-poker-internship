"""Package the source and local Git history without generated artifacts."""

import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
output = root / "dist" / "aai-poker-internship.zip"
output.parent.mkdir(exist_ok=True)
excluded = {
    "node_modules", ".next", ".venv", "__pycache__", ".pytest_cache",
    ".ruff_cache", "coverage", "playwright-report", "test-results", "dist",
}
count = 0
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    for directory, folders, files in os.walk(root):
        folders[:] = [
            folder for folder in folders
            if folder not in excluded and not folder.endswith(".egg-info")
        ]
        for name in sorted(files):
            if name == ".env" or name == ".coverage" or name.endswith(".tsbuildinfo"):
                continue
            path = Path(directory) / name
            archive.write(path, Path(root.name) / path.relative_to(root))
            count += 1
print(f"Packaged {count} files: {output} ({output.stat().st_size:,} bytes)")
