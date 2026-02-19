# microgpt (Korean Name Generator)

karpathy의 microgpt를 개조한 한글 이름을 생성하는 프로젝트입니다.  
학습은 `ko_main.py`, 추론 전용 실행은 `ko_inference.py`로 분리되어 있습니다.

## 데이터 출처

본 프로젝트는 [yiunsr.tistory.com/885](https://yiunsr.tistory.com/885)에서 수집한 출생신고 데이터를 바탕으로 진행했습니다.

## 프로젝트 구조

- `ko_main.py`: 데이터 로드 → 학습 → 체크포인트 저장 → 샘플 추론
- `ko_inference.py`: 저장된 체크포인트를 불러와 추론만 수행
- `data/ko_name.txt`: 학습 데이터
- `checkpoints/ko_model.pkl`: 학습 후 저장되는 모델 체크포인트

## 사용법

### 1) 학습 + 샘플 추론 실행

```bash
python3 ko_main.py
```

실행 시 다음 순서로 진행됩니다.

1. `data/ko_name.txt` 로드 및 한글 이름 필터링
2. 모델 학습
3. `checkpoints/ko_model.pkl` 저장
4. 샘플 이름 추론 결과 출력

### 2) 추론만 별도로 실행

```bash
python3 ko_inference.py
```

이미 저장된 체크포인트가 있을 때, 학습 없이 이름 생성 결과만 확인할 수 있습니다.

## 실행 결과 예시

```text
--- inference ---
sample  1: 아영 | in_dataset: True
sample  2: 하한 | in_dataset: False
sample  3: 경영 | in_dataset: False
sample  4: 규현 | in_dataset: True
sample  5: 선호 | in_dataset: True
sample  6: 중유 | in_dataset: False
sample  7: 응하 | in_dataset: False
sample  8: 선리 | in_dataset: False
sample  9: 선수 | in_dataset: False
sample 10: 영서 | in_dataset: True
sample 11: 유희 | in_dataset: True
sample 12: 새연 | in_dataset: False
sample 13: 해영 | in_dataset: True
sample 14: 성유 | in_dataset: False
sample 15: 영연 | in_dataset: False
sample 16: 유연 | in_dataset: True
sample 17: 인규 | in_dataset: True
sample 18: 영밀 | in_dataset: False
sample 19: 한수 | in_dataset: False
sample 20: 성소 | in_dataset: False
```

