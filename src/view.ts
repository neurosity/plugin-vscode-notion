import { ExtensionContext, Uri, WebviewPanel } from "vscode";
import * as path from "path";

const viewUrl = "build";

export function getViewContent(
  context: ExtensionContext,
  panel: WebviewPanel
): any {
  const viewPath = Uri.file(path.join(context.extensionPath, viewUrl));

  const nonce = getNonce();

  return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
				<meta name="theme-color" content="#000000">
				<title>App</title>
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-${nonce}';style-src vscode-resource: 'unsafe-inline' http: https: data:;">
        <base href="${panel.webview.asWebviewUri(viewPath)}/">
        <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
			</head>
			<body>
				<noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root"></div>
				<script nonce="${nonce}" src="${panel.webview.asWebviewUri(
    viewPath
  )}/index.js"></script>
			</body>
			</html>`;
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(
      Math.floor(Math.random() * possible.length)
    );
  }
  return text;
}
