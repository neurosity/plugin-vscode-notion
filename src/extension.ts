import * as vscode from "vscode";
import { Notion } from "@neurosity/notion";
import { filter, map, scan, bufferCount, tap } from "rxjs/operators";
// import Analytics from "electron-google-analytics";
import * as ua from "universal-analytics";

import { mapRange } from "./utils";
import { Subject } from "rxjs";

let mindStateStatusBarItem: vscode.StatusBarItem;
let kinesisStatusBarItem: vscode.StatusBarItem;

const ignoreIsCharging = false;

export async function activate({ subscriptions }: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("notion");
  const deviceId: string = config.get("deviceId") || "";
  const email: string = config.get("email") || "";
  const password: string = config.get("password") || "";

  let currentStatus = {
    charging: false,
    connected: false
  };
  const notionAvgScoreCommandId = "notion.showAverageScore";

  // create a new status bar item that we can now manage
  mindStateStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    999
  );
  mindStateStatusBarItem.command = notionAvgScoreCommandId;
  subscriptions.push(mindStateStatusBarItem);

  const notionConnectedCommandId = "notion.showConnectionStatus";
  subscriptions.push(
    vscode.commands.registerCommand(notionConnectedCommandId, () => {
      vscode.window.showInformationMessage(
        `Notion ${currentStatus.connected ? "is" : "is not"} connected`
      );
    })
  );

  subscriptions.push(
    vscode.commands.registerCommand(notionAvgScoreCommandId, () => {
      const notionTimeStr = getTimeStr(notionTime);
      const realTimeStr = getTimeStr(realTime);
      let msg = "";
      if (currentStatus.charging) {
        msg = "Invest in yourself, unplug Notion and get in the zone.";
      } else if (currentStatus.connected) {
        msg = `Notion time: ${notionTimeStr} | Earth time: ${realTimeStr}`;
      } else {
        msg = `Notion is not connected`;
      }
      vscode.window.showInformationMessage(msg);
    })
  );

  mindStateStatusBarItem.text = `Enter user name, device id and password`;
  mindStateStatusBarItem.show();

  if (!deviceId || !email || !password) {
    return;
  }

  mindStateStatusBarItem.text = "Notion";

  const usr = ua("UA-119018391-2", { uid: deviceId });

  // const analytics = new Analytics("UA-119018391-2");

  // let clientId = "deviceId"
  // async function trackEvent(category, action, label, value) {
  //    analytics.event(category, action, { evLabel: label, evValue: value, clientId: clientId})
  //     .then(response => {
  //       clientId = response.clientId;
  //       console.log("Response", JSON.stringify(response));
  //       return response;
  //     })
  //     .catch(err => {
  //       console.log("Error", JSON.stringify(err));
  //       return err;
  //     });
  // }

  const trackEvent = (
    category: string,
    action: string,
    label: string | undefined,
    value: string | number | undefined
  ) => {
    usr
      .event({
        ec: category,
        ea: action,
        el: label,
        ev: value
      })
      .send();
  };

  usr.event("notion_interaction", "VSCode Session Started");

  const notion = new Notion({
    deviceId
  });

  await notion.login({
    email,
    password
  });

  let runningAverageScore = 0.0;
  notion.status().subscribe((status: any) => {
    currentStatus = status;
    console.log("status", currentStatus);
  });

  let $powerByBandAvg = new Subject();
  notion.brainwaves("powerByBand").subscribe(powerByBand => {
    let sumPower = 0;
    for (let i = 0; i < 8; i++) {
      sumPower += powerByBand.data.beta[i];
    }
    $powerByBandAvg.next(sumPower / 8);
    // console.log("powerByBand", sumPower, sumPower/8);
  });

  // $powerByBandAvg.pipe(bufferCount(30, 5)).subscribe((values: number[]) => {
  //   if (currentStatus.connected == false) {
  //     mindStateStatusBarItem.text = `Notion is not connected`;
  //     // } else if (currentStatus.charging) {
  //     // mindStateStatusBarItem.text = `Notion can't be used while charging`;
  //   } else {
  //     let sum = 0;
  //     values.forEach((metric: number) => {
  //       sum += metric;
  //     });
  //     const avg = sum / values.length;
  //     // console.log(`Average score ${avg}`);
  //   }
  // });

  let states: any = {
    initializing: {
      limit: {
        calm: 0
      },
      str: "Initializing",
      star: "     ",
      timeMultiplier: 0,
      val: 0
    },
    distracted: {
      limit: {
        calm: 0.1
      },
      str: "1 of 5",
      star: "    *",
      timeMultiplier: 0,
      val: 1
    },
    grind: {
      limit: {
        calm: 0.16
      },
      str: "2 of 5",
      star: "   **",
      timeMultiplier: 0.25,
      val: 2
    },
    iterate: {
      limit: {
        calm: 0.2
      },
      str: "3 of 5",
      star: "  ***",
      timeMultiplier: 0.75,
      val: 3
    },
    create: {
      limit: {
        calm: 0.24
      },
      str: "4 of 5",
      star: " ****",
      timeMultiplier: 0.9,
      val: 4
    },
    flow: {
      limit: {
        calm: 1.0
      },
      str: "5",
      star: "*****",
      timeMultiplier: 1.0,
      val: 5
    }
  };

  let currentMindState = states.initializing;

  let notionTime = 0;
  let realTime = 0;
  let paceArray: number[] = [];
  const paceArrayLength = 50 * 5;
  // for (let i = 0; i < paceArrayLength; i++) {
  //   paceArray.push(0);
  // }

  function padLeftZero(time: number) {
    return `${time < 10 ? `0${time}` : time}`;
  }

  function getTimeStr(time: number) {
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

  const sumArray = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  setInterval(() => {
    if (currentStatus.connected === false) {
      mindStateStatusBarItem.text = `Notion not connected`;
    } else if (currentStatus.charging) {
      mindStateStatusBarItem.text =
        "$(circle-slash) Notion is charging. $(circle-slash)";
    } else if (currentMindState === states.initializing) {
      mindStateStatusBarItem.text = `Notion is initializing, please wait.`;
    } else {
      if (currentStatus.charging === false || ignoreIsCharging) {
        paceArray.push(currentMindState.timeMultiplier);
        notionTime += currentMindState.timeMultiplier;
        realTime += 1;
      }

      if (paceArray.length > paceArrayLength) {
        paceArray.shift();
      }

      const paceTimeStr = getTimeStr(sumArray(paceArray) * 12); // multiply pace time by 12 to exterpolate an hour from 5 minutes of data
      let str = "";
      const runningAverageStr = (runningAverageScore * 100).toFixed(0);
      str = `Stage ${currentMindState.str} w/ pace of ${paceTimeStr}/hour @ score ${runningAverageStr}`;
      mindStateStatusBarItem.text = str;
    }
  }, 1000);

  notion
    .calm()
    .pipe(bufferCount(30, 5))
    .subscribe((values: object[]) => {
      if (currentStatus.connected && currentStatus.charging === false) {
        let sum = 0;
        values.forEach((metric: any) => {
          sum += metric.probability;
        });
        const avg = sum / values.length;
        runningAverageScore = avg;
        usr
          .event("notion_interaction", "Flow State Value", "value", avg)
          .send();
        const prevMindState = currentMindState;
        for (let key in states) {
          if (avg < states[key].limit.calm) {
            if (prevMindState !== states[key]) {
              usr
                .event(
                  "notion_interaction",
                  "Flow State",
                  "state",
                  states[key].val
                )
                .send();
            }
            currentMindState = states[key];
            console.log(
              `${new Date().toLocaleTimeString()} ${
                currentMindState.star
              } ${avg}`
            );
            break;
          }
        }
      }
    });
}
