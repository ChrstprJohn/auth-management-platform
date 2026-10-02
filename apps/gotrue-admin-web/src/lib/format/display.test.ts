import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { Timestamp } from '@/components/timestamp';
import { date, actionName } from './display';

describe('shared local date presentation', () => {
  it('formats readable full and date-only timestamps in the selected timezone', () => {
    const value = '2026-10-02T01:15:00Z';
    expect(date(value, { timeZone: 'Asia/Manila' })).toBe(
      '02 Oct 2026, 9:15 AM',
    );
    expect(date(value, { timeZone: 'America/Los_Angeles' })).toBe(
      '01 Oct 2026, 6:15 PM',
    );
    expect(date(value, { dateOnly: true, timeZone: 'Asia/Manila' })).toBe(
      '02 Oct 2026',
    );
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(date(value)).toBe(date(value, { timeZone: localZone }));
  });
  it.each([null, undefined, '', 'not-a-date'])(
    'handles %s without throwing or inventing a date',
    (value) => {
      expect(date(value)).toBe('Not reported');
      render(createElement(Timestamp, { value }));
      expect(screen.getByText('Not reported')).toBeVisible();
      expect(document.querySelector('time')).toBeNull();
    },
  );
  it('uses readable action names', () => {
    expect(actionName('send_verification')).toBe('Send verification');
  });
});
