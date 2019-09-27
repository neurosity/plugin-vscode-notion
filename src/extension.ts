import * as vscode from "vscode";
import { Notion } from "@neurosity/notion";

const mind = new Notion({
  deviceId: "11b10dadb738145668efd7ff67620ca3"
});

let myStatusBarItem: vscode.StatusBarItem;

export function activate({ subscriptions }: vscode.ExtensionContext) {
  // register a command that is invoked when the status bar
  // item is selected
  const myCommandId = "sample.showSelectionCount";
  subscriptions.push(
    vscode.commands.registerCommand(myCommandId, () => {
      vscode.window.showInformationMessage(`Calm down!`);
    })
  );

  // create a new status bar item that we can now manage
  myStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  myStatusBarItem.command = myCommandId;
  subscriptions.push(myStatusBarItem);

  mind.calm().subscribe(({ probability }) => {
    const score = (probability * 100).toFixed(2);
    myStatusBarItem.text = `$(pulse) calm: ${score}%`;
  });

  myStatusBarItem.text = `$(pulse) calm`;
  myStatusBarItem.show();
}
