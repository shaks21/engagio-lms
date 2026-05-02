import Navbar from './sections/Navbar';
import Hero from './sections/Hero';
import MetricBar from './sections/MetricBar';
import Features from './sections/Features';
import LivePreview from './sections/LivePreview';
import Footer from './sections/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f1a] text-gray-100">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <MetricBar />
        <Features />
        <LivePreview />
      </main>
      <Footer />
    </div>
  );
}
