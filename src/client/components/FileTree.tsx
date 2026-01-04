import React, { useState } from 'react';
import { TestFile, FolderHooks } from '../../core';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  testFile?: TestFile;
  handle?: FileSystemFileHandle;
  folderHandle?: FileSystemDirectoryHandle;
  folderHooks?: FolderHooks;
  hooksFileHandle?: FileSystemFileHandle;
}

interface FileTreeProps {
  root: FileNode | null;
  selectedPath: string | null;
  onSelectFile: (node: FileNode) => void;
  onSelectFolder?: (node: FileNode) => void;
  onRefresh?: () => void;
  onCreateFile?: (parentNode: FileNode) => void;
  onCreateFolder?: (parentNode: FileNode) => void;
  onRename?: (node: FileNode) => void;
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (node: FileNode) => void;
  onSelectFolder?: (node: FileNode) => void;
  onCreateFile?: (parentNode: FileNode) => void;
  onCreateFolder?: (parentNode: FileNode) => void;
  onRename?: (node: FileNode) => void;
}

function FileTreeNode({ node, depth, selectedPath, onSelectFile, onSelectFolder, onCreateFile, onCreateFolder, onRename }: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const isSelected = node.path === selectedPath;
  const isFolder = node.type === 'folder';
  const hasChildren = isFolder && node.children && node.children.length > 0;

  const handleClick = () => {
    if (isFolder) {
      setIsExpanded(!isExpanded);
    } else {
      onSelectFile(node);
    }
  };

  const handleFolderSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectFolder) {
      onSelectFolder(node);
    }
  };

  const handleCreateFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCreateFile) {
      onCreateFile(node);
    }
    setShowActions(false);
  };

  const handleCreateFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCreateFolder) {
      onCreateFolder(node);
    }
    setShowActions(false);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRename) {
      onRename(node);
    }
    setShowActions(false);
  };

  const toggleActions = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(!showActions);
  };

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${isSelected ? 'selected' : ''} ${isFolder ? 'folder' : 'file'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onMouseLeave={() => setShowActions(false)}
      >
        <span className="file-tree-icon">
          {isFolder ? (isExpanded ? '📂' : '📁') : '📄'}
        </span>
        <span className="file-tree-name">{node.name}</span>
        {node.testFile && (
          <span className="file-tree-badge">{node.testFile.tests.length}</span>
        )}
        {isFolder && node.folderHooks && (
          <span className="folder-hooks-indicator" title="Folder has hooks configured">⟳</span>
        )}
        {(isFolder || onRename) && (
          <div className="folder-actions">
            <button
              className="folder-action-btn"
              onClick={toggleActions}
              title="Actions"
            >
              ⋮
            </button>
            {showActions && (
              <div className="folder-actions-menu">
                {isFolder && onCreateFile && (
                  <button onClick={handleCreateFile} title="New test file">
                    📄 New File
                  </button>
                )}
                {isFolder && onCreateFolder && (
                  <button onClick={handleCreateFolder} title="New folder">
                    📁 New Folder
                  </button>
                )}
                {onRename && (
                  <button onClick={handleRename} title="Rename">
                    ✏️ Rename
                  </button>
                )}
                {isFolder && onSelectFolder && (
                  <button onClick={handleFolderSettings} title="Configure hooks">
                    ⚙ Folder Hooks
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {isFolder && isExpanded && hasChildren && (
        <div className="file-tree-children">
          {node.children!.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              onSelectFolder={onSelectFolder}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ root, selectedPath, onSelectFile, onSelectFolder, onRefresh, onCreateFile, onCreateFolder, onRename }: FileTreeProps) {
  if (!root) {
    return (
      <div className="file-tree-empty">
        <p>No folder opened</p>
        <p className="file-tree-hint">Click "Open Folder" to load test files</p>
      </div>
    );
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span className="file-tree-root-name">{root.name}</span>
        <div className="file-tree-header-actions">
          {onCreateFile && (
            <button
              className="file-tree-action-btn"
              onClick={() => onCreateFile(root)}
              title="New test file"
            >
              +📄
            </button>
          )}
          {onCreateFolder && (
            <button
              className="file-tree-action-btn"
              onClick={() => onCreateFolder(root)}
              title="New folder"
            >
              +📁
            </button>
          )}
          {onRefresh && (
            <button className="file-tree-refresh" onClick={onRefresh} title="Refresh">
              ↻
            </button>
          )}
        </div>
      </div>
      <div className="file-tree-content">
        {root.children && root.children.length > 0 ? (
          root.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={0}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              onSelectFolder={onSelectFolder}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onRename={onRename}
            />
          ))
        ) : (
          <div className="file-tree-empty">
            <p>No .testblocks.json files found</p>
            {onCreateFile && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onCreateFile(root)}
              >
                Create Test File
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
