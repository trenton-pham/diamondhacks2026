import React, { useState } from "react";
import Card from "../components/Card";
import { saveProfile } from "../services/api";

function splitTopicInput(value) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function ProfilePage({ profile, setProfile }) {
  const [form, setForm] = useState(profile);
  const [uploadMessage, setUploadMessage] = useState("");
  const [topicDrafts, setTopicDrafts] = useState({ allowed: "", sensitive: "", blocked: "" });

  function addTopic(bucket) {
    const topics = splitTopicInput(topicDrafts[bucket]);
    if (!topics.length) return;

    const nextPrivacy = {
      allowed: [...form.privacy.allowed],
      sensitive: [...form.privacy.sensitive],
      blocked: [...form.privacy.blocked]
    };

    topics.forEach((topic) => {
      Object.keys(nextPrivacy).forEach((k) => {
        nextPrivacy[k] = nextPrivacy[k].filter((t) => t !== topic);
      });
      nextPrivacy[bucket].push(topic);
    });

    setForm((prev) => ({ ...prev, privacy: nextPrivacy }));
    setTopicDrafts((prev) => ({ ...prev, [bucket]: "" }));
  }

  function onFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isValid = file.name.endsWith(".txt") || file.name.endsWith(".md");
    setUploadMessage(isValid ? `Uploaded: ${file.name}` : "Unsupported file type. Use .txt or .md");
  }

  async function save() {
    const saved = await saveProfile(form);
    setProfile(saved);
  }

  return (
    <div className="space-y-4">
      <Card title="Profile">
        <input
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className="mb-2 w-full rounded-lg border p-2 text-sm"
          aria-label="Display name"
        />
        <textarea
          value={form.bio}
          onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
          className="w-full rounded-lg border p-2 text-sm"
          aria-label="Bio"
        />
      </Card>

      <Card title="Privacy Boundaries">
        {["allowed", "sensitive", "blocked"].map((bucket) => (
          <div key={bucket} className="mb-4 rounded-xl border p-3">
            <p className="mb-2 text-sm font-medium capitalize">{bucket}</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {form.privacy[bucket].map((topic) => (
                <span key={topic} className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-700">
                  {topic}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={topicDrafts[bucket]}
                onChange={(e) => setTopicDrafts((p) => ({ ...p, [bucket]: e.target.value }))}
                placeholder="comma,separated,topics"
                className="flex-1 rounded-lg border p-2 text-sm"
              />
              <button type="button" onClick={() => addTopic(bucket)} className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white">
                Add
              </button>
            </div>
          </div>
        ))}
      </Card>

      <Card title="Upload Context (.txt / .md only)">
        <input type="file" onChange={onFileUpload} className="text-sm" />
        <textarea className="mt-3 w-full rounded-lg border p-2 text-sm" placeholder="Or paste text context here..." rows={4} />
        <p className="mt-2 text-xs text-stone-600">{uploadMessage || "No file uploaded."}</p>
      </Card>

      <Card title="Consent + Retention">
        <ul className="space-y-1 text-sm text-stone-600">
          <li>Raw text retention: 24h</li>
          <li>Derived report retention: 7d</li>
          <li>Hard delete action available from account settings.</li>
        </ul>
        <button type="button" onClick={save} className="mt-3 rounded-lg bg-stone-900 px-3 py-2 text-sm text-white">
          Save Profile Settings
        </button>
      </Card>
    </div>
  );
}
