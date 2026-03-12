import { useState, useEffect, useRef } from "react";

const CLAUDE_API = "/api/claude";

// ── Prompts ──────────────────────────────────────────────────────────────────

const FREE_PROMPT = `You are an AEO/GEO expert. Do a QUICK diagnosis (under 30 seconds worth of output).
Return ONLY this raw JSON (no markdown, no backticks):
{
  "pageTitle": "string",
  "overallScore": 64,
  "grade": "C",
  "scores": { "clarity": 70, "authority": 55, "structure": 65, "eeat": 50, "naturalLanguage": 75, "brandMention": 45 },
  "topIssues": [
    {"severity": "high", "category": "권위성", "description": "통계나 수치 데이터가 없어 AI가 인용하기 어렵습니다.", "fix": "구체적인 수치와 출처를 첫 단락에 추가하세요."},
    {"severity": "medium", "category": "구조화", "description": "FAQ 섹션이 없어 AI 답변 추출이 어렵습니다.", "fix": "페이지 하단에 Q&A 형식의 FAQ를 추가하세요."},
    {"severity": "low", "category": "명확성", "description": "핵심 답변이 문서 중반부에 위치합니다.", "fix": "첫 문장에 핵심 답변을 배치하세요."}
  ],
  "quickWins": ["첫 문장에 정의 추가", "통계 1~2개 삽입", "FAQ 3개 추가"]
}
ALL description and fix fields must be in Korean. grade is A/B/C/D/F.`;

const PRO_PROMPT = `You are an AEO/GEO expert. Do a DEEP, thorough analysis.
Return ONLY this raw JSON (no markdown, no backticks):
{
  "pageTitle": "string",
  "overallScore": 64,
  "grade": "C",
  "scores": { "clarity": 70, "authority": 55, "structure": 65, "eeat": 50, "naturalLanguage": 75, "brandMention": 45 },
  "issues": [
    {"severity": "high", "category": "권위성", "description": "통계나 수치 데이터가 없어 AI가 신뢰하기 어렵습니다.", "fix": "연구 결과나 업계 통계를 구체적인 수치와 함께 인용하세요."},
    {"severity": "medium", "category": "구조화", "description": "Schema.org 마크업이 누락되어 있습니다.", "fix": "Article 또는 FAQPage 스키마를 페이지에 추가하세요."},
    {"severity": "medium", "category": "E-E-A-T", "description": "저자 정보와 전문성 신호가 없습니다.", "fix": "저자 약력, 자격증, 경력을 페이지에 명시하세요."},
    {"severity": "low", "category": "자연어", "description": "사용자가 실제로 묻는 방식의 질문형 헤딩이 부족합니다.", "fix": "H2/H3 헤딩을 '~란 무엇인가?', '~하는 방법은?' 형태로 변경하세요."}
  ],
  "optimizedContent": "Rewritten full optimized version of the content in the same language as input...",
  "keyChanges": ["핵심 답변을 첫 문장에 배치했습니다", "통계 3개를 추가했습니다", "FAQ 섹션을 신설했습니다", "헤딩을 질문형으로 변환했습니다"],
  "aiCitationTips": ["Perplexity: 정의형 문장으로 시작", "ChatGPT: 숫자·통계 강조", "Gemini: FAQ 구조 최적화"],
  "competitorGap": "경쟁사 대비 E-E-A-T 점수가 낮습니다. 저자 신뢰도 강화가 시급합니다."
}
ALL Korean fields (description, fix, keyChanges, aiCitationTips, competitorGap) must be in Korean.`;

const FETCH_PROMPT = `You are a web content extractor. Use web_search to fetch the URL and extract its main content.
Return ONLY raw JSON (no markdown, no backticks):
{"title": "page title", "content": "main article text and headings, no nav/footer/ads, max 3000 chars"}`;

const categoryInfo = {
  clarity: {
    label: "명확성", icon: "◎",
    desc: "직접적 답변 구조",
    tooltip: "AI가 콘텐츠를 인용할 때 가장 먼저 보는 요소입니다.\n첫 문장에 핵심 답변이 있는지, 역피라미드 구조로 결론이 앞에 오는지를 평가합니다.\n정의·요약 문장이 명확할수록 ChatGPT·Perplexity의 직접 인용 확률이 높아집니다.",
    tip: "첫 문장 = 핵심 답변",
    color: "#6366f1",
  },
  authority: {
    label: "권위성", icon: "★",
    desc: "데이터·출처·전문성",
    tooltip: "AI 모델은 신뢰할 수 있는 출처를 우선 인용합니다.\n구체적인 통계 수치, 연구 논문 인용, 전문가 코멘트가 있을수록 점수가 높아집니다.\n'약 70%', '2024년 연구에 따르면' 같은 표현이 권위 신호로 작동합니다.",
    tip: "수치·연구·전문가 인용",
    color: "#f59e0b",
  },
  structure: {
    label: "구조화", icon: "▤",
    desc: "Schema·헤딩·FAQ",
    tooltip: "AI가 콘텐츠를 파싱하기 쉬운 구조인지를 평가합니다.\nSchema.org 마크업(FAQPage, Article), 명확한 H2/H3 헤딩, Q&A 포맷이 구조화 점수를 높입니다.\n구조화된 데이터는 Gemini·Bing AI 인용에 특히 효과적입니다.",
    tip: "FAQ + Schema 마크업",
    color: "#10b981",
  },
  eeat: {
    label: "E-E-A-T", icon: "✦",
    desc: "경험·전문성·신뢰",
    tooltip: "Google이 제시한 콘텐츠 품질 기준으로, AI 인용에도 동일하게 적용됩니다.\nExperience(경험), Expertise(전문성), Authoritativeness(권위), Trustworthiness(신뢰)의 약자입니다.\n저자 소개, 자격증, 실제 사용 경험, 업데이트 날짜 등이 신호로 작동합니다.",
    tip: "저자 정보·자격·경력 명시",
    color: "#8b5cf6",
  },
  naturalLanguage: {
    label: "자연어", icon: "◈",
    desc: "대화형·질문 매칭",
    tooltip: "사람들이 AI에게 실제로 질문하는 방식과 콘텐츠가 얼마나 일치하는지를 평가합니다.\n'~란 무엇인가요?', '~하는 방법은?' 같은 질문형 헤딩과 대화체 문장이 유리합니다.\n긴 꼬리 키워드(Long-tail)를 자연스럽게 포함할수록 AI 매칭 확률이 높아집니다.",
    tip: "질문형 헤딩·대화체",
    color: "#06b6d4",
  },
  brandMention: {
    label: "브랜드 언급", icon: "◉",
    desc: "확산성·인용 가능성",
    tooltip: "AI 학습 데이터와 실시간 검색에서 브랜드·콘텐츠가 얼마나 언급되는지를 평가합니다.\nReddit, Quora, 뉴스, 포럼 등 다양한 플랫폼에서의 언급이 많을수록 AI가 신뢰하는 출처로 인식합니다.\n공유하기 쉬운 콘텐츠 형태(인포그래픽, 통계 정리)가 언급 가능성을 높입니다.",
    tip: "멀티플랫폼 언급·공유",
    color: "#ec4899",
  },
};

const severityColor = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" };
const severityLabel = { high: "높음", medium: "중간", low: "낮음" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractJson(raw) {
  const s = raw.replace(/```json|```/g, "").trim();
  const a = s.indexOf("{");
  if (a === -1) throw new Error("JSON을 찾을 수 없습니다");
  const b = s.lastIndexOf("}");
  if (b !== -1) { try { return JSON.parse(s.slice(a, b + 1)); } catch (_) {} }
  let fragment = s.slice(a);
  const lastQuote = fragment.lastIndexOf('"');
  const lastSep = Math.max(fragment.lastIndexOf(","), fragment.lastIndexOf(":"));
  if (lastQuote > lastSep) fragment += '"';
  let braces = 0, brackets = 0, inStr = false;
  for (let i = 0; i < fragment.length; i++) {
    const c = fragment[i];
    if (c === '"' && fragment[i - 1] !== "\\") inStr = !inStr;
    if (inStr) continue;
    if (c === "{") braces++; else if (c === "}") braces--;
    else if (c === "[") brackets++; else if (c === "]") brackets--;
  }
  fragment = fragment.replace(/,\s*"[^"]*"?\s*:\s*[^,}\]]*$/, "").replace(/,\s*"[^"]*"?\s*$/, "");
  while (brackets > 0) { fragment += "]"; brackets--; }
  while (braces > 0) { fragment += "}"; braces--; }
  return JSON.parse(fragment);
}

async function callClaude({ system, userMessage, useWebSearch = false, maxTokens = 4000 }) {
  const tools = useWebSearch ? [{ type: "web_search_20250305", name: "web_search" }] : undefined;
  let messages = [{ role: "user", content: userMessage }];
  for (let i = 0; i < 8; i++) {
    const body = { model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system, messages };
    if (tools) body.tools = tools;
    const res = await fetch(CLAUDE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
    const data = await res.json();
    const content = data.content || [];
    const textBlocks = content.filter(b => b.type === "text").map(b => b.text);
    const toolUse = content.filter(b => b.type === "tool_use");
    if (toolUse.length === 0 || data.stop_reason === "end_turn") return textBlocks.join("");
    messages = [...messages, { role: "assistant", content },
      { role: "user", content: toolUse.map(tu => ({ type: "tool_result", tool_use_id: tu.id, content: "Search done. Now return the JSON." })) }];
  }
  throw new Error("반복 횟수 초과");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 110 }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }} />
      <text x="50" y="45" textAnchor="middle" fill={color} fontSize="17" fontWeight="800" fontFamily="system-ui">{score}</text>
      <text x="50" y="59" textAnchor="middle" fill="#9ca3af" fontSize="8" fontFamily="system-ui">/ 100</text>
    </svg>
  );
}

function MiniBar({ score }) {
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ background: "#f3f4f6", borderRadius: 4, height: 5, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 4, transition: "width 1.1s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

function Tooltip({ text, color = "#6366f1" }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const iconRef = useRef(null);

  function show() {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    // Position tooltip below the icon, centered
    setPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
    setVisible(true);
  }

  return (
    <>
      <span
        ref={iconRef}
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 15, height: 15, borderRadius: "50%",
          background: `${color}18`, border: `1px solid ${color}44`,
          color: color, fontSize: 9, fontWeight: 800,
          cursor: "help", flexShrink: 0, userSelect: "none",
          transition: "background 0.15s",
        }}
        onMouseEnterCapture={e => { e.currentTarget.style.background = `${color}30`; }}
      >?</span>

      {visible && (
        <div style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          transform: "translateX(-50%)",
          zIndex: 9999,
          background: "#1e1e2e",
          color: "#e2e8f0",
          fontSize: 12,
          lineHeight: 1.65,
          padding: "12px 15px",
          borderRadius: 10,
          maxWidth: 280,
          boxShadow: "0 8px 32px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.06)",
          whiteSpace: "pre-line",
          pointerEvents: "none",
        }}>
          {/* Arrow */}
          <div style={{
            position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderBottom: "6px solid #1e1e2e",
          }} />
          {text}
        </div>
      )}
    </>
  );
}

function ProgressBar({ pct, label, eta }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {eta !== null && <span style={{ fontSize: 12, color: "#9ca3af" }}>약 {eta}초 남음</span>}
          <span style={{ fontSize: 20, fontWeight: 800, color: "#111827", fontVariantNumeric: "tabular-nums", minWidth: 48, textAlign: "right" }}>{pct}%</span>
        </div>
      </div>
      <div style={{ background: "#e5e7eb", borderRadius: 8, height: 10, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#3b82f6,#6366f1)", borderRadius: 8, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function PlanBadge({ plan }) {
  const isPro = plan === "pro";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
      borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: isPro ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#f3f4f6",
      color: isPro ? "#fff" : "#6b7280", border: isPro ? "none" : "1px solid #e5e7eb"
    }}>
      {isPro ? "✦ PRO" : "FREE"}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AEOOptimizer() {
  const [plan, setPlan] = useState("free");        // "free" | "pro"
  const [inputMode, setInputMode] = useState("url");
  const [url, setUrl] = useState("");
  const [textContent, setTextContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [eta, setEta] = useState(null);
  const [result, setResult] = useState(null);
  const [fetchedTitle, setFetchedTitle] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("issues");
  const [copied, setCopied] = useState(false);
  const [animated, setAnimated] = useState(false);
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const targetDurationRef = useRef(60);

  useEffect(() => {
    if (result) setTimeout(() => setAnimated(true), 80);
    else setAnimated(false);
  }, [result]);

  // Smooth progress ticker
  function startProgress(targetPct, label, durationSec) {
    if (timerRef.current) clearInterval(timerRef.current);
    startRef.current = Date.now();
    targetDurationRef.current = durationSec;
    setProgressLabel(label);
    setProgress(prev => prev);
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const frac = Math.min(elapsed / durationSec, 1);
      const eased = 1 - Math.pow(1 - frac, 2); // ease-out quad
      setProgress(prev => {
        const next = Math.round(prev + (targetPct - prev) * eased);
        return Math.min(next, targetPct);
      });
      const remaining = Math.max(0, Math.round(durationSec - elapsed));
      setEta(remaining);
    }, 400);
  }

  function stopProgress() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function runAnalysis(content, title, sourceUrl) {
    const isFree = plan === "free";
    const prompt = isFree ? FREE_PROMPT : PRO_PROMPT;
    const maxTokens = isFree ? 2000 : 5000;
    const raw = await callClaude({
      system: prompt,
      userMessage: `분석 대상:\n\n제목: ${title}\n${sourceUrl ? `URL: ${sourceUrl}\n` : ""}내용:\n${content}`,
      maxTokens,
    });
    return extractJson(raw);
  }

  async function analyze() {
    const isUrl = inputMode === "url";
    const target = isUrl ? url.trim() : textContent.trim();
    if (!target) { setError(isUrl ? "URL을 입력해주세요." : "콘텐츠를 입력해주세요."); return; }

    setLoading(true); setError(""); setResult(null); setAnimated(false); setProgress(0); setEta(null);

    // Total target time: 60 seconds
    // Free: URL→fetch(20s)+analyze(15s) = 35s; text→analyze(15s)
    // Pro:  URL→fetch(20s)+analyze(35s) = 55s; text→analyze(35s)
    const isFree = plan === "free";
    const fetchDur = 22;
    const analyzeDur = isFree ? 12 : 32;

    try {
      let pageContent = target, pageTitle = target;

      if (isUrl) {
        let cleanUrl = target;
        if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = "https://" + cleanUrl;

        // Phase 1: fetch
        startProgress(40, "웹페이지 접속 및 콘텐츠 추출 중...", fetchDur);
        const fetchedRaw = await callClaude({
          system: FETCH_PROMPT,
          userMessage: `이 URL의 콘텐츠를 추출해주세요: ${cleanUrl}`,
          useWebSearch: true,
          maxTokens: 3000,
        });
        let pageData = { title: cleanUrl, content: fetchedRaw };
        try { pageData = extractJson(fetchedRaw); } catch (_) { pageData.content = fetchedRaw.slice(0, 3000); }
        pageContent = pageData.content;
        pageTitle = pageData.title || cleanUrl;
        setFetchedTitle(pageTitle);

        // Phase 2: analyze
        startProgress(95, isFree ? "빠른 진단 중..." : "정밀 분석 중...", analyzeDur);
        const parsed = await runAnalysis(pageContent, pageTitle, cleanUrl);
        stopProgress(); setProgress(100); setEta(0);
        setResult(parsed);
      } else {
        startProgress(95, isFree ? "빠른 진단 중..." : "정밀 분석 중...", analyzeDur);
        const parsed = await runAnalysis(pageContent, "직접 입력 콘텐츠", "");
        stopProgress(); setProgress(100); setEta(0);
        setResult(parsed);
      }
    } catch (e) {
      stopProgress();
      setError(`오류: ${e.message || "분석에 실패했습니다. 다시 시도해주세요."}`);
    }
    setLoading(false);
  }

  function copyOptimized() {
    const text = result?.optimizedContent;
    if (text) { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  const issues = result?.issues || result?.topIssues || [];
  const gradeColor = { A: "#10b981", B: "#3b82f6", C: "#f59e0b", D: "#f97316", F: "#ef4444" };

  // ── Render ──
  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui,-apple-system,sans-serif", color: "#111827" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#3b82f6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>AEO / GEO Optimizer</div>
            <div style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 1 }}>AI ANSWER ENGINE OPTIMIZATION</div>
          </div>
        </div>

        {/* Plan toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f3f4f6", borderRadius: 10, padding: 4 }}>
          {[["free", "⚡ 무료 진단"], ["pro", "✦ 정밀 진단 PRO"]].map(([p, label]) => (
            <button key={p} onClick={() => setPlan(p)} style={{
              padding: "7px 16px", fontSize: 12, fontWeight: plan === p ? 700 : 500,
              background: plan === p ? (p === "pro" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#fff") : "transparent",
              color: plan === p ? (p === "pro" ? "#fff" : "#111827") : "#6b7280",
              border: plan === p ? (p === "free" ? "1px solid #e5e7eb" : "none") : "none",
              borderRadius: 8, cursor: "pointer", transition: "all 0.2s",
              boxShadow: plan === p && p === "free" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Plan info bar */}
      <div style={{ background: plan === "pro" ? "linear-gradient(90deg,#eef2ff,#f5f3ff)" : "#eff6ff", borderBottom: "1px solid", borderColor: plan === "pro" ? "#c7d2fe" : "#bfdbfe", padding: "8px 32px", display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
        <PlanBadge plan={plan} />
        {plan === "free"
          ? <span style={{ color: "#1d4ed8" }}>빠른 핵심 진단 · 상위 3개 문제점 · 즉시 개선 팁 제공 <span style={{ color: "#6b7280" }}>— 약 15~30초 소요</span></span>
          : <span style={{ color: "#4338ca" }}>전체 항목 정밀 분석 · 최적화 콘텐츠 자동 생성 · AI별 인용 전략 · 경쟁사 격차 분석 <span style={{ color: "#6b7280" }}>— 약 40~60초 소요</span></span>
        }
      </div>

      <div style={{ display: "grid", gridTemplateColumns: result ? "400px 1fr" : "1fr", minHeight: "calc(100vh - 108px)" }}>

        {/* ── Input Panel ── */}
        <div style={{ padding: 28, background: "#fff", borderRight: result ? "1px solid #e5e7eb" : "none", boxSizing: "border-box", maxWidth: result ? 400 : 560, margin: result ? 0 : "0 auto", width: "100%" }}>

          {/* Input mode tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#f3f4f6", borderRadius: 10, padding: 4 }}>
            {[["url", "🌐  URL 입력"], ["text", "📄  직접 입력"]].map(([mode, label]) => (
              <button key={mode} onClick={() => { setInputMode(mode); setError(""); setResult(null); }} style={{
                flex: 1, padding: "8px 0", fontSize: 12, fontWeight: inputMode === mode ? 700 : 500,
                background: inputMode === mode ? "#fff" : "transparent",
                color: inputMode === mode ? "#111827" : "#6b7280",
                border: inputMode === mode ? "1px solid #e5e7eb" : "none",
                borderRadius: 8, cursor: "pointer", boxShadow: inputMode === mode ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.2s"
              }}>{label}</button>
            ))}
          </div>

          {inputMode === "url" ? (
            <>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>웹사이트 URL</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔗</span>
                <input value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !loading && analyze()}
                  placeholder="https://example.com/your-page"
                  style={{ width: "100%", padding: "11px 12px 11px 36px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, color: "#111827", fontSize: 13, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                  onFocus={e => e.target.style.borderColor = "#6366f1"}
                  onBlur={e => e.target.style.borderColor = "#e5e7eb"} />
              </div>
              <p style={{ marginTop: 6, fontSize: 11, color: "#9ca3af" }}>※ AI가 해당 페이지를 직접 방문해 콘텐츠를 추출합니다</p>
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>분석할 콘텐츠</label>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{textContent.length}자</span>
              </div>
              <textarea value={textContent} onChange={e => setTextContent(e.target.value)}
                placeholder={"분석할 콘텐츠를 입력하세요...\n\n예: 블로그 포스트, 제품 설명, 서비스 소개"}
                style={{ width: "100%", minHeight: 180, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 13, color: "#111827", fontSize: 13, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                onFocus={e => e.target.style.borderColor = "#6366f1"}
                onBlur={e => e.target.style.borderColor = "#e5e7eb"} />
            </>
          )}

          {/* Progress */}
          {loading && (
            <div style={{ marginTop: 20, padding: "18px 20px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12 }}>
              <ProgressBar pct={progress} label={progressLabel} eta={progress < 100 ? eta : null} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["URL 접속", "콘텐츠 추출", "AI 분석", "결과 생성"].map((step, i) => {
                  const stepPct = [10, 40, 70, 95][i];
                  const done = progress >= stepPct + 15;
                  const active = progress >= stepPct && !done;
                  return (
                    <div key={step} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: done ? "#10b981" : active ? "#6366f1" : "#d1d5db", fontWeight: active ? 700 : 400 }}>
                      <span>{done ? "✓" : active ? "▶" : "○"}</span> {step}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#ef4444", lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          {!loading && (
            <button onClick={analyze} style={{
              marginTop: 16, width: "100%", padding: "13px 0",
              background: plan === "pro" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "linear-gradient(135deg,#3b82f6,#6366f1)",
              border: "none", borderRadius: 10, color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 14px rgba(99,102,241,0.35)", transition: "all 0.2s"
            }}>
              {plan === "free" ? "⚡ 무료 진단 시작" : "✦ 정밀 분석 시작 (PRO)"}
            </button>
          )}

          {/* Tips */}
          {!loading && (
            <div style={{ marginTop: 20, padding: 16, background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, marginBottom: 10 }}>AEO 핵심 체크포인트</div>
              {[["◎","첫 문장에 핵심 답변 배치"],["★","통계·수치·출처 포함"],["▤","FAQ 형식 질문 추가"],["✦","저자·전문성 신호 명시"]].map(([icon, tip]) => (
                <div key={tip} style={{ display: "flex", gap: 8, marginBottom: 7, fontSize: 12, color: "#6b7280", alignItems: "center" }}>
                  <span style={{ color: "#6366f1" }}>{icon}</span>{tip}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Result Panel ── */}
        {result && (
          <div style={{ padding: 28, background: "#f9fafb", overflowY: "auto" }}>

            {/* Page title + plan badge */}
            {(result.pageTitle || fetchedTitle) && (
              <div style={{ marginBottom: 16, padding: "8px 14px", background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280", display: "flex", gap: 8, alignItems: "center" }}>
                <span>🌐</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{result.pageTitle || fetchedTitle}</span>
                <PlanBadge plan={plan} />
              </div>
            )}

            {/* Score row */}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, marginBottom: 20, padding: 22, background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <ScoreRing score={animated ? result.overallScore : 0} size={110} />
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
                <div style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 1, fontWeight: 600 }}>종합 AEO 점수</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: "#111827" }}>{result.overallScore}</span>
                  {result.grade && (
                    <span style={{ fontSize: 26, fontWeight: 900, color: gradeColor[result.grade] || "#6b7280", border: `2px solid ${gradeColor[result.grade] || "#e5e7eb"}`, borderRadius: 8, padding: "0 10px", lineHeight: 1.5 }}>{result.grade}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  AI 인용 가능성: <span style={{ color: result.overallScore >= 75 ? "#10b981" : result.overallScore >= 50 ? "#f59e0b" : "#ef4444", fontWeight: 700 }}>
                    {result.overallScore >= 75 ? "높음" : result.overallScore >= 50 ? "중간" : "낮음"}
                  </span>
                </div>
                {result.competitorGap && plan === "pro" && (
                  <div style={{ fontSize: 11, color: "#6b7280", background: "#f9fafb", padding: "5px 10px", borderRadius: 6, border: "1px solid #e5e7eb" }}>💡 {result.competitorGap}</div>
                )}
              </div>
            </div>

            {/* Category scores */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 20 }}>
              {Object.entries(result.scores || {}).map(([key, score]) => {
                const info = categoryInfo[key];
                return (
                  <div key={key} style={{ padding: "11px 13px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: info?.color || "#6366f1", fontSize: 12 }}>{info?.icon}</span>
                        <span style={{ fontSize: 11, color: "#374151", fontWeight: 700 }}>{info?.label}</span>
                        {info?.tooltip && <Tooltip text={info.tooltip} color={info.color} />}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444" }}>{score}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 6 }}>{info?.tip}</div>
                    <MiniBar score={animated ? score : 0} />
                  </div>
                );
              })}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
              {[
                ["issues", "문제점"],
                ...(plan === "pro" ? [["optimized", "최적화 콘텐츠"], ["changes", "변경사항"], ["ai", "AI별 전략"]] : [["quickwins", "즉시 개선 팁"]])
              ].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  padding: "7px 14px", fontSize: 12, fontWeight: tab === id ? 700 : 500,
                  background: tab === id ? "#6366f1" : "#fff",
                  color: tab === id ? "#fff" : "#6b7280",
                  border: `1px solid ${tab === id ? "#6366f1" : "#e5e7eb"}`,
                  borderRadius: 8, cursor: "pointer", transition: "all 0.15s"
                }}>{label}</button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 16, maxHeight: 420, overflowY: "auto" }}>

              {tab === "issues" && issues.map((issue, i) => (
                <div key={i} style={{ marginBottom: 10, padding: 14, background: "#f9fafb", borderRadius: 10, borderLeft: `3px solid ${severityColor[issue.severity] || "#d1d5db"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>{issue.category}</span>
                    <span style={{ fontSize: 10, color: severityColor[issue.severity], background: `${severityColor[issue.severity]}18`, padding: "2px 9px", borderRadius: 20, fontWeight: 700 }}>{severityLabel[issue.severity]}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#4b5563", marginBottom: 6, lineHeight: 1.5 }}>{issue.description}</div>
                  <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 600 }}>→ {issue.fix}</div>
                </div>
              ))}

              {tab === "quickwins" && (
                <div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>즉시 적용 가능한 개선 사항입니다:</div>
                  {(result.quickWins || []).map((win, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 13, color: "#111827", alignItems: "flex-start" }}>
                      <span style={{ color: "#10b981", flexShrink: 0, fontWeight: 700 }}>✓</span>{win}
                    </div>
                  ))}
                  <div style={{ marginTop: 20, padding: 14, background: "#f5f3ff", borderRadius: 10, border: "1px solid #c7d2fe" }}>
                    <div style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, marginBottom: 6 }}>✦ PRO 버전에서 제공하는 추가 기능</div>
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7 }}>최적화된 콘텐츠 자동 재작성 · AI별 인용 전략 · 경쟁사 격차 분석 · Schema 마크업 가이드</div>
                  </div>
                </div>
              )}

              {tab === "optimized" && plan === "pro" && (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                    <button onClick={copyOptimized} style={{ padding: "5px 13px", fontSize: 12, background: copied ? "#ecfdf5" : "#f3f4f6", color: copied ? "#10b981" : "#6b7280", border: `1px solid ${copied ? "#6ee7b7" : "#e5e7eb"}`, borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>{copied ? "✓ 복사됨" : "복사"}</button>
                  </div>
                  <pre style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.8, margin: 0, fontFamily: "inherit" }}>{result.optimizedContent}</pre>
                </>
              )}

              {tab === "changes" && plan === "pro" && (result.keyChanges || []).map((change, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 13, color: "#374151", alignItems: "flex-start" }}>
                  <span style={{ color: "#10b981", flexShrink: 0, fontWeight: 700, marginTop: 1 }}>✓</span>{change}
                </div>
              ))}

              {tab === "ai" && plan === "pro" && (
                <div>
                  {(result.aiCitationTips || []).map((tip, i) => (
                    <div key={i} style={{ marginBottom: 10, padding: "12px 14px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, color: "#374151" }}>
                      <span style={{ color: "#6366f1", fontWeight: 700 }}>▶ </span>{tip}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
