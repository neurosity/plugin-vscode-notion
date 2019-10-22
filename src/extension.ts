import * as vscode from "vscode";
import { Notion } from "@neurosity/notion";
// import { BufferedMetricsLogger } from "datadog-metrics";
import { Chart } from "frappe-charts";
import { filter, map, scan, bufferCount, tap } from "rxjs/operators";
import * as doNotDisturb from "@sindresorhus/do-not-disturb";

// import Analytics from "electron-google-analytics";
import * as ua from "universal-analytics";
// import * as StatsD from "hot-shots";

import { Subject } from "rxjs";

let mindStateStatusBarItem: vscode.StatusBarItem;

const ignoreIsCharging = false;

// const metricsLogger = new BufferedMetricsLogger({
//   apiKey: "351eb75be1c8b7afa769e0e8e96026d4",
//   host: "11b10da",
//   prefix: "vscode."
// });

export async function activate(context: vscode.ExtensionContext) {
  const { subscriptions } = context;
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
  </head>
  <body>
    <div id="app">
      <h1>Notion by Neurosity</h1>
      <h2>{{ headline }}</h2>
      <h3>{{ paceMessage }}</h3>
      <h3>{{ earthMessage }}</h3>
      <h3>{{ notionMessage }}</h3>
      <h3>Instant flow score {{ score }}</h3>
      <div id="tester" style="width:600px;height:250px;"></div>
    </div>

    <script>
      const app = new Vue({
          el: '#app',
          data: {
            paceTime: '',
            notionTime: '',
            earthTime: '',
            headline: '',
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
            }
          }
      })
    
      let plotData = {x:[0], y:[0]}
      const TESTER = document.getElementById('tester');

      Plotly.plot( TESTER, [plotData], { margin: { t: 0 } } );      

      // Handle the message inside the webview
      window.addEventListener('message', event => {

        const message = event.data; // The JSON data our extension sent
        if (message.command === 'newFlowValue') {
          
          app.paceTime = message.paceTime;
          app.notionTime = message.notionTime;
          app.earthTime = message.earthTime;
          app.score = message.score;
          plotData = {
            x: [message.timestamps],
            y: [message.flowStates]
          }
          console.log("plotData", plotData);
          Plotly.restyle( TESTER, plotData);
        } else if (message.command === 'notionStatus') {
          if (message.charging) {
            app.headline = "Invest in yourself, unplug Notion and get in the zone";
          } else if (message.connected) {
            app.headline = "Notion is active";
          } else {
            app.headline = "Notion is not connected";
          }
        }
      });
    </script>
  </body>
  </html>`;
  }

  subscriptions.push(
    vscode.commands.registerCommand(notionAvgScoreCommandId, () => {
      const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : vscode.ViewColumn.Beside;

      usr.event("notion_interaction", "VSCode Extension Clicked");

      if (currentPanel) {
        // If we already have a panel, show it in the target column
        currentPanel.reveal(columnToShowIn);
      } else {
        // Create and show a new webview
        currentPanel = vscode.window.createWebviewPanel(
          "notion", // Identifies the type of the webview. Used internally
          "Notion Information", // Title of the panel displayed to the user
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

  // Our new command
  context.subscriptions.push(
    vscode.commands.registerCommand("catCoding.doRefactor", () => {
      if (!currentPanel) {
        return;
      }

      // Send a message to our webview.
      // You can send any JSON serializable data.
      currentPanel.webview.postMessage({ command: "refactor", paceArray });
    })
  );

  mindStateStatusBarItem.text = `Enter user name, device id and password`;
  mindStateStatusBarItem.show();

  if (!deviceId || !email || !password) {
    return;
  }

  mindStateStatusBarItem.text = "Notion";

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

  const notion = new Notion({
    deviceId
  });

  await notion.login({
    email,
    password
  });

  let runningAverageScore = 0.0;
  let flowStates: number[] = [0];
  let timestamps: number[] = [0];

  notion.status().subscribe((status: any) => {
    currentStatus = status;
    console.log("status", currentStatus);
    if (currentPanel) {
      // Send a message to our webview.
      // You can send any JSON serializable data.
      currentPanel.webview.postMessage({
        ...status,
        command: "notionStatus"
      });
    }
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

  let currentMindState = states.initializing;
  let currentMindPace = paces.red;
  // metricsLogger.gauge("current_mind_state", currentMindState.val);

  let notionTime = 0;
  let realTime = 0;
  let paceTime = 0;
  let paceArray: number[] = [];
  const paceArrayLength = 60 * 2;
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
        "$(circle-slash) Notion is charging $(circle-slash)";
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

      paceTime = sumArray(paceArray) * 30; // multiply pace time by 12 to exterpolate an hour from 5 minutes of data
      const prevMindPace = currentMindPace;
      if (paceTime < paces.red.limit) {
        currentMindPace = paces.red;
      } else if (paceTime < paces.yellow.limit) {
        currentMindPace = paces.yellow;
      } else {
        currentMindPace = paces.green;
      }
      if (currentMindPace !== prevMindPace) {
        console.log("New mind pace");
        usr
          .event(
            "notion_interaction",
            "New Mind Pace",
            "pace",
            currentMindPace.val
          )
          .send();
      }
      let str = "";
      if (
        paceArray.length < paceArrayLength ||
        currentMindPace === paces.green
      ) {
        str = `Flow stage ${currentMindState.str}`;
      } else if (currentMindPace === paces.yellow) {
        str = `Flow stage ${currentMindState.str}, warning, pace slowing.`;
      } else {
        str = `Flow stage ${currentMindState.str}, slow pace... get focused!`;
      }
      mindStateStatusBarItem.text = str;

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
          state: currentMindState,
          score: runningAverageScore,
          flowStates,
          timestamps
        });
      }
    }
    if (currentPanel) {
      currentPanel.webview.postMessage({
        command: "newFlowValue",
        notionTime: "5:50",
        earthTime: "20:21",
        paceTime: "10:10",
        state: currentMindState,
        score: 99,
        flowStates: [0, 1, 1, 2, 3, 4, 4],
        timestamps: [0, 5, 10, 15, 20, 25, 30]
      });
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
            currentMindState = states[key];
            if (prevMindState !== currentMindState) {
              usr
                .event(
                  "notion_interaction",
                  "Flow State",
                  "state",
                  currentMindState.val
                )
                .send();
            }
            flowStates.push(currentMindState.val);
            timestamps.push(realTime);

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
