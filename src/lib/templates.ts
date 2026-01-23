// Content templates for different scenarios

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: {
    language: string;
    tone: string;
    role: string;
    length: string;
  };
  promptSuffix?: string; // Additional instructions for this template
}

export const TEMPLATES: Template[] = [
  {
    id: "default",
    name: "通用写作",
    description: "适用于各类通用写作场景",
    icon: "📝",
    config: {
      language: "中文",
      tone: "正式",
      role: "资深写作助手",
      length: "medium",
    },
  },
  {
    id: "xiaohongshu",
    name: "小红书",
    description: "适合小红书平台的种草/分享风格",
    icon: "🎀",
    config: {
      language: "中文",
      tone: "轻松",
      role: "小红书博主",
      length: "short",
    },
    promptSuffix: `
特别要求：
- 使用emoji表情增加活力
- 标题要吸引眼球，可以使用数字、疑问句
- 内容要真实、接地气，像朋友聊天
- 适当使用"姐妹们"、"宝子们"等亲切称呼
- 结尾可以引导互动（点赞、收藏、评论）`,
  },
  {
    id: "wechat",
    name: "公众号",
    description: "适合微信公众号的深度文章",
    icon: "💬",
    config: {
      language: "中文",
      tone: "专业",
      role: "公众号作者",
      length: "long",
    },
    promptSuffix: `
特别要求：
- 标题要有吸引力和传播性
- 开头要有引人入胜的故事或金句
- 内容要有深度和价值，逻辑清晰
- 适当使用小标题分段，便于阅读
- 结尾可以有思考或行动建议`,
  },
  {
    id: "zhihu",
    name: "知乎",
    description: "适合知乎的专业问答风格",
    icon: "💡",
    config: {
      language: "中文",
      tone: "专业",
      role: "知乎答主",
      length: "medium",
    },
    promptSuffix: `
特别要求：
- 开头直接回答问题，给出核心观点
- 提供数据、案例或专业分析支撑观点
- 逻辑严谨，层次分明
- 可以适当使用专业术语，但要解释清楚
- 保持客观理性的态度`,
  },
  {
    id: "weibo",
    name: "微博",
    description: "适合微博的简短快讯风格",
    icon: "📱",
    config: {
      language: "中文",
      tone: "轻松",
      role: "微博博主",
      length: "short",
    },
    promptSuffix: `
特别要求：
- 内容简洁有力，控制在200字以内
- 开头要抓眼球，可以用热点话题
- 适当使用话题标签 #话题#
- 可以使用emoji增加趣味性
- 语言要口语化、接地气`,
  },
  {
    id: "marketing",
    name: "营销文案",
    description: "适合产品推广和营销场景",
    icon: "🎯",
    config: {
      language: "中文",
      tone: "说服型",
      role: "营销文案专家",
      length: "medium",
    },
    promptSuffix: `
特别要求：
- 突出产品/服务的核心卖点和优势
- 使用AIDA模型（注意-兴趣-欲望-行动）
- 强调用户痛点和解决方案
- 包含明确的行动号召（CTA）
- 使用数字和具体案例增强说服力`,
  },
];
