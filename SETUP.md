# 온라인 참가 설정

## 1. Supabase 프로젝트 만들기

1. [Supabase](https://supabase.com/)에서 새 프로젝트를 만듭니다.
2. **SQL Editor**에서 `supabase-schema.sql` 전체를 한 번 실행합니다.
3. **Authentication → Providers → Anonymous Sign-Ins**를 활성화합니다.
4. **Project Settings → API**에서 Project URL과 anon public key를 확인합니다.
5. `supabase-config.js`의 두 값을 해당 값으로 교체합니다.

`service_role` 키는 절대 HTML이나 설정 파일에 넣지 마세요. 브라우저에서는 anon key만 사용합니다.

## 2. 웹에 배포하기

폴더의 다음 파일을 같은 경로에 함께 배포합니다.

- `poker_timer-2.html`: 중앙 타이머 화면
- `participant.html`: 참가자 모바일 화면
- `supabase-config.js`: Supabase 공개 연결 설정

GitHub Pages, Cloudflare Pages, Netlify, Vercel 같은 정적 호스팅을 사용할 수 있습니다. QR코드는 중앙 화면의 현재 웹 주소를 기준으로 만들어지므로 `file://`로 직접 연 상태에서는 휴대폰 참가가 불가능합니다.

## 3. 사용하기

1. 배포된 `poker_timer-2.html`을 중앙 태블릿이나 모니터에서 엽니다.
2. **온라인 게임 방 만들기**를 누릅니다.
3. 표시된 QR코드를 참가자들이 촬영합니다.
4. 참가자가 닉네임을 입력하면 중앙 명단에 실시간으로 나타납니다.
5. 참가자는 자신의 화면에서 **리바인**을 누르고 확인합니다.

중앙 화면의 기존 수동 추가·증감·삭제 기능도 온라인 방에서 관리자 수정 기능으로 계속 사용할 수 있습니다.
한 게임 방의 참가자는 최대 9명이며, 중앙 수동 추가와 모바일 참가 모두 같은 제한을 적용받습니다.
