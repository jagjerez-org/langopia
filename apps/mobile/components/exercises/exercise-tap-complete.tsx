import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ExerciseResponse } from "@langopia/api-client";

interface Props {
  exercise: ExerciseResponse;
}

export function ExerciseTapComplete({ exercise }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const isCorrect = selected === exercise.correctAnswer;
  const options = exercise.options ?? [];

  // Parse blanks: content might have _____ or {{blank}} patterns
  const parts = exercise.content.split(/_{3,}|\{\{blank\}\}/);
  const hasBlank = parts.length > 1;

  const handleCheck = () => {
    if (selected) setChecked(true);
  };

  const handleReset = () => {
    setSelected(null);
    setChecked(false);
  };

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 20 }}>
      {/* Instruction */}
      <Text className="text-base font-medium text-zinc-900 dark:text-white">
        {exercise.instruction}
      </Text>

      {/* Content with blank */}
      <View className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
        <Text className="text-base leading-7 text-zinc-900 dark:text-white">
          {hasBlank
            ? parts.map((part, i) => (
                <Text key={i}>
                  {part}
                  {i < parts.length - 1 && (
                    <Text
                      className={`font-bold ${
                        checked
                          ? isCorrect
                            ? "text-green-600"
                            : "text-red-500"
                          : "text-blue-600"
                      }`}
                    >
                      {selected ? ` ${selected} ` : " _____ "}
                    </Text>
                  )}
                </Text>
              ))
            : exercise.content}
        </Text>
      </View>

      {/* Options */}
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selected === opt;
          const showCorrect = checked && opt === exercise.correctAnswer;
          const showWrong = checked && isSelected && !isCorrect;

          return (
            <Pressable
              key={opt}
              onPress={() => {
                if (!checked) setSelected(opt);
              }}
              className={`rounded-xl px-4 py-2.5 ${
                showCorrect
                  ? "bg-green-100 dark:bg-green-900/30"
                  : showWrong
                    ? "bg-red-100 dark:bg-red-900/30"
                    : isSelected
                      ? "bg-blue-100 dark:bg-blue-900/30"
                      : "bg-zinc-100 dark:bg-zinc-700"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  showCorrect
                    ? "text-green-700 dark:text-green-300"
                    : showWrong
                      ? "text-red-700 dark:text-red-300"
                      : isSelected
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-zinc-700 dark:text-zinc-200"
                }`}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Check / Reset button */}
      {!checked ? (
        <Pressable
          onPress={handleCheck}
          disabled={!selected}
          className={`items-center rounded-xl py-3 ${
            selected ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-700"
          }`}
        >
          <Text
            className={`font-semibold ${
              selected ? "text-white" : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            Check Answer
          </Text>
        </Pressable>
      ) : (
        <View>
          {/* Feedback */}
          <View
            className={`flex-row items-center gap-2 rounded-xl p-4 ${
              isCorrect
                ? "bg-green-50 dark:bg-green-900/20"
                : "bg-red-50 dark:bg-red-900/20"
            }`}
          >
            <Ionicons
              name={isCorrect ? "checkmark-circle" : "close-circle"}
              size={24}
              color={isCorrect ? "#16a34a" : "#dc2626"}
            />
            <Text
              className={`flex-1 font-medium ${
                isCorrect
                  ? "text-green-700 dark:text-green-300"
                  : "text-red-700 dark:text-red-300"
              }`}
            >
              {isCorrect ? "Correct!" : `Incorrect. Answer: ${exercise.correctAnswer}`}
            </Text>
          </View>

          {/* Explanation */}
          {exercise.explanation && (
            <View className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <Text className="text-sm text-zinc-600 dark:text-zinc-300">
                {exercise.explanation}
              </Text>
            </View>
          )}

          {/* Try again */}
          <Pressable
            onPress={handleReset}
            className="mt-3 items-center rounded-xl bg-zinc-100 py-3 dark:bg-zinc-700"
          >
            <Text className="font-medium text-zinc-700 dark:text-zinc-200">Try Again</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
