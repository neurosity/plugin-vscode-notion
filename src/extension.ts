import * as vscode from "vscode";
import {
  registerLoginCommand,
  logged_in,
  notion,
  loginCallback,
  loginFromSavedState
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

    subscriptions.push(mindStateStatusBarItem);
    mindStateStatusBarItem.show();

    loginCallback(() => {
      // Save current login state
      let loginState = notion.api.firebase.app.auth().currentUser;
      context.globalState.update("notion.loginState", loginState);

      showBiometrics(mindStateStatusBarItem, subscriptions, notion);
    });

    function showLoginButton() {
      mindStateStatusBarItem.text = `$(sign-in) Notion Login`;

      registerLoginCommand("notion.login");
      mindStateStatusBarItem.command = "notion.login";
    }

    if (!logged_in) {
      // Check if we have a saved login object
      let loginState: string =
        context.globalState.get("notion.loginState") || "";

      if (loginState) {
        // TODO: Detect if current login state has expired or is invalid for any reason
        loginFromSavedState(loginState).catch(showLoginButton);
      } else {
        showLoginButton;
      }

      return;
    }
  } catch (err) {
    console.log("Error", err);
  }
}
