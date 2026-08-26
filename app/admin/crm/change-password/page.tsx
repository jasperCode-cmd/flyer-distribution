"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

const MIN_PASSWORD_LENGTH = 8;

export default function ChangePasswordPage() {
  const { data: session, update } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const forced = session?.user?.mustChangePassword === true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);

    const res = await fetch("/api/crm/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();

    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong. Please try again.");
      return;
    }

    setSuccess(true);
    await update({ mustChangePassword: false });
    // A hard navigation here (rather than router.push + router.refresh)
    // guarantees the dashboard loads with the updated session, instead of
    // racing an in-flight client-side transition under load.
    window.location.href = "/admin/crm";
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold text-blue-900 mb-1">Change Password</h1>
      <p className="text-sm text-gray-500 mb-6">
        {forced
          ? "You need to set a new password before continuing."
          : "Update the password for your account."}
      </p>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <input
              id="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              Password updated. Redirecting...
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold py-2.5 rounded-md transition duration-200 ease-out text-sm"
          >
            {submitting ? "Saving..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
