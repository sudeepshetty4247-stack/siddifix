import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthorityPortrait } from '@/components/civic/AuthorityPortrait';

afterEach(cleanup);
describe('Authority portrait lifecycle', () => {
  it('does not request a portrait without provenance', () => {
    render(<AuthorityPortrait name="Test Official" role="Test role" url="https://example.org/portrait.jpg" />);
    expect(screen.queryByRole('img', { hidden: true })).toBeNull();
    expect(screen.getByLabelText('Test Official, Test role')).toHaveTextContent('TO');
  });
  it('reveals a loaded portrait and restores initials on network or decoding failure', () => {
    render(<AuthorityPortrait name="Test Official" role="Test role" url="https://example.org/portrait.jpg" source="https://example.org/profile" verified />);
    const image = screen.getByAltText('Test Official — Test role');
    fireEvent.load(image);
    expect(image).toBeVisible();
    fireEvent.error(image);
    expect(screen.queryByRole('img', { hidden: true })).toBeNull();
    expect(screen.getByLabelText('Test Official, Test role')).toBeVisible();
  });
  it('tries a replacement URL after a previous portrait fails', () => {
    const view = render(<AuthorityPortrait name="Test Official" role="Test role" url="https://example.org/broken.jpg" source="https://example.org/profile" verified />);
    fireEvent.error(screen.getByAltText('Test Official — Test role'));
    view.rerender(<AuthorityPortrait name="Test Official" role="Test role" url="https://example.org/repaired.jpg" source="https://example.org/profile" verified />);
    const image = screen.getByAltText('Test Official — Test role');
    expect(image).toHaveAttribute('src', 'https://example.org/repaired.jpg');
    fireEvent.load(image);
    expect(image).toBeVisible();
  });
  it('rejects insecure portrait URLs', () => {
    render(<AuthorityPortrait name="Test Official" role="Test role" url="http://example.org/image.jpg" source="https://example.org/profile" />);
    expect(screen.queryByRole('img', { hidden: true })).toBeNull();
  });
  it('does not equate a profile verification with portrait verification', () => {
    render(<AuthorityPortrait name="Test Official" role="Test role" url="https://example.org/image.jpg" source="https://example.org/profile" verified={false} />);
    expect(screen.queryByRole('img', { hidden: true })).toBeNull();
  });
});