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
  stream?: boolean;
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
        { success: false, error: "缺少必填字段", failureType: "code" },
        { status: 400 }
      );
    }

    // Validate API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("OPENROUTER_API_KEY is not configured");
      return NextResponse.json(
        { success: false, error: "服务配置错误，请联系管理员", failureType: "code" },
        { status: 500 }
      );
    }

    const referer = process.env.NEXT_PUBLIC_APP_URL;
    const baseHeaders = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "AI Writing Assistant",
    };
    const headersWithReferer = referer ? { ...baseHeaders, "HTTP-Referer": referer } : baseHeaders;

    // Map length to max_tokens and word count
    const lengthConfig = {
      short: { maxTokens: 1000, wordCount: "300-500字", minChars: 300, maxChars: 500 },
      medium: { maxTokens: 1800, wordCount: "800-1200字", minChars: 800, maxChars: 1200 },
      long: { maxTokens: 2600, wordCount: "1500-2200字", minChars: 1500, maxChars: 2200 },
    };
    const config = lengthConfig[length as keyof typeof lengthConfig] || lengthConfig.medium;
    const requestMaxTokens = (isContinue ? Math.floor((lengthConfig[length as keyof typeof lengthConfig] || lengthConfig.medium).maxTokens * 1.6) : config.maxTokens);

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
续写要求:自然衔接、内容充实、逻辑连贯。
续写以完整性优先,为保证结构与内容的完整,可超过所选长度范围。
所有序号和有序列表使用阿拉伯数字(1,2,3)，不要使用罗马数字。`;

      userPrompt = `已有内容：
${previousContent}

请基于以上内容继续写作,补充更多细节、案例或延伸思考。续写长度以完整性为主,可超过${config.wordCount}。`;
    } else {
      // Normal generation mode
      systemPrompt = `你是${role},用${language}输出,整体语气为${tone}。
输出要求:结构清晰、可直接复制使用。
若信息不足,可合理补全,但不要编造具体事实来源。
严格控制总字数在${config.minChars}-${config.maxChars}字之间,不得超过上限。
所有序号和有序列表使用阿拉伯数字(1,2,3)，不要使用罗马数字。

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

    // Call OpenRouter API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout

    const wantStream = body.stream !== false;
    if (!wantStream) {
      try {
        const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: headersWithReferer,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: requestMaxTokens,
            stream: false,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({}));
          console.error(`[API] OpenRouter error (sync ${resp.status}):`, errorData);
          const upstreamHint = (errorData && (errorData.error || errorData.message)) as string | undefined;
          if ([429, 500, 502, 503, 504, 403, 404].includes(resp.status)) {
            const kw = keyword;
            const desc = description;
            const lc = language;
            let stub = "";
            let failureType = "unknown";
            switch (resp.status) {
              case 400:
                failureType = "code";
                break;
              case 401:
              case 403:
                failureType = "code";
                break;
              case 404:
                failureType = "code";
                break;
              case 429:
                failureType = "API";
                break;
              case 502:
              case 504:
              case 500:
              case 503:
                failureType = "API";
                break;
            }
            if (lc === "English") {
              stub =
                `Notice: This is locally generated fallback content due to remote generation failure or rate limit. For reference only.\n\n` +
                `1. Title Candidates\n` +
                `1. ${kw}: Key Points and Practice\n` +
                `2. ${kw} Strategy Guide\n` +
                `3. ${kw} Case Notes\n\n` +
                `2. Outline\n` +
                `1. Background and Goals\n` +
                `2. Key Points\n` +
                `3. Cases and Practice\n` +
                `4. Risks and Measures\n` +
                `5. Summary\n\n` +
                `3. Body (${config.wordCount})\n` +
                `${kw} — ${desc}\n\n` +
                `4. Conclusion\n`;
            } else if (lc === "日本語") {
              stub =
                `注意：これは生成失敗・レート制限時のローカルフォールバックです。参考用。\n\n` +
                `1. タイトル候補\n` +
                `1. ${kw}の要点と実践\n` +
                `2. ${kw}戦略ガイド\n` +
                `3. ${kw}ケースメモ\n\n` +
                `2. アウトライン\n` +
                `1. 背景と目的\n` +
                `2. 重要ポイント\n` +
                `3. 事例と実践\n` +
                `4. リスクと対策\n` +
                `5. まとめ\n\n` +
                `3. 本文（${config.wordCount}）\n` +
                `${kw} — ${desc}\n\n` +
                `4. 結論\n`;
            } else {
              stub =
                `提示：当前内容为生成失败后的兜底内容（本地生成），仅供参考。\n\n` +
                `1. 标题候选\n` +
                `1. ${kw}：核心要点与实践\n` +
                `2. ${kw}应用攻略\n` +
                `3. ${kw}策略笔记\n\n` +
                `2. 内容大纲\n` +
                `1. 背景与目标\n` +
                `2. 关键观点\n` +
                `3. 案例与实践\n` +
                `4. 风险与对策\n` +
                `5. 总结\n\n` +
                `3. 正文（${config.wordCount}）\n` +
                `${kw} — ${desc}\n\n` +
                `4. 结尾总结\n`;
            }
            return NextResponse.json(
              { success: true, content: stub, meta: { source: "local_fallback", failureType } },
              { status: 200, headers: { "X-Source": "local_fallback", "X-Failure-Type": failureType } }
            );
          }
          let errorMessage = "生成失败，请重试";
          let failureType = "unknown";
          switch (resp.status) {
            case 400:
              errorMessage = "请求参数错误";
              failureType = "code";
              break;
            case 401:
            case 403:
              errorMessage = "API 密钥无效或权限不足";
              failureType = "code";
              break;
            case 404:
              errorMessage = "模型不可用或名称变更，请更换模型";
              failureType = "code";
              break;
            case 429:
              errorMessage = "请求过多，请稍后再试";
              failureType = "API";
              break;
            case 502:
            case 504:
              errorMessage = "模型服务连接超时，请重试";
              failureType = "API";
              break;
            case 500:
            case 503:
              errorMessage = "服务暂时不可用，请稍后重试";
              failureType = "API";
              break;
          }
          if (upstreamHint) {
            errorMessage = `${errorMessage}（详情：${upstreamHint}）`;
          }
          return NextResponse.json(
            { success: false, error: errorMessage, failureType },
            { status: resp.status, headers: { "X-Source": "upstream_sync_error", "X-Failure-Type": failureType } }
          );
        }
        const data: OpenRouterResponse = await resp.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          return NextResponse.json(
            { success: false, error: "生成结果为空，请重试", failureType: "API" },
            { status: 500 }
          );
        }
        return NextResponse.json({ success: true, content }, { status: 200, headers: { "X-Source": "upstream_sync" } });
      } catch (e) {
        clearTimeout(timeoutId);
        console.error(`[API] Sync generation error:`, e);
        return NextResponse.json(
          { success: false, error: "生成失败，请重试", failureType: "code" },
          { status: 500 }
        );
      }
    }

    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: headersWithReferer,
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: requestMaxTokens,
          stream: true,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[API] OpenRouter error (${response.status}):`, errorData);
      // If still not ok after trying fallbacks, return mapped error
      if (!response.ok) {
        const kw = keyword;
        const desc = description;
        const lc = language;
        let stub = "";
        let failureType = "unknown";
        switch (response.status) {
          case 400:
            failureType = "code";
            break;
          case 401:
          case 403:
            failureType = "code";
            break;
          case 404:
            failureType = "code";
            break;
          case 429:
            failureType = "API";
            break;
          case 502:
          case 504:
          case 500:
          case 503:
            failureType = "API";
            break;
        }
        const upstreamHint = (errorData && (errorData.error || errorData.message)) as string | undefined;
        if (lc === "English") {
          stub =
            `Notice: This is locally generated fallback content due to remote generation failure or rate limit. For reference only.\n\n` +
            `1. Title Candidates\n` +
            `1. ${kw}: Key Points and Practice\n` +
            `2. ${kw} Strategy Guide\n` +
            `3. ${kw} Case Notes\n\n` +
            `2. Outline\n` +
            `1. Background and Goals\n` +
            `2. Key Points\n` +
            `3. Cases and Practice\n` +
            `4. Risks and Measures\n` +
            `5. Summary\n\n` +
            `3. Body (${config.wordCount})\n` +
            `${kw} — ${desc}\n\n` +
            `4. Conclusion\n`;
        } else if (lc === "日本語") {
          stub =
            `注意：これは生成失敗・レート制限時のローカルフォールバックです。参考用。\n\n` +
            `1. タイトル候補\n` +
            `1. ${kw}の要点と実践\n` +
            `2. ${kw}戦略ガイド\n` +
            `3. ${kw}ケースメモ\n\n` +
            `2. アウトライン\n` +
            `1. 背景と目的\n` +
            `2. 重要ポイント\n` +
            `3. 事例と実践\n` +
            `4. リスクと対策\n` +
            `5. まとめ\n\n` +
            `3. 本文（${config.wordCount}）\n` +
            `${kw} — ${desc}\n\n` +
            `4. 結論\n`;
        } else {
          stub =
            `提示：当前内容为生成失败后的兜底内容（本地生成），仅供参考。\n\n` +
            `1. 标题候选\n` +
            `1. ${kw}：核心要点与实践\n` +
            `2. ${kw}应用攻略\n` +
            `3. ${kw}策略笔记\n\n` +
            `2. 内容大纲\n` +
            `1. 背景与目标\n` +
            `2. 关键观点\n` +
            `3. 案例与实践\n` +
            `4. 风险与对策\n` +
            `5. 总结\n\n` +
            `3. 正文（${config.wordCount}）\n` +
            `${kw} — ${desc}\n\n` +
            `4. 结尾总结\n`;
        }
        const stream = new ReadableStream({
          async start(controller) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: stub, meta: { source: "local_fallback_stream", failureType, status: response.status, errorMessage: upstreamHint } })}\n\n`));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Failure-Type': failureType,
          },
        });
      }
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
        let hasEmitted = false; // Track whether any content has been sent to client

        const enqueueData = (content: string) => {
          if (!isClosed) {
            try {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
              hasEmitted = true;
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
                  const choice = json.choices?.[0];
                  const content =
                    choice?.delta?.content ??
                    choice?.message?.content ??
                    choice?.content ??
                    choice?.text;

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
                  const choice = json.choices?.[0];
                  const content =
                    choice?.delta?.content ??
                    choice?.message?.content ??
                    choice?.content ??
                    choice?.text;
                  if (content) {
                    enqueueData(content);
                  }
                } catch (e) {
                  console.error('Failed to parse final SSE data:', e);
                }
              }
            }
          }

          // Fallback: if nothing was emitted, perform a non-stream request and emit once
          if (!hasEmitted && !isClosed) {
            try {
              const resp2 = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: headersWithReferer,
                body: JSON.stringify({
                  model,
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                  ],
                  temperature: 0.7,
                  max_tokens: requestMaxTokens,
                  stream: false,
                }),
              });
              if (resp2.ok) {
                const data2: OpenRouterResponse = await resp2.json();
                const content2 = data2.choices?.[0]?.message?.content;
                if (content2) {
                  enqueueData(content2);
                }
              } else {
                console.error(`[API] Fallback non-stream failed: ${resp2.status}`);
              }
            } catch (e) {
              console.error('[API] Fallback non-stream error:', e);
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
          { success: false, error: "请求超时，请重试", failureType: "API" },
          { status: 504 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "服务器错误，请重试", failureType: "code" },
      { status: 500 }
    );
  }
}
