import * as vscode from 'vscode';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider('bssv', new Formatter())
	);
}

// this method is called when your extension is deactivated
export function deactivate() { }

class Formatter {

	public provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
		var { lineCount, lineAt } = document
		var cellStarts: number[] | undefined = undefined
		var delta: vscode.TextEdit[] = []
		for (var i = 0; i < lineCount; i++) {
			var line = lineAt(i).text
			if (line.substring(0,1) === "[") {
				cellStarts = undefined
				continue
			}
			var isAnnotation = line.endsWith("@Header")
			var commentStart = line.indexOf("//", isAnnotation ? line.indexOf("//") + 2 : 0)
			var contentLength = commentStart < 0 ? line.length : commentStart
			var cells = line.substring(0, contentLength).split(";")
			if (cells.length === 1)
				continue

			if (isAnnotation || !cellStarts) {
				var leftTrimed = cells.map(s => s.trimLeft())
				var pos = 0
				cellStarts = []
				for (var j = 1; j < cells.length; j++) {
					pos += cells[j - 1].length + 1
					cellStarts[j] = pos + cells[j].length - leftTrimed[j].length
				}
				continue
			}
			var formated = cells[0].trim()
			for (var j = 1; j < cells.length; j++) {
				formated += "; "
				while (formated.length < cellStarts[j] ?? 0)
					formated += " "
				formated += cells[j].trim()
			}
			formated = formated.trimRight()
			if (commentStart >= 0)
				formated += " "
			delta.push(vscode.TextEdit.replace(new vscode.Range(
				new vscode.Position(i, 0),
				new vscode.Position(i, contentLength),
			), formated))
		}
		return delta
	}

}