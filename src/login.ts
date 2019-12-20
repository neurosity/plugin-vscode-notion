import * as vscode from "vscode";

import { Notion } from "@neurosity/notion";

// TODO: Looks like the user config is cached or something, so values aren't updated
// until restart

/**
 * BEGIN CONFIG
 * All shown text can be seen and edited here
 */

// Initial prompt for login method
let email_label = '$(mail) Sign in with email';
let user_pass_label = '$(link-external) Sign in with username and password';
let code_label = '$(key) I already have an email login code'

const loginMethods: vscode.QuickPickItem[] = [
  {
    label: email_label,
    detail: 'We\'ll email you an access code you can use to sign in',
  },
  {
    label: user_pass_label,
    detail: 'Use your external browser to sign in'
  },
  {
    label: code_label,
    detail: 'I already have an emailed access code'
  }
];

// Prompt for entering config values
let email_prompt = 'Please enter the email address associated with your Neurosity account';
let email_placeholder = 'email';

let deviceid_prompt = 'Please enter your Notion headset device ID'
let deviceid_placeholder = 'device ID';

/**
 * END CONFIG
 */

/**
 * Register the command notion.login
 * Shows a QuickPick selection for the user to login with a method of their choice
 */
export function registerLoginCommand() {
  vscode.commands.registerCommand('notion.login', () => {
    vscode.window.showQuickPick(loginMethods).then(
      handleLogin,
      loginError
    );
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
    const promptSuccess = (value: string | undefined) => {
      if (typeof value !== 'undefined') {
        config.update(section, value, true);
      }

      resolve(value);
    };

    const promptRejected = (reason: any) => {
      reject(reason);
    };

    // Prompt for the value
    vscode.window.showInputBox({
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
  return new Promise<(string | undefined)[]>(async (resolve, reject) => {
    let values: (string | undefined)[] = [];

    for (let i = 0; i < sections.length; i++) {
      let params = sections[i];

      try {
        let value = await getOrPrompt(params[0], params[1], params[2]);
        values.push(value);
      } catch (error) {
        reject(error);
        return;
      }
    }

    resolve(values);
  });
}

function handleLogin(method: vscode.QuickPickItem | undefined) {
  if (typeof method === 'undefined') {
    // User cancelled the selection
    return;
  }

  // Login with email
  if (method.label == email_label) {
    // See: https://firebase.google.com/docs/auth/web/email-link-auth
    ensureConfigValues([
      ['email', email_prompt, email_placeholder],
      ['deviceId', deviceid_prompt, deviceid_placeholder]
    ])
      .then(
        sendLoginEmail,
        loginError
      )
  }

  // Login with username and password
  if (method.label == user_pass_label) {
    vscode.window.showInformationMessage('This feature has not been implemented yet');
  }

  // Login with email code
  if (method.label == code_label) {
    ensureConfigValues([
      ['email', email_prompt, email_placeholder],
      ['deviceId', deviceid_prompt, deviceid_placeholder]
    ]).then(
      loginWithEmailCred,
      loginError
    )
  }
}

function loginError(error?: string) {
  let message = 'Error while selecting login method';

  if (typeof error === 'undefined')
    vscode.window.showInformationMessage(message);
  else
    vscode.window.showInformationMessage(message + ': ' + error);
}

let notion: any;

function sendLoginEmail() {
  let config = vscode.workspace.getConfiguration("notion");
  let deviceId: string = config.get('deviceId') || '';
  let email: string = config.get('email') || '';

  if (deviceId == '' || email == '') {
    vscode.window.showErrorMessage('Unable to read device ID and email from settings');
    return;
  }

  notion = new Notion({
    deviceId
  });

  notion.api.firebase.app
    .auth()
    .sendSignInLinkToEmail(email, {
      url: "https://console.neurosity.co/vscode",
      handleCodeInApp: true
    })
    .then(loginWithEmailCred)
    .catch(() => vscode.window.showErrorMessage('Error sending login email'));
}

function loginWithEmailCred() {
  let config = vscode.workspace.getConfiguration("notion");
  let deviceId: string = config.get('deviceId') || '';
  let email: string = config.get('email') || '';

  vscode.window.showInputBox({
    prompt: 'Please enter the code obtained via the link in the email we sent you',
    ignoreFocusOut: true,
    placeHolder: 'code'
  })
    .then(code => {
      if (typeof code === 'undefined') {
        // User cancelled
        return;
      }

      notion = new Notion({
        deviceId
      });

      // This is very hacky, should clean up firebase API usage
      try {
        let credential = notion.api.firebase.app.firebase_.auth.EmailAuthProvider.credentialWithLink(
          email,
          'https://console.neurosity.co/account-manager?apiKey=none&mode=signIn&oobCode=' + code + '&continueUrl=https://console.neurosity.co/vscode&lang=en'
        );

        notion.api.firebase.app.auth().signInWithCredential(credential)
          .then(
            () => vscode.window.showInformationMessage('Logged in!'),
            (error: any) => {
              vscode.window.showErrorMessage(error.message);
            }
          );

      } catch (error) {
        vscode.window.showErrorMessage('Error logging in with provided credentials');
      }
    });
}
