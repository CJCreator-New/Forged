"use client";

import { useEffect, useState } from "react";
import type { Angle } from "@/lib/schemas/ideas";
import type { Channel, PostFrontmatter } from "@/lib/schemas/post";
import {
  getJson,
  postJson,
  type ApiResult,
  type DraftResponse,
  type IdeasResponse,
  type PickResponse,
  type SettingsResponse,
} from "./api";
import { AnglesList } from "./AnglesList";
import { CHANNEL_LABEL, CHANNEL_ORDER } from "./copy";
import { Notice, type NoticeState } from "./Notice";
import { PostCard, type DraftedPost } from "./PostCard";
import { plainError } from "./messages";
import { TopicForm } from "./TopicForm";
import { buttonPrimary, cardSurface } from "./ui";

type Defaults = { trend: boolean; humanise: boolean; variants: 2 | 3 };

// Used until /api/settings answers. Matches config/features.json.
const FALLBACK_DEFAULTS: Defaults = { trend: false, humanise: true, variants: 2 };

type Ideas = {
  ideaFile: string;
  angles: Angle[];
  sources: { url: string; title: string }[];
};

export function DailyScreen() {
  const [defaults, setDefaults] = useState<Defaults>(FALLBACK_DEFAULTS);
  const [topic, setTopic] = useState("");
  const [trend, setTrend] = useState(FALLBACK_DEFAULTS.trend);
  const [busy, setBusy] = useState<"ideas" | "pick" | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [ideas, setIdeas] = useState<Ideas | null>(null);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [dayPath, setDayPath] = useState<string | null>(null);
  const [frontmatter, setFrontmatter] = useState<Partial<Record<Channel, PostFrontmatter>>>({});
  const [posts, setPosts] = useState<Partial<Record<Channel, DraftedPost>>>({});
  const [draftErrors, setDraftErrors] = useState<Partial<Record<Channel, NoticeState>>>({});
  const [drafting, setDrafting] = useState<Partial<Record<Channel, boolean>>>({});

  // Read the switches once so the page starts with the user's real defaults.
  useEffect(() => {
    let cancelled = false;
    getJson<SettingsResponse>("/api/settings").then((result) => {
      if (cancelled || !result.ok) return;
      const switches = result.data.switches;
      const next: Defaults = {
        trend: switches.trend_mode ?? FALLBACK_DEFAULTS.trend,
        humanise: switches.humanise ?? FALLBACK_DEFAULTS.humanise,
        variants: switches.variants === 3 ? 3 : 2,
      };
      setDefaults(next);
      setTrend(next.trend);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function getAngles() {
    const text = topic.trim();
    if (!text) return;
    setBusy("ideas");
    setNotice(null);
    const result = await postJson<IdeasResponse>("/api/ideas", { topic: text, trend_mode: trend });
    setBusy(null);
    if (!result.ok) {
      setNotice({ tone: "error", error: plainError(result.error) });
      return;
    }
    setIdeas({
      ideaFile: result.data.idea_file,
      angles: result.data.angles,
      sources: result.data.trend_sources ?? [],
    });
    setPickedIndex(null);
    setDayPath(null);
    setFrontmatter({});
    setPosts({});
    setDraftErrors({});
  }

  // Writes one channel's draft. Used on pick, on retry, and for style changes.
  async function draftChannel(
    day: string,
    fm: PostFrontmatter,
    style: string,
    length: PostFrontmatter["length"],
  ): Promise<ApiResult<DraftResponse>> {
    setDrafting((current) => ({ ...current, [fm.channel]: true }));
    const result = await postJson<DraftResponse>("/api/draft", {
      day_path: day,
      channel: fm.channel,
      length,
      style,
      humanise: defaults.humanise,
    });
    setDrafting((current) => ({ ...current, [fm.channel]: false }));
    return result;
  }

  function storeDraft(fm: PostFrontmatter, draft: DraftResponse, style: string, length: PostFrontmatter["length"]) {
    setPosts((current) => ({
      ...current,
      [fm.channel]: {
        channel: fm.channel,
        postPath: draft.post_path,
        format: fm.format,
        style,
        length,
        reviewRequired: fm.review_required,
        lint: draft.lint,
        humanised: defaults.humanise,
        revision: 0,
      },
    }));
    setDraftErrors((current) => ({ ...current, [fm.channel]: undefined }));
  }

  function storeDraftError(channel: Channel, error: NoticeState) {
    setDraftErrors((current) => ({ ...current, [channel]: error }));
  }

  async function pickAngle(index: number) {
    if (!ideas) return;
    setBusy("pick");
    setNotice(null);
    setPickedIndex(index);
    const picked = await postJson<PickResponse>("/api/pick", {
      idea_file: ideas.ideaFile,
      angle_index: index,
    });
    setBusy(null);
    if (!picked.ok) {
      setPickedIndex(null);
      setNotice({ tone: "error", error: plainError(picked.error) });
      return;
    }

    const day = picked.data.day_path;
    const byChannel: Partial<Record<Channel, PostFrontmatter>> = {};
    picked.data.posts.forEach((fm) => {
      byChannel[fm.channel] = fm;
    });
    setDayPath(day);
    setFrontmatter(byChannel);
    setPosts({});
    setDraftErrors({});

    // The three channel drafts run in parallel.
    await Promise.all(
      CHANNEL_ORDER.map(async (channel) => {
        const fm = byChannel[channel];
        if (!fm) {
          storeDraftError(channel, {
            tone: "error",
            error: plainError({ code: "draft_missing", message: "" }),
          });
          return;
        }
        const result = await draftChannel(day, fm, fm.style, fm.length);
        if (result.ok) {
          storeDraft(fm, result.data, fm.style, fm.length);
        } else {
          storeDraftError(channel, { tone: "error", error: plainError(result.error) });
        }
      }),
    );
  }

  async function retryDraft(channel: Channel) {
    const fm = frontmatter[channel];
    if (!dayPath || !fm) return;
    const result = await draftChannel(dayPath, fm, fm.style, fm.length);
    if (result.ok) {
      storeDraft(fm, result.data, fm.style, fm.length);
    } else {
      storeDraftError(channel, { tone: "error", error: plainError(result.error) });
    }
  }

  // Lets a card patch its post after a step (lint, length, variant, and so on).
  function patchPost(channel: Channel, patch: Partial<DraftedPost>) {
    setPosts((current) => {
      const existing = current[channel];
      if (!existing) return current;
      return { ...current, [channel]: { ...existing, ...patch, revision: existing.revision + 1 } };
    });
  }

  // Re-drafts one channel with a new style. The card reloads its text from the patch.
  async function redraft(
    channel: Channel,
    change: { style: string; length: DraftedPost["length"] },
  ): Promise<ApiResult<unknown>> {
    const current = posts[channel];
    if (!dayPath || !current) {
      return { ok: false, error: { code: "not_ready", message: "This post is not ready yet." } };
    }
    const result = await draftChannel(dayPath, frontmatter[channel] as PostFrontmatter, change.style, change.length);
    if (result.ok) {
      patchPost(channel, {
        postPath: result.data.post_path,
        lint: result.data.lint,
        style: change.style,
        length: change.length,
        humanised: defaults.humanise,
      });
    }
    return result;
  }

  const ideasBusy = busy !== null;
  const hasPosts = dayPath !== null;

  return (
    <main className="min-h-screen bg-[#F1F1EC] font-[family-name:var(--font-geist-sans)] text-[#1B1F1D]">
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-[28px] leading-8 font-semibold tracking-[-0.02em] text-[#1B1F1D]">Daily</h1>
          <p className="max-w-prose text-[15px] leading-6 text-[#5A605C]">
            One topic in. Three posts out, one for each channel.
          </p>
        </header>

        {notice ? (
          <Notice
            notice={notice}
            onDismiss={() => setNotice(null)}
            onTurnTrendOff={() => {
              setTrend(false);
              setNotice(null);
            }}
          />
        ) : null}

        <section aria-labelledby="daily-topic" className="flex flex-col gap-4">
          <h2 id="daily-topic" className="text-lg font-semibold text-[#1B1F1D]">
            Topic
          </h2>
          <TopicForm
            topic={topic}
            onTopicChange={setTopic}
            trend={trend}
            onTrendChange={setTrend}
            busy={ideasBusy}
            onSubmit={() => void getAngles()}
          />
        </section>

        {ideas ? (
          <section aria-labelledby="daily-angles" className="flex flex-col gap-4 border-t border-[#D6D7D0] pt-8">
            <div className="flex flex-col gap-1">
              <h2 id="daily-angles" className="text-lg font-semibold text-[#1B1F1D]">
                Angles
              </h2>
              <p className="text-sm text-[#5A605C]">Pick one. It becomes today&apos;s brief.</p>
            </div>
            <AnglesList
              angles={ideas.angles}
              trendSources={ideas.sources}
              pickedIndex={pickedIndex}
              busy={ideasBusy}
              onPick={(index) => void pickAngle(index)}
            />
          </section>
        ) : null}

        {hasPosts || busy === "pick" ? (
          <section aria-labelledby="daily-posts" className="flex flex-col gap-4 border-t border-[#D6D7D0] pt-8">
            <div className="flex flex-col gap-1">
              <h2 id="daily-posts" className="text-lg font-semibold text-[#1B1F1D]">
                Posts
              </h2>
              <p className="text-sm text-[#5A605C]">Compare them side by side, then fix and export each one.</p>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {CHANNEL_ORDER.map((channel) => {
                const post = posts[channel];
                const error = draftErrors[channel];
                if (post) {
                  return (
                    <PostCard
                      key={channel}
                      post={post}
                      variantCount={defaults.variants}
                      onPatch={patchPost}
                      onRedraft={redraft}
                    />
                  );
                }
                if (error) {
                  return (
                    <div key={channel} className={`${cardSurface}`}>
                      <h3 className="text-lg font-semibold text-[#1B1F1D]">{CHANNEL_LABEL[channel]}</h3>
                      <Notice notice={error} onDismiss={() => setDraftErrors((c) => ({ ...c, [channel]: undefined }))} />
                      <div>
                        <button
                          type="button"
                          onClick={() => void retryDraft(channel)}
                          disabled={drafting[channel] === true}
                          className={buttonPrimary}
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={channel} className={cardSurface}>
                    <h3 className="text-lg font-semibold text-[#1B1F1D]">{CHANNEL_LABEL[channel]}</h3>
                    <p className="text-sm text-[#5A605C]">Writing this post...</p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
