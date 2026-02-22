# microgpt
<img width="3024" height="1530" alt="image" src="https://github.com/user-attachments/assets/efda1efe-969b-4b95-b783-15716f7da16d" />
<img width="3024" height="1530" alt="image" src="https://github.com/user-attachments/assets/48d7fd78-b176-478e-9e0d-f19afb1adcdb" />
<img width="2858" height="1765" alt="image" src="https://github.com/user-attachments/assets/a5198150-646b-4e75-a604-28cd0e990758" />
<img width="2863" height="1943" alt="image" src="https://github.com/user-attachments/assets/5a5fe0eb-44a8-40df-aad8-2dafac3b5c79" />
<img width="2852" height="4154" alt="image" src="https://github.com/user-attachments/assets/fef019de-ab47-4836-9f11-79583798b543" />
<img width="2872" height="6221" alt="image" src="https://github.com/user-attachments/assets/f95e350f-ff10-4973-a1e3-5e05f49b3a20" />
<img width="2869" height="2289" alt="image" src="https://github.com/user-attachments/assets/4e287f1d-208d-4a92-8c28-af1f77dfdadc" />
<img width="2865" height="2031" alt="image" src="https://github.com/user-attachments/assets/cfe0460e-7563-4092-9e38-11644098d152" />



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
