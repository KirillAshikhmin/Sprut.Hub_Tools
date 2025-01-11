info = {
  name: "Конвертер температуры в цвет",
  description: "Устанавливает оттенок и нысыщенность у лампы при изменении её цветовой температуры. Обновления по ссылке https://github.com/KirillAshikhmin/Sprut.Hub_Tools/tree/main/Циркадное%20освещение",
  version: "1.0",
  author: "@BOOMikru",
  onStart: false,

  sourceServices: [HS.Lightbulb],
  sourceCharacteristics: [HC.ColorTemperature],
}

function trigger(source, value, variables, options) {
    const hueAndSat = global.getHueAndSaturationFromMired(value)
    const hue = source.getService().getCharacteristic(HC.Hue)
    const sat = source.getService().getCharacteristic(HC.Saturation)
    if (hue == null || sat == null) {
        console.error("Циркадное освещение. Лампочка {}, не умеет изменять оттенок или насыщенность", source.getAccessory())
        return;
    }

    hue.setValue(hueAndSat[0])
    sat.setValue(hueAndSat[1])
}