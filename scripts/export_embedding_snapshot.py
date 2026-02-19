#!/usr/bin/env python3
"""Export embedding snapshot JSON for frontend Chapter 3 visualization."""

from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Any


def _to_float_matrix(matrix: list[list[Any]]) -> list[list[float]]:
    converted: list[list[float]] = []
    for row in matrix:
        converted.append([float(getattr(value, "data", value)) for value in row])
    return converted


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    checkpoint_path = repo_root / "checkpoints" / "ko_model.pkl"
    output_path = repo_root / "app" / "public" / "data" / "ko_embedding_snapshot.json"

    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    with checkpoint_path.open("rb") as handle:
        checkpoint = pickle.load(handle)

    config = checkpoint.get("config", {})
    tokenizer = checkpoint.get("tokenizer", {})
    state_dict = checkpoint.get("state_dict", {})

    wte = state_dict.get("wte")
    wpe = state_dict.get("wpe")
    if not isinstance(wte, list) or not isinstance(wpe, list):
        raise ValueError("Checkpoint state_dict must contain list matrices for 'wte' and 'wpe'.")

    if not wte or not isinstance(wte[0], list):
        raise ValueError("Invalid wte matrix in checkpoint.")
    if not wpe or not isinstance(wpe[0], list):
        raise ValueError("Invalid wpe matrix in checkpoint.")

    n_embd = int(config.get("n_embd", len(wte[0])))
    block_size = int(config.get("block_size", len(wpe)))

    if n_embd != 16:
        raise ValueError(f"Expected n_embd == 16, got {n_embd}")
    if block_size != 16:
        raise ValueError(f"Expected block_size == 16, got {block_size}")
    if len(wpe) != block_size:
        raise ValueError(f"Expected len(wpe) == block_size ({block_size}), got {len(wpe)}")
    if len(wte[0]) != n_embd:
        raise ValueError(f"Expected len(wte[0]) == n_embd ({n_embd}), got {len(wte[0])}")

    uchars = tokenizer.get("uchars")
    bos = tokenizer.get("BOS")
    if not isinstance(uchars, list):
        raise ValueError("Tokenizer 'uchars' is missing or invalid.")
    if not isinstance(bos, int):
        raise ValueError("Tokenizer 'BOS' is missing or invalid.")

    snapshot = {
        "n_embd": n_embd,
        "block_size": block_size,
        "tokenizer": {
            "uchars": uchars,
            "bos": bos,
        },
        "wte": _to_float_matrix(wte),
        "wpe": _to_float_matrix(wpe),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(snapshot, handle, ensure_ascii=False, indent=2)

    print(f"Saved embedding snapshot: {output_path}")
    print(
        "Summary:",
        json.dumps(
            {
                "n_embd": snapshot["n_embd"],
                "block_size": snapshot["block_size"],
                "num_tokens": len(snapshot["tokenizer"]["uchars"]),
                "wte_rows": len(snapshot["wte"]),
                "wpe_rows": len(snapshot["wpe"]),
            },
            ensure_ascii=False,
        ),
    )


if __name__ == "__main__":
    main()
