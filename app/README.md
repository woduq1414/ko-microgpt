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

## OG Image

- OG 이미지는 Hero 섹션 화면을 캡처해 `app/public/og/hero.png`로 생성합니다.
- Chromium 브라우저 설치는 한 번만 수행하면 됩니다.

```bash
npm run og:image:install-browser
npm run og:image
```

- Hero 디자인/문구가 바뀌면 `npm run og:image`를 다시 실행해 최신 이미지로 갱신하세요.

## Data

- 앱은 `app/public/data/*`를 정적 파일로 서빙합니다.
- 예제 언어 URL 규칙:
  - `/` 또는 `/ko`: 한국어 예제 데이터
  - `/en`: 영어 예제 데이터
- 설명 언어(문구)는 Language 모달에서 별도로 선택되며 쿠키(`microgpt_desc_lang`)로 저장됩니다.
- 데이터 파일은 언어별 접두사로 분리됩니다.
  - `app/public/data/ko_*`
  - `app/public/data/en_*`
- 한국어 모델 체크포인트 기반 시각화 데이터(`ko_embedding_snapshot.json`) 및 trace(`ko_training_trace.json`)를 갱신하려면 저장소 루트에서 아래 명령을 실행합니다.

```bash
python3 model/scripts/export_embedding_snapshot.py
python3 model/scripts/export_training_trace.py
```

- 영어 데이터/체크포인트/스냅샷/trace를 한 번에 생성하려면 아래 명령을 실행합니다.

```bash
python3 model/scripts/generate_en_assets.py
```

- 모델 학습/추론 절차는 `model/README.md`를 참고하세요.

## Notes

- 메인 화면: `/Users/jjy37/Documents/GitHub/microgpt/app/src/App.jsx`
- 디자인 토큰/패턴: `/Users/jjy37/Documents/GitHub/microgpt/app/src/index.css`
- Vite + Tailwind 설정: `/Users/jjy37/Documents/GitHub/microgpt/app/vite.config.js`
