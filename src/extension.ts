import * as vscode from "vscode";
import { Notion } from "@neurosity/notion";
import { filter, map, scan } from "rxjs/operators";

import { mapRange } from "./utils";

let myStatusBarItem: vscode.StatusBarItem;
let kinesisStatusBarItem: vscode.StatusBarItem;

export async function activate({
  subscriptions
}: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("notion");
  const deviceId = config.get("deviceId");
  const email = config.get("email");
  const password = config.get("password");

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

  const myCommandId = "sample.showSelectionCount";
  subscriptions.push(
    vscode.commands.registerCommand(myCommandId, () => {
      //vscode.window.showInformationMessage(`Calm down!`);
    })
  );

  /**
   * Kinesis
   */
  const kinesisLabel = "rightHandPinch";
  notion.kinesis(kinesisLabel).subscribe(() => {
    vscode.commands.executeCommand("editorScroll", {
      to: "down",
      by: "line"
    });
  });

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

  kinesisStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    998
  );

  kinesisStatusBarItem.text = `${kinesisIcon} ${kinesisDescription} ░░░░░░░`;
  //kinesisStatusBarItem.show();

  /**
   * Calm
   */
  // create a new status bar item that we can now manage
  myStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    999
  );
  myStatusBarItem.command = myCommandId;
  subscriptions.push(myStatusBarItem);

  notion
    .calm()
    .pipe(
      filter(({ probability }: any) => probability > 0.15),
      map(({ probability }: any): number =>
        mapRange(probability, 0, 1, 1, 5)
      ),
      scan((score, points) => Math.round(score + points), 0)
    )
    .subscribe(score => {
      myStatusBarItem.text = `$(hubot) ${score} mind points`;
    });

  myStatusBarItem.text = `$(hubot)`;
  myStatusBarItem.show();
}
