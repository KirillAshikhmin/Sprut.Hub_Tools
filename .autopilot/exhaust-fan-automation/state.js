window.STATE =
{
  "slug": "exhaust-fan-automation",
  "title": "Вытяжка по присутствию и влажности",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-09-20-brief.md",
  "memoryFile": "CLAUDE.md",
  "skillDir": "/Users/asihminkirill/.agents/skills/autopilot",
  "startedAt": "2026-09-20T01:35:00+03:00",
  "updatedAt": "2026-09-20T02:52:03+03:00",
  "finishedAt": "2026-09-20T02:52:03+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-20T01:35:00+03:00",
      "finishedAt": "2026-09-20T01:35:36+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-20T01:35:36+03:00",
      "finishedAt": "2026-09-20T01:36:38+03:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-09-20T01:36:38+03:00",
      "finishedAt": "2026-09-20T01:40:58+03:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-20T01:40:58+03:00",
      "finishedAt": "2026-09-20T01:44:26+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-20T01:44:26+03:00",
      "finishedAt": "2026-09-20T01:45:31+03:00",
      "note": "3 таска, ярус T1"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-09-20T01:45:31+03:00",
      "note": "8 из 8 тасков готовы",
      "finishedAt": "2026-09-20T02:52:03+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-09-20T01:52:33+03:00",
      "note": "проверено 8 из 8",
      "finishedAt": "2026-09-20T02:52:03+03:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-09-20T02:52:03+03:00",
      "finishedAt": "2026-09-20T02:52:03+03:00"
    }
  ],
  "requirements": {
    "total": 35,
    "done": 34,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 1,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Исходник сценария",
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R04",
        "R05",
        "R06",
        "R08",
        "R09",
        "R10",
        "R11",
        "R12",
        "R13",
        "R14",
        "R15",
        "R16",
        "R17",
        "R18",
        "R19",
        "R20i",
        "R24i",
        "R25i",
        "R26i",
        "R27i",
        "R28i",
        "R29i",
        "G01",
        "G02",
        "G03",
        "G04",
        "G05",
        "G06"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "ExhaustFanAutomation/source/"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "startedAt": "2026-09-20T01:45:43+03:00",
      "files": [
        "ExhaustFanAutomation/source/ExhaustFanAutomation.js"
      ],
      "tests": {
        "passed": 3814,
        "failed": 0
      },
      "repairFindings": [
        "R25i partial: стартовый вызов trigger неотличим от ручного события — onStart поднимает manualHold и ставит блокировку авто-включения; плюс таймеры без проверки поколения и антидребезг у выключенной вытяжки"
      ],
      "finishedAt": "2026-09-20T02:00:14+03:00",
      "commit": "f35ba6b"
    },
    {
      "id": "02",
      "title": "Поведенческая спецификация, black-box тесты и пресет",
      "requirements": [
        "R22i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "ExhaustFanAutomation/.tests/"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "startedAt": "2026-09-20T01:45:43+03:00",
      "files": [
        "ExhaustFanAutomation/.tests/SPEC.md",
        "ExhaustFanAutomation/.tests/config.json",
        "ExhaustFanAutomation/.tests/blackbox-logic.test.js",
        "ExhaustFanAutomation/.tests/collect-services.test.js",
        "ExhaustFanAutomation/.tests/preset.json"
      ],
      "tests": {
        "passed": 138,
        "failed": 0
      },
      "repairFindings": [
        "12 условий от двух ревьюеров: тесты, проходящие при любой реализации, непокрытые утверждения SPEC, preset с debug:true вместо дефолта"
      ],
      "finishedAt": "2026-09-20T02:00:14+03:00",
      "commit": "3067057"
    },
    {
      "id": "03",
      "title": "README и публикация",
      "requirements": [
        "R07",
        "R21i",
        "R23i"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 2,
      "zone": [
        "ExhaustFanAutomation/"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "startedAt": "2026-09-20T02:00:14+03:00",
      "files": [
        "ExhaustFanAutomation/README.md",
        "ExhaustFanAutomation/publish.json",
        "ExhaustFanAutomation/ExhaustFanAutomation.json"
      ],
      "tests": {
        "passed": 3814,
        "failed": 0
      },
      "repairFindings": [
        "README:337 врёт про перехват контакта (только «Открытие»); нет обязательного по CLAUDE.md раздела про variables; пятикратный повтор про контрольный датчик; дефолты продублированы в двух разделах"
      ],
      "finishedAt": "2026-09-20T02:08:08+03:00",
      "commit": "42beea2"
    },
    {
      "id": "04",
      "title": "Чистка исходника по отложенным находкам",
      "requirements": [
        "R19",
        "R25i"
      ],
      "blockedBy": [],
      "wave": 3,
      "zone": [
        "ExhaustFanAutomation/source/"
      ],
      "status": "done",
      "startedAt": "2026-09-20T02:09:03+03:00",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "repairFindings": [
        "окно антидребезга сбрасывается событием, не меняющим состояние вытяжки — расхождение с spec §7 / SPEC §12,§15"
      ],
      "finishedAt": "2026-09-20T02:19:47+03:00",
      "commit": "2e0ccb8",
      "tests": {
        "passed": 3820,
        "failed": 0
      },
      "files": [
        "ExhaustFanAutomation/source/ExhaustFanAutomation.js"
      ]
    },
    {
      "id": "05",
      "title": "Утверждения, не различающие правильное и неправильное",
      "requirements": [
        "R22i"
      ],
      "blockedBy": [],
      "wave": 3,
      "zone": [
        "ExhaustFanAutomation/.tests/"
      ],
      "status": "done",
      "startedAt": "2026-09-20T02:09:03+03:00",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "repairFindings": [
        "окно антидребезга сбрасывается событием, не меняющим состояние вытяжки — расхождение с spec §7 / SPEC §12,§15"
      ],
      "finishedAt": "2026-09-20T02:20:51+03:00",
      "commit": "632b45c",
      "tests": {
        "passed": 3820,
        "failed": 0
      },
      "files": [
        "ExhaustFanAutomation/.tests/blackbox-logic.test.js",
        "ExhaustFanAutomation/.tests/collect-services.test.js",
        "ExhaustFanAutomation/.tests/SPEC.md",
        "ExhaustFanAutomation/.tests/preset.json"
      ]
    },
    {
      "id": "06",
      "title": "Правки README и финальная публикация",
      "requirements": [
        "R21i",
        "R23i"
      ],
      "blockedBy": [
        "04",
        "05"
      ],
      "wave": 4,
      "zone": [
        "ExhaustFanAutomation/"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "startedAt": "2026-09-20T02:20:51+03:00",
      "repairFindings": [
        "сценарий публикуется впервые — версия возвращается к 1.0 с одной записью в changelog; README не говорил, что событие, не переключающее вытяжку, перезапускает предельный таймер"
      ],
      "finishedAt": "2026-09-20T02:26:37+03:00",
      "commit": "e7e7405",
      "tests": {
        "passed": 3820,
        "failed": 0
      },
      "files": [
        "ExhaustFanAutomation/README.md",
        "ExhaustFanAutomation/publish.json",
        "ExhaustFanAutomation/ExhaustFanAutomation.json"
      ]
    },
    {
      "id": "07",
      "title": "Сжатие: убрать дублирование и лишние комментарии",
      "requirements": [
        "R19"
      ],
      "blockedBy": [],
      "wave": 5,
      "zone": [
        "ExhaustFanAutomation/source/"
      ],
      "status": "done",
      "startedAt": "2026-09-20T02:38:45+03:00",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "finishedAt": "2026-09-20T02:51:20+03:00",
      "commit": "9a7a0a9",
      "tests": {
        "passed": 3820,
        "failed": 0
      },
      "files": [
        "ExhaustFanAutomation/source/ExhaustFanAutomation.js"
      ],
      "repairFindings": [
        "имя поля таймера ходило строкой; потерян комментарий про назначение variables.subGen"
      ]
    },
    {
      "id": "08",
      "title": "Перегенерация пакета и README после сжатия",
      "requirements": [
        "R21i",
        "R23i"
      ],
      "blockedBy": [
        "07"
      ],
      "wave": 6,
      "zone": [
        "ExhaustFanAutomation/"
      ],
      "status": "done",
      "startedAt": "2026-09-20T02:52:03+03:00",
      "finishedAt": "2026-09-20T02:52:03+03:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "commit": "3778193",
      "tests": {
        "passed": 3820,
        "failed": 0
      },
      "files": [
        "ExhaustFanAutomation/README.md",
        "ExhaustFanAutomation/ExhaustFanAutomation.json"
      ]
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 3820,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [
    "Включение по влажности без присутствия (humidityStartsFan) — ради R09: после душа датчик присутствия мог никого не увидеть",
    "Форсаж скорости при высокой влажности (boostEnabled) — ради R09: быстрее сушит, тише в остальное время",
    "Уведомление «комната не высохла» (notifyOnDryTimeout) — ради R11: повод проверить, тянет ли вытяжка",
    "Минимальное время работы (minRunMinutes) — ради R03: защита реле от «зашёл-вышел»",
    "Пауза перед повторным включением (cooldownMinutes) — ради R09: против «вкл-выкл-вкл» на границе порога",
    "Дверной контакт как признак «занято» (contactInverted) — ради R03: туалет без датчика движения"
  ],
  "coverage": {
    "ranAt": "2026-09-20T01:44:26+03:00",
    "findings": 7,
    "acted": [
      "missing: «включаем вытяжку до уровня контрольный +5%» — буквальное прочтение как повода к включению → §4 теперь явно объясняет прочтение (порог выключения) и почему буквальное противоречит задаче",
      "missing: предельный таймер гасил и сухую комнату без оговорки → §8 явно фиксирует расширение предела как ответ пользователя «один общий лимит», добавлена блокировка после предела (R11.1)",
      "half: §7 ссылался на эталон вместо семантики → §7 переписан целиком (типы ручных входов, рубильник, удержание, блокировка, антидребезг)",
      "half: не сказано, что из эталона переносится → §10 получил таблицу «что НЕ переносится и почему»",
      "half: не сказано, когда пересчитывается рабочий порог → §4 «Когда пересчитывается» + история R14.1",
      "half: механизм поколений подписки не описан → §9 описан",
      "extra без родителя: HS.Outlet в sourceServices → вырезан",
      "Вне рамок содержал строки без родительского требования → привязаны к R18",
      "нумерация: R29i отсутствовала (R28i → R30i) → R30i переименован в R29i"
    ]
  },
  "concerns": [
    "ЗАКРЫТО ремонтом · тесты 02 · blackbox-logic.test.js:1273 — инверсия рубильника: запрет авто-включения не проверен",
    "ЗАКРЫТО ремонтом · тесты 02 · blackbox-logic.test.js:1936 — debug: нет парного отрицания при debug:false",
    "ЗАКРЫТО ремонтом · тесты 02 · blackbox-logic.test.js:191,311 — два утверждения верны и до действия",
    "ЗАКРЫТО ремонтом · тесты 02 · SPEC §13.4 — подавленное событие не должно давать побочных эффектов: не покрыто",
    "ЗАКРЫТО ремонтом · тесты 02 · SPEC §10,§12,§16,§7 — четыре названных утверждения без теста",
    "ЗАКРЫТО ремонтом · тесты 02 · клампинг контрольного порога закрыт аргументом (SPEC §17.8), а не тестом",
    "ЗАКРЫТО ремонтом · тесты 02 · preset.json:35 — debug:true при дефолте false; в interfaces.md «28 опций», в пресете 31",
    "ЗАКРЫТО ремонтом · код 01 · ExhaustFanAutomation.js:135,357,385,704,833 — состояние сеанса сбрасывается в пяти местах мимо beginRun/endRun",
    "ЗАКРЫТО ремонтом · док 03 · расширение «повод работать» до «влажность выше целевой» должно быть записано в README как осознанное решение",
    "В ТАСК 04/05/06 · тесты 02 · collect-services.test.js:118 — «сервис не дублируется»: тип запрошен в списке один раз, тест пройдёт и без защиты от дублей",
    "В ТАСК 04/05/06 · тесты 02 · collect-services.test.js:131 — ожидаемый порядок получен тем же localeCompare, что и в коде",
    "В ТАСК 04/05/06 · тесты 02 · blackbox-logic.test.js:2150 — пересохранение эмулируется тем же объектом variables, хаб даёт свежий",
    "В ТАСК 04/05/06 · тесты 02 · blackbox-logic.test.js:331 — §16 «один датчик в двух слотах»: двойной учёт активности исход не изменил бы",
    "В ТАСК 04/05/06 · код 01 · ExhaustFanAutomation.js:160,398,426,883,1061 — endRun не стал единой точкой: manualHold сбрасывается в четырёх местах мимо него",
    "В ТАСК 04/05/06 · код 01 · ExhaustFanAutomation.js:268 — таймер прошлого поколения не снимается, а молча ничего не делает; предельный живёт до 10080 мин",
    "В ТАСК 04/05/06 · тесты 02 · SPEC §18: формулировка «любой способ погасить вытяжку ставит свою блокировку» сильнее правды — ручной Switch в Off гасит, блокировки не ставя",
    "В ТАСК 04/05/06 · тесты 02 · blackbox-logic.test.js:2152 — пересохранение эмулируется тем же vars, поэтому идёт по ветке внешнего изменения; окно 20m прячет сдвиг момента выключения",
    "док 03 · README.md:218 — «Параметры сценария» отходят от плоского списка эталона (девять подзаголовков); стоит зафиксировать как конвенцию",
    "В ТАСК 04/05/06 · док 03 · README.md:280-296 — имена полей variables поданы как стабильный инструмент, хотя SPEC §18 зовёт их деталью реализации",
    "В ТАСК 04/05/06 · док 03 · README.md:364 — замечание 9 ссылается на «Как это работает» целиком вместо нужного подраздела",
    "В ТАСК 04/05/06 · док 03 · README.md:61-66 — шаг 5 после удаления чисел остался без содержания; «включите Разрешение автоматики» неточно (это поле выбора устройства)",
    "код 04 · при неудачной записи в вытяжку (у сервиса нет ни On, ни Active) manualHold/lastSensorAutoOnAt переживают неудавшееся выключение — наблюдаемо только у сервиса, которым сценарий и так не управляет",
    "код 04 · снятие таймеров прошлого поколения доказано только в симуляторе; на хабе clearTimeout с id прошлого исполнения может не сработать, защита тогда вырождается в прежний колбэк-no-op",
    "код 07 · TIMER_PRESENCE_RESET.clearedText называет одну причину («активность вернулась»), а снимают таймер две — неточность в тексте отладочного лога, была и до сжатия"
  ],
  "reviewers": {
    "manifestSpec": "a8f3aa5d19f004936",
    "craft": "a150bf18508a3eb0d"
  },
  "blind": {
    "ranAt": "2026-09-20T02:13:29+03:00",
    "method": "свои тесты в эмуляторе вне репозитория + ручной прогон через веб-UI симулятора на preset.json",
    "verdict": "все требования брифа — реализовано, кроме одного дополнения",
    "drift": [
      "G05 «Пауза перед повторным включением» — манифест: done, слепая приёмка: частично. Исправлено таском 04: по истечении паузы вытяжка возвращается сама."
    ],
    "notes": [
      "preset.json: селекторы устройств пустые, ручная проверка в веб-UI не работает без ручного выбора датчиков. Отдано в таск 05.",
      "общий предел работы гасит вытяжку и при непрерывном присутствии без влажности — это ответ пользователя «один общий лимит», приёмка подтвердила поведение"
    ]
  }
}
