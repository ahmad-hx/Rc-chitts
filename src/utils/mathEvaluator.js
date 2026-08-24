/**
 * Safe Math Expression Parser & Evaluator (No eval or Function constructor)
 * Supports +, -, *, x, X, ×, /, ÷, %, parentheses (), decimals, and currency symbols (₹, commas).
 */

// Token types
const TOKEN_NUMBER = 'NUMBER';
const TOKEN_OPERATOR = 'OPERATOR';
const TOKEN_LPAREN = 'LPAREN';
const TOKEN_RPAREN = 'RPAREN';

/**
 * Tokenize a math expression string into tokens.
 */
function tokenize(expression) {
  if (!expression || typeof expression !== 'string') return [];

  // Replace multiplication and division visual symbols
  let cleaned = expression
    .replace(/₹/g, '')
    .replace(/,/g, '')
    .replace(/×/gi, '*')
    .replace(/\bx\b/gi, '*')
    .replace(/÷/g, '/')
    .trim();

  const tokens = [];
  let i = 0;

  while (i < cleaned.length) {
    const char = cleaned[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Number (including decimals)
    if (/[0-9.]/.test(char)) {
      let numStr = '';
      let decimalCount = 0;
      while (i < cleaned.length && /[0-9.]/.test(cleaned[i])) {
        if (cleaned[i] === '.') {
          decimalCount++;
          if (decimalCount > 1) break;
        }
        numStr += cleaned[i];
        i++;
      }
      tokens.push({ type: TOKEN_NUMBER, value: parseFloat(numStr) });
      continue;
    }

    // Left parenthesis
    if (char === '(') {
      tokens.push({ type: TOKEN_LPAREN, value: '(' });
      i++;
      continue;
    }

    // Right parenthesis
    if (char === ')') {
      tokens.push({ type: TOKEN_RPAREN, value: ')' });
      i++;
      continue;
    }

    // Operators: +, -, *, /, %
    if (['+', '-', '*', '/', '%'].includes(char)) {
      // Check for unary minus: if at start or after operator/LPAREN
      const prevToken = tokens[tokens.length - 1];
      const isUnaryMinus =
        char === '-' &&
        (!prevToken ||
          prevToken.type === TOKEN_OPERATOR ||
          prevToken.type === TOKEN_LPAREN);

      if (isUnaryMinus) {
        // Read the number following unary minus
        i++; // skip '-'
        // skip whitespace
        while (i < cleaned.length && /\s/.test(cleaned[i])) i++;
        if (i < cleaned.length && /[0-9.]/.test(cleaned[i])) {
          let numStr = '';
          let decimalCount = 0;
          while (i < cleaned.length && /[0-9.]/.test(cleaned[i])) {
            if (cleaned[i] === '.') {
              decimalCount++;
              if (decimalCount > 1) break;
            }
            numStr += cleaned[i];
            i++;
          }
          tokens.push({ type: TOKEN_NUMBER, value: -parseFloat(numStr) });
          continue;
        } else {
          // Unary minus before parenthesis: treat as -1 * (...)
          tokens.push({ type: TOKEN_NUMBER, value: -1 });
          tokens.push({ type: TOKEN_OPERATOR, value: '*' });
          continue;
        }
      }

      tokens.push({ type: TOKEN_OPERATOR, value: char });
      i++;
      continue;
    }

    // Unrecognized character in math expression
    throw new Error(`Invalid character '${char}' in expression.`);
  }

  return tokens;
}

/**
 * Shunting-yard algorithm to convert infix tokens to Reverse Polish Notation (RPN).
 */
function infixToRPN(tokens) {
  const outputQueue = [];
  const operatorStack = [];

  const precedence = {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2,
    '%': 2,
  };

  for (const token of tokens) {
    if (token.type === TOKEN_NUMBER) {
      outputQueue.push(token);
    } else if (token.type === TOKEN_OPERATOR) {
      while (
        operatorStack.length > 0 &&
        operatorStack[operatorStack.length - 1].type === TOKEN_OPERATOR &&
        precedence[operatorStack[operatorStack.length - 1].value] >= precedence[token.value]
      ) {
        outputQueue.push(operatorStack.pop());
      }
      operatorStack.push(token);
    } else if (token.type === TOKEN_LPAREN) {
      operatorStack.push(token);
    } else if (token.type === TOKEN_RPAREN) {
      let foundLparen = false;
      while (operatorStack.length > 0) {
        const top = operatorStack.pop();
        if (top.type === TOKEN_LPAREN) {
          foundLparen = true;
          break;
        }
        outputQueue.push(top);
      }
      if (!foundLparen) {
        throw new Error('Mismatched parentheses.');
      }
    }
  }

  while (operatorStack.length > 0) {
    const top = operatorStack.pop();
    if (top.type === TOKEN_LPAREN || top.type === TOKEN_RPAREN) {
      throw new Error('Mismatched parentheses.');
    }
    outputQueue.push(top);
  }

  return outputQueue;
}

/**
 * Evaluate RPN queue.
 */
function evaluateRPN(rpn) {
  const stack = [];

  for (const token of rpn) {
    if (token.type === TOKEN_NUMBER) {
      stack.push(token.value);
    } else if (token.type === TOKEN_OPERATOR) {
      if (stack.length < 2) {
        throw new Error('Invalid mathematical expression.');
      }
      const b = stack.pop();
      const a = stack.pop();

      let res;
      switch (token.value) {
        case '+':
          res = a + b;
          break;
        case '-':
          res = a - b;
          break;
        case '*':
          res = a * b;
          break;
        case '/':
          if (b === 0) throw new Error('Cannot divide by zero.');
          res = a / b;
          break;
        case '%':
          if (b === 0) throw new Error('Cannot perform modulo zero.');
          res = a % b;
          break;
        default:
          throw new Error(`Unknown operator '${token.value}'`);
      }
      stack.push(res);
    }
  }

  if (stack.length !== 1) {
    throw new Error('Invalid mathematical expression.');
  }

  const finalValue = stack[0];
  if (isNaN(finalValue) || !isFinite(finalValue)) {
    throw new Error('Result is not a valid number.');
  }

  return finalValue;
}

/**
 * Format currency number in Indian format (₹)
 */
export function formatCurrency(num) {
  if (num === null || num === undefined || isNaN(num)) return '₹0';
  const isNegative = num < 0;
  const absVal = Math.abs(num);
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(absVal) ? 0 : 2,
  }).format(absVal);
  return `${isNegative ? '-' : ''}₹${formatted}`;
}

/**
 * Evaluate a single mathematical expression safely.
 * Returns { success: boolean, value: number|null, formatted: string, error: string|null }
 */
export function evaluateExpression(exprStr) {
  if (!exprStr || typeof exprStr !== 'string' || !exprStr.trim()) {
    return { success: false, value: null, formatted: '', error: 'Empty expression' };
  }

  try {
    const tokens = tokenize(exprStr);
    if (tokens.length === 0) {
      return { success: false, value: null, formatted: '', error: 'No mathematical symbols found' };
    }

    const rpn = infixToRPN(tokens);
    const value = evaluateRPN(rpn);
    const formatted = formatCurrency(value);

    return {
      success: true,
      value,
      formatted,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      value: null,
      formatted: '',
      error: err.message || 'Invalid expression',
    };
  }
}

/**
 * Evaluate multi-line workspace text containing notes, commentary, and math expressions.
 * Automatically identifies lines containing mathematical expressions and calculates total.
 */
export function evaluateWorkspaceContent(content) {
  if (!content || typeof content !== 'string') {
    return {
      success: true,
      lines: [],
      grandTotal: 0,
      formattedGrandTotal: '₹0',
      summaryMessage: 'Workspace is empty.',
    };
  }

  const rawLines = content.split('\n');
  const processedLines = [];
  let grandTotal = 0;
  let validMathCount = 0;

  for (let idx = 0; idx < rawLines.length; idx++) {
    const rawLine = rawLines[idx];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      processedLines.push({
        lineNumber: idx + 1,
        raw: rawLine,
        isMath: false,
        text: '',
      });
      continue;
    }

    // Check if line looks like a math expression (contains digits and at least one operator, or single number)
    const hasDigits = /[0-9]/.test(trimmed);
    const hasOperators = /[+\-*xX×/÷%]/.test(trimmed);

    // If line has numbers and operators, or is purely numeric, try to evaluate it
    if (hasDigits && (hasOperators || /^[₹\s]*[\d,.]+[₹\s]*$/.test(trimmed))) {
      const evalResult = evaluateExpression(trimmed);
      if (evalResult.success) {
        grandTotal += evalResult.value;
        validMathCount++;
        processedLines.push({
          lineNumber: idx + 1,
          raw: rawLine,
          isMath: true,
          value: evalResult.value,
          formatted: evalResult.formatted,
          expression: trimmed,
        });
        continue;
      }
    }

    // Non-math line / note header
    processedLines.push({
      lineNumber: idx + 1,
      raw: rawLine,
      isMath: false,
      text: trimmed,
    });
  }

  return {
    success: true,
    lines: processedLines,
    grandTotal,
    formattedGrandTotal: formatCurrency(grandTotal),
    validMathCount,
    summaryMessage:
      validMathCount > 0
        ? `Evaluated ${validMathCount} expression${validMathCount > 1 ? 's' : ''}`
        : 'No valid math expressions found in workspace.',
  };
}
