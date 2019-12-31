import * as vscode from "vscode";
import { pipe } from "rxjs";
import { map, bufferCount, filter, share } from "rxjs/operators";

// import Analytics from "electron-google-analytics";
import * as ua from "universal-analytics";

import * as doNotDisturb from "@sindresorhus/do-not-disturb";
import * as osxBrightness from "osx-brightness";

import { logout } from "./login";

const regression = require("regression");

const ignoreIsCharging = false;
const mockdata = false;
const verbose = true;

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

  function getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vue/dist/vue.js"></script>
    <title>Notion</title>
    <style>
    body {
      background-color: #00031a;
    }
    h1, h2, h3 {
      text-color: #5c717b;
      text-align: center;
    }
    .user-nav {
      display: flex;
      justify-content: center;
    }
    button.logout {
      display:inline-block;
      padding:0.3em 1.2em;
      margin:0 0.1em 0.1em 0;
      border:0.16em solid rgba(255,255,255,0);
      border-radius:2em;
      box-sizing: border-box;
      text-decoration:none;
      font-family:'Roboto',sans-serif;
      font-weight:300;
      color:#FFFFFF;
      background-color:#f14e4e;
      text-shadow: 0 0.04em 0.04em rgba(0,0,0,0.35);
      text-align:center;
      transition: all 0.2s;
    }
    button.logout:hover{
      border-color: rgba(255,255,255,1);
    }
    </style>
</head>
<body>
  <div id="app">
    <h1>VSCode Notion Extension</h1>
    <h2>{{ headlineMessage }}</h2>
    <h3 v-if="connected && !charging">{{ doNotDisturbMessage }}</h3>
    <h3 v-if="connected && !charging">{{ paceMessage }}</h3>
    <h3 v-if="connected && !charging">{{ earthMessage }}</h3>
    <h3 v-if="connected && !charging">{{ notionMessage }}</h3>
    <h3 v-if="connected && !charging">{{ flowMessage }}</h3>
    <div v-if="connected && !charging" id="graph" style="width:600px;height:250px;margin:auto;"></div>
    <div class="user-nav">
      <button class="logout" v-on:click="logout">Logout</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    const app = new Vue({
        el: '#app',
        data: {
          paceTime: '',
          notionTime: '',
          earthTime: '',
          doNotDisturb: false,
          charging: false,
          connected: false,
          flowStage: '',
          score: NaN
        },
        computed: {
          paceMessage() {
            return "You're on pace to work " + this.paceTime + " minutes this hour.";
          },
          earthMessage() {
            return "Earth time elapsed " + this.earthTime + ".";
          },
          notionMessage() {
            return "True time " + this.notionTime + ".";
          },
          doNotDisturbMessage() {
            return "Do not disturb is " + (this.doNotDisturb ? "active" : "not active");
          },
          flowMessage() {
            const flowScore = Math.floor(this.score*100);
            return "Flow stage " + this.flowStage + " with instant flow score of " + flowScore;
          },
          headlineMessage() {
            if (this.connected === false) {
              return "Notion not connected";
            } else if (this.charging) {
              return "Notion is in sleep mode";
            } else {
              return "Notion is active";
            }
          }
        },
        methods: {
          logout(event) {
            vscode.postMessage({
              command: 'logout'
            });
          }
        }
    });    
    
    function rand() {
      return Math.random();
    }

    let windowLoaded = false;
    let loadedInitDataInGraph = false;

    window.onload = () => {
      windowLoaded = true;
      console.log("Window loaded");
      vscode.postMessage({
        command: 'didLoad'
      });
    }   
    
    // Handle the message inside the webview
    window.addEventListener('message', event => {

      const message = event.data; // The JSON data our extension sent
      if (message.command === 'newFlowValue') {
        
        app.paceTime = message.paceTime;
        app.notionTime = message.notionTime;
        app.earthTime = message.earthTime;
        app.score = message.score;
        app.doNotDisturb = message.doNotDisturb;
        app.flowStage = message.state.str;
        
        const time = new Date();

        console.log('message', message);

        if (loadedInitDataInGraph) {
          let update = {
            x:  [[time]],
            y: [[message.state.val]]
          }
          
          Plotly.extendTraces('graph', update, [0])   
        } else {
          loadedInitDataInGraph = true;
          var data = [{
            x: [time], 
            y: [0],
            mode: 'lines',
            line: {color: '#80CAF6'}
          }] 
        
          Plotly.plot('graph', data);  
        }
      
     
      } else if (message.command === 'oldFlowValues') {
        // loadedInitDataInGraph = true;
        // const dateArray = message.dateArray;
        // const flowStates = message.flowStates;
    
        // var data = [{
        //   x: dateArray, 
        //   y: flowStates,
        //   mode: 'lines',
        //   line: {color: '#80CAF6'}
        // }] 
        
        // Plotly.plot('graph', data);   
      } else if (message.command === 'notionStatus') {
        app.charging = message.charging;
        app.connected = message.connected;
      }
    });
  </script>
</body>
</html>`;
  }

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
  let runningAverageFocusScore = 0.0;

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
  let flowStates: number[] = [];
  let notionTimes: number[] = [];
  let dateArray: Date[] = [];
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
    lastDate = new Date();
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

    runningAverageFocusScore += 0.01;
    if (runningAverageFocusScore > 1.0) runningAverageFocusScore = 0;
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
      controlDoNotDisturb();
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
        score: runningAverageFocusScore,
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
    return osxBrightness.set(brightness);
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

  const focusAverage$ = notion.focus().pipe(
    filter(
      () => currentStatus.connected && currentStatus.charging === false
    ),
    averageScoreBuffer(),
    share()
  );

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

  focusAverage$.subscribe((average: number) => {
    runningAverageFocusScore = average;
    console.log(
      `Focus score ${runningAverageFocusScore} and calm score ${runningAverageCalmScore}`
    );
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
