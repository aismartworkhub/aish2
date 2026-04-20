import { GoogleGenerativeAI } from "@google/generative-ai";

export interface BusinessCardResult {
  name?: string;
  companyName?: string;
  companyRole?: string;
  companyProduct?: string;
  companyWebsite?: string;
  phone?: string;
  email?: string;
  companyIndustry?: string;
}

const PROMPT = `이 명함 이미지에서 다음 정보를 추출해주세요. JSON 형태로만 응답하세요.
{
  "name": "이름",
  "companyName": "회사명",
  "companyRole": "직책",
  "companyProduct": "주요 제품/서비스 (유추 가능 시)",
  "companyWebsite": "웹사이트 URL",
  "phone": "전화번호",
  "email": "이메일",
  "companyIndustry": "업종 코드 (IT, AI, EDU, FINANCE, MANUFACTURING, HEALTHCARE, GOVERNMENT, STARTUP, CONSULTING, MEDIA, OTHER 중 하나)"
}
정보가 없으면 빈 문자열로 작성하세요. JSON만 출력하세요.`;

export async function analyzeBusinessCard(
  imageBase64: string,
  geminiApiKey: string,
): Promise<BusinessCardResult> {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent([
    PROMPT,
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64,
      },
    },
  ]);

  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI 응답에서 JSON을 찾을 수 없습니다.");

  return JSON.parse(jsonMatch[0]) as BusinessCardResult;
}
