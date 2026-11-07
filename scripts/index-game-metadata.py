#!/usr/bin/env python3
"""Index factual title/platform/year/genre fields from the MIT OpenGameDB CSV files.

Download https://github.com/karlforshaw/opengamedb at the revision below, then run:
  python3 scripts/index-game-metadata.py /path/to/opengamedb
The descriptions, artwork and scores are intentionally not copied.
"""
import csv
import json
import re
import sys
from pathlib import Path

REVISION = 'd4b634845ad83c7f093e3a3278d5d9c45ad4957b'
FILES = {
    'pc': 'pc', 'nintendo_64': 'n64', 'nintendo_switch': 'switch', 'gamecube': 'gamecube',
    'playstation': 'ps1', 'playstation_2': 'ps2', 'playstation_3': 'ps3',
    'playstation_portable': 'psp', 'nintendo_ds': 'nds', 'game_boy_advance': 'gba',
    'game_boy_color': 'gbc', 'game_boy': 'gb', 'nintendo_entertainment_system': 'nes',
    'super_nintendo_entertainment_system': 'snes', 'wii': 'wii', 'wii_u': 'wiiu',
    'xbox': 'xbox', 'dreamcast': 'dreamcast', 'mega_drive': 'genesis',
    'sega_saturn': 'saturn', 'nintendo_3ds': 'n3ds',
}

if len(sys.argv) != 2:
    raise SystemExit('Pass the directory containing the OpenGameDB CSV files')
rows = set()
for name, platform in FILES.items():
    with (Path(sys.argv[1]) / f'{name}.csv').open(encoding='utf-8-sig', newline='') as source:
        for item in csv.DictReader(source):
            title, genre = (item.get('title') or '').strip(), (item.get('genre') or '').strip()
            if not title or not genre:
                continue
            match = re.search(r'\b(?:19|20)\d{2}\b', item.get('released') or '')
            year = int(match.group()) if match else 0
            rows.add((title, platform, year, genre))
output = {'source': 'https://github.com/karlforshaw/opengamedb', 'license': 'MIT',
          'revision': REVISION, 'rows': sorted(rows)}
Path('data/source/opengamedb-index.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'Indexed {len(rows)} title/platform/genre records')
