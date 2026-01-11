/**
 * Type definitions for Playwright (we use dynamic import at runtime)
 */

export interface PlaywrightLocator {
  click(options?: { timeout?: number }): Promise<void>;
  fill(value: string): Promise<void>;
  type(text: string, options?: { delay?: number }): Promise<void>;
  selectOption(values: string | string[]): Promise<string[]>;
  check(): Promise<void>;
  uncheck(): Promise<void>;
  hover(): Promise<void>;
  focus(): Promise<void>;
  press(key: string): Promise<void>;
  textContent(): Promise<string | null>;
  getAttribute(name: string): Promise<string | null>;
  inputValue(): Promise<string>;
  isVisible(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  isChecked(): Promise<boolean>;
  count(): Promise<number>;
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
