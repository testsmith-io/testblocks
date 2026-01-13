/**
 * Type definitions for Playwright (we use dynamic import at runtime)
 */

export interface PlaywrightLocator {
  click(options?: { timeout?: number }): Promise<void>;
  fill(value: string, options?: { timeout?: number }): Promise<void>;
  type(text: string, options?: { delay?: number; timeout?: number }): Promise<void>;
  pressSequentially(text: string, options?: { delay?: number; timeout?: number }): Promise<void>;
  selectOption(values: string | string[], options?: { timeout?: number }): Promise<string[]>;
  check(options?: { timeout?: number }): Promise<void>;
  uncheck(options?: { timeout?: number }): Promise<void>;
  hover(options?: { timeout?: number }): Promise<void>;
  focus(options?: { timeout?: number }): Promise<void>;
  press(key: string, options?: { timeout?: number }): Promise<void>;
  textContent(options?: { timeout?: number }): Promise<string | null>;
  getAttribute(name: string, options?: { timeout?: number }): Promise<string | null>;
  inputValue(options?: { timeout?: number }): Promise<string>;
  isVisible(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  isChecked(): Promise<boolean>;
  count(): Promise<number>;
  waitFor(options?: { state?: 'attached' | 'detached' | 'visible' | 'hidden'; timeout?: number }): Promise<void>;
}

export interface PlaywrightPage {
  goto(url: string, options?: { waitUntil?: string }): Promise<unknown>;
  click(selector: string, options?: { timeout?: number }): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  type(selector: string, text: string, options?: { delay?: number }): Promise<void>;
  selectOption(selector: string, values: string | string[]): Promise<string[]>;
  check(selector: string): Promise<void>;
  uncheck(selector: string): Promise<void>;
  waitForSelector(selector: string, options?: { state?: string; timeout?: number }): Promise<unknown>;
  waitForTimeout(timeout: number): Promise<void>;
  waitForURL(url: string | RegExp, options?: { timeout?: number }): Promise<void>;
  screenshot(options?: { path?: string; fullPage?: boolean }): Promise<Buffer>;
  textContent(selector: string): Promise<string | null>;
  getAttribute(selector: string, name: string): Promise<string | null>;
  inputValue(selector: string): Promise<string>;
  isVisible(selector: string): Promise<boolean>;
  isEnabled(selector: string): Promise<boolean>;
  isChecked(selector: string): Promise<boolean>;
  evaluate<T>(fn: () => T): Promise<T>;
  locator(selector: string): PlaywrightLocator;
  title(): Promise<string>;
  url(): string;
  press(selector: string, key: string): Promise<void>;
  hover(selector: string): Promise<void>;
  focus(selector: string): Promise<void>;
}
