import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// --- Mocks ---
vi.mock('next/link', () => ({
  __esModule: true,
  default: function Link({ href, children, ...props }: any) {
    return React.createElement('a', { href, ...props }, children);
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  redirect: vi.fn(),
}));

vi.mock('framer-motion', () => {
  const motionProxy = new Proxy(
    {} as Record<string, string>,
    { get: (_: any, prop: string) => prop }
  );
  return {
    motion: motionProxy,
    useInView: () => true,
    useMotionValue: () => ({ get: () => 0, set: () => {} }),
    useTransform: () => {
      let value = 0;
      const listeners = new Set<(v: number) => void>();
      return {
        get: () => value,
        set: (v: number) => { value = v; listeners.forEach((cb) => cb(v)); },
        on: (_event: string, cb: (v: number) => void) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
      };
    },
  };
});

import Navbar from '../../app/sections/Navbar';

describe('Navbar', () => {
  it('renders sticky glassmorphism nav with Features, Pricing, and Launch App', () => {
    render(<Navbar />);
    expect(screen.getByText(/Features/i)).toBeInTheDocument();
    expect(screen.getByText(/Pricing/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Launch App/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Docs/i })).toBeInTheDocument();
  });
});

import Hero from '../../app/sections/Hero';

describe('Hero', () => {
  it('renders the headline about broadcast to interaction', () => {
    render(<Hero />);
    expect(screen.getByText(/Stop Broadcasting/i)).toBeInTheDocument();
    expect(screen.getByText(/Start Engaging/i)).toBeInTheDocument();
    expect(
      screen.getByText(/reads the room/i)
    ).toBeInTheDocument();
  });

  it('renders Get Started primary CTA and Watch Demo secondary CTA', () => {
    render(<Hero />);
    expect(screen.getByText(/Get Started/i)).toBeInTheDocument();
    expect(screen.getByText(/Watch Demo/i)).toBeInTheDocument();
  });
});

import MetricBar from '../../app/sections/MetricBar';

describe('MetricBar', () => {
  it('displays engagement signal count and LiveKit integration badge', () => {
    render(<MetricBar />);
    expect(screen.getByText(/18\+ Engagement Signals Tracked/i)).toBeInTheDocument();
    expect(screen.getByText(/Low-Latency LiveKit Integration/i)).toBeInTheDocument();
  });
});

import Features from '../../app/sections/Features';

describe('Features', () => {
  it('renders three feature pillars', () => {
    render(<Features />);
    expect(screen.getByText(/The Intelligence Plane/i)).toBeInTheDocument();
    expect(screen.getByText(/Synchronous Orchestration/i)).toBeInTheDocument();
    expect(screen.getByText(/Interactive Loops/i)).toBeInTheDocument();
  });

  it('mentions 0–100 Engagement Scoring', () => {
    render(<Features />);
    expect(screen.getByText(/0–100/i)).toBeInTheDocument();
  });

  it('mentions breakout rooms with physical sharding', () => {
    render(<Features />);
    expect(screen.getByText(/physical sharding/i)).toBeInTheDocument();
  });
});

import LivePreview from '../../app/sections/LivePreview';

describe('LivePreview', () => {
  it('renders the engagement score preview card', () => {
    render(<LivePreview />);
    expect(screen.getByText(/Heartbeat/i)).toBeInTheDocument();
    expect(screen.getByText(/real-time/i)).toBeInTheDocument();
  });
});

import Footer from '../../app/sections/Footer';

describe('Footer', () => {
  it('renders links to docs, GitHub, and a newsletter signup', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: /Documentation/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /GitHub/i }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByPlaceholderText(/Enter your email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subscribe/i })).toBeInTheDocument();
  });
});

import LandingPage from '../../app/page';

describe('Landing Page', () => {
  it('renders all major sections together', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Stop Broadcasting/i)).toBeInTheDocument();
    expect(screen.getByText(/Start Engaging/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Features/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/18\+ Engagement Signals Tracked/i)).toBeInTheDocument();
    expect(screen.getByText(/The Intelligence Plane/i)).toBeInTheDocument();
    expect(screen.getByText(/Heartbeat/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subscribe/i })).toBeInTheDocument();
  });
});
