import importlib.util
import io
from pathlib import Path
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("audit_aab", Path(__file__).resolve().parents[1] / "scripts/audit_aab.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def bundle(files):
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as archive:
        for name, value in files.items():
            archive.writestr(name, value)
    data.seek(0)
    return data


class BundleAuditTests(unittest.TestCase):
    def test_private_files_and_source_maps_are_rejected(self):
        for name in ("base/assets/credentials.json", "base/assets/.env.production",
                     "base/assets/credentials/keystore.jks", "base/assets/app.p12",
                     "base/assets/index.android.bundle.map", "base/assets/tests/fixture.json"):
            with self.subTest(name=name):
                self.assertFalse(audit.inspect_bundle(bundle({name: "fixture"}))["passed"])

    def test_disguised_secrets_are_rejected_without_reporting_values(self):
        secret = b"unique-credential-test-value"
        for value in (secret, b"-----BEGIN PRIVATE KEY-----", b'{"type":"service_account"}'):
            report = audit.inspect_bundle(bundle({"base/assets/data.bin": value}), {"test credential": secret})
            self.assertFalse(report["passed"])
            self.assertNotIn(secret.decode(), str(report))

    def test_runtime_files_public_signatures_and_play_debug_metadata_are_allowed(self):
        report = audit.inspect_bundle(bundle({
            "base/assets/index.android.bundle": "app runtime",
            "base/assets/app.config": "public app config",
            "base/assets/navermap-sdk/LICENSE": "license",
            "META-INF/CERT.RSA": "public signing certificate",
            "BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map": "mapping",
            "BUNDLE-METADATA/com.android.tools.build.debugsymbols/arm64-v8a/libapp.so.sym": "symbols",
        }))
        self.assertTrue(report["passed"])


if __name__ == "__main__":
    unittest.main()
