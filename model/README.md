# microgpt model (Korean Name Generator)

karpathy의 microgpt를 개조한 한글 이름 생성 모델 파트입니다.
학습은 `model/ko_main.py`, 추론 전용 실행은 `model/ko_inference.py`로 분리되어 있습니다.

## 데이터 출처

본 프로젝트는 [yiunsr.tistory.com/885](https://yiunsr.tistory.com/885)에서 수집한 출생신고 데이터를 바탕으로 진행했습니다.

## 디렉터리 구조

- `model/ko_main.py`: 데이터 로드 -> 학습 -> 체크포인트 저장 -> 샘플 추론
- `model/ko_inference.py`: 저장된 체크포인트를 불러와 추론만 수행
- `model/data/ko_name.txt`: 학습 데이터
- `model/checkpoints/ko_model.pkl`: 학습 후 저장되는 모델 체크포인트
- `model/scripts/export_embedding_snapshot.py`: 체크포인트를 프론트 시각화 JSON으로 export
- `model/scripts/export_training_trace.py`: Chapter 6용 Adam 학습 trace JSON export

## 사용법

아래 명령은 저장소 루트(`/Users/jjy37/Documents/GitHub/microgpt`) 기준입니다.

### 1) 학습 + 샘플 추론 실행

```bash
python3 model/ko_main.py
```

실행 순서:

1. `model/data/ko_name.txt` 로드 및 한글 이름 필터링
2. 모델 학습
3. `model/checkpoints/ko_model.pkl` 저장
4. 샘플 이름 추론 결과 출력

### 2) 추론만 별도로 실행

```bash
python3 model/ko_inference.py
```

이미 저장된 체크포인트가 있을 때, 학습 없이 이름 생성 결과만 확인할 수 있습니다.

### 3) 프론트 시각화 스냅샷 생성

```bash
python3 model/scripts/export_embedding_snapshot.py
```

출력 파일:

- `app/public/data/ko_embedding_snapshot.json`

### 4) Chapter 6 학습 trace 생성

```bash
python3 model/scripts/export_training_trace.py
```

출력 파일:

- `app/public/data/ko_training_trace.json`
