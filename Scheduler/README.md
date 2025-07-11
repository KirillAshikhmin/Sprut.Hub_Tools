# Планировщик расширенный
# Логический сценарий


Сейчас в Sprut.Hub в сценариях имеется планировщик, но он позволяет только выбрать день недели, но не месяц или число.
Представленный сценарий решает эту задачу: активирует выключатель в заданное время (по умолчанию в полночь) в указанные дни недели, и числа в перечисленные месяцы. Поддерживает разные варианты от одного дня в году до ежедневного расписания. (Для включения несколько раз в день используйте стандартный планировщик)

Для чего использовать:

Напоминания: 15-го числа каждого месяца передать показания счётчиков или заменить фильтры раз в 3 месяца
Сад: полив газона каждую среду с апреля по октябрь в 20:00.
Подсветка: Включать гирлядну в 17:00 каждый день и отключать в 23:00 в декабре и январе. 

Настраивайте под свои задачи — от рутины до редких событий!


## Использование
Cкачать с GitHub файл Scheduler.json (ссылка ниже), импортировать сценарий, и далее в реальном или виртуальном выключателе зайти в настройки - логика - Планировщик расширенный, указать настройки и включить переключатель "Активно".
Теперь этот выключатель или сам автоматически работает или можно сделать сценарий, в котором триггером служит включение этого выключателя.

P.S. если необходимо разовое действие (например отправить сообщение в Telegram), то надо включить опцию "Выключить через (секунды)", что бы в случае, например, перезагрузки хаба событие не сработало повторно.

# История изменений:

## 2.1
- Добавлены новые варианты дней для срабатывания планировщика - первый, последний, за несколько денй до последнего, чётные и нечётные дни.
- Для сценария написаны тесты - что бы всё работало корректно, соответсвенно улучшена стабильность.

## 2.0
- Добавлены новые параметры: **"Включать по планировщику"** и **"Отключать по планировщику"**. Теперь вы можете независимо задавать расписания для включения и отключения устройства с отдельными настройками дней месяца, дней недели, месяцев и времени.
- Удалены параметры **"Не отключать автоматически" (DontTurnOff)** и **"Время отключения" (TurnOffTime)**. Вместо них используется полноценное расписание отключения.
- Несколько значений времени. Можно задавать несколько значений времени включения и отключения через запятую (например, `"08:00, 12:00, 22:30"`).
- Установка текущего состояния. При запуске сценария или изменении параметров (время, дни, месяцы) устройство автоматически принимает текущее состояние в зависимости от того, прошло ли время включения или отключения с учётом условий.
- Отправка уведомлений. При переключении состояния устройства будет отправляться уведомление.
- Поддержка состояния. Устройство будет восстанавливать нужное состояние при его изменении вручную или другим сценарием или мостом

### Важно
- После обновления до версии 2.0 проверьте настройки расписания, так как старые параметры (`DontTurnOff`, `TurnOffTime`) больше не используются.
- Если вы изменяли время или дату, перезапустите сценарий через переключатель **"Активно"** для применения изменений (только таким образом можно перезапустить планировщик)


## 1.2
- Исправление времени выключеия (не выключалось само в указанное время\полночь)
- Опция "Инвертирование"

## 1.1
- Поддерживаются все устройства с характеристиками On или Active (HS.Switch, HS.Outlet, HS.Fan, HS.FanBasic, HS.Lightbulb, HS.Faucet, HS.C_PetFeeder, HS.Valve, HS.HeaterCooler, HS.AirPurifier, HS.IrrigationSystem, HS.Television, HS.HumidifierDehumidifier, HS.CameraControl)
- Добавлено свойство "Не отключать автоматически"" 
- Задержка отключения теперь настраиваемая
- В день и месяц теперь можно вводить диапазоны (Например с 1-7 число)
- Добавлено emoji календаря в название (📅)

## 1.0
- Первый релиз