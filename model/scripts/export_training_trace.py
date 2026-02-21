#!/usr/bin/env python3
"""Export training trace JSON for frontend Chapter 6 visualization."""

from __future__ import annotations

import json
import random
import sys
import unicodedata
from pathlib import Path
from typing import Any

MODEL_ROOT = Path(__file__).resolve().parents[1]
if str(MODEL_ROOT) not in sys.path:
    sys.path.insert(0, str(MODEL_ROOT))

from ko_main import (  # noqa: E402
    BETA1,
    BETA2,
    EPS_ADAM,
    LEARNING_RATE,
    NUM_STEPS,
    RANDOM_SEED,
    build_config,
    build_tokenizer,
    gpt,
    init_model,
    load_dataset,
    softmax,
)

STEP_OPTIONS = [50, 100, 500, 1000]
ROUND_DIGITS = 8
CHOSEONG_IEUNG_NFD = "\u110b"
CHOSEONG_SIOS_NFD = "\u1109"


def _to_float(value: Any) -> float:
    raw = float(getattr(value, "data", value))
    return round(raw, ROUND_DIGITS)


def _to_float_vector(values: list[Any]) -> list[float]:
    return [_to_float(value) for value in values]


def _to_grad_vector(values: list[Any]) -> list[float]:
    return [round(float(getattr(value, "grad", 0.0)), ROUND_DIGITS) for value in values]


def _resolve_parameter_options(tokenizer: dict[str, Any]) -> list[dict[str, Any]]:
    stoi = tokenizer.get("stoi", {})
    if not isinstance(stoi, dict):
        raise ValueError("Tokenizer stoi is missing.")

    ieung_token_id = stoi.get(CHOSEONG_IEUNG_NFD)
    sios_token_id = stoi.get(CHOSEONG_SIOS_NFD)
    if not isinstance(ieung_token_id, int):
        raise ValueError("Tokenizer does not include 초성 ㅇ (U+110B).")
    if not isinstance(sios_token_id, int):
        raise ValueError("Tokenizer does not include 초성 ㅅ (U+1109).")

    return [
        {
            "id": "token_choseong_ieung",
            "label": "초성 ㅇ token embedding",
            "matrix": "wte",
            "row_index": ieung_token_id,
            "token_char_nfd": CHOSEONG_IEUNG_NFD,
            "token_char_display": "ㅇ",
        },
        {
            "id": "lm_head_choseong_sios",
            "label": "초성 ㅅ LM Head parameter",
            "matrix": "lm_head",
            "row_index": sios_token_id,
            "token_char_nfd": CHOSEONG_SIOS_NFD,
            "token_char_display": "ㅅ",
        },
        {
            "id": "position_0",
            "label": "POS 0 position embedding",
            "matrix": "wpe",
            "row_index": 0,
        },
        {
            "id": "attn_wq_row_0",
            "label": "W_Q row 0",
            "matrix": "attn_wq",
            "row_index": 0,
        },
    ]


def _get_tracked_row(state_dict: dict[str, Any], spec: dict[str, Any]) -> list[Any]:
    matrix_alias = {
        "attn_wq": "layer0.attn_wq",
    }
    matrix_name = matrix_alias.get(spec["matrix"], spec["matrix"])
    row_index = int(spec["row_index"])
    matrix = state_dict.get(matrix_name)
    if not isinstance(matrix, list):
        raise ValueError(f"State dict matrix '{matrix_name}' is missing.")
    if row_index < 0 or row_index >= len(matrix):
        raise ValueError(f"Invalid row index for '{matrix_name}': {row_index}")
    row = matrix[row_index]
    if not isinstance(row, list):
        raise ValueError(f"Invalid row type for '{matrix_name}[{row_index}]'.")
    return row


def _build_step_zero_entry(
    state_dict: dict[str, Any],
    parameter_options: list[dict[str, Any]],
    initial_word: str,
    learning_rate: float,
) -> dict[str, Any]:
    params_payload: dict[str, dict[str, list[float]]] = {}
    for spec in parameter_options:
        row = _get_tracked_row(state_dict, spec)
        after = _to_float_vector(row)
        params_payload[spec["id"]] = {
            "grad": [0.0] * len(after),
            "after": after,
        }

    return {
        "step": 0,
        "word": initial_word,
        "loss": None,
        "learning_rate": round(float(learning_rate), ROUND_DIGITS),
        "params": params_payload,
    }


def _compute_loss_for_doc(
    doc_nfd: str,
    tokenizer: dict[str, Any],
    state_dict: dict[str, Any],
    config: dict[str, Any],
) -> Any:
    bos = tokenizer["BOS"]
    stoi = tokenizer["stoi"]
    block_size = int(config["block_size"])
    n_layer = int(config["n_layer"])

    tokens = [bos] + [stoi[ch] for ch in doc_nfd] + [bos]
    n = min(block_size, len(tokens) - 1)
    if n <= 0:
        raise ValueError("Invalid training sample length for loss computation.")

    keys = [[] for _ in range(n_layer)]
    values = [[] for _ in range(n_layer)]
    losses = []
    for pos_id in range(n):
        token_id = tokens[pos_id]
        target_id = tokens[pos_id + 1]
        logits = gpt(token_id, pos_id, keys, values, state_dict, config)
        probs = softmax(logits)
        losses.append(-probs[target_id].log())
    return (1 / n) * sum(losses)


def main() -> None:
    repo_root = MODEL_ROOT.parent
    output_path = repo_root / "app" / "public" / "data" / "ko_training_trace.json"

    random.seed(RANDOM_SEED)
    docs, _dataset_names = load_dataset()
    tokenizer = build_tokenizer(docs)
    config = build_config()
    state_dict, params = init_model(tokenizer["vocab_size"], config)

    n_embd = int(config.get("n_embd", 0))
    if n_embd != 16:
        raise ValueError(f"Expected n_embd == 16, got {n_embd}")

    parameter_options = _resolve_parameter_options(tokenizer)
    initial_word = unicodedata.normalize("NFC", docs[0]) if docs else ""
    steps_payload = [
        _build_step_zero_entry(
            state_dict=state_dict,
            parameter_options=parameter_options,
            initial_word=initial_word,
            learning_rate=LEARNING_RATE,
        )
    ]

    m = [0.0] * len(params)
    v = [0.0] * len(params)

    for step in range(NUM_STEPS):
        doc_nfd = docs[step % len(docs)]
        loss = _compute_loss_for_doc(doc_nfd, tokenizer, state_dict, config)
        loss.backward()

        lr_t = LEARNING_RATE * (1 - step / NUM_STEPS)
        step_params_payload: dict[str, dict[str, list[float]]] = {}
        for spec in parameter_options:
            row = _get_tracked_row(state_dict, spec)
            step_params_payload[spec["id"]] = {
                "grad": _to_grad_vector(row),
                "after": [],
            }

        for param_index, parameter in enumerate(params):
            grad = float(getattr(parameter, "grad", 0.0))
            m[param_index] = BETA1 * m[param_index] + (1 - BETA1) * grad
            v[param_index] = BETA2 * v[param_index] + (1 - BETA2) * (grad**2)
            m_hat = m[param_index] / (1 - BETA1 ** (step + 1))
            v_hat = v[param_index] / (1 - BETA2 ** (step + 1))
            parameter.data -= lr_t * m_hat / ((v_hat**0.5) + EPS_ADAM)
            parameter.grad = 0.0

        for spec in parameter_options:
            row = _get_tracked_row(state_dict, spec)
            step_params_payload[spec["id"]]["after"] = _to_float_vector(row)

        steps_payload.append(
            {
                "step": step + 1,
                "word": unicodedata.normalize("NFC", doc_nfd),
                "loss": round(float(loss.data), ROUND_DIGITS),
                "learning_rate": round(float(lr_t), ROUND_DIGITS),
                "params": step_params_payload,
            }
        )
        print(f"step {step + 1:4d} / {NUM_STEPS:4d}", end="\r")

    print()

    payload = {
        "format_version": 1,
        "num_steps": NUM_STEPS,
        "step_options": STEP_OPTIONS,
        "optimizer": {
            "name": "Adam",
            "beta1": BETA1,
            "beta2": BETA2,
            "eps": EPS_ADAM,
            "base_learning_rate": LEARNING_RATE,
            "schedule": "linear_decay(lr_t = lr * (1 - step / num_steps))",
        },
        "parameter_options": parameter_options,
        "steps": steps_payload,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    print(f"Saved training trace: {output_path}")
    print(
        "Summary:",
        json.dumps(
            {
                "num_steps": payload["num_steps"],
                "step_options": payload["step_options"],
                "parameter_options": len(payload["parameter_options"]),
                "step_records": len(payload["steps"]),
            },
            ensure_ascii=False,
        ),
    )


if __name__ == "__main__":
    main()
