# AtomFolio +

투자 CSV를 업로드하면 종목 구성, 수익 흐름, 자산 비중, 위험/분산 상태를 원자형 포트폴리오 화면으로 분석해 주는 React 웹 대시보드입니다.

- 배포 주소: [https://atomfolio-plus.vercel.app](https://atomfolio-plus.vercel.app)
- 저장소: [github.com/amuldi/AtomFolio](https://github.com/amuldi/AtomFolio)
- 형태: React 18 + Vite SPA, Node.js API, Vercel Functions
- 핵심 문서: [Skills.md](Skills.md)

## 실행 화면

### 초기 아이디어 스케치

종목을 표가 아니라 하나의 중심 포트폴리오에서 뻗어 나가는 원자 구조로 보여주자는 아이디어에서 시작했습니다.

![AtomFolio 초기 스케치](docs/assets/atomfolio-concept-sketch.png)

### 업로드 전 첫 화면

중앙의 원자 코어와 업로드 버튼만 남겨, 사용자가 CSV를 넣는 행위에 집중하도록 구성했습니다.

![AtomFolio 홈 화면](docs/assets/atomfolio-home.png)

### CSV 업로드 후 대시보드

샘플 포트폴리오를 업로드하면 종목별 노드, 수익 캘린더, 레이더 점수, 자산 비중 도구가 함께 열립니다.
이때 도구는 사용자의 취향에 따라 이동시킬 수 있습니다.

<img width="1506" height="799" alt="스크린샷 2026-05-04 오후 6 31 36" src="https://github.com/user-attachments/assets/036b3b7c-abbd-4021-b9d4-db421580d0d1" />


## 프로젝트를 만든 과정

### 1. 문제 정의

투자 내역 CSV는 증권사, 자산관리 앱, 개인 기록 방식마다 컬럼명이 다릅니다. 그래서 고정 템플릿을 요구하는 대신, `종목명`, `ticker`, `date`, `수익률`, `손익`, `비중`, `계좌유형`처럼 다양한 컬럼 후보를 자동으로 해석하는 방향으로 잡았습니다.

### 2. 손그림 기반 UI 콘셉트

처음에는 종목을 표나 카드로 나열하지 않고, 중심 포트폴리오에서 여러 보유 종목이 뻗어 나오는 구조를 손으로 그렸습니다. 이 스케치가 현재 앱의 원자형 시각화, 손그림 스타일 아이콘, 어두운 우주 배경, 중심 코어 인터랙션의 기준이 되었습니다.

### 3. CSV 파서와 데이터 진단 구현

브라우저에서 파일을 읽고 서버 API로 전송한 뒤, 서버가 구분자와 헤더를 추론합니다. UTF-8과 EUC-KR을 모두 고려하고, 헤더가 애매한 CSV도 값 패턴을 보고 날짜/종목/수익률 후보를 찾습니다.

### 4. 종목 메타데이터 보강

`미국`, `선진국`, `기술`, `고위험` 같은 분류 값이 종목명으로 오인되지 않도록 제외 규칙을 만들었습니다. 반대로 `TIGER`, `KODEX`, `SPDR`, `iShares`, `NASDAQ`, `S&P`, `ETF` 같은 단서는 종목 또는 ETF 이름으로 인정해 지역, 분야, 투자 스타일, 위험 등급, 자산군을 보강합니다.

### 5. 원자형 포트폴리오와 분석 도구

업로드된 포트폴리오는 중심 원자와 주변 종목 노드로 렌더링됩니다. 이후 플로팅 도구로 그룹 하이라이트, 수익 캘린더 히트맵, 레이더 점수, 자산 비중 도넛 차트를 추가했습니다. 도구 위치는 화면 크기와 사용자의 드래그 위치를 고려해 계산하고 localStorage에 저장합니다.

### 6. Vercel 배포

초기 Node.js 서버 API를 Vercel Functions에서도 동작하도록 `api/` 엔트리를 추가했습니다. Vite 빌드 산출물은 `dist/`로 배포하고, SPA 라우팅을 위해 `vercel.json`에 fallback rewrite를 설정했습니다.

## 주요 기능

| 기능 | 설명 |
| --- | --- |
| CSV 자동 인식 | CSV, TSV, 세미콜론, 파이프 구분 텍스트를 처리하고 컬럼 의미를 추론합니다. |
| 원자형 포트폴리오 | 중앙 원자는 전체 포트폴리오, 주변 원자는 개별 종목을 의미합니다. |
| 종목 상세 hover | 종목명, 코드, 계좌유형, 매수일, 수익률, 지역, 분야, 스타일, 위험, 자산군을 확인합니다. |
| 그룹 하이라이트 | 투자 지역, 분야, 스타일, 위험 등급 기준으로 같은 그룹의 종목을 강조합니다. |
| 수익 캘린더 히트맵 | 날짜별 수익률 또는 손익 흐름을 GitHub 잔디밭 형태로 표시합니다. |
| 자산 비중 도넛 | 종목, 자산군, 계좌 기준 비중과 가중 평균 총 수익률을 계산합니다. |
| 레이더 점수 | 수익성, 분산투자, 위험관리, 포트폴리오 구성, 투자 타이밍, 수익 안정성을 점수화합니다. |
| 다중 포트폴리오 | 여러 CSV를 업로드해 포트폴리오별 구성을 비교할 수 있습니다. |

## 데이터 처리 흐름

```text
CSV 업로드
  -> 브라우저에서 파일 텍스트 읽기
  -> /api/portfolio/ingest POST 요청
  -> parsePortfolioTextDetailed로 구분자, 헤더, 컬럼, 행 분석
  -> securityKnowledge / securityEnrichment로 종목 메타데이터 보강
  -> timelineItems에 원본 시계열 유지
  -> collapsePortfolioItemsForDisplay로 화면용 종목 축약
  -> schemaMapper / qualityGuard / explanationAgent 진단
  -> 프런트에서 원자 뷰, 히트맵, 도넛, 레이더 점수 렌더링
```

## 레이더 점수 기준

| 축 | 평가 기준 |
| --- | --- |
| 수익성 | 평균 수익률, 플러스 종목 비율, 하방 변동성 |
| 분산투자 | 종목 수, 자산군, 분야, 지역, 스타일 분산 |
| 위험관리 | 고위험 비중, 저위험 비중, 방어형 비중, 집중도 |
| 포트폴리오 구성 | 메타데이터 충실도와 자산/분야 균형 |
| 투자 타이밍 | 매수일 분산, 월별 분산, 투자 기간 |
| 수익 안정성 | 변동성, 손실 종목 비율, 방어형 비중 |

점수 가중치 프리셋은 `균형 중심`, `수익 중심`, `장기수익 중심`, `안정 중심`을 제공합니다.

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| Frontend | React 18, Vite |
| Visualization | SVG 기반 인터랙션, 커스텀 레이아웃/모션 유틸리티 |
| Backend | Node.js HTTP API, Vercel Functions |
| Data | CSV/TSV 파싱, 컬럼 추론, 종목 메타데이터 보강 |
| State | React state, localStorage |
| Deploy | Vercel |

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

개발 서버는 Vite 프런트엔드와 Node.js API 서버를 함께 실행합니다.

### 3. 프로덕션 빌드

```bash
npm run build
```

### 4. 빌드 결과 미리보기

```bash
npm run preview
```

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/api/health` | 서버 상태와 종목 보강 캐시 상태 확인 |
| `POST` | `/api/portfolio/ingest` | CSV 텍스트를 파싱하고 보강/진단 결과 반환 |
| `POST` | `/api/securities/enrich` | 종목 리스트 또는 식별자 기반 메타데이터 보강 |

`/api/portfolio/ingest` 요청 예시:

```json
{
  "fileName": "portfolio.csv",
  "text": "종목명,날짜,수익률\nTIGER 미국S&P500,2026-01-01,1.2%"
}
```

## 프로젝트 구조

```text
api/
  health.js                       # Vercel health function
  portfolio/ingest.js             # Vercel portfolio ingest function
  securities/enrich.js            # Vercel security enrichment function
src/
  App.jsx                         # 메인 화면, 업로드, 상태, 도구 연결
  main.jsx                        # React 엔트리
  styles.css                      # 전체 스타일과 반응형 UI
  components/
    allocation/                   # 자산 비중 도넛 차트
    atom/                         # 원자형 포트폴리오 시각화
    cards/                        # hover, 히트맵, 점수 카드
    icons/                        # 손그림 스타일 SVG 아이콘
    panels/                       # 플로팅 그룹/히트맵/레이더 도구
  constants/                      # UI 크기, 씬 설정, 로컬 스토리지 키
  hooks/                          # 드래그 가능한 플로팅 도구 훅
  lib/                            # CSV 파싱, 히트맵, 자산 비중, 점수 계산
  utils/                          # 포맷, 수학, 레이아웃, 저장소 유틸리티
server/
  index.mjs                       # 로컬 API 서버와 정적 파일 서빙
  dev.mjs                         # 프런트/백엔드 동시 개발 실행
  portfolioIngestion.mjs          # 서버 측 업로드 파이프라인
  securityEnrichment.mjs          # 서버 측 종목 보강
  agents/                         # 스키마/품질/설명 진단 모듈
samples/portfolio/                # 검증용 투자 CSV
docs/assets/                      # README 이미지와 실행 화면
docs/proposal/                    # 기획서 원문/HTML/PDF
submission/                       # 제출용 PDF와 개발 산출물 ZIP
Skills.md                         # 분석/구현 규칙 문서
vercel.json                       # Vercel 빌드/라우팅 설정
```

## 검증

이번 배포와 README 갱신 과정에서 확인한 항목입니다.

```bash
npm run build
curl -s https://atomfolio-plus.vercel.app/api/health
curl -s -X POST https://atomfolio-plus.vercel.app/api/portfolio/ingest \
  -H 'Content-Type: application/json' \
  -d '{"fileName":"smoke.csv","text":"종목명,날짜,수익률\nTIGER 미국S&P500,2026-01-01,1.2%"}'
```

검증 결과:

- Vite 프로덕션 빌드 성공
- Vercel 프로덕션 배포 성공
- 메인 페이지 `200 OK`
- `/api/health` 정상 응답
- `/api/portfolio/ingest` 샘플 CSV 처리 성공

## 향후 개선 아이디어

- 벤치마크 지수 대비 수익률 비교
- 자산군/지역/위험 편중 기반 리밸런싱 제안
- 최대 낙폭, 변동성, 샤프 비율, 월별 수익률 분포 추가
- 현재 대시보드 상태를 기반으로 PDF 리포트 자동 생성
- 여러 포트폴리오 간 계좌별, 전략별, 기간별 비교 강화

## 주의 사항

이 프로젝트는 투자 데이터를 시각화하고 분석 기준을 설명하는 대시보드입니다. 표시되는 점수와 분류는 투자 판단을 돕기 위한 참고 정보이며, 금융 투자 자문이나 매매 권유가 아닙니다.
