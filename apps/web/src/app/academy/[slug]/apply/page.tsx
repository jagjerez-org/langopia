"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPublicClient } from "@/hooks/use-api-client";
import type { ApplicationCustomFieldResponse } from "@langopia/api-client";

export default function TeacherApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const client = useMemo(() => createPublicClient(), []);

  const [customFields, setCustomFields] = useState<ApplicationCustomFieldResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [languages, setLanguages] = useState("");
  const [experience, setExperience] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    async function fetchFields() {
      try {
        const fields = await client.teacherApplications.getPublicCustomFields(slug);
        setCustomFields(fields.sort((a, b) => a.sortOrder - b.sortOrder));
      } catch {
        // Academy may have no custom fields — that's fine
      } finally {
        setLoading(false);
      }
    }
    fetchFields();
  }, [client, slug]);

  function setCustomValue(fieldId: string, value: unknown) {
    setCustomValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const languagesArray = languages
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);

      await client.teacherApplications.submitPublic(slug, {
        fullName,
        email,
        phone: phone || undefined,
        languages: languagesArray.length > 0 ? languagesArray : undefined,
        experience: experience || undefined,
        cvUrl: cvUrl || undefined,
        customFields: Object.keys(customValues).length > 0 ? customValues : undefined,
      });

      setSubmitted(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-lg w-full text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <svg
              className="h-8 w-8 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Application Submitted</h2>
          <p className="text-gray-500">
            Thank you for applying! The academy will review your application and get back to you
            soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-lg w-full">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Apply as a Teacher</h1>
        <p className="text-gray-500 text-sm mb-8">
          Fill out the form below to apply to this academy.
        </p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              placeholder="Jane Doe"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              placeholder="jane@example.com"
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              placeholder="+1 234 567 890"
            />
          </div>

          {/* Languages */}
          <div>
            <label htmlFor="languages" className="block text-sm font-medium text-gray-700 mb-1">
              Languages
            </label>
            <input
              id="languages"
              type="text"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              placeholder="English, Spanish, French"
            />
            <p className="mt-1 text-xs text-gray-400">Separate multiple languages with commas</p>
          </div>

          {/* Experience */}
          <div>
            <label htmlFor="experience" className="block text-sm font-medium text-gray-700 mb-1">
              Experience
            </label>
            <textarea
              id="experience"
              rows={4}
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition resize-none"
              placeholder="Tell us about your teaching experience..."
            />
          </div>

          {/* CV URL */}
          <div>
            <label htmlFor="cvUrl" className="block text-sm font-medium text-gray-700 mb-1">
              CV / Resume URL
            </label>
            <input
              id="cvUrl"
              type="url"
              value={cvUrl}
              onChange={(e) => setCvUrl(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              placeholder="https://drive.google.com/..."
            />
          </div>

          {/* Custom Fields */}
          {!loading &&
            customFields.map((field) => (
              <div key={field.id}>
                <label
                  htmlFor={`custom-${field.id}`}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {field.label}
                  {field.isRequired && <span className="text-red-400"> *</span>}
                </label>

                {field.fieldType === "text" && (
                  <input
                    id={`custom-${field.id}`}
                    type="text"
                    required={field.isRequired}
                    value={(customValues[field.id] as string) ?? ""}
                    onChange={(e) => setCustomValue(field.id, e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                  />
                )}

                {field.fieldType === "textarea" && (
                  <textarea
                    id={`custom-${field.id}`}
                    rows={3}
                    required={field.isRequired}
                    value={(customValues[field.id] as string) ?? ""}
                    onChange={(e) => setCustomValue(field.id, e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition resize-none"
                  />
                )}

                {field.fieldType === "select" && (
                  <select
                    id={`custom-${field.id}`}
                    required={field.isRequired}
                    value={(customValues[field.id] as string) ?? ""}
                    onChange={(e) => setCustomValue(field.id, e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                  >
                    <option value="">Select an option</option>
                    {field.options.map((opt: string) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}

                {field.fieldType === "checkbox" && (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      id={`custom-${field.id}`}
                      type="checkbox"
                      required={field.isRequired}
                      checked={!!customValues[field.id]}
                      onChange={(e) => setCustomValue(field.id, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-400"
                    />
                    <label htmlFor={`custom-${field.id}`} className="text-sm text-gray-600">
                      {field.label}
                    </label>
                  </div>
                )}
              </div>
            ))}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}
