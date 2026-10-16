import { describe, expect, it } from 'vitest';
import { labelDirection } from '../src/adapters/bpmn-text.js';

describe('BPMN label direction', () => {
  it('uses the first strong script and leaves numbers and punctuation neutral', () => {
    expect(labelDirection('بررسی سفارش 123 (API)')).toBe('rtl');
    expect(labelDirection('API درخواست ۱۲۳')).toBe('ltr');
    expect(labelDirection('۱۲۳؟ تأیید')).toBe('rtl');
    expect(labelDirection('(404)')).toBe('ltr');
  });
});
