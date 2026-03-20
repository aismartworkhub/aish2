import { NextResponse } from "next/server";

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-3.5-mini";

export async function POST(request: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const prompt = body?.prompt;

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const anthropicPrompt = `\n\nHuman: ${prompt}\n\nAssistant:`;

  try {
    const response = await fetch(`${ANTHROPIC_BASE}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        prompt: anthropicPrompt,
        max_tokens_to_sample: 500,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: "Anthropic API returned error", detail: errorBody },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ output: data.completion ?? "" });
  } catch (error) {
    return NextResponse.json({ error: "Request failed", detail: (error as Error).message }, { status: 500 });
  }
}
