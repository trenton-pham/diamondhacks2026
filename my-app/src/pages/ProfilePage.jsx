import React, { useEffect, useState } from "react";
import Card from "../components/Card";
import { saveProfile, uploadProfileContext } from "../services/api";

const QUESTION_FIELDS = [
  {
    id: "dealbreakers",
    label: "Dealbreakers",
    placeholder: "Dishonesty, emotional unavailability, pushiness...",
    helper: "What patterns make someone an immediate mismatch?"
  },
  {
    id: "friendship_preferences",
    label: "What do you look for in friendship?",
    placeholder: "Kindness, curiosity, consistency...",
    helper: "What qualities make you feel aligned with a friend?"
  },
  {
    id: "relationship_preferences",
    label: "What do you look for in dating/connection?",
    placeholder: "Intentionality, warmth, ambition, emotional maturity...",
    helper: "What kind of romantic connection are you actually hoping for?"
  },
  {
    id: "communication_style",
    label: "Preferred communication style",
    placeholder: "Thoughtful texts, directness, balanced pace...",
    helper: "How do you like people to communicate with you?"
  },
  {
    id: "values",
    label: "Values that matter most",
    placeholder: "Honesty, empathy, curiosity, stability...",
    helper: "Which values do you want the system to prioritize?"
  },
  {
    id: "lifestyle",
    label: "Social energy / lifestyle",
    placeholder: "Quiet weekends, active mornings, lots of community...",
    helper: "What daily rhythm or social style fits you best?"
  }
];

function splitTopicInput(value) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function toTagList(value) {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);
}

export default function ProfilePage({ profile, setProfile }) {
  const [form, setForm] = useState(profile);
  const [uploadMessage, setUploadMessage] = useState("");
  const [topicDrafts, setTopicDrafts] = useState({ allowed: "", sensitive: "", blocked: "" });
  const [contextText, setContextText] = useState("");
  const [questionnaireDrafts, setQuestionnaireDrafts] = useState({});

  useEffect(() => {
    setForm(profile);
    setQuestionnaireDrafts(profile?.questionnaire?.answers || {});
  }, [profile]);

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

  async function onFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isValid = file.name.endsWith(".txt") || file.name.endsWith(".md");
    if (!isValid) {
      setUploadMessage("Unsupported file type. Use .txt or .md");
      return;
    }

    const text = await file.text();
    setContextText(text);
    setUploadMessage(`Uploaded: ${file.name}`);
  }

  async function save() {
    const questionnaire = {
      completed: QUESTION_FIELDS.every((field) => (form.questionnaire?.answers?.[field.id]?.text || "").trim().length > 0),
      answers: form.questionnaire?.answers || {}
    };
    const saved = await saveProfile({ ...form, questionnaire });
    setProfile(saved);
    setForm(saved);
  }

  function updateQuestion(fieldId, textValue, tagsValue) {
    const nextAnswer = {
      text: textValue,
      tags: toTagList(tagsValue)
    };

    setQuestionnaireDrafts((prev) => ({
      ...prev,
      [fieldId]: {
        text: textValue,
        tagsInput: tagsValue
      }
    }));

    setForm((prev) => ({
      ...prev,
      questionnaire: {
        completed: false,
        answers: {
          ...(prev.questionnaire?.answers || {}),
          [fieldId]: nextAnswer
        }
      }
    }));
  }

  const completedQuestions = QUESTION_FIELDS.filter(
    (field) => (form.questionnaire?.answers?.[field.id]?.text || "").trim().length > 0
  ).length;

  async function ingestContext() {
    if (!contextText.trim()) {
      setUploadMessage("Add pasted text or upload a file first.");
      return;
    }

    const response = await uploadProfileContext({
      fileName: "profile-context.txt",
      text: contextText
    });
    setProfile(response.profile);
    setForm(response.profile);
    setUploadMessage(
      `Generated ${response.result.files_generated.length} topic file(s) from ${response.result.total_messages_processed} messages.`
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Profile">
        <p className="mb-3 text-sm leading-6" style={{ color: "var(--text-soft)" }}>
          Set the tone for how your agent shows up and what kinds of connections should feel like a fit.
        </p>
        <input
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className="soft-input mb-3 w-full"
          aria-label="Display name"
          placeholder="Display name"
        />
        <textarea
          value={form.bio}
          onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
          className="soft-input w-full"
          aria-label="Bio"
          rows={4}
        />
      </Card>

      <Card title="Preference Intake">
        <p className="mb-3 text-sm leading-6" style={{ color: "var(--text-soft)" }}>
          Answering these helps matching stay useful even before text uploads are processed.
        </p>
        <p className="mb-4 rounded-2xl px-3 py-2 text-xs" style={{ background: "rgba(255, 233, 225, 0.75)", color: "var(--text-soft)" }}>
          {completedQuestions}/{QUESTION_FIELDS.length} questions completed
          {form.questionnaire?.completed ? " - baseline preferences locked in" : " - recommendations will stay lower-confidence until this is filled out"}
        </p>

        {QUESTION_FIELDS.map((field) => {
          const answer = form.questionnaire?.answers?.[field.id] || { text: "", tags: [] };
          const draft = questionnaireDrafts[field.id] || {
            text: answer.text || "",
            tagsInput: (answer.tags || []).join(", ")
          };

          return (
            <div key={field.id} className="mb-4 rounded-[24px] border p-4" style={{ background: "rgba(255, 244, 240, 0.72)" }}>
              <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                {field.label}
              </label>
              <p className="mb-2 text-xs" style={{ color: "var(--text-soft)" }}>
                {field.helper}
              </p>
              <textarea
                value={draft.text}
                onChange={(e) => updateQuestion(field.id, e.target.value, draft.tagsInput)}
                rows={3}
                placeholder={field.placeholder}
                className="soft-input w-full"
              />
              <input
                value={draft.tagsInput}
                onChange={(e) => updateQuestion(field.id, draft.text, e.target.value)}
                placeholder="examples: thoughtful, steady, emotionally_mature"
                className="soft-input mt-2 w-full"
              />
            </div>
          );
        })}
      </Card>

      <Card title="Privacy Boundaries">
        <p className="mb-4 text-sm leading-6" style={{ color: "var(--text-soft)" }}>
          Add short topic categories here, not full personal details. These help your agent know what is okay to use, what needs care, and what should stay out of bounds.
        </p>
        {["allowed", "sensitive", "blocked"].map((bucket) => (
          <div key={bucket} className="mb-4 rounded-[24px] border p-4" style={{ background: "rgba(255, 249, 246, 0.8)" }}>
            <p className="mb-1 text-sm font-semibold capitalize" style={{ color: "var(--text-main)" }}>
              {bucket}
            </p>
            <p className="mb-2 text-xs" style={{ color: "var(--text-soft)" }}>
              {bucket === "allowed" && "Freely usable conversation topics your agent can lean into."}
              {bucket === "sensitive" && "Topics that may need softer phrasing or generalization."}
              {bucket === "blocked" && "Topics your agent should avoid surfacing or using directly."}
            </p>
            <div className="mb-2 flex flex-wrap gap-2">
              {form.privacy[bucket].map((topic) => (
                <span key={topic} className="soft-chip">
                  {topic}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                value={topicDrafts[bucket]}
                onChange={(e) => setTopicDrafts((p) => ({ ...p, [bucket]: e.target.value }))}
                placeholder={
                  bucket === "allowed"
                    ? "examples: hobbies, books, travel"
                    : bucket === "sensitive"
                      ? "examples: family, identity, past relationships"
                      : "examples: health, finances, trauma"
                }
                className="soft-input flex-1"
              />
              <button type="button" onClick={() => addTopic(bucket)} className="soft-button">
                Add
              </button>
            </div>
          </div>
        ))}
      </Card>

      <Card title="Upload Context (.txt / .md only)">
        <p className="mb-3 text-sm leading-6" style={{ color: "var(--text-soft)" }}>
          Uploading real text history gives the system richer inferred context to complement your explicit preferences.
        </p>
        <input type="file" onChange={onFileUpload} className="text-sm" />
        <textarea
          value={contextText}
          onChange={(e) => setContextText(e.target.value)}
          className="soft-input mt-3 w-full"
          placeholder="Or paste text context here..."
          rows={4}
        />
        <p className="mt-2 text-xs" style={{ color: "var(--text-soft)" }}>
          {uploadMessage || "No file uploaded."}
        </p>
        <button type="button" onClick={ingestContext} className="soft-button mt-3">
          Build Topic Files
        </button>
      </Card>

      <Card title="Consent + Retention">
        <ul className="space-y-1 text-sm" style={{ color: "var(--text-soft)" }}>
          <li>Raw text retention: 24h</li>
          <li>Derived report retention: 7d</li>
          <li>Hard delete action available from account settings.</li>
        </ul>
        <button type="button" onClick={save} className="soft-button mt-4">
          Save Profile Settings
        </button>
      </Card>
    </div>
  );
}
