import * as vscode from 'vscode';
import { UI_REVIEW_BRIDGE_SCOPE_ENV } from '../../mcp-server/src/bridge/paths';

const SERVER_COMMAND_NAME = 'ui-review';
const SERVER_RUNTIME_FILES = ['standalone.js', 'xhr-sync-worker.js'] as const;
const SERVER_DEPENDENCY_SENTINELS = [
  ['@modelcontextprotocol', 'sdk', 'package.json'],
  ['dompurify', 'package.json'],
  ['jsdom', 'package.json'],
  ['tough-cookie', 'package.json'],
] as const;
const SERVER_INSTALL_METADATA = 'install-metadata.json';

export async function ensureBundledServerInstalled(
  context: vscode.ExtensionContext,
): Promise<vscode.Uri> {
  const targetDir = vscode.Uri.joinPath(context.globalStorageUri, 'mcp-server');
  const targetUri = vscode.Uri.joinPath(targetDir, 'standalone.js');
  const targetNodeModulesDir = vscode.Uri.joinPath(targetDir, 'node_modules');
  const metadataUri = vscode.Uri.joinPath(targetDir, SERVER_INSTALL_METADATA);
  const packagedNodeModulesDir = vscode.Uri.joinPath(context.extensionUri, 'node_modules');
  const extensionVersion = String(context.extension.packageJSON.version ?? '0.0.0');

  await vscode.workspace.fs.createDirectory(targetDir);

  const previousMetadata = await readInstallMetadata(metadataUri);
  const shouldRefreshNodeModules =
    previousMetadata?.version !== extensionVersion ||
    !(await hasExpectedBundledDependencies(packagedNodeModulesDir, targetNodeModulesDir));

  for (const fileName of SERVER_RUNTIME_FILES) {
    const bundledUri = vscode.Uri.joinPath(context.extensionUri, 'dist', 'mcp-server', fileName);
    const installedUri = vscode.Uri.joinPath(targetDir, fileName);
    const bundledContents = await readBundledServerFile(bundledUri);

    let shouldWrite = true;
    try {
      const currentContents = await vscode.workspace.fs.readFile(installedUri);
      shouldWrite = Buffer.compare(Buffer.from(currentContents), Buffer.from(bundledContents)) !== 0;
    } catch {
      shouldWrite = true;
    }

    if (shouldWrite) {
      await vscode.workspace.fs.writeFile(installedUri, bundledContents);
    }
  }

  if (shouldRefreshNodeModules) {
    await replaceInstalledNodeModules(packagedNodeModulesDir, targetNodeModulesDir);
    await vscode.workspace.fs.writeFile(
      metadataUri,
      Buffer.from(JSON.stringify({ version: extensionVersion }, null, 2), 'utf8'),
    );
  }

  return targetUri;
}

export function registerConfigureWorkspaceCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand('uiReview.configureWorkspace', async () => {
    const workspaceFolder = await pickWorkspaceFolder();
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('UI Review MCP: open a workspace folder before configuring MCP.');
      return;
    }

    try {
      const serverUri = await ensureBundledServerInstalled(context);
      const mcpUri = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'mcp.json');
      const config = await readConfigFile(mcpUri);
      const servers = isRecord(config.servers) ? { ...config.servers } : {};

      servers[SERVER_COMMAND_NAME] = {
        type: 'stdio',
        command: 'node',
        args: [serverUri.fsPath],
        env: {
          [UI_REVIEW_BRIDGE_SCOPE_ENV]: workspaceFolder.uri.fsPath,
        },
      };

      const nextConfig = {
        ...config,
        servers,
      };

      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(workspaceFolder.uri, '.vscode'));
      await vscode.workspace.fs.writeFile(
        mcpUri,
        Buffer.from(`${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8'),
      );

      const selection = await vscode.window.showInformationMessage(
        `UI Review MCP is configured for ${workspaceFolder.name}. Reload VS Code to pick up the new MCP server.`,
        'Reload Window',
        'Open mcp.json',
      );

      if (selection === 'Reload Window') {
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
        return;
      }

      if (selection === 'Open mcp.json') {
        const document = await vscode.workspace.openTextDocument(mcpUri);
        await vscode.window.showTextDocument(document);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`UI Review MCP: ${message}`);
    }
  });
}

async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    return undefined;
  }

  if (folders.length === 1) {
    return folders[0];
  }

  const selection = await vscode.window.showQuickPick(
    folders.map((folder) => ({
      label: folder.name,
      description: folder.uri.fsPath,
      folder,
    })),
    {
      title: 'Select a workspace folder to configure UI Review MCP',
    },
  );

  return selection?.folder;
}

async function readConfigFile(mcpUri: vscode.Uri): Promise<Record<string, unknown>> {
  let stat: vscode.FileStat | undefined;
  try {
    stat = await vscode.workspace.fs.stat(mcpUri);
  } catch {
    stat = undefined;
  }

  if (!stat) {
    return {};
  }

  const raw = await vscode.workspace.fs.readFile(mcpUri);
  const text = Buffer.from(raw).toString('utf8').trim();
  if (!text) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Existing ${mcpUri.fsPath} is not valid JSON.`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Existing ${mcpUri.fsPath} must contain a top-level JSON object.`);
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readBundledServerFile(fileUri: vscode.Uri): Promise<Uint8Array> {
  try {
    return await vscode.workspace.fs.readFile(fileUri);
  } catch {
    throw new Error(
      'The bundled MCP server is missing from the extension package. Rebuild the extension before configuring a workspace.',
    );
  }
}

async function readInstallMetadata(
  metadataUri: vscode.Uri,
): Promise<{ version?: string } | undefined> {
  try {
    const raw = await vscode.workspace.fs.readFile(metadataUri);
    const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as unknown;
    return isRecord(parsed) ? parsed as { version?: string } : undefined;
  } catch {
    return undefined;
  }
}

async function replaceInstalledNodeModules(
  sourceDir: vscode.Uri,
  targetDir: vscode.Uri,
): Promise<void> {
  await verifyPackagedDependencies(sourceDir);

  try {
    await vscode.workspace.fs.delete(targetDir, { recursive: true, useTrash: false });
  } catch {
    // Ignore missing directories.
  }

  try {
    await vscode.workspace.fs.copy(sourceDir, targetDir, { overwrite: true });
  } catch {
    throw new Error(
      'The packaged extension dependencies are missing. Reinstall or rebuild the UI Review MCP extension.',
    );
  }
}

async function hasExpectedBundledDependencies(
  sourceDir: vscode.Uri,
  targetDir: vscode.Uri,
): Promise<boolean> {
  for (const segments of SERVER_DEPENDENCY_SENTINELS) {
    const sourceUri = vscode.Uri.joinPath(sourceDir, ...segments);
    const targetUri = vscode.Uri.joinPath(targetDir, ...segments);

    let sourceContents: Uint8Array;
    let targetContents: Uint8Array;

    try {
      sourceContents = await vscode.workspace.fs.readFile(sourceUri);
    } catch {
      throw new Error(
        'The bundled MCP server dependencies are incomplete in the extension package. Rebuild or reinstall the UI Review MCP extension.',
      );
    }

    try {
      targetContents = await vscode.workspace.fs.readFile(targetUri);
    } catch {
      return false;
    }

    if (Buffer.compare(Buffer.from(sourceContents), Buffer.from(targetContents)) !== 0) {
      return false;
    }
  }

  return true;
}

async function verifyPackagedDependencies(sourceDir: vscode.Uri): Promise<void> {
  for (const segments of SERVER_DEPENDENCY_SENTINELS) {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(sourceDir, ...segments));
    } catch {
      throw new Error(
        'The bundled MCP server dependencies are incomplete in the extension package. Rebuild or reinstall the UI Review MCP extension.',
      );
    }
  }
}