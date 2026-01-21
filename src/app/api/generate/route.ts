import { NextRequest, NextResponse } from "next/server";

// Request body type
interface GenerateRequest {
  model: string;
  keyword: string;
  description: string;
  language: string;
  tone: string;
  role: string;
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
    const { model, keyword, description, language, tone, role } = body;

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

    // Build system prompt
    const systemPrompt = `你是${role}，用${language}输出，整体语气为${tone}。
输出要求：结构清晰、可直接复制使用。
若信息不足，可合理补全，但不要编造具体事实来源。

请按以下格式输出：
1. 标题候选（3个）
2. 内容大纲（分点列出）
3. 正文（600-1000字）
4. 结尾总结或行动建议`;

    // Build user prompt
    const userPrompt = `主题关键词：${keyword}
主题描述：${description}

请基于以上信息生成完整的写作内容。`;

    // Log request (without sensitive data)
    console.log(`[API] Generating content with model: ${model}`);
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
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const duration = Date.now() - startTime;

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

    const data: OpenRouterResponse = await response.json();

    // Check for error in response body (OpenRouter sometimes returns 200 with error)
    if ('error' in data && (data as any).error) {
      const error = (data as any).error;
      console.error("[API] OpenRouter returned error:", error);

      let errorMessage = "生成失败，请重试";
      if (error.code === 502 || error.message?.includes('Network connection lost')) {
        errorMessage = "网络连接中断，请重试（免费模型在高峰期可能不稳定）";
      }

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }

    // Extract generated text
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      console.error("[API] No content in response:", data);
      return NextResponse.json(
        { success: false, error: "模型未返回内容，请调整描述或重试" },
        { status: 500 }
      );
    }

    // Log success
    console.log(`[API] Success in ${duration}ms, tokens: ${data.usage?.total_tokens || 'N/A'}`);

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        text: text,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
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
