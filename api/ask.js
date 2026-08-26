/* =========================================================
   푸른홀딩스 · 공시자료 AI 도우미 — Vercel 서버리스 함수
   POST /api/ask   { question: string, history?: [{role, content}] }
   → { answer: string }

   - Anthropic Claude(Haiku) 호출. API 키는 환경변수 ANTHROPIC_API_KEY 에서만 읽음(코드에 없음).
   - 공시 지식은 Supabase `disclosures` 테이블에서 불러와 '사실 근거'로 제공.
   - 질문/답변은 Supabase `chat_logs` 테이블에 기록(무엇을 궁금해하는지 추적).
   - 의존성 설치 없음(Node 내장 fetch 사용).
   ========================================================= */

module.exports = async function handler(req, res) {
  // --- CORS(같은 도메인 사용이지만 안전하게) ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST 요청만 지원합니다." }); return; }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "서버 설정 오류: ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다." });
    return;
  }

  // --- 요청 본문 파싱 ---
  var body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  if (!body || typeof body !== "object") body = {};
  var question = (body.question == null ? "" : String(body.question)).trim();
  var history = Array.isArray(body.history) ? body.history : [];
  if (!question) { res.status(400).json({ error: "질문이 비어 있습니다." }); return; }
  if (question.length > 1000) question = question.slice(0, 1000); // 비용/남용 방지

  // --- Supabase 설정(공개 anon 키; 서버 환경변수로 덮어쓸 수 있음) ---
  var SB_URL = process.env.SUPABASE_URL || "https://vrypunnebbdyrohwxzet.supabase.co";
  var SB_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_RB-nkl7V-uNYeE8uMev-2w_QTFd9RKt";

  // --- 1) 공시 지식 불러오기 (사실 근거) ---
  var factsText = "(아직 등록된 공시자료가 없습니다. 일반 공개 정보 범위에서만 안내하세요.)";
  try {
    var kr = await fetch(
      SB_URL + "/rest/v1/disclosures?select=title,category,content,source_url,disclosed_at&order=disclosed_at.desc&limit=60",
      { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } }
    );
    if (kr.ok) {
      var rows = await kr.json();
      if (Array.isArray(rows) && rows.length) {
        factsText = rows.map(function (f, i) {
          return "[" + (i + 1) + "] (" + (f.category || "공시") +
            (f.disclosed_at ? ", " + f.disclosed_at : "") + ") " + (f.title || "") +
            "\n" + (f.content || "") + (f.source_url ? "\n출처: " + f.source_url : "");
        }).join("\n\n");
      }
    }
  } catch (e) { /* 지식 없으면 일반 안내로 진행 */ }

  // --- 2) 시스템 프롬프트(서비스 성격/역할) ---
  var system =
    "당신은 '푸른홀딩스(PFG)'의 공시자료 안내 AI 도우미입니다.\n\n" +
    "[서비스 소개]\n" +
    "푸른홀딩스는 푸른저축은행·푸른파트너스자산운용·푸른인베스트먼트를 계열로 두는 지주회사입니다. " +
    "이 도우미는 외부 이용자가 그룹·계열사의 공시 및 공개 자료를 조회하고 질문하면 답해 주는 서비스입니다.\n\n" +
    "[역할과 원칙]\n" +
    "1) 단순히 자료를 그대로 나열하지 말고, 질문자가 '무엇을 알고 싶어서' 물었는지 그 의도와 맥락을 먼저 헤아려, 정말 도움이 되도록 핵심을 정리해 설명하세요. 사고하는 도우미처럼 답합니다.\n" +
    "2) 그러나 답변에 담기는 '사실·수치'는 반드시 아래 [제공된 공시자료]와 명백한 공개 정보에만 근거해야 합니다. 자료에 없는 사실·수치를 추측하거나 지어내지 마세요.\n" +
    "3) 자료에 없어 확인할 수 없으면 '제공된 공시자료에서는 확인되지 않습니다'라고 솔직히 밝히고, 확인 방법(금융감독원 전자공시 DART, 담당자 문의 등)을 안내하세요.\n" +
    "4) 투자 권유나 단정적 전망은 하지 않습니다. 사실 전달과 이해를 돕는 데 집중합니다.\n" +
    "5) 한국어로, 정중하고 간결하게(핵심 위주로) 답합니다. 필요하면 짧은 목록을 사용하세요.\n\n" +
    "[제공된 공시자료]\n" + factsText;

  // --- 3) 대화 메시지 구성(직전 맥락 일부 포함) ---
  var messages = [];
  history.slice(-8).forEach(function (m) {
    if (m && (m.role === "user" || m.role === "assistant") && m.content) {
      messages.push({ role: m.role, content: String(m.content).slice(0, 2000) });
    }
  });
  messages.push({ role: "user", content: question });

  // --- 4) Claude 호출 (가장 저렴한 Haiku) ---
  var answer = "";
  try {
    var resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: system,
        messages: messages
      })
    });
    var data = await resp.json();
    if (!resp.ok) {
      res.status(502).json({ error: "AI 응답 생성 중 오류가 발생했습니다.", detail: (data && data.error) || null });
      return;
    }
    answer = (data.content || [])
      .filter(function (b) { return b.type === "text"; })
      .map(function (b) { return b.text; })
      .join("\n").trim();
  } catch (e) {
    res.status(502).json({ error: "AI 서버 호출에 실패했습니다. 잠시 후 다시 시도해 주세요." });
    return;
  }
  if (!answer) answer = "죄송합니다. 답변을 생성하지 못했습니다. 질문을 조금 더 구체적으로 남겨주시겠어요?";

  // --- 5) 질문 추적 로그 저장(실패해도 답변에는 영향 없음) ---
  try {
    await fetch(SB_URL + "/rest/v1/chat_logs", {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        "content-type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ question: question, answer: answer })
    });
  } catch (e) { /* 로그 실패 무시 */ }

  res.status(200).json({ answer: answer });
};
