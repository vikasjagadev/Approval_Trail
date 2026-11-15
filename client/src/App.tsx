import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NewRequest } from './pages/NewRequest';
import { MyRequests } from './pages/MyRequests';
import { RequestDetail } from './pages/RequestDetail';
import { ApprovalInbox } from './pages/ApprovalInbox';
import { AdminRequestTypes } from './pages/AdminRequestTypes';
import { AdminRequestTypeEditor } from './pages/AdminRequestTypeEditor';
import { AdminUsers } from './pages/AdminUsers';
import { AuditLog } from './pages/AuditLog';
import { NotFound } from './pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Navigate to="/dashboard" replace />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/requests/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <NewRequest />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/my-requests"
              element={
                <ProtectedRoute>
                  <Layout>
                    <MyRequests />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/requests/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RequestDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/approvals"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ApprovalInbox />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/audit"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                  <Layout>
                    <AuditLog />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/request-types"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Layout>
                    <AdminRequestTypes />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/request-types/new"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Layout>
                    <AdminRequestTypeEditor />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/request-types/:id/edit"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Layout>
                    <AdminRequestTypeEditor />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Layout>
                    <AdminUsers />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
