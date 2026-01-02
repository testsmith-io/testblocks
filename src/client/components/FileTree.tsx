import React, { useState } from 'react';
import { TestFile } from '../../core';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  testFile?: TestFile;
  handle?: FileSystemFileHandle;
}

interface FileTreeProps {
  root: FileNode | null;
  selectedPath: string | null;
  onSelectFile: (node: FileNode) => void;
  onRefresh?: () => void;
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (node: FileNode) => void;
}

function FileTreeNode({ node, depth, selectedPath, onSelectFile }: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
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

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${isSelected ? 'selected' : ''} ${isFolder ? 'folder' : 'file'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        <span className="file-tree-icon">
          {isFolder ? (isExpanded ? '📂' : '📁') : '📄'}
        </span>
        <span className="file-tree-name">{node.name}</span>
        {node.testFile && (
          <span className="file-tree-badge">{node.testFile.tests.length}</span>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ root, selectedPath, onSelectFile, onRefresh }: FileTreeProps) {
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
        {onRefresh && (
          <button className="file-tree-refresh" onClick={onRefresh} title="Refresh">
            ↻
          </button>
        )}
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
            />
          ))
        ) : (
          <div className="file-tree-empty">
            <p>No .testblocks.json files found</p>
          </div>
        )}
      </div>
    </div>
  );
}
