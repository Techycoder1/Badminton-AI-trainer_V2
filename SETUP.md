# Badminton Footwork Trainer — Setup Guide

## Folder Structure

```
badminton-trainer/
├── index.html
├── trainer.js
├── tf.min.js                  ← download (step 1)
├── pose-detection.min.js      ← download (step 1)
├── SETUP.md
└── model/
    ├── model.json             ← download (step 2)
    ├── group1-shard1of2.bin   ← download (step 2)
    └── group1-shard2of2.bin   ← download (step 2)
```

---

## Step 1 — Download TensorFlow.js libraries (do once with internet)

Download these two files and put them in the **same folder** as `index.html`:

**tf.min.js**
```
https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js
```

**pose-detection.min.js**
```
https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js
```

> Tip: In Chrome/Edge, visit the URL → right-click → Save As

---

## Step 2 — Download MoveNet model (do once with internet)

Create a folder called `model/` inside `badminton-trainer/`.

Download these files into `model/`:

**model.json**
```
https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/model.json?tfjs-format=file
```

**Weight shards** (download all .bin files linked inside model.json — typically 2 files):
```
https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/model.json?tfjs-format=file
```
Open the model.json after downloading and look for the `weightsManifest` section.
It will list shard filenames like:
```
"group1-shard1of2.bin"
"group1-shard2of2.bin"
```
Download each one from the same base URL and put them in the `model/` folder.

### Faster alternative — use Node.js (if installed):

```bash
cd badminton-trainer
npx tfjs-models-downloader movenet_lightning ./model
```

Or with Python:
```bash
pip install requests
python3 -c "
import requests, json, os
base = 'https://storage.googleapis.com/tfjs-models/savedmodel/movenet/singlepose/lightning/4/'
os.makedirs('model', exist_ok=True)
mj = requests.get(base + 'model.json').json()
open('model/model.json','wb').write(requests.get(base + 'model.json').content)
for w in mj['weightsManifest'][0]['paths']:
    open(f'model/{w}','wb').write(requests.get(base+w).content)
    print('Downloaded', w)
print('Done!')
"
```

---

## Step 3 — Run the app

### Option A: Open directly in browser
Double-click `index.html` — works in most browsers.

> ⚠️ Chrome blocks local file loading by default. If the model doesn't load, use Option B.

### Option B: Run a local server (recommended)

**With Python (easiest):**
```bash
cd badminton-trainer
python3 -m http.server 8080
```
Then open: http://localhost:8080

**With Node.js:**
```bash
npx serve .
```

**With VS Code:**
Install the "Live Server" extension → right-click `index.html` → Open with Live Server

---

## How to Use

1. Stand **1.5–2 metres** from your camera
2. Make sure your **full body is visible** in the frame
3. Click **Start Training**
4. When a direction is called out and beeped — **move your feet** to that zone
5. The AI tracks your **hip position** to detect if you reached the zone
6. Return to centre between each call

### Zones
```
        [ BACK ]
[ LEFT ]  [YOU]  [ RIGHT ]
[L.COR]          [R.COR]
        [ FRONT ]
```

### Tips for best accuracy
- Good lighting — avoid backlighting
- Wear clothes that contrast with your background
- Keep hips visible (don't stand behind furniture)
- The **orange dots** on screen = your hips being tracked
- Green dashed box = target zone

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "tf.min.js not found" | Download tf.min.js (Step 1) |
| "model/model.json not found" | Download model files (Step 2) |
| "NO PERSON" badge | Move back, improve lighting |
| Chrome blocks local files | Use `python3 -m http.server 8080` |
| Speech not working | Enable browser speech permissions |
| Beep not working | Click anywhere on page first (browser audio policy) |
