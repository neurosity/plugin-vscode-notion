import React, { useState, useEffect } from "react";
import Plotly from "plotly";

/*global acquireVsCodeApi*/
const vscode = acquireVsCodeApi();

export function App() {
  const [paceTime, setPaceTime] = useState("");
  const [notionTime, setNotionTime] = useState("");
  const [earthTime, setEarthTime] = useState("");
  const [headline, setHeadline] = useState("");
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  const [flowStage, setFlowStage] = useState("");
  const [score, setScore] = useState(NaN);
  const [loadedInitDataInGraph, setLoadedInitDataInGraph] = useState(
    false
  );
  const flowScore = Math.floor(score * 100);

  useEffect(() => {
    window.onload = () => {
      console.log("Window loaded");
      vscode.postMessage({
        command: "didLoad"
      });
    };

    // Handle the message inside the webview
    window.addEventListener("message", event => {
      const message = event.data; // The JSON data our extension sent
      if (message.command === "newFlowValue") {
        setPaceTime(message.paceTime);
        setNotionTime(message.notionTime);
        setEarthTime(message.earthTime);
        setScore(message.score);
        setDoNotDisturb(message.doNotDisturb);
        setFlowStage(message.state.str);

        const time = new Date();

        console.log("message", message);

        if (loadedInitDataInGraph) {
          let update = {
            x: [[time]],
            y: [[message.state.val]]
          };

          Plotly.extendTraces("graph", update, [0]);
        } else {
          setLoadedInitDataInGraph(true);
          var data = [
            {
              x: [time],
              y: [0],
              mode: "lines",
              line: { color: "#80CAF6" }
            }
          ];

          Plotly.plot("graph", data);
        }
      } else if (message.command === "oldFlowValues") {
        // setLoadedInitDataInGraph(true);
        // const dateArray = message.dateArray;
        // const flowStates = message.flowStates;
        // var data = [{
        //   x: dateArray,
        //   y: flowStates,
        //   mode: 'lines',
        //   line: {color: '#80CAF6'}
        // }]
        // Plotly.plot('graph', data);
      } else if (message.command === "notionStatus") {
        if (message.charging) {
          setHeadline(
            "Invest in yourself, unplug Notion and get in the zone"
          );
        } else if (message.connected) {
          setHeadline("Notion is active");
        } else {
          setHeadline("Notion is not connected");
        }
      }
    });

    return () => {
      window.removeEventListener("message");
    };
  }, []);

  return (
    <div id="app">
      <h1>Notion by Neurosity</h1>
      <h2>{headline}</h2>
      <h3>
        Do not disturb is {doNotDisturb ? "active" : "not active"}
      </h3>
      <h3>You're on pace to work {paceTime} minutes this hour.</h3>
      <h3>Earth time elapsed {earthTime} .</h3>
      <h3>True time {notionTime}.</h3>
      <h3>
        Flow stage {flowStage} with instant flow score of {flowScore}.
      </h3>
      <div
        id="graph"
        style="width:600px;height:250px;margin:auto;"
      ></div>
    </div>
  );
}
