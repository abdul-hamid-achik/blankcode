---
slug: react-performance-and-patterns-memo-optimization
title: Optimizing Re-renders with React.memo
description: Learn how to prevent unnecessary re-renders using React.memo and understand when components should update.
difficulty: beginner
hints:
  - React.memo is a higher-order component that memoizes your component
  - Wrap your component with React.memo to prevent re-renders when props haven't changed
  - Use React.memo for components that render often with the same props
  - The second argument to React.memo is an optional comparison function
tags:
  - react
  - performance
  - memo
  - optimization
  - re-renders
---

In this exercise, you'll optimize a simple app that displays a user's profile and a counter. The profile component currently re-renders every time the counter changes, even though its props don't change.

Your task is to:
1. Wrap the UserProfile component with React.memo to prevent unnecessary re-renders
2. Implement the comparison function for the ExpensiveDisplay component
3. Use React.memo appropriately to optimize performance

```typescript
import React, { useState } from 'react';

interface UserProfileProps {
  name: string;
  email: string;
}

// TODO: Wrap this component to prevent unnecessary re-renders
const UserProfile = ___blank_start___React.memo(___blank_end___({ name, email }: UserProfileProps) => {
  console.log('UserProfile rendered');
  return (
    <div className="user-profile">
      <h2>{name}</h2>
      <p>{email}</p>
    </div>
  );
}___blank_start___)___blank_end___;

interface ExpensiveDisplayProps {
  data: {
    id: number;
    value: string;
  };
}

// TODO: Wrap this component with a custom comparison function
// It should only re-render when the data.id changes
const ExpensiveDisplay = ___blank_start___React.memo(___blank_end___(
  ({ data }: ExpensiveDisplayProps) => {
    console.log('ExpensiveDisplay rendered');
    // Simulate expensive calculation
    const processedValue = data.value.toUpperCase();
    return (
      <div className="expensive-display">
        <p>ID: {data.id}</p>
        <p>Value: {processedValue}</p>
      </div>
    );
  },
  ___blank_start___(prevProps, nextProps) => {
    // Return true if props are equal (should NOT re-render)
    // Return false if props are different (should re-render)
    return prevProps.data.id === nextProps.data.id;
  }___blank_end___
);

export default function App() {
  const [count, setCount] = useState(0);
  const [dataValue, setDataValue] = useState('hello');

  return (
    <div className="app">
      <UserProfile name="John Doe" email="john@example.com" />
      
      <div className="counter">
        <p>Count: {count}</p>
        <button onClick={() => setCount(count + 1)}>Increment</button>
      </div>

      <ExpensiveDisplay data={{ id: 1, value: dataValue }} />
      <button onClick={() => setDataValue(dataValue + '!')}>
        Change Value (should NOT re-render ExpensiveDisplay)
      </button>
    </div>
  );
}
```

## Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import App from './solution';

describe('React.memo Performance Optimization', () => {
  it('should render UserProfile component initially', () => {
    render(<App />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('should not re-render UserProfile when counter increments', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    render(<App />);
    
    // Clear initial render logs
    consoleSpy.mockClear();
    
    const incrementButton = screen.getByText('Increment');
    fireEvent.click(incrementButton);
    
    // UserProfile should NOT have logged a render
    const userProfileRenders = consoleSpy.mock.calls.filter(
      call => call[0] === 'UserProfile rendered'
    );
    expect(userProfileRenders.length).toBe(0);
    
    consoleSpy.mockRestore();
  });

  it('should render ExpensiveDisplay component initially', () => {
    render(<App />);
    expect(screen.getByText('ID: 1')).toBeInTheDocument();
    expect(screen.getByText(/Value: HELLO/)).toBeInTheDocument();
  });

  it('should not re-render ExpensiveDisplay when value changes but id stays the same', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    render(<App />);
    
    // Clear initial render logs
    consoleSpy.mockClear();
    
    const changeValueButton = screen.getByText(/Change Value/);
    fireEvent.click(changeValueButton);
    
    // ExpensiveDisplay should NOT have re-rendered
    const expensiveDisplayRenders = consoleSpy.mock.calls.filter(
      call => call[0] === 'ExpensiveDisplay rendered'
    );
    expect(expensiveDisplayRenders.length).toBe(0);
    
    consoleSpy.mockRestore();
  });

  it('should update counter when increment button is clicked', () => {
    render(<App />);
    const incrementButton = screen.getByText('Increment');
    
    expect(screen.getByText('Count: 0')).toBeInTheDocument();
    fireEvent.click(incrementButton);
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
    fireEvent.click(incrementButton);
    expect(screen.getByText('Count: 2')).toBeInTheDocument();
  });

  it('should have memoized components', () => {
    // This test verifies that React.memo was used
    const AppModule = require('./solution');
    const component = AppModule.default;
    
    // Render and check that the optimization prevents renders
    const consoleSpy = vi.spyOn(console, 'log');
    const { rerender } = render(React.createElement(component));
    
    consoleSpy.mockClear();
    rerender(React.createElement(component));
    
    // After a rerender with same props, memoized components shouldn't log
    const allRenders = consoleSpy.mock.calls.filter(
      call => call[0] === 'UserProfile rendered' || call[0] === 'ExpensiveDisplay rendered'
    );
    
    // Both should be memoized and not re-render on parent rerender
    expect(allRenders.length).toBeLessThanOrEqual(0);
    
    consoleSpy.mockRestore();
  });
});
```