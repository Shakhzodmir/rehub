import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";

import Login from "@/pages/Login";

// Patient
const PatientDashboard = lazy(() => import("@/pages/patient/Dashboard"));
const PatientExercises = lazy(() => import("@/pages/patient/Exercises"));
const PatientSession = lazy(() => import("@/pages/patient/Session"));
const PatientPlan = lazy(() => import("@/pages/patient/Plan"));
const PatientProgress = lazy(() => import("@/pages/patient/Progress"));
const PatientMessages = lazy(() => import("@/pages/patient/Messages"));

// Therapist
const TherapistDashboard = lazy(() => import("@/pages/therapist/Dashboard"));
const TherapistPatients = lazy(() => import("@/pages/therapist/Patients"));
const TherapistPatientDetail = lazy(() => import("@/pages/therapist/PatientDetail"));
const TherapistPlans = lazy(() => import("@/pages/therapist/Plans"));
const TherapistMessages = lazy(() => import("@/pages/therapist/Messages"));

// Doctor
const DoctorDashboard = lazy(() => import("@/pages/doctor/Dashboard"));
const DoctorReferrals = lazy(() => import("@/pages/doctor/Referrals"));
const DoctorReports = lazy(() => import("@/pages/doctor/Reports"));

// Admin
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminAnalytics = lazy(() => import("@/pages/admin/Analytics"));
const AdminExercises = lazy(() => import("@/pages/admin/Exercises"));
const AdminUsers = lazy(() => import("@/pages/admin/Users"));
const AdminAudit = lazy(() => import("@/pages/admin/Audit"));

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? `/${user.role}` : "/login"} replace />;
}

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />

        <Route path="/patient" element={<AppShell role="patient" />}>
          <Route index element={<PatientDashboard />} />
          <Route path="exercises" element={<PatientExercises />} />
          <Route path="session/:key" element={<PatientSession />} />
          <Route path="plan" element={<PatientPlan />} />
          <Route path="progress" element={<PatientProgress />} />
          <Route path="messages" element={<PatientMessages />} />
        </Route>

        <Route path="/therapist" element={<AppShell role="therapist" />}>
          <Route index element={<TherapistDashboard />} />
          <Route path="patients" element={<TherapistPatients />} />
          <Route path="patients/:id" element={<TherapistPatientDetail />} />
          <Route path="plans" element={<TherapistPlans />} />
          <Route path="messages" element={<TherapistMessages />} />
        </Route>

        <Route path="/doctor" element={<AppShell role="doctor" />}>
          <Route index element={<DoctorDashboard />} />
          <Route path="referrals" element={<DoctorReferrals />} />
          <Route path="reports" element={<DoctorReports />} />
        </Route>

        <Route path="/admin" element={<AppShell role="admin" />}>
          <Route index element={<AdminDashboard />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="exercises" element={<AdminExercises />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Suspense>
  );
}
