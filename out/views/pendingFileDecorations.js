"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingFileDecorationProvider = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const BADGE = '✦';
const COLOR = new vscode.ThemeColor('aiCliDiffView.pendingFileForeground');
// Must match DiffManager's snapshot keys, which are lowercased on Windows.
function normalize(fsPath) {
    return process.platform === 'win32' ? fsPath.toLowerCase() : fsPath;
}
function symmetricDifference(a, b) {
    return [...a, ...b].filter((p) => a.has(p) !== b.has(p));
}
/** Folders from each file's parent up to and including its workspace root. */
function ancestorFolders(files) {
    const roots = (vscode.workspace.workspaceFolders ?? []).map((f) => normalize(f.uri.fsPath));
    const folders = new Set();
    for (const file of files) {
        const root = roots.find((r) => {
            const rel = path.relative(r, file);
            return rel !== '' && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
        });
        if (root === undefined) {
            continue;
        }
        for (let dir = path.dirname(file); !folders.has(dir); dir = path.dirname(dir)) {
            folders.add(dir);
            if (dir === root) {
                break;
            }
        }
    }
    return folders;
}
/** Marks files with unreviewed AI edits, and the folders containing them, in the Explorer. */
class PendingFileDecorationProvider {
    constructor(diffManager) {
        this.diffManager = diffManager;
        this._onDidChangeFileDecorations = new vscode.EventEmitter();
        this.onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
        this.files = new Set(diffManager.getPendingFiles());
        this.folders = ancestorFolders(this.files);
        this.subscription = diffManager.onDidChangeDiffs(() => this.refresh());
    }
    provideFileDecoration(uri) {
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
    refresh() {
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
    dispose() {
        this.subscription.dispose();
        this._onDidChangeFileDecorations.dispose();
    }
}
exports.PendingFileDecorationProvider = PendingFileDecorationProvider;
//# sourceMappingURL=pendingFileDecorations.js.map