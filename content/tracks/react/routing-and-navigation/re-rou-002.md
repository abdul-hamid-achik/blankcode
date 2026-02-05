---
slug: react-routing-and-navigation-basic-routes
title: Setting Up Basic Routes in React
description: Learn how to set up basic routing in a React application using React Router. Create multiple routes and navigate between different pages.
difficulty: beginner
hints:
  - React Router provides components like BrowserRouter, Routes, and Route to handle navigation
  - The Route component needs a 'path' prop to specify the URL and an 'element' prop for the component to render
  - The Link component is used to create navigation links without page reloads
  - The path "/" typically represents your home page
tags:
  - react-router
  - routing
  - navigation
  - components
---

In this exercise, you'll create a basic multi-page React application using React Router. You need to set up routing for three pages: Home, About, and Contact.

Your tasks:
1. Wrap your app with the Router component
2. Define routes for each page
3. Create navigation links between pages

```typescript
import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// Page Components
const Home = () => <h1>Home Page</h1>;
const About = () => <h1>About Page</h1>;
const Contact = () => <h1>Contact Page</h1>;

function App() {
  return (
    <___blank_start___BrowserRouter___blank_end___>
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

      <___blank_start___Routes___blank_end___>
        <___blank_start___Route___blank_end___ path="/" element={<Home />} />
        <___blank_start___Route___blank_end___ path="/about" element={<About />} />
        <___blank_start___Route___blank_end___ path="/contact" element={<Contact />} />
      </___blank_start___Routes___blank_end___>
    </___blank_start___BrowserRouter___blank_end___>
  );
}

export default App;
```

## Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('React Router Basic Navigation', () => {
  it('should render the home page by default', () => {
    render(<App />);
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('should have navigation links for all pages', () => {
    render(<App />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('should navigate to About page when About link is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    const aboutLink = screen.getByText('About');
    await user.click(aboutLink);
    
    expect(screen.getByText('About Page')).toBeInTheDocument();
  });

  it('should navigate to Contact page when Contact link is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    const contactLink = screen.getByText('Contact');
    await user.click(contactLink);
    
    expect(screen.getByText('Contact Page')).toBeInTheDocument();
  });

  it('should navigate back to Home page when Home link is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    // Navigate to About
    await user.click(screen.getByText('About'));
    expect(screen.getByText('About Page')).toBeInTheDocument();
    
    // Navigate back to Home
    await user.click(screen.getByText('Home'));
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('should use Link components instead of anchor tags', () => {
    const { container } = render(<App />);
    const links = container.querySelectorAll('a');
    
    // Link components render as anchor tags but with special handling
    expect(links.length).toBeGreaterThan(0);
    links.forEach(link => {
      expect(link.getAttribute('href')).toBeTruthy();
    });
  });
});
```