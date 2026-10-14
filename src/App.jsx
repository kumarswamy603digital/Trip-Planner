import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Header from '@/components/Header'
import ErrorBoundary from '@/components/ErrorBoundary'
import Onboarding from '@/pages/Onboarding'
import ItineraryPage from '@/pages/Itinerary'
import KannadaKit from '@/pages/KannadaKit'
import PlaceDetail from '@/pages/PlaceDetail'
import { ALL_PLACES, ALL_PHRASES } from '@/lib/itineraryEngine'

export default function App() {
  return (
    <div className="flex flex-1 flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:shadow-lift"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Onboarding />} />
            <Route path="/itinerary" element={<ItineraryPage />} />
            <Route path="/kannada-kit" element={<KannadaKit />} />
            <Route path="/place/:id" element={<PlaceDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <footer className="no-print border-t border-ink-900/10 bg-sand-100/50 py-6">
        <div className="container-app flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-500">
          <p>
            <span className="font-semibold text-ink-700">NammaYatri AI</span> — Problem Statement 6, Kannada
            Digital Innovation Hackathon · an itinerary the internet does not need to be on for.
          </p>
          <p className="ml-auto">
            {ALL_PLACES.length} curated Karnataka places · {ALL_PHRASES.length} Kannada phrases · OpenStreetMap
            tiles · no account, no tracking
          </p>
        </div>
      </footer>
    </div>
  )
}
