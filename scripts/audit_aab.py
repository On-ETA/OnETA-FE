"""Inspect an Android bundle without printing credential values (stdlib only)."""
import argparse
import json
from pathlib import Path, PurePosixPath
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PRIVATE_KEY = re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----")
PRIVATE_EXTENSIONS = {".jks", ".keystore", ".p12", ".p8", ".mobileprovision"}
LOCAL_DIRECTORIES = {"credentials", ".git", ".aws", ".idea", ".vscode", ".agents", ".codex", "tests", "docs"}


def forbidden_path(name):
    path = PurePosixPath(name.replace("\\", "/"))
    parts = [part.lower() for part in path.parts]
    filename = parts[-1] if parts else ""
    return (
        bool(LOCAL_DIRECTORIES.intersection(parts))
        or filename == "credentials.json"
        or filename == ".env" or filename.startswith(".env.")
        or filename in {"local.properties", ".npmrc", ".netrc"}
        or path.suffix.lower() in PRIVATE_EXTENSIONS | {".iml", ".log", ".bak"}
        or (filename.endswith(".map") and "BUNDLE-METADATA/" not in name)
    )


def local_credential_probes(root=ROOT):
    """Read local secrets only for exact-match checks; never return them in reports."""
    credential_file = root / "credentials.json"
    if not credential_file.exists():
        return {}
    config = json.loads(credential_file.read_text(encoding="utf-8-sig"))
    keystore = config.get("android", {}).get("keystore", {})
    probes = {}
    for field in ("keystorePassword", "keyPassword"):
        value = str(keystore.get(field, "")).encode()
        # Short/common words produce false matches in framework code and symbols.
        if len(value) >= 12:
            probes[field] = value
    if keystore.get("keystorePath"):
        key_file = root / keystore["keystorePath"]
        if key_file.is_file():
            value = key_file.read_bytes()
            if value:
                probes["local signing keystore bytes"] = value
    return probes


def inspect_bundle(bundle, probes=None):
    issues = []
    with zipfile.ZipFile(bundle) as archive:
        entries = archive.infolist()
        for entry in entries:
            if entry.is_dir():
                continue
            if forbidden_path(entry.filename):
                issues.append({"entry": entry.filename, "reason": "local/private file path"})
            content = archive.read(entry)
            if PRIVATE_KEY.search(content):
                issues.append({"entry": entry.filename, "reason": "private key content"})
            if re.search(rb'"type"\s*:\s*"service_account"', content):
                issues.append({"entry": entry.filename, "reason": "service account credentials"})
            for label, secret in (probes or {}).items():
                if secret and secret in content:
                    issues.append({"entry": entry.filename, "reason": label})
    return {"entriesChecked": len(entries), "issues": issues, "passed": not issues}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", nargs="?", default=str(ROOT / "android/app/build/outputs/bundle/release/app-release.aab"))
    args = parser.parse_args()
    probes = local_credential_probes()
    report = inspect_bundle(args.bundle, probes)
    report["credentialProbesChecked"] = list(probes)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
