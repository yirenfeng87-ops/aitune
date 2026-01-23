import { NextRequest, NextResponse } from "next/server";
import { TEMPLATES } from "@/lib/templates";

// Request body type
interface GenerateRequest {
  model: string;
  keyword: string;
  description: string;
  language: string;
  tone: string;
  role: string;
  length: string;
  template?: string;
  isContinue?: boolean;
  previousContent?: string;
}

// OpenRouter API response type
interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: GenerateRequest = await request.json();
    const { model, keyword, description, language, tone, role, length, template, isContinue, previousContent } = body;

    // Validate required fields
    if (!model || !keyword || !description) {
      return NextResponse.json(
        { success: false, error: "缺少必填字段" },
        { status: 400 }
      );
    }

    // Validate API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("OPENROUTER_API_KEY is not configured");
      return NextResponse.json(
        { success: false, error: "服务配置错误，请联系管理员" },
        { status: 500 }
      );
    }

    // Map length to max_tokens and word count
    const lengthConfig = {
      short: { maxTokens: 800, wordCount: "300-500字" },
      medium: { maxTokens: 1500, wordCount: "600-1000字" },
      long: { maxTokens: 2500, wordCount: "1200-2000字" },
    };
    const config = lengthConfig[length as keyof typeof lengthConfig] || lengthConfig.medium;

    // Get template-specific prompt suffix if exists
    const selectedTemplate = TEMPLATES.find(t => t.id === template);
    const templateSuffix = selectedTemplate?.promptSuffix || "";

    // Build prompts based on whether it's a continue request
    let systemPrompt: string;
    let userPrompt: string;

    if (isContinue && previousContent) {
      // Continue writing mode
      systemPrompt = `你是${role},用${language}输出,整体语气为${tone}。
你需要基于已有内容进行续写,保持风格和语气的一致性。
续写要求:自然衔接、内容充实、逻辑连贯。`;

      userPrompt = `已有内容：
${previousContent}

请基于以上内容继续写作,补充更多细节、案例或延伸思考。续写长度约${config.wordCount}。`;
    } else {
      // Normal generation mode
      systemPrompt = `你是${role},用${language}输出,整体语气为${tone}。
输出要求:结构清晰、可直接复制使用。
若信息不足,可合理补全,但不要编造具体事实来源。

请按以下格式输出:
1. 标题候选(3个)
2. 内容大纲(分点列出)
3. 正文(${config.wordCount})
4. 结尾总结或行动建议${templateSuffix}`;

      userPrompt = `主题关键词：${keyword}
主题描述：${description}

请基于以上信息生成完整的写作内容。`;
    }

    // Log request (without sensitive data)
    console.log(`[API] Generating content with model: ${model}, template: ${template || 'default'}`);
    console.log(`[API] Keyword length: ${keyword.length}, Description length: ${description.length}`);

    const startTime = Date.now();

    // Call OpenRouter API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout

    let response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "AI Writing Assistant",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: config.maxTokens,
          stream: true, // Enable streaming
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[API] OpenRouter error (${response.status}):`, errorData);

      // Map status codes to user-friendly messages
      let errorMessage = "生成失败，请重试";
      switch (response.status) {
        case 400:
          errorMessage = "请求参数错误";
          break;
        case 401:
        case 403:
          errorMessage = "API 密钥无效或权限不足";
          break;
        case 429:
          errorMessage = "请求过多，请稍后再试";
          break;
        case 502:
        case 504:
          errorMessage = "模型服务连接超时，请重试（免费模型在高峰期可能不稳定）";
          break;
        case 500:
        case 503:
          errorMessage = "服务暂时不可用，请稍后重试";
          break;
      }

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: response.status }
      );
    }

    // Return streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          controller.close();
          return;
        }

        let buffer = ''; // Buffer to accumulate incomplete chunks
        let isClosed = false;

        const enqueueData = (content: string) => {
          if (!isClosed) {
            try {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
            } catch (e) {
              console.error('Failed to enqueue data:', e);
              isClosed = true;
            }
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Split by newlines but keep incomplete lines in buffer
            const lines = buffer.split('\n');

            // Keep the last (potentially incomplete) line in the buffer
            buffer = lines.pop() || '';

            // Process complete lines
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;

              if (trimmedLine.startsWith('data: ')) {
                const data = trimmedLine.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const json = JSON.parse(data);
                  const content = json.choices?.[0]?.delta?.content;

                  if (content) {
                    enqueueData(content);
                  }
                } catch (e) {
                  // Skip invalid JSON (should be rare now with buffering)
                  console.error('Failed to parse SSE data:', e);
                }
              }
            }
          }

          // Process any remaining data in buffer
          if (buffer.trim() && !isClosed) {
            const trimmedLine = buffer.trim();
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6);
              if (data !== '[DONE]') {
                try {
                  const json = JSON.parse(data);
                  const content = json.choices?.[0]?.delta?.content;
                  if (content) {
                    enqueueData(content);
                  }
                } catch (e) {
                  console.error('Failed to parse final SSE data:', e);
                }
              }
            }
          }
        } catch (error) {
          console.error('[API] Stream error:', error);
        } finally {
          if (!isClosed) {
            controller.close();
            isClosed = true;
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("[API] Unexpected error:", error);

    // Handle timeout or network errors
    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        return NextResponse.json(
          { success: false, error: "请求超时，请重试" },
          { status: 504 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "服务器错误，请重试" },
      { status: 500 }
    );
  }
}
