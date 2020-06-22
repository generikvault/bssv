import * as vscode from 'vscode';
import Provider from './provider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider('bssv', new Formatter()),
		vscode.languages.registerDocumentSymbolProvider({language: 'bssv'}, new Provider()),
		new StatusBarCollInfo(),
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
			if (line.substring(0, 1) === "[") {
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

class StatusBarCollInfo implements vscode.Disposable {

	private disposables: vscode.Disposable[] = []
	private statusBarItem: vscode.StatusBarItem

	constructor() {
		
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
		this.disposables.push(
			vscode.window.onDidChangeTextEditorSelection(e => this.update(e.textEditor)),
		)
	}

	private update(editor: vscode.TextEditor) {
		this.statusBarItem.text = this.colname(editor)
		this.statusBarItem.show()
	}

	private colname(editor: vscode.TextEditor): string {
		var { document } = editor
		var { active } = editor.selection
		var l = active.line
		var line = document
			.lineAt(l)
			.text
		var commentStart = line.indexOf("//")
		var contentLength = commentStart < 0 ? line.length : commentStart
		if (active.character > contentLength)
			return ""
		var content = line.substring(0, contentLength)
		if (content.indexOf(";") < 0)
			return ""
		var cellId = content
			.substring(0, active.character)
			.split(";")
			.length - 1

		while (l > 0) {
			l --;
			var line = document
				.lineAt(l)
				.text
			if (line.startsWith("["))
				break
			var isAnnotation = line.endsWith("@Header")
			if(!isAnnotation)
				continue
			var commentStart = line.indexOf("//", line.indexOf("//") + 2)
			var contentLength = commentStart < 0 ? line.length : commentStart
			var cells = line.substring(0, contentLength).split(";")
			return (cells[cellId] ?? "").replace("//", "").trim()
		}
		return ""
	}

	dispose() {
		this.statusBarItem.dispose()
		this.disposables.forEach(d => d.dispose())
	}
}