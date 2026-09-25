/**
 * A ratchet on user-facing English in HTTP exceptions.
 *
 * Every `new XException(...)` must carry a catalogue code - `appError('CODE')`,
 * or a code string such as the voting constants - so the client gets a stable
 * `code` and a message in its own language. A string literal or template as
 * the message is what this used to be everywhere: English-only, sometimes with
 * internal ids or raw error text in it, and nothing a client could branch on.
 *
 * Parsed with the TypeScript compiler rather than matched with a regex, so a
 * message split over lines, concatenated, or templated is still seen.
 *
 * The allowance is zero. If this fails, add the code to
 * `common/errors/catalog/en.ts` (the compiler then asks for `fr` and `ar`) and
 * throw `appError('THE_CODE')`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import * as ts from 'typescript';

import { EN } from '../catalog/en';

const SRC = join(__dirname, '..', '..', '..');

const HTTP_EXCEPTION = /^[A-Z]\w*Exception$/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__' && entry !== 'node_modules') {
        sourceFiles(full, out);
      }
      continue;
    }
    if (entry.endsWith('.ts') && !/\.(spec|test|d)\.ts$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const isCatalogCode = (text: string): boolean => Object.prototype.hasOwnProperty.call(EN, text);

/** A message argument that is English text rather than a code. */
function isRawMessage(arg: ts.Expression): boolean {
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
    return !isCatalogCode(arg.text);
  }
  if (ts.isTemplateExpression(arg)) {
    return true;
  }
  if (ts.isBinaryExpression(arg) && arg.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return isRawMessage(arg.left) || isRawMessage(arg.right);
  }
  if (ts.isObjectLiteralExpression(arg)) {
    // `{ message: '...' }` without a code is the same thing in an object.
    const props = arg.properties.filter(ts.isPropertyAssignment);
    const has = (name: string) => props.some(p => p.name.getText() === name);
    const message = props.find(p => p.name.getText() === 'message');
    return !has('code') && message !== undefined && isRawMessage(message.initializer);
  }
  return false;
}

function rawSites(): string[] {
  const found: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        HTTP_EXCEPTION.test(node.expression.text)
      ) {
        const arg = node.arguments?.[0];
        if (arg && isRawMessage(arg)) {
          const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          found.push(`${relative(SRC, file).split(sep).join('/')}:${line}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return found;
}

describe('HTTP exceptions carry a code', () => {
  it('scans the backend, so the ratchet cannot pass vacuously', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(200);
  });

  it('has no exception thrown with raw English as its message', () => {
    expect(rawSites()).toEqual([]);
  });

  it('detects the shapes it claims to (self-test)', () => {
    const parse = (code: string) => {
      const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true);
      const stmt = sf.statements[0] as ts.ExpressionStatement;
      return (stmt.expression as ts.NewExpression).arguments?.[0] as ts.Expression;
    };
    expect(isRawMessage(parse("new BadRequestException('Order not found')"))).toBe(true);
    expect(isRawMessage(parse('new BadRequestException(`Order ${id} missing`)'))).toBe(true);
    expect(isRawMessage(parse("new BadRequestException('a ' + b)"))).toBe(true);
    expect(isRawMessage(parse("new BadRequestException({ message: 'Nope' })"))).toBe(true);
    expect(isRawMessage(parse("new BadRequestException('BALLOT_NOT_OPEN')"))).toBe(false);
    expect(isRawMessage(parse("new BadRequestException(appError('ORDER_NOT_FOUND'))"))).toBe(false);
    expect(isRawMessage(parse("new BadRequestException({ code: 'X', message: 'y' })"))).toBe(false);
  });
});
