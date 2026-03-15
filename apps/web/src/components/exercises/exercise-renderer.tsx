"use client";

import { ExerciseType } from "@langopia/shared/types";
import { WarmUp } from "./warm-up";
import { Intro } from "./intro";
import { Card } from "./card";
import { TapToComplete } from "./tap-to-complete";
import { TapToOrder } from "./tap-to-order";
import { ListenMatch } from "./listen-match";
import { ListenRepeat } from "./listen-repeat";
import { WatchReflect } from "./watch-reflect";
import { CompleteChat } from "./complete-chat";
import { WriteComplete } from "./write-complete";
import { ListenComplete } from "./listen-complete";
import { Podcast } from "./podcast";
import { GuidedStory } from "./guided-story";
import { GuidedConversation } from "./guided-conversation";

export interface ExerciseData {
  id: string;
  type: string;
  title?: string | null;
  targetSkill: string;
  instruction: string;
  content: string;
  options?: string[] | null;
  correctAnswer?: string | null;
  explanation?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  imageUrl?: string | null;
}

interface ExerciseRendererProps {
  exercise: ExerciseData;
  mode: "preview" | "interactive";
}

export function ExerciseRenderer({ exercise, mode }: ExerciseRendererProps) {
  const props = { exercise, mode };

  switch (exercise.type) {
    case ExerciseType.WARM_UP:
      return <WarmUp {...props} />;
    case ExerciseType.INTRO:
      return <Intro {...props} />;
    case ExerciseType.CARD:
      return <Card {...props} />;
    case ExerciseType.TAP_TO_COMPLETE:
      return <TapToComplete {...props} />;
    case ExerciseType.TAP_TO_ORDER:
      return <TapToOrder {...props} />;
    case ExerciseType.LISTEN_MATCH:
      return <ListenMatch {...props} />;
    case ExerciseType.LISTEN_REPEAT:
      return <ListenRepeat {...props} />;
    case ExerciseType.WATCH_REFLECT:
      return <WatchReflect {...props} />;
    case ExerciseType.COMPLETE_CHAT:
      return <CompleteChat {...props} />;
    case ExerciseType.WRITE_COMPLETE:
      return <WriteComplete {...props} />;
    case ExerciseType.LISTEN_COMPLETE:
      return <ListenComplete {...props} />;
    case ExerciseType.PODCAST:
      return <Podcast {...props} />;
    case ExerciseType.GUIDED_STORY:
      return <GuidedStory {...props} />;
    case ExerciseType.GUIDED_CONVERSATION:
      return <GuidedConversation {...props} />;
    default:
      return (
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Unknown exercise type: {exercise.type}
          </p>
          <p className="mt-2 text-sm font-medium">{exercise.instruction}</p>
          <p className="mt-1 text-sm">{exercise.content}</p>
        </div>
      );
  }
}
