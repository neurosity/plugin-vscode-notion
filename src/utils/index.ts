export function mapRange(
  value: number,
  lowValue: number,
  highValue: number,
  lowScale: number = 0,
  highScale: number = 1
): number {
  return (
    lowScale +
    ((highScale - lowScale) * (value - lowValue)) / (highValue - lowValue)
  );
}

export function defaultStates(): any {
  return {
    initializing: {
      limit: {
        calm: 0,
        focus: 0
      },
      str: "Initializing",
      star: "     ",
      timeMultiplier: 0,
      val: 0
    },
    distracted: {
      limit: {
        calm: 0.1,
        focus: 0.15
      },
      str: "1 of 5",
      star: "    *",
      timeMultiplier: 0,
      val: 1
    },
    grind: {
      limit: {
        calm: 0.3,
        focus: 0.25
      },
      str: "2 of 5",
      star: "   **",
      timeMultiplier: 0.25,
      val: 2
    },
    iterate: {
      limit: {
        calm: 0.4,
        focus: 0.3
      },
      str: "3 of 5",
      star: "  ***",
      timeMultiplier: 0.75,
      val: 3
    },
    create: {
      limit: {
        calm: 0.5,
        focus: 0.33
      },
      str: "4 of 5",
      star: " ****",
      timeMultiplier: 0.9,
      val: 4
    },
    flow: {
      limit: {
        calm: 1.0,
        focus: 1.0
      },
      str: "5",
      star: "*****",
      timeMultiplier: 1.0,
      val: 5
    }
  };
}

export function defaultPaces(): any {
  return {
    green: {
      limit: 60 * 60,
      str: "green",
      val: 2
    },
    yellow: {
      limit: 60 * 40,
      str: "yellow",
      val: 1
    },
    red: {
      limit: 60 * 20,
      str: "red",
      val: 0
    }
  };
}

export const getPaceMultiplier = (period: number) => {
  return (60 * 60) / period;
};

function padLeftZero(time: number) {
  return `${time < 10 ? `0${time}` : time}`;
}

export function getTimeStr(time: number) {
  const timeInSeconds = Math.round(time % 60);
  let timeInMinutes = Math.round((time - timeInSeconds) / 60);
  if (timeInMinutes < 60) {
    return `${timeInMinutes}:${padLeftZero(timeInSeconds)}`;
  } else {
    const timeInHours = Math.floor(timeInMinutes / 60);
    timeInMinutes = timeInMinutes % 60;
    return `${timeInHours}:${padLeftZero(timeInMinutes)}:${padLeftZero(
      timeInSeconds
    )}`;
  }
}
