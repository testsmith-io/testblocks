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
  onDelete?: (node: FileNode) => void;
  onMove?: (sourceNode: FileNode, targetFolder: FileNode) => void;
  onRunFolder?: (node: FileNode) => void;
  isRunning?: boolean;
  failedFiles?: Set<string>;
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
  onDelete?: (node: FileNode) => void;
  onMove?: (sourceNode: FileNode, targetFolder: FileNode) => void;
  onRunFolder?: (node: FileNode) => void;
  isRunning?: boolean;
  failedFiles?: Set<string>;
  draggedNode: FileNode | null;
  setDraggedNode: (node: FileNode | null) => void;
}

function FileTreeNode({
  node,
  depth,
  selectedPath,
  onSelectFile,
  onSelectFolder,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onMove,
  onRunFolder,
  isRunning,
  failedFiles,
  draggedNode,
  setDraggedNode,
}: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(node);
    }
    setShowActions(false);
  };

  const handleRunFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRunFolder) {
      onRunFolder(node);
    }
    setShowActions(false);
  };

  const toggleActions = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(!showActions);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.path);
    // Add a slight delay to allow the drag image to be captured
    setTimeout(() => {
      (e.target as HTMLElement).classList.add('dragging');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedNode(null);
    (e.target as HTMLElement).classList.remove('dragging');
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only folders can be drop targets
    if (!isFolder || !draggedNode || !onMove) return;

    // Can't drop on itself or its children
    if (draggedNode.path === node.path) return;
    if (node.path.startsWith(draggedNode.path + '/')) return;

    // Can't drop in its current parent
    const draggedParentPath = draggedNode.path.split('/').slice(0, -1).join('/');
    if (draggedParentPath === node.path) return;

    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!isFolder || !draggedNode || !onMove) return;

    // Can't drop on itself or its children
    if (draggedNode.path === node.path) return;
    if (node.path.startsWith(draggedNode.path + '/')) return;

    // Can't drop in its current parent
    const draggedParentPath = draggedNode.path.split('/').slice(0, -1).join('/');
    if (draggedParentPath === node.path) return;

    onMove(draggedNode, node);
    setDraggedNode(null);
  };

  const isDragging = draggedNode?.path === node.path;

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${isSelected ? 'selected' : ''} ${isFolder ? 'folder' : 'file'} ${isDragOver ? 'drag-over' : ''} ${isDragging ? 'dragging' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onMouseLeave={() => setShowActions(false)}
        draggable={!!onMove}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="file-tree-icon">
          {isFolder ? (isExpanded ? '📂' : '📁') : '📄'}
        </span>
        <span className="file-tree-name">{node.name}</span>
        {failedFiles?.has(node.path) && (
          <span className="file-tree-failed-indicator" title="Tests failed in previous run">●</span>
        )}
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
                {isFolder && onRunFolder && (
                  <button
                    onClick={handleRunFolder}
                    title="Run all tests in this folder"
                    disabled={isRunning}
                    className="run-action"
                  >
                    ▶️ {isRunning ? 'Running...' : 'Run All Tests'}
                  </button>
                )}
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
                {onDelete && (
                  <button onClick={handleDelete} title="Delete" className="delete-action">
                    🗑️ Delete
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
              onDelete={onDelete}
              onMove={onMove}
              onRunFolder={onRunFolder}
              isRunning={isRunning}
              failedFiles={failedFiles}
              draggedNode={draggedNode}
              setDraggedNode={setDraggedNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ root, selectedPath, onSelectFile, onSelectFolder, onRefresh, onCreateFile, onCreateFolder, onRename, onDelete, onMove, onRunFolder, isRunning, failedFiles }: FileTreeProps) {
  const [draggedNode, setDraggedNode] = useState<FileNode | null>(null);

  if (!root) {
    return (
      <div className="file-tree-empty">
        <p>No folder opened</p>
        <p className="file-tree-hint">Click "Open Folder" to load test files</p>
      </div>
    );
  }

  // Handle drop on root folder
  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNode || !onMove) return;

    // Can't drop in its current parent (root)
    const draggedParentPath = draggedNode.path.split('/').slice(0, -1).join('/');
    if (draggedParentPath === root.path) return;

    e.dataTransfer.dropEffect = 'move';
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNode || !onMove) return;

    // Can't drop in its current parent (root)
    const draggedParentPath = draggedNode.path.split('/').slice(0, -1).join('/');
    if (draggedParentPath === root.path) return;

    onMove(draggedNode, root);
    setDraggedNode(null);
  };

  return (
    <div className="file-tree">
      <div
        className="file-tree-header"
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
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
          {onRunFolder && (
            <button
              className="file-tree-action-btn file-tree-run-btn"
              onClick={() => onRunFolder(root)}
              title="Run all tests in project"
              disabled={isRunning}
            >
              {isRunning ? '...' : '▶'}
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
              onDelete={onDelete}
              onMove={onMove}
              onRunFolder={onRunFolder}
              isRunning={isRunning}
              failedFiles={failedFiles}
              draggedNode={draggedNode}
              setDraggedNode={setDraggedNode}
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
