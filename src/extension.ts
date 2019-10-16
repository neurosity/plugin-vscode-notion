import * as vscode from "vscode";
import { Notion } from "@neurosity/notion";
import { filter, map, scan, bufferCount, tap } from "rxjs/operators";

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

  if (!deviceId || !email || !password) {
    return;
  }

  const notion = new Notion({
    deviceId
  });

  await notion.login({
    email,
    password
  });

  let currentStatus = {
    charging: false,
    connected: false
  };
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

  $powerByBandAvg.pipe(bufferCount(30, 5)).subscribe((values: number[]) => {
    if (currentStatus.connected == false) {
      mindStateStatusBarItem.text = `Notion is not connected`;
      // } else if (currentStatus.charging) {
      // mindStateStatusBarItem.text = `Notion can't be used while charging`;
    } else {
      let sum = 0;
      values.forEach((metric: number) => {
        sum += metric;
      });
      const avg = sum / values.length;
      console.log(`Average score ${avg}`);
    }
  });

  const notionConnectedCommandId = "notion.showConnectionStatus";
  subscriptions.push(
    vscode.commands.registerCommand(notionConnectedCommandId, () => {
      vscode.window.showInformationMessage(
        `Notion ${currentStatus.connected ? "is" : "is not"} connected`
      );
    })
  );

  const notionAvgScoreCommandId = "notion.showAverageScore";
  subscriptions.push(
    vscode.commands.registerCommand(notionAvgScoreCommandId, () => {
      vscode.window.showInformationMessage(
        `Average flow score is ${runningAverageScore}`
      );
    })
  );

  /**
   * Kinesis
   */
  const kinesisLabel = "rightHandPinch";
  // mind.kinesis(kinesisLabel).subscribe(() => {
  //   vscode.commands.executeCommand("editorScroll", {
  //     to: "down",
  //     by: "line"
  //   });
  // });

  const kinesisIcon = `$(rocket)`;
  let kinesisDescription = `mind control`;

  notion.predictions(kinesisLabel).subscribe(({ probability }) => {
    const score = Math.round(probability * 100); // +50 treshold for transfer learning
    //kinesisDescription = `hands free`;

    if (score >= 95)
      kinesisStatusBarItem.text = `${kinesisIcon} ${kinesisDescription} ███████`;
    else if (score >= 75)
      kinesisStatusBarItem.text = `${kinesisIcon} ${kinesisDescription} ██████░`;
    else if (score >= 65)
      kinesisStatusBarItem.text = `${kinesisIcon} ${kinesisDescription} █████░░`;
    else if (score >= 50)
      kinesisStatusBarItem.text = `${kinesisIcon} ${kinesisDescription} ████░░░`;
    else if (score >= 40)
      kinesisStatusBarItem.text = `${kinesisIcon} ${kinesisDescription} ███░░░░`;
    else if (score >= 25)
      kinesisStatusBarItem.text = `${kinesisIcon} ${kinesisDescription} ██░░░░░`;
    else if (score >= 15)
      kinesisStatusBarItem.text = `${kinesisIcon} ${kinesisDescription} █░░░░░░`;
    else
      kinesisStatusBarItem.text = `${kinesisIcon} ${kinesisDescription} ░░░░░░░`;
  });

  // kinesisStatusBarItem = vscode.window.createStatusBarItem(
  //   vscode.StatusBarAlignment.Right,
  //   998
  // );

  // kinesisStatusBarItem.text = `${kinesisIcon} ${kinesisDescription} ░░░░░░░`;
  //kinesisStatusBarItem.show();

  /**
   * Calm
   */
  // create a new status bar item that we can now manage
  mindStateStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    999
  );
  mindStateStatusBarItem.command = notionAvgScoreCommandId;
  subscriptions.push(mindStateStatusBarItem);

  const maxScorePerSecond = 3;

  let states: any = {
    initializing: {
      limit: {
        calm: 0
      },
      str: "Initializing",
      timeMultiplier: 0,
      val: 0
    },
    distracted: {
      limit: {
        calm: 0.1
      },
      str: "1 of 5",
      timeMultiplier: 0,
      val: 0
    },
    grind: {
      limit: {
        calm: 0.14
      },
      str: "2 of 5",
      timeMultiplier: 0.25,
      val: 0
    },
    iterate: {
      limit: {
        calm: 0.18
      },
      str: "3 of 5",
      timeMultiplier: 0.75,
      val: 0
    },
    create: {
      limit: {
        calm: 0.23
      },
      str: "4 of 5",
      timeMultiplier: 1.0,
      val: 0
    },
    flow: {
      limit: {
        calm: 1.0
      },
      str: "5",
      timeMultiplier: 1.2,
      val: 0
    }
  };

  let currentMindState = states.initializing;

  let notionTime = 0;
  let realTime = 0;

  function getTimeStr(time: number) {
    const timeInSeconds = Math.round(time % 60);
    const timeInMinutes = Math.round((time - timeInSeconds) / 60);
    return `${timeInMinutes}:${
      timeInSeconds < 10 ? `0${timeInSeconds}` : timeInSeconds
    }`;
  }

  setInterval(() => {
    if (currentMindState === states.initializing) {
      mindStateStatusBarItem.text = `Notion is initializing, please wait.`;
    } else if (currentStatus.connected === false) {
      mindStateStatusBarItem.text = `Notion not connected`;
    } else {
      if (currentStatus.charging === false || ignoreIsCharging) {
        notionTime += currentMindState.timeMultiplier;
        realTime += 1;
      }

      const notionTimeStr = getTimeStr(notionTime);
      const realTimeStr = getTimeStr(realTime);

      mindStateStatusBarItem.text = `Flow level ${currentMindState.str} | Notion time: ${notionTimeStr} | Earth time: ${realTimeStr}`;
    }
  }, 1000);

  notion
    .calm()
    .pipe(bufferCount(30, 5))
    .subscribe((values: object[]) => {
      if (currentStatus.connected == false) {
        mindStateStatusBarItem.text = `Notion is not connected`;
      } else if (currentStatus.charging) {
        mindStateStatusBarItem.text = `Notion can't be used while charging`;
      } else {
        let sum = 0;
        values.forEach((metric: any) => {
          sum += metric.probability;
        });
        const avg = sum / values.length;
        runningAverageScore = avg;
        for (let key in states) {
          if (avg < states[key].limit.calm) {
            currentMindState = states[key];
            break;
          }
        }
      }
    });

  mindStateStatusBarItem.text = `Notion time spooling up`;
  mindStateStatusBarItem.show();
}
