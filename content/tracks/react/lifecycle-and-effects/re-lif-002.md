---
slug: react-lifecycle-and-effects-fetch-on-mount
title: Fetching Data on Component Mount
description: Learn how to use useEffect to fetch data when a component first renders and handle cleanup properly.
difficulty: beginner
hints:
  - useEffect runs after the component renders
  - An empty dependency array means the effect runs only once on mount
  - Always handle loading and error states when fetching data
  - Return a cleanup function from useEffect to prevent memory leaks
tags:
  - react
  - useEffect
  - lifecycle
  - data-fetching
  - hooks
---

In this exercise, you'll create a component that fetches user data when it first mounts. You need to:

1. Use the `useEffect` hook to fetch data when the component mounts
2. Provide an empty dependency array to run the effect only once
3. Handle the async fetch operation properly
4. Implement cleanup to prevent state updates on unmounted components

Complete the `UserProfile` component to fetch and display user data.

```typescript
import { useState, useEffect } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
}

export function UserProfile({ userId }: { userId: number }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  ___blank_start___useEffect___blank_end___(() => {
    let isMounted = true;

    const fetchUser = async () => {
      try {
        setLoading(true);
        const response = await fetch(`https://api.example.com/users/${userId}`);
        const data = await response.json();
        
        if (isMounted) {
          setUser(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to fetch user');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUser();

    ___blank_start___return () => {
      isMounted = false;
    }___blank_end___;
  }, ___blank_start___[]___blank_end___);

  if (loading) ___blank_start___return <div>Loading...</div>___blank_end___;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>No user found</div>;

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

## Tests

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UserProfile } from './solution';

describe('UserProfile', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show loading state initially', () => {
    (global.fetch as any).mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    );

    render(<UserProfile userId={1} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should fetch and display user data on mount', async () => {
    const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' };
    
    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockUser,
    });

    render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/users/1');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should display error message when fetch fails', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch user/i)).toBeInTheDocument();
    });
  });

  it('should only fetch once on mount (empty dependency array)', async () => {
    const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' };
    
    (global.fetch as any).mockResolvedValue({
      json: async () => mockUser,
    });

    const { rerender } = render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Rerender with same props
    rerender(<UserProfile userId={1} />);

    // Should still only have been called once
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should cleanup properly on unmount', async () => {
    const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' };
    let resolvePromise: (value: any) => void;
    
    (global.fetch as any).mockImplementation(() => 
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );

    const { unmount } = render(<UserProfile userId={1} />);
    
    // Unmount before fetch completes
    unmount();
    
    // Resolve the promise after unmount
    resolvePromise!({ json: async () => mockUser });

    // Wait a bit to ensure no state updates occur
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // No errors should be thrown (cleanup prevents state update on unmounted component)
    expect(true).toBe(true);
  });
});
```