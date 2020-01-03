export function getWebviewContent() {
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
    padding: 7px;
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
  <h3 v-if="showText && shouldDoNotDisturb">{{ doNotDisturbMessage }}</h3>
  <h3 v-if="showText">{{ paceMessage }}</h3>
  <h3 v-if="showText">{{ earthMessage }}</h3>
  <h3 v-if="showText">{{ notionMessage }}</h3>
  <h3 v-if="showText">{{ flowMessage }}</h3>
  <div id="graph" style="margin:auto;"></div>
  <h2>Settings</h2>
  <div>
    <label for="shouldDimScreenCheckbox">Dim screen when getting distracted</label>
    <input type="checkbox" id="shouldDimScreenCheckbox" v-on:click="toggleDimScreen" v-model="shouldDimScreen">
  </div>
  <div>
    <label for="shouldDoNotDisturbCheckbox">Automatically enter Do Not Disturb mode when focused</label>
    <input type="checkbox" id="shouldDoNotDisturbCheckbox" v-on:click="toggleDoNotDisturb" v-model="shouldDoNotDisturb">
  </div>
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
        score: NaN,
        shouldDimScreen: false,
        shouldDoNotDisturb: false
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
          } else if (isNaN(this.score)) {
            return "Initializing...";
          } else {
            return "Notion is active";
          }
        },
        showText() {
          return this.connected && !this.charging && !isNaN(this.score);
        },
        doNotDisturbToggleMessage() {
          if (this.shouldDoNotDisturb) {
            return "Automatically enter Do Not Disturb mode";
          } else {
            return "Do Not Disturb will not activate";
          }
        },
        dimScreenToggleMessage() {
          if (this.shouldDimScreen) {
            return "Flash the screen when disctracted";
          } else {
            return "Do not flash the screen when distracted";
          }
        }
      },
      methods: {
        logout(event) {
          vscode.postMessage({
            command: 'logout'
          });
        },
        toggleDimScreen(event) {
          vscode.postMessage({
            command: 'toggleDimScreen'
          });
        },
        toggleDoNotDisturb(event) {
          vscode.postMessage({
            command: 'toggleDoNotDisturb'
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
  var layout = {
    title: 'Flow stages vs. time',
    xaxis: {
      tickangle: 30
    },
    yaxis: {
      autotick: false,
      tick0: 0,
      dtick: 1,
      ticklen: 5
    }
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

      const time = message.timestamp;
      
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
      
        Plotly.plot('graph', data, layout, {responsive: true});  
      }
    
   
    } else if (message.command === 'oldFlowValues') {
      console.log('oldFlowValues', message);
      const dateArray = message.dateArray;
      const flowStates = message.flowStates;
  
      var data = [{
        x: dateArray, 
        y: flowStates,
        mode: 'lines',
        line: {color: '#80CAF6'}
      }] 
      if (dateArray.length > 1) {
        loadedInitDataInGraph = true;
        Plotly.plot('graph', data, layout, {responsive: true});
      }
    } else if (message.command === 'notionStatus') {
      console.log("message", message);
      app.charging = message.charging;
      app.connected = message.connected;
      app.shouldDimScreen = message.shouldDimScreen;
      app.shouldDoNotDisturb = message.shouldDoNotDisturb;
    }
  });
</script>
</body>
</html>`;
}
