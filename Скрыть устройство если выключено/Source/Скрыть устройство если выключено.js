info = {
    name: "Скрыть устройство если выключено",
    description: "Скрывает выключенные устройства. Используется, например, для создания комнаты-индикатора, куда добавляются виртуальные копии всех устройств, за которыми нужен контроль и включается логика. Если включено - будет отображаться, иначе скрываться. Обновления тут: https://github.com/KirillAshikhmin/Sprut.Hub_Tools",
    version: "0.1",
    author: "@BOOMikru",
    onStart: true,

    sourceServices: [
        HS.Lightbulb,
        HS.Switch,
        HS.Television,
        HS.Window,
        HS.ContactSensor,
        HS.Door,
        HS.Fan,
        HS.FanBasic,
        HS.GarageDoorOpener,
        HS.Valve,
        HS.Faucet,
        HS.AirPurifier,
        HS.Outlet,
        HS.HumidifierDehumidifier,
        HS.WindowCovering
    ],
    sourceCharacteristics: [
        HC.On,
        HC.Active,
        HC.ContactSensorState,
        HC.CurrentPosition,
        HC.CurrentDoorState
    ],
}
function trigger(source, value, variables, options) {
    const service = source.getService()
    if (source.getType() == HC.On) {
        service.setVisible(value)
    }
    if (source.getType() == HC.Active) {
        service.setVisible(value == 1)
    }
    if (source.getType() == HC.CurrentPosition) {
        service.setVisible(value == 100)
    }
    if (source.getType() == HC.ContactSensorState) {
        service.setVisible(value == 1)
    }
    if (source.getType() == HC.CurrentDoorState) {
        service.setVisible(value == 0)
    }
}