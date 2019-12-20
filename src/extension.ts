import * as vscode from "vscode";
import {
  registerLoginCommand,
  logged_in,
  notion,
  loginCallback
} from "./login";
import { showBiometrics } from "./biometrics";

let mindStateStatusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
  try {
    const { subscriptions } = context;

    // create a new status bar item that we can now manage
    mindStateStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      999
    );

    loginCallback(() => {
      showBiometrics(mindStateStatusBarItem, subscriptions, notion);
    });

    if (!logged_in) {
      subscriptions.push(mindStateStatusBarItem);
      mindStateStatusBarItem.text = `$(sign-in) Notion Login`;
      mindStateStatusBarItem.show();

      registerLoginCommand("notion.login");
      mindStateStatusBarItem.command = "notion.login";

      return;
    }
  } catch (err) {
    console.log("Error", err);
  }
}
