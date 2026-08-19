/* =========================================================
   푸른금융지주 - 온라인 문의 접수 (Supabase 연동)
   - 순수 JavaScript (설치·빌드 불필요)
   - 공개용(anon/publishable) 키는 브라우저 노출을 전제로 만든 키라
     프런트엔드 코드에 넣어도 안전합니다. (테이블 권한은 Supabase RLS로 제어)
   ========================================================= */

// --- Supabase 설정 --------------------------------------------------------
// 프로젝트 기본 주소만 사용 (뒤의 /rest/v1 같은 경로는 코드에서 붙입니다)
var SUPABASE_URL = "https://vrypunnebbdyrohwxzet.supabase.co";
var SUPABASE_KEY = "sb_publishable_RB-nkl7V-uNYeE8uMev-2w_QTFd9RKt";
var INQUIRIES_ENDPOINT = SUPABASE_URL + "/rest/v1/inquiries";

// --- 공통 헤더 ------------------------------------------------------------
function sbHeaders(extra) {
  var h = { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY };
  if (extra) { for (var k in extra) { h[k] = extra[k]; } }
  return h;
}

// --- 보안: 화면에 표시할 텍스트 안전 처리 --------------------------------
// (방문자가 남긴 내용을 목록에 그대로 넣지 않고 문자로만 처리해 스크립트 삽입을 막습니다)
function escapeText(str) {
  return String(str == null ? "" : str);
}

// --- 개인정보 보호: 이름 가운데 가리기 (예: 홍길동 → 홍*동) --------------
function maskName(name) {
  var n = String(name || "").trim();
  if (n.length <= 1) return n || "익명";
  if (n.length === 2) return n.charAt(0) + "*";
  return n.charAt(0) + "*".repeat(n.length - 2) + n.charAt(n.length - 1);
}

// --- 날짜 표시 (예: 2026.08.19 14:20) ------------------------------------
function formatDate(iso) {
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes());
  } catch (e) { return ""; }
}

// --- 접수 목록 불러오기 (최신순) -----------------------------------------
function loadInquiries() {
  var listEl = document.getElementById("inquiryList");
  if (!listEl) return;
  listEl.innerHTML = '<p class="inq-empty">불러오는 중…</p>';

  fetch(INQUIRIES_ENDPOINT + "?select=name,message,created_at&order=created_at.desc&limit=20", {
    headers: sbHeaders()
  })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (rows) {
      if (!rows || rows.length === 0) {
        listEl.innerHTML = '<p class="inq-empty">아직 접수된 문의가 없습니다. 첫 문의를 남겨주세요.</p>';
        return;
      }
      listEl.innerHTML = "";
      rows.forEach(function (row) {
        var item = document.createElement("div");
        item.className = "inq-item";

        var head = document.createElement("div");
        head.className = "inq-head";
        var who = document.createElement("span");
        who.className = "inq-who";
        who.textContent = maskName(row.name);           // textContent = 안전하게 문자만
        var when = document.createElement("span");
        when.className = "inq-when";
        when.textContent = formatDate(row.created_at);
        head.appendChild(who);
        head.appendChild(when);

        var body = document.createElement("p");
        body.className = "inq-body";
        body.textContent = escapeText(row.message);     // textContent = XSS 방지

        item.appendChild(head);
        item.appendChild(body);
        listEl.appendChild(item);
      });
    })
    .catch(function (err) {
      listEl.innerHTML = '<p class="inq-empty">목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>';
      console.error("[문의 목록 불러오기 실패]", err);
    });
}

// --- 폼 제출 (접수 저장) --------------------------------------------------
function setupInquiryForm() {
  var form = document.getElementById("inquiryForm");
  if (!form) return;
  var nameEl = document.getElementById("inqName");
  var msgEl = document.getElementById("inqMessage");
  var btn = document.getElementById("inqSubmit");
  var out = document.getElementById("inqMsg");

  function showMsg(text, ok) {
    if (!out) return;
    out.textContent = text;
    out.className = "form-msg show" + (ok ? "" : " error");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = (nameEl.value || "").trim();
    var message = (msgEl.value || "").trim();
    if (!name || !message) {
      form.reportValidity();
      return;
    }

    btn.disabled = true;
    var originalLabel = btn.textContent;
    btn.textContent = "접수 중…";

    fetch(INQUIRIES_ENDPOINT, {
      method: "POST",
      headers: sbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({ name: name, message: message })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        showMsg("✅ 문의가 정상적으로 접수되었습니다. 담당자가 확인 후 안내드리겠습니다.", true);
        form.reset();
        loadInquiries(); // 방금 남긴 문의가 목록에 바로 보이도록 새로고침
      })
      .catch(function (err) {
        showMsg("⚠️ 접수 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.", false);
        console.error("[문의 접수 실패]", err);
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = originalLabel;
      });
  });
}

// --- 시작 -----------------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
  setupInquiryForm();
  loadInquiries();
  var refresh = document.getElementById("inqRefresh");
  if (refresh) refresh.addEventListener("click", loadInquiries);
});
