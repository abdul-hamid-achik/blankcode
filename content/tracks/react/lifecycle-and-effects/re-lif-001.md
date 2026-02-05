---
slug: react-lifecycle-and-effects-fetch-on-mount
title: Fetching Data on Component Mount
description: Learn how to use the useEffect hook to fetch data when a component first renders and handle cleanup properly.
difficulty: beginner
hints:
  - useEffect runs after the component renders
  - An empty dependency array means the effect runs only once on mount
  - The cleanup function is returned from useEffect to prevent memory leaks
  - Always check if the component is still mounted before updating state
tags:
  - react
  - hooks
  - useEffect
  - lifecycle
  - data-fetching
---

# Fetching Data on Component Mount

Complete the `UserProfile` component that fetches user data from an API when the component first mounts. You'll need to:

1. Use the appropriate React hook to run code after the component renders
2. Set up the dependency array so the fetch only happens once
3. Implement cleanup to prevent state updates on unmounted components
4. Handle the loading state properly

```typescript
import { useState, ___blank_start___useEffect___blank_end___ } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
}

export function UserProfile({ userId }: { userId: number }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  ___blank_start___useEffect___blank_end___(() => {
    let isMounted = true;

    async function fetchUser() {
      setLoading(true);
      try {
        const response = await fetch(`https://api.example.com/users/${userId}`);
        const data = await response.json();
        
        if (isMounted) {
          setUser(data);
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchUser();

    return () => {
      ___blank_start___isMounted = false___blank_end___;
    };
  }, ___blank_start___[]___blank_end___);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>No user found</div>;
  }

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

describe('UserProfile Component', () => {
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
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com'
    };

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockUser
    });

    render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/users/1');
  });

  it('should only fetch once when component mounts', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com'
    };

    (global.fetch as any).mockResolvedValue({
      json: async () => mockUser
    });

    const { rerender } = render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Re-render with same props
    rerender(<UserProfile userId={1} />);

    // Should still only have called fetch once
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(<UserProfile userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('No user found')).toBeInTheDocument();
    });
  });

  it('should cleanup and prevent state updates on unmount', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (global.fetch as any).mockReturnValue(promise);

    const { unmount } = render(<UserProfile userId={1} />);

    // Unmount before fetch completes
    unmount();

    // Complete fetch after unmount
    resolvePromise!({
      json: async () => ({ id: 1, name: 'John', email: 'john@example.com' })
    });

    await waitFor(() => {
      // Should not throw warnings about setting state on unmounted component
      expect(consoleError).not.toHaveBeenCalled();
    });

    consoleError.mockRestore();
  });
});
```