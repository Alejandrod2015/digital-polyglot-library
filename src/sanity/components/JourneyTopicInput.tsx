"use client";

import { useMemo } from "react";
import { set, unset, useFormValue, type StringInputProps } from "sanity";
import { Card, Select, Stack, Text } from "@sanity/ui";
import { getJourneyTopicOptions } from "../../app/journey/journeyCurriculum";

export default function JourneyTopicInput(props: StringInputProps) {
  const variant = useFormValue(["variant"]);
  const cefrLevel = useFormValue(["cefrLevel"]);

  const variantId = typeof variant === "string" ? variant.trim().toLowerCase() : "";
  const levelId = typeof cefrLevel === "string" ? cefrLevel.trim().toLowerCase() : "";

  const options = useMemo(() => {
    if (!variantId || !levelId) return [];
    return getJourneyTopicOptions("Spanish", variantId, levelId);
  }, [levelId, variantId]);

  const value = typeof props.value === "string" ? props.value : "";
  const disabled = !variantId || !levelId || options.length === 0;

  return (
    <Stack space={3}>
      <Select
        value={value}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          props.onChange(nextValue ? set(nextValue) : unset());
        }}
        disabled={disabled}
      >
        <option value="">
          {disabled ? "Choose variant and CEFR first" : "Select a Journey topic"}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.title}
          </option>
        ))}
      </Select>

      {disabled ? (
        <Card padding={3} radius={2} tone="transparent" border>
          <Text size={1} muted>
            Journey topics depend on the selected variant and CEFR level.
          </Text>
        </Card>
      ) : null}
    </Stack>
  );
}
