import * as path from 'path';
import * as vscode from 'vscode';
import { DiffManager } from '../diff/diffManager';

const BADGE = '✦';
const COLOR = new vscode.ThemeColor('aiCliDiffView.pendingFileForeground');

// Must match DiffManager's snapshot keys, which are lowercased on Windows.
function normalize(fsPath: string): string {
  return process.platform === 'win32' ? fsPath.toLowerCase() : fsPath;
}

function symmetricDifference(a: Set<string>, b: Set<string>): string[] {
  return [...a, ...b].filter((p) => a.has(p) !== b.has(p));
}

/** Folders from each file's parent up to and including its workspace root. */
function ancestorFolders(files: Iterable<string>): Set<string> {
  const roots = (vscode.workspace.workspaceFolders ?? []).map((f) => normalize(f.uri.fsPath));
  const folders = new Set<string>();
  for (const file of files) {
    const root = roots.find((r) => {
      const rel = path.relative(r, file);
      return rel !== '' && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
    });
    if (root === undefined) { continue; }
    for (let dir = path.dirname(file); !folders.has(dir); dir = path.dirname(dir)) {
      folders.add(dir);
      if (dir === root) { break; }
    }
  }
  return folders;
}

/** Marks files with unreviewed AI edits, and the folders containing them, in the Explorer. */
export class PendingFileDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  private files: Set<string>;
  private folders: Set<string>;
  private readonly subscription: vscode.Disposable;

  constructor(private readonly diffManager: DiffManager) {
    this.files = new Set(diffManager.getPendingFiles());
    this.folders = ancestorFolders(this.files);
    this.subscription = diffManager.onDidChangeDiffs(() => this.refresh());
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== 'file') {
      return undefined;
    }
    if (this.diffManager.hasPendingDiff(uri.fsPath)) {
      return new vscode.FileDecoration(BADGE, 'Pending AI changes', COLOR);
    }
    if (this.folders.has(normalize(uri.fsPath))) {
      return new vscode.FileDecoration(BADGE, 'Contains pending AI changes', COLOR);
    }
    return undefined;
  }

  private refresh(): void {
    const files = new Set(this.diffManager.getPendingFiles());
    const folders = ancestorFolders(files);
    const changed = [
      ...symmetricDifference(this.files, files),
      ...symmetricDifference(this.folders, folders),
    ];
    this.files = files;
    this.folders = folders;
    if (changed.length > 0) {
      this._onDidChangeFileDecorations.fire(changed.map((p) => vscode.Uri.file(p)));
    }
  }

  dispose(): void {
    this.subscription.dispose();
    this._onDidChangeFileDecorations.dispose();
  }
}
