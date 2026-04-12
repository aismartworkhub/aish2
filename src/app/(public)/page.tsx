"use client";

import { useEffect, useState } from "react";
import { useHomeData } from "@/hooks/useHomeData";
import { loadSiteTheme, type HomeTemplate } from "@/lib/site-settings-public";
import HomeDefault from "@/components/home/HomeDefault";
import HomeModern from "@/components/home/HomeModern";

export default function HomePage() {
  const [template, setTemplate] = useState<HomeTemplate>("default");
  const homeData = useHomeData();

  useEffect(() => {
    loadSiteTheme().then((t) => setTemplate(t.homeTemplate));
  }, []);

  return template === "modern"
    ? <HomeModern {...homeData} />
    : <HomeDefault {...homeData} />;
}
