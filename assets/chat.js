/* =========================================================
   푸른홀딩스 · 공시자료 AI 도우미 — 프런트엔드 위젯
   - 화면 우하단 런처 버튼 → 챗 패널 열기
   - /api/ask (Vercel 서버리스) 를 호출해 Claude 답변을 받음
   - 순수 JS, 의존성 없음. 배포된 사이트(Vercel)에서 동작.
   ========================================================= */
(function () {
  var API = "/api/ask";
  var history = [];      // {role, content}
  var busy = false;

  // ---------- DOM 생성 ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // 런처 버튼
  var launcher = el("button", "ai-launcher");
  launcher.setAttribute("aria-label", "공시 AI 도우미 열기");
  launcher.innerHTML =
    '<img src="assets/mascot.png" alt="" />' +
    '<span>AI 공시도우미</span>';

  // 패널
  var panel = el("div", "ai-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "공시 AI 도우미");
  panel.innerHTML =
    '<div class="ai-head">' +
      '<img class="ai-ava" src="assets/mascot.png" alt="" />' +
      '<div class="ai-head-t"><b>공시 AI 도우미</b><small>푸른홀딩스 · 사실 기반 안내</small></div>' +
      '<button class="ai-close" aria-label="닫기">&times;</button>' +
    '</div>' +
    '<div class="ai-msgs" id="aiMsgs"></div>' +
    '<form class="ai-input" id="aiForm">' +
      '<textarea id="aiText" rows="1" placeholder="공시자료에 대해 궁금한 점을 물어보세요" maxlength="1000"></textarea>' +
      '<button type="submit" id="aiSend" aria-label="보내기">↑</button>' +
    '</form>' +
    '<div class="ai-foot">AI가 공개 자료를 근거로 안내합니다. 투자 판단의 근거로만 삼지 마세요.</div>';

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  var msgs = panel.querySelector("#aiMsgs");
  var form = panel.querySelector("#aiForm");
  var input = panel.querySelector("#aiText");
  var closeBtn = panel.querySelector(".ai-close");

  // ---------- 메시지 렌더 ----------
  function addMsg(role, text) {
    var wrap = el("div", "ai-msg " + role);
    if (role === "bot") {
      var av = el("img", "ai-msg-ava"); av.src = "assets/mascot.png"; av.alt = "";
      wrap.appendChild(av);
    }
    var bubble = el("div", "ai-bubble");
    bubble.textContent = text;                 // textContent = XSS 안전
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    return bubble;
  }

  function addTyping() {
    var wrap = el("div", "ai-msg bot ai-typing");
    var av = el("img", "ai-msg-ava"); av.src = "assets/mascot.png"; av.alt = "";
    var bubble = el("div", "ai-bubble");
    bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    wrap.appendChild(av); wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    return wrap;
  }

  var greeted = false;
  function greet() {
    if (greeted) return; greeted = true;
    addMsg("bot", "안녕하세요! 푸른홀딩스 공시 AI 도우미입니다. 그룹·계열사(저축은행·자산운용·인베스트먼트)의 공개 자료에 대해 궁금한 점을 물어보세요. 예: “푸른저축은행은 어떤 회사인가요?”, “지주사 전환은 어떤 의미인가요?”");
  }

  // ---------- 열고 닫기 ----------
  function open() {
    panel.classList.add("open");
    launcher.classList.add("hidden");
    greet();
    setTimeout(function () { input.focus(); }, 100);
  }
  function close() {
    panel.classList.remove("open");
    launcher.classList.remove("hidden");
  }
  launcher.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  window.openPureunChat = open;   // 다른 버튼에서 열 수 있도록 노출

  // 입력창 자동 높이
  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });
  // Enter 전송(Shift+Enter 줄바꿈)
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });

  // ---------- 전송 ----------
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    var q = (input.value || "").trim();
    if (!q) return;

    addMsg("user", q);
    history.push({ role: "user", content: q });
    input.value = ""; input.style.height = "auto";

    busy = true;
    var typing = addTyping();

    fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q, history: history.slice(-8) })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        typing.remove();
        if (!res.ok) {
          addMsg("bot", (res.d && res.d.error) ? res.d.error : "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        var a = res.d.answer || "답변을 생성하지 못했습니다.";
        addMsg("bot", a);
        history.push({ role: "assistant", content: a });
      })
      .catch(function () {
        typing.remove();
        addMsg("bot", "연결에 실패했습니다. (AI 기능은 인터넷에 배포된 사이트에서 동작합니다.)");
      })
      .then(function () { busy = false; });
  });
})();
