import * as vscode from "vscode";

import { Notion } from "@neurosity/notion";

export let notion: any;
export let logged_in: boolean = false;

let login_callback: () => void;
let logout_callback: () => void;

/**
 * BEGIN CONFIG
 * All shown text can be seen and edited here
 */

// Initial prompt for login method
let email_label = "$(mail) Sign in with email";
let code_label = "$(key) I already have an email login code";

const loginMethods: vscode.QuickPickItem[] = [
  {
    label: email_label,
    detail: "We'll email you an access code you can use to sign in"
  },
  {
    label: code_label
  }
];

// Prompt for entering config values
let email_prompt =
  "Please enter the email address associated with your Neurosity account";
let email_placeholder = "email";

let deviceid_prompt =
  "Please enter your Notion headset device ID. You can find your device ID by visiting https://console.neurosity.co/settings";
let deviceid_placeholder = "device ID";

/**
 * END CONFIG
 */

/**
 * Register the command notion.login
 * Shows a QuickPick selection for the user to login with a method of their choice
 */
export function registerLoginCommand(command: string) {
  vscode.commands.registerCommand(command, () => {
    vscode.window.showQuickPick(loginMethods).then(handleLogin, loginError);
  });
}

export async function logout() {
  try {
    await notion.logout();
    // TODO: Not sure if we need to disconnect or not
    // await notion.disconnect();
  } catch (error) {
    vscode.window.showErrorMessage("Unable to logout: " + error);
  }
  if (logout_callback) logout_callback();
}

export function loginCallback(method: any) {
  login_callback = method;
}

export function logoutCallback(method: any) {
  logout_callback = method;
}

export function loginFromSavedState(saved_state: any) {
  return new Promise((resolve, reject) => {
    let config = vscode.workspace.getConfiguration("notion");
    let deviceId: string = config.get("deviceId") || "";

    if (!deviceId) {
      vscode.window.showErrorMessage(
        "Please enter your Notion device ID in the extension settings"
      );
      reject();
      return;
    }

    notion = new Notion({
      deviceId
    });

    // This try/catch might be able to detect invalid saved state, as
    // it will probably throw an error
    try {
      notion
        .auth()
        .updateCurrentUser(saved_state)
        .then(() => {
          logged_in = true;
          if (login_callback) login_callback();
          resolve();
        }, reject);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Retrieve a value from the config. If it doesn't exist, prompt the user for the value
 * and update the user configuration.
 * @param section - config item name
 * @param prompt - prompt text to show user if item does not exist
 * @param placeHolder - prompt place holder text
 * @returns promise that resolves to value or undefined if user cancelled prompt
 * @example
 * getOrPrompt('email', 'Please enter your email', 'email@example.com')
 */
function getOrPrompt(section: string, prompt: string, placeHolder?: string) {
  return new Promise<string | undefined>((resolve, reject) => {
    let config = vscode.workspace.getConfiguration("notion");
    let value: string = config.get(section) || "";

    // If there's already a value, return
    if (value) {
      resolve(value);
      return;
    }

    // Handle the prompt
    const promptSuccess = async (value: string | undefined) => {
      if (typeof value !== "undefined") {
        await config.update(section, value, true);
      }

      resolve(value);
    };

    const promptRejected = (reason: any) => {
      reject(reason);
    };

    // Prompt for the value
    vscode.window
      .showInputBox({
        prompt: prompt,
        ignoreFocusOut: true,
        placeHolder: placeHolder
      })
      .then(promptSuccess, promptRejected);
  });
}

/**
 * Given an array of sections, verify each has a value, and prompt if it doesn't
 * @param sections - 2d array, where each item is an array of params passed to getOrPrompt()
 */
function ensureConfigValues(sections: string[][]) {
  return new Promise<(string | undefined)[]>(
    async (resolve, reject) => {
      let values: (string | undefined)[] = [];

      for (let i = 0; i < sections.length; i++) {
        let params = sections[i];

        try {
          let value = await getOrPrompt(
            params[0],
            params[1],
            params[2]
          );
          values.push(value);
        } catch (error) {
          reject(error);
          return;
        }
      }

      resolve(values);
    }
  );
}

function handleLogin(method: vscode.QuickPickItem | undefined) {
  if (typeof method === "undefined") {
    // User cancelled the selection
    return;
  }

  // Login with email
  if (method.label == email_label) {
    ensureConfigValues([
      ["email", email_prompt, email_placeholder],
      ["deviceId", deviceid_prompt, deviceid_placeholder]
    ]).then(sendLoginEmail, loginError);
  }

  // Login with email code
  if (method.label == code_label) {
    ensureConfigValues([
      ["email", email_prompt, email_placeholder],
      ["deviceId", deviceid_prompt, deviceid_placeholder]
    ]).then(loginWithEmailCred, loginError);
  }
}

function loginError(error?: string) {
  let message = "Error while selecting login method";

  if (typeof error === "undefined") vscode.window.showErrorMessage(message);
  else vscode.window.showErrorMessage(message + ": " + error);
}

function sendLoginEmail() {
  let config = vscode.workspace.getConfiguration("notion");
  let deviceId: string = config.get("deviceId") || "";
  let email: string = config.get("email") || "";

  if (deviceId == "" || email == "") {
    vscode.window.showErrorMessage(
      "Unable to read device ID and email from settings"
    );
    return;
  }

  notion = new Notion({
    deviceId
  });

  notion
    .auth()
    .sendSignInLinkToEmail(email, {
      url: "https://console.neurosity.co/vscode",
      handleCodeInApp: true
    })
    .then(loginWithEmailCred)
    .catch(() => vscode.window.showErrorMessage("Error sending login email"));
}

function loginWithEmailCred() {
  let config = vscode.workspace.getConfiguration("notion");
  let deviceId: string = config.get("deviceId") || "";
  let email: string = config.get("email") || "";

  vscode.window
    .showInputBox({
      prompt: `Email sent to ${email}. Please enter the code obtained via the link in the email we sent you`,
      ignoreFocusOut: true,
      placeHolder: "code"
    })
    .then(code => {
      if (typeof code === "undefined") {
        // User cancelled
        return;
      }

      notion = new Notion({
        deviceId
      });

      // This is very hacky, should clean up API usage
      try {
        let credential = Notion.credentialWithLink(
          email,
          "https://console.neurosity.co/account-manager?apiKey=none&mode=signIn&oobCode=" +
            code +
            "&continueUrl=https://console.neurosity.co/vscode&lang=en"
        );

        notion
          .auth()
          .signInWithCredential(credential)
          .then(
            () => {
              logged_in = true;
              if (login_callback) login_callback();
            },
            (error: any) => {
              vscode.window.showErrorMessage(error.message);
            }
          );
      } catch (error) {
        vscode.window.showErrorMessage(
          "Error logging in with provided credentials"
        );
      }
    });
}
