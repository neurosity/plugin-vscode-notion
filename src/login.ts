import * as vscode from "vscode";

import { Notion } from "@neurosity/notion";
import IOptions from "@neurosity/notion/dist/esm/types/options";

/*
QuickPick labels serve as the ID as well, so storing
in these variables (instead of the object below) for
easy reference throughout code.
*/
let email_label = '$(mail) Sign in with email';
let user_pass_label = '$(link-external) Sign in with username and password';
let code_label = '$(key) I already have an email login code'

// Define the methods you can use to login
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
    detail: 'Enter a previously obtained email login code'
  }
];

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

const config = vscode.workspace.getConfiguration("notion");

function handleLogin(method: vscode.QuickPickItem | undefined) {
  if (typeof method === 'undefined') {
    // User cancelled the selection
    return;
  }

  if (method.label == email_label) {
    // See: https://firebase.google.com/docs/auth/web/email-link-auth
    let deviceId: string | undefined = config.get("deviceId");

    if (typeof deviceId === 'undefined' || deviceId == '') {
      vscode.window.showInputBox({ prompt: 'Please enter your device ID' }).then(
        id => {
          if (typeof id === 'undefined') {
            // User cancelled
            return;
          }

          config.update("deviceId", id);

          startLoginEmail(id);
        }
      )
    } else {
      startLoginEmail(deviceId);
    }
  }

  if (method.label == user_pass_label) {
    vscode.window.showInformationMessage('TODO: Login via user and pass');
  }

  if (method.label == code_label) {
    let email: string = config.get('email') || '';

    if (!email) {
      vscode.window.showInputBox({ prompt: 'Please enter your email' }).then((e: string | undefined) => {
        if (typeof e === 'undefined') {
          // User cancelled
          return;
        }

        config.update('email', e);
        loginWithEmailCred(e);
      })
    } else {
      loginWithEmailCred(email);
    }
  }
}

function loginError(error?: string) {
  let message = 'Error while selecting login method';

  if (typeof error === 'undefined')
    vscode.window.showInformationMessage(message);
  else
    vscode.window.showInformationMessage(message + ': ' + error);
}

function startLoginEmail(id: string) {
  let email: string = config.get('email') || '';

  if (email == '') {
    vscode.window.showInputBox({ prompt: 'Please enter your email' }).then(
      (e: string | undefined) => {
        if (typeof e === 'undefined') {
          // User cancelled
          return;
        }

        config.update('email', e);
        sendLoginEmail(id, e);
      }
    )
  } else {
    sendLoginEmail(id, email);
  }
}

let notion: any;

function sendLoginEmail(deviceId: string, email: string) {

  if (deviceId == '' || email == '') {
    vscode.window.showErrorMessage('Please try logging in again');
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
    .then(() => loginWithEmailCred(email))
    .catch(() => vscode.window.showErrorMessage('Error sending login email'));
}

function loginWithEmailCred(email: string) {
  // TODO: Check device ID as well
  vscode.window.showInputBox({ prompt: "Please enter the code obtained via the link in the email we sent you" })
    .then(code => {
      if (typeof code === 'undefined') {
        // User cancelled
        return;
      }

      /*let credential = {
        'email': email,
        'password': code,
        'signInMethod': 'emailLink'
      };*/

      let deviceId: string = config.get('deviceId') || '';
      notion = new Notion({
        deviceId
      });

      // This is very hacky, should clean up firebase API usage
      let credential = notion.api.firebase.app.firebase_.auth.EmailAuthProvider.credentialWithLink(email, 'https://console.neurosity.co/account-manager?apiKey=none&mode=signIn&oobCode=' + code + '&continueUrl=https://console.neurosity.co/vscode&lang=en');

      notion.api.firebase.app.auth().signInWithCredential(credential)
        .then(() => vscode.window.showInformationMessage('Logged in!'))
        .catch(function (error: any) {
          // Handle Errors here.
          var errorCode = error.code;
          var errorMessage = error.message;
          vscode.window.showErrorMessage(errorMessage);
        });
    })
}
