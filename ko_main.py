"""
Train, save, and run inference for Korean-name GPT (Jamo-token based).
"""

import math
import os
import pickle
import random
import re
import unicodedata


DATA_PATH = "data/ko_name.txt"
CHECKPOINT_PATH = "checkpoints/ko_model.pkl"

RANDOM_SEED = 42
NUM_STEPS = 1000
NUM_SAMPLES = 20
TEMPERATURE = 0.5
MAX_TOKENS = None

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


def load_dataset(data_path=DATA_PATH):
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Required dataset file not found: {os.path.abspath(data_path)}")

    raw_docs = [line.strip() for line in open(data_path, encoding="utf-8") if line.strip()]
    hangul_docs = [name for name in raw_docs if re.fullmatch(r"[가-힣]+", name)]

    print(f"raw docs: {len(raw_docs)}")
    print(f"filtered docs: {len(hangul_docs)}")
    print(f"dropped: {len(raw_docs) - len(hangul_docs)}")
    if not hangul_docs:
        raise ValueError("No valid Hangul names found after filtering with ^[가-힣]+$.")

    docs = [unicodedata.normalize("NFD", name) for name in hangul_docs]
    random.shuffle(docs)
    print(f"num docs: {len(docs)}")
    return docs, set(hangul_docs)


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


def to_value_state_dict(float_state_dict):
    return {name: [[Value(v) for v in row] for row in mat] for name, mat in float_state_dict.items()}


def save(path, state_dict, config, tokenizer, dataset_names):
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

    checkpoint_dir = os.path.dirname(path)
    if checkpoint_dir:
        os.makedirs(checkpoint_dir, exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(checkpoint, f)

    print(f"saved checkpoint: {os.path.abspath(path)}")
    return checkpoint


def load_checkpoint(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Checkpoint not found: {os.path.abspath(path)}")
    with open(path, "rb") as f:
        checkpoint = pickle.load(f)
    for key in ("config", "tokenizer", "state_dict"):
        if key not in checkpoint:
            raise ValueError(f"Invalid checkpoint format: missing key '{key}'.")
    return checkpoint


def inference(checkpoint, num_samples=NUM_SAMPLES, temperature=TEMPERATURE, seed=RANDOM_SEED, max_tokens=MAX_TOKENS):
    if num_samples <= 0:
        raise ValueError("num_samples must be > 0")
    if temperature <= 0:
        raise ValueError("temperature must be > 0")

    if isinstance(checkpoint, str):
        checkpoint_path = checkpoint
        checkpoint = load_checkpoint(checkpoint_path)
        print(f"loaded checkpoint: {os.path.abspath(checkpoint_path)}")

    config = checkpoint["config"]
    tokenizer = checkpoint["tokenizer"]
    state_dict = to_value_state_dict(checkpoint["state_dict"])
    dataset_names_set = set(checkpoint.get("dataset_names", []))

    n_embd = config["n_embd"]
    n_head = config["n_head"]
    if n_embd % n_head != 0:
        raise ValueError(f"Invalid config: n_embd ({n_embd}) is not divisible by n_head ({n_head})")

    block_size = config["block_size"]
    n_layer = config["n_layer"]
    uchars = tokenizer["uchars"]
    bos = tokenizer["BOS"]
    vocab_size = tokenizer["vocab_size"]

    if max_tokens is None:
        max_tokens = block_size
    else:
        max_tokens = min(max_tokens, block_size)
    if max_tokens <= 0:
        raise ValueError("max_tokens must be > 0")

    random.seed(seed)

    print(f"vocab size: {vocab_size}")
    print(f"block size: {block_size}")
    print("\n--- inference ---")

    results = []
    for sample_idx in range(num_samples):
        keys, values = [[] for _ in range(n_layer)], [[] for _ in range(n_layer)]
        token_id = bos
        sample_chars = []

        for pos_id in range(max_tokens):
            logits = gpt(token_id, pos_id, keys, values, state_dict, config)
            probs = softmax([l / temperature for l in logits])
            token_id = random.choices(range(vocab_size), weights=[p.data for p in probs])[0]
            if token_id == bos:
                break
            sample_chars.append(uchars[token_id])

        jamo_text = "".join(sample_chars)
        ko_text = unicodedata.normalize("NFC", jamo_text)
        in_dataset = ko_text in dataset_names_set if dataset_names_set else "N/A"
        print(f"sample {sample_idx+1:2d}: {ko_text} | in_dataset: {in_dataset}")
        results.append({"ko_text": ko_text, "jamo_text": jamo_text, "in_dataset": in_dataset})

    return results


def main():
    random.seed(RANDOM_SEED)
    docs, dataset_names = load_dataset(DATA_PATH)
    tokenizer = build_tokenizer(docs)
    config = build_config()
    state_dict, params = init_model(tokenizer["vocab_size"], config)

    train(docs, tokenizer, state_dict, params, config)
    checkpoint = save(CHECKPOINT_PATH, state_dict, config, tokenizer, dataset_names)
    inference(
        checkpoint,
        num_samples=NUM_SAMPLES,
        temperature=TEMPERATURE,
        seed=RANDOM_SEED,
        max_tokens=MAX_TOKENS,
    )


if __name__ == "__main__":
    main()
