window.STATE =
{
  "slug": "sun-in-window",
  "title": "Солнце в окне — сценарий засветки окон",
  "mode": "interview",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-09-21-brief.md",
  "memoryFile": "CLAUDE.md",
  "skillDir": "/Users/asihminkirill/.agents/skills/autopilot",
  "startedAt": "2026-09-21T03:47:01+03:00",
  "updatedAt": "2026-09-23T02:22:32+03:00",
  "finishedAt": "2026-09-23T02:22:32+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-21T03:47:01+03:00",
      "finishedAt": "2026-09-21T03:49:40+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-21T03:49:40+03:00",
      "finishedAt": "2026-09-21T03:53:10+03:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-09-21T03:53:10+03:00",
      "finishedAt": "2026-09-21T03:57:52+03:00",
      "note": "6 вопросов"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-21T03:57:52+03:00",
      "finishedAt": "2026-09-21T04:00:35+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-21T04:00:35+03:00",
      "finishedAt": "2026-09-21T04:01:30+03:00",
      "note": "3 таска, ярус T1"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-09-21T04:01:30+03:00",
      "note": "10 из 10 тасков готовы",
      "finishedAt": "2026-09-23T02:22:32+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-09-21T04:15:04+03:00",
      "note": "проверено 10 из 10",
      "finishedAt": "2026-09-23T02:22:32+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "note": "слепая приёмка: 7 из 8, одно частично",
      "startedAt": "2026-09-23T02:22:32+03:00",
      "finishedAt": "2026-09-23T02:22:32+03:00"
    }
  ],
  "requirements": {
    "total": 19,
    "done": 19,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Сценарий: расчёт Солнца и флаг «солнце в окне»",
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R04",
        "R04.1",
        "R05",
        "R06",
        "R07",
        "R08",
        "R09i",
        "R10i",
        "R10i.1",
        "R10i.2",
        "R11i",
        "R11i.1",
        "R12i",
        "R13i",
        "G01",
        "A01",
        "A02",
        "A03"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "SunInWindow/source/",
        "SunInWindow/.tests/config.json",
        "SunInWindow/.tests/preset.json"
      ],
      "status": "done",
      "startedAt": "2026-09-21T04:01:44+03:00",
      "finishedAt": "2026-09-21T04:15:04+03:00",
      "files": [
        "SunInWindow/source/SunInWindow.js",
        "SunInWindow/.tests/config.json",
        "SunInWindow/.tests/preset.json",
        "SunInWindow/.tests/smoke.test.js"
      ],
      "tests": {
        "passed": 8,
        "failed": 0
      },
      "commit": "4b0be4d",
      "retries": 0,
      "repairs": 2,
      "repairFindings": [
        "поколение таймера не растёт при ошибке валидации — старый таймер живёт",
        "нечисловые пороги молча берут дефолт вместо ошибки §9",
        "имя сервиса переписывается каждую минуту",
        "смоук-тест не отличает «не писали» от «записали то же»"
      ],
      "handoffs": 0
    },
    {
      "id": "02",
      "title": "Поведенческая спецификация и black-box тесты",
      "requirements": [
        "R13i",
        "R05",
        "R06",
        "G01"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "SunInWindow/.tests/SPEC.md",
        "SunInWindow/.tests/blackbox-*.test.js"
      ],
      "status": "done",
      "startedAt": "2026-09-21T04:15:04+03:00",
      "finishedAt": "2026-09-21T04:37:12+03:00",
      "files": [
        "SunInWindow/.tests/SPEC.md",
        "SunInWindow/.tests/blackbox-logic.test.js"
      ],
      "tests": {
        "passed": 149,
        "failed": 0
      },
      "commit": "88b40f9",
      "retries": 0,
      "repairs": 2,
      "repairFindings": [
        "SPEC.md §17.10 объявляет неспецифицированным то, что спецификация задаёт",
        "§14.1 не покрывает «не число» для азимута и порогов",
        "мутант «пишет одинаковое значение» выжил — тест проверял лог, а не запись",
        "все тесты подают context: '' — мутант «глохнет на любом чужом событии» выжил",
        "неверное число в комментарии к тесту",
        "info() как второй шов не признан в §18.1"
      ],
      "handoffs": 0
    },
    {
      "id": "03",
      "title": "README по конвенции и публикация пакета",
      "requirements": [
        "R13i",
        "R01",
        "R07",
        "R08"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 3,
      "zone": [
        "SunInWindow/README.md",
        "SunInWindow/publish.json",
        "SunInWindow/SunInWindow.json"
      ],
      "status": "done",
      "startedAt": "2026-09-21T04:37:12+03:00",
      "finishedAt": "2026-09-21T04:48:50+03:00",
      "files": [
        "SunInWindow/README.md",
        "SunInWindow/publish.json",
        "SunInWindow/SunInWindow.json"
      ],
      "tests": {
        "passed": 149,
        "failed": 0
      },
      "commit": "9b8de0c",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "рефракция на 5° указана как <0,1°, на деле 0,165°",
        "точность 0,5° обещана без оговорки про широты ±66°",
        "скорость 0,25°/мин отнесена к высоте и азимуту, а это скорость часового угла",
        "README отправляет искать характеристику Active, которой у Switch/Outlet/Lightbulb нет",
        "пустой заголовок «Шаг 3»",
        "тринадцать утверждений повторены по 2–5 раз, отсюда 34 КБ против 17,8 КБ у эталона"
      ],
      "handoffs": 0
    },
    {
      "id": "04",
      "title": "Закрытие отложенных находок ревью",
      "requirements": [
        "R13i",
        "R04.1",
        "R10i.1"
      ],
      "blockedBy": [
        "01",
        "02",
        "03"
      ],
      "wave": 4,
      "zone": [
        "SunInWindow/"
      ],
      "status": "done",
      "startedAt": "2026-09-21T04:49:26+03:00",
      "finishedAt": "2026-09-21T05:03:57+03:00",
      "files": [
        "SunInWindow/source/SunInWindow.js",
        "SunInWindow/README.md",
        "SunInWindow/.tests/SPEC.md",
        "SunInWindow/.tests/blackbox-logic.test.js",
        "SunInWindow/.tests/smoke.test.js",
        "SunInWindow/SunInWindow.json"
      ],
      "tests": {
        "passed": 164,
        "failed": 0
      },
      "commit": "028d9ad",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "пример 3 в README противоречил новой валидации румба"
      ],
      "handoffs": 0
    },
    {
      "id": "09",
      "title": "Уведомления: тихий режим и формат Telegram",
      "requirements": [
        "G03",
        "R19"
      ],
      "blockedBy": [],
      "wave": 7,
      "zone": [
        "ExhaustFanAutomation/"
      ],
      "status": "done",
      "startedAt": "2026-09-23T01:56:48+03:00",
      "retries": 0,
      "repairs": 3,
      "handoffs": 0,
      "repairFindings": [
        "данные для сообщения собирались в двух ветках и уже разошлись по составу (UUID только в плоской); resolveDevicePlace повторил разбор и правило склейки имени; рукописный startsWith; README называл более узкое правило, чем код",
        "ярлык «Целевой порог» стоял над рабочим порогом — вводило в заблуждение при контрольном датчике"
      ],
      "finishedAt": "2026-09-23T02:22:32+03:00",
      "commit": "a86bf79",
      "tests": {
        "passed": 3989,
        "failed": 0
      },
      "files": [
        "ExhaustFanAutomation/source/ExhaustFanAutomation.js",
        "ExhaustFanAutomation/README.md",
        "ExhaustFanAutomation/ExhaustFanAutomation.json"
      ]
    },
    {
      "id": "10",
      "title": "Тесты на notifySilent и ветвление формата",
      "requirements": [
        "R22i",
        "G03"
      ],
      "blockedBy": [],
      "wave": 7,
      "zone": [
        "ExhaustFanAutomation/.tests/"
      ],
      "status": "done",
      "startedAt": "2026-09-23T02:09:50+03:00",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "finishedAt": "2026-09-23T02:22:32+03:00",
      "commit": "a86bf79",
      "tests": {
        "passed": 3989,
        "failed": 0
      },
      "files": [
        "ExhaustFanAutomation/.tests/blackbox-logic.test.js",
        "ExhaustFanAutomation/.tests/SPEC.md",
        "ExhaustFanAutomation/.tests/preset.json"
      ],
      "repairFindings": [
        "плоская ветка проверялась не тем же набором фактов; toBeGreaterThanOrEqual пропустил бы дублирующую отправку; место устройства не проверялось"
      ]
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 3989,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [
    "A01 — опция «Возможность ручного управления», по образцу DayNight",
    "A02 — опция «Менять имя сервиса», по образцу DayNight",
    "A03 — опция «Инвертировать», по образцу DayNight",
    "Уведомление: тихий режим и оформление под Telegram — по образцу Battery, ради G03"
  ],
  "coverage": {
    "findings": 7,
    "missing": 0,
    "halfCovered": 4,
    "extra": 3,
    "note": "Три «непокрытых» — снятые пользователем в брифинге (угол падения → два порога, шторы и блики → снаружи), проверяющий брифинга не видел. Четыре полупокрытых исправлены в спецификации: формула зафиксирована целиком (§3 + опорные значения), диапазон точного азимута согласован (история 5), поведение при невалидных настройках описано (§9), направление окна определено как взгляд наружу (история 4). Три «лишних» — опции по образцу DayNight, помечены A01–A03 с родителем R01."
  },
  "concerns": [
    "SunInWindow.js:312 — scheduleRecalculation сбрасывает отсчёт на каждом внешнем триггере; при большом updateInterval периодический пересчёт откладывается",
    "SunInWindow.js:442-451 — при недоступном global защита поколениями отключается молча, в логе ни строки",
    "SunInWindow.js:667-673 — describeState заново считает angularDifference, уже посчитанную в isSunInWindow",
    "SunInWindow.js:556,565-570 — windowDirection не валидируется: нечисловое направление молча становится Югом, в отличие от порогов",
    "smoke.test.js:33-40 — хелпер spyOn теряет все аргументы кроме первого",
    "SunInWindow.js:48,293,637 — HC.Active в sourceCharacteristics недостижим: у Switch/Outlet/Lightbulb такой характеристики нет",
    "blackbox-logic.test.js:211/402, 315/417/612, 547/395 — повторяющиеся входы под разными номерами §",
    "blackbox-logic.test.js:1037,898,199 — три утверждения слишком широки, чтобы упасть поодиночке",
    "blackbox-logic.test.js:1013,1027 — «ошибки не было» выражено через общее число строк лога, а не через уровень error",
    "blackbox-logic.test.js:653 и smoke.test.js:33 — два разных перехватчика записи, оба теряют аргументы кроме первого",
    "SPEC.md §17.3 — «windowAzimuth строго между −1 и 0» остался в неспецифицированных зонах, хотя правило D02 его уже решило"
  ],
  "reviewers": {
    "manifestSpec": "a9ecd2e051dfaa9e7",
    "craft": "ad3a0df2d1e78ccbf"
  },
  "blind": {
    "verdict": "7 из 8 требований реализовано, одно — частично",
    "drift": [
      "R06 «угол падения, меньше какого перестаёт считаться присутствием солнца» — манифест говорит done, слепая приёмка говорит частично. Вместо одного угла падения на стекло сделаны два независимых порога (высота и отклонение азимута) — по прямому выбору пользователя в брифинге («Два отдельных порога»). Проверяющий показал на стенде, что пара порогов не эквивалентна: Москва, окно на запад, пороги по умолчанию — 21.12 12:30 флаг поднят при реальном угле падения 0,6° (солнце скользит вдоль стекла), 21.12 15:00 флаг снят при реальном угле падения 34° (солнце бьёт в стекло). Разделить эти два случая имеющимися опциями нельзя."
    ],
    "notes": [
      "Формула проверена независимой реализацией NOAA в другой формулировке на 12 точках (оба полушария, западная долгота, Заполярье): максимальное расхождение 0,024°, типичное 0,003°. Плюс три замкнутые сверки по закрытым формулам и справочным временам восхода в Москве.",
      "Основное утверждение брифа подтверждено вживую: окно на запад, Москва, 21.06 18:00 — флаг поднят; то же окно в 08:00 — снят; тот же час 21.12 — снят.",
      "Охват уже, чем у DayNight: 3 типа сервиса против 14 и только HC.On. Следствие решения «флаг на виртуальном выключателе»."
    ]
  }
}
