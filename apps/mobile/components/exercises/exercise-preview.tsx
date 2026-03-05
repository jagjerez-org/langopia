import { View, Text, ScrollView } from "react-native";
import type { ExerciseResponse } from "@langopia/api-client";

interface ExercisePreviewProps {
  exercise: ExerciseResponse;
}

export function ExercisePreview({ exercise }: ExercisePreviewProps) {
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
      {/* Instruction */}
      <View>
        <Text className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Instruction
        </Text>
        <Text className="mt-1 text-base text-zinc-900 dark:text-white">
          {exercise.instruction}
        </Text>
      </View>

      {/* Content */}
      <View>
        <Text className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Content
        </Text>
        <View className="mt-1 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
          <Text className="text-base leading-6 text-zinc-900 dark:text-white">
            {exercise.content}
          </Text>
        </View>
      </View>

      {/* Options */}
      {exercise.options && exercise.options.length > 0 && (
        <View>
          <Text className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Options
          </Text>
          <View className="mt-1 flex-row flex-wrap gap-2">
            {exercise.options.map((opt, i) => (
              <View key={i} className="rounded-lg bg-blue-50 px-3 py-1.5 dark:bg-blue-900/30">
                <Text className="text-sm text-blue-700 dark:text-blue-300">{opt}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Correct Answer */}
      {exercise.correctAnswer && (
        <View>
          <Text className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Correct Answer
          </Text>
          <View className="mt-1 rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
            <Text className="text-base text-green-800 dark:text-green-300">
              {exercise.correctAnswer}
            </Text>
          </View>
        </View>
      )}

      {/* Explanation */}
      {exercise.explanation && (
        <View>
          <Text className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Explanation
          </Text>
          <Text className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-300">
            {exercise.explanation}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
