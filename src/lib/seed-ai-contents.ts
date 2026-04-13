/**
 * AI 관련 샘플 콘텐츠 시드 데이터
 * 관리자 페이지에서 한 번 호출하여 Firestore에 삽입합니다.
 */
import { createContentIfNew } from "@/lib/content-engine";
import type { ContentInput } from "@/types/content";

const ADMIN_UID = "seed-admin";
const ADMIN_NAME = "AISH 관리자";
const MEMBER_UID = "seed-member";
const MEMBER_NAME = "AI학습러";

export const SEED_CONTENTS: ContentInput[] = [
  // ── 콘텐츠실 (media-lecture) — 관리자 모드, 유튜브 영상 ──
  {
    boardKey: "media-lecture",
    title: "LangGraph 에이전트 + MCP 도구 서버 연결하기",
    body: "테디노트의 최신 강의입니다. LangGraph와 MCP(Model Context Protocol)를 활용해 AI 에이전트를 구축하고 프론트엔드와 연결하는 방법을 다룹니다. React 에이전트 통합, MCP 도구 서버 설정 등 실무에 바로 적용 가능한 내용입니다.",
    mediaType: "youtube",
    mediaUrl: "https://www.youtube.com/watch?v=A31X4gdGbKw",
    thumbnailUrl: "https://img.youtube.com/vi/A31X4gdGbKw/mqdefault.jpg",
    authorUid: ADMIN_UID,
    authorName: ADMIN_NAME,
    tags: ["LangGraph", "MCP", "AI에이전트", "테디노트"],
    isPinned: false,
    isApproved: true,
  },
  {
    boardKey: "media-lecture",
    title: "RAG 파이프라인 — 우리가 쉽게 결과를 얻을 수 없는 이유",
    body: "LangChain 밋업 발표 영상입니다. RAG(Retrieval-Augmented Generation) 시스템을 실무에 적용할 때 겪는 현실적인 문제점과 해결 방안을 다룹니다. 청킹 전략, 임베딩 최적화, 리랭킹 등 고급 기법을 설명합니다.",
    mediaType: "youtube",
    mediaUrl: "https://www.youtube.com/watch?v=NfQrRQmDrcc",
    thumbnailUrl: "https://img.youtube.com/vi/NfQrRQmDrcc/mqdefault.jpg",
    authorUid: ADMIN_UID,
    authorName: ADMIN_NAME,
    tags: ["RAG", "LangChain", "밋업", "실무"],
    isPinned: false,
    isApproved: true,
  },

  // ── 콘텐츠실 (media-lecture) — 영어 채널 ──
  {
    boardKey: "media-lecture",
    title: "신경망이란 무엇인가 — 3Blue1Brown 딥러닝 시리즈",
    body: "수학 시각화의 대가 3Blue1Brown의 신경망 입문 강의입니다. 신경망의 구조, 뉴런의 활성화, 가중치와 편향의 역할을 직관적인 애니메이션으로 이해할 수 있습니다. AI/ML 입문자에게 강력 추천합니다.",
    mediaType: "youtube",
    mediaUrl: "https://www.youtube.com/watch?v=aircAruvnKk",
    thumbnailUrl: "https://img.youtube.com/vi/aircAruvnKk/mqdefault.jpg",
    authorUid: ADMIN_UID,
    authorName: ADMIN_NAME,
    tags: ["신경망", "딥러닝", "3Blue1Brown", "입문"],
    isPinned: false,
    isApproved: true,
  },
  {
    boardKey: "media-lecture",
    title: "내가 LLM을 사용하는 방법 — Andrej Karpathy",
    body: "전 Tesla AI 디렉터 Andrej Karpathy가 실생활에서 LLM(대규모 언어 모델)을 활용하는 방법을 2시간에 걸쳐 상세히 보여줍니다. ChatGPT, Claude, Gemini 등 주요 모델의 실전 사용법, 프롬프트 기법, 도구 활용까지 다룹니다.",
    mediaType: "youtube",
    mediaUrl: "https://www.youtube.com/watch?v=EWvNQjAaOHw",
    thumbnailUrl: "https://img.youtube.com/vi/EWvNQjAaOHw/mqdefault.jpg",
    authorUid: ADMIN_UID,
    authorName: ADMIN_NAME,
    tags: ["LLM", "Karpathy", "ChatGPT", "실전활용"],
    isPinned: false,
    isApproved: true,
  },

  // ── 자료실 (media-resource) — 관리자 모드 ──
  {
    boardKey: "media-resource",
    title: "[GitHub/MIT] 생성형 AI 입문 21강 — Microsoft 공식 교육",
    body: "Microsoft가 공개한 생성형 AI 입문 과정입니다. 21개 레슨으로 구성되어 있으며, 프롬프트 엔지니어링부터 RAG, AI 에이전트까지 체계적으로 학습할 수 있습니다. MIT 라이선스로 자유롭게 활용 가능합니다.\n\n원본: https://github.com/microsoft/generative-ai-for-beginners",
    mediaType: "link",
    mediaUrl: "https://github.com/microsoft/generative-ai-for-beginners",
    authorUid: ADMIN_UID,
    authorName: ADMIN_NAME,
    tags: ["GitHub", "Microsoft", "생성형AI", "MIT라이선스", "입문"],
    isPinned: true,
    isApproved: true,
  },
  {
    boardKey: "media-resource",
    title: "[GitHub/MIT] LangChain 한국어 튜토리얼 — 테디노트",
    body: "LangChain을 한국어로 학습할 수 있는 무료 튜토리얼입니다. 기초 개념부터 RAG 파이프라인, 에이전트 구축까지 단계별 실습 코드와 함께 제공됩니다. WikiDocs에서 전자책으로도 읽을 수 있습니다.\n\n원본: https://github.com/teddylee777/langchain-kr",
    mediaType: "link",
    mediaUrl: "https://github.com/teddylee777/langchain-kr",
    authorUid: ADMIN_UID,
    authorName: ADMIN_NAME,
    tags: ["GitHub", "LangChain", "한국어", "튜토리얼"],
    isPinned: false,
    isApproved: true,
  },

  // ── 묻고답하기 (community-qna) — 정회원 모드 ──
  {
    boardKey: "community-qna",
    title: "RAG와 파인튜닝 중 어떤 것을 선택해야 하나요?",
    body: "사내 문서 기반 AI 챗봇을 만들려고 합니다. RAG(검색 증강 생성)와 파인튜닝 중 어떤 방식이 더 적합한지 궁금합니다. 문서가 자주 업데이트되는 환경입니다.",
    mediaType: "none",
    authorUid: MEMBER_UID,
    authorName: MEMBER_NAME,
    tags: ["RAG", "파인튜닝", "챗봇", "질문"],
    isPinned: false,
    isApproved: true,
    question: "RAG와 파인튜닝 중 어떤 것을 선택해야 하나요?",
    answer: "문서가 자주 업데이트되는 환경이라면 RAG를 추천합니다. RAG는 검색 시점의 최신 문서를 활용하므로 재학습 없이 정보가 반영됩니다. 파인튜닝은 모델 자체의 행동이나 톤을 바꿀 때 적합하고, 정보 업데이트에는 매번 재학습이 필요합니다. 두 기법을 함께 사용하는 하이브리드 방식도 고려해 보세요.",
  },
  {
    boardKey: "community-qna",
    title: "로컬 LLM 추천해주세요 (GPU 8GB 기준)",
    body: "RTX 4060(VRAM 8GB) 환경에서 한국어가 되는 로컬 LLM을 찾고 있습니다. Ollama로 돌릴 수 있는 모델 중 추천 부탁드립니다.",
    mediaType: "none",
    authorUid: MEMBER_UID,
    authorName: MEMBER_NAME,
    tags: ["로컬LLM", "Ollama", "한국어", "GPU"],
    isPinned: false,
    isApproved: true,
    question: "로컬 LLM 추천해주세요 (GPU 8GB 기준)",
    answer: "8GB VRAM 기준으로 추천드립니다: 1) Qwen2.5-7B-Instruct (Q4_K_M) — 한국어 성능 우수, 2) Llama-3.1-8B-Instruct (Q4_K_M) — 범용 성능 좋음, 3) EXAONE-3.5-7.8B — LG에서 만든 한국어 특화 모델. Ollama에서 `ollama pull qwen2.5:7b` 명령으로 바로 설치 가능합니다.",
  },

  // ── 게시판 자유게시판 (community-free) — 정회원 모드 ──
  {
    boardKey: "community-free",
    title: "[추천] 2026 AI 학습 로드맵 — 유튜브 채널 & GitHub 모음",
    body: "AI를 체계적으로 학습하고 싶은 분들을 위해 추천 리소스를 정리했습니다.\n\n**한국어 유튜브 채널**\n- 테디노트: LangChain, RAG 등 실무 튜토리얼\n- 조코딩: AI 도구 활용, 프로젝트 기반 학습\n\n**영어 유튜브 채널**\n- 3Blue1Brown: 수학/AI 시각적 설명\n- Andrej Karpathy: 딥러닝 실전 강의\n\n**GitHub (오픈소스)**\n- microsoft/generative-ai-for-beginners (MIT)\n- teddylee777/langchain-kr (MIT)\n\n**레딧/커뮤니티**\n- r/MachineLearning — ML 논문 및 뉴스\n- r/LocalLLaMA — 로컬 LLM 운영\n\n**국내 뉴스**\n- AI타임스 (aitimes.com)\n- 공공데이터포털 (data.go.kr)",
    mediaType: "none",
    authorUid: MEMBER_UID,
    authorName: MEMBER_NAME,
    tags: ["AI", "학습자료", "유튜브", "GitHub", "추천"],
    isPinned: true,
    isApproved: true,
  },
  {
    boardKey: "community-free",
    title: "Claude MCP로 AI 에이전트 만들어본 후기",
    body: "조코딩 유튜브에서 본 'AI 에이전트' 영상 보고 직접 만들어봤습니다. Claude의 MCP(Model Context Protocol)를 사용하면 외부 도구(파일 시스템, 데이터베이스, API 등)를 AI가 직접 호출할 수 있어서 정말 신기했습니다.\n\n실습 후기:\n- 설정은 생각보다 간단 (JSON 설정 파일 하나)\n- 파일 읽기/쓰기가 바로 가능해서 업무 자동화에 활용 가능\n- 아직 보안 측면에서는 신중하게 접근 필요\n\n참고 영상: https://www.youtube.com/watch?v=TmpL2i3AuPk",
    mediaType: "youtube",
    mediaUrl: "https://www.youtube.com/watch?v=TmpL2i3AuPk",
    thumbnailUrl: "https://img.youtube.com/vi/TmpL2i3AuPk/mqdefault.jpg",
    authorUid: MEMBER_UID,
    authorName: MEMBER_NAME,
    tags: ["MCP", "AI에이전트", "Claude", "후기"],
    isPinned: false,
    isApproved: true,
  },
];

export async function seedAiContents(): Promise<{ success: number; skipped: number; failed: number }> {
  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of SEED_CONTENTS) {
    try {
      const id = await createContentIfNew(item);
      if (id) success++;
      else skipped++;
    } catch (e) {
      console.error(`Failed to seed: ${item.title}`, e);
      failed++;
    }
  }

  return { success, skipped, failed };
}
