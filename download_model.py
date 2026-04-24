#!/usr/bin/env python3
"""
download_shards.py  — fixed version
Run from inside your badminton-trainer/ folder:
    python3 download_shards.py
"""

import os, json, urllib.request, sys

MODEL_DIR = "model"

MODEL_JSON_URLS = [
    "https://storage.googleapis.com/tfhub-modules/google/movenet/singlepose/lightning/4/model.json",
    "https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/model.json?tfjs-format=file",
]

SHARD_BASE_URLS = [
    "https://storage.googleapis.com/tfhub-modules/google/movenet/singlepose/lightning/4/",
    "https://storage.googleapis.com/tfjs-models/savedmodel/movenet/singlepose/lightning/4/",
]

def dl(url, dest):
    print(f"    GET {url}")
    print(f"    -> {os.path.basename(dest)} ...", end=" ", flush=True)
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        })
        with urllib.request.urlopen(req, timeout=30) as r, open(dest, "wb") as f:
            data = r.read()
            f.write(data)
        size = os.path.getsize(dest)
        if size < 500:
            os.remove(dest)
            print(f"FAILED: too small ({size} bytes)")
            return False
        if dest.endswith("model.json"):
            try:
                json.loads(data)
            except Exception:
                os.remove(dest)
                print("FAILED: not valid JSON")
                return False
        print(f"OK ({size // 1024} KB)")
        return True
    except Exception as e:
        print(f"FAILED: {e}")
        return False

def main():
    os.makedirs(MODEL_DIR, exist_ok=True)
    model_json_path = os.path.join(MODEL_DIR, "model.json")

    print("\n=== Step 1: model.json ===\n")
    got_json = False
    if os.path.exists(model_json_path):
        try:
            with open(model_json_path) as f:
                json.load(f)
            if os.path.getsize(model_json_path) > 500:
                print("  Already valid — skipping")
                got_json = True
        except Exception:
            print("  Invalid — re-downloading")
            os.remove(model_json_path)

    if not got_json:
        for url in MODEL_JSON_URLS:
            if dl(url, model_json_path):
                got_json = True
                break

    if not got_json:
        print("\nCould not download model.json automatically.")
        print("Open this URL in Chrome and save as model\\model.json:")
        print("  https://storage.googleapis.com/tfhub-modules/google/movenet/singlepose/lightning/4/model.json")
        sys.exit(1)

    with open(model_json_path) as f:
        data = json.load(f)

    shards = []
    for manifest in data.get("weightsManifest", []):
        for path in manifest.get("paths", []):
            shards.append(path)

    print(f"\n=== Step 2: {len(shards)} weight shard(s) ===\n")

    for shard in shards:
        dest = os.path.join(MODEL_DIR, shard)
        if os.path.exists(dest) and os.path.getsize(dest) > 10000:
            print(f"  {shard} — exists, skipping")
            continue
        success = False
        for base in SHARD_BASE_URLS:
            if dl(base + shard, dest):
                success = True
                break
        if not success:
            print(f"  FAILED: {shard}")
            print(f"  Manual URL: https://storage.googleapis.com/tfhub-modules/google/movenet/singlepose/lightning/4/{shard}")

    print("\n=== Files in model/ ===")
    for f in sorted(os.listdir(MODEL_DIR)):
        print(f"  {f}  ({os.path.getsize(os.path.join(MODEL_DIR,f))//1024} KB)")

    print("\nNow run:")
    print("  git add model/")
    print("  git commit -m 'add MoveNet model files'")
    print("  git push\n")

if __name__ == "__main__":
    main()