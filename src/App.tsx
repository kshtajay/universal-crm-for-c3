import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { HubPage } from '@/pages/HubPage'
import { TenantDashboard } from '@/pages/TenantDashboard'
import { AdminDashboard } from '@/pages/AdminDashboard'
import { AdminClientView } from '@/pages/AdminClientView'
import { AdminClientList } from '@/pages/AdminClientList'
import { BookingPage } from '@/pages/BookingPage'
import { AssessmentBookingPage } from '@/pages/AssessmentBookingPage'
import { CustomerPortal } from '@/pages/CustomerPortal'
import { ConsultationPaymentPage } from '@/pages/ConsultationPaymentPage'
import { LandingPage } from '@/pages/LandingPage'
import { PricingPage } from '@/pages/PricingPage'
import { DemoPage } from '@/pages/DemoPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { NotFound } from '@/pages/NotFound'

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/pricing', element: <PricingPage /> },
  { path: '/demo', element: <DemoPage /> },

  // K&A admin routes
  { path: '/admin', element: <ProtectedRoute><AdminDashboard /></ProtectedRoute> },
  { path: '/admin/clients', element: <ProtectedRoute><AdminClientList /></ProtectedRoute> },
  { path: '/admin/client/:slug/dashboard', element: <ProtectedRoute><AdminClientView /></ProtectedRoute> },

  // Tenant workspace routes
  { path: '/:slug/dashboard', element: <ProtectedRoute><TenantDashboard /></ProtectedRoute> },
  { path: '/:slug/hub', element: <ProtectedRoute><HubPage /></ProtectedRoute> },
  { path: '/:slug/settings', element: <ProtectedRoute><SettingsPage /></ProtectedRoute> },

  // Public routes
  { path: '/book/:slug', element: <BookingPage /> },
  { path: '/assessment/:slug', element: <AssessmentBookingPage /> },
  { path: '/portal/:token', element: <CustomerPortal /> },
  { path: '/consultation/:slug', element: <ConsultationPaymentPage /> },

  { path: '*', element: <NotFound /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
