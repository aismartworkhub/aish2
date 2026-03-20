"use client";

import { useState } from "react";

export default function ClaudePage() {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAnswer("");
    setError(null);

    if (!prompt.trim()) {
      setError("질문을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "API 호출 오류");
      } else {
        setAnswer(data.output ?? "(응답 없음)");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">Claude 통합 미리보기</h1>
      <p className="mb-6 text-gray-600">Anthropic Claude 모델과 1:1 질문/응답 테스트 페이지입니다.</p>

      <form onSubmit={submit} className="space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Claude에게 물어볼 내용을 입력하세요..."
          rows={5}
          className="w-full border border-gray-300 rounded p-3 focus:outline-none focus:border-primary-500"
        />

        <button
          type="submit"
          className="rounded bg-blue-600 text-white px-6 py-2 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "응답 대기 중..." : "전송"}
        </button>
      </form>

      {error && <div className="mt-4 text-red-600">에러: {error}</div>}

      {answer && (
        <section className="mt-6 bg-gray-50 border border-gray-200 rounded p-4">
          <h2 className="text-lg font-semibold mb-2">Claude 답변</h2>
          <pre className="whitespace-pre-wrap">{answer}</pre>
        </section>
      )}

      <div className="mt-6 text-sm text-gray-500">
        <div>환경변수</div>
        <ul className="list-disc list-inside">
          <li><code>ANTHROPIC_API_KEY</code> (필수)</li>
          <li><code>ANTHROPIC_MODEL</code> (선택: 기본 claude-3.5-mini)</li>
        </ul>
      </div>
    </main>
  );
}
