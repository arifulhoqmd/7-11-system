import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Windows launcher starts the project server with Python fallback", async () => {
  const launcher = await readFile(
    new URL("../START_7ELEVEN_TRAINING.bat", import.meta.url),
    "utf8",
  );

  assert.match(launcher, /cd \/d "%~dp0"/i);
  assert.match(launcher, /python --version/);
  assert.match(launcher, /set "PYTHON_COMMAND=python"/);
  assert.match(launcher, /py --version/);
  assert.match(launcher, /set "PYTHON_COMMAND=py"/);
  assert.match(launcher, /%PYTHON_COMMAND% -m http\.server 8000/);
  assert.match(launcher, /http:\/\/localhost:8000\//);
  assert.match(launcher, /Start-Process 'http:\/\/localhost:8000\/'/);
  assert.match(launcher, /Press Ctrl\+C or close this window/);
});

test("README documents the one-click Windows launcher", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.match(
    readme,
    /Double-click START_7ELEVEN_TRAINING\.bat to launch the training app\./,
  );
});
