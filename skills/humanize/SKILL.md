---
name: humanize
description: "Edit reader-facing text to sound natural while preserving meaning and formatting. Use for stiff or AI-like prose, or literal newline escape artifacts."
effort: fast
---

# Humanize

<overview>
Rewrite inline text or an existing UTF-8 text file so it sounds natural for its actual surface. Preserve meaning and machine-sensitive content; change only assistant-authored phrasing and layout.
</overview>

<constraints>
- Preserve language, intent, negation, certainty, attribution, facts, numbers, URLs, mentions, issue IDs, commit SHAs, and Conventional Commit syntax.
- Preserve markup meaning, not markup syntax. Emit the dialect the target surface renders: standard Markdown for docs and PRs, `*bold*` for WhatsApp and Slack, no headings or tables in chat.
- Unless explicitly asked, do not alter direct quotes, required or legal text, code, identifiers, commands, regexes, string literals, signatures, or trailers.
- Do not use an em dash in assistant-authored prose. Use `:`, a comma, a full stop, or restructure the sentence.
- Convert literal `\n` used as visual separators into real newlines. Preserve protected or intentionally discussed `\n` syntax; never replace it blindly.
- Match the requested or existing register. Leave compliant or deliberately constrained text unchanged.
</constraints>

<surfaces>
Pick the surface first. It decides register, markup, and length before any rewrite happens. When the caller does not say, infer it from the source and state the assumption.

| Surface | Register | Markup | Length |
|---|---|---|---|
| WhatsApp, SMS, Discord, Teams DM | Spoken. Fragments, contractions, emoji as tone. | Surface dialect, no headings or tables. | One idea per message. Split rather than pad. |
| Slack channel or thread | Spoken but public. Answer first, detail after. | mrkdwn, `<url\|label>`. | A few lines. Thread the rest. |
| PR, issue, review comment | Direct and factual. Evidence inside the sentence. | Standard Markdown. | One or two sentences per point. |
| Commit, title, changelog | Imperative, no opener or closer. | Conventional Commit syntax intact. | One line plus optional body. |
| Doc, email, release note | Match the existing document. | Standard Markdown. | As long as the content, no longer. |

Read [chat-surface guidance](references/chat-surfaces.md) whenever the target is a chat message.
</surfaces>

<detect>
Scan every source before rewriting. Each hit is a candidate, never a verdict.

- A sentence turns a fact into its own significance.
- A trailing participle clause is bolted on for depth.
- An adjective does the job of a fact: seamless, robust, rich, incontournable.
- A claim has no named attribution.
- Three of anything where the content has two or four.
- Three consecutive sentences have the same length and shape.
- Chat residue, hedge stacking, or a closing paragraph has no fact.
- In chat: an acknowledgement opener, service closer, list answering a one-line question, or a recap in a message read at a glance.

Read [the full tell catalogue](references/ai-tells.md) for long-form prose, or when a hit is real but the rewrite is not obvious. Skip it for a one-line reply.
</detect>

<workflow>
1. Read the full source, select its surface, and keep each batch item as a separate reader-facing unit. For chat, read the preceding messages before choosing language and register.
2. Run the detection scan. Identify real hits and discard candidates that fit the surface.
3. Classify every `\n` before normalizing layout, then rewrite only text that violates a constraint or confirmed guidance. Rewrite the pattern, not a trigger word.
4. For multiple items, compare openers and rhythm across the batch. Remove accidental repetition.
5. Compare source and output. Confirm protected content is unchanged, certainty is unchanged, markup renders on the target surface, and no unprotected layout `\n` remains.
</workflow>

<output>
- Inline input: return only the ready-to-use text, with real newlines and no preamble.
- Chat: return text ready to paste. Separate multiple messages clearly and say nothing else.
- File input: edit in place and report each rewritten unit in at most one line.
- External handoff: pass actual multiline text, not a shell-escaped one-line payload. When possible, re-read the stored body before posting.
</output>

<on_blocked>
- Stop for a missing, unreadable, or binary file.
- Preserve ambiguous protected content or `\n` syntax and ask only for the narrow context needed to proceed safely.
</on_blocked>

<acceptance_criteria>
- The result is natural for its surface and register, with no confirmed detection hit remaining.
- Facts and protected content are unchanged.
- Multiline layout uses real newlines while intentional `\n` remains intact.
- The markup dialect matches the target surface.
</acceptance_criteria>
