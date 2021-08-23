import * as vscode from "vscode";
import { pipe } from "rxjs";
import { map, bufferCount, filter, share, tap } from "rxjs/operators";

// import Analytics from "electron-google-analytics";
import * as moment from "moment";
import * as ua from "universal-analytics";

import * as doNotDisturb from "@sindresorhus/do-not-disturb";
import * as osxBrightness from "osx-brightness";

import { logout } from "./login";
import {
  defaultPaces,
  defaultStates,
  getPaceMultiplier,
  getTimeStr
} from "./utils";
import { incrementalBuffer } from "./utils/incrementalBuffer";

const regression = require("regression");
const path = require("path");
const fs = require("fs");

const isMac = process.platform === "darwin";

const mockdata = false;
const verbose = true;

const kConfigDimScreen = "dimScreen";
const kConfigDoNotDisturb = "doNotDisturb";
const kConfigShowDistractedNotification = "showDistractedNotification";

let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
  "notion"
);
let shouldDimScreen: boolean = config.get(kConfigDimScreen) || false;
let shouldDoNotDisturb: boolean = config.get(kConfigDoNotDisturb) || false;
let shouldShowDistractedNotification =
  config.get(kConfigShowDistractedNotification) || false;

export function showBiometrics(
  context: vscode.ExtensionContext,
  status_bar_item: vscode.StatusBarItem,
  subscriptions: any,
  notion: any
) {
  status_bar_item.show();

  const notionAvgScoreCommandId = "notion.showAverageScore";

  let currentStatus = {
    charging: false,
    state: "offline"
  };

  let config = vscode.workspace.getConfiguration("notion");
  let deviceId: string = config.get("deviceId") || "";

  if (!deviceId) {
    vscode.window.showErrorMessage("Unable to read Notion device ID");
    return;
  }

  const toggleConfigValue = (configKey: string): boolean => {
    stopConfigToViewSync();
    const config = vscode.workspace.getConfiguration("notion");
    const currentValue = config.get(configKey) || false;
    const newValue = !currentValue;
    config.update(configKey, newValue, true);
    startConfigToViewSync();
    return newValue;
  };

  const getConfigValue = (configKey: string): any => {
    config = vscode.workspace.getConfiguration("notion");
    return config.get(configKey);
  };

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

        let webviewHtmlPath: vscode.Uri = vscode.Uri.file(
          path.join(context.extensionPath, "layout", "view.html")
        );

        currentPanel.webview.html = fs.readFileSync(
          webviewHtmlPath.fsPath,
          "utf8"
        );

        sendStatusToWebPanel(currentStatus);

        // Handle messages from the webview
        currentPanel.webview.onDidReceiveMessage(
          message => {
            switch (message.command) {
              case "didLoad":
                sendStatusToWebPanel(currentStatus);
                sendHistoricArraysToWebPanel();
                console.log("Web view did load");
                break;
              case "logout":
                logout().catch(console.log);
                if (currentPanel) {
                  currentPanel.dispose();
                }
                break;
              case "toggleDimScreen":
                shouldDimScreen = toggleConfigValue(kConfigDimScreen);
                break;
              case "toggleShowDistractedNotification":
                shouldShowDistractedNotification = toggleConfigValue(
                  kConfigShowDistractedNotification
                );
                break;
              case "toggleDoNotDisturb":
                shouldDoNotDisturb = toggleConfigValue(kConfigDoNotDisturb);
                if (doNotDisturbEnabled) {
                  disableDoNotDisturb();
                }
                break;
              case "startNewSession":
                initializeStateArrays();
                break;
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

  usr.event("notion_interaction", "VSCode Session Started");

  let runningAverageCalmScore = 0.0;

  const sendConfigToWebPanel = () => {
    config = vscode.workspace.getConfiguration("notion");
    shouldDimScreen = config.get(kConfigDimScreen) || false;
    shouldDoNotDisturb = config.get(kConfigDoNotDisturb) || false;
    shouldShowDistractedNotification =
      config.get(kConfigShowDistractedNotification) || false;
    if (currentPanel) {
      // Send a message to our webview.
      // You can send any JSON serializable data.
      currentPanel.webview.postMessage({
        shouldDoNotDisturb,
        shouldDimScreen,
        shouldShowDistractedNotification,
        platform: process.platform,
        command: "config"
      });
    }
  };

  const sendStatusToWebPanel = (status: any) => {
    if (currentPanel) {
      // Send a message to our webview.
      // You can send any JSON serializable data.
      currentPanel.webview.postMessage({
        status,
        command: "status"
      });
    }
  };

  let configToViewSyncInterval: NodeJS.Timeout | null = null;

  const startConfigToViewSync = () => {
    configToViewSyncInterval = setInterval(() => {
      sendConfigToWebPanel();
    }, 500);
  };
  startConfigToViewSync();

  const stopConfigToViewSync = () => {
    if (configToViewSyncInterval) {
      clearInterval(configToViewSyncInterval);
      configToViewSyncInterval = null;
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
    sendStatusToWebPanel(status);
  });

  let states = defaultStates();
  let paces = defaultPaces();

  let currentFlowState = states.initializing;
  let currentMindPace = paces.red;

  let notionTime = 0;
  let realTime = 0;
  let paceTime = 0;
  let lastDate = new Date().toString();
  let paceArray: number[] = [];
  let flowStates: number[] = [];
  let notionTimes: number[] = [];
  let dateArray: string[] = [];

  const defaultPacePeriod = 60; // seconds
  const paceArrayLength = defaultPacePeriod; // 60 seconds times pace period is how long array is

  const initializeStateArrays = () => {
    notionTime = 0;
    realTime = 0;
    paceTime = 0;
    flowStates = [0];
    dateArray = [new Date().toString()];
    if (currentPanel) {
      currentPanel.webview.postMessage({
        command: "newSessionStarted"
      });
    }
  };
  initializeStateArrays();

  const updateTimes = () => {
    notionTime += currentFlowState.timeMultiplier;
    notionTimes.push();
    realTime += 1;
    lastDate = moment(Date.now()).format("hh:mm:ss A");
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
      if (verbose) console.log(`New mind pace is ${currentMindPace.str}`);
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
        timestamp: lastDate,
        state: currentFlowState,
        score: runningAverageCalmScore,
        doNotDisturb: doNotDisturbEnabled
      });
    }
  };

  const sumArray = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  setInterval(() => {
    if (currentStatus.state !== "online" && !mockdata) {
      status_bar_item.text = `Notion not online`;
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

  const disableDoNotDisturb = () => {
    doNotDisturbEnabled = false;
    doNotDisturb
      .disable()
      .then(() => {
        if (verbose) console.log("Do not disturb DISABLED");
      })
      .catch(console.log);
  };

  const enableDoNotDisturb = () => {
    doNotDisturb
      .enable()
      .then(() => {
        if (verbose) console.log("Do not disturb ENABLED");
      })
      .catch(console.log);
    doNotDisturbEnabled = true;
  };

  const controlDoNotDisturb = () => {
    if (currentMindPace === paces.green) {
      if (!doNotDisturbEnabled) {
        enableDoNotDisturb();
      }
    } else {
      if (doNotDisturbEnabled) {
        disableDoNotDisturb();
      }
    }
  };

  const controlMacScreenBrightness = (brightness: number) => {
    if (shouldDimScreen) {
      return osxBrightness.set(brightness);
    }
  };

  const controlShowDistractedNotification = () => {
    if (shouldShowDistractedNotification) {
      vscode.window.showInformationMessage("Loosing focus...");
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
          `${new Date().toLocaleTimeString()} ${currentFlowState.star} ${score}`
        );
        break;
      }
    }
  };

  const calmAverage$ = notion.calm().pipe(
    filter(() => currentStatus.state === "online" && currentStatus.charging === false),
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
      const [slope] = regression.linear(points, { precision: 3 }).equation;

      return slope;
    })
  );

  calmTrend$.subscribe((trend: number) => {
    console.log("Trend: ", trend);
    if (trend < 0) {
      if (trend < -0.01) {
        console.log("Loosing focus");
        if (isMac) {
          controlMacScreenBrightness(0.5);
          setTimeout(() => {
            controlMacScreenBrightness(1);
          }, 1000);
        }
        controlShowDistractedNotification();
      }
    } else if (trend > 0) {
      console.log("Gaining focus");
    }
  });

  const focusAverage$ = notion.focus().pipe(
    filter(() => currentStatus.state === "online" && currentStatus.charging === false),
    averageScoreBuffer(),
    share()
  );

  focusAverage$.subscribe();
}

function averageScoreBuffer(maxItems = 30, minItems = 4) {
  return pipe(
    map((metric: any) => metric.probability),
    incrementalBuffer({
      maxItems,
      minItems,
      incrementCountBy: 1
    }),
    map((probabilities: number[]): number => {
      return (
        probabilities.reduce(
          (acc: number, probability: number) => acc + probability
        ) / probabilities.length
      );
    }),
    map(average => Number(average.toFixed(3)))
  );
}
