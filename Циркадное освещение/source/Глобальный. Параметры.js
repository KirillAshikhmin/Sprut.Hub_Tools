// Режим: { Час: [Температура, Яркость] }
var onTime = {

    // Долго держится большая яркость, температура света утром холоднеет медленнее
    0: {
        0: [400, 60],
        1: [400, 60],
        2: [400, 60],
        3: [400, 30],
        4: [400, 30],
        5: [400, 30],
        6: [400, 70],
        7: [350, 100],
        8: [300, 100],
        9: [250, 100],
        10: [150, 100],
        11: [100, 100],
        12: [50, 100],
        13: [50, 100],
        14: [50, 100],
        15: [50, 100],
        16: [100, 100],
        17: [150, 100],
        18: [200, 100],
        19: [250, 100],
        20: [300, 90],
        21: [350, 60],
        22: [400, 60],
        23: [400, 60]
    },

    // Яркость вечером уменьшается раньше, утром включается холодный свет
    1: {
        0: [400, 20],
        1: [400, 10],
        2: [400, 10],
        3: [400, 10],
        4: [400, 10],
        5: [400, 10],
        6: [150, 70],
        7: [100, 100],
        8: [50, 100],
        9: [50, 100],
        10: [50, 100],
        11: [50, 100],
        12: [50, 100],
        13: [50, 100],
        14: [50, 100],
        15: [50, 100],
        16: [100, 100],
        17: [150, 100],
        18: [200, 100],
        19: [250, 100],
        20: [300, 90],
        21: [350, 60],
        22: [400, 40],
        23: [400, 30]
    },
    // С постоянной максимальной яркостью. утром включается холодный свет
    2: {
        0: [400, 100],
        1: [400, 100],
        2: [400, 100],
        3: [400, 100],
        4: [400, 100],
        5: [400, 100],
        6: [300, 100],
        7: [150, 100],
        8: [50, 100],
        9: [50, 100],
        10: [50, 100],
        11: [50, 100],
        12: [50, 100],
        13: [50, 100],
        14: [50, 100],
        15: [50, 100],
        16: [100, 100],
        17: [150, 100],
        18: [200, 100],
        19: [250, 100],
        20: [300, 100],
        21: [350, 100],
        22: [400, 100],
        23: [400, 100]
    }
}

const miredToHueAndSaturation = {
    50: [210, 30],
    60: [205, 28],
    70: [200, 26],
    80: [195, 24],
    90: [190, 22],
    100: [185, 20],
    110: [180, 18],
    120: [170, 12],
    130: [160, 6],
    140: [150, 0],
    150: [140, 0],
    160: [130, 0],
    170: [120, 0],
    180: [110, 0],
    190: [100, 0],
    200: [90, 0],
    210: [80, 4],
    220: [70, 8],
    230: [60, 16],
    240: [55, 20],
    250: [50, 24],
    260: [45, 28],
    270: [40, 32],
    280: [35, 36],
    290: [33, 40],
    300: [32, 44],
    310: [31, 48],
    320: [30, 52],
    330: [30, 56],
    340: [30, 60],
    350: [30, 64],
    360: [30, 68],
    370: [30, 72],
    380: [30, 76],
    390: [30, 78],
    400: [30, 80]
};

function getCircadianPreset(preset) {
    let onTimePreset = onTime[0]
    if (preset) {
        preset = Number(preset)
        if (!isNaN(preset) && preset in onTime) {
            onTimePreset = onTime[preset]
        }
    }
    return onTimePreset
}

function getMiredToHueAndSaturationMap() {
    return miredToHueAndSaturation
}