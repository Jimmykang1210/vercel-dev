# AEO / GEO Optimizer

## 로컬에서 실행하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 만들고 OpenAI API 키를 넣습니다.

```bash
OPENAI_API_KEY=sk-your-openai-api-key
```

> `.env.local`은 이미 `.gitignore`에 포함되어 있어 Git에 올라가지 않습니다.

### 3. 실행 방법

**방법 A – 프론트 + API 모두 실행 (권장)**

API(`/api/openai`, `/api/fetch-page`)까지 로컬에서 쓰려면 Vercel CLI로 실행합니다.

```bash
npx vercel dev
```

브라우저에서 `http://localhost:3000` 으로 접속하면 됩니다.

**방법 B – 프론트만 실행**

```bash
npm run dev
```

`http://localhost:5173` 에서 화면만 확인할 수 있습니다. API 라우트는 동작하지 않으므로, 분석·URL 추출 기능은 **방법 A**로 실행해야 합니다.

---

## 배포 (Vercel)

1. Vercel 프로젝트 **Settings → Environment Variables** 에서 `OPENAI_API_KEY` 추가
2. 저장소 연결 후 배포
