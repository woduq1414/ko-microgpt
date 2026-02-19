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


def _validate_matrix_shape(matrix: Any, expected_rows: int, expected_cols: int, name: str) -> list[list[Any]]:
    if not isinstance(matrix, list) or not matrix or not isinstance(matrix[0], list):
        raise ValueError(f"Invalid {name} matrix in checkpoint.")
    if len(matrix) != expected_rows:
        raise ValueError(f"Expected len({name}) == {expected_rows}, got {len(matrix)}")
    for row_index, row in enumerate(matrix):
        if not isinstance(row, list):
            raise ValueError(f"Expected row {row_index} in {name} to be a list.")
        if len(row) != expected_cols:
            raise ValueError(
                f"Expected len({name}[{row_index}]) == {expected_cols}, got {len(row)}"
            )
    return matrix


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
    if not isinstance(wte, list) or not wte or not isinstance(wte[0], list):
        raise ValueError("Checkpoint state_dict must contain a valid 'wte' matrix.")
    if not isinstance(wpe, list) or not wpe or not isinstance(wpe[0], list):
        raise ValueError("Checkpoint state_dict must contain a valid 'wpe' matrix.")

    n_embd = int(config.get("n_embd", len(wte[0])))
    block_size = int(config.get("block_size", len(wpe)))
    n_head = int(config.get("n_head", 1))

    if n_embd != 16:
        raise ValueError(f"Expected n_embd == 16, got {n_embd}")
    if block_size != 16:
        raise ValueError(f"Expected block_size == 16, got {block_size}")
    if n_head <= 0:
        raise ValueError(f"Expected n_head > 0, got {n_head}")
    if n_embd % n_head != 0:
        raise ValueError(f"Expected n_embd ({n_embd}) to be divisible by n_head ({n_head})")

    _validate_matrix_shape(wte, len(wte), n_embd, "wte")
    _validate_matrix_shape(wpe, block_size, n_embd, "wpe")
    head_dim = n_embd // n_head

    attn_wq = _validate_matrix_shape(state_dict.get("layer0.attn_wq"), n_embd, n_embd, "layer0.attn_wq")
    attn_wk = _validate_matrix_shape(state_dict.get("layer0.attn_wk"), n_embd, n_embd, "layer0.attn_wk")
    attn_wv = _validate_matrix_shape(state_dict.get("layer0.attn_wv"), n_embd, n_embd, "layer0.attn_wv")

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
        "attention": {
            "layer_index": 0,
            "head_index": 0,
            "n_head": n_head,
            "head_dim": head_dim,
            "attn_wq": _to_float_matrix(attn_wq),
            "attn_wk": _to_float_matrix(attn_wk),
            "attn_wv": _to_float_matrix(attn_wv),
        },
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
                "n_head": snapshot["attention"]["n_head"],
                "head_dim": snapshot["attention"]["head_dim"],
            },
            ensure_ascii=False,
        ),
    )


if __name__ == "__main__":
    main()
