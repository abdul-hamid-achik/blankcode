---
slug: react-routing-and-navigation-basic-setup
title: Setting Up React Router Basic Navigation
description: Learn how to set up React Router and create basic navigation between pages in a React application.
difficulty: beginner
hints:
  - React Router v6 uses BrowserRouter as the main routing component
  - Routes component wraps all your Route definitions
  - The Link component is used for navigation instead of anchor tags
  - Each Route needs a path prop and an element prop
tags:
  - react
  - routing
  - navigation
  - react-router
---

In this exercise, you'll set up basic routing for a simple website with three pages: Home, About, and Contact. You need to configure React Router to enable navigation between these pages.

Complete the code by filling in the blanks to:
1. Set up the router provider
2. Define the routes container
3. Create navigation links
4. Set up individual route paths

```typescript
import React from 'react';
import { ___blank_start___BrowserRouter___blank_end___, Routes, Route, Link } from 'react-router-dom';

// Page Components
const Home = () => <div><h1>Home Page</h1><p>Welcome to our website!</p></div>;
const About = () => <div><h1>About Page</h1><p>Learn more about us.</p></div>;
const Contact = () => <div><h1>Contact Page</h1><p>Get in touch with us.</p></div>;

// Navigation Component
const Navigation = () => {
  return (
    <nav>
      <ul>
        <li>
          <___blank_start___Link___blank_end___ to="/">Home</___blank_start___Link___blank_end___>
        </li>
        <li>
          <Link to="/about">About</Link>
        </li>
        <li>
          <Link to="/contact">Contact</Link>
        </li>
      </ul>
    </nav>
  );
};

// Main App Component
function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Navigation />
        <___blank_start___Routes___blank_end___>
          <___blank_start___Route___blank_end___ path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
```

## Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('React Router Basic Navigation', () => {
  it('should render the Home page by default', () => {
    render(<App />);
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.getByText('Welcome to our website!')).toBeInTheDocument();
  });

  it('should render navigation links', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /about/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact/i })).toBeInTheDocument();
  });

  it('should navigate to About page when About link is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    const aboutLink = screen.getByRole('link', { name: /about/i });
    await user.click(aboutLink);
    
    expect(screen.getByText('About Page')).toBeInTheDocument();
    expect(screen.getByText('Learn more about us.')).toBeInTheDocument();
  });

  it('should navigate to Contact page when Contact link is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    const contactLink = screen.getByRole('link', { name: /contact/i });
    await user.click(contactLink);
    
    expect(screen.getByText('Contact Page')).toBeInTheDocument();
    expect(screen.getByText('Get in touch with us.')).toBeInTheDocument();
  });

  it('should navigate back to Home page when Home link is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    // Navigate to About first
    await user.click(screen.getByRole('link', { name: /about/i }));
    expect(screen.getByText('About Page')).toBeInTheDocument();
    
    // Navigate back to Home
    await user.click(screen.getByRole('link', { name: /home/i }));
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('should use Link components instead of anchor tags', () => {
    render(<App />);
    const links = screen.getAllByRole('link');
    
    links.forEach(link => {
      // Link components don't cause full page reloads
      expect(link).not.toHaveAttribute('href', expect.stringMatching(/^http/));
    });
  });
});
```