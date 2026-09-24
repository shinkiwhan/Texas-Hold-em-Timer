# 토너먼트 모드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 방 생성 시 데일리 또는 새틀라이트 모드를 선택하고, 선택한 블라인드 구조를 중앙·참가자·Supabase 복구 상태에 일관되게 적용한다.

**Architecture:** `poker-core.js`가 두 개의 불변 모드 프로필을 제공하고 모든 화면은 `PokerCore.getMode()`만 사용한다. 방의 `mode` 열이 온라인 상태의 기준이며, 기존 데이터와 알 수 없는 값은 데일리로 처리한다. 자체 팝업의 선택형 API로 모드를 받고, RPC가 허용 모드를 다시 검증한다.

**Tech Stack:** 정적 HTML/CSS/JavaScript, Node.js 내장 테스트 러너, Supabase PostgreSQL/RLS/RPC/Realtime, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-09-24-tournament-modes-design.md`

## 전체 제약 조건

- 데일리 모드의 기존 17단계와 7분 블라인드는 변경하지 않는다.
- 새틀라이트 블라인드는 10분, 휴식은 블라인드 5레벨마다 5분, 앤티는 사용하지 않는다.
- 방 생성 후 모드는 변경할 수 없다.
- 기존 방과 기존 로컬 저장 상태는 데일리 모드로 호환한다.
- 외부 라이브러리를 추가하지 않는다.
- 추적되지 않은 `MANUAL.md`는 수정하거나 커밋하지 않는다.

## 검토 중점

- 모드 선택을 취소하면 방과 로컬 타이머가 전혀 바뀌지 않아야 한다. Task 3 정적 테스트와 수동 검증에서 확인한다.
- 새틀라이트 방 생성 RPC가 실패하면 이전 모드·레벨·남은 시간이 복원되어야 한다. Task 3 테스트에서 복원 경로 존재를 확인한다.
- 기존 `mode` 없는 로컬 저장값과 기존 DB 행은 데일리로 열려야 한다. Task 1과 Task 5에서 검증한다.
- 휴식 직전 여러 레벨 시간이 한꺼번에 경과해도 올바른 새틀라이트 단계와 남은 시간이 계산되어야 한다. Task 1 단위 테스트에서 확인한다.
- 방 복구 중 로컬 모드가 다르더라도 DB 방 모드가 우선해야 한다. Task 3 정적 테스트와 실제 브라우저 복구 검증에서 확인한다.

---

### Task 1: 공통 모드 프로필을 테스트 주도로 추가

**Files:**
- Modify: `tests/poker-core.test.cjs`
- Modify: `poker-core.js`

**Interfaces:**
- Produces: `PokerCore.MODES: Readonly<Record<'daily'|'satellite', ModeProfile>>`
- Produces: `PokerCore.getMode(modeId): ModeProfile`
- Preserves: `PokerCore.LEVELS` as the daily-level compatibility alias
- Consumes later: `ModeProfile = { id, label, blindMinutes, levels }`

- [ ] **Step 1: 실패하는 모드 프로필 테스트 작성**

`tests/poker-core.test.cjs`에 다음 검증을 추가한다.

```js
test('mode lookup defaults to daily and preserves legacy levels', () => {
  assert.equal(core.getMode().id, 'daily');
  assert.equal(core.getMode('unknown').id, 'daily');
  assert.equal(core.getMode('daily').levels, core.LEVELS);
  assert.equal(core.MODES.daily.levels.length, 17);
  assert.ok(Object.isFrozen(core.MODES));
  assert.ok(Object.isFrozen(core.MODES.satellite.levels));
});

test('satellite structure uses ten-minute blinds and five-level breaks', () => {
  const levels = core.MODES.satellite.levels;
  const blinds = levels.filter(level => level.type === 'blind');
  assert.equal(blinds.length, 26);
  assert.deepEqual(blinds.slice(0, 10).map(({ sb, bb }) => [sb, bb]), [
    [100, 200], [200, 400], [300, 600], [400, 800], [500, 1000],
    [600, 1200], [800, 1600], [1000, 2000], [1500, 3000], [2000, 4000],
  ]);
  assert.ok(blinds.every(level => level.minutes === 10));
  assert.deepEqual(levels.filter(level => level.type === 'break').map(level => level.minutes), [5, 5, 5, 5, 5]);
  for (const stage of [5, 11, 17, 23, 29]) assert.equal(levels[stage].type, 'break');
});

test('satellite elapsed catch-up crosses a break correctly', () => {
  const levels = core.MODES.satellite.levels;
  const result = core.advanceExpired(4, -(5 * 60000 + 30000), levels);
  assert.equal(result.currentLevel, 6);
  assert.equal(result.remainingMs, 9.5 * 60000);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/poker-core.test.cjs`

Expected: `core.getMode is not a function` 또는 `core.MODES` 미정의로 FAIL.

- [ ] **Step 3: 불변 모드 프로필 최소 구현**

`poker-core.js`에서 기존 배열을 `DAILY_LEVELS`로 이름을 바꾸고 다음 새틀라이트 블라인드를 5개씩 묶어 각 묶음 사이에 `{ type: 'break', minutes: 5 }`를 삽입한다.

```js
const SATELLITE_BLINDS = [
  [100,200], [200,400], [300,600], [400,800], [500,1000],
  [600,1200], [800,1600], [1000,2000], [1500,3000], [2000,4000],
  [3000,6000], [4000,8000], [5000,10000], [6000,12000], [8000,16000],
  [10000,20000], [12000,24000], [15000,30000], [20000,40000], [25000,50000],
  [30000,60000], [40000,80000], [50000,100000], [60000,120000], [80000,160000],
  [100000,200000],
];

const SATELLITE_LEVELS = Object.freeze(SATELLITE_BLINDS.flatMap(([sb, bb], index) => {
  const blind = Object.freeze({ type: 'blind', sb, bb, minutes: 10 });
  return (index + 1) % 5 === 0 && index < SATELLITE_BLINDS.length - 1
    ? [blind, Object.freeze({ type: 'break', minutes: 5 })]
    : [blind];
}));

const MODES = Object.freeze({
  daily: Object.freeze({ id: 'daily', label: '데일리', blindMinutes: 7, levels: DAILY_LEVELS }),
  satellite: Object.freeze({ id: 'satellite', label: '새틀라이트', blindMinutes: 10, levels: SATELLITE_LEVELS }),
});

function getMode(modeId) {
  return MODES[modeId] || MODES.daily;
}
```

반환 객체에 `MODES`, `getMode`, `LEVELS: DAILY_LEVELS`를 포함한다.

- [ ] **Step 4: 공통 코어 테스트 통과 확인**

Run: `node --test tests/poker-core.test.cjs`

Expected: 모든 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add poker-core.js tests/poker-core.test.cjs
git commit -m "feat: add daily and satellite profiles"
```

---

### Task 2: 자체 팝업에 모드 선택 UI 추가

**Files:**
- Modify: `poker-dialog.js`
- Create: `tests/dialog-source.test.cjs`

**Interfaces:**
- Produces: `PokerDialog.choose({ title, message, choices }): Promise<string|null>`
- `choices`: `{ value: string, label: string, description: string }[]`

- [ ] **Step 1: 실패하는 팝업 소스 테스트 작성**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('poker-dialog.js', 'utf8');

test('dialog exposes accessible choice buttons', () => {
  assert.match(source, /choose\(options\)/);
  assert.match(source, /poker-dialog-choice/);
  assert.match(source, /config\.choices/);
  assert.match(source, /choice\.description/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/dialog-source.test.cjs`

Expected: `choose(options)` 패턴 없음으로 FAIL.

- [ ] **Step 3: 선택형 팝업 구현**

`open()`의 기본 설정에 `choices: null`을 추가한다. `config.choices`가 배열이면 입력창/기본 확인 버튼 대신 각 선택지를 다음 구조의 버튼으로 만들고 클릭 시 `close(choice.value)`를 호출한다.

```js
const choiceList = document.createElement('div');
choiceList.className = 'poker-dialog-choices';
config.choices.forEach(choice => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'poker-dialog-choice';
  button.innerHTML = `<strong></strong><span></span>`;
  button.querySelector('strong').textContent = choice.label;
  button.querySelector('span').textContent = choice.description;
  button.addEventListener('click', () => close(choice.value));
  choiceList.appendChild(button);
});
dialog.appendChild(choiceList);
```

문자열을 `innerHTML`에 직접 넣지 않고 `textContent`로 채운다. API에는 다음을 추가한다.

```js
choose(options) {
  return open(Object.assign({}, options, { cancelable: true, input: false }));
}
```

선택 버튼은 두 줄 카드 형태, 키보드 포커스 테두리, 데일리/새틀라이트 간 동일 크기로 스타일링한다.

- [ ] **Step 4: 팝업 검사와 구문 검사**

Run: `node --check poker-dialog.js && node --test tests/dialog-source.test.cjs`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add poker-dialog.js tests/dialog-source.test.cjs
git commit -m "feat: add tournament mode chooser dialog"
```

---

### Task 3: 중앙 타이머를 모드 기반으로 전환

**Files:**
- Modify: `poker_timer-2.html`
- Create: `tests/tournament-mode-integration.test.cjs`

**Interfaces:**
- Consumes: `PokerCore.getMode(modeId)` and `profile.levels`
- Consumes: `PokerDialog.choose(options)`
- Sends RPC argument: `p_mode: 'daily' | 'satellite'`

- [ ] **Step 1: 실패하는 중앙 화면 정적 통합 테스트 작성**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const central = fs.readFileSync('poker_timer-2.html', 'utf8');
const participant = fs.readFileSync('participant.html', 'utf8');

test('central creates and restores rooms by mode', () => {
  assert.match(central, /PokerDialog\.choose/);
  assert.match(central, /p_mode:\s*selectedMode/);
  assert.match(central, /setActiveMode\(room\.mode/);
  assert.match(central, /mode:\s*activeMode\.id/);
  assert.match(central, /buildRebuyCutoffOptions/);
  assert.match(central, /restoreTimerSnapshot/);
});

test('both screens resolve levels through shared mode profiles', () => {
  assert.match(central, /PokerCore\.getMode/);
  assert.match(participant, /PokerCore\.getMode/);
  assert.doesNotMatch(participant, /const LEVELS\s*=\s*\[/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/tournament-mode-integration.test.cjs`

Expected: 모드 선택 및 상태 전환 패턴 없음으로 FAIL.

- [ ] **Step 3: 중앙 활성 모드와 저장 상태 구현**

상단 상태를 다음 형태로 바꾼다.

```js
let activeMode = PokerCore.getMode('daily');
let LEVELS = activeMode.levels;

function setActiveMode(modeId, resetTimer = false) {
  activeMode = PokerCore.getMode(modeId);
  LEVELS = activeMode.levels;
  if (resetTimer) {
    currentLevel = 0;
    remainingMs = LEVELS[0].minutes * 60000;
    endTime = null;
    running = false;
  }
  buildRebuyCutoffOptions();
  render();
}
```

`saveTimerState()`에 `mode: activeMode.id`를 추가하고 `loadTimerState()`는 `setActiveMode(state.mode || 'daily')`를 레벨 범위 검사보다 먼저 호출한다. 방 복구 시에는 `setActiveMode(room.mode || 'daily')`를 `applyRoomTimer(room)`보다 먼저 실행한다.

- [ ] **Step 4: 리바인 옵션과 모드 표시 구현**

하드코딩된 `<option>`들을 제거하고 다음 함수를 추가한다.

```js
function buildRebuyCutoffOptions() {
  const previous = Number($rebuyCutoff.value);
  $rebuyCutoff.innerHTML = '';
  LEVELS.forEach((level, stage) => {
    if (level.type !== 'blind') return;
    const option = document.createElement('option');
    option.value = String(stage);
    option.textContent = `레벨 ${PokerCore.blindNumber(stage, LEVELS)} 종료 · ${fmt(level.sb)} / ${fmt(level.bb)}`;
    $rebuyCutoff.appendChild(option);
  });
  const valid = [...$rebuyCutoff.options].some(option => Number(option.value) === previous);
  $rebuyCutoff.value = String(valid ? previous : 4);
}
```

온라인 방 상태 영역에 `<span id="room-mode"></span>`을 추가하고 `displayRoom()`에서 `activeMode.label`과 레벨 시간을 표시한다.

- [ ] **Step 5: 방 생성 모드 선택과 실패 복원 구현**

방 생성 확인 뒤 다음 선택을 받는다.

```js
const selectedMode = await PokerDialog.choose({
  title: '게임 모드를 선택하세요',
  message: '방을 만든 뒤에는 모드를 변경할 수 없습니다.',
  choices: [
    { value: 'daily', label: '데일리', description: '블라인드 7분 · 현재 스트럭처' },
    { value: 'satellite', label: '새틀라이트', description: '블라인드 10분 · 5레벨마다 휴식' },
  ],
});
if (!selectedMode) return;
```

선택 전 상태를 `captureTimerSnapshot()`으로 저장한다. 선택 후 `setActiveMode(selectedMode, true)`를 호출하고 RPC에 `p_mode: selectedMode`를 전달한다. 오류 시 `restoreTimerSnapshot(snapshot)`으로 모드·레벨·남은 시간·실행 여부를 모두 되돌린다.

- [ ] **Step 6: 중앙 통합 검사 실행**

Run: `node --test tests/*.test.cjs`

HTML inline script parsing command:

```powershell
@'
const fs=require('fs');
const html=fs.readFileSync('poker_timer-2.html','utf8');
[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(m=>m[1]).filter(Boolean).forEach(source=>new Function(source));
'@ | node
```

Expected: 모두 PASS.

- [ ] **Step 7: 커밋**

```bash
git add poker_timer-2.html tests/tournament-mode-integration.test.cjs
git commit -m "feat: select tournament mode when creating rooms"
```

---

### Task 4: 참가자 화면에 방 모드 적용

**Files:**
- Modify: `participant.html`
- Modify: `tests/tournament-mode-integration.test.cjs`

**Interfaces:**
- Consumes: `room.mode`, `PokerCore.getMode(modeId)`
- Produces UI: `#mobile-mode`

- [ ] **Step 1: 실패하는 참가자 표시 테스트 추가**

```js
test('participant displays and applies the room mode', () => {
  assert.match(participant, /id="mobile-mode"/);
  assert.match(participant, /const profile = PokerCore\.getMode\(room\.mode\)/);
  assert.match(participant, /profile\.levels/);
  assert.match(participant, /profile\.label/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/tournament-mode-integration.test.cjs`

Expected: `mobile-mode` 없음으로 FAIL.

- [ ] **Step 3: 참가자 모드 표시 및 레벨 선택 구현**

`#tournament-state` 안에 `<div id="mobile-mode"></div>`을 추가한다. `renderRoomTimer()` 시작 부분을 다음처럼 바꾼다.

```js
const profile = PokerCore.getMode(room.mode);
const levels = profile.levels;
const stage = Math.min(levels.length - 1, Math.max(0, Number(room.current_level) || 0));
const level = levels[stage];
$('mobile-mode').textContent = `${profile.label} · 블라인드 ${profile.blindMinutes}분`;
```

해당 함수의 `LEVELS` 참조를 모두 `levels`로 교체하고 `blindNumber(stage)`가 `PokerCore.blindNumber(stage, levels)`를 호출하도록 한다.

- [ ] **Step 4: 참가자 구문 및 전체 테스트 확인**

Run: `node --test tests/*.test.cjs`

Inline script parsing은 Task 3 명령에서 파일명을 `participant.html`로 바꿔 실행한다.

Expected: 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
git add participant.html tests/tournament-mode-integration.test.cjs
git commit -m "feat: show room mode to participants"
```

---

### Task 5: Supabase에 모드 저장과 검증 추가

**Files:**
- Create: `supabase/migrations/20260924000100_tournament_modes.sql`
- Modify: `tests/tournament-mode-integration.test.cjs`

**Interfaces:**
- DB column: `public.poker_rooms.mode text not null default 'daily'`
- RPC: `create_poker_room_with_pin(text,text,text,integer,integer,integer,boolean,timestamptz,bigint)` where third argument is `p_mode`

- [ ] **Step 1: 실패하는 마이그레이션 소스 테스트 추가**

```js
const migration = fs.readFileSync('supabase/migrations/20260924000100_tournament_modes.sql', 'utf8');
test('migration stores and validates tournament mode', () => {
  assert.match(migration, /add column if not exists mode text not null default 'daily'/i);
  assert.match(migration, /mode in \('daily', 'satellite'\)/i);
  assert.match(migration, /p_mode text/i);
  assert.match(migration, /p_mode not in \('daily', 'satellite'\)/i);
  assert.match(migration, /current_level between 0 and 63/i);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/tournament-mode-integration.test.cjs`

Expected: 마이그레이션 파일 없음으로 FAIL.

- [ ] **Step 3: 비파괴 마이그레이션 작성**

마이그레이션은 다음 순서로 작성한다.

```sql
alter table public.poker_rooms
  add column if not exists mode text not null default 'daily';

alter table public.poker_rooms drop constraint if exists poker_rooms_mode_check;
alter table public.poker_rooms add constraint poker_rooms_mode_check
  check (mode in ('daily', 'satellite'));

alter table public.poker_rooms drop constraint if exists poker_rooms_current_level_check;
alter table public.poker_rooms add constraint poker_rooms_current_level_check
  check (current_level between 0 and 63);

alter table public.poker_rooms drop constraint if exists poker_rooms_rebuy_until_stage_check;
alter table public.poker_rooms add constraint poker_rooms_rebuy_until_stage_check
  check (rebuy_until_stage between 0 and 63);
```

새 `create_poker_room_with_pin`은 `p_mode text`를 세 번째 인자로 받고 다음 검증 후 INSERT 열에 `mode`를 포함한다.

```sql
if p_mode not in ('daily', 'satellite') then
  raise exception '올바르지 않은 게임 모드입니다.';
end if;
```

새 함수 생성 후 구형 시그니처의 권한을 회수하고 삭제한다. 새 시그니처는 `authenticated`에만 실행 권한을 부여한다.

- [ ] **Step 4: 로컬 테스트 후 원격 Supabase 적용**

Run: `node --test tests/*.test.cjs`

Run: `npx --yes supabase@latest db push --yes`

Expected: `20260924000100_tournament_modes.sql` 적용 성공.

Run: `npx --yes supabase@latest migration list`

Expected: 로컬과 원격에 `20260924000100`이 모두 표시됨.

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/20260924000100_tournament_modes.sql tests/tournament-mode-integration.test.cjs
git commit -m "feat: persist tournament mode in Supabase"
```

---

### Task 6: 문서·실사용 검증·배포

**Files:**
- Modify: `SETUP.md`
- Do not modify: `MANUAL.md`

**Interfaces:**
- Deploy target: `https://shinkiwhan.github.io/Texas-Hold-em-Timer/`

- [ ] **Step 1: 운영 문서 갱신**

`SETUP.md`의 현재 온라인 기능 설명에 다음을 추가한다.

```markdown
새 게임 방을 만들 때 데일리(7분) 또는 새틀라이트(10분) 모드를 선택합니다. 선택한 모드는 방에 저장되어 중앙·참가자·방 복구 화면에 동일하게 적용되며, 방 생성 후에는 변경할 수 없습니다. 새틀라이트 모드는 블라인드 5레벨마다 5분 휴식이 포함됩니다.
```

- [ ] **Step 2: 전체 자동 검증**

Run: `node --check poker-core.js`

Run: `node --check poker-dialog.js`

Run: `node --test tests/*.test.cjs`

Run: `git diff --check`

Expected: 모두 exit code 0.

- [ ] **Step 3: 로컬 브라우저 실사용 검증**

로컬 HTTP 서버에서 중앙 화면을 열고 다음을 확인한다.

1. 새 게임 방 클릭 시 데일리/새틀라이트 선택 카드가 나타남.
2. 취소하면 방과 타이머가 바뀌지 않음.
3. 새틀라이트 선택 시 첫 타이머가 10:00, 첫 블라인드가 100/200임.
4. 다음 버튼으로 다섯 번째 블라인드를 지난 뒤 5:00 휴식이 나타남.
5. 리바인 마감 목록이 새틀라이트 블라인드 26개로 생성됨.
6. QR로 참가자 화면을 열면 새틀라이트·10분·동일 블라인드를 표시함.
7. 방 복구 후에도 새틀라이트 상태가 유지됨.
8. 검증용 방을 종료함.

- [ ] **Step 4: 문서 커밋 및 main push**

```bash
git add SETUP.md
git commit -m "docs: explain tournament mode selection"
git push origin main
```

- [ ] **Step 5: GitHub Actions와 Pages 검증**

현재 HEAD의 GitHub Actions API를 조회해 `Tests`와 `pages build and deployment`가 모두 `completed/success`인지 확인한다. 캐시 무효화 쿼리와 함께 다음 파일이 HTTP 200인지 확인한다.

```text
poker-core.js
poker-dialog.js
poker_timer-2.html
participant.html
```

공개 중앙 HTML에 `PokerDialog.choose`, `p_mode`, `room-mode`가 있고 참가자 HTML에 `mobile-mode`, `PokerCore.getMode`가 있는지 확인한다.

- [ ] **Step 6: 최종 작업 트리 확인**

Run: `git status --short`

Expected: 기존 사용자 파일인 `?? MANUAL.md`만 남고 구현 관련 변경은 없음.
