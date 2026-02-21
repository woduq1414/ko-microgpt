# MicroGPT Education Scroll Web

React + Tailwind + GSAP 기반의 교육용 풀스크린 스크롤 페이지입니다.

## Stack

- React 19
- Vite 7
- Tailwind CSS 4 (`@tailwindcss/vite`)
- GSAP + ScrollTrigger

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Data

- 앱은 `app/public/data/*`를 정적 파일로 서빙합니다.
- `app/public/data/ko_name.txt`는 프론트 표시용 데이터입니다.
- 모델 체크포인트 기반 시각화 데이터(`ko_embedding_snapshot.json`)를 갱신하려면 저장소 루트에서 아래 명령을 실행합니다.
- Chapter 6 학습 trace 데이터(`ko_training_trace.json`)를 갱신하려면 저장소 루트에서 아래 명령을 실행합니다.

```bash
python3 model/scripts/export_embedding_snapshot.py
python3 model/scripts/export_training_trace.py
```

- 모델 학습/추론 절차는 `model/README.md`를 참고하세요.

## Notes

- 메인 화면: `/Users/jjy37/Documents/GitHub/microgpt/app/src/App.jsx`
- 디자인 토큰/패턴: `/Users/jjy37/Documents/GitHub/microgpt/app/src/index.css`
- Vite + Tailwind 설정: `/Users/jjy37/Documents/GitHub/microgpt/app/vite.config.js`
