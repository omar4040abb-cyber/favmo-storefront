import React from 'react';

/**
 * Bidirectional isolation wrapper for emails, phone numbers, URLs, SKUs, and order numbers.
 */
export function Bdi({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <bdi dir="ltr" className={`inline-block ${className}`.trim()}>
      {children}
    </bdi>
  );
}
