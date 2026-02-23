#!/usr/bin/env python3
"""Generate English model/data assets for the frontend.

Outputs:
- model/data/en_name.txt
- model/checkpoints/en_model.pkl
- app/public/data/en_name.txt
- app/public/data/en_embedding_snapshot.json
- app/public/data/en_training_trace.json
"""

from __future__ import annotations

import json
import math
import pickle
import random
import re
import shutil
import urllib.request
from pathlib import Path
from typing import Any

MODEL_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = MODEL_ROOT.parent

DATA_URL = "https://raw.githubusercontent.com/karpathy/makemore/988aa59/names.txt"
DATA_PATH = MODEL_ROOT / "data" / "en_name.txt"
CHECKPOINT_PATH = MODEL_ROOT / "checkpoints" / "en_model.pkl"
APP_DATA_DIR = REPO_ROOT / "app" / "public" / "data"
APP_DATASET_PATH = APP_DATA_DIR / "en_name.txt"
APP_EMBEDDING_PATH = APP_DATA_DIR / "en_embedding_snapshot.json"
APP_TRACE_PATH = APP_DATA_DIR / "en_training_trace.json"

RANDOM_SEED = 42
NUM_STEPS = 1000
STEP_OPTIONS = [50, 100, 500, 1000]
ROUND_DIGITS = 4

N_LAYER = 1
N_EMBD = 16
BLOCK_SIZE = 16
N_HEAD = 4

LEARNING_RATE = 0.003
BETA1 = 0.85
BETA2 = 0.99
EPS_ADAM = 1e-8


class Value:
    __slots__ = ("data", "grad", "_children", "_local_grads")

    def __init__(self, data, children=(), local_grads=()):
        self.data = data
        self.grad = 0
        self._children = children
        self._local_grads = local_grads

    def __add__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        return Value(self.data + other.data, (self, other), (1, 1))

    def __mul__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        return Value(self.data * other.data, (self, other), (other.data, self.data))

    def __pow__(self, other):
        return Value(self.data**other, (self,), (other * self.data ** (other - 1),))

    def log(self):
        return Value(math.log(self.data), (self,), (1 / self.data,))

    def exp(self):
        return Value(math.exp(self.data), (self,), (math.exp(self.data),))

    def relu(self):
        return Value(max(0, self.data), (self,), (float(self.data > 0),))

    def __neg__(self):
        return self * -1

    def __radd__(self, other):
        return self + other

    def __sub__(self, other):
        return self + (-other)

    def __rsub__(self, other):
        return other + (-self)

    def __rmul__(self, other):
        return self * other

    def __truediv__(self, other):
        return self * other**-1

    def __rtruediv__(self, other):
        return other * self**-1

    def backward(self):
        topo = []
        visited = set()

        def build_topo(v):
            if v not in visited:
                visited.add(v)
                for child in v._children:
                    build_topo(child)
                topo.append(v)

        build_topo(self)
        self.grad = 1
        for v in reversed(topo):
            for child, local_grad in zip(v._children, v._local_grads):
                child.grad += local_grad * v.grad


def matrix(nout, nin, std=0.08):
    return [[Value(random.gauss(0, std)) for _ in range(nin)] for _ in range(nout)]


def linear(x, w):
    return [sum(wi * xi for wi, xi in zip(wo, x)) for wo in w]


def softmax(logits):
    max_val = max(val.data for val in logits)
    exps = [(val - max_val).exp() for val in logits]
    total = sum(exps)
    return [e / total for e in exps]


def rmsnorm(x):
    ms = sum(xi * xi for xi in x) / len(x)
    scale = (ms + 1e-5) ** -0.5
    return [xi * scale for xi in x]


def gpt(token_id, pos_id, keys, values, state_dict, config):
    n_layer = config["n_layer"]
    n_embd = config["n_embd"]
    n_head = config["n_head"]
    head_dim = n_embd // n_head

    tok_emb = state_dict["wte"][token_id]
    pos_emb = state_dict["wpe"][pos_id]
    x = [t + p for t, p in zip(tok_emb, pos_emb)]
    x = rmsnorm(x)

    for li in range(n_layer):
        x_residual = x
        x = rmsnorm(x)
        q = linear(x, state_dict[f"layer{li}.attn_wq"])
        k = linear(x, state_dict[f"layer{li}.attn_wk"])
        v = linear(x, state_dict[f"layer{li}.attn_wv"])
        keys[li].append(k)
        values[li].append(v)

        x_attn = []
        for h in range(n_head):
            hs = h * head_dim
            q_h = q[hs : hs + head_dim]
            k_h = [ki[hs : hs + head_dim] for ki in keys[li]]
            v_h = [vi[hs : hs + head_dim] for vi in values[li]]
            attn_logits = [
                sum(q_h[j] * k_h[t][j] for j in range(head_dim)) / head_dim**0.5
                for t in range(len(k_h))
            ]
            attn_weights = softmax(attn_logits)
            head_out = [
                sum(attn_weights[t] * v_h[t][j] for t in range(len(v_h)))
                for j in range(head_dim)
            ]
            x_attn.extend(head_out)

        x = linear(x_attn, state_dict[f"layer{li}.attn_wo"])
        x = [a + b for a, b in zip(x, x_residual)]

        x_residual = x
        x = rmsnorm(x)
        x = linear(x, state_dict[f"layer{li}.mlp_fc1"])
        x = [xi.relu() for xi in x]
        x = linear(x, state_dict[f"layer{li}.mlp_fc2"])
        x = [a + b for a, b in zip(x, x_residual)]

    return linear(x, state_dict["lm_head"])


def ensure_dataset() -> None:
    if DATA_PATH.exists():
        return
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading dataset: {DATA_URL}")
    urllib.request.urlretrieve(DATA_URL, DATA_PATH)


def load_dataset(data_path: Path = DATA_PATH):
    if not data_path.exists():
        raise FileNotFoundError(f"Required dataset file not found: {data_path.resolve()}")

    raw_docs = [line.strip().lower() for line in data_path.open(encoding="utf-8") if line.strip()]
    english_docs = [name for name in raw_docs if re.fullmatch(r"[a-z]+", name)]

    print(f"raw docs: {len(raw_docs)}")
    print(f"filtered docs: {len(english_docs)}")
    print(f"dropped: {len(raw_docs) - len(english_docs)}")
    if not english_docs:
        raise ValueError("No valid English names found after filtering with ^[a-z]+$.")

    docs = list(english_docs)
    random.shuffle(docs)
    print(f"num docs: {len(docs)}")
    return docs, set(english_docs)


def build_tokenizer(docs):
    uchars = sorted(set("".join(docs)))
    bos = len(uchars)
    vocab_size = len(uchars) + 1
    stoi = {ch: i for i, ch in enumerate(uchars)}
    print(f"vocab size: {vocab_size}")
    return {"uchars": uchars, "stoi": stoi, "BOS": bos, "vocab_size": vocab_size}


def build_config():
    return {
        "n_layer": N_LAYER,
        "n_embd": N_EMBD,
        "block_size": BLOCK_SIZE,
        "n_head": N_HEAD,
    }


def init_model(vocab_size, config):
    n_layer = config["n_layer"]
    n_embd = config["n_embd"]
    block_size = config["block_size"]

    state_dict = {
        "wte": matrix(vocab_size, n_embd),
        "wpe": matrix(block_size, n_embd),
        "lm_head": matrix(vocab_size, n_embd),
    }
    for i in range(n_layer):
        state_dict[f"layer{i}.attn_wq"] = matrix(n_embd, n_embd)
        state_dict[f"layer{i}.attn_wk"] = matrix(n_embd, n_embd)
        state_dict[f"layer{i}.attn_wv"] = matrix(n_embd, n_embd)
        state_dict[f"layer{i}.attn_wo"] = matrix(n_embd, n_embd)
        state_dict[f"layer{i}.mlp_fc1"] = matrix(4 * n_embd, n_embd)
        state_dict[f"layer{i}.mlp_fc2"] = matrix(n_embd, 4 * n_embd)

    params = [p for mat in state_dict.values() for row in mat for p in row]
    print(f"num params: {len(params)}")
    return state_dict, params


def train(
    docs,
    tokenizer,
    state_dict,
    params,
    config,
    num_steps=NUM_STEPS,
    learning_rate=LEARNING_RATE,
    beta1=BETA1,
    beta2=BETA2,
    eps_adam=EPS_ADAM,
):
    m = [0.0] * len(params)
    v = [0.0] * len(params)

    bos = tokenizer["BOS"]
    stoi = tokenizer["stoi"]
    block_size = config["block_size"]
    n_layer = config["n_layer"]

    for step in range(num_steps):
        doc = docs[step % len(docs)]
        tokens = [bos] + [stoi[ch] for ch in doc] + [bos]
        n = min(block_size, len(tokens) - 1)

        keys, values = [[] for _ in range(n_layer)], [[] for _ in range(n_layer)]
        losses = []
        for pos_id in range(n):
            token_id, target_id = tokens[pos_id], tokens[pos_id + 1]
            logits = gpt(token_id, pos_id, keys, values, state_dict, config)
            probs = softmax(logits)
            losses.append(-probs[target_id].log())
        loss = (1 / n) * sum(losses)

        loss.backward()

        lr_t = learning_rate * (1 - step / num_steps)
        for i, p in enumerate(params):
            m[i] = beta1 * m[i] + (1 - beta1) * p.grad
            v[i] = beta2 * v[i] + (1 - beta2) * p.grad**2
            m_hat = m[i] / (1 - beta1 ** (step + 1))
            v_hat = v[i] / (1 - beta2 ** (step + 1))
            p.data -= lr_t * m_hat / (v_hat**0.5 + eps_adam)
            p.grad = 0

        print(f"step {step+1:4d} / {num_steps:4d} | loss {loss.data:.4f}", end="\r")

    print()


def to_float_state_dict(state_dict):
    return {name: [[v.data for v in row] for row in mat] for name, mat in state_dict.items()}


def save_checkpoint(path, state_dict, config, tokenizer, dataset_names):
    checkpoint = {
        "format_version": 1,
        "config": config,
        "tokenizer": {
            "uchars": tokenizer["uchars"],
            "BOS": tokenizer["BOS"],
            "vocab_size": tokenizer["vocab_size"],
        },
        "state_dict": to_float_state_dict(state_dict),
        "dataset_names": sorted(dataset_names),
    }

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as f:
        pickle.dump(checkpoint, f)

    print(f"saved checkpoint: {path.resolve()}")
    return checkpoint


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


def export_embedding_snapshot(checkpoint: dict[str, Any], output_path: Path) -> None:
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
    attn_wo = _validate_matrix_shape(state_dict.get("layer0.attn_wo"), n_embd, n_embd, "layer0.attn_wo")
    mlp_fc1 = _validate_matrix_shape(state_dict.get("layer0.mlp_fc1"), 4 * n_embd, n_embd, "layer0.mlp_fc1")
    mlp_fc2 = _validate_matrix_shape(state_dict.get("layer0.mlp_fc2"), n_embd, 4 * n_embd, "layer0.mlp_fc2")
    lm_head = _validate_matrix_shape(state_dict.get("lm_head"), len(wte), n_embd, "lm_head")

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
            "attn_wo": _to_float_matrix(attn_wo),
        },
        "mlp": {
            "layer_index": 0,
            "mlp_fc1": _to_float_matrix(mlp_fc1),
            "mlp_fc2": _to_float_matrix(mlp_fc2),
        },
        "lm_head": _to_float_matrix(lm_head),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(snapshot, handle, ensure_ascii=False, indent=2)

    print(f"Saved embedding snapshot: {output_path}")


def _to_float(value: Any) -> float:
    raw = float(getattr(value, "data", value))
    return round(raw, ROUND_DIGITS)


def _to_float_vector(values: list[Any]) -> list[float]:
    return [_to_float(value) for value in values]


def _to_grad_vector(values: list[Any]) -> list[float]:
    return [round(float(getattr(value, "grad", 0.0)), ROUND_DIGITS) for value in values]


def _resolve_parameter_options(tokenizer: dict[str, Any]) -> list[dict[str, Any]]:
    stoi = tokenizer.get("stoi", {})
    uchars = tokenizer.get("uchars", [])
    if not isinstance(stoi, dict):
        raise ValueError("Tokenizer stoi is missing.")
    if not isinstance(uchars, list) or not uchars:
        raise ValueError("Tokenizer uchars is missing.")

    used_token_ids: set[int] = set()

    def pick_token(preferred_chars: list[str]) -> tuple[str, int]:
        for char in preferred_chars:
            token_id = stoi.get(char)
            if isinstance(token_id, int) and token_id not in used_token_ids:
                used_token_ids.add(token_id)
                return char, token_id
        for char in uchars:
            token_id = stoi.get(char)
            if isinstance(token_id, int) and token_id not in used_token_ids:
                used_token_ids.add(token_id)
                return char, token_id
        raise ValueError("Unable to select token for trace parameter options.")

    letter_a, token_a = pick_token(["a"])
    letter_e, token_e = pick_token(["e"])

    return [
        {
            "id": f"token_letter_{letter_a}",
            "label": f"Letter {letter_a} token embedding",
            "matrix": "wte",
            "row_index": token_a,
            "token_char_nfd": letter_a,
            "token_char_display": letter_a,
        },
        {
            "id": f"lm_head_letter_{letter_e}",
            "label": f"Letter {letter_e} LM Head parameter",
            "matrix": "lm_head",
            "row_index": token_e,
            "token_char_nfd": letter_e,
            "token_char_display": letter_e,
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
    matrix_data = state_dict.get(matrix_name)
    if not isinstance(matrix_data, list):
        raise ValueError(f"State dict matrix '{matrix_name}' is missing.")
    if row_index < 0 or row_index >= len(matrix_data):
        raise ValueError(f"Invalid row index for '{matrix_name}': {row_index}")
    row = matrix_data[row_index]
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
    doc: str,
    tokenizer: dict[str, Any],
    state_dict: dict[str, Any],
    config: dict[str, Any],
) -> Any:
    bos = tokenizer["BOS"]
    stoi = tokenizer["stoi"]
    block_size = int(config["block_size"])
    n_layer = int(config["n_layer"])

    tokens = [bos] + [stoi[ch] for ch in doc] + [bos]
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


def generate_training_trace(output_path: Path) -> None:
    random.seed(RANDOM_SEED)
    docs, _dataset_names = load_dataset(DATA_PATH)
    tokenizer = build_tokenizer(docs)
    config = build_config()
    state_dict, params = init_model(tokenizer["vocab_size"], config)

    n_embd = int(config.get("n_embd", 0))
    if n_embd != 16:
        raise ValueError(f"Expected n_embd == 16, got {n_embd}")

    parameter_options = _resolve_parameter_options(tokenizer)
    initial_word = docs[0] if docs else ""
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
        doc = docs[step % len(docs)]
        loss = _compute_loss_for_doc(doc, tokenizer, state_dict, config)
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
                "word": doc,
                "loss": round(float(loss.data), ROUND_DIGITS),
                "learning_rate": round(float(lr_t), ROUND_DIGITS),
                "params": step_params_payload,
            }
        )
        print(f"trace step {step + 1:4d} / {NUM_STEPS:4d}", end="\r")

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


def main() -> None:
    ensure_dataset()

    random.seed(RANDOM_SEED)
    docs, dataset_names = load_dataset(DATA_PATH)
    tokenizer = build_tokenizer(docs)
    config = build_config()
    state_dict, params = init_model(tokenizer["vocab_size"], config)

    train(docs, tokenizer, state_dict, params, config)
    checkpoint = save_checkpoint(CHECKPOINT_PATH, state_dict, config, tokenizer, dataset_names)

    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(DATA_PATH, APP_DATASET_PATH)
    print(f"Synced dataset: {APP_DATASET_PATH}")

    export_embedding_snapshot(checkpoint, APP_EMBEDDING_PATH)
    generate_training_trace(APP_TRACE_PATH)

    print("English assets are ready.")


if __name__ == "__main__":
    main()
