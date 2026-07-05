info = {
  name: "Ok",
  description: "тест",
  version: "1.0",
  onStart: true,
  sourceServices: [HS.Switch],
  sourceCharacteristics: [HC.On]
}
function trigger(source, value, variables, options, context) {
  var on = source.getValue()
}
