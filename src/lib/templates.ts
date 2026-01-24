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
  {
    id: "product_description",
    name: "产品描述",
    description: "适合产品功能与规格说明的结构化描述",
    icon: "📦",
    config: {
      language: "中文",
      tone: "专业",
      role: "产品经理",
      length: "medium",
    },
    promptSuffix: `
特别要求：
- 使用结构化小标题：概述/目标用户/核心功能/技术规格/使用场景/限制与注意
- 列出关键参数与指标（如尺寸、性能、兼容性）
- 表述中性客观，避免夸大承诺
- 可附示例场景，帮助读者理解应用方式
- 适当使用列表，便于快速浏览`,
  },
  {
    id: "email_reply",
    name: "邮件回复",
    description: "适合职场邮件往来、清晰礼貌的回复整理",
    icon: "✉️",
    config: {
      language: "中文",
      tone: "正式",
      role: "邮件助理",
      length: "short",
    },
    promptSuffix: `
特别要求：
- 包含称呼与感谢开场（如“您好”、“感谢来信”）
- 按要点分段回复，清晰列出结论/安排/下一步
- 保持礼貌与专业用语，避免冗长与口语化
- 末尾包含致谢与署名，可附联系方式
- 如需行动，请明确时间与责任人`,
  },
  {
    id: "paper_abstract",
    name: "论文摘要",
    description: "适合学术论文的摘要撰写与提炼",
    icon: "📄",
    config: {
      language: "中文",
      tone: "学术",
      role: "学术编辑",
      length: "short",
    },
    promptSuffix: `
特别要求：
- 遵循 IMRaD 结构：背景/方法/结果/结论
- 语言精炼，避免主观形容词与营销化措辞
- 明确研究对象、数据来源、关键发现与意义
- 字数建议 150-300 字，避免引用与过多缩写
- 如需关键词，单独列出 3-5 个`,
  },
];
