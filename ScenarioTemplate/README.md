# В данном разделе собрана документация а так же шаблон 

Сценарии пишутся на Языке JavaScript на движке Nashorn и поддерживает только стандарт ES6 (ECMAScript 6).

## Дополнительная информация
Файл [sh_types.json](./sh_types.json) - содержит список всех доступных сервисов в хабе со всеми свойствами, а так же характеристики, которые могут содержаться в этом сервисе и их формат и допустимые значения.

Файл [spruthub.js](./spruthub.js) - JS API Sprut.Hub со всеми доступными в нем функциями с документацией на русском языке

Структура устройств: Каждое устройство это аксессуар (Accessory). В каждом аксессуаре может быть 1 или более сервисов (Service). В сервисе, в свою очередь 1 или более характеристика (Characteristic). Однако для каждого сервиса список достустимых характеристик ограничен. Узнать какие характеристики могут быть в сервисе можно изучив файл sh_types.json или посмотрев в интерфейсе хаба в разделе Настройки - Типы сервисов. Аксессуар может содержать неограниченное количество сервисов с одинаковыми или разными типами. Характеристики же не более 1 штуки каждого поддерживаемого типа в сервисе.



# Написание сценариев
## Логические

### Подготовка
1. Создать новый пустой логический сценарий в интерфейсе хаба.
2. Скопировать в него шаблон:
```javascript
info = {
  name: "Название сценария",
  description: "Описание сценария",
  version: "1.0",
  author: "@Author",
  onStart: true,
  sourceServices: [HS.Switch],
  sourceCharacteristics: [HC.On],
  options: {},
  variables: {}
}

function trigger(source, value, variables, options, context) {

}
```

#№# Структура сценария

Логический сценарий состоит из нескольких основных блоков:

### 1. Блок info
Основной блок, описывающий сценарий.
Важно. Значение поля info хаб считывает во время запуска и сохранения сценария, соответственно работать с ним из кода нельзя (точнее фактически можно, но это не правильно, и объект только для чтения, значения переменных туда не записать и опции не будут содержать значений). Все нужные значения необходимо получать из переменных, которые приходят в функцию trigger или compute.

#### Обязательные поля:
- `name` - название сценария
- `description` - описание функционала
- `version` - номер версии
- `author` - автор сценария
- `onStart` - если true, функция trigger будет вызвана при включении хаба и сохранении сценария
- `sourceServices` - список типов устройств, на изменения которых реагирует сценарий
- `sourceCharacteristics` - список характеристик, на изменения которых реагирует сценарий

#### Опции (options)
Опции отображаются в интерфейсе хаба в настройках логики для каждого устройства индивидуально. Определяются так же в блоке info в поле options.

##### Доступные типы полей опций:

1. **Boolean** - логическое значение (true/false)
2. **Integer** - целое число с диапазоном
3. **Double** - дробное число с диапазоном
4. **String** - строковое значение
5. **Enum** - выбор из списка (тип может быть любым из перечисленных выше, главное что бы значение в поле value опции и допустимых значений были того же типа). Отличие от других типов - нужно указать valus с списком допустимых значений и `formType: "list",`

#### Переменные (variables)
Объект для хранения данных сценария. Значения доступны только в рамках сценария и сбрасываются при перезагрузке хаба. Можно хранить любое значение для последующего использования в коде.


#### Функции

#### trigger
Основная функция сценария.
Является главной функцией и точкой входа в сценарии.
Вызывается системой после выполнения compute и фактической установки значения. 
Вызывается после выполнения функции compute и фактической установки значения в хабе.
при включённом onStart в блоке info вызывается при запуске хаба и при сохранении сценария с текущим значением характеристики.
Работает ассинхронно.
```javascript
function trigger(source, value, variables, options, context) {
  // Код сценария
}
```

#### compute
Синхронная функция, вызывается при изменении характеристики. Результат устанавливается в характеристику.
ВНИМАНИЕ! Функция выполняется синхронно и может замедлять работу хаба или приводить к неожиданному поведению.
Применять только при острой необходимости и с особой осторожностью. Не выполнять в ней сложных вычислений или долгих операций.
```javascript
function compute(source, value, variables, options, context) {
  return value;
}
```

#### Кастомные функцции
Вы можете в коде сценария создавать любые свои функции, которые будут доступны только в рамках данного сценария, и которые можно вызывать из функций trigger или compute.