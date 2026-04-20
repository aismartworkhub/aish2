"use client";

import { useState, useEffect } from "react";
import {
  type FeatureFlags,
  DEFAULT_FEATURE_FLAGS,
  loadFeatureFlags,
} from "@/lib/site-settings-public";

export function useFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);

  useEffect(() => {
    loadFeatureFlags().then(setFlags).catch(() => {});
  }, []);

  return flags;
}

export function usePhaseEnabled(phase: keyof FeatureFlags): boolean {
  const flags = useFeatureFlags();
  return flags[phase]?.enabled === true;
}
