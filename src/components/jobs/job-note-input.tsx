"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { addJobNoteAction } from "@/lib/actions/job-activity-actions";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface JobNoteInputProps {
  jobOrderId: string;
  onNoteAdded: () => void;
}

export default function JobNoteInput({ jobOrderId, onNoteAdded }: JobNoteInputProps) {
  const [content, setContent] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentions, setMentions] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch team members once
  useEffect(() => {
    fetch("/api/technicians")
      .then((res) => res.json())
      .then((data) => setTeamMembers(data))
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    // Check for @mention — look at the word where the cursor is
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@") && lastWord.length > 1) {
      setMentionQuery(lastWord.slice(1).toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionQuery(null);
    }
  };

  const handleSelectMember = (member: TeamMember) => {
    const cursorPos = textareaRef.current?.selectionStart ?? content.length;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);

    // Find the start of the @mention word
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];
    const mentionStart = textBeforeCursor.length - lastWord.length;

    const replacement = `@${member.firstName} ${member.lastName} `;
    const newContent =
      content.slice(0, mentionStart) + replacement + textAfterCursor;

    setContent(newContent);
    if (!mentions.includes(member.id)) {
      setMentions((prev) => [...prev, member.id]);
    }
    setShowMentions(false);
    setMentionQuery(null);

    // Refocus textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStart + replacement.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const result = await addJobNoteAction(jobOrderId, {
        content: content.trim(),
        mentions,
      });
      if (result.success) {
        toast.success("Note added");
        setContent("");
        setMentions([]);
        onNoteAdded();
      } else {
        toast.error(result.error ?? "Failed to add note");
      }
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMembers = mentionQuery
    ? teamMembers.filter(
        (m) =>
          m.firstName.toLowerCase().includes(mentionQuery) ||
          m.lastName.toLowerCase().includes(mentionQuery) ||
          `${m.firstName} ${m.lastName}`.toLowerCase().includes(mentionQuery)
      )
    : [];

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          placeholder="Add a note... Use @ to mention team members"
          rows={3}
          className="w-full text-sm border border-surface-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-accent-300"
          disabled={submitting}
        />

        {/* Mentions dropdown */}
        {showMentions && filteredMembers.length > 0 && (
          <div className="absolute left-0 right-0 bg-white border border-surface-200 rounded-lg shadow-lg py-1 max-h-40 overflow-y-auto z-10">
            {filteredMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => handleSelectMember(member)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent-50 cursor-pointer"
              >
                <span className="font-medium">
                  {member.firstName} {member.lastName}
                </span>
                <span className="ml-2 text-surface-500 text-xs">
                  {member.role}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        {mentions.length > 0 && (
          <p className="text-xs text-surface-500">
            Mentioning {mentions.length} team member{mentions.length > 1 ? "s" : ""}
          </p>
        )}
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="px-4 py-2 text-sm font-medium bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting && (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            Add Note
          </button>
        </div>
      </div>
    </div>
  );
}
