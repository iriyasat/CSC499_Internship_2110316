from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    jupyter_root = script_dir / ".jupyter"
    runtime_dir = jupyter_root / "runtime"
    config_dir = jupyter_root / "config"
    data_dir = jupyter_root / "data"

    runtime_dir.mkdir(parents=True, exist_ok=True)
    config_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["JUPYTER_RUNTIME_DIR"] = str(runtime_dir)
    env["JUPYTER_CONFIG_DIR"] = str(config_dir)
    env["JUPYTER_DATA_DIR"] = str(data_dir)

    try:
        subprocess.Popen(
            ["py", "-m", "notebook"],
            cwd=script_dir,
            env=env,
        )
    except FileNotFoundError:
        subprocess.Popen(
            [sys.executable, "-m", "notebook"],
            cwd=script_dir,
            env=env,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
