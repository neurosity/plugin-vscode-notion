import * as vscode from "vscode";
import { Notion } from "@neurosity/notion";

export async function initiateLogin(notion: Notion) {
  const email: any = await vscode.window.showInputBox({
    prompt: "Neurosity account email",
    placeHolder: "email"
  });

  const password: any = await vscode.window.showInputBox({
    password: true,
    prompt: "Neurosity account password",
    placeHolder: "password"
  });

  const user = await notion
    .login({
      email,
      password
    })
    .catch(() => {
      vscode.window.showInformationMessage(
        `Login failed, please try again.`
      );
      initiateLogin(notion);
    });

  if (user) {
    vscode.window.showInformationMessage(`Logged in successfully.`);
  } else {
    return false;
  }

  return true;
}
