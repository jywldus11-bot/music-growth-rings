// LLM API 适配层 —— OpenAI 兼容协议
// 配置来源：localStorage（由设置面板写入）。未配置时 isConfigured()=false，走模板模式。
// 严禁在此文件硬编码任何密钥。

const LS_KEY = 'gr_llm_config';

export function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveConfig(cfg) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}

export function clearConfig() {
  localStorage.removeItem(LS_KEY);
}

export function isConfigured() {
  const c = getConfig();
  return !!(c && c.baseUrl && c.model);
}

/**
 * 调用 LLM 生成叙事。返回 [{year, text}]。
 * systemPrompt / userPrompt 由 generate.js 构造。
 * 抛错时由调用方降级到模板模式。
 */
export async function chat(systemPrompt, userPrompt) {
  const c = getConfig();
  if (!c || !c.baseUrl || !c.model) throw new Error('LLM not configured');

  const res = await fetch(c.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(c.apiKey ? { Authorization: 'Bearer ' + c.apiKey } : {})
    },
    body: JSON.stringify({
      model: c.model,
      temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!res.ok) throw new Error('LLM HTTP ' + res.status);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM empty response');

  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed.texts)) throw new Error('LLM bad format');
  return parsed.texts;
}
