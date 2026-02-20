# microgpt

한글 이름 생성 모델과 이를 시각화/설명하는 교육용 웹 앱을 함께 담은 모노레포입니다.
Python 모델 학습/추론 자산은 `model/`에, React 프론트엔드는 `app/`에 분리되어 있습니다.

## 디렉터리 역할

- `app/`: React + Vite 기반 교육용 스크롤 UI
- `model/`: 학습/추론 코드, 데이터, 체크포인트, 스냅샷 export 스크립트

## 빠른 시작

### 프론트엔드

```bash
cd app
npm install
npm run dev
```

### 모델

```bash
python3 model/ko_main.py
python3 model/ko_inference.py
```

## 문서

- 프론트엔드 문서: `app/README.md`
- 모델 문서: `model/README.md`
