import * as vscode from "vscode";
import { pipe } from "rxjs";
import { map, bufferCount, filter, share } from "rxjs/operators";

// import Analytics from "electron-google-analytics";
import * as ua from "universal-analytics";

import * as doNotDisturb from "@sindresorhus/do-not-disturb";
import * as osxBrightness from "osx-brightness";

import { logout } from "./login";
import { getWebviewContent } from "./webview";

const regression = require("regression");

const ignoreIsCharging = false;
const mockdata = false;
const verbose = true;

let config = vscode.workspace.getConfiguration("notion");
let dimScreen: boolean = config.get("dimScreen") || false;
let shouldDoNotDisturb: boolean = config.get("doNotDisturb") || false;

export function showBiometrics(
  status_bar_item: vscode.StatusBarItem,
  subscriptions: any,
  notion: any
) {
  status_bar_item.show();

  const notionAvgScoreCommandId = "notion.showAverageScore";

  let currentStatus = {
    charging: false,
    connected: false
  };

  let config = vscode.workspace.getConfiguration("notion");
  let deviceId: string = config.get("deviceId") || "";

  if (!deviceId) {
    vscode.window.showErrorMessage("Unable to read Notion device ID");
    return;
  }

  status_bar_item.text = "Notion";
  status_bar_item.command = notionAvgScoreCommandId;

  let currentPanel: vscode.WebviewPanel | undefined = undefined;

  subscriptions.push(
    vscode.commands.registerCommand(notionAvgScoreCommandId, () => {
      const columnToShowIn =
        typeof vscode.window.activeTextEditor !== "undefined" &&
        typeof vscode.window.activeTextEditor.viewColumn !== "undefined"
          ? vscode.window.activeTextEditor.viewColumn
          : vscode.ViewColumn.Beside;

      usr.event("notion_interaction", "VSCode Extension Clicked");

      if (currentPanel) {
        // If we already have a panel, show it in the target column
        console.log("we already have a panel");
        currentPanel.reveal(columnToShowIn);
      } else {
        // Create and show a new webview
        console.log("Create and show a new webview");
        currentPanel = vscode.window.createWebviewPanel(
          "notion", // Identifies the type of the webview. Used internally
          "Neurosity Notion", // Title of the panel displayed to the user
          columnToShowIn, // Editor column to show the new webview panel in.
          {
            // Enable scripts in the webview
            enableScripts: true
          }
        );

        currentPanel.webview.html = getWebviewContent();

        currentPanel.webview.postMessage({
          ...currentStatus,
          command: "notionStatus"
        });

        // Handle messages from the webview
        currentPanel.webview.onDidReceiveMessage(
          message => {
            switch (message.command) {
              case "didLoad":
                sendStatusToWebPanel(currentStatus);
                sendHistoricArraysToWebPanel();
                console.log("Web view did load");
                return;
              case "logout":
                console.log("Logout now!");
                logout().catch(console.log);
                if (currentPanel) {
                  currentPanel.dispose();
                }
            }
          },
          undefined,
          subscriptions
        );

        currentPanel.onDidDispose(
          () => {
            // When the panel is closed, cancel any future updates to the webview content
            // clearInterval(interval);
            currentPanel = undefined;
          },
          null,
          subscriptions
        );
      }
    })
  );

  const usr = ua("UA-119018391-2", { uid: deviceId });

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

  let runningAverageCalmScore = 0.0;

  const sendStatusToWebPanel = (status: any) => {
    if (currentPanel) {
      // Send a message to our webview.
      // You can send any JSON serializable data.
      currentPanel.webview.postMessage({
        ...status,
        command: "notionStatus"
      });
      console.log("Sent status to currentPanel");
    } else {
      console.log("No currentPanel");
    }
  };

  const sendHistoricArraysToWebPanel = () => {
    if (currentPanel) {
      // Send a message to our webview.
      // You can send any JSON serializable data.
      currentPanel.webview.postMessage({
        dateArray,
        flowStates,
        command: "oldFlowValues"
      });
    }
  };

  notion.status().subscribe((status: any) => {
    currentStatus = status;
    console.log("status", currentStatus);
    sendStatusToWebPanel(status);
  });

  let states: any = {
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
        calm: 0.16,
        focus: 0.25
      },
      str: "2 of 5",
      star: "   **",
      timeMultiplier: 0.25,
      val: 2
    },
    iterate: {
      limit: {
        calm: 0.2,
        focus: 0.3
      },
      str: "3 of 5",
      star: "  ***",
      timeMultiplier: 0.75,
      val: 3
    },
    create: {
      limit: {
        calm: 0.24,
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

  let paces: any = {
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

  let currentFlowState = states.initializing;
  let currentMindPace = paces.red;

  let notionTime = 0;
  let realTime = 0;
  let paceTime = 0;
  let lastDate = new Date();
  let paceArray: number[] = [];
  let flowStates: number[] = [0];
  let notionTimes: number[] = [];
  let dateArray: string[] = [new Date().toString()];
  const defaultPacePeriod = 60; // seconds
  const paceArrayLength = defaultPacePeriod; // 60 seconds times pace period is how long array is
  const getPaceMultiplier = (period: number) => {
    return (60 * 60) / period;
  };

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

  const updateTimes = () => {
    notionTime += currentFlowState.timeMultiplier;
    notionTimes.push();
    realTime += 1;
    lastDate = new Date().toString();
    dateArray.push(lastDate);
    flowStates.push(currentFlowState.val);

    paceArray.push(currentFlowState.timeMultiplier);
    let currentPaceMultiplier = defaultPacePeriod;
    if (paceArray.length > paceArrayLength) {
      paceArray.shift();
    } else {
      const numElementsInPaceArray = paceArray.length; // happens to be one per second
      currentPaceMultiplier = getPaceMultiplier(numElementsInPaceArray);
    }
    paceTime = sumArray(paceArray) * currentPaceMultiplier;
    updateMindPace();
  };

  const createMockData = () => {
    if (currentFlowState === states.initializing) {
      currentFlowState = states.distracted;
    } else if (currentFlowState === states.distracted) {
      currentFlowState = states.flow;
    } else {
      currentFlowState = states.initializing;
    }
    runningAverageCalmScore += 0.01;
    if (runningAverageCalmScore > 1.0) runningAverageCalmScore = 0;
  };

  const updateMindPace = () => {
    const prevMindPace = currentMindPace;
    if (paceTime < paces.red.limit) {
      currentMindPace = paces.red;
    } else if (paceTime < paces.yellow.limit) {
      currentMindPace = paces.yellow;
    } else {
      currentMindPace = paces.green;
    }
    if (currentMindPace !== prevMindPace) {
      if (verbose)
        console.log(`New mind pace is ${currentMindPace.str}`);
      if (shouldDoNotDisturb) controlDoNotDisturb();
      usr
        .event(
          "notion_interaction",
          "New Mind Pace",
          "pace",
          currentMindPace.val
        )
        .send();
    }
  };

  const updateFlowStatusBarText = () => {
    let str = "";
    if (currentMindPace === paces.green) {
      str = `Flow stage ${currentFlowState.str}`;
    } else if (currentMindPace === paces.yellow) {
      str = `Flow stage ${currentFlowState.str}, warning, pace slowing.`;
    } else {
      str = `Flow stage ${currentFlowState.str}, slow pace... get focused!`;
    }
    status_bar_item.text = str;
  };

  const dispatchNewFlowScoreToWindow = () => {
    const notionTimeStr = getTimeStr(notionTime);
    const earthTimeStr = getTimeStr(realTime);
    const paceTimeStr = getTimeStr(paceTime);
    if (currentPanel) {
      // Send a message to our webview.
      // You can send any JSON serializable data.
      currentPanel.webview.postMessage({
        command: "newFlowValue",
        notionTime: notionTimeStr,
        earthTime: earthTimeStr,
        paceTime: paceTimeStr,
        state: currentFlowState,
        score: runningAverageCalmScore,
        doNotDisturb: doNotDisturbEnabled
      });
    }
  };

  const sumArray = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  setInterval(() => {
    if (currentStatus.connected === false && !mockdata) {
      status_bar_item.text = `Notion not connected`;
    } else if (currentStatus.charging && !mockdata) {
      status_bar_item.text = "$(zap) Notion is charging";
    } else if (currentFlowState === states.initializing && !mockdata) {
      status_bar_item.text = `Notion is initializing, please wait`;
    } else {
      if (mockdata) {
        createMockData();
      }
      // Update all the times: notion, real and pace
      updateTimes();

      updateFlowStatusBarText();

      dispatchNewFlowScoreToWindow();
    }
    // const activeEditor = vscode.window.activeTextEditor;
    // if (activeEditor) {
    //   console.log(
    //     "activeEditor.selection.active.line",
    //     activeEditor.selection
    //   );
    // }
  }, 1000);

  let doNotDisturbEnabled = false;

  const controlDoNotDisturb = () => {
    if (currentMindPace === paces.green) {
      if (doNotDisturbEnabled === false) {
        doNotDisturb
          .enable()
          .then(() => {
            if (verbose) console.log("Do not disturb ENABLED");
          })
          .catch(console.log);
        doNotDisturbEnabled = true;
      }
    } else {
      if (doNotDisturbEnabled) {
        doNotDisturbEnabled = false;
        doNotDisturb
          .disable()
          .then(() => {
            if (verbose) console.log("Do not disturb DISABLED");
          })
          .catch(console.log);
      }
    }
  };

  const controlMacScreenBrightness = (brightness: number) => {
    if (dimScreen) {
      return osxBrightness.set(brightness);
    }
  };

  const updateMindState = (score: number) => {
    const prevMindState = currentFlowState;
    for (let key in states) {
      if (score < states[key].limit.calm) {
        currentFlowState = states[key];

        if (prevMindState !== currentFlowState) {
          usr
            .event(
              "notion_interaction",
              "Flow State",
              "state",
              currentFlowState.val
            )
            .send();
        }

        console.log(
          `${new Date().toLocaleTimeString()} ${
            currentFlowState.star
          } ${score}`
        );
        break;
      }
    }
  };

  const calmAverage$ = notion.calm().pipe(
    filter(
      () => currentStatus.connected && currentStatus.charging === false
    ),
    averageScoreBuffer(),
    share()
  );

  calmAverage$.subscribe((average: number) => {
    runningAverageCalmScore = average;
    updateMindState(runningAverageCalmScore);
    usr
      .event("notion_interaction", "Flow State Value", "value", average)
      .send();
  });

  const calmTrend$ = calmAverage$.pipe(
    bufferCount(5, 1),
    map((averages: number[]) => {
      const points = averages.map((average, i) => [i + 2, average]);
      const [slope] = regression.linear(points).equation;
      return slope;
    })
  );

  calmTrend$.subscribe((trend: number) => {
    console.log("Trend: ", trend);
    if (trend < 0) {
      if (trend < -0.01) {
        console.log("Loosing focus");
        controlMacScreenBrightness(0.5);
        setTimeout(() => {
          controlMacScreenBrightness(1);
        }, 1000);
      }
    } else if (trend > 0) {
      console.log("Gaining focus");
    }
  });
}

function averageScoreBuffer(windowCount = 30, windowStep = 5) {
  return pipe(
    map((metric: any) => metric.probability),
    bufferCount(windowCount, windowStep),
    map((probabilities: number[]): number => {
      return (
        probabilities.reduce(
          (acc: number, probability: number) => acc + probability
        ) / probabilities.length
      );
    }),
    map(average => Number(average.toFixed(2)))
  );
}
