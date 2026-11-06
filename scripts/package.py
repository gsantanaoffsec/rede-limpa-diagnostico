"""Empacota somente fontes e recursos distribuíveis; não inclui node_modules."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
output = root / 'release'
output.mkdir(exist_ok=True)
for browser in ('firefox', 'chrome'):
    base = root / 'dist' / browser
    if not (base / 'manifest.json').is_file():
        raise SystemExit('Execute npm run build antes de empacotar.')
    target = output / f'rede-limpa-{browser}-{version}.zip'
    with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
        for file in sorted(base.rglob('*')):
            if file.is_file():
                archive.write(file, file.relative_to(base))
    with ZipFile(target) as archive:
        assert archive.testzip() is None and 'manifest.json' in archive.namelist()
    print(target.name)

target = output / f'rede-limpa-diagnostico-{version}.zip'
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for folder in ('src', 'scripts', 'tests', 'docs', 'dist'):
        for file in sorted((root / folder).rglob('*')):
            if file.is_file() and '__pycache__' not in file.parts:
                archive.write(file, Path('rede-limpa-diagnostico') / file.relative_to(root))
    for file in sorted(root.iterdir()):
        if file.is_file() and (file.suffix in ('.md', '.json') or file.name == '.gitignore'):
            archive.write(file, Path('rede-limpa-diagnostico') / file.name)
with ZipFile(target) as archive:
    assert archive.testzip() is None
print(target.name)
