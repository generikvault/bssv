import * as vscode from 'vscode';
import Provider from './provider';
import * as col from './col';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider('bssv', new Formatter()),
		vscode.languages.registerDocumentSymbolProvider({ language: 'bssv' }, new Provider()),
		new StatusBarCollInfo(),
		inEditor("bssv.selectColumn", col.selectCol),
		inEditor("bssv.moveColumnLeft", col.moveColLeft),
		inEditor("bssv.moveColumnRight", col.moveColRight),
	);
}

function inEditor(name: string, fn: (editor: vscode.TextEditor) => void): vscode.Disposable {
	let cmd = () => {
		let editor = vscode.window.activeTextEditor;

		if (editor == null) {
			return;
		}
		fn(editor)
	}

	return vscode.commands.registerCommand(name, cmd)
}

// this method is called when your extension is deactivated
export function deactivate() { }

class Formatter {

	public provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
		let { lineCount, lineAt } = document
		let cellStarts: number[] | undefined = undefined
		let delta: vscode.TextEdit[] = []
		for (let i = 0; i < lineCount; i++) {
			let line = lineAt(i).text
			if (line.substring(0, 1) === "[") {
				cellStarts = undefined
				continue
			}
			let isAnnotation = line.endsWith("@Header")
			let commentStart = line.indexOf("//", isAnnotation ? line.indexOf("//") + 2 : 0)
			let contentLength = commentStart < 0 ? line.length : commentStart
			let cells = line.substring(0, contentLength).split(";")
			if (cells.length === 1)
				continue

			if (isAnnotation || !cellStarts) {
				let leftTrimed = cells.map(s => s.trimLeft())
				let pos = 0
				cellStarts = []
				for (let j = 1; j < cells.length; j++) {
					pos += cells[j - 1].length + 1
					cellStarts[j] = pos + cells[j].length - leftTrimed[j].length
				}
			}
			let formated = cells[0].trim()
			for (let j = 1; j < cells.length; j++) {
				while (formated.length + 2 < cellStarts[j] ?? 0)
					formated += " "
				formated += "; "
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
		let { document } = editor
		let { active } = editor.selection
		let l = active.line
		let line = document
			.lineAt(l)
			.text
		let commentStart = line.indexOf("//")
		let contentLength = commentStart < 0 ? line.length : commentStart
		if (active.character > contentLength)
			return ""
		let content = line.substring(0, contentLength)
		if (content.indexOf(";") < 0)
			return ""
		let cellId = content
			.substring(0, active.character)
			.split(";")
			.length - 1

		while (l > 0) {
			l--;
			let line = document
				.lineAt(l)
				.text
			if (line.startsWith("["))
				break
			let isAnnotation = line.endsWith("@Header")
			if (!isAnnotation)
				continue
			let commentStart = line.indexOf("//", line.indexOf("//") + 2)
			let contentLength = commentStart < 0 ? line.length : commentStart
			let cells = line.substring(0, contentLength).split(";")
			return (cells[cellId] ?? "").replace("//", "").trim()
		}
		return ""
	}

	dispose() {
		this.statusBarItem.dispose()
		this.disposables.forEach(d => d.dispose())
	}
}