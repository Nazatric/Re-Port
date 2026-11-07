#!/usr/bin/env python3
"""Exercise the actual Android build on an emulator via adb and accessibility semantics."""
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

APK = Path('native/app/build/outputs/apk/debug/app-debug.apk')

def adb(*args, timeout=45):
    return subprocess.run(['adb', *args], check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout).stdout

def dump():
    adb('shell', 'uiautomator', 'dump', '/sdcard/report-ui.xml')
    return ET.fromstring(adb('exec-out', 'cat', '/sdcard/report-ui.xml'))

def labels(root):
    return [v for n in root.iter('node') for v in (n.get('text', ''), n.get('content-desc', '')) if v]

def wait_for(predicate, name, timeout=75):
    deadline = time.monotonic() + timeout
    last = []
    while time.monotonic() < deadline:
        root = dump()
        last = labels(root)
        if predicate(root, last):
            print('PASS:', name, flush=True)
            return root
        time.sleep(1)
    raise AssertionError(f'{name} not found; visible labels: {last[:60]}')

def tap_label(root, label):
    for node in root.iter('node'):
        if node.get('text') == label or node.get('content-desc') == label:
            b = node.get('bounds', '')
            m = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', b)
            if m:
                x1, y1, x2, y2 = map(int, m.groups())
                adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
                return
    raise AssertionError(f'Could not tap {label}')

try:
    assert APK.is_file(), f'Missing {APK}'
    adb('install', '-r', str(APK), timeout=120)
    adb('logcat', '-c')
    adb('shell', 'am', 'start', '-W', '-n', 'app.report.port/.MainActivity')
    root = wait_for(lambda root, text: 'Spotlight' in text and 'Library' in text, 'Native Home screen and dock')
    tap_label(root, 'Library')
    expected = len(json.loads(Path('src/data/catalog.json').read_text(encoding='utf-8'))['games'])
    root = wait_for(lambda root, text: f'{expected} results' in text, f'Full catalog in Library ({expected} entries)')
    tap_label(root, 'Saved')
    root = wait_for(lambda root, text: 'Nothing saved yet' in text, 'Saved screen')
    adb('shell', 'input', 'keyevent', '4')
    root = wait_for(lambda root, text: 'Spotlight' in text and 'Library' in text, 'Android back returns to Home')
    assert adb('shell', 'pidof', 'app.report.port').strip(), 'App process exited unexpectedly'
    print('Android emulator smoke test passed.')
except Exception as exc:
    print('Android emulator smoke test failed:', exc, flush=True)
    try:
        print(adb('logcat', '-d', '-s', 'AndroidRuntime:E', timeout=30)[-12000:])
    except Exception:
        pass
    sys.exit(1)
