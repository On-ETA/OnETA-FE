"""Build an isolated instrumentation APK against the actual minified release app."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serial', required=True, help='Isolated QA emulator serial; never defaults to a user phone')
    args = parser.parse_args()
    if not args.serial.startswith('emulator-'):
        parser.error('This helper is restricted to emulator serials.')
    sdk = Path(os.environ.get('ANDROID_SDK_ROOT', Path.home() / 'AppData/Local/Android/Sdk'))
    tools = sdk / 'build-tools/36.0.0'
    jar = sdk / 'platforms/android-36/android.jar'
    output = ROOT / '.expo/release-qa/probe'
    for folder in ('classes', 'dex', 'assets'):
        (output / folder).mkdir(parents=True, exist_ok=True)
    owners = {
        'expo.modules.kotlin.records.Field', 'expo.modules.kotlin.records.Record',
        'expo.modules.kotlin.types.TypeConverterProviderImpl', 'expo.modules.kotlin.types.TypeConverter',
        'kotlin.reflect.jvm.internal.KClassImpl', 'kotlin.jvm.internal.TypeReference',
        'com.facebook.react.bridge.WritableNativeMap', 'com.facebook.react.uimanager.ThemedReactContext',
        'com.naver.maps.map.MapView', 'com.naver.maps.map.NaverMapOptions', 'com.naver.maps.map.OnMapReadyCallback',
        'com.naver.maps.map.NaverMap', 'com.mjstudio.reactnativenavermap.mapview.RNCNaverMapViewWrapper',
        'com.google.firebase.FirebaseApp', 'com.google.firebase.messaging.FirebaseMessaging',
    }
    classes, methods = {}, {}
    owner = None
    mapping = ROOT / 'android/app/build/outputs/mapping/release/mapping.txt'
    for line in mapping.read_text(encoding='utf-8').splitlines():
        match = re.match(r'^(\S+) -> (\S+):$', line)
        if match:
            owner = match[1]
            if owner in owners or owner.startswith('expo.modules.location.records.'):
                classes[owner] = match[2]
            continue
        if owner not in owners:
            continue
        match = re.search(r' (?P<name>obtainTypeConverter|convert|onCreate|onStart|onResume|onPause|onStop|onDestroy|getMapAsync|doDestroy|getInstance)\(.*?\).* -> (?P<alias>\S+)$', line)
        if match:
            if match['name'] == 'getInstance' and ' getInstance()' not in line:
                continue
            methods[owner + '.' + match['name']] = match['alias']
    (output / 'assets/probe-config.json').write_text(json.dumps({'classes': classes, 'methods': methods}), encoding='utf-8')
    manifest = '''<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.oneta.releaseqa">
      <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36"/>
      <instrumentation android:name=".ReleaseProbe" android:targetPackage="com.oneta.app" android:functionalTest="true"/>
      <application android:label="Oneta Release QA"/>
    </manifest>'''
    (output / 'AndroidManifest.xml').write_text(manifest, encoding='utf-8')

    def run(command, **kwargs):
        completed = subprocess.run([str(value) for value in command], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', **kwargs)
        if completed.returncode:
            raise RuntimeError(completed.stdout + completed.stderr)
        return completed.stdout

    run([shutil.which('javac'), '-encoding', 'UTF-8', '-source', '8', '-target', '8', '-cp', jar,
         '-d', output / 'classes', ROOT / 'tests/android/ReleaseProbe.java'])
    class_files = list((output / 'classes').rglob('*.class'))
    run([tools / 'd8.bat', '--release', '--min-api', '24', '--lib', jar, '--output', output / 'dex', *class_files])
    unsigned = output / 'unsigned.apk'
    run([tools / 'aapt2.exe', 'link', '-I', jar, '--manifest', output / 'AndroidManifest.xml',
         '-A', output / 'assets', '-o', unsigned, '--min-sdk-version', '24', '--target-sdk-version', '36'])
    with zipfile.ZipFile(unsigned, 'a') as archive:
        archive.write(output / 'dex/classes.dex', 'classes.dex')
    aligned, apk = output / 'aligned.apk', output / 'release-probe.apk'
    run([tools / 'zipalign.exe', '-f', '4', unsigned, aligned])
    # The standard Android debug key is public test data, not the production keystore.
    run([tools / 'apksigner.bat', 'sign', '--ks', ROOT / 'android/app/debug.keystore',
         '--ks-key-alias', 'androiddebugkey', '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', apk, aligned])
    adb = sdk / 'platform-tools/adb.exe'
    # A fresh adb server may not have rediscovered an already-running emulator.
    run([adb, 'start-server'])
    try:
        run([adb, '-s', args.serial, 'wait-for-device'], timeout=15)
        serial = args.serial
    except subprocess.TimeoutExpired:
        port = int(args.serial.split('-')[-1]) + 1
        serial = '127.0.0.1:' + str(port)
        run([adb, 'connect', serial], timeout=15)
        run([adb, '-s', serial, 'wait-for-device'], timeout=15)
    run([adb, '-s', serial, 'install', '-r', apk])
    result = run([adb, '-s', serial, 'shell', 'am', 'instrument', '-w', 'com.oneta.releaseqa/.ReleaseProbe'], timeout=90)
    (output / 'result.txt').write_text(result, encoding='utf-8')
    print(result)
    return 0 if 'INSTRUMENTATION_RESULT: result=PASS' in result else 1


if __name__ == '__main__':
    raise SystemExit(main())
