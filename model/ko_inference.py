"""
Inference-only entrypoint that reuses ko_main.inference().
"""

from ko_main import CHECKPOINT_PATH, MAX_TOKENS, NUM_SAMPLES, RANDOM_SEED, TEMPERATURE, inference


def main():
    inference(
        CHECKPOINT_PATH,
        num_samples=NUM_SAMPLES,
        temperature=TEMPERATURE,
        seed=RANDOM_SEED,
        max_tokens=MAX_TOKENS,
    )


if __name__ == "__main__":
    main()
