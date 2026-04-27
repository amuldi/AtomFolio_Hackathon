# AtomFolio + Skills

## 목적

AtomFolio +는 서로 다른 구조의 투자 CSV를 업로드하면 투자 포트폴리오를 자동 분석하고, 원자형 인터페이스와 보조 차트로 시각화하는 대시보드이다.

이 문서는 같은 결과물을 재현하기 위한 분석 규칙, 데이터 처리 규칙, 시각화 기준, UI 구성 지침을 정의한다.

## 생성할 서비스

- 이름: `AtomFolio +`
- 형태: React + Vite 기반 단일 페이지 웹앱
- 보조 서버: Node.js HTTP API
- 주요 경험: 사용자가 CSV를 업로드하면 자동으로 포트폴리오 원자 뷰, 수익 히트맵, 자산 비중 도넛, 레이더 점수 차트가 생성된다.
- 외부 API 키: 없어야 한다. 심사자가 별도 키 없이 실행 가능해야 한다.
- 언어: 한국어와 영어를 전환할 수 있어야 한다.

## 기술 스택

- Frontend: React 18, Vite
- Graphics: SVG 중심 인터랙션, Three.js 수학 유틸리티 사용
- Backend: Node.js `http` 모듈 기반 API
- Package scripts:
  - `npm run dev`: 프런트와 백엔드 개발 서버 실행
  - `npm run build`: Vite 프로덕션 빌드
  - `npm run preview`: 빌드 산출물을 백엔드 서버에서 정적 제공

## 화면 구성

첫 화면은 랜딩 페이지가 아니라 바로 사용할 수 있는 대시보드여야 한다.

### 기본 상태

- 중앙에 손그림 느낌의 원자형 포트폴리오 스케치를 표시한다.
- 업로드 전에는 기본 데모 종목을 보여주고, 업로드 버튼에 `투자 데이터를 업로드 해주세요` 문구를 표시한다.
- 배경은 어두운 스케치보드 느낌으로 구성한다.
- 버튼과 패널은 손으로 그린 선, 절제된 무채색, 얇은 외곽선 위주로 표현한다.

### 업로드 후

- 각 주변 원자는 한 개의 종목을 의미한다.
- 주변 원자 라벨은 `종목명 + 손익률` 또는 `종목명 + 수익률`만 노출한다.
- 같은 종목이 날짜만 다르게 반복되면 화면용 원자는 하나로 묶는다.
- 날짜별 원본 행은 `timelineItems`에 유지하고, 히트맵은 이 원본 흐름을 사용한다.
- 종목을 누르면 해당 종목과 같은 그룹의 원자를 강조한다.
- 원자 hover 카드에는 종목명, 종목코드, 계좌유형, 매수일, 매수가, 수량, 수익률, 지역, 분야, 스타일, 위험, 자산군 등 핵심 필드를 보여준다.

## 주요 도구

### 그룹 하이라이트

다음 기준으로 종목을 강조할 수 있어야 한다.

- `투자 지역`
- `분야`
- `투자 스타일`
- `위험 등급`

CSV에 해당 값이 없으면 종목명 또는 종목코드 기반 메타데이터 보강 결과를 사용한다.

### 수익 캘린더 히트맵

- GitHub 잔디밭처럼 주 단위 그리드로 표시한다.
- 기본 범위는 최근 24주다.
- 날짜 위에 커서를 올리면 날짜와 수익/손익 값을 보여준다.
- 수익률은 퍼센트 모드, 손익 금액은 절대값 모드로 구분한다.
- 날짜와 손익 데이터가 모두 없으면 빈 상태 문구를 보여준다.

### 자산 비중 도넛 차트

다음 기준을 지원한다.

- 자동
- 종목별 비중
- 자산군 기준
- 계좌 기준

비중 계산 우선순위는 다음과 같다.

1. 명시적 비중 컬럼
2. `매수가 * 보유수량`
3. 균등 비중

도넛 중앙에는 가중 평균 총 수익률을 표시한다.

### 레이더 점수 차트

다음 6개 축을 계산한다.

- 수익성
- 분산투자
- 위험관리
- 포트폴리오 구성
- 투자 타이밍
- 수익 안정성

각 축은 0~100점으로 표시하고, 전체 점수는 선택한 가중치 프리셋으로 계산한다.

지원 프리셋:

- 균형 중심
- 수익 중심
- 장기수익 중심
- 안정 중심

## 데이터 입력 규칙

### 파일 형식

- CSV, TSV, 세미콜론, 파이프 구분 텍스트를 처리한다.
- 따옴표가 포함된 CSV 셀을 정상 처리한다.
- UTF-8을 우선 디코딩하고, 깨짐 문자가 많으면 EUC-KR을 시도한다.
- 업로드 본문은 8MB 이하로 제한한다.

### 헤더 인식

다음 중 하나에 해당하는 행을 헤더로 본다.

- `종목`, `자산`, `ticker`, `date`, `return`, `계좌`, `비중`, `손익` 등 투자 키워드가 포함된 행
- 플레이스홀더 헤더가 많지만 본문 패턴으로 컬럼 추론이 가능한 행

헤더가 명확하지 않으면 본문 값 패턴으로 컬럼명을 추론한다.

### 핵심 컬럼 매핑

다음 필드로 표준화한다.

| 표준 필드 | 인식할 컬럼 예시 |
| --- | --- |
| `stockCode` | `종목코드`, `ticker`, `symbol`, `stockCode`, `securityCode` |
| `stockName` | `종목명`, `자산명`, `상품명`, `name`, `securityName`, `assetName`, `productName` |
| `accountId` | `계좌ID`, `계좌번호`, `accountId`, `accountNumber` |
| `accountType` | `계좌유형`, `계좌종류`, `accountType`, `accountKind` |
| `buyDate` | `날짜`, `일자`, `매수일`, `거래일`, `date`, `tradeDate`, `buyDate` |
| `buyPrice` | `매수가`, `매입가`, `평균단가`, `buyPrice`, `purchasePrice` |
| `shares` | `보유수량`, `수량`, `shares`, `quantity`, `holding` |
| `return` | `수익률`, `일일수익률`, `누적수익률`, `손익률`, `return`, `dailyReturn`, `performance` |
| `region` | `투자지역`, `지역`, `국가`, `region`, `market`, `country` |
| `sector` | `분야`, `업종`, `산업`, `섹터`, `sector`, `industry`, `theme` |
| `style` | `투자스타일`, `스타일`, `전략`, `style`, `strategy`, `factor` |
| `risk` | `위험등급`, `위험`, `리스크`, `risk`, `riskGrade`, `riskLevel` |
| `assetClass` | `자산구분`, `자산군`, `assetClass`, `assetType`, `assetCategory` |
| `currency` | `통화`, `currency`, `fx` |
| `benchmark` | `비교지수`, `벤치마크`, `benchmark` |

### 종목명 오인 방지

다음 값은 종목명이 아니라 메타데이터로 취급한다.

- 지역: `미국`, `한국`, `글로벌`, `선진국`, `신흥국`
- 분야: `기술`, `반도체`, `금융`, `에너지`, `바이오`
- 스타일: `성장주`, `가치주`, `배당주`, `방어형`
- 위험: `고위험`, `중위험`, `저위험`
- 자산군: `주식`, `채권`, `현금`, `ETF`, `펀드`
- 짧은 숫자: `40`, `10`, `70` 같은 비중 또는 수치형 값

반대로 다음 단서는 종목명으로 인정한다.

- `TIGER`, `KODEX`, `ARIRANG`, `ACE`, `KBSTAR`, `HANARO`, `SPDR`, `iShares`, `Vanguard`, `Invesco`
- `S&P`, `NASDAQ`, `MSCI`, `KOSPI`, `KOSDAQ`
- `ETF`, `ETN`, `fund`, `trust`
- 회사명 단서: `Inc`, `Corp`, `Holdings`, `전자`, `화학`, `바이오`, `반도체`

## 데이터 처리 파이프라인

1. 브라우저에서 파일을 읽는다.
2. `/api/portfolio/ingest`에 `{ fileName, text }`를 POST한다.
3. 서버는 `parsePortfolioTextDetailed`로 행과 컬럼을 분석한다.
4. `securityKnowledge`와 `securityEnrichment`로 종목 메타데이터를 보강한다.
5. 같은 종목의 반복 행은 `collapsePortfolioItemsForDisplay`로 표시용 종목 하나로 묶는다.
6. 원본 날짜 흐름은 `timelineItems`로 유지한다.
7. `schema-mapper`, `quality-guard`, `explanation-agent`가 업로드 진단 결과를 만든다.
8. 프런트는 서버 결과가 비정상적으로 날짜를 잃으면 로컬 파서 결과로 fallback한다.

## 종목 보강 규칙

종목명 또는 종목코드로 다음 메타데이터를 채운다.

- 투자 지역
- 분야
- 투자 스타일
- 위험 등급
- 자산 구분
- 통화
- 규모 분류
- 변동성
- 과세 구분
- 비교 지수

중요 규칙:

- 종목 정보만 보강한다.
- 행별 날짜, 수익률, 손익, 원본 필드는 보강 데이터로 덮어쓰지 않는다.
- 캐시를 재사용해도 첫 번째 행의 날짜나 손익이 다른 행에 복사되면 안 된다.

## 히트맵 분석 규칙

### 날짜 인식

다음 형식을 인식한다.

- `YYYY-MM-DD`
- `YYYY-MM-DD HH:mm:ss`
- `YYYY.MM.DD`
- `YYYY/MM/DD`
- `YYYYMMDD`
- `MM/DD/YYYY`

단, `40` 같은 짧은 숫자나 비중 값은 날짜로 보면 안 된다.

### 값 인식

퍼센트 컬럼 우선순위:

- `일일수익률(%)`
- `수익률`
- `누적수익률`
- `return`
- `dailyReturn`
- `performance`
- `change`

절대 손익 컬럼:

- `손익`
- `평가손익`
- `실현손익`
- `손익금액`
- `pnl`
- `profitLoss`

같은 날짜에 여러 행이 있으면 값을 합산 또는 평균 가능한 방식으로 집계하되, 퍼센트형 데이터는 수익률 흐름을 직관적으로 보이게 표시한다.

## 자산군 분류 규칙

### 현금성 자산

다음 단서가 있으면 `현금성 자산`으로 분류한다.

- `cash`, `CMA`, `MMF`, `money market`, `deposit`
- `예수금`, `현금`, `단기자금`, `단기채`, `파킹`

### 디지털 자산

- `bitcoin`, `BTC`, `ethereum`, `ETH`, `crypto`
- `가상자산`, `암호화폐`, `코인`

### 리츠/부동산

- `REIT`, `real estate`, `property`
- `부동산`, `리츠`

### 채권 ETF

- `bond`, `treasury`, `fixed income`, `credit`
- `채권`, `국채`, `회사채`

### 금/원자재 ETF

- `gold`, `silver`, `commodity`, `oil`, `copper`
- `금`, `은`, `원자재`, `원유`, `구리`

### 주식 ETF

ETF 단서가 있고 지역 단서가 있으면 다음으로 분류한다.

- 한국: `국내 주식 ETF`
- 미국: `미국 주식 ETF`
- 글로벌/선진국/신흥국: `글로벌 주식 ETF`
- 배당 단서 포함: `배당 ETF`

### 개별 주식

주식 또는 회사명 단서가 있으면 지역에 따라 다음으로 분류한다.

- `국내 주식`
- `미국 주식`
- `해외 주식`

## 레이더 점수 산정 규칙

### 공통

- 모든 축은 0~100 사이로 clamp한다.
- 결측이 있으면 중립 점수를 사용한다.
- 비중은 명시적 비중, 포지션 금액, 균등 비중 순서로 계산한다.

### 수익성

반영 요소:

- 평균 수익률
- 플러스 수익 종목 비율
- 수익률 변동성
- 하방 변동성

평균 수익률이 높고 플러스 종목이 많을수록 점수를 올린다. 변동성과 하방 변동성이 크면 점수를 낮춘다.

### 분산투자

반영 요소:

- 실질 보유 종목 수
- 분야 수
- 지역 수
- 스타일 수
- 자산군 수
- 각 그룹의 균형도

한 종목 또는 한 그룹에 집중될수록 점수를 낮춘다.

### 위험관리

반영 요소:

- 고위험 비중
- 중위험 비중
- 저위험 비중
- 방어형 자산 비중
- 집중도 패널티

고위험과 집중도가 높으면 낮추고, 저위험/방어형 비중과 분산도가 높으면 올린다.

### 포트폴리오 구성

반영 요소:

- 메타데이터 충실도
- 자산군 균형
- 분야 균형
- 지역 균형
- 보유 종목 분산

분석에 필요한 메타데이터가 풍부하고 구성 균형이 좋을수록 높인다.

### 투자 타이밍

반영 요소:

- 매수일 수
- 고유 월 수
- 고유 일 수
- 투자 기간 span

매수가 여러 날짜와 월에 분산되어 있으면 높이고, 한 시점에 몰려 있으면 낮춘다.

### 수익 안정성

반영 요소:

- 수익률 변동성
- 손실 종목 비율
- 방어형 비중
- 저위험 비중
- 고위험 비중
- 집중도

변동성, 손실 비율, 고위험 비중이 높으면 낮춘다.

## 업로드 진단 규칙

업로드 후 다음 진단을 만든다.

### 정상

- 종목명 또는 종목코드가 확정됨
- 날짜와 수익률이 있으면 히트맵 생성 가능
- 메타데이터 보강 후 그룹 분석 가능

### 검토 필요

- 종목명 매핑 신뢰도가 낮음
- 날짜 종류가 입력 행 수에 비해 너무 적음
- 표시 라벨이 종목명보다 메타값처럼 보임
- 자동 보강 후에도 메타데이터 충실도가 낮음

### 차단

- 종목명과 종목코드 모두 찾지 못함
- 파싱된 행은 있지만 표시용 종목이 없음

## 구현 파일 구성

동일한 결과를 만들려면 다음 구조를 유지한다.

```text
src/App.jsx
src/main.jsx
src/styles.css
src/lib/portfolioIngestionCore.js
src/lib/securityKnowledge.js
src/lib/portfolioHeatmap.js
src/lib/portfolioAllocation.js
src/lib/portfolioScoring.js
server/index.mjs
server/dev.mjs
server/portfolioIngestion.mjs
server/securityEnrichment.mjs
server/agents/contracts.mjs
server/agents/schemaMapper.mjs
server/agents/qualityGuard.mjs
server/agents/explanationAgent.mjs
server/agents/orchestrator.mjs
samples/portfolio/portfolio_test0.csv
samples/portfolio/portfolio_test1.csv
samples/portfolio/portfolio_test2.csv
samples/portfolio/portfolio_test3.csv
samples/portfolio/portfolio_test4.csv
samples/portfolio/portfolio_test5.csv
```

## API 규격

### `GET /api/health`

반환:

```json
{
  "ok": true,
  "securityEnrichment": {
    "size": 0
  }
}
```

### `POST /api/portfolio/ingest`

요청:

```json
{
  "fileName": "portfolio.csv",
  "text": "날짜,계좌유형,자산명,일일수익률(%)\n2026-01-01,ISA,TIGER 미국S&P500,1.2"
}
```

반환:

```json
{
  "fileName": "portfolio.csv",
  "itemCount": 1,
  "securityCount": 1,
  "items": [],
  "timelineItems": [],
  "parserDiagnostics": {},
  "agentReview": {},
  "securityEnrichment": {}
}
```

### `POST /api/securities/enrich`

요청은 `items` 또는 `identifiers` 배열을 받는다. 반환값은 보강된 종목 정보와 캐시 통계를 포함한다.

## 검증 기준

### 샘플 CSV 기대 동작

- `portfolio_test0.csv`
  - 날짜 컬럼 없음
  - 표시 종목 5개
  - 히트맵은 비거나 제한적으로 표시
- `portfolio_test1.csv`
  - 1,350개 행
  - 표시 종목 15개
  - 날짜별 히트맵 정상 표시
- `portfolio_test2.csv`
  - 1,080개 행
  - 표시 종목 11개
  - 날짜별 히트맵 정상 표시
- `portfolio_test5.csv`
  - 날짜 컬럼 없음
  - 히트맵 빈 상태 표시

### 실행 검증

다음 명령이 성공해야 한다.

```bash
npm install
npm run build
npm run dev
```

### 시각 검증

브라우저에서 다음을 확인한다.

- 업로드 전 원자 스케치가 보인다.
- CSV 업로드 후 종목 원자가 생성된다.
- 같은 종목의 날짜별 반복 행은 하나의 원자로 묶인다.
- 히트맵 셀이 날짜별로 표시된다.
- 도넛 차트가 자산 비중과 총 수익률을 표시한다.
- 레이더 차트가 6개 축과 설명 툴팁을 표시한다.
- 설정 패널에서 언어와 분석 기준을 변경할 수 있다.

## 금지 사항

- CSV의 메타데이터 값을 종목명으로 잘못 표시하지 않는다.
- 날짜별 행을 표시용 원자로 모두 펼쳐 화면을 혼잡하게 만들지 않는다.
- 외부 API 키가 필요한 기능을 필수 기능으로 만들지 않는다.
- 보강 캐시가 행별 날짜와 수익률을 덮어쓰지 않게 한다.
- 히트맵에서 숫자 비중을 날짜로 오인하지 않는다.
- 단순 랜딩 페이지를 첫 화면으로 만들지 않는다.

## 최종 산출물 조건

- `README.md`는 실행과 사용법을 간결하게 설명한다.
- `Skills.md`는 투자 분석 규칙과 구현 지침을 포함한다.
- 웹 링크는 외부에서 접속 가능해야 한다.
- 샘플 데이터 또는 공개 데이터를 사용해 심사자가 즉시 확인할 수 있어야 한다.
- GitHub 저장소를 제출하는 경우 위 파일 구조와 실행 스크립트를 유지한다.
