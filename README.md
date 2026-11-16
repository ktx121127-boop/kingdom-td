# 왕국 수비대 (Vercel 서버 버전)

구성: index.html(게임) + api/(가입·로그인·친구·거래·랭킹 서버) + package.json

## 처음 한 번만 (서버 저장소 연결)
1. vercel.com → 프로젝트(kingdom-td) → Storage 탭 → Create/Connect → **Upstash Redis**(Marketplace) 선택 → 무료 플랜으로 생성 → 프로젝트에 Connect.
   (환경변수 KV_REST_API_URL / KV_REST_API_TOKEN 이 자동으로 들어가요.)
2. Deployments 탭 → 최신 배포 ⋯ → **Redeploy** (환경변수는 새 배포부터 적용돼요).
3. 게임 첫 화면에 "☁️ 서버 연결됨"이 보이면 성공.

## 업데이트
GitHub 저장소에 index.html, package.json, api 폴더(4개 파일)를 올리면 자동 배포돼요.
