import * as vscode from "vscode";
import { Notion } from "@neurosity/notion";

const mind = new Notion({
  deviceId: "11b10dadb738145668efd7ff67620ca3"
});

let myStatusBarItem: vscode.StatusBarItem;
let kinesisStatusBarItem: vscode.StatusBarItem;

export function activate({ subscriptions }: vscode.ExtensionContext) {
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
  mind.kinesis(kinesisLabel).subscribe(() => {
    vscode.commands.executeCommand("editorScroll", {
      to: "down",
      by: "line"
    });
  });

  const kinesisIcon = `$(rocket)`;
  let kinesisDescription = `mind control`;

  mind.predictions(kinesisLabel).subscribe(({ probability }) => {
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
  kinesisStatusBarItem.show();

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

  mind.calm().subscribe(({ probability }) => {
    let distraction: any = 100 - Math.round(probability * 100); // reverse calm
    if (distraction < 10) distraction = " " + distraction;
    myStatusBarItem.text = `$(hubot) ${distraction}% mind focus`;
  });

  myStatusBarItem.text = `$(hubot)`;
  myStatusBarItem.show();
}
