import * as vscode from "vscode";
import {
  registerLoginCommand,
  logged_in,
  notion,
  loginCallback,
  logoutCallback,
  loginFromSavedState
} from "./login";
import { showBiometrics } from "./biometrics";

export async function activate(context: vscode.ExtensionContext) {
  try {
    const { subscriptions } = context;

    let biometrics_running = false;

    // create a new status bar item that we can now manage
    let mindStateStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      999
    );

    subscriptions.push(mindStateStatusBarItem);

    // Login button
    let loginStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      999
    );
    loginStatusBarItem.text = `$(sign-in) Notion Login`;
    loginStatusBarItem.command = "notion.login";
    subscriptions.push(loginStatusBarItem);

    // Handle login and logout
    registerLoginCommand("notion.login");

    loginCallback(() => {
      // Save current login state
      let loginState = notion.api.firebase.app.auth().currentUser;
      context.globalState.update("notion.loginState", loginState);

      loginStatusBarItem.hide();

      if (!biometrics_running) {
        showBiometrics(context, mindStateStatusBarItem, subscriptions, notion);
        biometrics_running = true;
      } else {
        mindStateStatusBarItem.show();
      }
    });

    logoutCallback(() => {
      // Clear saved login state
      context.globalState.update("notion.loginState", undefined);

      // Show the login button again
      showLoginButton();
      mindStateStatusBarItem.hide();
    });

    function showLoginButton() {
      loginStatusBarItem.show();
    }

    if (!logged_in) {
      // Check if we have a saved login object
      let loginState: string =
        context.globalState.get("notion.loginState") || "";

      if (loginState) {
        // TODO: Detect if current login state has expired or is invalid for any reason
        loginFromSavedState(loginState).catch(showLoginButton);
      } else {
        showLoginButton();
      }

      return;
    }
  } catch (err) {
    console.log("Error", err);
  }
}
