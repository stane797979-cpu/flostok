import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { tools, executeTool } from "@/server/services/ai/tools";
import {
  generateDataBasedFallback,
  classifyIntent,
} from "@/server/services/ai/fallback";
import {
  generateFallbackResponse,
  getErrorFallback,
} from "@/lib/ai/fallback/rule-based";

/**
 * AI 채팅 API Route
 * Anthropic Claude API + Tool Calling + Rule-based Fallback
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MAX_TOOL_ITERATIONS = 5; // 무한 루프 방지

/**
 * 시스템 프롬프트
 */
const SYSTEM_PROMPT = `You are an AI assistant for FloStok, a supply chain management system.
You help users with inventory management, purchase order recommendations, demand forecasting, and ABC-XYZ analysis.

## Your Capabilities
You have access to the following tools to retrieve real-time data:
1. get_inventory_status: Check inventory status for specific products or overall inventory
2. calculate_safety_stock: Calculate safety stock levels for products
3. get_reorder_recommendations: Get list of products that need reordering with recommended quantities
4. get_purchase_order_status: Check purchase order status and history
5. get_abcxyz_analysis: Get ABC-XYZ analysis results for products
6. get_demand_forecast: Get demand forecast for specific products

## Guidelines
- Always respond in Korean (한국어)
- Use formal and polite language (존대말)
- When users ask about inventory or orders, use the appropriate tools to get real data
- Format responses with markdown tables when presenting data
- Provide actionable recommendations based on the data
- If a tool call fails, provide helpful guidance on how to use the system manually

## Inventory Status Levels (7 levels)
- 품절 (out_of_stock): 현재고 = 0
- 위험 (critical): 0 < 현재고 < 안전재고 x 0.5
- 부족 (shortage): 안전재고 x 0.5 <= 현재고 < 안전재고
- 주의 (caution): 안전재고 <= 현재고 < 발주점
- 적정 (optimal): 발주점 <= 현재고 < 안전재고 x 3
- 과다 (excess): 안전재고 x 3 <= 현재고 < 안전재고 x 5
- 과잉 (overstock): 현재고 >= 안전재고 x 5

## Reorder Point Formula
발주점 = 일평균판매량 x 리드타임(일) + 안전재고

Always be helpful, accurate, and proactive in providing SCM insights.`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "메시지 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage?.content || "";

    // API 키 확인
    if (!ANTHROPIC_API_KEY) {
      console.warn(
        "ANTHROPIC_API_KEY가 설정되지 않았습니다. 데이터 기반 폴백 모드로 동작합니다."
      );
      // 데이터 기반 폴백 사용 (실제 DB 조회)
      const fallbackResult = await generateDataBasedFallback(userMessage);
      return streamTextResponse(fallbackResult.response);
    }

    // Anthropic 클라이언트 초기화
    const anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });

    // 메시지 형식 변환 (role + content)
    const anthropicMessages = messages.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
        content: msg.content,
      })
    );

    try {
      // Claude API 호출 (도구 호출 포함)
      const response = await handleClaudeConversation(
        anthropic,
        anthropicMessages,
        userMessage
      );

      return streamTextResponse(response);
    } catch (apiError: unknown) {
      console.error("Claude API Error:", apiError);

      // API 에러 시 데이터 기반 폴백 시도
      try {
        const fallbackResult = await generateDataBasedFallback(userMessage);
        if (fallbackResult.dataUsed) {
          // 실제 데이터 기반 응답이 있으면 사용
          const errorInfo = getErrorFallback(apiError);
          const combinedResponse = `*AI 서비스가 일시적으로 사용 불가하여 시스템 데이터 기반 응답입니다.*\n\n${fallbackResult.response}\n\n---\n*${errorInfo.suggestion}*`;
          return streamTextResponse(combinedResponse);
        }
      } catch (fallbackError) {
        console.error("Data-based fallback error:", fallbackError);
      }

      // 최종 폴백: 정적 응답
      const errorFallback = getErrorFallback(apiError);
      const staticFallback = generateFallbackResponse(userMessage);
      const fallbackResponse = `${errorFallback.message}\n\n${errorFallback.suggestion}\n\n---\n\n${staticFallback}`;

      return streamTextResponse(fallbackResponse);
    }
  } catch (error) {
    console.error("AI Chat API Error:", error);
    return NextResponse.json(
      { error: "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * Claude 대화 처리 (도구 호출 포함)
 */
async function handleClaudeConversation(
  anthropic: Anthropic,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string
): Promise<string> {
  // 의도 분류로 사용할 도구 힌트 추가
  const intent = classifyIntent(userMessage);
  const toolHint =
    intent.confidence > 0.5
      ? `\n\n[System hint: User intent appears to be "${intent.intent}" with entities: ${JSON.stringify(intent.entities)}]`
      : "";

  const currentMessages: Array<{
    role: "user" | "assistant";
    content:
      | string
      | Array<
          | Anthropic.Messages.TextBlockParam
          | Anthropic.Messages.ToolUseBlockParam
          | Anthropic.Messages.ToolResultBlockParam
        >;
  }> = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // 마지막 사용자 메시지에 힌트 추가 (있는 경우)
  if (
    toolHint &&
    currentMessages.length > 0 &&
    currentMessages[currentMessages.length - 1].role === "user"
  ) {
    const lastMsg = currentMessages[currentMessages.length - 1];
    if (typeof lastMsg.content === "string") {
      lastMsg.content = lastMsg.content + toolHint;
    }
  }

  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: currentMessages,
      tools: tools as Anthropic.Messages.Tool[],
    });

    // 정상 종료
    if (response.stop_reason === "end_turn") {
      const textContent = response.content.find(
        (block): block is Anthropic.Messages.TextBlock => block.type === "text"
      );
      if (textContent) {
        return textContent.text;
      }
    }

    // 도구 호출
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) {
        break;
      }

      // 어시스턴트 응답 추가 (도구 호출 포함)
      currentMessages.push({
        role: "assistant",
        content: response.content as Array<
          | Anthropic.Messages.TextBlockParam
          | Anthropic.Messages.ToolUseBlockParam
        >,
      });

      // 도구 실행
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          console.log(`Executing tool: ${block.name}`, block.input);
          const result = await executeTool(block.name, block.input);
          console.log(`Tool result [${block.name}]:`, result.success);

          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(result, null, 2),
          };
        })
      );

      // 도구 결과 추가
      currentMessages.push({
        role: "user",
        content: toolResults as Anthropic.Messages.ToolResultBlockParam[],
      });

      continue;
    }

    break;
  }

  if (iterations >= MAX_TOOL_ITERATIONS) {
    console.warn("Max tool iterations reached");
  }

  // 도구 호출 후에도 텍스트 응답이 없으면 폴백
  const fallbackResult = await generateDataBasedFallback(userMessage);
  return fallbackResult.response;
}

/**
 * 텍스트를 스트리밍 형식으로 응답
 */
function streamTextResponse(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // 응답을 천천히 전송 (스트리밍 효과)
      const words = text.split(" ");
      for (let i = 0; i < words.length; i++) {
        const chunk = i === 0 ? words[i] : " " + words[i];
        controller.enqueue(encoder.encode(chunk));
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
