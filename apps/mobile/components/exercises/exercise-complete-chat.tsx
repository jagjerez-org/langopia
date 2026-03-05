import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ExerciseResponse } from "@langopia/api-client";

interface Props {
  exercise: ExerciseResponse;
}

interface ChatLine {
  speaker: string;
  text: string;
  hasBlank: boolean;
}

function parseChatContent(content: string): ChatLine[] {
  return content.split("\n").filter(Boolean).map((line) => {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      const text = match[2];
      return {
        speaker: match[1].trim(),
        text,
        hasBlank: /_{3,}|\{\{blank\}\}/.test(text),
      };
    }
    return { speaker: "", text: line, hasBlank: /_{3,}|\{\{blank\}\}/.test(line) };
  });
}

export function ExerciseCompleteChat({ exercise }: Props) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);

  const correctAnswer = exercise.correctAnswer ?? "";
  const isCorrect =
    answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

  const lines = parseChatContent(exercise.content);

  const handleCheck = () => {
    if (answer.trim()) setChecked(true);
  };

  const handleReset = () => {
    setAnswer("");
    setChecked(false);
  };

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
      {/* Instruction */}
      <Text className="text-base font-medium text-zinc-900 dark:text-white">
        {exercise.instruction}
      </Text>

      {/* Chat bubbles */}
      <View className="gap-2">
        {lines.map((line, i) => {
          const isEven = i % 2 === 0;
          const displayText = line.hasBlank
            ? line.text.replace(
                /_{3,}|\{\{blank\}\}/,
                checked
                  ? answer.trim()
                  : answer.trim() || "_____",
              )
            : line.text;

          return (
            <View
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                isEven
                  ? "self-start bg-zinc-100 dark:bg-zinc-700"
                  : "self-end bg-blue-100 dark:bg-blue-900/30"
              }`}
            >
              {line.speaker ? (
                <Text className="mb-0.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {line.speaker}
                </Text>
              ) : null}
              <Text
                className={`text-sm ${
                  line.hasBlank && checked
                    ? isCorrect
                      ? "text-green-700 dark:text-green-300"
                      : "text-red-700 dark:text-red-300"
                    : "text-zinc-900 dark:text-white"
                }`}
              >
                {displayText}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Input */}
      <TextInput
        value={answer}
        onChangeText={setAnswer}
        editable={!checked}
        placeholder="Type the missing word(s)..."
        placeholderTextColor="#a1a1aa"
        className={`rounded-xl border px-4 py-3 text-base text-zinc-900 dark:text-white ${
          checked
            ? isCorrect
              ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20"
              : "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
            : "border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-800"
        }`}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Check / Reset */}
      {!checked ? (
        <Pressable
          onPress={handleCheck}
          disabled={!answer.trim()}
          className={`items-center rounded-xl py-3 ${
            answer.trim() ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-700"
          }`}
        >
          <Text
            className={`font-semibold ${
              answer.trim() ? "text-white" : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            Check Answer
          </Text>
        </Pressable>
      ) : (
        <View>
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
              {isCorrect ? "Correct!" : `Incorrect. Answer: ${correctAnswer}`}
            </Text>
          </View>

          {exercise.explanation && (
            <View className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <Text className="text-sm text-zinc-600 dark:text-zinc-300">
                {exercise.explanation}
              </Text>
            </View>
          )}

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
