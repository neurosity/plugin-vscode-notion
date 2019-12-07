import * as vscode from "vscode";

/*
QuickPick labels serve as the ID as well, so storing
in these variables (instead of the object below) for
easy reference throughout code.
*/
let email_label = '$(mail) Sign in with email';
let user_pass_label = '$(link-external) Sign in with username and password';

// Define the methods you can use to login
const loginMethods: vscode.QuickPickItem[] = [
  {
    label: email_label,
    detail: 'We\'ll email you an access code you can use to sign in',
  },
  {
    label: user_pass_label,
    detail: 'Use your external browser to sign in'
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

function handleLogin(method: vscode.QuickPickItem | undefined) {
  if (typeof method === 'undefined') {
    // User cancelled the selection
    return;
  }

  if (method.label == email_label) {
    // See: https://firebase.google.com/docs/auth/web/email-link-auth
    vscode.window.showInformationMessage('TODO: Login via email');
  }

  if (method.label == user_pass_label) {
    vscode.window.showInformationMessage('TODO: Login via user and pass');
  }
}

function loginError(error?: string) {
  let message = 'Error while selecting login method';

  if (typeof error === 'undefined')
    vscode.window.showInformationMessage(message);
  else
    vscode.window.showInformationMessage(message + ': ' + error);
}