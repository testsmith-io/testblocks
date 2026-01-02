/**
 * Playwright Codegen Manager
 *
 * Manages the lifecycle of Playwright codegen recording sessions.
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TestStep } from '../core';
import { parsePlaywrightCode } from './codegenParser';

export interface CodegenSession {
  id: string;
  process: ChildProcess | null;
  outputFile: string;
  url: string;
  status: 'running' | 'completed' | 'error';
  error?: string;
  startedAt: number;
  testIdAttribute?: string;
}

/**
 * Manages Playwright codegen sessions
 */
export class CodegenManager {
  private sessions: Map<string, CodegenSession> = new Map();

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start a new recording session
   */
  async startRecording(url: string, options?: { testIdAttribute?: string }): Promise<string> {
    const sessionId = this.generateSessionId();
    const outputFile = path.join(os.tmpdir(), `testblocks-codegen-${sessionId}.js`);

    console.log(`[CodegenManager] Starting recording session ${sessionId}`);
    console.log(`[CodegenManager] URL: ${url}`);
    console.log(`[CodegenManager] Output file: ${outputFile}`);
    if (options?.testIdAttribute) {
      console.log(`[CodegenManager] Test ID Attribute: ${options.testIdAttribute}`);
    }

    // Create the session
    const session: CodegenSession = {
      id: sessionId,
      process: null,
      outputFile,
      url,
      status: 'running',
      startedAt: Date.now(),
      testIdAttribute: options?.testIdAttribute,
    };

    this.sessions.set(sessionId, session);

    try {
      // Spawn Playwright codegen
      // Use npx to ensure we use the local playwright installation
      const args = [
        'playwright',
        'codegen',
        '--output', outputFile,
      ];

      // Add test-id-attribute if specified
      if (options?.testIdAttribute) {
        args.push('--test-id-attribute', options.testIdAttribute);
      }

      args.push(url);

      const codegenProcess = spawn('npx', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
      });

      session.process = codegenProcess;

      // Handle process exit
      codegenProcess.on('exit', (code) => {
        console.log(`[CodegenManager] Session ${sessionId} codegen process exited with code ${code}`);
        const currentSession = this.sessions.get(sessionId);
        if (currentSession && currentSession.status === 'running') {
          currentSession.status = 'completed';
          currentSession.process = null;
        }
      });

      // Handle errors
      codegenProcess.on('error', (err) => {
        console.error(`[CodegenManager] Session ${sessionId} process error:`, err);
        const currentSession = this.sessions.get(sessionId);
        if (currentSession) {
          currentSession.status = 'error';
          currentSession.error = err.message;
          currentSession.process = null;
        }
      });

      // Log stderr for debugging
      codegenProcess.stderr?.on('data', (data) => {
        console.log(`[CodegenManager] Session ${sessionId} stderr:`, data.toString());
      });

      return sessionId;
    } catch (error) {
      console.error(`[CodegenManager] Failed to start recording:`, error);
      session.status = 'error';
      session.error = (error as Error).message;
      throw error;
    }
  }

  /**
   * Stop a recording session and get the recorded steps
   */
  async stopRecording(sessionId: string): Promise<TestStep[]> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    console.log(`[CodegenManager] Stopping session ${sessionId}`);

    // If process is still running, terminate it
    if (session.process) {
      console.log(`[CodegenManager] Terminating codegen process for session ${sessionId}`);

      // Send SIGTERM to gracefully close the browser
      session.process.kill('SIGTERM');

      // Wait for process to exit (with timeout)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          // Force kill if not exited
          if (session.process) {
            session.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        if (session.process) {
          session.process.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        } else {
          clearTimeout(timeout);
          resolve();
        }
      });

      session.process = null;
    }

    // Wait a bit for file to be written
    await new Promise(resolve => setTimeout(resolve, 500));

    // Read and parse the generated file
    let steps: TestStep[] = [];

    try {
      if (fs.existsSync(session.outputFile)) {
        const code = fs.readFileSync(session.outputFile, 'utf-8');
        console.log(`[CodegenManager] Read generated code (${code.length} bytes)`);
        // Pass the testIdAttribute for correct selector conversion
        steps = parsePlaywrightCode(code, session.testIdAttribute || 'data-testid');
        console.log(`[CodegenManager] Parsed ${steps.length} steps`);
      } else {
        console.log(`[CodegenManager] Output file not found: ${session.outputFile}`);
      }
    } catch (error) {
      console.error(`[CodegenManager] Failed to read/parse output file:`, error);
    }

    // Update session status
    session.status = 'completed';

    return steps;
  }

  /**
   * Get the status of a session
   */
  getStatus(sessionId: string): CodegenSession | undefined {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return undefined;
    }

    // Check if process has exited
    if (session.process && session.status === 'running') {
      // Check if the process is still alive
      try {
        // kill(0) checks if process exists without killing it
        process.kill(session.process.pid!, 0);
      } catch {
        // Process no longer exists
        session.status = 'completed';
        session.process = null;
      }
    }

    return session;
  }

  /**
   * Clean up a session (remove temp file)
   */
  cleanup(sessionId: string): void {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return;
    }

    console.log(`[CodegenManager] Cleaning up session ${sessionId}`);

    // Kill process if still running
    if (session.process) {
      session.process.kill('SIGKILL');
    }

    // Remove temp file
    try {
      if (fs.existsSync(session.outputFile)) {
        fs.unlinkSync(session.outputFile);
        console.log(`[CodegenManager] Removed temp file: ${session.outputFile}`);
      }
    } catch (error) {
      console.error(`[CodegenManager] Failed to remove temp file:`, error);
    }

    // Remove session from map
    this.sessions.delete(sessionId);
  }

  /**
   * Clean up all sessions (call on server shutdown)
   */
  cleanupAll(): void {
    console.log(`[CodegenManager] Cleaning up all sessions`);
    for (const sessionId of this.sessions.keys()) {
      this.cleanup(sessionId);
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): CodegenSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'running');
  }
}

// Singleton instance
export const codegenManager = new CodegenManager();
